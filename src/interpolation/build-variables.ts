/**
 * Построение карты переменных интерполяции.
 * Spec: docs/specs/interpolation.md § Построение карты переменных
 */

/** Минимальный интерфейс записи адаптера для buildVariables. */
interface AdapterEntry {
  id: string;
  targetRoot: string;
  paths: {
    skills?: string;
    agents?: string;
    docs?: string;
    schemas?: string;
  };
}

/**
 * Строит карту agloom-переменных для указанного текущего адаптера.
 *
 * Шаги:
 * 1. Создать пустую карту Record<string, string>.
 * 2. Добавить PROJECT_DIR со значением projectRoot.
 * 3. Добавить остальные канонические переменные.
 * 4. Добавить ROOT_DIR со значением currentAdapter.targetRoot.
 * 5. Для каждого определённого поля из currentAdapter.paths добавить
 *    соответствующую динамическую переменную.
 * 6. Для каждого адаптера из allAdapters, у которого
 *    Object.keys(adapter.paths).length > 0 — вычислить PREFIX.
 * 7. Добавить {PREFIX}_DIR со значением adapter.targetRoot.
 * 8. Для каждого определённого поля из adapter.paths добавить
 *    соответствующую per-adapter переменную.
 */
export function buildVariables(
  currentAdapter: AdapterEntry,
  allAdapters: AdapterEntry[],
  projectRoot: string,
): Record<string, string> {
  // Шаг 1: создать пустую карту
  const variables: Record<string, string> = {};

  // Шаг 2: PROJECT_DIR со значением projectRoot
  variables["PROJECT_DIR"] = projectRoot;

  // Шаг 3: остальные канонические переменные (фиксированные)
  variables["AGLOOM_DIR"] = ".agloom";
  variables["AGLOOM_SKILLS_DIR"] = ".agloom/skills";
  variables["AGLOOM_AGENTS_DIR"] = ".agloom/agents";
  variables["AGLOOM_DOCS_DIR"] = ".agloom/docs";
  variables["AGLOOM_SCHEMAS_DIR"] = ".agloom/schemas";

  // Шаг 3: ROOT_DIR = currentAdapter.targetRoot
  variables["ROOT_DIR"] = currentAdapter.targetRoot;

  // Шаг 4: динамические переменные (per-current-adapter)
  if (currentAdapter.paths.skills !== undefined) {
    variables["SKILLS_DIR"] = currentAdapter.paths.skills;
  }
  if (currentAdapter.paths.agents !== undefined) {
    variables["AGENTS_DIR"] = currentAdapter.paths.agents;
  }
  if (currentAdapter.paths.docs !== undefined) {
    variables["DOCS_DIR"] = currentAdapter.paths.docs;
  }
  if (currentAdapter.paths.schemas !== undefined) {
    variables["SCHEMAS_DIR"] = currentAdapter.paths.schemas;
  }

  // Шаги 5–7: статические (per-adapter) переменные
  for (const adapter of allAdapters) {
    const definedKeys = Object.keys(adapter.paths).filter(
      (key) => adapter.paths[key as keyof typeof adapter.paths] !== undefined,
    );

    // Шаг 5: пропуск, если paths пустой
    if (definedKeys.length === 0) {
      continue;
    }

    const prefix = adapter.id.toUpperCase();

    // Шаг 6: {PREFIX}_DIR всегда
    variables[`${prefix}_DIR`] = adapter.targetRoot;

    // Шаг 7: per-adapter подпеременные
    if (adapter.paths.skills !== undefined) {
      variables[`${prefix}_SKILLS_DIR`] = adapter.paths.skills;
    }
    if (adapter.paths.agents !== undefined) {
      variables[`${prefix}_AGENTS_DIR`] = adapter.paths.agents;
    }
    if (adapter.paths.docs !== undefined) {
      variables[`${prefix}_DOCS_DIR`] = adapter.paths.docs;
    }
    if (adapter.paths.schemas !== undefined) {
      variables[`${prefix}_SCHEMAS_DIR`] = adapter.paths.schemas;
    }
  }

  return variables;
}
