// create-skills-transpiler.spec.ts
// Спецификация: docs/specs/skills-transpiler.md § Инициализация

import { describe, it, expect } from "vitest";
import { createSkillsTranspiler } from "../index.js";
import { SkillConfigError } from "../errors.js";

/**
 * Стаб-адаптер, реализующий минимальный интерфейс SkillAdapter.
 * Используется для тестирования фабричной функции, а не поведения адаптера.
 */
function createStubAdapter(agentId: string) {
  return {
    agentId,
    targetDir: `.${agentId}/skills`,
  };
}

describe("SkillsTranspiler", () => {
  describe("Инициализация", () => {
    // --- Happy path: шаги 1–5 ---
    it("создаёт экземпляр при валидной конфигурации", () => {
      const transpiler = createSkillsTranspiler({
        projectRoot: "/absolute/path/to/project",
        adapters: [createStubAdapter("claude")],
      });

      expect(transpiler).toBeDefined();
    });

    // --- Расширение 1a: projectRoot не абсолютный путь ---
    it("выбрасывает SkillConfigError, если projectRoot — относительный путь", () => {
      expect(() =>
        createSkillsTranspiler({
          projectRoot: "relative/path",
          adapters: [createStubAdapter("claude")],
        }),
      ).toThrow(SkillConfigError);

      expect(() =>
        createSkillsTranspiler({
          projectRoot: "relative/path",
          adapters: [createStubAdapter("claude")],
        }),
      ).toThrow("projectRoot must be an absolute path");
    });

    // --- Расширение 2a: пустой массив adapters ---
    it("выбрасывает SkillConfigError, если массив adapters пуст", () => {
      expect(() =>
        createSkillsTranspiler({
          projectRoot: "/absolute/path",
          adapters: [],
        }),
      ).toThrow(SkillConfigError);

      expect(() =>
        createSkillsTranspiler({
          projectRoot: "/absolute/path",
          adapters: [],
        }),
      ).toThrow("At least one adapter is required");
    });

    // --- Расширение 3a: адаптер не реализует интерфейс ---
    it("выбрасывает SkillConfigError, если адаптер не реализует интерфейс SkillAdapter", () => {
      const invalidAdapter = { notAnAdapter: true } as any;

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

    // --- Расширение 4a: дублирующийся agentId ---
    it("выбрасывает SkillConfigError при дублировании agentId среди адаптеров", () => {
      expect(() =>
        createSkillsTranspiler({
          projectRoot: "/absolute/path",
          adapters: [createStubAdapter("claude"), createStubAdapter("claude")],
        }),
      ).toThrow(SkillConfigError);

      expect(() =>
        createSkillsTranspiler({
          projectRoot: "/absolute/path",
          adapters: [createStubAdapter("claude"), createStubAdapter("claude")],
        }),
      ).toThrow("Duplicate agentId: claude");
    });
  });
});
