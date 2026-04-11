/**
 * Конфигурационный файл .agloom/config.yml — загрузка, валидация и разрешение адаптеров.
 * Spec: docs/specs/config.md § Процедура Load Config
 * Spec: docs/specs/config.md § Процедура Resolve Adapters from Config
 * Spec: docs/specs/config.md § Процедура Resolve Adapters from CLI Args
 */

import { adapterRegistry } from "./adapter-registry.js";
import { resolveAdapter } from "./resolve-adapter.js";
import { resolveDeps } from "./resolve-deps.js";
import { parsePluginEntry } from "./resolve-plugins.js";
import type { ParsedPluginEntry } from "./resolve-plugins.js";
import type { AdapterRegistryEntry } from "./types.js";
import type { RawConfig } from "./read-config-source.js";

/** Результат загрузки конфигурационного файла. */
export interface LoadConfigResult {
  /**
   * Список идентификаторов адаптеров из конфига, или null если поле
   * `adapters` отсутствует в файле.
   *
   * Spec: docs/specs/config.md § Процедура Load Config § Поведение шаг 5
   */
  adapterIds: string[] | null;
  /** Список путей к плагинам из конфига, или null если поле plugins отсутствует. */
  pluginPaths: string[] | null;
  /** Список разобранных записей плагинов из конфига, или null. */
  pluginEntries: ParsedPluginEntry[] | null;
  /** Нормализованная карта переменных локального проекта, или null. */
  configVariables: Record<string, import("./plugin-manifest.js").VariableDeclaration> | null;
}

/**
 * Пустой результат Load Config (все поля null). Используется когда
 * rawConfig.kind === "missing".
 */
const EMPTY_LOAD_CONFIG_RESULT: LoadConfigResult = {
  adapterIds: null,
  pluginPaths: null,
  pluginEntries: null,
  configVariables: null,
};

/**
 * Процедура Load Config — валидация и извлечение структурированных полей
 * из сырого YAML-объекта конфига. Собственный I/O не выполняет; принимает
 * готовый результат Read Config Source.
 *
 * Spec: docs/specs/config.md § Процедура Load Config
 * Spec: docs/specs/plugin-loading.md § Расширение процедуры Load Config
 */
export function loadConfig(rawConfig: RawConfig): LoadConfigResult {
  if (rawConfig.kind === "missing") {
    return { ...EMPTY_LOAD_CONFIG_RESULT };
  }
  return validateRawConfig(rawConfig.value);
}

/**
 * Внутренняя функция: применяет Load Config валидацию к уже распарсенному
 * YAML-объекту. Идентична поведению предыдущей версии loadConfig, шаги 2-9.
 */
