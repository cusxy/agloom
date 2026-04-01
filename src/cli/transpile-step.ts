/**
 * Шаг транспиляции — общий паттерн выполнения одного транспилера.
 * Spec: docs/specs/cli.md § Шаг транспиляции
 * Spec: docs/specs/plugin-loading.md § Расширение процедуры «Шаг транспиляции»
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { TranspilerStepOutcome } from "./types.js";

/** Параметры шага транспиляции. */
interface TranspileStepParams {
  /** Фабричная функция транспилера. */
  transpilerFactory: (config: { projectRoot: string; adapters: unknown[] }) => {
    transpile: () => unknown[];
    writeResults: (
      results: unknown[],
      variablesByAgentIdOrOptions?:
        | Record<string, Record<string, string>>
        | { targetRoot: string },
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
  name: "Instructions" | "Skills" | "Agents";
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
/**
 * При наличии sourceRoot (плагин), создаёт временный symlink
 * <sourceRoot>/.agloom → <sourceRoot>, чтобы транспилеры skills/agents
 * обнаруживали файлы в <sourceRoot>/agents/ и <sourceRoot>/skills/
 * через стандартный путь <projectRoot>/.agloom/agents/.
 *
 * Spec: docs/specs/plugin-manifest.md — плагин хранит agents/, skills/
 * на верхнем уровне (без .agloom/ prefix).
 */
function withPluginSymlink<T>(sourceRoot: string, fn: () => T): T {
  const symlinkPath = path.join(sourceRoot, ".agloom");
  const needsSymlink = !fs.existsSync(symlinkPath);

  if (needsSymlink) {
    try {
      fs.symlinkSync(sourceRoot, symlinkPath, "dir");
    } catch {
      // Если symlink не удаётся создать — выполняем без него
      return fn();
    }
  }

  try {
    return fn();
  } finally {
    if (needsSymlink) {
      try {
        fs.unlinkSync(symlinkPath);
      } catch {
        // Best-effort cleanup
      }
    }
  }
}

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
  // При наличии sourceRoot, транспилер создаётся с sourceRoot для discover/transform
  const transpiler = transpilerFactory({
    projectRoot: sourceRoot ?? projectRoot,
    adapters: [adapter],
  });

  // Шаг 2: вызвать transpile()
  // При наличии sourceRoot, создать временный .agloom symlink для discover
  let transpileResults: unknown[];
  try {
    if (sourceRoot) {
      transpileResults = withPluginSymlink(sourceRoot, () =>
        transpiler.transpile(),
      );
    } else {
      transpileResults = transpiler.transpile();
    }
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
  // При наличии sourceRoot, writeResults вызывается с { targetRoot: projectRoot }
  let writeResult: { written: string[]; errors: { message: string }[] };
  if (sourceRoot) {
    writeResult = transpiler.writeResults(transpileResults, {
      targetRoot: projectRoot,
    });
  } else if (variablesByAgentId) {
    writeResult = transpiler.writeResults(transpileResults, variablesByAgentId);
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
