/**
 * Шаг provider overlay — копирование agent-специфичных файлов из overlays/.
 * Spec: docs/specs/provider-overlay.md § Операция overlay
 * Spec: docs/specs/layer-model.md § Модель слоёв
 */

import * as fs from "node:fs";
import * as path from "node:path";
import yaml from "js-yaml";
import * as jsonc from "jsonc-parser";
import * as TOML from "smol-toml";
import type { AdapterRegistryEntry, TranspilerStepOutcome } from "./types.js";
import { interpolate, InterpolationError } from "../interpolation/index.js";

/**
 * Whitelist расширений для интерполяции.
 * Spec: docs/specs/provider-overlay.md § Whitelist расширений для интерполяции
 */
const INTERPOLATABLE_EXTENSIONS = [
  ".md",
  ".txt",
  ".json",
  ".jsonc",
  ".jsonl",
  ".xml",
  ".html",
  ".svg",
  ".toml",
  ".yml",
  ".yaml",
];

/**
 * Merge-eligible расширения (case-insensitive).
 * Spec: docs/specs/layer-model.md § Merge-eligible форматы
 */
const MERGE_ELIGIBLE_EXTENSIONS = [".json", ".jsonc", ".yaml", ".yml", ".toml"];

/** Тип источника слоя. */
export interface LayerSource {
  /** Идентификатор источника (имя плагина или "local"). */
  id: string;
  /** Абсолютный путь к директории overlay данного источника. */
  overlayDir: string;
}

/** Параметры шага overlay. */
interface OverlayStepParams {
  /** Запись адаптера из реестра. */
  entry: AdapterRegistryEntry;
  /** Абсолютный путь к корню проекта. */
  projectRoot: string;
  /** Карта agloom-переменных. Если передан, интерполяция выполняется для файлов из whitelist. */
  variables?: Record<string, string>;
  /** Объект окружения для разрешения ${env:VAR}. */
  env?: Record<string, string | undefined>;
  /** Упорядоченный список источников слоёв. Последний элемент имеет наивысший приоритет. */
  layers?: LayerSource[];
}

/**
 * Классифицирует файл по стратегии слияния.
 * Spec: docs/specs/layer-model.md § Определение стратегии для конкретного файла
 *
 * @returns "overlay" для merge-eligible файлов без .override, "override" для остальных.
 */
export function classifyFile(filename: string): "overlay" | "override" {
  const basename = path.basename(filename);

  // Правило 1: суффикс .override → override
  if (hasOverrideSuffix(basename)) {
    return "override";
  }

  // Правило 2: merge-eligible расширение → overlay
  const ext = path.extname(basename).toLowerCase();
  if (MERGE_ELIGIBLE_EXTENSIONS.includes(ext)) {
    return "overlay";
  }

  // Правило 3: всё остальное → override
  return "override";
}

/**
 * Проверяет наличие суффикса .override перед финальным расширением.
 */
function hasOverrideSuffix(filename: string): boolean {
  const ext = path.extname(filename);
  if (!ext) return false;
  const withoutExt = filename.slice(0, -ext.length);
  return withoutExt.endsWith(".override");
}

/**
 * Удаляет суффикс .override из имени файла (или пути).
 * Spec: docs/specs/layer-model.md § Удаление суффикса при записи
 */
export function stripOverrideSuffix(filePath: string): string {
  const dir = path.dirname(filePath);
  const basename = path.basename(filePath);
  const ext = path.extname(basename);

  if (!ext) return filePath;

  const withoutExt = basename.slice(0, -ext.length);
  if (!withoutExt.endsWith(".override")) return filePath;

  const stripped = withoutExt.slice(0, -".override".length) + ext;
  return dir === "." ? stripped : path.join(dir, stripped);
}

/**
 * Рекурсивный deep merge двух объектов.
 * Spec: docs/specs/layer-model.md § Алгоритм deep merge
 */
export function deepMerge(
  base: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };

  for (const key of Object.keys(incoming)) {
    const incomingVal = incoming[key];

    // Правило 3: null → удалить ключ
    if (incomingVal === null) {
      delete result[key];
      continue;
    }

    // Правило 2: incoming — массив → полная замена
    if (Array.isArray(incomingVal)) {
      result[key] = incomingVal;
      continue;
    }

    // Правило 1/5: incoming — объект
    if (isPlainObject(incomingVal)) {
      const baseVal = result[key];
      if (isPlainObject(baseVal)) {
        // Правило 1: оба объекта → рекурсия
        result[key] = deepMerge(
          baseVal as Record<string, unknown>,
          incomingVal as Record<string, unknown>,
        );
      } else {
        // Правило 5: base не объект → замена
        result[key] = incomingVal;
      }
      continue;
    }

    // Правило 4: скалярные значения → last-writer-wins
    result[key] = incomingVal;
  }

  return result;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Парсит содержимое файла в соответствии с расширением.
 * Spec: docs/specs/layer-model.md § Парсинг файлов для merge
 */
