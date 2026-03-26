// opencode-adapter.spec.ts
// Спецификация: docs/specs/skills-transpiler.md § OpenCode адаптер

import { describe, it, expect } from "vitest";
import { OpenCodeSkillAdapter } from "../adapters/opencode-adapter.js";
import type { SkillPackage } from "../types.js";

function makeSkillPackage(name: string, files: string[]): SkillPackage {
  return {
    name,
    directoryPath: `.agloom/skills/${name}`,
    files,
  };
}

describe("OpenCodeSkillAdapter", () => {
  describe("transpile", () => {
    // --- Happy path: шаги 1–3 — замена префикса .agloom/skills/ на .opencode/skills/ ---
    it("заменяет префикс .agloom/skills/ на .opencode/skills/ в путях файлов", () => {
      const adapter = new OpenCodeSkillAdapter();

      const result = adapter.transpile([
        makeSkillPackage("my-skill", [
          ".agloom/skills/my-skill/SKILL.md",
          ".agloom/skills/my-skill/helpers/util.ts",
        ]),
      ]);

      expect(result).toHaveLength(2);

      const paths = result.map((f) => f.relativePath);
      expect(paths).toContain(".opencode/skills/my-skill/SKILL.md");
      expect(paths).toContain(".opencode/skills/my-skill/helpers/util.ts");
    });

    // --- Трансформация: шаг 3 — sourcePath равен исходному пути файла ---
    it("сохраняет исходный путь файла в sourcePath", () => {
      const adapter = new OpenCodeSkillAdapter();

      const result = adapter.transpile([
        makeSkillPackage("my-skill", [".agloom/skills/my-skill/SKILL.md"]),
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].sourcePath).toBe(".agloom/skills/my-skill/SKILL.md");
      expect(result[0].relativePath).toBe(".opencode/skills/my-skill/SKILL.md");
    });

    // --- Happy path: обработка нескольких пакетов одновременно ---
    it("обрабатывает несколько skill-пакетов в одном вызове", () => {
      const adapter = new OpenCodeSkillAdapter();

      const result = adapter.transpile([
        makeSkillPackage("skill-a", [".agloom/skills/skill-a/SKILL.md"]),
        makeSkillPackage("skill-b", [
          ".agloom/skills/skill-b/SKILL.md",
          ".agloom/skills/skill-b/config.json",
        ]),
      ]);

      expect(result).toHaveLength(3);

      const paths = result.map((f) => f.relativePath);
      expect(paths).toContain(".opencode/skills/skill-a/SKILL.md");
      expect(paths).toContain(".opencode/skills/skill-b/SKILL.md");
      expect(paths).toContain(".opencode/skills/skill-b/config.json");
    });

    // --- Happy path: пустой входной массив ---
    it("возвращает пустой массив при пустом массиве пакетов", () => {
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
