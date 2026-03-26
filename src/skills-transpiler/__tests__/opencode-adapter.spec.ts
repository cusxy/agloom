// opencode-adapter.spec.ts
// Спецификация: docs/specs/skills-transpiler.md § OpenCode адаптер

import { describe, it, expect } from "vitest";
import { OpenCodeSkillAdapter } from "../adapters/opencode-adapter.js";
import type { SkillPackage } from "../types.js";

function makeSkillPackage(name: string, files: string[]): SkillPackage {
  return {
    name,
    directoryPath: `.agents/skills/${name}`,
    files,
  };
}

describe("OpenCodeSkillAdapter", () => {
  describe("transpile", () => {
    // --- Happy path: шаг 1 — вернуть пустой массив ---
    it("возвращает пустой массив при наличии skill-пакетов", () => {
      const adapter = new OpenCodeSkillAdapter();

      const result = adapter.transpile([
        makeSkillPackage("my-skill", [
          ".agents/skills/my-skill/SKILL.md",
          ".agents/skills/my-skill/helpers/util.ts",
        ]),
        makeSkillPackage("another-skill", [
          ".agents/skills/another-skill/SKILL.md",
        ]),
      ]);

      expect(result).toEqual([]);
    });

    // --- Happy path: пустой входной массив ---
    it("возвращает пустой массив при пустом входном массиве пакетов", () => {
      const adapter = new OpenCodeSkillAdapter();

      const result = adapter.transpile([]);

      expect(result).toEqual([]);
    });

    // --- Свойство: agentId адаптера ---
    it('имеет agentId равный "opencode"', () => {
      const adapter = new OpenCodeSkillAdapter();
      expect(adapter.agentId).toBe("opencode");
    });
  });
});
