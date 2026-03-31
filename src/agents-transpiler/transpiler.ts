/**
 * Agents Transpiler — основной класс.
 * Spec: docs/specs/agents-transpiler.md
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { discover } from "./discover.js";
import { AgentWriteError } from "./errors.js";
import type {
  AgentAdapter,
  AgentDefinition,
  AgentTranspileResult,
  AgentWriteResult,
} from "./types.js";

export class AgentsTranspiler {
  private readonly projectRoot: string;
  private readonly adapters: AgentAdapter[];

  constructor(projectRoot: string, adapters: AgentAdapter[]) {
    this.projectRoot = projectRoot;
    this.adapters = adapters;
  }

  /**
   * Обнаруживает все определения агентов в проекте.
   * Spec: § Обнаружение определений агентов
   */
  discover(): AgentDefinition[] {
    return discover(this.projectRoot);
  }

  /**
   * Выполняет полный цикл транспиляции для всех зарегистрированных адаптеров.
   * Spec: § Транспиляция
   */
  transpile(): AgentTranspileResult[] {
    // Шаг 1: обнаружить определения агентов
    const definitions = this.discover();

    // Расширение 1a: ни одного определения — пустой массив
    if (definitions.length === 0) {
      return [];
    }

    // Шаг 2: для каждого адаптера вызвать transpile(definitions)
    // Шаг 3: собрать результаты
    const results: AgentTranspileResult[] = [];

    for (const adapter of this.adapters) {
      try {
        const files = adapter.transpile(definitions);
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
  writeResults(results: AgentTranspileResult[]): AgentWriteResult {
    const written: string[] = [];
    const errors: AgentWriteError[] = [];

    for (const result of results) {
      // Шаг 1: проверить, что массив errors пуст
      // Расширение 1a: при наличии ошибок — пропустить запись
      if (result.errors.length > 0) {
        for (const err of result.errors) {
          errors.push(new AgentWriteError(err.message));
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
            new AgentWriteError(
              `Failed to write ${file.relativePath}: ${(err as Error).message}`,
            ),
          );
        }
      }
    }

    return { written, errors };
  }
}
