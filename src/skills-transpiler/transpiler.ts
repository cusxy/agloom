/**
 * Skills Transpiler — основной класс.
 * Spec: docs/specs/skills-transpiler.md
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { discover } from "./discover.js";
import { SkillWriteError } from "./errors.js";
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
   */
  writeResults(results: SkillTranspileResult[]): SkillWriteResult {
    const written: string[] = [];
    const errors: SkillWriteError[] = [];

    for (const result of results) {
      // Шаг 1: проверить, что массив errors пуст
      // Расширение 1a: при наличии ошибок — пропустить запись
      if (result.errors.length > 0) {
        errors.push(
          new SkillWriteError(
            `Skipped ${result.agentId}: transpile errors present`,
          ),
        );
        continue;
      }

      // Шаг 2: для каждого файла побайтово скопировать
      for (const file of result.files) {
        const sourceAbsolute = path.join(this.projectRoot, file.sourcePath);
        const destAbsolute = path.join(this.projectRoot, file.relativePath);

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

          // Шаг 3: добавить путь в массив written
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

    return { written, errors };
  }
}
