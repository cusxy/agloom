// codex-adapter.spec.ts
// Спецификация: docs/specs/skills-transpiler.md § Codex адаптер

import { describe, it, expect } from "vitest";
import { CodexSkillAdapter } from "../adapters/codex-adapter.js";

describe("CodexSkillAdapter", () => {
  // --- Спецификация: § Codex адаптер ---
  // agentId: "codex", targetDir: ".agents/skills"
  // Codex использует каталог .agents/skills/ (НЕ .codex/skills/)
  // Адаптер не содержит метода transpile (маппинг путей выполняется транспилером)

  it('имеет agentId равный "codex"', () => {
    const adapter = new CodexSkillAdapter();
    expect(adapter.agentId).toBe("codex");
  });

  it('имеет targetDir равный ".agents/skills"', () => {
    const adapter = new CodexSkillAdapter();
    expect(adapter.targetDir).toBe(".agents/skills");
  });

  it("не содержит метода transpile", () => {
    const adapter = new CodexSkillAdapter();
    expect(typeof (adapter as any).transpile).not.toBe("function");
  });
});
