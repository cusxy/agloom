// overlay-step.spec.ts
// Спецификация: docs/specs/provider-overlay.md § Операция overlay

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { runOverlayStep } from "../overlay-step.js";
import type { AdapterRegistryEntry } from "../types.js";

/**
 * Минимальный стаб AdapterRegistryEntry для тестов overlay.
 * Операция overlay использует только entry.id и entry.targetRoot.
 */
function createTestEntry(overrides: Partial<AdapterRegistryEntry> = {}): AdapterRegistryEntry {
  return {
    id: "test-adapter",
    description: "Test Adapter",
    instructions: {} as AdapterRegistryEntry["instructions"],
    skills: {} as AdapterRegistryEntry["skills"],
    agents: {} as AdapterRegistryEntry["agents"],
    targetRoot: ".test-target",
    targetFiles: [],
    ...overrides,
  };
}

describe("CLI", () => {
  describe("Операция overlay", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-overlay-"));
    });

    afterEach(() => {
      // Восстанавливаем права перед очисткой (для теста 2a)
      const overlayDir = path.join(tmpDir, ".agloom", "overlays");
      try {
        fs.chmodSync(overlayDir, 0o755);
      } catch {
        // директория может не существовать
      }
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Happy path: шаги 1-7 ---
    // 1. Определить директорию-источник: <projectRoot>/.agloom/overlays/<entry.id>/
    // 2. Рекурсивно обнаружить все файлы в директории-источнике
    // 3. Определить относительный путь файла внутри директории-источника
    // 4. Определить целевой путь: <projectRoot>/<относительный путь>
    // 5. Создать промежуточные каталоги при необходимости
    // 6. Скопировать файл побайтово
    // 7. Сформировать TranspilerStepOutcome с name: "Overlay", writtenCount и errors
    it('копирует файлы из overlays/<entry.id>/ в project root и возвращает outcome с name "Overlay" и корректным writtenCount', () => {
      const entry = createTestEntry({ id: "claude", targetRoot: ".claude" });

      // Создаём overlay-файлы (структура отражает позицию в project root)
      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      const overlayClaudeDir = path.join(overlayDir, ".claude");
      fs.mkdirSync(overlayClaudeDir, { recursive: true });
      fs.writeFileSync(path.join(overlayClaudeDir, "settings.json"), '{"key": "value"}');
      fs.writeFileSync(path.join(overlayDir, ".mcp.json"), '{"mcp": true}');

      const outcome = runOverlayStep({ entry, projectRoot: tmpDir });

      expect(outcome.name).toBe("Overlay");
      expect(outcome.writtenCount).toBe(2);
      expect(outcome.errors).toEqual([]);

      // Проверяем, что файлы скопированы в project root с сохранением пути
      const targetSettings = fs.readFileSync(path.join(tmpDir, ".claude", "settings.json"), "utf-8");
      expect(targetSettings).toBe('{"key": "value"}');

      const targetMcp = fs.readFileSync(path.join(tmpDir, ".mcp.json"), "utf-8");
      expect(targetMcp).toBe('{"mcp": true}');
    });

    // --- Трансформация: шаги 3-4 — рекурсивная структура подкаталогов ---
    // Вложенные подкаталоги из overlays/ воспроизводятся в project root
    it("сохраняет структуру вложенных подкаталогов при копировании", () => {
      const entry = createTestEntry({ id: "claude", targetRoot: ".claude" });

      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      const nestedDir = path.join(overlayDir, ".claude", "commands", "sub");
      fs.mkdirSync(nestedDir, { recursive: true });
      fs.writeFileSync(path.join(nestedDir, "deep-file.md"), "deep content");
      fs.writeFileSync(path.join(overlayDir, "root-file.txt"), "root content");

      const outcome = runOverlayStep({ entry, projectRoot: tmpDir });

      expect(outcome.writtenCount).toBe(2);
      expect(outcome.errors).toEqual([]);

      // Проверяем сохранение вложенной структуры
      const deepFile = fs.readFileSync(path.join(tmpDir, ".claude", "commands", "sub", "deep-file.md"), "utf-8");
      expect(deepFile).toBe("deep content");

      const rootFile = fs.readFileSync(path.join(tmpDir, "root-file.txt"), "utf-8");
      expect(rootFile).toBe("root content");
    });

    // --- Трансформация: шаг 6 — побайтовое копирование ---
    // Бинарные файлы копируются без искажений содержимого
    it("копирует бинарные файлы побайтово без искажений", () => {
      const entry = createTestEntry({ id: "claude", targetRoot: ".claude" });

      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      const overlayClaudeDir = path.join(overlayDir, ".claude");
      fs.mkdirSync(overlayClaudeDir, { recursive: true });

      // Бинарные данные с null bytes и произвольными байтами
      const binaryContent = Buffer.from([0x00, 0x01, 0xff, 0xfe, 0x89, 0x50, 0x4e, 0x47]);
      fs.writeFileSync(path.join(overlayClaudeDir, "binary.bin"), binaryContent);

      const outcome = runOverlayStep({ entry, projectRoot: tmpDir });

      expect(outcome.writtenCount).toBe(1);
      expect(outcome.errors).toEqual([]);

      const copied = fs.readFileSync(path.join(tmpDir, ".claude", "binary.bin"));
      expect(Buffer.compare(copied, binaryContent)).toBe(0);
    });

    // --- Расширение 1a: директория-источник не существует ---
    // → вернуть TranspilerStepOutcome с writtenCount: 0 и пустым errors
    it("возвращает writtenCount: 0 и пустые errors если директория overlays/<entry.id>/ не существует", () => {
      const entry = createTestEntry({
        id: "nonexistent",
        targetRoot: ".claude",
      });
      // Не создаём директорию .agloom/overlays/nonexistent/

      const outcome = runOverlayStep({ entry, projectRoot: tmpDir });

      expect(outcome.name).toBe("Overlay");
      expect(outcome.writtenCount).toBe(0);
      expect(outcome.errors).toEqual([]);
    });

    // --- Расширение 2a: ошибка обхода директории ---
    // I/O-ошибка при чтении содержимого → TranspilerStepOutcome
    // с writtenCount: 0 и [errorMessage] в errors
    // Skip: chmod 000 не работает на Windows и бесполезен под root
    it.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
      "возвращает writtenCount: 0 и ошибку при I/O-ошибке обхода директории-источника",
      () => {
        const entry = createTestEntry({
          id: "claude",
          targetRoot: ".claude",
        });

        const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
        fs.mkdirSync(overlayDir, { recursive: true });
        fs.writeFileSync(path.join(overlayDir, "file.txt"), "content");

        // Делаем директорию нечитаемой для провокации I/O-ошибки при обходе
        fs.chmodSync(overlayDir, 0o000);

        const outcome = runOverlayStep({ entry, projectRoot: tmpDir });

        // Восстанавливаем права для cleanup в afterEach
        fs.chmodSync(overlayDir, 0o755);

        expect(outcome.name).toBe("Overlay");
        expect(outcome.writtenCount).toBe(0);
        expect(outcome.errors).toHaveLength(1);
        expect(outcome.errors[0]).toBeTruthy();
      },
    );

    // --- Шаг 7: интерполяция текстового файла с расширением из whitelist ---
    // Если variables передан И расширение файла входит в INTERPOLATABLE_EXTENSIONS →
    // прочитать UTF-8, interpolate(), записать UTF-8
    it("интерполирует текстовые файлы с расширением из whitelist при наличии variables", () => {
      const entry = createTestEntry({ id: "claude", targetRoot: ".claude" });

      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      fs.mkdirSync(overlayDir, { recursive: true });
      fs.writeFileSync(path.join(overlayDir, "config.md"), "Root: ${agloom:ROOT_DIR}");

      const variables: Record<string, string> = { ROOT_DIR: ".claude" };
      const env: Record<string, string> = {};

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        variables,
        env,
      });

      expect(outcome.writtenCount).toBe(1);
      expect(outcome.errors).toEqual([]);

      const content = fs.readFileSync(path.join(tmpDir, "config.md"), "utf-8");
      expect(content).toBe("Root: .claude");
    });

    // --- Шаг 7: интерполяция работает для всех расширений из INTERPOLATABLE_EXTENSIONS ---
    it("интерполирует файлы с расширениями .json, .yml, .yaml, .txt, .toml, .xml, .html, .svg, .jsonc, .jsonl", () => {
      const entry = createTestEntry({ id: "claude", targetRoot: ".claude" });

      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      fs.mkdirSync(overlayDir, { recursive: true });

      const extensions = [".json", ".yml", ".yaml", ".txt", ".toml", ".xml", ".html", ".svg", ".jsonc", ".jsonl"];
      for (const ext of extensions) {
        fs.writeFileSync(path.join(overlayDir, `file${ext}`), "dir: ${agloom:ROOT_DIR}");
      }

      const variables: Record<string, string> = { ROOT_DIR: ".claude" };

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        variables,
        env: {},
      });

      expect(outcome.writtenCount).toBe(extensions.length);
      expect(outcome.errors).toEqual([]);

      for (const ext of extensions) {
        const content = fs.readFileSync(path.join(tmpDir, `file${ext}`), "utf-8");
        expect(content).toBe("dir: .claude");
      }
    });

    // --- Шаг 7: case-insensitive сравнение расширений ---
    it("выполняет case-insensitive сравнение расширений при интерполяции", () => {
      const entry = createTestEntry({ id: "claude", targetRoot: ".claude" });

      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      fs.mkdirSync(overlayDir, { recursive: true });
      fs.writeFileSync(path.join(overlayDir, "FILE.MD"), "Root: ${agloom:ROOT_DIR}");
      fs.writeFileSync(path.join(overlayDir, "config.Json"), '{"root": "${agloom:ROOT_DIR}"}');

      const variables: Record<string, string> = { ROOT_DIR: ".claude" };

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        variables,
        env: {},
      });

      expect(outcome.writtenCount).toBe(2);
      expect(outcome.errors).toEqual([]);

      const md = fs.readFileSync(path.join(tmpDir, "FILE.MD"), "utf-8");
      expect(md).toBe("Root: .claude");

      const json = fs.readFileSync(path.join(tmpDir, "config.Json"), "utf-8");
      expect(json).toBe('{"root": ".claude"}');
    });

    // --- Шаг 7: интерполяция с env переменными ---
    it("интерполирует ${env:NAME} в overlay-файлах при наличии env параметра", () => {
      const entry = createTestEntry({ id: "claude", targetRoot: ".claude" });

      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      fs.mkdirSync(overlayDir, { recursive: true });
      fs.writeFileSync(path.join(overlayDir, "config.yml"), "project: ${env:MY_PROJECT}");

      const variables: Record<string, string> = {};
      const env: Record<string, string> = { MY_PROJECT: "agloom" };

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        variables,
        env,
      });

      expect(outcome.writtenCount).toBe(1);
      expect(outcome.errors).toEqual([]);

      const content = fs.readFileSync(path.join(tmpDir, "config.yml"), "utf-8");
      expect(content).toBe("project: agloom");
    });

    // --- Шаг 8: файлы с расширением не из whitelist копируются побайтово ---
    it("копирует файлы с расширением не из whitelist побайтово даже при наличии variables", () => {
      const entry = createTestEntry({ id: "claude", targetRoot: ".claude" });

      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      fs.mkdirSync(overlayDir, { recursive: true });

      // Файл с расширением .bin не в whitelist — содержимое с ${agloom:...} должно сохраниться
      const contentWithInterpolation = "Root: ${agloom:ROOT_DIR}";
      fs.writeFileSync(path.join(overlayDir, "data.bin"), contentWithInterpolation);

      const variables: Record<string, string> = { ROOT_DIR: ".claude" };

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        variables,
        env: {},
      });

      expect(outcome.writtenCount).toBe(1);
      expect(outcome.errors).toEqual([]);

      // Содержимое НЕ интерполировано — скопировано побайтово
      const copied = fs.readFileSync(path.join(tmpDir, "data.bin"), "utf-8");
      expect(copied).toBe(contentWithInterpolation);
    });

    // --- Шаг 8: бинарные файлы копируются побайтово при наличии variables ---
    it("копирует бинарные файлы побайтово даже при наличии variables", () => {
      const entry = createTestEntry({ id: "claude", targetRoot: ".claude" });

      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      fs.mkdirSync(overlayDir, { recursive: true });

      const binaryContent = Buffer.from([0x00, 0x01, 0xff, 0xfe, 0x89, 0x50, 0x4e, 0x47]);
      fs.writeFileSync(path.join(overlayDir, "image.png"), binaryContent);

      const variables: Record<string, string> = { ROOT_DIR: ".claude" };

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        variables,
        env: {},
      });

      expect(outcome.writtenCount).toBe(1);
      expect(outcome.errors).toEqual([]);

      const copied = fs.readFileSync(path.join(tmpDir, "image.png"));
      expect(Buffer.compare(copied, binaryContent)).toBe(0);
    });

    // --- Обратная совместимость: если variables не передан → все файлы побайтово ---
    it("копирует все файлы побайтово без интерполяции, если variables не передан", () => {
      const entry = createTestEntry({ id: "claude", targetRoot: ".claude" });

      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      fs.mkdirSync(overlayDir, { recursive: true });
      fs.writeFileSync(path.join(overlayDir, "config.md"), "Root: ${agloom:ROOT_DIR}");

      // Вызов без variables — обратная совместимость
      const outcome = runOverlayStep({ entry, projectRoot: tmpDir });

      expect(outcome.writtenCount).toBe(1);
      expect(outcome.errors).toEqual([]);

      // Содержимое НЕ интерполировано
      const content = fs.readFileSync(path.join(tmpDir, "config.md"), "utf-8");
      expect(content).toBe("Root: ${agloom:ROOT_DIR}");
    });

    // --- Расширение 7a: InterpolationError → добавить в errors, продолжить ---
    it("добавляет ошибку интерполяции в errors и продолжает с оставшимися файлами", () => {
      const entry = createTestEntry({ id: "claude", targetRoot: ".claude" });

      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      fs.mkdirSync(overlayDir, { recursive: true });

      // Файл с неизвестной переменной — вызовет InterpolationError
      fs.writeFileSync(path.join(overlayDir, "bad.md"), "Value: ${agloom:NONEXISTENT}");
      // Файл с валидной переменной — должен быть обработан успешно
      fs.writeFileSync(path.join(overlayDir, "good.md"), "Root: ${agloom:ROOT_DIR}");

      const variables: Record<string, string> = { ROOT_DIR: ".claude" };

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        variables,
        env: {},
      });

      // Один файл записан успешно, один с ошибкой
      expect(outcome.writtenCount).toBe(1);
      expect(outcome.errors).toHaveLength(1);
      expect(outcome.errors[0]).toMatch(/Interpolation failed for/);
      expect(outcome.errors[0]).toMatch(/bad\.md/);

      // good.md успешно интерполирован
      const goodContent = fs.readFileSync(path.join(tmpDir, "good.md"), "utf-8");
      expect(goodContent).toBe("Root: .claude");
    });

    // --- Расширение 7a: формат ошибки содержит относительный путь и причину ---
    it('формирует ошибку интерполяции в формате "Interpolation failed for {путь}: {причина}"', () => {
      const entry = createTestEntry({ id: "claude", targetRoot: ".claude" });

      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      const nestedDir = path.join(overlayDir, "docs");
      fs.mkdirSync(nestedDir, { recursive: true });
      fs.writeFileSync(path.join(nestedDir, "readme.md"), "Missing: ${agloom:UNKNOWN_VAR}");

      const variables: Record<string, string> = {};

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        variables,
        env: {},
      });

      expect(outcome.errors).toHaveLength(1);
      // Проверяем формат: "Interpolation failed for docs/readme.md: Unknown agloom variable: UNKNOWN_VAR"
      expect(outcome.errors[0]).toContain("Interpolation failed for");
      expect(outcome.errors[0]).toContain(path.join("docs", "readme.md"));
      expect(outcome.errors[0]).toContain("Unknown agloom variable: UNKNOWN_VAR");
    });

    // --- Шаг 7+8: смешанный сценарий — текстовые интерполируются, бинарные копируются ---
    it("интерполирует текстовые файлы и побайтово копирует бинарные в одном overlay", () => {
      const entry = createTestEntry({ id: "claude", targetRoot: ".claude" });

      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      fs.mkdirSync(overlayDir, { recursive: true });

      // Текстовый файл — интерполируется
      fs.writeFileSync(path.join(overlayDir, "readme.md"), "Dir: ${agloom:ROOT_DIR}");
      // Бинарный файл — побайтово
      const binaryContent = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      fs.writeFileSync(path.join(overlayDir, "icon.png"), binaryContent);

      const variables: Record<string, string> = { ROOT_DIR: ".claude" };

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        variables,
        env: {},
      });

      expect(outcome.writtenCount).toBe(2);
      expect(outcome.errors).toEqual([]);

      // Текстовый файл интерполирован
      const md = fs.readFileSync(path.join(tmpDir, "readme.md"), "utf-8");
      expect(md).toBe("Dir: .claude");

      // Бинарный файл скопирован побайтово
      const png = fs.readFileSync(path.join(tmpDir, "icon.png"));
      expect(Buffer.compare(png, binaryContent)).toBe(0);
    });

    // --- Расширение 5a: ошибка создания промежуточного каталога ---
    // → добавить сообщение в errors, продолжить с оставшимися файлами
    it("добавляет ошибку в errors и продолжает с оставшимися файлами при ошибке создания промежуточного каталога", () => {
      const entry = createTestEntry({ id: "claude", targetRoot: ".claude" });

      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      // Файл в подкаталоге — потребует создания промежуточного каталога
      const subDir = path.join(overlayDir, "blocked-dir");
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(path.join(subDir, "blocked-file.txt"), "blocked");
      // Файл в корне overlay — копируется в project root, не требует создания каталога
      fs.writeFileSync(path.join(overlayDir, "ok-file.txt"), "ok content");

      // Создаём файл (не каталог) по пути, где должен быть промежуточный каталог в project root
      fs.writeFileSync(path.join(tmpDir, "blocked-dir"), "I am a file, not a directory");

      const outcome = runOverlayStep({ entry, projectRoot: tmpDir });

      expect(outcome.name).toBe("Overlay");
      // Ровно одна ошибка: создание каталога blocked-dir
      expect(outcome.errors).toHaveLength(1);
      // Ровно один файл скопирован: ok-file.txt (blocked-dir/blocked-file.txt не скопирован)
      expect(outcome.writtenCount).toBe(1);

      // Проверяем побочный эффект: ok-file.txt успешно скопирован в project root
      const okFile = fs.readFileSync(path.join(tmpDir, "ok-file.txt"), "utf-8");
      expect(okFile).toBe("ok content");
    });

    // --- Расширение 6a: ошибка копирования ---
    // → добавить сообщение в errors, продолжить с оставшимися файлами
    it("добавляет ошибку в errors и продолжает с оставшимися файлами при ошибке копирования", () => {
      const entry = createTestEntry({ id: "claude", targetRoot: ".claude" });

      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      fs.mkdirSync(overlayDir, { recursive: true });
      fs.writeFileSync(path.join(overlayDir, "fail-file.txt"), "will fail");
      fs.writeFileSync(path.join(overlayDir, "ok-file.txt"), "will succeed");

      // Создаём каталог на пути целевого файла в project root — copyFile в каталог провалится
      fs.mkdirSync(path.join(tmpDir, "fail-file.txt"), { recursive: true });

      const outcome = runOverlayStep({ entry, projectRoot: tmpDir });

      expect(outcome.name).toBe("Overlay");
      // Ровно одна ошибка: копирование fail-file.txt
      expect(outcome.errors).toHaveLength(1);
      // Ровно один файл скопирован: ok-file.txt (fail-file.txt не скопирован)
      expect(outcome.writtenCount).toBe(1);

      // Проверяем побочный эффект: ok-file.txt успешно скопирован в project root
      const okFile = fs.readFileSync(path.join(tmpDir, "ok-file.txt"), "utf-8");
      expect(okFile).toBe("will succeed");
    });
  });
});
