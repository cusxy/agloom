// create-commands-transpiler.spec.ts
// Спецификация: docs/specs/commands-transpiler.md § Инициализация

import { describe, it, expect } from "vitest";
import { createCommandsTranspiler } from "../index.js";
import { CommandConfigError } from "../errors.js";

/**
 * Стаб-адаптер, реализующий минимальный интерфейс CommandAdapter.
 * Используется для тестирования фабричной функции, а не поведения адаптера.
 */
function createStubAdapter(agentId: string) {
  return {
    agentId,
    targetDir: `.${agentId}/commands`,
    transpile: () => [],
  };
}

describe("CommandsTranspiler", () => {
  describe("Инициализация", () => {
    // --- Happy path: шаги 1–5 ---
    it("создаёт экземпляр при валидной конфигурации", () => {
      const transpiler = createCommandsTranspiler({
        projectRoot: "/absolute/path/to/project",
        adapters: [createStubAdapter("claude")],
      });

      expect(transpiler).toBeDefined();
      expect(typeof transpiler.discover).toBe("function");
      expect(typeof transpiler.transpile).toBe("function");
      expect(typeof transpiler.writeResults).toBe("function");
    });

    // --- Расширение 1a: projectRoot не абсолютный путь ---
    it("выбрасывает CommandConfigError, если projectRoot — относительный путь", () => {
      expect(() =>
        createCommandsTranspiler({
          projectRoot: "relative/path",
          adapters: [createStubAdapter("claude")],
        }),
      ).toThrow(CommandConfigError);

      expect(() =>
        createCommandsTranspiler({
          projectRoot: "relative/path",
          adapters: [createStubAdapter("claude")],
        }),
      ).toThrow("projectRoot must be an absolute path");
    });

    // --- Расширение 2a: пустой массив adapters ---
    it("выбрасывает CommandConfigError, если массив adapters пуст", () => {
      expect(() =>
        createCommandsTranspiler({
          projectRoot: "/absolute/path",
          adapters: [],
        }),
      ).toThrow(CommandConfigError);

      expect(() =>
        createCommandsTranspiler({
          projectRoot: "/absolute/path",
          adapters: [],
        }),
      ).toThrow("At least one adapter is required");
    });

    // --- Расширение 3a: адаптер не реализует интерфейс ---
    it("выбрасывает CommandConfigError, если адаптер не реализует интерфейс CommandAdapter", () => {
      const invalidAdapter = { notAnAdapter: true } as any;

      expect(() =>
        createCommandsTranspiler({
          projectRoot: "/absolute/path",
          adapters: [invalidAdapter],
        }),
      ).toThrow(CommandConfigError);

      expect(() =>
        createCommandsTranspiler({
          projectRoot: "/absolute/path",
          adapters: [invalidAdapter],
        }),
      ).toThrow("Adapter at index 0 does not implement CommandAdapter interface");
    });

    // --- Расширение 4a: дублирующийся agentId ---
    it("выбрасывает CommandConfigError при дублировании agentId среди адаптеров", () => {
      expect(() =>
        createCommandsTranspiler({
          projectRoot: "/absolute/path",
          adapters: [createStubAdapter("claude"), createStubAdapter("claude")],
        }),
      ).toThrow(CommandConfigError);

      expect(() =>
        createCommandsTranspiler({
          projectRoot: "/absolute/path",
          adapters: [createStubAdapter("claude"), createStubAdapter("claude")],
        }),
      ).toThrow("Duplicate agentId: claude");
    });
  });
});