function parseContent(
  content: string,
  ext: string,
): Record<string, unknown> | null {
  const lower = ext.toLowerCase();
  switch (lower) {
    case ".json":
      return JSON.parse(content) as Record<string, unknown>;
    case ".jsonc":
      return jsonc.parse(content) as Record<string, unknown>;
    case ".yaml":
    case ".yml":
      return (yaml.load(content) as Record<string, unknown>) ?? {};
    case ".toml":
      return TOML.parse(content) as unknown as Record<string, unknown>;
    default:
      return null;
  }
}

/**
 * Сериализует объект в формат, соответствующий расширению.
 */
function serializeContent(data: Record<string, unknown>, ext: string): string {
  const lower = ext.toLowerCase();
  switch (lower) {
    case ".json":
    case ".jsonc":
      return JSON.stringify(data, null, 2);
    case ".yaml":
    case ".yml":
      return yaml.dump(data);
    case ".toml":
      return TOML.stringify(data as TOML.TomlPrimitive);
    default:
      return JSON.stringify(data, null, 2);
  }
}

/**
 * Рекурсивно обнаруживает все файлы в директории.
 * Возвращает массив абсолютных путей к файлам.
 */
function discoverFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...discoverFiles(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Выполняет шаг provider overlay.
 * Поддерживает multi-layer режим (параметр layers) и режим обратной совместимости.
 *
 * Spec: docs/specs/provider-overlay.md § Операция overlay
 * Spec: docs/specs/layer-model.md § Рефакторинг операции overlay
 */
export function runOverlayStep(
  params: OverlayStepParams,
): TranspilerStepOutcome {
  const { entry, projectRoot, variables, env, layers } = params;

  // Если layers передан — используем multi-layer режим
  if (layers !== undefined) {
    return runMultiLayerOverlay(entry, projectRoot, layers, variables, env);
  }

  // Режим обратной совместимости: единственный источник — .agloom/overlays/<entry.id>/
  return runLegacyOverlay(entry, projectRoot, variables, env);
}

/**
 * Legacy overlay: single-source bytewise copy with optional interpolation.
 * Backward-compatible behavior from docs/specs/provider-overlay.md.
 */
function runLegacyOverlay(
  entry: AdapterRegistryEntry,
  projectRoot: string,
  variables?: Record<string, string>,
  env?: Record<string, string | undefined>,
): TranspilerStepOutcome {
  const errors: string[] = [];
  let writtenCount = 0;

  const sourceDir = path.join(projectRoot, ".agloom", "overlays", entry.id);

  if (!fs.existsSync(sourceDir)) {
    return { name: "Overlay", writtenCount: 0, errors: [] };
  }

  let files: string[];
  try {
    files = discoverFiles(sourceDir);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { name: "Overlay", writtenCount: 0, errors: [error.message] };
  }

  for (const filePath of files) {
    const relativePath = path.relative(sourceDir, filePath);
    const targetPath = path.join(projectRoot, relativePath);
    const targetDir = path.dirname(targetPath);

    try {
      fs.mkdirSync(targetDir, { recursive: true });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      errors.push(error.message);
      continue;
    }

    const ext = path.extname(filePath).toLowerCase();
    const shouldInterpolate =
      variables !== undefined && INTERPOLATABLE_EXTENSIONS.includes(ext);

    if (shouldInterpolate) {
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const result = interpolate(content, variables, env);
        fs.writeFileSync(targetPath, result, "utf-8");
        writtenCount++;
      } catch (err) {
        if (err instanceof InterpolationError) {
          errors.push(
            `Interpolation failed for ${relativePath}: ${err.message}`,
          );
        } else {
          const error = err instanceof Error ? err : new Error(String(err));
          errors.push(error.message);
        }
      }
    } else {
      try {
        fs.copyFileSync(filePath, targetPath);
        writtenCount++;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        errors.push(error.message);
      }
    }
  }

  return { name: "Overlay", writtenCount, errors };
}

/**
 * Multi-layer overlay: последовательная обработка нескольких слоёв.
 * Spec: docs/specs/layer-model.md § Изменения в поведении
 */
