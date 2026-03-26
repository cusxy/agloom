// discover.spec.ts
// Спецификация: docs/specs/instructions-transpiler.md § Обнаружение канонических файлов

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createInstructionsTranspiler } from "../index.js";
import { DiscoverError } from "../errors.js";

/**
 * Стаб-адаптер для тестов discover(). Транспиляция здесь не тестируется.
 */
function createStubAdapter(agentId: string) {
  return {
    agentId,
    transpile: () => [],
  };
}

describe("InstructionsTranspiler", () => {
  describe("Обнаружение канонических файлов", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-discover-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Happy path: шаги 1–9 ---
    it("обнаруживает все четыре типа канонических файлов: root, local, directory, directory-local", () => {
      // Arrange
      fs.writeFileSync(path.join(tmpDir, "AGLOOM.md"), "root content");
      fs.writeFileSync(path.join(tmpDir, "AGLOOM.local.md"), "local content");
      const subDir = path.join(tmpDir, "src", "module");
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(path.join(subDir, "AGLOOM.md"), "directory content");
      fs.writeFileSync(
        path.join(subDir, "AGLOOM.local.md"),
        "directory-local content",
      );

      const transpiler = createInstructionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      // Act
      const files = transpiler.discover();

      // Assert
      expect(files).toHaveLength(4);

      const root = files.find((f) => f.type === "root");
      expect(root).toBeDefined();
      expect(root!.relativePath).toBe("AGLOOM.md");
      expect(root!.content).toBe("root content");

      const local = files.find((f) => f.type === "local");
      expect(local).toBeDefined();
      expect(local!.relativePath).toBe("AGLOOM.local.md");
      expect(local!.content).toBe("local content");

      const dir = files.find((f) => f.type === "directory");
      expect(dir).toBeDefined();
      expect(dir!.relativePath).toBe(path.join("src", "module", "AGLOOM.md"));
      expect(dir!.content).toBe("directory content");

      const dirLocal = files.find((f) => f.type === "directory-local");
      expect(dirLocal).toBeDefined();
      expect(dirLocal!.relativePath).toBe(
        path.join("src", "module", "AGLOOM.local.md"),
      );
      expect(dirLocal!.content).toBe("directory-local content");
    });

    // --- Трансформация: шаг 4 — обнаружение AGLOOM.local.md в подпапках ---
    it('обнаруживает AGLOOM.local.md в подпапках с типом "directory-local"', () => {
      const subDir = path.join(tmpDir, "src", "feature");
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(
        path.join(subDir, "AGLOOM.local.md"),
        "feature local content",
      );

      const transpiler = createInstructionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const files = transpiler.discover();

      expect(files).toHaveLength(1);
      const dirLocal = files[0];
      expect(dirLocal.type).toBe("directory-local");
      expect(dirLocal.relativePath).toBe(
        path.join("src", "feature", "AGLOOM.local.md"),
      );
      expect(dirLocal.content).toBe("feature local content");
    });

    // --- Трансформация: шаг 6 — исключение node_modules ---
    it("исключает каталог node_modules при поиске канонических файлов", () => {
      fs.writeFileSync(path.join(tmpDir, "AGLOOM.md"), "root");
      const nmDir = path.join(tmpDir, "node_modules", "pkg");
      fs.mkdirSync(nmDir, { recursive: true });
      fs.writeFileSync(path.join(nmDir, "AGLOOM.md"), "should be ignored");
      fs.writeFileSync(
        path.join(nmDir, "AGLOOM.local.md"),
        "should be ignored",
      );

      const transpiler = createInstructionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const files = transpiler.discover();

      expect(files).toHaveLength(1);
      expect(files[0].type).toBe("root");
    });

    // --- Трансформация: шаг 7 — исключение скрытых каталогов ---
    it("исключает скрытые каталоги (начинающиеся с точки) при поиске", () => {
      fs.writeFileSync(path.join(tmpDir, "AGLOOM.md"), "root");
      const hiddenDir = path.join(tmpDir, ".hidden", "sub");
      fs.mkdirSync(hiddenDir, { recursive: true });
      fs.writeFileSync(path.join(hiddenDir, "AGLOOM.md"), "should be ignored");
      fs.writeFileSync(
        path.join(hiddenDir, "AGLOOM.local.md"),
        "should be ignored",
      );

      const transpiler = createInstructionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const files = transpiler.discover();

      expect(files).toHaveLength(1);
      expect(files[0].type).toBe("root");
    });

    // --- Трансформация: шаг 5 — исключение каталогов из .gitignore ---
    it("исключает каталоги, перечисленные в .gitignore", () => {
      fs.writeFileSync(path.join(tmpDir, "AGLOOM.md"), "root");
      fs.writeFileSync(path.join(tmpDir, ".gitignore"), "dist\nbuild\n");
      const distDir = path.join(tmpDir, "dist");
      fs.mkdirSync(distDir, { recursive: true });
      fs.writeFileSync(path.join(distDir, "AGLOOM.md"), "should be ignored");
      fs.writeFileSync(
        path.join(distDir, "AGLOOM.local.md"),
        "should be ignored",
      );

      const transpiler = createInstructionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const files = transpiler.discover();

      expect(files).toHaveLength(1);
      expect(files[0].type).toBe("root");
    });

    // --- Расширение 5a: .gitignore отсутствует → пропуск фильтрации ---
    it("пропускает фильтрацию по .gitignore, если файл .gitignore отсутствует", () => {
      fs.writeFileSync(path.join(tmpDir, "AGLOOM.md"), "root");
      const subDir = path.join(tmpDir, "dist");
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(path.join(subDir, "AGLOOM.md"), "dist content");
      // .gitignore НЕ создаётся

      const transpiler = createInstructionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const files = transpiler.discover();

      // dist/AGLOOM.md НЕ исключается, т.к. .gitignore отсутствует
      expect(files).toHaveLength(2);
    });

    // --- Расширение 3a/4a: ошибка доступа при рекурсивном сканировании ---
    it("выбрасывает DiscoverError при ошибке доступа к каталогу", () => {
      fs.writeFileSync(path.join(tmpDir, "AGLOOM.md"), "root");
      const restrictedDir = path.join(tmpDir, "restricted");
      fs.mkdirSync(restrictedDir);
      fs.chmodSync(restrictedDir, 0o000);

      const transpiler = createInstructionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      try {
        expect(() => transpiler.discover()).toThrow(DiscoverError);
        expect(() => transpiler.discover()).toThrow(/Failed to scan directory/);
      } finally {
        // Восстанавливаем права для очистки в afterEach
        fs.chmodSync(restrictedDir, 0o755);
      }
    });

    // --- Расширение 8a: ошибка чтения файла ---
    it("выбрасывает DiscoverError при ошибке чтения обнаруженного файла", () => {
      const agentsPath = path.join(tmpDir, "AGLOOM.md");
      fs.writeFileSync(agentsPath, "content");
      fs.chmodSync(agentsPath, 0o000);

      const transpiler = createInstructionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      try {
        expect(() => transpiler.discover()).toThrow(DiscoverError);
        expect(() => transpiler.discover()).toThrow(/Failed to read/);
      } finally {
        fs.chmodSync(agentsPath, 0o644);
      }
    });

    // --- Пустой результат: ни одного канонического файла не обнаружено ---
    it("возвращает пустой массив, если канонических файлов не обнаружено", () => {
      // tmpDir пуст — нет AGLOOM.md нигде

      const transpiler = createInstructionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const files = transpiler.discover();

      expect(files).toEqual([]);
    });
  });
});
