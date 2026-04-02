// write-results-options.spec.ts
// Спецификация: docs/specs/agents-transpiler.md § Запись результатов
//
// Тесты на options object: { targetRoot? }
// и расширение 1a: per-error AgentWriteError

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createAgentsTranspiler } from "../index.js";
import { AgentWriteError } from "../errors.js";

/**
 * Стаб-адаптер с targetDir (новый интерфейс).
 */
function createAdapterWithTargetDir(agentId: string, targetDir: string) {
  return {
    agentId,
    targetDir,
    transpile: () => [],
  };
}

describe("AgentsTranspiler", () => {
  describe("Запись результатов — options object", () => {
    let tmpDir: string;
    let targetDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-agents-write-opts-"));
      targetDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "agl-agents-write-target-"),
      );
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(targetDir, { recursive: true, force: true });
    });

    // --- Спецификация: § Запись результатов, шаг 2 ---
    // "Определить effectiveRoot как options.targetRoot (если передан)
    //  или projectRoot из конфигурации транспилера"
    it("записывает файлы в options.targetRoot, если передан", () => {
      const transpiler = createAgentsTranspiler({
        projectRoot: tmpDir,
        adapters: [createAdapterWithTargetDir("claude", ".claude/agents")],
      });

      const writeResult = transpiler.writeResults(
        [
          {
            agentId: "claude",
            files: [
              {
                relativePath: ".claude/agents/my-agent.md",
                content: "# Agent content",
              },
            ],
            errors: [],
          },
        ],
        { targetRoot: targetDir },
      );

      // Assert: файл записан в targetDir, не в tmpDir
      expect(writeResult.written).toContain(".claude/agents/my-agent.md");
      expect(writeResult.errors).toHaveLength(0);

      expect(
        fs.existsSync(path.join(targetDir, ".claude", "agents", "my-agent.md")),
      ).toBe(true);
      expect(
        fs.existsSync(path.join(tmpDir, ".claude", "agents", "my-agent.md")),
      ).toBe(false);
    });

    // --- Спецификация: § Запись результатов, шаг 2 ---
    // effectiveRoot = projectRoot, если options.targetRoot не передан
    it("записывает файлы в projectRoot, если options.targetRoot не передан", () => {
      const transpiler = createAgentsTranspiler({
        projectRoot: tmpDir,
        adapters: [createAdapterWithTargetDir("claude", ".claude/agents")],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "claude",
          files: [
            {
              relativePath: ".claude/agents/my-agent.md",
              content: "# Agent",
            },
          ],
          errors: [],
        },
      ]);

      expect(writeResult.written).toContain(".claude/agents/my-agent.md");
      expect(writeResult.errors).toHaveLength(0);

      expect(
        fs.existsSync(path.join(tmpDir, ".claude", "agents", "my-agent.md")),
      ).toBe(true);
    });

    // --- Спецификация: § Запись результатов, расширение 1a ---
    // "для каждого элемента массива errors создать AgentWriteError"
    it("создаёт отдельный AgentWriteError для каждого элемента errors в AgentTranspileResult", () => {
      const transpiler = createAgentsTranspiler({
        projectRoot: tmpDir,
        adapters: [createAdapterWithTargetDir("claude", ".claude/agents")],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "claude",
          files: [
            {
              relativePath: ".claude/agents/my-agent.md",
              content: "# Agent",
            },
          ],
          errors: [
            {
              agentId: "claude",
              message: "Error one",
              cause: new Error("cause one"),
            },
            {
              agentId: "claude",
              message: "Error two",
              cause: new Error("cause two"),
            },
            {
              agentId: "claude",
              message: "Error three",
              cause: new Error("cause three"),
            },
          ],
        },
      ]);

      // Должно быть 3 AgentWriteError — по одному на каждый элемент errors
      expect(writeResult.errors).toHaveLength(3);
      expect(writeResult.errors[0]).toBeInstanceOf(AgentWriteError);
      expect(writeResult.errors[0].message).toBe("Error one");
      expect(writeResult.errors[1]).toBeInstanceOf(AgentWriteError);
      expect(writeResult.errors[1].message).toBe("Error two");
      expect(writeResult.errors[2]).toBeInstanceOf(AgentWriteError);
      expect(writeResult.errors[2].message).toBe("Error three");
    });

    // --- Спецификация: § Запись результатов, расширение 1a ---
    // Файлы адаптера с ошибками НЕ записываются
    it("пропускает запись файлов адаптера с ошибками и не записывает ни один файл", () => {
      const transpiler = createAgentsTranspiler({
        projectRoot: tmpDir,
        adapters: [createAdapterWithTargetDir("claude", ".claude/agents")],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "claude",
          files: [
            {
              relativePath: ".claude/agents/my-agent.md",
              content: "# Agent",
            },
          ],
          errors: [
            {
              agentId: "claude",
              message: "Error",
              cause: new Error("cause"),
            },
          ],
        },
      ]);

      // Файл НЕ записан
      expect(
        fs.existsSync(path.join(tmpDir, ".claude", "agents", "my-agent.md")),
      ).toBe(false);
      expect(writeResult.written).not.toContain(".claude/agents/my-agent.md");
    });
  });
});
