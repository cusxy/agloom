/**
 * Шаг транспиляции — общий паттерн выполнения одного транспилера.
 * Spec: docs/specs/cli.md § Шаг транспиляции
 */

import type { TranspilerStepOutcome } from "./types.js";

/** Параметры шага транспиляции. */
interface TranspileStepParams {
  /** Фабричная функция транспилера. */
  transpilerFactory: (config: { projectRoot: string; adapters: unknown[] }) => {
    transpile: () => unknown[];
    writeResults: (results: unknown[]) => {
      written: string[];
      errors: { message: string }[];
    };
  };
  /** Экземпляр адаптера для данного транспилера. */
  adapter: unknown;
  /** Абсолютный путь к корню проекта. */
  projectRoot: string;
  /** Имя шага. */
  name: "Instructions" | "Skills" | "Agents";
}

/**
 * Выполняет один шаг транспиляции.
 *
 * Шаги:
 * 1. Создать экземпляр транспилера вызовом transpilerFactory({ projectRoot, adapters: [adapter] }).
 * 2. Вызвать transpiler.transpile(), получив transpileResults.
 * 3. Вызвать transpiler.writeResults(transpileResults), получив writeResult.
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
  const { transpilerFactory, adapter, projectRoot, name } = params;

  // Шаг 1: создать экземпляр транспилера
  const transpiler = transpilerFactory({
    projectRoot,
    adapters: [adapter],
  });

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
  const writeResult = transpiler.writeResults(transpileResults);

  // Шаг 4: writtenCount = writeResult.written.length
  const writtenCount = writeResult.written.length;

  // Шаг 5: errors = writeResult.errors.map(e => e.message)
  const errors = writeResult.errors.map((e) => e.message);

  // Шаг 6: сформировать TranspilerStepOutcome
  return { name, writtenCount, errors };
}
