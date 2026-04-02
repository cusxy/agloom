/**
 * Docs & Schemas Transpiler — публичный API.
 * Spec: docs/specs/docs-transpiler.md § Инициализация
 */

import * as path from "node:path";
import { ResourceConfigError } from "./errors.js";
import { ResourceTranspiler } from "./transpiler.js";
import type {
  ResourceAdapter,
  ResourceTranspilerConfig,
  ResourceType,
} from "./types.js";

// Barrel exports
export { ResourceTranspiler } from "./transpiler.js";
export {
  ResourceConfigError,
  ResourceDiscoverError,
  ResourceWriteError,
} from "./errors.js";
export type {
  ResourceAdapter,
  ResourceFile,
  ResourceOutputFile,
  ResourceTranspilerConfig,
  ResourceTranspileError,
  ResourceTranspileResult,
  ResourceType,
  ResourceWriteResult,
} from "./types.js";

/**
 * Проверяет, реализует ли объект интерфейс ResourceAdapter.
 */
function isResourceAdapter(value: unknown): value is ResourceAdapter {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return typeof obj.agentId === "string" && typeof obj.targetDir === "string";
}

/**
 * Создаёт экземпляр ResourceTranspiler.
 *
 * Шаги:
 * 1. Валидировать, что projectRoot является абсолютным путём.
 * 2. Валидировать, что массив adapters содержит хотя бы один элемент.
 * 3. Валидировать, что все элементы adapters реализуют интерфейс ResourceAdapter.
 * 4. Валидировать, что значения agentId всех адаптеров уникальны.
 * 5. Валидировать, что resourceType равен "docs" или "schemas".
 * 6. Сохранить конфигурацию в экземпляре.
 */
export function createResourceTranspiler(
  config: ResourceTranspilerConfig,
): ResourceTranspiler {
  // Шаг 1: projectRoot должен быть абсолютным путём
  // Расширение 1a
  if (!path.isAbsolute(config.projectRoot)) {
    throw new ResourceConfigError("projectRoot must be an absolute path");
  }

  // Шаг 2: массив adapters не должен быть пустым
  // Расширение 2a
  if (config.adapters.length === 0) {
    throw new ResourceConfigError("At least one adapter is required");
  }

  // Шаг 3: все элементы должны реализовать интерфейс ResourceAdapter
  // Расширение 3a
  for (let i = 0; i < config.adapters.length; i++) {
    if (!isResourceAdapter(config.adapters[i])) {
      throw new ResourceConfigError(
        `Adapter at index ${i} does not implement ResourceAdapter interface`,
      );
    }
  }

  // Шаг 4: agentId должны быть уникальны
  // Расширение 4a
  const seenIds = new Set<string>();
  for (const adapter of config.adapters) {
    if (seenIds.has(adapter.agentId)) {
      throw new ResourceConfigError(`Duplicate agentId: ${adapter.agentId}`);
    }
    seenIds.add(adapter.agentId);
  }

  // Шаг 5: resourceType должен быть "docs" или "schemas"
  // Расширение 5a
  if (config.resourceType !== "docs" && config.resourceType !== "schemas") {
    throw new ResourceConfigError(
      `Invalid resourceType: ${config.resourceType}`,
    );
  }

  // Шаг 6: создать экземпляр
  const agloomDir = config.agloomDir ?? ".agloom";
  return new ResourceTranspiler(
    config.projectRoot,
    config.adapters,
    agloomDir,
    config.resourceType,
  );
}

/**
 * Создаёт ResourceAdapter из записи реестра адаптеров.
 * Spec: § Создание адаптера из реестра
 */
export function createResourceAdapter(
  entry: { id: string; paths: Record<string, string | undefined> },
  resourceType: ResourceType,
): ResourceAdapter | null {
  // Шаг 1: определить путь к целевому каталогу
  const targetDir = entry.paths[resourceType];

  // Шаг 2: если путь определён — создать ResourceAdapter
  if (targetDir !== undefined) {
    return {
      agentId: entry.id,
      targetDir,
    };
  }

  // Шаг 3: если путь не определён — вернуть null
  return null;
}
