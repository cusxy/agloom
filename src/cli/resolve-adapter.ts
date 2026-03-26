/**
 * Процедура Resolve Adapter — разрешение адаптера по идентификатору.
 * Spec: docs/specs/adapter-registry-ext.md § Процедура Resolve Adapter
 */

import { adapterRegistry } from "./adapter-registry.js";
import type { AdapterRegistryEntry } from "./types.js";

/** Результат процедуры Resolve Adapter. */
export interface ResolveAdapterResult {
  /** Запись адаптера из реестра. */
  entry: AdapterRegistryEntry;
  /** Абсолютный путь к корню проекта. */
  projectRoot: string;
}

/**
 * Находит запись адаптера в реестре по идентификатору и определяет корень проекта.
 *
 * @param adapterId — идентификатор адаптера из реестра.
 * @returns Запись адаптера и абсолютный путь к корню проекта.
 * @throws Error если адаптер не найден в реестре.
 */
export function resolveAdapter(adapterId: string): ResolveAdapterResult {
  const entry = adapterRegistry.find((e) => e.id === adapterId);

  if (!entry) {
    throw new Error(
      `Unknown adapter: ${adapterId}. Run 'agent-sds adapters' to see available adapters.`,
    );
  }

  const projectRoot = process.cwd();

  return { entry, projectRoot };
}
