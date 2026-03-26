// create-agents-transpiler.spec.ts
// Спецификация: docs/specs/agents-transpiler.md § Инициализация

import { describe, it, expect } from "vitest";
import { createAgentsTranspiler } from "../index.js";
import { AgentConfigError } from "../errors.js";

/**
 * Стаб-адаптер, реализующий минимальный интерфейс AgentAdapter.
 * Используется для тестирования фабричной функции, а не поведения адаптера.
 */
function createStubAdapter(agentId: string) {
  return {
    agentId,
    transpile: () => [],
  };
}

describe("AgentsTranspiler", () => {
  describe("Инициализация", () => {
    // --- Happy path: шаги 1–5 ---
    it("создаёт экземпляр при валидной конфигурации", () => {
      const transpiler = createAgentsTranspiler({
        projectRoot: "/absolute/path/to/project",
        adapters: [createStubAdapter("claude")],
      });

      expect(transpiler).toBeDefined();
    });

    // --- Расширение 1a: projectRoot не абсолютный путь ---
    it("выбрасывает AgentConfigError, если projectRoot — относительный путь", () => {
      expect(() =>
        createAgentsTranspiler({
          projectRoot: "relative/path",
          adapters: [createStubAdapter("claude")],
        }),
      ).toThrow(AgentConfigError);

      expect(() =>
        createAgentsTranspiler({
          projectRoot: "relative/path",
          adapters: [createStubAdapter("claude")],
        }),
      ).toThrow("projectRoot must be an absolute path");
    });

    // --- Расширение 2a: пустой массив adapters ---
    it("выбрасывает AgentConfigError, если массив adapters пуст", () => {
      expect(() =>
        createAgentsTranspiler({
          projectRoot: "/absolute/path",
          adapters: [],
        }),
      ).toThrow(AgentConfigError);

      expect(() =>
        createAgentsTranspiler({
          projectRoot: "/absolute/path",
          adapters: [],
        }),
      ).toThrow("At least one adapter is required");
    });

    // --- Расширение 3a: адаптер не реализует интерфейс ---
    it("выбрасывает AgentConfigError, если адаптер не реализует интерфейс AgentAdapter", () => {
      const invalidAdapter = { notAnAdapter: true } as any;

      expect(() =>
        createAgentsTranspiler({
          projectRoot: "/absolute/path",
          adapters: [invalidAdapter],
        }),
      ).toThrow(AgentConfigError);

      expect(() =>
        createAgentsTranspiler({
          projectRoot: "/absolute/path",
          adapters: [invalidAdapter],
        }),
      ).toThrow("Adapter at index 0 does not implement AgentAdapter interface");
    });

    // --- Расширение 4a: дублирующийся agentId ---
    it("выбрасывает AgentConfigError при дублировании agentId среди адаптеров", () => {
      expect(() =>
        createAgentsTranspiler({
          projectRoot: "/absolute/path",
          adapters: [createStubAdapter("claude"), createStubAdapter("claude")],
        }),
      ).toThrow(AgentConfigError);

      expect(() =>
        createAgentsTranspiler({
          projectRoot: "/absolute/path",
          adapters: [createStubAdapter("claude"), createStubAdapter("claude")],
        }),
      ).toThrow("Duplicate agentId: claude");
    });
  });
});
