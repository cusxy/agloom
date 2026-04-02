/**
 * Шаг транспиляции — общий паттерн выполнения одного транспилера.
 * Spec: docs/specs/cli.md § Шаг транспиляции
 * Spec: docs/specs/plugin-loading.md § Расширение процедуры «Шаг транспиляции»
 */

import type { TranspilerStepOutcome } from "./types.js";

/** Параметры шага транспиляции. */
interface TranspileStepParams {
  /** Фабричная функция транспилера. */
  transpilerFactory: (config: {
    projectRoot: string;
    adapters: unknown[];
    agloomDir?: string;
  }) => {
    transpile: () => unknown[];
    writeResults: (
      results: unknown[],
      options?: {
        targetRoot?: string;
        variablesByAgentId?: Record<string, Record<string, string>>;
      },
    ) => {
      written: string[];
      errors: { message: string }[];
    };
  };
  /** Экземпляр адаптера для данного транспилера. */
  adapter: unknown;
  /** Абсолютный путь к корню проекта. */
  projectRoot: string;
  /** Имя шага. */
  name: "Instructions" | "Skills" | "Agents" | "Docs" | "Schemas";
  /** Карта переменных по agentId для интерполяции (skills transpiler). */
  variablesByAgentId?: Record<string, Record<string, string>>;
  /**
   * Абсолютный путь к корню источника для discover и transform.
   * Spec: docs/specs/plugin-loading.md § Расширение процедуры «Шаг транспиляции»
   */
  sourceRoot?: string;
}

/**
 * Выполняет один шаг транспиляции.
 *
 * Шаги:
 * 1. Создать экземпляр транспилера вызовом
 *    transpilerFactory({ projectRoot: sourceRoot ?? projectRoot, adapters: [adapter], agloomDir }).
 *    Если sourceRoot передан, agloomDir ДОЛЖЕН быть ".".
 *    Если sourceRoot не передан, agloomDir не передаётся (default ".agloom").
 * 2. Вызвать transpiler.transpile(), получив transpileResults.
 * 3. Вызвать transpiler.writeResults(transpileResults), получив writeResult.
 *    При наличии sourceRoot, writeResults вызывается с { targetRoot: projectRoot }.
 * 4. Определить writtenCount как длину writeResult.written.
 * 5. Определить errors как массив сообщений из writeResult.errors.
 * 6. Сформировать TranspilerStepOutcome.
 *
 * Расширение 2a: transpile() выбрасывает исключение →
 * TranspilerStepOutcome с writtenCount: 0 и [exception.message] в errors.
 */
export function runTranspileStep(
  params: TranspileStepParams,
): TranspilerStepOutcome {
  const {
    transpilerFactory,
    adapter,
    projectRoot,
    name,
    variablesByAgentId,
    sourceRoot,
  } = params;

  // Шаг 1: создать экземпляр транспилера
  // Spec: docs/specs/plugin-loading.md § Расширение процедуры «Шаг транспиляции» шаг 1
  // При наличии sourceRoot, транспилер создаётся с sourceRoot и agloomDir: "."
  // При отсутствии sourceRoot, agloomDir не передаётся (default ".agloom")
  const factoryConfig: {
    projectRoot: string;
    adapters: unknown[];
    agloomDir?: string;
  } = {
    projectRoot: sourceRoot ?? projectRoot,
    adapters: [adapter],
  };
  if (sourceRoot) {
    factoryConfig.agloomDir = ".";
  }
  const transpiler = transpilerFactory(factoryConfig);

  // Шаг 2: вызвать transpile()
  let transpileResults: unknown[];
  try {
    transpileResults = transpiler.transpile();
  } catch (err) {
    // Расширение 2a: transpile() выбрасывает исключение
    const error = err instanceof Error ? err : new Error(String(err));
    return {
      name,
      writtenCount: 0,
      errors: [error.message],
    };
  }

  // Шаг 3: вызвать writeResults()
  // Spec: docs/specs/plugin-loading.md § Расширение процедуры «Шаг транспиляции» шаг 3
  // При наличии sourceRoot, writeResults вызывается с targetRoot: projectRoot
  // Spec: docs/specs/docs-transpiler.md § Изменения в поведении
  // Docs/Schemas: variablesByAgentId передаётся вместе с targetRoot
  let writeResult: { written: string[]; errors: { message: string }[] };
  if (sourceRoot && variablesByAgentId) {
    writeResult = transpiler.writeResults(transpileResults, {
      targetRoot: projectRoot,
      variablesByAgentId,
    });
  } else if (sourceRoot) {
    writeResult = transpiler.writeResults(transpileResults, {
      targetRoot: projectRoot,
    });
  } else if (variablesByAgentId) {
    writeResult = transpiler.writeResults(transpileResults, {
      variablesByAgentId,
    });
  } else {
    writeResult = transpiler.writeResults(transpileResults);
  }

  // Шаг 4: writtenCount = writeResult.written.length
  const writtenCount = writeResult.written.length;

  // Шаг 5: errors = writeResult.errors.map(e => e.message)
  const errors = writeResult.errors.map((e) => e.message);

  // Шаг 6: сформировать TranspilerStepOutcome
  return { name, writtenCount, errors };
}
