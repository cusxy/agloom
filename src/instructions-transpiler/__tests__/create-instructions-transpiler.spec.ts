// create-instructions-transpiler.spec.ts
// Спецификация: docs/specs/instructions-transpiler.md § Инициализация

import { describe, it, expect } from "vitest";
import { createInstructionsTranspiler } from "../index.js";
import { ConfigError } from "../errors.js";

/**
 * Стаб-адаптер, реализующий минимальный интерфейс Adapter.
 * Используется для тестирования фабричной функции, а не поведения адаптера.
 */
function createStubAdapter(agentId: string) {
  return {
    agentId,
    transpile: () => [],
  };
}

describe("InstructionsTranspiler", () => {
  describe("Инициализация", () => {
    // --- Happy path: шаги 1–5 ---
    it("создаёт экземпляр при валидной конфигурации", () => {
      const transpiler = createInstructionsTranspiler({
        projectRoot: "/absolute/path/to/project",
        adapters: [createStubAdapter("claude")],
      });

      expect(transpiler).toBeDefined();
    });

    // --- Расширение 1a: projectRoot не абсолютный путь ---
    it("выбрасывает ConfigError, если projectRoot — относительный путь", () => {
      expect(() =>
        createInstructionsTranspiler({
          projectRoot: "relative/path",
          adapters: [createStubAdapter("claude")],
        }),
      ).toThrow(ConfigError);

      expect(() =>
        createInstructionsTranspiler({
          projectRoot: "relative/path",
          adapters: [createStubAdapter("claude")],
        }),
      ).toThrow("projectRoot must be an absolute path");
    });

    // --- Расширение 2a: пустой массив adapters ---
    it("выбрасывает ConfigError, если массив adapters пуст", () => {
      expect(() =>
        createInstructionsTranspiler({
          projectRoot: "/absolute/path",
          adapters: [],
        }),
      ).toThrow(ConfigError);

      expect(() =>
        createInstructionsTranspiler({
          projectRoot: "/absolute/path",
          adapters: [],
        }),
      ).toThrow("At least one adapter is required");
    });

    // --- Расширение 3a: адаптер не реализует интерфейс ---
    it("выбрасывает ConfigError, если адаптер не реализует интерфейс Adapter", () => {
      const invalidAdapter = { notAnAdapter: true } as any;

      expect(() =>
        createInstructionsTranspiler({
          projectRoot: "/absolute/path",
          adapters: [invalidAdapter],
        }),
      ).toThrow(ConfigError);

      expect(() =>
        createInstructionsTranspiler({
          projectRoot: "/absolute/path",
          adapters: [invalidAdapter],
        }),
      ).toThrow("Adapter at index 0 does not implement Adapter interface");
    });

    // --- Расширение 4a: дублирующийся agentId ---
    it("выбрасывает ConfigError при дублировании agentId среди адаптеров", () => {
      expect(() =>
        createInstructionsTranspiler({
          projectRoot: "/absolute/path",
          adapters: [createStubAdapter("claude"), createStubAdapter("claude")],
        }),
      ).toThrow(ConfigError);

      expect(() =>
        createInstructionsTranspiler({
          projectRoot: "/absolute/path",
          adapters: [createStubAdapter("claude"), createStubAdapter("claude")],
        }),
      ).toThrow("Duplicate agentId: claude");
    });
  });
});
