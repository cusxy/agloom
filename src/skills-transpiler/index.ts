/**
 * Skills Transpiler — публичный API.
 * Spec: docs/specs/skills-transpiler.md § Инициализация
 */

import * as path from "node:path";
import { SkillConfigError } from "./errors.js";
import { SkillsTranspiler } from "./transpiler.js";
import type { SkillAdapter, SkillsTranspilerConfig } from "./types.js";

// Barrel exports
export { ClaudeSkillAdapter } from "./adapters/claude-adapter.js";
export { OpenCodeSkillAdapter } from "./adapters/opencode-adapter.js";
export { SkillsTranspiler } from "./transpiler.js";
export {
  SkillConfigError,
  SkillDiscoverError,
  SkillWriteError,
} from "./errors.js";
export type {
  SkillAdapter,
  SkillOutputFile,
  SkillPackage,
  SkillsTranspilerConfig,
  SkillTranspileError,
  SkillTranspileResult,
  SkillWriteResult,
} from "./types.js";

/**
 * Проверяет, реализует ли объект интерфейс SkillAdapter.
 */
function isSkillAdapter(value: unknown): value is SkillAdapter {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return typeof obj.agentId === "string" && typeof obj.transpile === "function";
}

/**
 * Создаёт экземпляр SkillsTranspiler.
 *
 * Шаги:
 * 1. Валидировать, что projectRoot является абсолютным путём.
 * 2. Валидировать, что массив adapters содержит хотя бы один элемент.
 * 3. Валидировать, что все элементы adapters реализуют интерфейс SkillAdapter.
 * 4. Валидировать, что значения agentId всех адаптеров уникальны.
 * 5. Сохранить конфигурацию в экземпляре.
 */
export function createSkillsTranspiler(
  config: SkillsTranspilerConfig,
): SkillsTranspiler {
  // Шаг 1: projectRoot должен быть абсолютным путём
  // Расширение 1a
  if (!path.isAbsolute(config.projectRoot)) {
    throw new SkillConfigError("projectRoot must be an absolute path");
  }

  // Шаг 2: массив adapters не должен быть пустым
  // Расширение 2a
  if (config.adapters.length === 0) {
    throw new SkillConfigError("At least one adapter is required");
  }

  // Шаг 3: все элементы должны реализовать интерфейс SkillAdapter
  // Расширение 3a
  for (let i = 0; i < config.adapters.length; i++) {
    if (!isSkillAdapter(config.adapters[i])) {
      throw new SkillConfigError(
        `Adapter at index ${i} does not implement SkillAdapter interface`,
      );
    }
  }

  // Шаг 4: agentId должны быть уникальны
  // Расширение 4a
  const seenIds = new Set<string>();
  for (const adapter of config.adapters) {
    if (seenIds.has(adapter.agentId)) {
      throw new SkillConfigError(`Duplicate agentId: ${adapter.agentId}`);
    }
    seenIds.add(adapter.agentId);
  }

  // Шаг 5: создать экземпляр
  return new SkillsTranspiler(config.projectRoot, config.adapters);
}
