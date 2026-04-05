/**
 * MCP Transpiler — основной класс.
 * Spec: docs/specs/mcp-transpiler.md
 */

import * as fs from "node:fs";
import * as path from "node:path";
import yaml from "js-yaml";
import { interpolate } from "../interpolation/index.js";
import { DiscoverError, WriteError } from "./errors.js";
import { validateCanonicalContent } from "./validate.js";
import type { McpAdapter, McpCanonicalFile, TranspileResult, WriteResult } from "./types.js";

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

export class McpTranspiler {
  private readonly projectRoot: string;
  private readonly adapters: McpAdapter[];
  private readonly agloomDir: string;

  constructor(projectRoot: string, adapters: McpAdapter[], agloomDir: string = ".agloom") {
    this.projectRoot = projectRoot;
    this.adapters = adapters;
    this.agloomDir = agloomDir;
  }

  /**
   * Обнаруживает канонический MCP-файл в проекте.
   * Spec: § Обнаружение канонического файла
   */
  discover(): McpCanonicalFile | null {
    const ymlPath = path.join(this.projectRoot, this.agloomDir, "mcp.yml");
    const jsonPath = path.join(this.projectRoot, this.agloomDir, "mcp.json");

    // Шаги 1-2: проверить наличие файлов
    const ymlExists = fs.existsSync(ymlPath);
    const jsonExists = fs.existsSync(jsonPath);

    // Расширение 3a: оба файла существуют
    if (ymlExists && jsonExists) {
      const dir = this.agloomDir;
      throw new DiscoverError(`Both ${dir}/mcp.yml and ${dir}/mcp.json exist. Remove one to resolve the conflict.`);
    }

    // Расширение 3b: ни один файл не обнаружен
    if (!ymlExists && !jsonExists) {
      return null;
    }

    const isYaml = ymlExists;
    const filePath = isYaml ? ymlPath : jsonPath;
    const relativePath = path.join(this.agloomDir, isYaml ? "mcp.yml" : "mcp.json");

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
        throw new DiscoverError(`Failed to parse .agloom/mcp.yml: ${(err as Error).message}`);
      }
    } else {
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        // Расширение 5b
        throw new DiscoverError(`Failed to parse .agloom/mcp.json: ${(err as Error).message}`);
      }
    }

    // Шаг 6: сформировать McpCanonicalFile
    return {
      relativePath,
      format: isYaml ? "yaml" : "json",
      content: parsed as McpCanonicalFile["content"],
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
    validateCanonicalContent(canonicalFile.content);

    // Шаг 3: Интерполяция отложена до writeResults, где доступны
    // variablesByAgentId и valuesByAgentId. Здесь не выполняется.

    // Шаги 4-5: для каждого адаптера вызвать transpile, собрать результаты
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
        // Расширение 4a: адаптер выбросил исключение
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
      variablesByAgentId?: Record<string, Record<string, string>>;
      valuesByAgentId?: Record<string, Record<string, string>>;
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

      // Resolve variables and values for this adapter's agentId
      const vars = options?.variablesByAgentId?.[result.agentId] ?? {};
      const vals = options?.valuesByAgentId?.[result.agentId] ?? {};

      for (const rawFile of result.files) {
        // Interpolate content with agloom vars, env, and values
        let interpolatedContent: string;
        try {
          interpolatedContent = interpolate(rawFile.content, vars, undefined, vals);
        } catch (err) {
          errors.push(new WriteError(`Interpolation failed for ${rawFile.relativePath}: ${(err as Error).message}`));
          continue;
        }
        const file = { ...rawFile, content: interpolatedContent };
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
