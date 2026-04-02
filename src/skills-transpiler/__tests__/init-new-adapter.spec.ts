// init-new-adapter.spec.ts
// Спецификация: docs/specs/skills-transpiler.md § Инициализация
// Тест: createSkillsTranspiler принимает адаптеры с новым интерфейсом (agentId + targetDir, без transpile)

import { describe, it, expect } from "vitest";
import { createSkillsTranspiler } from "../index.js";
import { SkillConfigError } from "../errors.js";

/**
 * Адаптер с новым интерфейсом: agentId + targetDir, без transpile.
 */
function createNewAdapter(agentId: string, targetDir: string) {
  return { agentId, targetDir };
}

describe("SkillsTranspiler", () => {
  describe("Инициализация — новый интерфейс адаптера", () => {
    // --- Спецификация: § Инициализация, шаг 3 ---
    // "Валидировать, что все элементы adapters реализуют интерфейс SkillAdapter"
    // Новый SkillAdapter: agentId (string) + targetDir (string), без transpile
    it("создаёт экземпляр при адаптере с agentId и targetDir (без transpile)", () => {
      const transpiler = createSkillsTranspiler({
        projectRoot: "/absolute/path/to/project",
        adapters: [createNewAdapter("claude", ".claude/skills")],
      });

      expect(transpiler).toBeDefined();
    });

    // --- Спецификация: § Инициализация, расширение 3a ---
    // Адаптер без agentId — невалидный
    it("выбрасывает SkillConfigError, если адаптер не имеет agentId", () => {
      const invalidAdapter = { targetDir: ".claude/skills" } as any;

      expect(() =>
        createSkillsTranspiler({
          projectRoot: "/absolute/path",
          adapters: [invalidAdapter],
        }),
      ).toThrow(SkillConfigError);

      expect(() =>
        createSkillsTranspiler({
          projectRoot: "/absolute/path",
          adapters: [invalidAdapter],
        }),
      ).toThrow("Adapter at index 0 does not implement SkillAdapter interface");
    });

    // --- Спецификация: § Инициализация, расширение 3a ---
    // Адаптер без targetDir — невалидный (новый интерфейс)
    it("выбрасывает SkillConfigError, если адаптер не имеет targetDir", () => {
      const invalidAdapter = { agentId: "claude" } as any;

      expect(() =>
        createSkillsTranspiler({
          projectRoot: "/absolute/path",
          adapters: [invalidAdapter],
        }),
      ).toThrow(SkillConfigError);

      expect(() =>
        createSkillsTranspiler({
          projectRoot: "/absolute/path",
          adapters: [invalidAdapter],
        }),
      ).toThrow("Adapter at index 0 does not implement SkillAdapter interface");
    });

    // --- Спецификация: § Инициализация ---
    // agloomDir параметр
    it("принимает конфигурацию с agloomDir", () => {
      const transpiler = createSkillsTranspiler({
        projectRoot: "/absolute/path",
        adapters: [createNewAdapter("claude", ".claude/skills")],
        agloomDir: "custom-dir",
      });

      expect(transpiler).toBeDefined();
    });
  });
});
