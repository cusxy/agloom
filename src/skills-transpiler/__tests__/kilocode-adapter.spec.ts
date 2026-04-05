// kilocode-adapter.spec.ts
// Спецификация: docs/specs/skills-transpiler.md § KiloCode адаптер

import { describe, it, expect } from "vitest";
import { KiloCodeSkillAdapter } from "../adapters/kilocode-adapter.js";

describe("KiloCodeSkillAdapter", () => {
  // --- Спецификация: § KiloCode адаптер ---
  // agentId: "kilocode", targetDir: ".kilo/skills"
  // Адаптер не содержит метода transpile (маппинг путей выполняется транспилером)

  it('имеет agentId равный "kilocode"', () => {
    const adapter = new KiloCodeSkillAdapter();
    expect(adapter.agentId).toBe("kilocode");
  });

  it('имеет targetDir равный ".kilo/skills"', () => {
    const adapter = new KiloCodeSkillAdapter();
    expect(adapter.targetDir).toBe(".kilo/skills");
  });

  it("не содержит метода transpile", () => {
    const adapter = new KiloCodeSkillAdapter();
    expect(typeof (adapter as any).transpile).not.toBe("function");
  });
});
