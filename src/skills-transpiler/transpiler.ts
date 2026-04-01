/**
 * Skills Transpiler — основной класс.
 * Spec: docs/specs/skills-transpiler.md
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { discover } from "./discover.js";
import { SkillWriteError } from "./errors.js";
import { interpolate, InterpolationError } from "../interpolation/index.js";
import type {
  SkillAdapter,
  SkillPackage,
  SkillTranspileResult,
  SkillWriteResult,
} from "./types.js";

export class SkillsTranspiler {
  private readonly projectRoot: string;
  private readonly adapters: SkillAdapter[];

  constructor(projectRoot: string, adapters: SkillAdapter[]) {
    this.projectRoot = projectRoot;
    this.adapters = adapters;
  }

  /**
   * Обнаруживает все skill-пакеты в проекте.
   * Spec: § Обнаружение skill-пакетов
   */
  discover(): SkillPackage[] {
    return discover(this.projectRoot);
  }

  /**
   * Выполняет полный цикл транспиляции для всех зарегистрированных адаптеров.
   * Spec: § Транспиляция
   */
  transpile(): SkillTranspileResult[] {
    // Шаг 1: обнаружить skill-пакеты
    const packages = this.discover();

    // Расширение 1a: ни одного пакета — пустой массив
    if (packages.length === 0) {
      return [];
    }

    // Шаг 2: для каждого адаптера вызвать transpile(packages)
    // Шаг 3: собрать результаты
    const results: SkillTranspileResult[] = [];

    for (const adapter of this.adapters) {
      try {
        const files = adapter.transpile(packages);
        results.push({
          agentId: adapter.agentId,
          files,
          errors: [],
        });
      } catch (err) {
        // Расширение 2a: адаптер выбросил исключение
        const error = err instanceof Error ? err : new Error(String(err));
        results.push({
          agentId: adapter.agentId,
          files: [],
          errors: [
            {
              agentId: adapter.agentId,
              message: error.message,
              cause: error,
            },
          ],
        });
      }
    }

    return results;
  }

  /**
   * Записывает результаты транспиляции в файловую систему.
   * Spec: § Запись результатов
   * Spec: docs/specs/interpolation.md § Расширение writeResults Skills Transpiler
   */
  writeResults(
    results: SkillTranspileResult[],
    variablesByAgentIdOrOptions?:
      | Record<string, Record<string, string>>
      | { targetRoot: string },
  ): SkillWriteResult {
    // Determine if second argument is variablesByAgentId or options with targetRoot
    let variablesByAgentId: Record<string, Record<string, string>> | undefined;
    let writeRoot = this.projectRoot;

    if (variablesByAgentIdOrOptions !== undefined) {
      if (
        "targetRoot" in variablesByAgentIdOrOptions &&
        typeof variablesByAgentIdOrOptions.targetRoot === "string"
      ) {
        writeRoot = variablesByAgentIdOrOptions.targetRoot;
      } else {
        variablesByAgentId = variablesByAgentIdOrOptions as Record<
          string,
          Record<string, string>
        >;
      }
    }

    const written: string[] = [];
    const errors: SkillWriteError[] = [];

    for (const result of results) {
      // Шаг 1: проверить, что массив errors пуст
      // Расширение 1a: при наличии ошибок — пропустить запись
      if (result.errors.length > 0) {
        for (const err of result.errors) {
          errors.push(new SkillWriteError(err.message));
        }
        continue;
      }

      // Расширение 2c: variablesByAgentId передан, но ключ agentId отсутствует
      if (
        variablesByAgentId !== undefined &&
        !(result.agentId in variablesByAgentId)
      ) {
        errors.push(
          new SkillWriteError(
            `No interpolation variables for adapter: ${result.agentId}`,
          ),
        );
        continue;
      }

      // Шаг 2: для каждого файла
      for (const file of result.files) {
        const sourceAbsolute = path.join(this.projectRoot, file.sourcePath);
        const destAbsolute = path.join(writeRoot, file.relativePath);

        // Определить, нужна ли интерполяция для данного файла
        const isMd = path.extname(file.sourcePath).toLowerCase() === ".md";
        const shouldInterpolate = variablesByAgentId !== undefined && isMd;

        if (shouldInterpolate) {
          // Интерполяция .md файлов
          try {
            const content = fs.readFileSync(sourceAbsolute, "utf-8");
            const interpolated = interpolate(
              content,
              variablesByAgentId![result.agentId],
            );

            // Создать промежуточные каталоги при необходимости
            const dir = path.dirname(destAbsolute);
            fs.mkdirSync(dir, { recursive: true });

            fs.writeFileSync(destAbsolute, interpolated, "utf-8");
            written.push(file.relativePath);
          } catch (err) {
            // Расширение 2d: InterpolationError → SkillWriteError
            if (err instanceof InterpolationError) {
              errors.push(
                new SkillWriteError(
                  `Interpolation failed for ${file.sourcePath}: ${err.message}`,
                ),
              );
              continue;
            }
            // Расширение 2a/2b: ошибка чтения или записи
            errors.push(
              new SkillWriteError(
                `Failed to write ${file.relativePath}: ${(err as Error).message}`,
              ),
            );
          }
        } else {
          // Побайтовое копирование (не-.md файлы или variablesByAgentId не передан)

          // Расширение 2a: исходный файл не существует или недоступен
          try {
            fs.accessSync(sourceAbsolute, fs.constants.R_OK);
          } catch (err) {
            errors.push(
              new SkillWriteError(
                `Failed to read source ${file.sourcePath}: ${(err as Error).message}`,
              ),
            );
            continue;
          }

          try {
            // Создать промежуточные каталоги при необходимости
            const dir = path.dirname(destAbsolute);
            fs.mkdirSync(dir, { recursive: true });

            // Побайтовое копирование
            fs.copyFileSync(sourceAbsolute, destAbsolute);

            written.push(file.relativePath);
          } catch (err) {
            // Расширение 2b: ошибка записи целевого файла
            errors.push(
              new SkillWriteError(
                `Failed to write ${file.relativePath}: ${(err as Error).message}`,
              ),
            );
          }
        }
      }
    }

    return { written, errors };
  }
}
