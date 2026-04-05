/**
 * Permissions Transpiler — основной класс.
 * Spec: docs/specs/permissions-transpiler.md
 */

import * as fs from "node:fs";
import * as path from "node:path";
import yaml from "js-yaml";
import { DiscoverError, WriteError } from "./errors.js";
import { validatePermissionsContent } from "./validate.js";
import type { PermissionsAdapter, PermissionsCanonicalFile, TranspileResult, WriteResult } from "./types.js";

/**
 * Deep merge двух объектов. Позднее значение (source) перезаписывает target.
 * Для вложенных объектов — рекурсивный merge.
 */
function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      typeof result[key] === "object" &&
      result[key] !== null &&
      !Array.isArray(result[key]) &&
      typeof source[key] === "object" &&
      source[key] !== null &&
      !Array.isArray(source[key])
    ) {
      result[key] = deepMerge(result[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

export class PermissionsTranspiler {
  private readonly projectRoot: string;
  private readonly adapters: PermissionsAdapter[];
  private readonly agloomDir: string;

  constructor(projectRoot: string, adapters: PermissionsAdapter[], agloomDir: string = ".agloom") {
    this.projectRoot = projectRoot;
    this.adapters = adapters;
    this.agloomDir = agloomDir;
  }

  /**
   * Обнаруживает канонический permissions-файл в проекте.
   * Spec: § Обнаружение канонического файла
   */
  discover(): PermissionsCanonicalFile | null {
    const ymlPath = path.join(this.projectRoot, this.agloomDir, "permissions.yml");
    const jsonPath = path.join(this.projectRoot, this.agloomDir, "permissions.json");

    // Шаги 1-2: проверить наличие файлов
    const ymlExists = fs.existsSync(ymlPath);
    const jsonExists = fs.existsSync(jsonPath);

    // Расширение 3a: оба файла существуют
    if (ymlExists && jsonExists) {
      throw new DiscoverError(
        "Both .agloom/permissions.yml and .agloom/permissions.json exist. Remove one to resolve the conflict.",
      );
    }

    // Расширение 3b: ни один файл не обнаружен
    if (!ymlExists && !jsonExists) {
      return null;
    }

    const isYaml = ymlExists;
    const filePath = isYaml ? ymlPath : jsonPath;
    const relativePath = path.join(this.agloomDir, isYaml ? "permissions.yml" : "permissions.json");

    // Шаг 4: прочитать содержимое
    let raw: string;
    try {
      raw = fs.readFileSync(filePath, "utf-8");
    } catch (err) {
      // Расширение 4a
      throw new DiscoverError(`Failed to read ${relativePath}: ${(err as Error).message}`);
    }

    // Шаг 5: распарсить
    let parsed: unknown;
    if (isYaml) {
      try {
        parsed = yaml.load(raw);
      } catch (err) {
        // Расширение 5a
        throw new DiscoverError(`Failed to parse .agloom/permissions.yml: ${(err as Error).message}`);
      }
    } else {
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        // Расширение 5b
        throw new DiscoverError(`Failed to parse .agloom/permissions.json: ${(err as Error).message}`);
      }
    }

    // Шаг 6: сформировать PermissionsCanonicalFile
    return {
      relativePath,
      format: isYaml ? "yaml" : "json",
      content: parsed as PermissionsCanonicalFile["content"],
    };
  }

  /**
   * Выполняет полный цикл транспиляции для всех зарегистрированных адаптеров.
   * Spec: § Транспиляция
   */
  transpile(): TranspileResult[] {
    // Шаг 1: обнаружить канонический файл
    const canonicalFile = this.discover();

    // Расширение 1a: файл не обнаружен — пустой массив
    if (canonicalFile === null) {
      return [];
    }

    // Шаг 2: валидировать содержимое
    validatePermissionsContent(canonicalFile.content);

    // Шаг 3-4: для каждого адаптера вызвать transpile, собрать результаты
    const results: TranspileResult[] = [];

    for (const adapter of this.adapters) {
      try {
        const files = adapter.transpile(canonicalFile);
        results.push({
          agentId: adapter.agentId,
          files,
          errors: [],
        });
      } catch (err) {
        // Расширение 3a: адаптер выбросил исключение
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
    results: TranspileResult[],
    options?: {
      targetRoot?: string;
    },
  ): WriteResult {
    const written: string[] = [];
    const errors: WriteError[] = [];

    // Шаг 1-2: собрать файлы из результатов без ошибок
    // Шаг 3: дедупликация с deep merge для .json
    const mergedFiles = new Map<string, string>();

    for (const result of results) {
      // Расширение 1a: при наличии ошибок — пропустить, включить в errors
      if (result.errors.length > 0) {
        for (const err of result.errors) {
          errors.push(new WriteError(err.message));
        }
        continue;
      }

      for (const file of result.files) {
        if (mergedFiles.has(file.relativePath)) {
          // Deep merge для JSON
          if (file.relativePath.endsWith(".json")) {
            try {
              const existing = JSON.parse(mergedFiles.get(file.relativePath)!);
              const incoming = JSON.parse(file.content);
              const merged = deepMerge(existing, incoming);
              mergedFiles.set(file.relativePath, JSON.stringify(merged, null, 2) + "\n");
            } catch {
              // If parse fails, overwrite
              mergedFiles.set(file.relativePath, file.content);
            }
          } else {
            mergedFiles.set(file.relativePath, file.content);
          }
        } else {
          mergedFiles.set(file.relativePath, file.content);
        }
      }
    }

    // Шаг 4-5: для каждого файла — merge с существующим на диске, затем записать
    const effectiveRoot = options?.targetRoot ?? this.projectRoot;
    for (const [relativePath, content] of mergedFiles) {
      const absolutePath = path.join(effectiveRoot, relativePath);

      try {
        // Шаг 4: deep merge с существующим файлом на диске
        let finalContent = content;
        if (relativePath.endsWith(".json") && fs.existsSync(absolutePath)) {
          try {
            const existingRaw = fs.readFileSync(absolutePath, "utf-8");
            const existingParsed = JSON.parse(existingRaw);
            const incomingParsed = JSON.parse(content);
            const merged = deepMerge(existingParsed, incomingParsed);
            finalContent = JSON.stringify(merged, null, 2) + "\n";
          } catch {
            // Расширение 4a: невалидный JSON — перезаписать целиком
            finalContent = content;
          }
        }

        // Шаг 5: создать каталоги и записать
        const dir = path.dirname(absolutePath);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(absolutePath, finalContent, "utf-8");

        // Шаг 6: добавить путь
        written.push(relativePath);
      } catch (err) {
        // Расширение 5a: ошибка записи
        errors.push(new WriteError(`Failed to write ${relativePath}: ${(err as Error).message}`));
      }
    }

    return { written, errors };
  }
}
