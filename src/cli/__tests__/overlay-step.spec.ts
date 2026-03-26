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
function createTestEntry(
  overrides: Partial<AdapterRegistryEntry> = {},
): AdapterRegistryEntry {
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
    // 4. Определить целевой путь: <projectRoot>/<entry.targetRoot>/<относительный путь>
    // 5. Создать промежуточные каталоги при необходимости
    // 6. Скопировать файл побайтово
    // 7. Сформировать TranspilerStepOutcome с name: "Overlay", writtenCount и errors
    it('копирует файлы из overlays/<entry.id>/ в <entry.targetRoot>/ и возвращает outcome с name "Overlay" и корректным writtenCount', () => {
      const entry = createTestEntry({ id: "claude", targetRoot: ".claude" });

      // Создаём overlay-файлы
      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      fs.mkdirSync(overlayDir, { recursive: true });
      fs.writeFileSync(
        path.join(overlayDir, "settings.json"),
        '{"key": "value"}',
      );
      fs.writeFileSync(path.join(overlayDir, "config.txt"), "overlay content");

      const outcome = runOverlayStep({ entry, projectRoot: tmpDir });

      expect(outcome.name).toBe("Overlay");
      expect(outcome.writtenCount).toBe(2);
      expect(outcome.errors).toEqual([]);

      // Проверяем, что файлы действительно скопированы в целевую директорию
      const targetSettings = fs.readFileSync(
        path.join(tmpDir, ".claude", "settings.json"),
        "utf-8",
      );
      expect(targetSettings).toBe('{"key": "value"}');

      const targetConfig = fs.readFileSync(
        path.join(tmpDir, ".claude", "config.txt"),
        "utf-8",
      );
      expect(targetConfig).toBe("overlay content");
    });

    // --- Трансформация: шаги 3-4 — рекурсивная структура подкаталогов ---
    // Вложенные подкаталоги из overlays/ воспроизводятся в targetRoot
    it("сохраняет структуру вложенных подкаталогов при копировании", () => {
      const entry = createTestEntry({ id: "claude", targetRoot: ".claude" });

      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      const nestedDir = path.join(overlayDir, "commands", "sub");
      fs.mkdirSync(nestedDir, { recursive: true });
      fs.writeFileSync(path.join(nestedDir, "deep-file.md"), "deep content");
      fs.writeFileSync(path.join(overlayDir, "root-file.txt"), "root content");

      const outcome = runOverlayStep({ entry, projectRoot: tmpDir });

      expect(outcome.writtenCount).toBe(2);
      expect(outcome.errors).toEqual([]);

      // Проверяем сохранение вложенной структуры
      const deepFile = fs.readFileSync(
        path.join(tmpDir, ".claude", "commands", "sub", "deep-file.md"),
        "utf-8",
      );
      expect(deepFile).toBe("deep content");

      const rootFile = fs.readFileSync(
        path.join(tmpDir, ".claude", "root-file.txt"),
        "utf-8",
      );
      expect(rootFile).toBe("root content");
    });

    // --- Трансформация: шаг 6 — побайтовое копирование ---
    // Бинарные файлы копируются без искажений содержимого
    it("копирует бинарные файлы побайтово без искажений", () => {
      const entry = createTestEntry({ id: "claude", targetRoot: ".claude" });

      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      fs.mkdirSync(overlayDir, { recursive: true });

      // Бинарные данные с null bytes и произвольными байтами
      const binaryContent = Buffer.from([
        0x00, 0x01, 0xff, 0xfe, 0x89, 0x50, 0x4e, 0x47,
      ]);
      fs.writeFileSync(path.join(overlayDir, "binary.bin"), binaryContent);

      const outcome = runOverlayStep({ entry, projectRoot: tmpDir });

      expect(outcome.writtenCount).toBe(1);
      expect(outcome.errors).toEqual([]);

      const copied = fs.readFileSync(
        path.join(tmpDir, ".claude", "binary.bin"),
      );
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

    // --- Расширение 5a: ошибка создания промежуточного каталога ---
    // → добавить сообщение в errors, продолжить с оставшимися файлами
    it("добавляет ошибку в errors и продолжает с оставшимися файлами при ошибке создания промежуточного каталога", () => {
      const entry = createTestEntry({ id: "claude", targetRoot: ".claude" });

      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      // Файл в подкаталоге — потребует создания промежуточного каталога
      const subDir = path.join(overlayDir, "blocked-dir");
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(path.join(subDir, "blocked-file.txt"), "blocked");
      // Файл в корне — не требует создания дополнительного каталога
      fs.writeFileSync(path.join(overlayDir, "ok-file.txt"), "ok content");

      // Создаём файл (не каталог) по пути, где должен быть промежуточный каталог
      const targetRoot = path.join(tmpDir, ".claude");
      fs.mkdirSync(targetRoot, { recursive: true });
      fs.writeFileSync(
        path.join(targetRoot, "blocked-dir"),
        "I am a file, not a directory",
      );

      const outcome = runOverlayStep({ entry, projectRoot: tmpDir });

      expect(outcome.name).toBe("Overlay");
      // Ровно одна ошибка: создание каталога blocked-dir
      expect(outcome.errors).toHaveLength(1);
      // Ровно один файл скопирован: ok-file.txt (blocked-dir/blocked-file.txt не скопирован)
      expect(outcome.writtenCount).toBe(1);

      // Проверяем побочный эффект: ok-file.txt успешно скопирован
      const okFile = fs.readFileSync(
        path.join(targetRoot, "ok-file.txt"),
        "utf-8",
      );
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

      // Создаём каталог на пути целевого файла — copyFile в каталог провалится
      const targetRoot = path.join(tmpDir, ".claude");
      fs.mkdirSync(path.join(targetRoot, "fail-file.txt"), { recursive: true });

      const outcome = runOverlayStep({ entry, projectRoot: tmpDir });

      expect(outcome.name).toBe("Overlay");
      // Ровно одна ошибка: копирование fail-file.txt
      expect(outcome.errors).toHaveLength(1);
      // Ровно один файл скопирован: ok-file.txt (fail-file.txt не скопирован)
      expect(outcome.writtenCount).toBe(1);

      // Проверяем побочный эффект: ok-file.txt успешно скопирован
      const okFile = fs.readFileSync(
        path.join(targetRoot, "ok-file.txt"),
        "utf-8",
      );
      expect(okFile).toBe("will succeed");
    });
  });
});
