/**
 * Агрегация TranspilerStepOutcome по типу шага.
 * Spec: docs/specs/plugin-loading.md § Расширение команды transpile
 */

import type { TranspilerStepOutcome } from "./types.js";

/**
 * Агрегирует outcomes от нескольких источников (плагины + локальный проект)
 * по типу шага.
 *
 * Для каждого типа шага (Instructions, Skills, Agents):
 * - writtenCount = сумма writtenCount по всем источникам.
 * - errors = конкатенация массивов errors по всем источникам.
 *
 * @param outcomeGroups — массив массивов outcomes (по одному на источник).
 * @returns Агрегированные outcomes, по одному на тип шага.
 */
export function aggregateOutcomes(
  outcomeGroups: TranspilerStepOutcome[][],
): TranspilerStepOutcome[] {
  const byName = new Map<string, { writtenCount: number; errors: string[] }>();

  // Определить порядок шагов из первой непустой группы
  const nameOrder: string[] = [];

  for (const group of outcomeGroups) {
    for (const outcome of group) {
      if (!byName.has(outcome.name)) {
        byName.set(outcome.name, { writtenCount: 0, errors: [] });
        nameOrder.push(outcome.name);
      }
      const agg = byName.get(outcome.name)!;
      agg.writtenCount += outcome.writtenCount;
      agg.errors.push(...outcome.errors);
    }
  }

  return nameOrder.map((name) => {
    const agg = byName.get(name)!;
    return {
      name: name as TranspilerStepOutcome["name"],
      writtenCount: agg.writtenCount,
      errors: agg.errors,
    };
  });
}
