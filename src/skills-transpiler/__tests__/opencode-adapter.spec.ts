// opencode-adapter.spec.ts
// Спецификация: docs/specs/skills-transpiler.md § OpenCode адаптер

import { describe, it, expect } from "vitest";
import { OpenCodeSkillAdapter } from "../adapters/opencode-adapter.js";

describe("OpenCodeSkillAdapter", () => {
  // --- Спецификация: § OpenCode адаптер ---
  // agentId: "opencode", targetDir: ".opencode/skills"
  // Адаптер не содержит метода transpile (маппинг путей выполняется транспилером)

  it('имеет agentId равный "opencode"', () => {
    const adapter = new OpenCodeSkillAdapter();
    expect(adapter.agentId).toBe("opencode");
  });

  it('имеет targetDir равный ".opencode/skills"', () => {
    const adapter = new OpenCodeSkillAdapter();
    expect(adapter.targetDir).toBe(".opencode/skills");
  });

  it("не содержит метода transpile", () => {
    const adapter = new OpenCodeSkillAdapter();
    expect(typeof (adapter as any).transpile).not.toBe("function");
  });
});
