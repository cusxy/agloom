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
import { parsePluginEntry } from "./resolve-plugins.js";
import type { ParsedPluginEntry } from "./resolve-plugins.js";
import type { AdapterRegistryEntry } from "./types.js";

/** Результат загрузки конфигурационного файла. */
export interface LoadConfigResult {
  /** Список идентификаторов адаптеров из конфига. */
  adapterIds: string[];
  /** Список путей к плагинам из конфига, или null если поле plugins отсутствует. */
  pluginPaths: string[] | null;
  /** Список разобранных записей плагинов из конфига, или null. */
  pluginEntries: ParsedPluginEntry[] | null;
  /** Нормализованная карта переменных локального проекта, или null. */
  configVariables: Record<string, import("./plugin-manifest.js").VariableDeclaration> | null;
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
      throw new Error(`Invalid config: adapter '${id}' cannot be specified in config.`);
    }
  }

  // Шаг 5: проверить наличие поля plugins
  // Расширение 5a: поле plugins отсутствует → pluginPaths = null
  let pluginPaths: string[] | null = null;
  let pluginEntries: ParsedPluginEntry[] | null = null;

  if ("plugins" in config) {
    const plugins = config.plugins;

    // Шаг 6 (git-plugin-loading): проверить, что plugins является массивом
    // Каждый элемент может быть строкой, объектом LocalPluginEntry или GitPluginEntry
    if (!Array.isArray(plugins)) {
      throw new Error("Invalid config: 'plugins' must be an array of strings.");
    }

    // Шаг 6.1: Parse Plugin Entry для каждого элемента
    const entries: ParsedPluginEntry[] = [];
    const paths: string[] = [];

    for (const item of plugins) {
      // Backward compatibility: non-string/non-object → old error message
      if (typeof item !== "string" && (typeof item !== "object" || item === null)) {
        throw new Error("Invalid config: 'plugins' must be an array of strings.");
      }

      // Шаг 6.3: валидация values в объектных форматах
      if (typeof item === "object" && item !== null && !Array.isArray(item)) {
        const obj = item as Record<string, unknown>;
        if ("values" in obj) {
          const values = obj.values;
          if (typeof values !== "object" || values === null || Array.isArray(values)) {
            throw new Error("Invalid config: plugin 'values' must be an object.");
          }
          for (const [vKey, vVal] of Object.entries(values as Record<string, unknown>)) {
            if (typeof vVal !== "string") {
              throw new Error(`Invalid config: plugin 'values' entry '${vKey}' must be a string.`);
            }
          }
        }
      }

      // Расширение 6.1a: Parse Plugin Entry вернул ошибку → пробросить
      const parsed = parsePluginEntry(item);
      entries.push(parsed);

      if (parsed.type === "local") {
        paths.push(parsed.path!);
      }

      // Шаг 6.2: валидация git-специфичных полей
      if (parsed.type === "git") {
        // Шаг 6.2.1: проверить URL
        const url = parsed.url ?? "";
        const isHttps = url.startsWith("https://");
        const isSsh = url.startsWith("ssh://") || /^git@[^:]+:/.test(url);
        if (!isHttps && !isSsh) {
          throw new Error("Invalid config: plugin entry 'git' must be an HTTPS or SSH git URL.");
        }

        // Шаг 6.2.2: проверить ref (опционально — null допустим)
        if (parsed.ref != null && (typeof parsed.ref !== "string" || parsed.ref === "")) {
          throw new Error("Invalid config: plugin entry 'ref' must be a non-empty string or absent.");
        }

        // Шаг 6.2.3: проверить path
        if (parsed.path != null) {
          if (
            typeof parsed.path !== "string" ||
            parsed.path === "" ||
            parsed.path.startsWith("/") ||
            parsed.path.includes("..")
          ) {
            throw new Error("Invalid config: plugin entry 'path' must be a relative path without '..' components.");
          }
        }
      }
    }

    pluginEntries = entries;

    // Backward compatibility: if all entries are local strings, also populate pluginPaths
    // for old-style callers
    if (entries.every((e) => e.type === "local")) {
      pluginPaths = entries.map((e) => e.path!);
    } else {
      pluginPaths = entries.filter((e) => e.type === "local").map((e) => e.path!);
    }
  }

  // Шаг 7-9: обработка variables
  let configVariables: Record<string, import("./plugin-manifest.js").VariableDeclaration> | null = null;

  if ("variables" in config) {
    const rawVariables = config.variables;

    // Шаг 8: проверить, что variables — объект
    if (typeof rawVariables !== "object" || rawVariables === null || Array.isArray(rawVariables)) {
      throw new Error("Invalid config: 'variables' must be an object.");
    }

    configVariables = {};

    for (const [key, value] of Object.entries(rawVariables as Record<string, unknown>)) {
      // Шаг 9.1: строка → нормализовать
      if (typeof value === "string") {
        configVariables[key] = {
          description: "",
          required: false,
          default: value,
          sensitive: false,
        };
        continue;
      }

      // Шаг 9.2: объект → валидировать поля
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error(`Invalid config: variable '${key}' must be a string or an object.`);
      }

      const varObj = value as Record<string, unknown>;

      // 9.2.1: description
      let description = "";
      if (varObj.description != null) {
        if (typeof varObj.description !== "string") {
          throw new Error(`Invalid config: variable '${key}' field 'description' must be a string.`);
        }
        description = varObj.description;
      }

      // 9.2.2: required
      let required = false;
      if (varObj.required != null) {
        if (typeof varObj.required !== "boolean") {
          throw new Error(`Invalid config: variable '${key}' field 'required' must be a boolean.`);
        }
        required = varObj.required;
      }

      // 9.2.3: default
      let defaultValue: string | null = null;
      if (varObj.default != null) {
        if (typeof varObj.default !== "string") {
          throw new Error(`Invalid config: variable '${key}' field 'default' must be a string.`);
        }
        defaultValue = varObj.default;
      }

      // 9.2.4: sensitive
      let sensitive = false;
      if (varObj.sensitive != null) {
        if (typeof varObj.sensitive !== "boolean") {
          throw new Error(`Invalid config: variable '${key}' field 'sensitive' must be a boolean.`);
        }
        sensitive = varObj.sensitive;
      }

      configVariables[key] = {
        description,
        required,
        default: defaultValue,
        sensitive,
      };
    }
  }

  return {
    adapterIds: adapters as string[],
    pluginPaths,
    pluginEntries,
    configVariables,
  };
}

/**
 * Процедура Resolve Adapters from Config — разрешение списка адаптеров
 * из конфига с учётом зависимостей.
 *
 * @param adapterIds — список идентификаторов адаптеров из конфига.
 * @returns Дедуплицированный упорядоченный список записей адаптеров.
 */
export function resolveAdaptersFromConfig(adapterIds: string[]): AdapterRegistryEntry[] {
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
      throw new Error("No config found. Use --adapter <id> or --all, or run 'agloom init' to create a config.");
    } else {
      throw new Error("No config found. Use --adapter <id> or --all to specify adapters.");
    }
  }

  // Шаг 5: Resolve Adapters from Config
  return resolveAdaptersFromConfig(configResult.adapterIds);
}
