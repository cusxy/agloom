/**
 * Commands Transpiler — публичный API.
 * Spec: docs/specs/commands-transpiler.md § Инициализация
 */

import * as path from "node:path";
import { CommandConfigError } from "./errors.js";
import { CommandsTranspiler } from "./transpiler.js";
import type { CommandAdapter, CommandsTranspilerConfig } from "./types.js";

// Barrel exports
export { ClaudeCommandAdapter } from "./adapters/claude-adapter.js";
export { OpenCodeCommandAdapter } from "./adapters/opencode-adapter.js";
export { KiloCodeCommandAdapter } from "./adapters/kilocode-adapter.js";
export { GeminiCommandAdapter } from "./adapters/gemini-adapter.js";
export { CodexCommandAdapter } from "./adapters/codex-adapter.js";

export { CommandsTranspiler } from "./transpiler.js";
export { CommandConfigError, CommandDiscoverError, CommandTransformError, CommandWriteError } from "./errors.js";
export type {
  CommandAdapter,
  CommandDefinition,
  CommandOutputFile,
  CommandsTranspilerConfig,
  CommandTranspileError,
  CommandTranspileResult,
  CommandWriteResult,
} from "./types.js";

/**
 * Проверяет, реализует ли объект интерфейс CommandAdapter.
 */
function isCommandAdapter(value: unknown): value is CommandAdapter {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return typeof obj.agentId === "string" && typeof obj.targetDir === "string" && typeof obj.transpile === "function";
}

/**
 * Создаёт экземпляр CommandsTranspiler.
 *
 * Шаги:
 * 1. Валидировать, что projectRoot является абсолютным путём.
 * 2. Валидировать, что массив adapters содержит хотя бы один элемент.
 * 3. Валидировать, что все элементы adapters реализуют интерфейс CommandAdapter.
 * 4. Валидировать, что значения agentId всех адаптеров уникальны.
 * 5. Сохранить конфигурацию в экземпляре.
 */
export function createCommandsTranspiler(config: CommandsTranspilerConfig): CommandsTranspiler {
  // Шаг 1: projectRoot должен быть абсолютным путём
  // Расширение 1a
  if (!path.isAbsolute(config.projectRoot)) {
    throw new CommandConfigError("projectRoot must be an absolute path");
  }

  // Шаг 2: массив adapters не должен быть пустым
  // Расширение 2a
  if (config.adapters.length === 0) {
    throw new CommandConfigError("At least one adapter is required");
  }

  // Шаг 3: все элементы должны реализовать интерфейс CommandAdapter
  // Расширение 3a
  for (let i = 0; i < config.adapters.length; i++) {
    if (!isCommandAdapter(config.adapters[i])) {
      throw new CommandConfigError(`Adapter at index ${i} does not implement CommandAdapter interface`);
    }
  }

  // Шаг 4: agentId должны быть уникальны
  // Расширение 4a
  const seenIds = new Set<string>();
  for (const adapter of config.adapters) {
    if (seenIds.has(adapter.agentId)) {
      throw new CommandConfigError(`Duplicate agentId: ${adapter.agentId}`);
    }
    seenIds.add(adapter.agentId);
  }

  // Шаг 5: создать экземпляр
  return new CommandsTranspiler(config.projectRoot, config.adapters, config.agloomDir);
}
