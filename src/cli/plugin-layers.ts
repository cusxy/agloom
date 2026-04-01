/**
 * Формирование массива layers для overlay.
 * Spec: docs/specs/plugin-loading.md § Формирование массива layers
 */

import * as path from "node:path";
import type { LayerSource } from "./overlay-step.js";

/**
 * Формирует массив LayerSource для единственного вызова overlay per-adapter.
 *
 * Порядок: плагины в порядке объявления, затем локальный проект (наивысший приоритет).
 *
 * @param params.plugins — разрешённые плагины.
 * @param params.projectRoot — абсолютный путь к корню проекта.
 * @param params.entryId — идентификатор адаптера.
 * @returns Упорядоченный массив LayerSource.
 */
export function buildLayers(params: {
  plugins: { name: string; path: string }[];
  projectRoot: string;
  entryId: string;
}): LayerSource[] {
  const { plugins, projectRoot, entryId } = params;
  const layers: LayerSource[] = [];

  // Шаг 1: для каждого плагина
  for (const plugin of plugins) {
    layers.push({
      id: plugin.name,
      overlayDir: path.join(plugin.path, "overlays", entryId) + "/",
    });
  }

  // Шаг 2: локальный проект
  layers.push({
    id: "local",
    overlayDir: path.join(projectRoot, ".agloom", "overlays", entryId) + "/",
  });

  return layers;
}
