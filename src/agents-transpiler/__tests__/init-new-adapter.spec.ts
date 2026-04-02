// init-new-adapter.spec.ts
// Спецификация: docs/specs/agents-transpiler.md § Инициализация
// Тест: createAgentsTranspiler принимает адаптеры с новым интерфейсом (agentId + targetDir + transpile)

import { describe, it, expect } from "vitest";
import { createAgentsTranspiler } from "../index.js";
import { AgentConfigError } from "../errors.js";

/**
 * Адаптер с новым интерфейсом: agentId + targetDir + transpile.
 */
function createNewAdapter(agentId: string, targetDir: string) {
  return { agentId, targetDir, transpile: () => [] };
}

describe("AgentsTranspiler", () => {
  describe("Инициализация — новый интерфейс адаптера", () => {
    // --- Спецификация: § Инициализация, шаг 3 ---
    // "Валидировать, что все элементы adapters реализуют интерфейс AgentAdapter"
    // Новый AgentAdapter: agentId + targetDir + transpile
    it("создаёт экземпляр при адаптере с agentId, targetDir и transpile", () => {
      const transpiler = createAgentsTranspiler({
        projectRoot: "/absolute/path/to/project",
        adapters: [createNewAdapter("claude", ".claude/agents")],
      });

      expect(transpiler).toBeDefined();
    });

    // --- Спецификация: § Инициализация, расширение 3a ---
    // Адаптер без targetDir — невалидный (новый интерфейс)
    it("выбрасывает AgentConfigError, если адаптер не имеет targetDir", () => {
      const invalidAdapter = { agentId: "claude", transpile: () => [] } as any;

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

    // --- Спецификация: § Инициализация, расширение 3a ---
    // Адаптер без transpile — невалидный (agents adapter ДОЛЖЕН иметь transpile)
    it("выбрасывает AgentConfigError, если адаптер не имеет transpile", () => {
      const invalidAdapter = {
        agentId: "claude",
        targetDir: ".claude/agents",
      } as any;

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

    // --- Спецификация: § Инициализация ---
    // agloomDir параметр
    it("принимает конфигурацию с agloomDir", () => {
      const transpiler = createAgentsTranspiler({
        projectRoot: "/absolute/path",
        adapters: [createNewAdapter("claude", ".claude/agents")],
        agloomDir: "custom-dir",
      });

      expect(transpiler).toBeDefined();
    });
  });
});
