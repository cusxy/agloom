/**
 * Instructions Transpiler — основной класс.
 * Spec: docs/specs/instructions-transpiler.md
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { discover } from "./discover.js";
import { WriteError } from "./errors.js";
import type {
  Adapter,
  CanonicalFile,
  TranspileResult,
  WriteResult,
} from "./types.js";

export class InstructionsTranspiler {
  private readonly projectRoot: string;
  private readonly adapters: Adapter[];

  constructor(projectRoot: string, adapters: Adapter[]) {
    this.projectRoot = projectRoot;
    this.adapters = adapters;
  }

  /**
   * Обнаруживает все канонические файлы в проекте.
   * Spec: § Обнаружение канонических файлов
   */
  discover(): CanonicalFile[] {
    return discover(this.projectRoot);
  }

  /**
   * Выполняет полный цикл транспиляции для всех зарегистрированных адаптеров.
   * Spec: § Транспиляция
   */
  transpile(): TranspileResult[] {
    // Шаг 1: обнаружить канонические файлы
    const canonicalFiles = this.discover();

    // Расширение 1a: ни одного файла — пустой массив
    if (canonicalFiles.length === 0) {
      return [];
    }

    // Шаг 2: для каждого адаптера вызвать transpile(files)
    // Шаг 3: собрать результаты
    const results: TranspileResult[] = [];

    for (const adapter of this.adapters) {
      try {
        const files = adapter.transpile(canonicalFiles);
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
  writeResults(results: TranspileResult[]): WriteResult {
    const written: string[] = [];
    const errors: WriteError[] = [];

    for (const result of results) {
      // Шаг 1: проверить, что массив errors пуст
      // Расширение 1a: при наличии ошибок — пропустить запись, включить в errors
      if (result.errors.length > 0) {
        for (const err of result.errors) {
          errors.push(new WriteError(err.message));
        }
        continue;
      }

      // Шаг 2: записать каждый файл
      for (const file of result.files) {
        const absolutePath = path.join(this.projectRoot, file.relativePath);

        try {
          // Создать промежуточные каталоги при необходимости
          const dir = path.dirname(absolutePath);
          fs.mkdirSync(dir, { recursive: true });

          // Записать файл с кодировкой UTF-8
          fs.writeFileSync(absolutePath, file.content, "utf-8");

          // Шаг 3: добавить путь в массив written
          written.push(file.relativePath);
        } catch (err) {
          // Расширение 2a: ошибка записи
          errors.push(
            new WriteError(
              `Failed to write ${file.relativePath}: ${(err as Error).message}`,
            ),
          );
        }
      }
    }

    return { written, errors };
  }
}
