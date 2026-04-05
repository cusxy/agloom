/**
 * Commands Transpiler — основной класс.
 * Spec: docs/specs/commands-transpiler.md
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { discover } from "./discover.js";
import { CommandWriteError } from "./errors.js";
import { interpolate, InterpolationError } from "../interpolation/index.js";
import type { CommandAdapter, CommandDefinition, CommandTranspileResult, CommandWriteResult } from "./types.js";

export class CommandsTranspiler {
  private readonly projectRoot: string;
  private readonly adapters: CommandAdapter[];
  private readonly agloomDir: string;

  constructor(projectRoot: string, adapters: CommandAdapter[], agloomDir: string = ".agloom") {
    this.projectRoot = projectRoot;
    this.adapters = adapters;
    this.agloomDir = agloomDir;
  }

  /**
   * Обнаруживает все определения команд в проекте.
   * Spec: § Обнаружение определений команд
   */
  discover(): CommandDefinition[] {
    return discover(this.projectRoot, this.agloomDir);
  }

  /**
   * Выполняет полный цикл транспиляции для всех зарегистрированных адаптеров.
   * Spec: § Транспиляция
   */
  transpile(): CommandTranspileResult[] {
    // Шаг 1: обнаружить определения команд
    const definitions = this.discover();

    // Расширение 1a: ни одного определения — пустой массив
    if (definitions.length === 0) {
      return [];
    }

    // Шаг 2: для каждого адаптера вызвать transpile(definitions)
    // Шаг 3: ремаппинг relativePath
    // Шаг 4: собрать результаты
    const sourcePrefix = path.join(this.agloomDir, "commands");
    const results: CommandTranspileResult[] = [];

    for (const adapter of this.adapters) {
      try {
        const files = adapter.transpile(definitions);

        // Шаг 3: ремаппинг relativePath для каждого CommandOutputFile
        const remappedFiles = files.map((file) => {
          const suffix = file.relativePath.substring(sourcePrefix.length);
          const relativePath = adapter.targetDir + suffix;
          return { ...file, relativePath };
        });

        results.push({
          agentId: adapter.agentId,
          files: remappedFiles,
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
  writeResults(
    results: CommandTranspileResult[],
    options?: {
      targetRoot?: string;
      variablesByAgentId?: Record<string, Record<string, string>>;
    },
  ): CommandWriteResult {
    const writeRoot = options?.targetRoot ?? this.projectRoot;
    const variablesByAgentId = options?.variablesByAgentId;
    const written: string[] = [];
    const errors: CommandWriteError[] = [];

    for (const result of results) {
      // Шаг 1: проверить, что массив errors пуст
      // Расширение 1a: при наличии ошибок — пропустить запись
      if (result.errors.length > 0) {
        for (const err of result.errors) {
          errors.push(new CommandWriteError(err.message));
        }
        continue;
      }

      // Расширение 3b: variablesByAgentId передан, но ключ agentId отсутствует
      if (variablesByAgentId !== undefined && !(result.agentId in variablesByAgentId)) {
        errors.push(new CommandWriteError(`No interpolation variables for adapter: ${result.agentId}`));
        continue;
      }

      // Шаг 3: записать каждый файл
      for (const file of result.files) {
        const absolutePath = path.join(writeRoot, file.relativePath);

        try {
          // Создать промежуточные каталоги при необходимости
          const dir = path.dirname(absolutePath);
          fs.mkdirSync(dir, { recursive: true });

          let content = file.content;

          // Интерполяция для .md файлов при наличии variablesByAgentId
          if (variablesByAgentId !== undefined && file.relativePath.toLowerCase().endsWith(".md")) {
            try {
              content = interpolate(content, variablesByAgentId[result.agentId]);
            } catch (err) {
              if (err instanceof InterpolationError) {
                errors.push(new CommandWriteError(`Interpolation failed for ${file.relativePath}: ${err.message}`));
                continue;
              }
              throw err;
            }
          }

          // Записать файл с кодировкой UTF-8
          fs.writeFileSync(absolutePath, content, "utf-8");

          written.push(file.relativePath);
        } catch (err) {
          // Расширение 3a: ошибка записи
          if (err instanceof CommandWriteError) {
            // Already handled above (interpolation error)
            continue;
          }
          errors.push(new CommandWriteError(`Failed to write ${file.relativePath}: ${(err as Error).message}`));
        }
      }
    }

    return { written, errors };
  }
}
