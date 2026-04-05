/**
 * Resource Transpiler — основной класс.
 * Spec: docs/specs/docs-transpiler.md
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { discover } from "./discover.js";
import { ResourceWriteError } from "./errors.js";
import { interpolate, InterpolationError } from "../interpolation/index.js";
import type {
  ResourceAdapter,
  ResourceFile,
  ResourceTranspileResult,
  ResourceType,
  ResourceWriteResult,
} from "./types.js";

export class ResourceTranspiler {
  private readonly projectRoot: string;
  private readonly adapters: ResourceAdapter[];
  private readonly agloomDir: string;
  private readonly resourceType: ResourceType;

  constructor(projectRoot: string, adapters: ResourceAdapter[], agloomDir: string, resourceType: ResourceType) {
    this.projectRoot = projectRoot;
    this.adapters = adapters;
    this.agloomDir = agloomDir;
    this.resourceType = resourceType;
  }

  /**
   * Обнаруживает все файлы ресурсов в проекте.
   * Spec: § Обнаружение файлов ресурсов
   */
  discover(): ResourceFile[] {
    return discover(this.projectRoot, this.agloomDir, this.resourceType);
  }

  /**
   * Выполняет полный цикл транспиляции для всех зарегистрированных адаптеров.
   * Spec: § Транспиляция
   */
  transpile(): ResourceTranspileResult[] {
    // Шаг 1: обнаружить файлы ресурсов
    const files = this.discover();

    // Расширение 1a: ни одного файла — пустой массив
    if (files.length === 0) {
      return [];
    }

    // Шаг 2: для каждого адаптера выполнить маппинг путей
    const sourcePrefix = path.join(this.agloomDir, this.resourceType);
    const results: ResourceTranspileResult[] = [];

    for (const adapter of this.adapters) {
      const outputFiles = files.map((file) => {
        // Заменить префикс <agloomDir>/<resourceType>/ на <adapter.targetDir>/
        const suffix = file.relativePath.substring(sourcePrefix.length);
        const relativePath = adapter.targetDir + suffix;
        return {
          relativePath,
          sourcePath: file.relativePath,
        };
      });

      results.push({
        agentId: adapter.agentId,
        files: outputFiles,
        errors: [],
      });
    }

    return results;
  }

  /**
   * Записывает результаты транспиляции в файловую систему.
   * Spec: § Запись результатов
   */
  writeResults(
    results: ResourceTranspileResult[],
    options?: {
      targetRoot?: string;
      variablesByAgentId?: Record<string, Record<string, string>>;
      valuesByAgentId?: Record<string, Record<string, string>>;
    },
  ): ResourceWriteResult {
    const variablesByAgentId = options?.variablesByAgentId;
    const valuesByAgentId = options?.valuesByAgentId;
    const writeRoot = options?.targetRoot ?? this.projectRoot;

    const written: string[] = [];
    const errors: ResourceWriteError[] = [];

    for (const result of results) {
      // Шаг 1: проверить, что массив errors пуст
      // Расширение 1a: при наличии ошибок — пропустить запись
      if (result.errors.length > 0) {
        errors.push(new ResourceWriteError(`Skipped ${result.agentId}: transpile errors present`));
        continue;
      }

      // Расширение 3a: variablesByAgentId передан, но ключ agentId отсутствует
      if (variablesByAgentId !== undefined && !(result.agentId in variablesByAgentId)) {
        errors.push(new ResourceWriteError(`No interpolation variables for adapter: ${result.agentId}`));
        continue;
      }

      // Шаг 3: для каждого файла
      for (const file of result.files) {
        const sourceAbsolute = path.join(this.projectRoot, file.sourcePath);
        const destAbsolute = path.join(writeRoot, file.relativePath);

        // Определить, нужна ли интерполяция для данного файла
        const isMd = path.extname(file.sourcePath).toLowerCase() === ".md";
        const shouldInterpolate = (variablesByAgentId !== undefined || valuesByAgentId !== undefined) && isMd;

        if (shouldInterpolate) {
          // Интерполяция .md файлов
          try {
            const content = fs.readFileSync(sourceAbsolute, "utf-8");
            const interpolated = interpolate(
              content,
              variablesByAgentId?.[result.agentId] ?? {},
              undefined,
              valuesByAgentId?.[result.agentId],
            );

            // Создать промежуточные каталоги при необходимости
            const dir = path.dirname(destAbsolute);
            fs.mkdirSync(dir, { recursive: true });

            fs.writeFileSync(destAbsolute, interpolated, "utf-8");
            written.push(file.relativePath);
          } catch (err) {
            // Расширение 3b: InterpolationError → ResourceWriteError
            if (err instanceof InterpolationError) {
              errors.push(new ResourceWriteError(`Interpolation failed for ${file.sourcePath}: ${err.message}`));
              continue;
            }
            // Расширение 3c/3d: ошибка чтения или записи
            errors.push(new ResourceWriteError(`Failed to write ${file.relativePath}: ${(err as Error).message}`));
          }
        } else {
          // Побайтовое копирование

          // Расширение 3c: исходный файл не существует или недоступен
          try {
            fs.accessSync(sourceAbsolute, fs.constants.R_OK);
          } catch (err) {
            errors.push(new ResourceWriteError(`Failed to read source ${file.sourcePath}: ${(err as Error).message}`));
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
            // Расширение 3d: ошибка записи целевого файла
            errors.push(new ResourceWriteError(`Failed to write ${file.relativePath}: ${(err as Error).message}`));
          }
        }
      }
    }

    return { written, errors };
  }
}
