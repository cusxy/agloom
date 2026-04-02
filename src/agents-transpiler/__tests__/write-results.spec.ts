// write-results.spec.ts
// Спецификация: docs/specs/agents-transpiler.md § Запись результатов

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createAgentsTranspiler } from "../index.js";
import { AgentWriteError } from "../errors.js";

function createStubAdapter(agentId: string) {
  return {
    agentId,
    targetDir: `.${agentId}/agents`,
    transpile: () => [],
  };
}

describe("AgentsTranspiler", () => {
  describe("Запись результатов", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-agents-write-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Happy path: шаги 1–3 — запись файлов и возврат AgentWriteResult ---
    it("записывает файлы в файловую систему и возвращает пути записанных файлов", () => {
      const transpiler = createAgentsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "claude",
          files: [
            {
              relativePath: ".claude/agents/code-reviewer.md",
              content: "Generated content.",
            },
          ],
          errors: [],
        },
      ]);

      expect(writeResult.written).toContain(".claude/agents/code-reviewer.md");
      expect(writeResult.errors).toHaveLength(0);

      // Проверяем, что файл действительно записан
      const writtenContent = fs.readFileSync(
        path.join(tmpDir, ".claude", "agents", "code-reviewer.md"),
        "utf-8",
      );
      expect(writtenContent).toBe("Generated content.");
    });

    // --- Трансформация: шаг 2 — создание промежуточных каталогов ---
    it("создаёт промежуточные каталоги при записи файла", () => {
      const transpiler = createAgentsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("opencode")],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "opencode",
          files: [
            {
              relativePath: ".opencode/agents/deep-agent.md",
              content: "Deep content.",
            },
          ],
          errors: [],
        },
      ]);

      expect(writeResult.written).toContain(".opencode/agents/deep-agent.md");

      const writtenContent = fs.readFileSync(
        path.join(tmpDir, ".opencode", "agents", "deep-agent.md"),
        "utf-8",
      );
      expect(writtenContent).toBe("Deep content.");
    });

    // --- Расширение 1a: AgentTranspileResult содержит ошибки → пропуск записи ---
    it("пропускает запись файлов адаптера при наличии ошибок в AgentTranspileResult", () => {
      const transpiler = createAgentsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("failing")],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "failing",
          files: [
            {
              relativePath: ".failing/agents/agent.md",
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
      expect(
        fs.existsSync(path.join(tmpDir, ".failing", "agents", "agent.md")),
      ).toBe(false);

      // Ошибки включены в AgentWriteResult.errors
      expect(writeResult.errors.length).toBeGreaterThan(0);
      expect(writeResult.errors[0]).toBeInstanceOf(AgentWriteError);
      expect(writeResult.errors[0].message).toBe("Adapter failed");
      expect(writeResult.written).not.toContain(".failing/agents/agent.md");
    });

    // --- Расширение 1a: смешанный сценарий — один адаптер с ошибками, другой без ---
    it("пропускает файлы адаптера с ошибками, но записывает файлы успешного адаптера", () => {
      const transpiler = createAgentsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("failing"), createStubAdapter("claude")],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "failing",
          files: [
            {
              relativePath: ".failing/agents/agent.md",
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
              relativePath: ".claude/agents/agent.md",
              content: "Should be written.",
            },
          ],
          errors: [],
        },
      ]);

      // Файл failing адаптера НЕ записан
      expect(
        fs.existsSync(path.join(tmpDir, ".failing", "agents", "agent.md")),
      ).toBe(false);
      expect(writeResult.written).not.toContain(".failing/agents/agent.md");

      // Файл claude адаптера записан
      expect(
        fs.existsSync(path.join(tmpDir, ".claude", "agents", "agent.md")),
      ).toBe(true);
      expect(writeResult.written).toContain(".claude/agents/agent.md");
      const writtenContent = fs.readFileSync(
        path.join(tmpDir, ".claude", "agents", "agent.md"),
        "utf-8",
      );
      expect(writtenContent).toBe("Should be written.");

      // Ошибки failing адаптера включены в результат
      expect(writeResult.errors.length).toBeGreaterThan(0);
    });

    // --- Расширение 2a: ошибка записи файла → AgentWriteError ---
    it("возвращает AgentWriteError при ошибке записи файла", () => {
      // Создаём файл вместо каталога — запись в подпапку невозможна
      fs.writeFileSync(path.join(tmpDir, "blocker"), "not a directory");

      const transpiler = createAgentsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "claude",
          files: [
            {
              relativePath: "blocker/agents/agent.md",
              content: "Cannot write here.",
            },
          ],
          errors: [],
        },
      ]);

      expect(writeResult.errors.length).toBeGreaterThan(0);
      expect(writeResult.errors[0]).toBeInstanceOf(AgentWriteError);
      expect(writeResult.errors[0].message).toMatch(
        /Failed to write blocker\/agents\/agent\.md/,
      );
    });

    // --- Happy path: запись результатов нескольких адаптеров ---
    it("записывает файлы от нескольких адаптеров", () => {
      const transpiler = createAgentsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude"), createStubAdapter("opencode")],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "claude",
          files: [
            {
              relativePath: ".claude/agents/agent.md",
              content: "Claude content.",
            },
          ],
          errors: [],
        },
        {
          agentId: "opencode",
          files: [
            {
              relativePath: ".opencode/agents/agent.md",
              content: "OpenCode content.",
            },
          ],
          errors: [],
        },
      ]);

      expect(writeResult.written).toContain(".claude/agents/agent.md");
      expect(writeResult.written).toContain(".opencode/agents/agent.md");
      expect(writeResult.errors).toHaveLength(0);
    });

    // --- Кодировка: UTF-8 ---
    it("записывает файлы в кодировке UTF-8", () => {
      const transpiler = createAgentsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const unicodeContent = "Инструкции для агента. 日本語テスト. Émojis: 🚀";

      transpiler.writeResults([
        {
          agentId: "claude",
          files: [
            {
              relativePath: ".claude/agents/agent.md",
              content: unicodeContent,
            },
          ],
          errors: [],
        },
      ]);

      const writtenContent = fs.readFileSync(
        path.join(tmpDir, ".claude", "agents", "agent.md"),
        "utf-8",
      );
      expect(writtenContent).toBe(unicodeContent);
    });
  });
});
