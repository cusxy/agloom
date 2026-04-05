// write-results.spec.ts
// Спецификация: docs/specs/commands-transpiler.md § Запись результатов

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createCommandsTranspiler } from "../index.js";
import { CommandWriteError } from "../errors.js";

function createStubAdapter(agentId: string) {
  return {
    agentId,
    targetDir: `.${agentId}/commands`,
    transpile: () => [],
  };
}

describe("CommandsTranspiler", () => {
  describe("Запись результатов", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-commands-write-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Happy path: шаги 1–4 — запись файлов и возврат CommandWriteResult ---
    it("записывает файлы в файловую систему и возвращает пути записанных файлов", () => {
      const transpiler = createCommandsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "claude",
          files: [
            {
              relativePath: ".claude/commands/deploy.md",
              content: "Generated content.",
            },
          ],
          errors: [],
        },
      ]);

      expect(writeResult.written).toContain(".claude/commands/deploy.md");
      expect(writeResult.errors).toHaveLength(0);

      const writtenContent = fs.readFileSync(path.join(tmpDir, ".claude", "commands", "deploy.md"), "utf-8");
      expect(writtenContent).toBe("Generated content.");
    });

    // --- Трансформация: шаг 3 — создание промежуточных каталогов ---
    it("создаёт промежуточные каталоги при записи файла", () => {
      const transpiler = createCommandsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "claude",
          files: [
            {
              relativePath: ".claude/commands/git/commit.md",
              content: "Commit content.",
            },
          ],
          errors: [],
        },
      ]);

      expect(writeResult.written).toContain(".claude/commands/git/commit.md");

      const writtenContent = fs.readFileSync(path.join(tmpDir, ".claude", "commands", "git", "commit.md"), "utf-8");
      expect(writtenContent).toBe("Commit content.");
    });

    // --- Расширение 1a: CommandTranspileResult содержит ошибки → пропуск записи ---
    it("пропускает запись файлов адаптера при наличии ошибок в CommandTranspileResult", () => {
      const transpiler = createCommandsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("failing")],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "failing",
          files: [
            {
              relativePath: ".failing/commands/cmd.md",
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

      expect(fs.existsSync(path.join(tmpDir, ".failing", "commands", "cmd.md"))).toBe(false);
      expect(writeResult.errors.length).toBeGreaterThan(0);
      expect(writeResult.errors[0]).toBeInstanceOf(CommandWriteError);
      expect(writeResult.errors[0].message).toBe("Adapter failed");
      expect(writeResult.written).not.toContain(".failing/commands/cmd.md");
    });

    // --- Расширение 1a: смешанный сценарий ---
    it("пропускает файлы адаптера с ошибками, но записывает файлы успешного адаптера", () => {
      const transpiler = createCommandsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("failing"), createStubAdapter("claude")],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "failing",
          files: [
            {
              relativePath: ".failing/commands/cmd.md",
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
              relativePath: ".claude/commands/cmd.md",
              content: "Should be written.",
            },
          ],
          errors: [],
        },
      ]);

      expect(fs.existsSync(path.join(tmpDir, ".failing", "commands", "cmd.md"))).toBe(false);
      expect(writeResult.written).not.toContain(".failing/commands/cmd.md");

      expect(fs.existsSync(path.join(tmpDir, ".claude", "commands", "cmd.md"))).toBe(true);
      expect(writeResult.written).toContain(".claude/commands/cmd.md");

      expect(writeResult.errors.length).toBeGreaterThan(0);
    });

    // --- Расширение 3a: ошибка записи файла → CommandWriteError ---
    it("возвращает CommandWriteError при ошибке записи файла", () => {
      fs.writeFileSync(path.join(tmpDir, "blocker"), "not a directory");

      const transpiler = createCommandsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "claude",
          files: [
            {
              relativePath: "blocker/commands/cmd.md",
              content: "Cannot write here.",
            },
          ],
          errors: [],
        },
      ]);

      expect(writeResult.errors.length).toBeGreaterThan(0);
      expect(writeResult.errors[0]).toBeInstanceOf(CommandWriteError);
      expect(writeResult.errors[0].message).toMatch(/Failed to write blocker\/commands\/cmd\.md/);
    });

    // --- Happy path: запись результатов нескольких адаптеров ---
    it("записывает файлы от нескольких адаптеров", () => {
      const transpiler = createCommandsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude"), createStubAdapter("opencode")],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "claude",
          files: [
            {
              relativePath: ".claude/commands/cmd.md",
              content: "Claude content.",
            },
          ],
          errors: [],
        },
        {
          agentId: "opencode",
          files: [
            {
              relativePath: ".opencode/commands/cmd.md",
              content: "OpenCode content.",
            },
          ],
          errors: [],
        },
      ]);

      expect(writeResult.written).toContain(".claude/commands/cmd.md");
      expect(writeResult.written).toContain(".opencode/commands/cmd.md");
      expect(writeResult.errors).toHaveLength(0);
    });

    // --- Кодировка: UTF-8 ---
    it("записывает файлы в кодировке UTF-8", () => {
      const transpiler = createCommandsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const unicodeContent = "Описание команды. 日本語テスト.";

      transpiler.writeResults([
        {
          agentId: "claude",
          files: [
            {
              relativePath: ".claude/commands/cmd.md",
              content: unicodeContent,
            },
          ],
          errors: [],
        },
      ]);

      const writtenContent = fs.readFileSync(path.join(tmpDir, ".claude", "commands", "cmd.md"), "utf-8");
      expect(writtenContent).toBe(unicodeContent);
    });
  });
});
