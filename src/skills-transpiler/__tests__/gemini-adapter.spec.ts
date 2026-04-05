// gemini-adapter.spec.ts
// Спецификация: docs/specs/skills-transpiler.md § Gemini адаптер

import { describe, it, expect } from "vitest";
import { GeminiSkillAdapter } from "../adapters/gemini-adapter.js";

describe("GeminiSkillAdapter", () => {
  // --- Спецификация: § Gemini адаптер ---
  // agentId: "gemini", targetDir: ".gemini/skills"
  // Адаптер не содержит метода transpile (маппинг путей выполняется транспилером)

  it('имеет agentId равный "gemini"', () => {
    const adapter = new GeminiSkillAdapter();
    expect(adapter.agentId).toBe("gemini");
  });

  it('имеет targetDir равный ".gemini/skills"', () => {
    const adapter = new GeminiSkillAdapter();
    expect(adapter.targetDir).toBe(".gemini/skills");
  });

  it("не содержит метода transpile", () => {
    const adapter = new GeminiSkillAdapter();
    expect(typeof (adapter as any).transpile).not.toBe("function");
  });
});
