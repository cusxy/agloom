/**
 * Разрешение зависимостей адаптеров — топологическая сортировка.
 * Spec: docs/specs/cli.md § Разрешение зависимостей
 */

import type { AdapterRegistryEntry } from "./types.js";

/**
 * Разрешение зависимостей: собрать упорядоченный список записей
 * в топологическом порядке (зависимости перед зависящими).
 * Spec: docs/specs/cli.md § Разрешение зависимостей
 */
export function resolveDeps(
  entryId: string,
  registry: AdapterRegistryEntry[],
): AdapterRegistryEntry[] {
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const result: AdapterRegistryEntry[] = [];

  function visit(id: string): void {
    if (visited.has(id)) return;
    if (inStack.has(id)) throw new Error("Circular dependency detected");
    const entry = registry.find((e) => e.id === id);
    if (!entry) throw new Error(`Unknown dependency: ${id}`);
    inStack.add(id);
    for (const dep of entry.dependsOn) visit(dep);
    inStack.delete(id);
    visited.add(id);
    result.push(entry);
  }

  visit(entryId);
  return result;
}
