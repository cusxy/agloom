/**
 * Permissions Transpiler — публичный API.
 * Spec: docs/specs/permissions-transpiler.md § Инициализация
 */

import * as path from "node:path";
import { ConfigError } from "./errors.js";
import { PermissionsTranspiler } from "./transpiler.js";
import type { PermissionsAdapter, PermissionsTranspilerConfig } from "./types.js";

// Barrel exports
export { ClaudePermissionsAdapter } from "./adapters/claude-adapter.js";
export { OpenCodePermissionsAdapter } from "./adapters/opencode-adapter.js";
export { PermissionsTranspiler } from "./transpiler.js";
export { validatePermissionsContent } from "./validate.js";
export { ConfigError, DiscoverError, TransformError, TranspileError, WriteError } from "./errors.js";
export type {
  PermissionsAdapter,
  PermissionsCanonicalContent,
  PermissionsCanonicalFile,
  PermissionsOutputFile,
  PermissionsTranspilerConfig,
  TranspileResult,
  WriteResult,
} from "./types.js";

/**
 * Проверяет, реализует ли объект интерфейс PermissionsAdapter.
 */
function isPermissionsAdapter(value: unknown): value is PermissionsAdapter {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return typeof obj.agentId === "string" && typeof obj.transpile === "function";
}

/**
 * Создаёт экземпляр PermissionsTranspiler.
 *
 * Шаги:
 * 1. Валидировать, что projectRoot является абсолютным путём.
 * 2. Валидировать, что массив adapters содержит хотя бы один элемент.
 * 3. Валидировать, что все элементы adapters реализуют интерфейс PermissionsAdapter.
 * 4. Валидировать, что значения agentId всех адаптеров уникальны.
 * 5. Сохранить конфигурацию в экземпляре.
 */
export function createPermissionsTranspiler(config: PermissionsTranspilerConfig): PermissionsTranspiler {
  // Шаг 1: projectRoot должен быть абсолютным путём
  // Расширение 1a
  if (!path.isAbsolute(config.projectRoot)) {
    throw new ConfigError("projectRoot must be an absolute path");
  }

  // Шаг 2: массив adapters не должен быть пустым
  // Расширение 2a
  if (config.adapters.length === 0) {
    throw new ConfigError("At least one adapter is required");
  }

  // Шаг 3: все элементы должны реализовать интерфейс PermissionsAdapter
  // Расширение 3a
  for (let i = 0; i < config.adapters.length; i++) {
    if (!isPermissionsAdapter(config.adapters[i])) {
      throw new ConfigError(`Adapter at index ${i} does not implement PermissionsAdapter interface`);
    }
  }

  // Шаг 4: agentId должны быть уникальны
  // Расширение 4a
  const seenIds = new Set<string>();
  for (const adapter of config.adapters) {
    if (seenIds.has(adapter.agentId)) {
      throw new ConfigError(`Duplicate agentId: ${adapter.agentId}`);
    }
    seenIds.add(adapter.agentId);
  }

  // Шаг 5: создать экземпляр
  return new PermissionsTranspiler(config.projectRoot, config.adapters, config.agloomDir);
}
