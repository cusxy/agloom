// plugin-layers-values.spec.ts
// Спецификация: docs/specs/plugin-values.md § Расширение buildLayers

import { describe, it, expect } from "vitest";
import { buildLayers } from "../plugin-layers.js";

describe("CLI", () => {
  describe("Расширение buildLayers — передача values", () => {
    // --- Happy path: шаг 1 — LayerSource для плагина содержит values = plugin.resolvedValues ---
    // Spec: § Расширение buildLayers, шаг 1
    // "Для каждого плагина из plugins создать LayerSource с values = plugin.resolvedValues."
    it("устанавливает values на LayerSource плагина из plugin.resolvedValues", () => {
      const resolvedValues = {
        team_name: "platform",
        api_url: "https://api.example.com",
      };

      const layers = buildLayers({
        plugins: [
          { name: "my-plugin", path: "/tmp/plugins/my-plugin", resolvedValues },
        ],
        projectRoot: "/tmp/project",
        entryId: "claude",
      });

      // Первый слой — плагин, последний — local
      expect(layers[0].values).toEqual(resolvedValues);
    });

    // --- Happy path: шаг 2 — LayerSource для локального проекта содержит values = localValues ---
    // Spec: § Расширение buildLayers, шаг 2
    // "Создать LayerSource для локального проекта с values = localValues."
    it("устанавливает values на LayerSource локального проекта из localValues", () => {
      const localValues = { project_name: "agloom", env: "production" };

      const layers = buildLayers({
        plugins: [],
        projectRoot: "/tmp/project",
        entryId: "claude",
        localValues,
      });

      // Единственный слой — local
      expect(layers).toHaveLength(1);
      expect(layers[0].id).toBe("local");
      expect(layers[0].values).toEqual(localValues);
    });

    // --- Happy path: несколько плагинов с разными resolvedValues ---
    // Spec: § Расширение buildLayers, шаги 1-2
    // Каждый плагин ДОЛЖЕН получить свои values (per-plugin изоляция).
    it("каждый плагин получает свои resolvedValues в LayerSource", () => {
      const valuesA = { key: "value-a" };
      const valuesB = { key: "value-b", extra: "data" };
      const localValues = { local_key: "local-value" };

      const layers = buildLayers({
        plugins: [
          { name: "plugin-a", path: "/tmp/plugins/a", resolvedValues: valuesA },
          { name: "plugin-b", path: "/tmp/plugins/b", resolvedValues: valuesB },
        ],
        projectRoot: "/tmp/project",
        entryId: "claude",
        localValues,
      });

      expect(layers).toHaveLength(3);
      expect(layers[0].id).toBe("plugin-a");
      expect(layers[0].values).toEqual(valuesA);
      expect(layers[1].id).toBe("plugin-b");
      expect(layers[1].values).toEqual(valuesB);
      expect(layers[2].id).toBe("local");
      expect(layers[2].values).toEqual(localValues);
    });

    // --- Обратная совместимость: resolvedValues не передан ---
    // Spec: § Обратная совместимость
    // "При отсутствии поля values в plugin entry — поведение идентично текущему."
    it("LayerSource.values равен undefined если resolvedValues не передан для плагина", () => {
      const layers = buildLayers({
        plugins: [{ name: "no-values-plugin", path: "/tmp/plugins/nv" }],
        projectRoot: "/tmp/project",
        entryId: "claude",
      });

      expect(layers[0].values).toBeUndefined();
    });

    // --- Обратная совместимость: localValues не передан ---
    // Spec: § Обратная совместимость
    // "При отсутствии секции variables в config.yml — поведение идентично текущему."
    it("LayerSource.values равен undefined для local если localValues не передан", () => {
      const layers = buildLayers({
        plugins: [],
        projectRoot: "/tmp/project",
        entryId: "claude",
      });

      const localLayer = layers.find((l) => l.id === "local");
      expect(localLayer).toBeDefined();
      expect(localLayer!.values).toBeUndefined();
    });

    // --- Граничное условие: пустой resolvedValues ---
    // Spec: § Обратная совместимость
    // "При передаче values: {} в interpolate (пустая карта) — ${values:NAME}
    //  вызывает InterpolationError."
    it("пустой resolvedValues устанавливается как values на LayerSource", () => {
      const layers = buildLayers({
        plugins: [
          { name: "empty-vals", path: "/tmp/plugins/ev", resolvedValues: {} },
        ],
        projectRoot: "/tmp/project",
        entryId: "claude",
      });

      expect(layers[0].values).toEqual({});
    });

    // --- Граничное условие: пустой localValues ---
    it("пустой localValues устанавливается как values на LayerSource локального проекта", () => {
      const layers = buildLayers({
        plugins: [],
        projectRoot: "/tmp/project",
        entryId: "claude",
        localValues: {},
      });

      expect(layers[0].values).toEqual({});
    });
  });
});
