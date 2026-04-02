// adapter-interface.spec.ts
// Спецификация: docs/specs/agents-transpiler.md § Интерфейс адаптера
// Спецификация: docs/specs/agents-transpiler.md § Claude Code адаптер
// Спецификация: docs/specs/agents-transpiler.md § OpenCode адаптер

import { describe, it, expect } from "vitest";
import { ClaudeAgentAdapter } from "../adapters/claude-adapter.js";
import { OpenCodeAgentAdapter } from "../adapters/opencode-adapter.js";

describe("AgentAdapter", () => {
  describe("Интерфейс адаптера", () => {
    // --- Спецификация: § Интерфейс адаптера ---
    // "targetDir (string, readonly) — путь к целевому каталогу
    //  относительно projectRoot"
    // "transpile(definitions) — метод транспиляции"
    // "Маппинг relativePath из результата transpile выполняется
    //  транспилером на основе targetDir"

    it("ClaudeAgentAdapter имеет свойство targetDir равное .claude/agents", () => {
      const adapter = new ClaudeAgentAdapter();
      expect(adapter.targetDir).toBe(".claude/agents");
    });

    it("ClaudeAgentAdapter сохраняет метод transpile", () => {
      const adapter = new ClaudeAgentAdapter();
      expect(typeof adapter.transpile).toBe("function");
    });

    it("OpenCodeAgentAdapter имеет свойство targetDir равное .opencode/agents", () => {
      const adapter = new OpenCodeAgentAdapter();
      expect(adapter.targetDir).toBe(".opencode/agents");
    });

    it("OpenCodeAgentAdapter сохраняет метод transpile", () => {
      const adapter = new OpenCodeAgentAdapter();
      expect(typeof adapter.transpile).toBe("function");
    });
  });

  describe("Claude Code адаптер", () => {
    // --- Спецификация: § Claude Code адаптер ---
    // agentId: "claude", targetDir: ".claude/agents"

    it('имеет agentId равный "claude"', () => {
      const adapter = new ClaudeAgentAdapter();
      expect(adapter.agentId).toBe("claude");
    });

    it('имеет targetDir равный ".claude/agents"', () => {
      const adapter = new ClaudeAgentAdapter();
      expect(adapter.targetDir).toBe(".claude/agents");
    });
  });

  describe("OpenCode адаптер", () => {
    // --- Спецификация: § OpenCode адаптер ---
    // agentId: "opencode", targetDir: ".opencode/agents"

    it('имеет agentId равный "opencode"', () => {
      const adapter = new OpenCodeAgentAdapter();
      expect(adapter.agentId).toBe("opencode");
    });

    it('имеет targetDir равный ".opencode/agents"', () => {
      const adapter = new OpenCodeAgentAdapter();
      expect(adapter.targetDir).toBe(".opencode/agents");
    });
  });
});