function runMultiLayerOverlay(
  _entry: AdapterRegistryEntry,
  projectRoot: string,
  layers: LayerSource[],
  variables?: Record<string, string>,
  env?: Record<string, string | undefined>,
): TranspilerStepOutcome {
  const errors: string[] = [];

  // Шаг 1: инициализировать mergeState
  // Значение: parsed object для merge-eligible, или { __override: true, content, sourcePath } для override
  const mergeState = new Map<
    string,
    | { type: "merged"; data: Record<string, unknown>; ext: string }
    | { type: "override"; content: string | null; sourcePath: string | null }
  >();

  // Шаг 2: для каждого слоя
  for (const layer of layers) {
    // Расширение 2.2a: директория-источник не существует → пропустить
    if (!fs.existsSync(layer.overlayDir)) {
      continue;
    }

    // Шаг 2.2: рекурсивно обнаружить файлы
    let files: string[];
    try {
      files = discoverFiles(layer.overlayDir);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      errors.push(error.message);
      continue;
    }

    for (const filePath of files) {
      // Шаг 2.3: относительный путь внутри директории-источника
      const relativePath = path.relative(layer.overlayDir, filePath);

      // Шаг 2.4: целевой относительный путь (с удалением .override)
      const targetRelativePath = stripOverrideSuffix(relativePath);

      // Шаг 2.5: определить стратегию
      const strategy = classifyFile(relativePath);

      // Шаг 2.6: интерполяция
      const ext = path.extname(filePath).toLowerCase();
      const shouldInterpolate =
        variables !== undefined && INTERPOLATABLE_EXTENSIONS.includes(ext);

      let content: string | null = null;

      if (shouldInterpolate || strategy === "overlay") {
        // Нужно прочитать файл как текст
        try {
          content = fs.readFileSync(filePath, "utf-8");
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          errors.push(error.message);
          continue;
        }

        if (shouldInterpolate) {
          try {
            content = interpolate(content, variables!, env);
          } catch (err) {
            if (err instanceof InterpolationError) {
              // Расширение 2.6a
              errors.push(
                `Interpolation failed for ${layer.id}:${relativePath}: ${err.message}`,
              );
              continue;
            }
            throw err;
          }
        }
      }

      // Шаг 2.7: merge-eligible → deep merge
      if (strategy === "overlay") {
        const fileExt = path.extname(relativePath).toLowerCase();
        let parsed: Record<string, unknown>;
        try {
          const result = parseContent(content!, fileExt);
          if (result === null) {
            // Should not happen for merge-eligible files, but handle gracefully
            errors.push(
              `Parse failed for ${layer.id}:${relativePath}: unsupported format`,
            );
            continue;
          }
          parsed = result;
        } catch (err) {
          // Расширение 2.7a
          const error = err instanceof Error ? err : new Error(String(err));
          errors.push(
            `Parse failed for ${layer.id}:${relativePath}: ${error.message}`,
          );
          continue;
        }

        const existing = mergeState.get(targetRelativePath);
        if (existing && existing.type === "merged") {
          // Merge with existing mergeState
          mergeState.set(targetRelativePath, {
            type: "merged",
            data: deepMerge(existing.data, parsed),
            ext: fileExt,
          });
        } else {
          // No mergeState entry yet — try to merge with existing target file
          const targetPath = path.join(projectRoot, targetRelativePath);
          let baseData: Record<string, unknown> = {};
          if (
            !existing &&
            fs.existsSync(targetPath) &&
            fs.statSync(targetPath).isFile()
          ) {
            try {
              const existingContent = fs.readFileSync(targetPath, "utf-8");
              const existingParsed = parseContent(existingContent, fileExt);
              if (existingParsed) {
                baseData = existingParsed;
              }
            } catch {
              // If we can't parse the existing file, start fresh
            }
          }
          mergeState.set(targetRelativePath, {
            type: "merged",
            data: deepMerge(baseData, parsed),
            ext: fileExt,
          });
        }
      } else {
        // Шаг 2.8: override — сохранить содержимое или путь к файлу
        if (content !== null) {
          mergeState.set(targetRelativePath, {
            type: "override",
            content,
            sourcePath: null,
          });
        } else {
          // Binary file — store source path for bytewise copy
          mergeState.set(targetRelativePath, {
            type: "override",
            content: null,
            sourcePath: filePath,
          });
        }
      }
    }
  }

  // Шаг 3: записать результаты
  let writtenCount = 0;

  for (const [targetRelativePath, state] of mergeState) {
    const targetPath = path.join(projectRoot, targetRelativePath);

    // Шаг 3.2: создать промежуточные каталоги
    try {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    } catch (err) {
      // Расширение 3.2a
      const error = err instanceof Error ? err : new Error(String(err));
      errors.push(error.message);
      continue;
    }

    // Шаг 3.3: записать
    try {
      if (state.type === "merged") {
        const serialized = serializeContent(state.data, state.ext);
        fs.writeFileSync(targetPath, serialized, "utf-8");
      } else if (state.content !== null) {
        fs.writeFileSync(targetPath, state.content, "utf-8");
      } else if (state.sourcePath !== null) {
        fs.copyFileSync(state.sourcePath, targetPath);
      }
      writtenCount++;
    } catch (err) {
      // Расширение 3.3a
      const error = err instanceof Error ? err : new Error(String(err));
      errors.push(error.message);
    }
  }

  // Шаг 4: TranspilerStepOutcome
  return { name: "Overlay", writtenCount, errors };
}
