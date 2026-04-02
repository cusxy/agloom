// adapter-interface.spec.ts
// Спецификация: docs/specs/skills-transpiler.md § Интерфейс адаптера
// Спецификация: docs/specs/skills-transpiler.md § Claude Code адаптер
// Спецификация: docs/specs/skills-transpiler.md § OpenCode адаптер

import { describe, it, expect } from "vitest";
import { ClaudeSkillAdapter } from "../adapters/claude-adapter.js";
import { OpenCodeSkillAdapter } from "../adapters/opencode-adapter.js";

describe("SkillAdapter", () => {
  describe("Интерфейс адаптера", () => {
    // --- Спецификация: § Интерфейс адаптера ---
    // "Адаптер не содержит метода transpile"
    // "Маппинг путей выполняется транспилером на основе targetDir"

    it("ClaudeSkillAdapter имеет свойство targetDir равное .claude/skills", () => {
      const adapter = new ClaudeSkillAdapter();
      expect(adapter.targetDir).toBe(".claude/skills");
    });

    it("ClaudeSkillAdapter не содержит метода transpile", () => {
      const adapter = new ClaudeSkillAdapter();
      expect(adapter).not.toHaveProperty("transpile");
    });

    it("OpenCodeSkillAdapter имеет свойство targetDir равное .opencode/skills", () => {
      const adapter = new OpenCodeSkillAdapter();
      expect(adapter.targetDir).toBe(".opencode/skills");
    });

    it("OpenCodeSkillAdapter не содержит метода transpile", () => {
      const adapter = new OpenCodeSkillAdapter();
      expect(adapter).not.toHaveProperty("transpile");
    });
  });

  describe("Claude Code адаптер", () => {
    // --- Спецификация: § Claude Code адаптер ---
    // agentId: "claude", targetDir: ".claude/skills"

    it('имеет agentId равный "claude"', () => {
      const adapter = new ClaudeSkillAdapter();
      expect(adapter.agentId).toBe("claude");
    });

    it('имеет targetDir равный ".claude/skills"', () => {
      const adapter = new ClaudeSkillAdapter();
      expect(adapter.targetDir).toBe(".claude/skills");
    });
  });

  describe("OpenCode адаптер", () => {
    // --- Спецификация: § OpenCode адаптер ---
    // agentId: "opencode", targetDir: ".opencode/skills"

    it('имеет agentId равный "opencode"', () => {
      const adapter = new OpenCodeSkillAdapter();
      expect(adapter.agentId).toBe("opencode");
    });

    it('имеет targetDir равный ".opencode/skills"', () => {
      const adapter = new OpenCodeSkillAdapter();
      expect(adapter.targetDir).toBe(".opencode/skills");
    });
  });
});
