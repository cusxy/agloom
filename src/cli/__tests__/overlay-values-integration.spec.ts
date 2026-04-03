// overlay-values-integration.spec.ts
// Спецификация: docs/specs/plugin-values.md § Расширение overlay-step

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { runOverlayStep } from "../overlay-step.js";
import type { AdapterRegistryEntry } from "../types.js";
import type { LayerSource } from "../overlay-step.js";

/**
 * Минимальный стаб AdapterRegistryEntry для тестов overlay.
 */
function createTestEntry(
  overrides: Partial<AdapterRegistryEntry> = {},
): AdapterRegistryEntry {
  return {
    id: "test-adapter",
    description: "Test Adapter",
    instructions: {} as AdapterRegistryEntry["instructions"],
    skills: {} as AdapterRegistryEntry["skills"],
    agents: {} as AdapterRegistryEntry["agents"],
    targetRoot: ".test-target",
    targetFiles: [],
    ...overrides,
  };
}

describe("CLI", () => {
  describe("Расширение overlay-step — передача values в interpolate", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-overlay-values-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Spec: § Расширение overlay-step ---
    // "Операция overlay в multi-layer режиме при интерполяции файлов
    //  ДОЛЖНА передавать layer.values в interpolate в качестве параметра values."
    //
    // Шаг 2.6: interpolate(content, variables, env, layer.values)
    it("в multi-layer режиме передаёт layer.values в interpolate для подстановки ${values:*}", () => {
      const entry = createTestEntry({ id: "claude", targetRoot: ".claude" });

      // Создаём overlay для плагина с ${values:team_name}
      const pluginOverlayDir = path.join(tmpDir, "plugin-overlay", "claude");
      fs.mkdirSync(pluginOverlayDir, { recursive: true });
      fs.writeFileSync(
        path.join(pluginOverlayDir, "config.md"),
        "Team: ${values:team_name}",
      );

      const layers: LayerSource[] = [
        {
          id: "my-plugin",
          overlayDir: pluginOverlayDir,
          values: { team_name: "platform" },
        },
      ];

      const variables: Record<string, string> = {};

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        variables,
        env: {},
        layers,
      });

      expect(outcome.errors).toEqual([]);
      expect(outcome.writtenCount).toBeGreaterThan(0);

      const content = fs.readFileSync(path.join(tmpDir, "config.md"), "utf-8");
      expect(content).toBe("Team: platform");
    });

    // --- Spec: § Расширение overlay-step ---
    // "Интерполяция ${values:*} выполняется ПЕРЕД deep merge, что обеспечивает
    //  per-plugin изоляцию: каждый слой интерполируется своими resolved values
    //  до объединения с другими слоями."
    it("каждый слой в multi-layer режиме интерполируется своими values (per-plugin изоляция)", () => {
      const entry = createTestEntry({ id: "claude", targetRoot: ".claude" });

      // Плагин A: overlay с ${values:name} = "alpha"
      const overlayDirA = path.join(tmpDir, "plugin-a-overlay", "claude");
      fs.mkdirSync(overlayDirA, { recursive: true });
      fs.writeFileSync(
        path.join(overlayDirA, "settings.json"),
        '{"source": "${values:name}"}',
      );

      // Плагин B: overlay с ${values:name} = "beta"
      const overlayDirB = path.join(tmpDir, "plugin-b-overlay", "claude");
      fs.mkdirSync(overlayDirB, { recursive: true });
      fs.writeFileSync(
        path.join(overlayDirB, "settings.json"),
        '{"plugin": "${values:name}"}',
      );

      const layers: LayerSource[] = [
        {
          id: "plugin-a",
          overlayDir: overlayDirA,
          values: { name: "alpha" },
        },
        {
          id: "plugin-b",
          overlayDir: overlayDirB,
          values: { name: "beta" },
        },
      ];

      const variables: Record<string, string> = {};

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        variables,
        env: {},
        layers,
      });

      expect(outcome.errors).toEqual([]);

      // settings.json подвержен deep merge: plugin-a создаёт {"source":"alpha"},
      // plugin-b добавляет {"plugin":"beta"} → merge = {"source":"alpha","plugin":"beta"}
      const content = fs.readFileSync(
        path.join(tmpDir, "settings.json"),
        "utf-8",
      );
      const parsed = JSON.parse(content);
      expect(parsed.source).toBe("alpha");
      expect(parsed.plugin).toBe("beta");
    });

    // --- Spec: § Расширение overlay-step ---
    // "Операция overlay в legacy-режиме при наличии параметра values
    //  ДОЛЖНА передавать его в interpolate."
    it("в legacy-режиме передаёт параметр values в interpolate", () => {
      const entry = createTestEntry({ id: "claude", targetRoot: ".claude" });

      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      fs.mkdirSync(overlayDir, { recursive: true });
      fs.writeFileSync(
        path.join(overlayDir, "readme.md"),
        "Project: ${values:project_name}",
      );

      const variables: Record<string, string> = {};
      const values: Record<string, string> = { project_name: "agloom" };

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        variables,
        env: {},
        values,
      });

      expect(outcome.errors).toEqual([]);
      expect(outcome.writtenCount).toBe(1);

      const content = fs.readFileSync(path.join(tmpDir, "readme.md"), "utf-8");
      expect(content).toBe("Project: agloom");
    });

    // --- Spec: § Расширение overlay-step ---
    // Одновременная подстановка ${agloom:*}, ${env:*} и ${values:*}
    it("комбинирует ${agloom:*}, ${env:*} и ${values:*} в одном файле", () => {
      const entry = createTestEntry({ id: "claude", targetRoot: ".claude" });

      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      fs.mkdirSync(overlayDir, { recursive: true });
      fs.writeFileSync(
        path.join(overlayDir, "combined.md"),
        "Root: ${agloom:ROOT}, Env: ${env:MY_ENV}, Val: ${values:my_val}",
      );

      const variables: Record<string, string> = { ROOT: ".claude" };
      const env: Record<string, string> = { MY_ENV: "production" };
      const values: Record<string, string> = { my_val: "custom" };

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        variables,
        env,
        values,
      });

      expect(outcome.errors).toEqual([]);
      expect(outcome.writtenCount).toBe(1);

      const content = fs.readFileSync(
        path.join(tmpDir, "combined.md"),
        "utf-8",
      );
      expect(content).toBe("Root: .claude, Env: production, Val: custom");
    });

    // --- Расширение: ${values:NAME} с неизвестным NAME → InterpolationError ---
    // Spec: § Расширение функции interpolate, 7a
    // "NAME не найден в values → InterpolationError."
    it("добавляет ошибку при ${values:UNKNOWN} в overlay файле (multi-layer)", () => {
      const entry = createTestEntry({ id: "claude", targetRoot: ".claude" });

      const overlayDirPlugin = path.join(tmpDir, "plugin-overlay", "claude");
      fs.mkdirSync(overlayDirPlugin, { recursive: true });
      fs.writeFileSync(
        path.join(overlayDirPlugin, "bad.md"),
        "Missing: ${values:nonexistent}",
      );

      const layers: LayerSource[] = [
        {
          id: "plugin",
          overlayDir: overlayDirPlugin,
          values: {},
        },
      ];

      const variables: Record<string, string> = {};

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        variables,
        env: {},
        layers,
      });

      expect(outcome.errors).toHaveLength(1);
      expect(outcome.errors[0]).toContain("Interpolation failed for");
      expect(outcome.errors[0]).toContain("bad.md");
    });

    // --- Обратная совместимость: layer без values ---
    // Spec: § Обратная совместимость
    // "Если контент плагина не использует ${values:*} — поведение идентично текущему."
    it("слой без values интерполирует ${agloom:*} и ${env:*} без ошибок", () => {
      const entry = createTestEntry({ id: "claude", targetRoot: ".claude" });

      const overlayDirPlugin = path.join(tmpDir, "plugin-overlay", "claude");
      fs.mkdirSync(overlayDirPlugin, { recursive: true });
      fs.writeFileSync(
        path.join(overlayDirPlugin, "info.md"),
        "Root: ${agloom:ROOT_DIR}",
      );

      const layers: LayerSource[] = [
        {
          id: "plugin-no-values",
          overlayDir: overlayDirPlugin,
          // no values field
        },
      ];

      const variables: Record<string, string> = { ROOT_DIR: ".claude" };

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        variables,
        env: {},
        layers,
      });

      expect(outcome.errors).toEqual([]);
      expect(outcome.writtenCount).toBeGreaterThan(0);

      const content = fs.readFileSync(path.join(tmpDir, "info.md"), "utf-8");
      expect(content).toBe("Root: .claude");
    });

    // --- Граничное условие: legacy mode без values параметра ---
    // Файл с ${values:NAME} вызывает ошибку, т.к. values по умолчанию = {}
    it("legacy-режим без values: ${values:NAME} вызывает ошибку интерполяции", () => {
      const entry = createTestEntry({ id: "claude", targetRoot: ".claude" });

      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      fs.mkdirSync(overlayDir, { recursive: true });
      fs.writeFileSync(
        path.join(overlayDir, "fail.md"),
        "Val: ${values:missing}",
      );

      const variables: Record<string, string> = {};

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        variables,
        env: {},
        // no values param
      });

      expect(outcome.errors).toHaveLength(1);
      expect(outcome.errors[0]).toContain("Interpolation failed for");
    });
  });
});
