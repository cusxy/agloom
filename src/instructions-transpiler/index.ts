/**
 * Instructions Transpiler — публичный API.
 * Spec: docs/specs/instructions-transpiler.md § Инициализация
 */

import * as path from "node:path";
import { ConfigError } from "./errors.js";
import { InstructionsTranspiler } from "./transpiler.js";
import type { Adapter, TranspilerConfig } from "./types.js";

// Barrel exports
export { ClaudeAdapter } from "./adapters/claude-adapter.js";
export { OpenCodeAdapter } from "./adapters/opencode-adapter.js";
export { AgentsMdAdapter } from "./adapters/agentsmd-adapter.js";
export { GeminiAdapter } from "./adapters/gemini-adapter.js";
export { KiloCodeAdapter } from "./adapters/kilocode-adapter.js";
export { CodexAdapter } from "./adapters/codex-adapter.js";
export { InstructionsTranspiler } from "./transpiler.js";
export { transformContent } from "./transform-content.js";
export { filterBody } from "./filter-body.js";
export { ConfigError, DiscoverError, TransformError, WriteError } from "./errors.js";
export type {
  Adapter,
  CanonicalFile,
  CanonicalFileType,
  OutputFile,
  TranspileError,
  TranspileResult,
  TranspilerConfig,
  WriteResult,
} from "./types.js";

/**
 * Проверяет, реализует ли объект интерфейс Adapter.
 */
function isAdapter(value: unknown): value is Adapter {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return typeof obj.agentId === "string" && typeof obj.transpile === "function";
}

/**
 * Создаёт экземпляр InstructionsTranspiler.
 *
 * Шаги:
 * 1. Валидировать, что projectRoot является абсолютным путём.
 * 2. Валидировать, что массив adapters содержит хотя бы один элемент.
 * 3. Валидировать, что все элементы adapters реализуют интерфейс Adapter.
 * 4. Валидировать, что значения agentId всех адаптеров уникальны.
 * 5. Сохранить конфигурацию в экземпляре.
 */
export function createInstructionsTranspiler(config: TranspilerConfig): InstructionsTranspiler {
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

  // Шаг 3: все элементы должны реализовать интерфейс Adapter
  // Расширение 3a
  for (let i = 0; i < config.adapters.length; i++) {
    if (!isAdapter(config.adapters[i])) {
      throw new ConfigError(`Adapter at index ${i} does not implement Adapter interface`);
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
  return new InstructionsTranspiler(config.projectRoot, config.adapters);
}
