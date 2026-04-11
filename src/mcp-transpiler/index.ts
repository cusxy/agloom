/**
 * MCP Transpiler — публичный API.
 * Spec: docs/specs/mcp-transpiler.md § Инициализация
 */

import * as path from "node:path";
import { ConfigError } from "./errors.js";
import { McpTranspiler } from "./transpiler.js";
import type { McpAdapter, McpTranspilerConfig } from "./types.js";

// Barrel exports
export { ClaudeMcpAdapter } from "./adapters/claude-adapter.js";
export { OpenCodeMcpAdapter } from "./adapters/opencode-adapter.js";
export { CodexMcpAdapter } from "./adapters/codex-adapter.js";
export { GeminiMcpAdapter } from "./adapters/gemini-adapter.js";
export { KilocodeMcpAdapter } from "./adapters/kilocode-adapter.js";
export { McpTranspiler } from "./transpiler.js";
export { validateCanonicalContent } from "./validate.js";
export { ConfigError, DiscoverError, TransformError, TranspileError, WriteError } from "./errors.js";
export type {
  McpAdapter,
  McpCanonicalContent,
  McpCanonicalFile,
  McpOutputFile,
  McpTranspilerConfig,
  TranspileResult,
  WriteResult,
} from "./types.js";

/**
 * Проверяет, реализует ли объект интерфейс McpAdapter.
 */
function isMcpAdapter(value: unknown): value is McpAdapter {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return typeof obj.agentId === "string" && typeof obj.transpile === "function";
}

/**
 * Создаёт экземпляр McpTranspiler.
 *
 * Шаги:
 * 1. Валидировать, что projectRoot является абсолютным путём.
 * 2. Валидировать, что массив adapters содержит хотя бы один элемент.
 * 3. Валидировать, что все элементы adapters реализуют интерфейс McpAdapter.
 * 4. Валидировать, что значения agentId всех адаптеров уникальны.
 * 5. Сохранить конфигурацию в экземпляре.
 */
export function createMcpTranspiler(config: McpTranspilerConfig): McpTranspiler {
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

  // Шаг 3: все элементы должны реализовать интерфейс McpAdapter
  // Расширение 3a
  for (let i = 0; i < config.adapters.length; i++) {
    if (!isMcpAdapter(config.adapters[i])) {
      throw new ConfigError(`Adapter at index ${i} does not implement McpAdapter interface`);
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
  return new McpTranspiler(config.projectRoot, config.adapters, config.agloomDir);
}