function validateRawConfig(config: Record<string, unknown>): LoadConfigResult {
  // Шаг 3: Проверить наличие и формат поля adapters (опционально)
  let adapterIdsResult: string[] | null = null;

  if ("adapters" in config) {
    const adapters = config.adapters;

    if (!Array.isArray(adapters)) {
      throw new Error("Invalid config: 'adapters' must be an array of strings.");
    }

    if (!adapters.every((item) => typeof item === "string")) {
      throw new Error("Invalid config: 'adapters' must be an array of strings.");
    }

    if (adapters.length === 0) {
      throw new Error("Invalid config: 'adapters' must not be empty.");
    }

    for (const id of adapters) {
      const entry = adapterRegistry.find((e) => e.id === id);

      if (!entry) {
        throw new Error(`Invalid config: unknown adapter '${id}'.`);
      }

      if (entry.hidden) {
        throw new Error(`Invalid config: adapter '${id}' cannot be specified in config.`);
      }
    }

    adapterIdsResult = adapters as string[];
  }

  // Шаг 5-6: обработка plugins
  let pluginPaths: string[] | null = null;
  let pluginEntries: ParsedPluginEntry[] | null = null;

  if ("plugins" in config) {
    const plugins = config.plugins;

    if (!Array.isArray(plugins)) {
      throw new Error("Invalid config: 'plugins' must be an array of strings.");
    }

    const entries: ParsedPluginEntry[] = [];
    const paths: string[] = [];

    for (const item of plugins) {
      if (typeof item !== "string" && (typeof item !== "object" || item === null)) {
        throw new Error("Invalid config: 'plugins' must be an array of strings.");
      }

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

      const parsedEntry = parsePluginEntry(item);
      entries.push(parsedEntry);

      if (parsedEntry.type === "local") {
        paths.push(parsedEntry.path!);
      }

      if (parsedEntry.type === "git") {
        const url = parsedEntry.url ?? "";
        const isHttps = url.startsWith("https://");
        const isSsh = url.startsWith("ssh://") || /^git@[^:]+:/.test(url);
        if (!isHttps && !isSsh) {
          throw new Error("Invalid config: plugin entry 'git' must be an HTTPS or SSH git URL.");
        }

        if (parsedEntry.ref != null && (typeof parsedEntry.ref !== "string" || parsedEntry.ref === "")) {
          throw new Error("Invalid config: plugin entry 'ref' must be a non-empty string or absent.");
        }

        if (parsedEntry.path != null) {
          if (
            typeof parsedEntry.path !== "string" ||
            parsedEntry.path === "" ||
            parsedEntry.path.startsWith("/") ||
            parsedEntry.path.includes("..")
          ) {
            throw new Error("Invalid config: plugin entry 'path' must be a relative path without '..' components.");
          }
        }
      }
    }

    pluginEntries = entries;

    if (entries.every((e) => e.type === "local")) {
      pluginPaths = entries.map((e) => e.path!);
    } else {
      pluginPaths = entries.filter((e) => e.type === "local").map((e) => e.path!);
    }
  }

  // Шаг 7-9: variables
  let configVariables: Record<string, import("./plugin-manifest.js").VariableDeclaration> | null = null;

  if ("variables" in config) {
    const rawVariables = config.variables;

    if (typeof rawVariables !== "object" || rawVariables === null || Array.isArray(rawVariables)) {
      throw new Error("Invalid config: 'variables' must be an object.");
    }

    configVariables = {};

    for (const [key, value] of Object.entries(rawVariables as Record<string, unknown>)) {
      if (typeof value === "string") {
        configVariables[key] = {
          description: "",
          required: false,
          default: value,
          sensitive: false,
        };
        continue;
      }

      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error(`Invalid config: variable '${key}' must be a string or an object.`);
      }

      const varObj = value as Record<string, unknown>;

      let description = "";
      if (varObj.description != null) {
        if (typeof varObj.description !== "string") {
          throw new Error(`Invalid config: variable '${key}' field 'description' must be a string.`);
        }
        description = varObj.description;
      }

      let required = false;
      if (varObj.required != null) {
        if (typeof varObj.required !== "boolean") {
          throw new Error(`Invalid config: variable '${key}' field 'required' must be a boolean.`);
        }
        required = varObj.required;
      }

      let defaultValue: string | null = null;
      if (varObj.default != null) {
        if (typeof varObj.default !== "string") {
          throw new Error(`Invalid config: variable '${key}' field 'default' must be a string.`);
        }
        defaultValue = varObj.default;
      }

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
    adapterIds: adapterIdsResult,
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
 * Опции для Resolve Adapters from CLI Args.
 *
 * Spec: docs/specs/config.md § Процедура Resolve Adapters from CLI Args
 */
export interface ResolveAdaptersFromCLIArgsOptions {
  adapterIds: string[];
  all: boolean;
  command: string;
  /** Готовый результат Load Config (produced by runCLI). */
  loadedConfig: LoadConfigResult | null;
}

/**
 * Процедура Resolve Adapters from CLI Args.
 *
 * Spec: docs/specs/config.md § Процедура Resolve Adapters from CLI Args
 */
export function resolveAdaptersFromCLIArgs(options: ResolveAdaptersFromCLIArgsOptions): AdapterRegistryEntry[] {
  const { adapterIds, all, command, loadedConfig } = options;

  // Расширение 1a
  if (adapterIds.length > 0 && all) {
    throw new Error("--adapter and --all are mutually exclusive.");
  }

  // Шаг 2: adapterIds непустой
  if (adapterIds.length > 0) {
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const id of adapterIds) {
      if (!seen.has(id)) {
        seen.add(id);
        deduped.push(id);
      }
    }

    for (const id of deduped) {
      resolveAdapter(id);
    }

    return resolveAdaptersFromConfig(deduped);
  }

  // Шаг 3: --all
  if (all) {
    return [...adapterRegistry];
  }

  // Шаг 4-5: use the precomputed loadedConfig from runCLI.
  if (loadedConfig === null || loadedConfig.adapterIds === null) {
    if (command === "init") {
      throw new Error("No adapters specified. Use --adapter <id> or --all to specify adapters.");
    }
    throw new Error("No adapters specified. Use --adapter <id>, --all, or add 'adapters' to .agloom/config.yml.");
  }

  return resolveAdaptersFromConfig(loadedConfig.adapterIds);
}
