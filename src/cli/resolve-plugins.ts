/**
 * Процедура Resolve Plugins — разрешение и валидация списка плагинов.
 * Spec: docs/specs/plugin-loading.md § Процедура Resolve Plugins
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { loadPluginManifest } from "./plugin-manifest.js";
import type { PluginManifest } from "./plugin-manifest.js";

/** Разрешённый плагин. */
export interface ResolvedPlugin {
  /** Имя плагина из манифеста. */
  name: string;
  /** Абсолютный путь к директории плагина. */
  path: string;
  /** Распарсированный манифест плагина. */
  manifest: PluginManifest;
}

/**
 * Разрешает и валидирует список плагинов из конфигурации.
 *
 * Spec: docs/specs/plugin-loading.md § Процедура Resolve Plugins
 * Fail-fast: при первой ошибке выбрасывает Error.
 *
 * @param params.pluginPaths — список путей к директориям плагинов.
 * @param params.projectRoot — абсолютный путь к корню проекта.
 * @returns Упорядоченный список разрешённых плагинов.
 */
export function resolvePlugins(params: {
  pluginPaths: string[];
  projectRoot: string;
}): ResolvedPlugin[] {
  const { pluginPaths, projectRoot } = params;

  // Шаг 1: инициализировать resolved и nameToPath
  const resolved: ResolvedPlugin[] = [];
  const nameToPath: Record<string, string> = {};

  // Шаг 2: для каждого pluginPath
  for (const pluginPath of pluginPaths) {
    // Шаг 2.1: разрешить путь
    const absolutePath = path.isAbsolute(pluginPath)
      ? pluginPath
      : path.resolve(projectRoot, pluginPath);

    // Шаг 2.2: проверить существование
    if (!fs.existsSync(absolutePath)) {
      // Расширение 2.2a
      throw new Error(`Plugin path not found: '${absolutePath}'.`);
    }

    const stat = fs.statSync(absolutePath);
    if (!stat.isDirectory()) {
      // Расширение 2.2b
      throw new Error(`Plugin path is not a directory: '${absolutePath}'.`);
    }

    // Шаг 2.3: проверить наличие plugin.yml
    const manifestPath = path.join(absolutePath, "plugin.yml");
    if (!fs.existsSync(manifestPath)) {
      // Расширение 2.3a
      throw new Error(`Plugin manifest not found: '${manifestPath}'.`);
    }

    // Шаги 2.4-2.5: парсинг и валидация манифеста
    let manifest: PluginManifest;
    try {
      manifest = loadPluginManifest(absolutePath);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // loadPluginManifest throws "Invalid plugin manifest: ..." or "Plugin manifest not found: ..."
      // Re-throw with the path format expected by the spec
      if (message.startsWith("Invalid plugin manifest:")) {
        const detail = message.slice("Invalid plugin manifest: ".length);
        throw new Error(
          `Invalid plugin manifest at '${manifestPath}': ${detail}`,
        );
      }
      throw new Error(
        `Invalid plugin manifest at '${manifestPath}': ${message}`,
      );
    }

    // Шаг 2.6: извлечь name
    const name = manifest.name;

    // Шаг 2.7: проверить дубликаты
    if (name in nameToPath) {
      // Расширение 2.7a
      throw new Error(
        `Duplicate plugin name '${name}': declared at '${nameToPath[name]}' and '${absolutePath}'.`,
      );
    }

    // Шаг 2.8: добавить в nameToPath
    nameToPath[name] = absolutePath;

    // Шаг 2.9: добавить в resolved
    resolved.push({ name, path: absolutePath, manifest });
  }

  // Шаг 3: вернуть resolved
  return resolved;
}
