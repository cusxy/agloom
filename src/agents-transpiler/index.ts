/**
 * Agents Transpiler — публичный API.
 * Spec: docs/specs/agents-transpiler.md § Инициализация
 */

import * as path from "node:path";
import { AgentConfigError } from "./errors.js";
import { AgentsTranspiler } from "./transpiler.js";
import type { AgentAdapter, AgentsTranspilerConfig } from "./types.js";

// Barrel exports
export { ClaudeAgentAdapter } from "./adapters/claude-adapter.js";
export { OpenCodeAgentAdapter } from "./adapters/opencode-adapter.js";

export { AgentsTranspiler } from "./transpiler.js";
export { transformContent } from "./transform-content.js";
export { filterBody } from "./filter-body.js";
export {
  AgentConfigError,
  AgentDiscoverError,
  AgentTransformError,
  AgentWriteError,
} from "./errors.js";
export type {
  AgentAdapter,
  AgentDefinition,
  AgentOutputFile,
  AgentsTranspilerConfig,
  AgentTranspileError,
  AgentTranspileResult,
  AgentWriteResult,
} from "./types.js";

/**
 * Проверяет, реализует ли объект интерфейс AgentAdapter.
 */
function isAgentAdapter(value: unknown): value is AgentAdapter {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return typeof obj.agentId === "string" && typeof obj.transpile === "function";
}

/**
 * Создаёт экземпляр AgentsTranspiler.
 *
 * Шаги:
 * 1. Валидировать, что projectRoot является абсолютным путём.
 * 2. Валидировать, что массив adapters содержит хотя бы один элемент.
 * 3. Валидировать, что все элементы adapters реализуют интерфейс AgentAdapter.
 * 4. Валидировать, что значения agentId всех адаптеров уникальны.
 * 5. Сохранить конфигурацию в экземпляре.
 */
export function createAgentsTranspiler(
  config: AgentsTranspilerConfig,
): AgentsTranspiler {
  // Шаг 1: projectRoot должен быть абсолютным путём
  // Расширение 1a
  if (!path.isAbsolute(config.projectRoot)) {
    throw new AgentConfigError("projectRoot must be an absolute path");
  }

  // Шаг 2: массив adapters не должен быть пустым
  // Расширение 2a
  if (config.adapters.length === 0) {
    throw new AgentConfigError("At least one adapter is required");
  }

  // Шаг 3: все элементы должны реализовать интерфейс AgentAdapter
  // Расширение 3a
  for (let i = 0; i < config.adapters.length; i++) {
    if (!isAgentAdapter(config.adapters[i])) {
      throw new AgentConfigError(
        `Adapter at index ${i} does not implement AgentAdapter interface`,
      );
    }
  }

  // Шаг 4: agentId должны быть уникальны
  // Расширение 4a
  const seenIds = new Set<string>();
  for (const adapter of config.adapters) {
    if (seenIds.has(adapter.agentId)) {
      throw new AgentConfigError(`Duplicate agentId: ${adapter.agentId}`);
    }
    seenIds.add(adapter.agentId);
  }

  // Шаг 5: создать экземпляр
  return new AgentsTranspiler(config.projectRoot, config.adapters);
}
