/**
 * Шаг provider overlay — копирование agent-специфичных файлов из overlays/.
 * Spec: docs/specs/provider-overlay.md § Операция overlay
 * Spec: docs/specs/layer-model.md § Модель слоёв
 */

import * as fs from "node:fs";
import * as path from "node:path";
import yaml from "js-yaml";
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
  /** Resolved values для интерполяции ${values:*} данного слоя. */
  values?: Record<string, string>;
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
  /** Resolved values для интерполяции ${values:*} (legacy mode). */
  values?: Record<string, string>;
}

/**
 * Классифицирует файл по стратегии слияния.
 * Spec: docs/specs/layer-model.md § Определение стратегии для конкретного файла
 * Spec: docs/specs/patch-mechanism.md § Определение стратегии для конкретного файла
 *
 * @returns "overlay" для merge-eligible файлов без .override/.patch,
 *          "patch" для файлов с .patch и merge-eligible расширением,
 *          "override" для остальных.
 */
export function classifyFile(filename: string): "overlay" | "override" | "patch" {
  const basename = path.basename(filename);

  // Правило 1: суффикс .override → override
  if (hasOverrideSuffix(basename)) {
    return "override";
  }

  // Правило 2: суффикс .patch + merge-eligible расширение → patch
  const ext = path.extname(basename).toLowerCase();
  if (hasPatchSuffix(basename) && MERGE_ELIGIBLE_EXTENSIONS.includes(ext)) {
    return "patch";
  }

  // Правило 3: merge-eligible расширение → overlay
  if (MERGE_ELIGIBLE_EXTENSIONS.includes(ext)) {
    return "overlay";
  }

  // Правило 4: всё остальное → override
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
 * Проверяет наличие суффикса .patch перед финальным расширением.
 * Spec: docs/specs/patch-mechanism.md § Обнаружение суффикса
 */
function hasPatchSuffix(filename: string): boolean {
  const ext = path.extname(filename);
  if (!ext) return false;
  const withoutExt = filename.slice(0, -ext.length);
  return withoutExt.endsWith(".patch");
}

/**
 * Проверяет наличие обоих суффиксов .patch и .override в имени файла.
 * Spec: docs/specs/patch-mechanism.md § Взаимоисключаемость с .override
 */
function hasBothPatchAndOverride(filename: string): boolean {
  const basename = path.basename(filename);
  const ext = path.extname(basename);
  if (!ext) return false;
  const withoutExt = basename.slice(0, -ext.length);
  return (
    (withoutExt.includes(".patch") && withoutExt.includes(".override")) ||
    (withoutExt.endsWith(".patch") && withoutExt.includes(".override")) ||
    (withoutExt.endsWith(".override") && withoutExt.includes(".patch"))
  );
}

/**
 * Удаляет суффикс .override или .patch из имени файла (или пути).
 * Spec: docs/specs/layer-model.md § Удаление суффикса при записи
 * Spec: docs/specs/patch-mechanism.md § Удаление суффикса при записи
 */
export function stripOverrideSuffix(filePath: string): string {
  const dir = path.dirname(filePath);
  const basename = path.basename(filePath);
  const ext = path.extname(basename);

  if (!ext) return filePath;

  const withoutExt = basename.slice(0, -ext.length);

  if (withoutExt.endsWith(".override")) {
    const stripped = withoutExt.slice(0, -".override".length) + ext;
    return dir === "." ? stripped : path.join(dir, stripped);
  }

  if (withoutExt.endsWith(".patch")) {
    const stripped = withoutExt.slice(0, -".patch".length) + ext;
    return dir === "." ? stripped : path.join(dir, stripped);
  }

  return filePath;
}

/**
 * Контекст deep merge для активации специальных правил (например, union-merge
 * для permission-массивов в .claude/settings.json).
 *
 * Spec: docs/specs/layer-model.md § Union-merge для permission-ключей
 */
export interface DeepMergeContext {
  /** Относительный путь целевого файла (например, ".claude/settings.json"). */
  filePath?: string;
  /** Текущий JSON-path внутри документа, разделённый точками. Внутреннее поле. */
  jsonPath?: string;
}

/** Пути, для которых применяется union-merge вместо стандартной замены массивов. */
const UNION_MERGE_PATHS: Record<string, Set<string>> = {
  ".claude/settings.json": new Set(["permissions.allow", "permissions.deny"]),
};

/**
 * Проверяет, должен ли текущий (filePath, jsonPath) использовать union-merge.
 */
function shouldUnionMerge(context: DeepMergeContext | undefined): boolean {
  if (!context || !context.filePath || !context.jsonPath) return false;
  const pathsForFile = UNION_MERGE_PATHS[context.filePath];
  if (!pathsForFile) return false;
  return pathsForFile.has(context.jsonPath);
}

/**
 * Union-merge двух массивов примитивов с сохранением first-occurrence порядка.
 * Spec: docs/specs/layer-model.md § Алгоритм union-merge для массива
 */
function unionMergeArrays(base: unknown[], incoming: unknown[]): unknown[] {
  const merged: unknown[] = [...base];
  for (const item of incoming) {
    if (!merged.some((existing) => existing === item)) {
      merged.push(item);
    }
  }
  return merged;
}

/**
 * Рекурсивный deep merge двух объектов.
 * Spec: docs/specs/layer-model.md § Алгоритм deep merge
 *
 * @param context Опциональный контекст для активации union-merge на определённых
 *                JSON-путях конкретных файлов (например, permissions.allow
 *                в .claude/settings.json).
 */
export function deepMerge(
  base: Record<string, unknown>,
  incoming: Record<string, unknown>,
  context?: DeepMergeContext,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };

  for (const key of Object.keys(incoming)) {
    const incomingVal = incoming[key];
    const childJsonPath = context?.jsonPath ? `${context.jsonPath}.${key}` : key;
    const childContext: DeepMergeContext | undefined = context
      ? { filePath: context.filePath, jsonPath: childJsonPath }
      : undefined;

    // Правило 3: null → удалить ключ
    if (incomingVal === null) {
      delete result[key];
      continue;
    }

    // Правило 2 (+union-merge override): incoming — массив
    if (Array.isArray(incomingVal)) {
      const baseVal = result[key];
      if (Array.isArray(baseVal) && shouldUnionMerge(childContext)) {
        result[key] = unionMergeArrays(baseVal, incomingVal);
      } else {
        result[key] = incomingVal;
      }
      continue;
    }

    // Правило 1/5: incoming — объект
    if (isPlainObject(incomingVal)) {
      const baseVal = result[key];
      if (isPlainObject(baseVal)) {
        // Правило 1: оба объекта → рекурсия с пробросом контекста
        result[key] = deepMerge(
          baseVal as Record<string, unknown>,
          incomingVal as Record<string, unknown>,
          childContext,
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
function parseContent(content: string, ext: string): Record<string, unknown> | null {
  const lower = ext.toLowerCase();
  switch (lower) {
    case ".json":
    case ".jsonc":
      // Spec: docs/specs/layer-model.md § Парсинг файлов для merge
      // "Для .jsonc ТРЕБУЕТСЯ использовать стандартный JSON-парсер (JSON.parse)".
      // Невалидный JSON (например, с // комментариями) бросает → вызывающий код
      // игнорирует base и полностью перезаписывает файл.
      return JSON.parse(content) as Record<string, unknown>;
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

// =============================================================================
// Patch mechanism
// Spec: docs/specs/patch-mechanism.md
// =============================================================================

/** Known patch markers in application order. */
const PATCH_MARKERS = ["$unset", "$merge", "$mergeBy", "$set", "$remove", "$insertAt", "$prepend", "$append"] as const;

/** Set for O(1) lookup. */
const PATCH_MARKER_SET = new Set<string>(PATCH_MARKERS);

/**
 * Error class for patch validation errors.
 * Thrown by applyPatch on validation failures; caught by overlay-step integration.
 */
class PatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PatchError";
  }
}

/**
 * Deep equality check for $remove marker.
 * Spec: docs/specs/patch-mechanism.md § $remove — Поведение
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, i) => deepEqual(val, b[i]));
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) => key in (b as Record<string, unknown>) && deepEqual(a[key], b[key]));
  }

  return false;
}

/**
 * Checks if a plain object contains any key starting with `$`.
 */
function hasMarkerKeys(obj: Record<string, unknown>): boolean {
  return Object.keys(obj).some((k) => k.startsWith("$"));
}

/**
 * Validates forbidden marker combinations in a node.
 * Spec: docs/specs/patch-mechanism.md § Ограничения комбинаций
 */
function validateMarkerCombinations(markers: string[], nodePath: string): void {
  const markerSet = new Set(markers);
  if (markerSet.has("$set") && markerSet.has("$merge")) {
    throw new PatchError(`$set and $merge cannot be combined at '${nodePath}'`);
  }
  if (markerSet.has("$set") && markerSet.has("$mergeBy")) {
    throw new PatchError(`$set and $mergeBy cannot be combined at '${nodePath}'`);
  }
}

/**
 * Validates the value type of a marker.
 * Spec: docs/specs/patch-mechanism.md § Валидация типа значения маркера
 */
function validateMarkerValue(marker: string, value: unknown, nodePath: string): void {
  switch (marker) {
    case "$append":
      if (!Array.isArray(value)) throw new PatchError(`$append value must be array at '${nodePath}'`);
      break;
    case "$prepend":
      if (!Array.isArray(value)) throw new PatchError(`$prepend value must be array at '${nodePath}'`);
      break;
    case "$remove":
      if (!Array.isArray(value)) throw new PatchError(`$remove value must be array at '${nodePath}'`);
      break;
    case "$unset":
      if (!Array.isArray(value) || !value.every((v) => typeof v === "string"))
        throw new PatchError(`$unset value must be array of strings at '${nodePath}'`);
      break;
    case "$merge":
      if (!isPlainObject(value)) throw new PatchError(`$merge value must be object at '${nodePath}'`);
      break;
    case "$mergeBy":
      if (!isPlainObject(value)) throw new PatchError(`$mergeBy value must be object at '${nodePath}'`);
      {
        const obj = value as Record<string, unknown>;
        if (typeof obj.key !== "string") throw new PatchError(`$mergeBy key must be string at '${nodePath}'`);
        if (!Array.isArray(obj.items)) throw new PatchError(`$mergeBy items must be array at '${nodePath}'`);
        // Validate each item
        for (const item of obj.items as unknown[]) {
          if (!isPlainObject(item)) throw new PatchError(`$mergeBy items must contain objects at '${nodePath}'`);
          if (!((obj.key as string) in (item as Record<string, unknown>)))
            throw new PatchError(`$mergeBy item missing key field '${obj.key}' at '${nodePath}'`);
        }
      }
      break;
    case "$insertAt":
      if (!isPlainObject(value)) throw new PatchError(`$insertAt value must be object at '${nodePath}'`);
      {
        const obj = value as Record<string, unknown>;
        if (typeof obj.index !== "number" || !Number.isInteger(obj.index))
          throw new PatchError(`$insertAt index must be integer at '${nodePath}'`);
        if (!Array.isArray(obj.items)) throw new PatchError(`$insertAt items must be array at '${nodePath}'`);
      }
      break;
    // $set: any value is valid
  }
}

/**
 * Validates the target type for a marker.
 * Spec: docs/specs/patch-mechanism.md § Валидация целевого типа
 */
function validateTargetType(marker: string, base: unknown, nodePath: string): void {
  switch (marker) {
    case "$append":
    case "$prepend":
    case "$remove":
    case "$insertAt":
      if (!Array.isArray(base)) throw new PatchError(`${marker} requires array target at '${nodePath}'`);
      break;
    case "$unset":
      if (!isPlainObject(base)) throw new PatchError(`$unset requires object target at '${nodePath}'`);
      break;
    case "$mergeBy":
      if (!Array.isArray(base)) throw new PatchError(`$mergeBy requires array target at '${nodePath}'`);
      break;
  }
}

/**
 * Applies $mergeBy logic to an array.
 * Spec: docs/specs/patch-mechanism.md § $mergeBy — Поведение
 */
function applyMergeByToArray(arr: unknown[], mergeByVal: { key: string; items: Record<string, unknown>[] }): void {
  for (const incoming of mergeByVal.items) {
    const keyField = mergeByVal.key;
    const incomingKeyVal = incoming[keyField];
    let found = false;
    for (let i = 0; i < arr.length; i++) {
      const el = arr[i];
      // Skip non-objects (extension 1a/4d)
      if (!isPlainObject(el)) continue;
      const existing = el as Record<string, unknown>;
      if (existing[keyField] === incomingKeyVal) {
        arr[i] = deepMerge(existing, incoming);
        found = true;
        break;
      }
    }
    if (!found) {
      arr.push(incoming);
    }
  }
}

/**
 * Applies a single marker to a node.
 * Spec: docs/specs/patch-mechanism.md § Применение маркера к узлу
 */
function applyMarker(
  base: unknown,
  marker: string,
  value: unknown,
  parentKey: string,
  parent: Record<string, unknown>,
  nodePath: string,
): void {
  validateMarkerValue(marker, value, nodePath);

  switch (marker) {
    case "$set":
      parent[parentKey] = value;
      break;

    case "$unset": {
      const target = parent[parentKey];
      validateTargetType(marker, target, nodePath);
      const obj = target as Record<string, unknown>;
      for (const name of value as string[]) {
        delete obj[name];
      }
      break;
    }

    case "$merge": {
      const target = parent[parentKey];
      if (target === undefined) {
        parent[parentKey] = deepMerge({}, value as Record<string, unknown>);
      } else if (isPlainObject(target)) {
        parent[parentKey] = deepMerge(target as Record<string, unknown>, value as Record<string, unknown>);
      } else {
        // base is not object and not undefined — set to value
        parent[parentKey] = value;
      }
      break;
    }

    case "$mergeBy": {
      const mergeByVal = value as {
        key: string;
        items: Record<string, unknown>[];
      };
      const target = parent[parentKey];
      if (target === undefined) {
        // Create empty array, all items appended
        parent[parentKey] = [...mergeByVal.items];
        break;
      }
      // When target is an object (not array) and $merge is a sibling,
      // find array properties within the object and apply mergeBy to them.
      // Spec: "$merge applies to object-parent, $mergeBy to array-value"
      if (isPlainObject(target)) {
        const obj = target as Record<string, unknown>;
        for (const objKey of Object.keys(obj)) {
          if (!Array.isArray(obj[objKey])) continue;
          const arr = obj[objKey] as unknown[];
          // Check if this array contains objects with the key field
          const hasMatchingObjects = arr.some(
            (el) => isPlainObject(el) && mergeByVal.key in (el as Record<string, unknown>),
          );
          if (!hasMatchingObjects && arr.length > 0) continue;
          applyMergeByToArray(arr, mergeByVal);
        }
        break;
      }
      validateTargetType(marker, target, nodePath);
      applyMergeByToArray(target as unknown[], mergeByVal);
      break;
    }

    case "$remove": {
      const target = parent[parentKey];
      if (target === undefined) break; // silent no-op
      validateTargetType(marker, target, nodePath);
      const arr = target as unknown[];
      const toRemove = value as unknown[];
      parent[parentKey] = arr.filter((el) => !toRemove.some((r) => deepEqual(el, r)));
      break;
    }

    case "$insertAt": {
      const insertVal = value as { index: number; items: unknown[] };
      const target = parent[parentKey];
      validateTargetType(marker, target, nodePath);
      const arr = target as unknown[];
      // Normalize index
      let idx = insertVal.index;
      if (idx < 0) {
        idx = Math.max(0, arr.length + idx);
      } else if (idx > arr.length) {
        idx = arr.length;
      }
      arr.splice(idx, 0, ...insertVal.items);
      break;
    }

    case "$prepend": {
      const target = parent[parentKey];
      validateTargetType(marker, target, nodePath);
      const arr = target as unknown[];
      arr.unshift(...(value as unknown[]));
      break;
    }

    case "$append": {
      const target = parent[parentKey];
      validateTargetType(marker, target, nodePath);
      const arr = target as unknown[];
      arr.push(...(value as unknown[]));
      break;
    }
  }
}

/** Result of applyPatch including warnings for non-fatal issues. */
export interface ApplyPatchResult {
  result: Record<string, unknown>;
  warnings: string[];
}

/**
 * Applies patch operations to base object.
 * Spec: docs/specs/patch-mechanism.md § Процедура Apply Patch
 *
 * @param base Current state (parsed). undefined if target file doesn't exist.
 * @param patch Parsed patch file content.
 * @returns Modified base object (also accessible via .result for callers that need warnings).
 * @throws PatchError on validation failures.
 */
export function applyPatch(
  base: Record<string, unknown> | undefined,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const { result } = applyPatchWithWarnings(base, patch);
  return result;
}

/**
 * Applies patch operations and collects warnings.
 * Spec: docs/specs/patch-mechanism.md § Обработка несуществующего целевого поля
 */
function applyPatchWithWarnings(
  base: Record<string, unknown> | undefined,
  patch: Record<string, unknown>,
): ApplyPatchResult {
  // Step 1: if base is undefined, initialize as {}
  if (base === undefined) {
    base = {};
  }

  const warnings: string[] = [];
  applyPatchRecursive(base, patch, "root", { root: base }, "", warnings);
  return { result: base, warnings };
}

/**
 * Recursive patch application.
 */
function applyPatchRecursive(
  base: unknown,
  patch: Record<string, unknown>,
  parentKey: string,
  parent: Record<string, unknown>,
  pathPrefix: string,
  warnings: string[],
): void {
  // Collect markers and non-markers
  const markers: string[] = [];
  const navKeys: string[] = [];

  for (const key of Object.keys(patch)) {
    if (key.startsWith("$")) {
      // Check for unknown markers
      if (!PATCH_MARKER_SET.has(key)) {
        throw new PatchError(`Unknown patch marker '${key}' in ${pathPrefix || "root"}`);
      }
      markers.push(key);
    } else {
      navKeys.push(key);
    }
  }

  // Validate forbidden combinations
  if (markers.length > 0) {
    validateMarkerCombinations(markers, pathPrefix || "root");
  }

  // Apply markers in fixed order
  if (markers.length > 0) {
    for (const marker of PATCH_MARKERS) {
      if (!markers.includes(marker)) continue;
      const value = patch[marker];
      const currentVal = parent[parentKey];

      // Handle non-existing target fields
      // Spec: docs/specs/patch-mechanism.md § Обработка несуществующего целевого поля
      if (currentVal === undefined) {
        if (marker === "$append" || marker === "$prepend" || marker === "$insertAt") {
          // Warning: field does not exist, skip operation
          const fieldPath = pathPrefix || "root";
          warnings.push(`Patch target field '${fieldPath}' does not exist, skipping`);
          continue;
        }
        if (marker === "$remove" || marker === "$unset") {
          continue; // silent no-op
        }
        if (marker === "$merge") {
          // Create empty object, then merge
          validateMarkerValue(marker, value, pathPrefix || "root");
          parent[parentKey] = deepMerge({}, value as Record<string, unknown>);
          continue;
        }
        if (marker === "$mergeBy") {
          // Create empty array, append all items
          validateMarkerValue(marker, value, pathPrefix || "root");
          const mbVal = value as { items: Record<string, unknown>[] };
          parent[parentKey] = [...mbVal.items];
          continue;
        }
        if (marker === "$set") {
          parent[parentKey] = value;
          continue;
        }
      }

      applyMarker(parent[parentKey], marker, value, parentKey, parent, pathPrefix || "root");
    }
  }

  // Handle navigation keys (non-marker keys)
  for (const key of navKeys) {
    const patchValue = patch[key];
    const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;

    // Step 7: if patch[key] is not an object — skip
    if (!isPlainObject(patchValue)) {
      continue;
    }

    const patchObj = patchValue as Record<string, unknown>;

    // Ensure base[key] exists for navigation
    const baseObj = parent[parentKey] as Record<string, unknown>;
    if (baseObj[key] === undefined) {
      // For navigation, we need to check if patch has markers that need the field
      // Create intermediate object for navigation
      if (hasMarkerKeys(patchObj)) {
        // Check what markers are present — some create the field, some skip
        const patchMarkers = Object.keys(patchObj).filter((k) => k.startsWith("$"));
        const needsCreation = patchMarkers.some((m) => m === "$set" || m === "$merge" || m === "$mergeBy");
        if (!needsCreation) {
          // Only has markers that skip on undefined — still recurse
          // to let those markers handle the undefined case
        }
      }
      // For non-marker navigation, create intermediate object
      if (!hasMarkerKeys(patchObj) && baseObj[key] === undefined) {
        baseObj[key] = {};
      }
    }

    // Recurse
    applyPatchRecursive(baseObj[key], patchObj, key, baseObj, currentPath, warnings);
  }
}

/**
 * Выполняет шаг provider overlay.
 * Поддерживает multi-layer режим (параметр layers) и режим обратной совместимости.
 *
 * Spec: docs/specs/provider-overlay.md § Операция overlay
 * Spec: docs/specs/layer-model.md § Рефакторинг операции overlay
 */
export function runOverlayStep(params: OverlayStepParams): TranspilerStepOutcome {
  const { entry, projectRoot, variables, env, layers, values } = params;

  // Если layers передан — используем multi-layer режим
  if (layers !== undefined) {
    return runMultiLayerOverlay(entry, projectRoot, layers, variables, env);
  }

  // Режим обратной совместимости: единственный источник — .agloom/overlays/<entry.id>/
  return runLegacyOverlay(entry, projectRoot, variables, env, values);
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
  values?: Record<string, string>,
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
    const shouldInterpolate = variables !== undefined && INTERPOLATABLE_EXTENSIONS.includes(ext);

    if (shouldInterpolate) {
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const result = interpolate(content, variables, env, values);
        fs.writeFileSync(targetPath, result, "utf-8");
        writtenCount++;
      } catch (err) {
        if (err instanceof InterpolationError) {
          errors.push(`Interpolation failed for ${relativePath}: ${err.message}`);
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

      // Шаг 2.4: целевой относительный путь (с удалением .override/.patch)
      const targetRelativePath = stripOverrideSuffix(relativePath);

      // Check mutual exclusivity of .patch and .override
      // Spec: docs/specs/patch-mechanism.md § Взаимоисключаемость с .override
      if (hasBothPatchAndOverride(relativePath)) {
        errors.push(`File '${relativePath}' has both .patch and .override suffixes in layer ${layer.id}`);
        continue;
      }

      // Шаг 2.5: определить стратегию
      const strategy = classifyFile(relativePath);

      // Шаг 2.6: интерполяция
      const ext = path.extname(filePath).toLowerCase();
      const shouldInterpolate = variables !== undefined && INTERPOLATABLE_EXTENSIONS.includes(ext);

      let content: string | null = null;

      if (shouldInterpolate || strategy === "overlay" || strategy === "patch") {
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
            content = interpolate(content, variables!, env, layer.values);
          } catch (err) {
            if (err instanceof InterpolationError) {
              // Расширение 2.6a
              errors.push(`Interpolation failed for ${layer.id}:${relativePath}: ${err.message}`);
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
            errors.push(`Parse failed for ${layer.id}:${relativePath}: unsupported format`);
            continue;
          }
          parsed = result;
        } catch (err) {
          // Расширение 2.7a
          const error = err instanceof Error ? err : new Error(String(err));
          errors.push(`Parse failed for ${layer.id}:${relativePath}: ${error.message}`);
          continue;
        }

        const mergeContext: DeepMergeContext = {
          filePath: targetRelativePath,
          jsonPath: "",
        };

        const existing = mergeState.get(targetRelativePath);
        if (existing && existing.type === "merged") {
          // Merge with existing mergeState
          mergeState.set(targetRelativePath, {
            type: "merged",
            data: deepMerge(existing.data, parsed, mergeContext),
            ext: fileExt,
          });
        } else {
          // No mergeState entry yet — try to merge with existing target file
          const targetPath = path.join(projectRoot, targetRelativePath);
          let baseData: Record<string, unknown> = {};
          if (!existing && fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
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
            data: deepMerge(baseData, parsed, mergeContext),
            ext: fileExt,
          });
        }
      } else if (strategy === "patch") {
        // Шаг 2.9: patch — parse patch file, get base, apply patch
        // Spec: docs/specs/patch-mechanism.md § Расширение overlay-step
        const patchFileExt = path.extname(relativePath).toLowerCase();
        const targetExt = path.extname(targetRelativePath).toLowerCase();

        // Parse patch file
        let patchData: Record<string, unknown>;
        try {
          const result = parseContent(content!, patchFileExt);
          if (result === null) {
            errors.push(`Patch parse failed for ${layer.id}:${relativePath}: unsupported format`);
            continue;
          }
          patchData = result;
        } catch (err) {
          // Расширение 2.9a
          const error = err instanceof Error ? err : new Error(String(err));
          errors.push(`Patch parse failed for ${layer.id}:${relativePath}: ${error.message}`);
          continue;
        }

        // Get current state of target file
        let baseData: Record<string, unknown> | undefined;
        const existing = mergeState.get(targetRelativePath);
        if (existing) {
          if (existing.type === "merged") {
            baseData = existing.data;
          } else if (existing.type === "override") {
            // Get content from override entry
            let overrideContent: string | null = existing.content;
            if (overrideContent === null && existing.sourcePath !== null) {
              try {
                overrideContent = fs.readFileSync(existing.sourcePath, "utf-8");
              } catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));
                errors.push(`Target parse failed for ${targetRelativePath}: ${error.message}`);
                continue;
              }
            }
            if (overrideContent !== null) {
              try {
                const parsed = parseContent(overrideContent, targetExt);
                baseData = parsed ?? undefined;
              } catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));
                errors.push(`Target parse failed for ${targetRelativePath}: ${error.message}`);
                continue;
              }
            }
          }
        } else {
          // Read existing target file from filesystem
          const targetPath = path.join(projectRoot, targetRelativePath);
          if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
            try {
              const existingContent = fs.readFileSync(targetPath, "utf-8");
              const parsed = parseContent(existingContent, targetExt);
              baseData = parsed ?? undefined;
            } catch (err) {
              // Расширение 2.9b
              const error = err instanceof Error ? err : new Error(String(err));
              errors.push(`Target parse failed for ${targetRelativePath}: ${error.message}`);
              continue;
            }
          }
        }

        // Apply patch
        try {
          const patchResult = applyPatchWithWarnings(baseData, patchData);
          // Add warnings to errors (non-fatal, e.g. missing target fields)
          errors.push(...patchResult.warnings);
          mergeState.set(targetRelativePath, {
            type: "merged",
            data: patchResult.result,
            ext: targetExt || patchFileExt,
          });
        } catch (err) {
          // Расширение 2.9c
          const error = err instanceof Error ? err : new Error(String(err));
          errors.push(error.message);
          continue;
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
