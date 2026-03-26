// claude-adapter.spec.ts
// Спецификация: docs/specs/skills-transpiler.md § Claude Code адаптер

import { describe, it, expect } from "vitest";
import { ClaudeSkillAdapter } from "../adapters/claude-adapter.js";
import type { SkillPackage } from "../types.js";

function makeSkillPackage(name: string, files: string[]): SkillPackage {
  return {
    name,
    directoryPath: `.agents/skills/${name}`,
    files,
  };
}

describe("ClaudeSkillAdapter", () => {
  describe("transpile", () => {
    // --- Happy path: шаги 1–3 — замена префикса для одного пакета ---
    it("заменяет префикс .agents/skills/ на .claude/skills/ в путях файлов", () => {
      const adapter = new ClaudeSkillAdapter();

      const result = adapter.transpile([
        makeSkillPackage("my-skill", [
          ".agents/skills/my-skill/SKILL.md",
          ".agents/skills/my-skill/helpers/util.ts",
        ]),
      ]);

      expect(result).toHaveLength(2);

      const paths = result.map((f) => f.relativePath);
      expect(paths).toContain(".claude/skills/my-skill/SKILL.md");
      expect(paths).toContain(".claude/skills/my-skill/helpers/util.ts");
    });

    // --- Трансформация: шаг 3 — sourcePath равен исходному пути файла ---
    it("сохраняет исходный путь файла в sourcePath", () => {
      const adapter = new ClaudeSkillAdapter();

      const result = adapter.transpile([
        makeSkillPackage("my-skill", [".agents/skills/my-skill/SKILL.md"]),
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].sourcePath).toBe(".agents/skills/my-skill/SKILL.md");
      expect(result[0].relativePath).toBe(".claude/skills/my-skill/SKILL.md");
    });

    // --- Трансформация: шаг 2 — структура вложенных каталогов сохраняется ---
    it("сохраняет структуру вложенных каталогов при замене префикса", () => {
      const adapter = new ClaudeSkillAdapter();

      const result = adapter.transpile([
        makeSkillPackage("complex-skill", [
          ".agents/skills/complex-skill/SKILL.md",
          ".agents/skills/complex-skill/src/index.ts",
          ".agents/skills/complex-skill/src/helpers/format.ts",
          ".agents/skills/complex-skill/docs/README.md",
        ]),
      ]);

      expect(result).toHaveLength(4);

      const paths = result.map((f) => f.relativePath);
      expect(paths).toContain(".claude/skills/complex-skill/SKILL.md");
      expect(paths).toContain(".claude/skills/complex-skill/src/index.ts");
      expect(paths).toContain(
        ".claude/skills/complex-skill/src/helpers/format.ts",
      );
      expect(paths).toContain(".claude/skills/complex-skill/docs/README.md");
    });

    // --- Happy path: обработка нескольких пакетов одновременно ---
    it("обрабатывает несколько skill-пакетов в одном вызове", () => {
      const adapter = new ClaudeSkillAdapter();

      const result = adapter.transpile([
        makeSkillPackage("skill-a", [".agents/skills/skill-a/SKILL.md"]),
        makeSkillPackage("skill-b", [
          ".agents/skills/skill-b/SKILL.md",
          ".agents/skills/skill-b/config.json",
        ]),
      ]);

      expect(result).toHaveLength(3);

      const paths = result.map((f) => f.relativePath);
      expect(paths).toContain(".claude/skills/skill-a/SKILL.md");
      expect(paths).toContain(".claude/skills/skill-b/SKILL.md");
      expect(paths).toContain(".claude/skills/skill-b/config.json");
    });

    // --- Happy path: пустой входной массив ---
    it("возвращает пустой массив при пустом массиве пакетов", () => {
      const adapter = new ClaudeSkillAdapter();

      const result = adapter.transpile([]);

      expect(result).toEqual([]);
    });

    // --- Свойство: agentId адаптера ---
    it('имеет agentId равный "claude"', () => {
      const adapter = new ClaudeSkillAdapter();
      expect(adapter.agentId).toBe("claude");
    });
  });
});
