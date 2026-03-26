// write-results.spec.ts
// Спецификация: docs/specs/instructions-transpiler.md § Запись результатов

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createInstructionsTranspiler } from "../index.js";
import { WriteError } from "../errors.js";

function createStubAdapter(agentId: string) {
  return {
    agentId,
    transpile: () => [],
  };
}

describe("InstructionsTranspiler", () => {
  describe("Запись результатов", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-write-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Happy path: шаги 1–3 — запись файлов и возврат путей ---
    it("записывает файлы в файловую систему и возвращает пути записанных файлов", () => {
      const transpiler = createInstructionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "claude",
          files: [{ relativePath: "CLAUDE.md", content: "Generated content." }],
          errors: [],
        },
      ]);

      expect(writeResult.written).toContain("CLAUDE.md");
      expect(writeResult.errors).toHaveLength(0);

      // Проверяем, что файл действительно записан
      const writtenContent = fs.readFileSync(
        path.join(tmpDir, "CLAUDE.md"),
        "utf-8",
      );
      expect(writtenContent).toBe("Generated content.");
    });

    // --- Трансформация: шаг 2 — создание промежуточных каталогов ---
    it("создаёт промежуточные каталоги при записи файла в подпапку", () => {
      const transpiler = createInstructionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "claude",
          files: [
            {
              relativePath: "src/deep/nested/CLAUDE.md",
              content: "Nested content.",
            },
          ],
          errors: [],
        },
      ]);

      expect(writeResult.written).toContain("src/deep/nested/CLAUDE.md");

      const writtenContent = fs.readFileSync(
        path.join(tmpDir, "src", "deep", "nested", "CLAUDE.md"),
        "utf-8",
      );
      expect(writtenContent).toBe("Nested content.");
    });

    // --- Расширение 1a: TranspileResult содержит ошибки → пропуск записи ---
    it("пропускает запись файлов адаптера при наличии ошибок в TranspileResult", () => {
      const transpiler = createInstructionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("failing")],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "failing",
          files: [
            {
              relativePath: "FAILING.md",
              content: "Should not be written.",
            },
          ],
          errors: [
            {
              agentId: "failing",
              message: "Adapter failed",
              cause: new Error("original"),
            },
          ],
        },
      ]);

      // Файл НЕ должен быть записан
      expect(fs.existsSync(path.join(tmpDir, "FAILING.md"))).toBe(false);

      // Ошибки включены в WriteResult.errors
      expect(writeResult.errors.length).toBeGreaterThan(0);
      expect(writeResult.written).not.toContain("FAILING.md");
    });

    // --- Расширение 1a: смешанный сценарий — один адаптер с ошибками, другой без ---
    it("пропускает файлы адаптера с ошибками, но записывает файлы успешного адаптера", () => {
      const transpiler = createInstructionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("failing"), createStubAdapter("claude")],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "failing",
          files: [
            {
              relativePath: "FAILING.md",
              content: "Should not be written.",
            },
          ],
          errors: [
            {
              agentId: "failing",
              message: "Adapter failed",
              cause: new Error("original"),
            },
          ],
        },
        {
          agentId: "claude",
          files: [
            {
              relativePath: "CLAUDE.md",
              content: "Should be written.",
            },
          ],
          errors: [],
        },
      ]);

      // Файл failing адаптера НЕ записан
      expect(fs.existsSync(path.join(tmpDir, "FAILING.md"))).toBe(false);
      expect(writeResult.written).not.toContain("FAILING.md");

      // Файл claude адаптера записан
      expect(fs.existsSync(path.join(tmpDir, "CLAUDE.md"))).toBe(true);
      expect(writeResult.written).toContain("CLAUDE.md");
      const writtenContent = fs.readFileSync(
        path.join(tmpDir, "CLAUDE.md"),
        "utf-8",
      );
      expect(writtenContent).toBe("Should be written.");

      // Ошибки failing адаптера включены в результат
      expect(writeResult.errors.length).toBeGreaterThan(0);
    });

    // --- Расширение 2a: ошибка записи файла → WriteError ---
    it("возвращает WriteError при ошибке записи файла", () => {
      // Создаём файл вместо каталога — запись в подпапку невозможна
      fs.writeFileSync(path.join(tmpDir, "blocker"), "not a directory");

      const transpiler = createInstructionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "claude",
          files: [
            {
              relativePath: "blocker/CLAUDE.md",
              content: "Cannot write here.",
            },
          ],
          errors: [],
        },
      ]);

      expect(writeResult.errors.length).toBeGreaterThan(0);
      expect(writeResult.errors[0]).toBeInstanceOf(WriteError);
      expect(writeResult.errors[0].message).toMatch(
        /Failed to write blocker\/CLAUDE\.md/,
      );
    });

    // --- Happy path: запись результатов нескольких адаптеров ---
    it("записывает файлы от нескольких адаптеров", () => {
      const transpiler = createInstructionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude"), createStubAdapter("opencode")],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "claude",
          files: [{ relativePath: "CLAUDE.md", content: "Claude content." }],
          errors: [],
        },
        {
          agentId: "opencode",
          files: [{ relativePath: "AGENTS.md", content: "OpenCode content." }],
          errors: [],
        },
      ]);

      expect(writeResult.written).toContain("CLAUDE.md");
      expect(writeResult.written).toContain("AGENTS.md");
      expect(writeResult.errors).toHaveLength(0);
    });

    // --- Кодировка: UTF-8 ---
    it("записывает файлы в кодировке UTF-8", () => {
      const transpiler = createInstructionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const unicodeContent = "Инструкции для агента. 日本語テスト. Émojis: 🚀";

      transpiler.writeResults([
        {
          agentId: "claude",
          files: [{ relativePath: "CLAUDE.md", content: unicodeContent }],
          errors: [],
        },
      ]);

      const writtenContent = fs.readFileSync(
        path.join(tmpDir, "CLAUDE.md"),
        "utf-8",
      );
      expect(writtenContent).toBe(unicodeContent);
    });
  });
});
