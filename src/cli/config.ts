/**
 * Конфигурационный файл .agloom/config.yml — загрузка, валидация и разрешение адаптеров.
 * Spec: docs/specs/config.md § Процедура Load Config
 * Spec: docs/specs/config.md § Процедура Resolve Adapters from Config
 * Spec: docs/specs/config.md § Процедура Resolve Adapters from CLI Args
 */

import * as fs from "node:fs";
import * as path from "node:path";
import yaml from "js-yaml";
import { adapterRegistry } from "./adapter-registry.js";
import { resolveAdapter } from "./resolve-adapter.js";
import { resolveDeps } from "./resolve-deps.js";
import type { AdapterRegistryEntry } from "./types.js";

/** Результат загрузки конфигурационного файла. */
export interface LoadConfigResult {
  /** Список идентификаторов адаптеров из конфига. */
  adapterIds: string[];
  /** Список путей к плагинам из конфига, или null если поле plugins отсутствует. */
  pluginPaths: string[] | null;
}

/**
 * Процедура Load Config — загрузка и валидация конфигурационного файла.
 *
 * Spec: docs/specs/config.md § Процедура Load Config
 * Spec: docs/specs/plugin-loading.md § Расширение процедуры Load Config
 *
 * @param projectRoot — абсолютный путь к корню проекта.
 * @returns Объект с adapterIds и pluginPaths, или null если файл не существует.
 * @throws Error при невалидном YAML, отсутствующем/невалидном поле adapters,
 *   неизвестном или скрытом адаптере, невалидном поле plugins.
 */
export function loadConfig(projectRoot: string): LoadConfigResult | null {
  const configPath = path.join(projectRoot, ".agloom", "config.yml");

  // Шаг 1: Попытаться прочитать файл
  // Расширение 1a: Файл не существует → вернуть null
  if (!fs.existsSync(configPath)) {
    return null;
  }

  const content = fs.readFileSync(configPath, "utf-8");

  // Шаг 2: Распарсить содержимое файла как YAML
  // Расширение 2a: Невалидный YAML
  let parsed: unknown;
  try {
    parsed = yaml.load(content);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid config file: ${message}`);
  }

  // Шаг 3: Проверить наличие и формат поля adapters
  if (
    parsed === null ||
    parsed === undefined ||
    typeof parsed !== "object" ||
    !("adapters" in (parsed as Record<string, unknown>))
  ) {
    // Расширение 3a: Поле adapters отсутствует
    throw new Error("Invalid config: 'adapters' field is required.");
  }

  const config = parsed as Record<string, unknown>;
  const adapters = config.adapters;

  // Расширение 3b: adapters не является массивом или содержит нестроковые элементы
  if (!Array.isArray(adapters)) {
    throw new Error("Invalid config: 'adapters' must be an array of strings.");
  }

  if (!adapters.every((item) => typeof item === "string")) {
    throw new Error("Invalid config: 'adapters' must be an array of strings.");
  }

  // Расширение 3c: Массив adapters пуст
  if (adapters.length === 0) {
    throw new Error("Invalid config: 'adapters' must not be empty.");
  }

  // Шаг 4: Для каждого элемента проверить наличие в реестре и скрытость
  for (const id of adapters) {
    const entry = adapterRegistry.find((e) => e.id === id);

    // Расширение 4a: Неизвестный адаптер
    if (!entry) {
      throw new Error(`Invalid config: unknown adapter '${id}'.`);
    }

    // Расширение 4b: Скрытый адаптер
    if (entry.hidden) {
      throw new Error(
        `Invalid config: adapter '${id}' cannot be specified in config.`,
      );
    }
  }

  // Шаг 5: проверить наличие поля plugins
  // Расширение 5a: поле plugins отсутствует → pluginPaths = null
  let pluginPaths: string[] | null = null;

  if ("plugins" in config) {
    const plugins = config.plugins;

    // Шаг 6: проверить, что plugins является массивом строк
    // Расширение 6a: невалидный формат
    if (
      !Array.isArray(plugins) ||
      !plugins.every((item) => typeof item === "string")
    ) {
      throw new Error("Invalid config: 'plugins' must be an array of strings.");
    }

    pluginPaths = plugins as string[];
  }

  return { adapterIds: adapters as string[], pluginPaths };
}

/**
 * Процедура Resolve Adapters from Config — разрешение списка адаптеров
 * из конфига с учётом зависимостей.
 *
 * @param adapterIds — список идентификаторов адаптеров из конфига.
 * @returns Дедуплицированный упорядоченный список записей адаптеров.
 */
export function resolveAdaptersFromConfig(
  adapterIds: string[],
): AdapterRegistryEntry[] {
  const visited = new Set<string>();
  const result: AdapterRegistryEntry[] = [];

  for (const id of adapterIds) {
    const resolved = resolveDeps(id, adapterRegistry);
    for (const entry of resolved) {
      if (!visited.has(entry.id)) {
        visited.add(entry.id);
        result.push(entry);
      }
    }
  }

  return result;
}

/**
 * Процедура Resolve Adapters from CLI Args — общая процедура разрешения
 * списка адаптеров из аргументов командной строки.
 *
 * @param options — аргументы CLI.
 * @returns Упорядоченный список записей адаптеров.
 * @throws Error при взаимоисключающих аргументах, неизвестном/скрытом адаптере,
 *   отсутствии конфига или невалидном конфиге.
 */
export function resolveAdaptersFromCLIArgs(options: {
  adapter: string | null;
  all: boolean;
  projectRoot: string;
  command: string;
}): AdapterRegistryEntry[] {
  const { adapter, all, projectRoot, command } = options;

  // Расширение 1a: adapter и all указаны одновременно
  if (adapter !== null && all) {
    throw new Error("--adapter and --all are mutually exclusive.");
  }

  // Шаг 2: adapter указан → Resolve Adapter + Разрешение зависимостей
  if (adapter !== null) {
    resolveAdapter(adapter);
    return resolveDeps(adapter, adapterRegistry);
  }

  // Шаг 3: all === true → все записи реестра
  if (all) {
    return [...adapterRegistry];
  }

  // Шаг 4: Load Config
  const configResult = loadConfig(projectRoot);

  // Расширение 4a: Load Config вернул null
  if (configResult === null) {
    if (command !== "init") {
      throw new Error(
        "No config found. Use --adapter <id> or --all, or run 'agloom init' to create a config.",
      );
    } else {
      throw new Error(
        "No config found. Use --adapter <id> or --all to specify adapters.",
      );
    }
  }

  // Шаг 5: Resolve Adapters from Config
  return resolveAdaptersFromConfig(configResult.adapterIds);
}
