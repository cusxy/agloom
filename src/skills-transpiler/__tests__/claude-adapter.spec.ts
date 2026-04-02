// claude-adapter.spec.ts
// Спецификация: docs/specs/skills-transpiler.md § Claude Code адаптер

import { describe, it, expect } from "vitest";
import { ClaudeSkillAdapter } from "../adapters/claude-adapter.js";

describe("ClaudeSkillAdapter", () => {
  // --- Спецификация: § Claude Code адаптер ---
  // agentId: "claude", targetDir: ".claude/skills"
  // Адаптер не содержит метода transpile (маппинг путей выполняется транспилером)

  it('имеет agentId равный "claude"', () => {
    const adapter = new ClaudeSkillAdapter();
    expect(adapter.agentId).toBe("claude");
  });

  it('имеет targetDir равный ".claude/skills"', () => {
    const adapter = new ClaudeSkillAdapter();
    expect(adapter.targetDir).toBe(".claude/skills");
  });

  it("не содержит метода transpile", () => {
    const adapter = new ClaudeSkillAdapter();
    expect(typeof (adapter as any).transpile).not.toBe("function");
  });
});
