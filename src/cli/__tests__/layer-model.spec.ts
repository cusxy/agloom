// layer-model.spec.ts
// Спецификация: docs/specs/layer-model.md

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import yaml from "js-yaml";
import type { AdapterRegistryEntry } from "../types.js";

// Импорт функций, которые будут реализованы по спецификации layer-model.md.
// classifyFile — определяет стратегию слияния для файла (§ Определение стратегии для конкретного файла).
// deepMerge — рекурсивный deep merge двух объектов (§ Алгоритм deep merge).
// stripOverrideSuffix — удаляет суффикс .override из имени файла (§ Удаление суффикса при записи).
// runOverlayStep — рефакторенная операция overlay с поддержкой layers (§ Рефакторинг операции overlay).
import { classifyFile, deepMerge, stripOverrideSuffix, runOverlayStep } from "../overlay-step.js";

/**
 * Минимальный стаб AdapterRegistryEntry для тестов overlay.
 */
function createTestEntry(overrides: Partial<AdapterRegistryEntry> = {}): AdapterRegistryEntry {
  return {
    id: "test-adapter",
    description: "Test Adapter",
    instructions: {} as AdapterRegistryEntry["instructions"],
    skills: {} as AdapterRegistryEntry["skills"],
    agents: {} as AdapterRegistryEntry["agents"],
    targetRoot: ".test-target",
    targetFiles: [],
    projectFiles: [],
    instructionsFile: null,
    dependsOn: [],
    hidden: false,
    overlayImportPaths: [],
    paths: {},
    ...overrides,
  };
}

// =============================================================================
// § Классификация файлов по стратегии слияния
// =============================================================================

describe("Модель слоёв", () => {
  describe("Классификация файлов по стратегии слияния", () => {
    // --- Happy path: merge-eligible форматы ---
    // § Merge-eligible форматы: .json, .jsonc, .yaml, .yml, .toml
    it("классифицирует .json как merge-eligible (стратегия overlay)", () => {
      expect(classifyFile("settings.json")).toBe("overlay");
    });

    it("классифицирует .jsonc как merge-eligible (стратегия overlay)", () => {
      expect(classifyFile("tsconfig.jsonc")).toBe("overlay");
    });

    it("классифицирует .yaml как merge-eligible (стратегия overlay)", () => {
      expect(classifyFile("config.yaml")).toBe("overlay");
    });

    it("классифицирует .yml как merge-eligible (стратегия overlay)", () => {
      expect(classifyFile("docker-compose.yml")).toBe("overlay");
    });

    it("классифицирует .toml как merge-eligible (стратегия overlay)", () => {
      expect(classifyFile("cargo.toml")).toBe("overlay");
    });

    // --- Трансформация: case-insensitive сравнение расширений ---
    // § Сравнение расширения ДОЛЖНО быть case-insensitive
    it("выполняет case-insensitive сравнение расширений для merge-eligible", () => {
      expect(classifyFile("settings.JSON")).toBe("overlay");
      expect(classifyFile("settings.Json")).toBe("overlay");
      expect(classifyFile("config.YAML")).toBe("overlay");
      expect(classifyFile("config.YML")).toBe("overlay");
      expect(classifyFile("config.TOML")).toBe("overlay");
      expect(classifyFile("config.Jsonc")).toBe("overlay");
    });

    // --- Override-only форматы ---
    // § Override-only форматы: .md, .txt, .html, .svg, .xml, .jsonl, бинарные
    it("классифицирует .md как override-only", () => {
      expect(classifyFile("readme.md")).toBe("override");
    });

    it("классифицирует .txt как override-only", () => {
      expect(classifyFile("notes.txt")).toBe("override");
    });

    it("классифицирует .xml как override-only", () => {
      expect(classifyFile("pom.xml")).toBe("override");
    });

    it("классифицирует .jsonl как override-only", () => {
      expect(classifyFile("logs.jsonl")).toBe("override");
    });

    it("классифицирует .html как override-only", () => {
      expect(classifyFile("index.html")).toBe("override");
    });

    it("классифицирует .svg как override-only", () => {
      expect(classifyFile("icon.svg")).toBe("override");
    });

    it("классифицирует бинарные файлы (.png) как override-only", () => {
      expect(classifyFile("image.png")).toBe("override");
    });

    it("классифицирует файлы без расширения как override-only", () => {
      expect(classifyFile("Makefile")).toBe("override");
    });

    // --- Правило 1: суффикс .override → стратегия override ---
    // § Определение стратегии: если имя файла содержит суффикс .override
    // перед расширением — стратегия override, независимо от расширения
    it("классифицирует файл с суффиксом .override как override, даже для merge-eligible расширений", () => {
      expect(classifyFile("settings.override.json")).toBe("override");
      expect(classifyFile("config.override.yaml")).toBe("override");
      expect(classifyFile("config.override.yml")).toBe("override");
      expect(classifyFile("config.override.toml")).toBe("override");
      expect(classifyFile("tsconfig.override.jsonc")).toBe("override");
    });

    // --- Суффикс .override для override-only форматов (допускается, но не меняет поведения) ---
    // § Область применения суффикса: для override-only форматов суффикс допускается
    it("классифицирует файл с суффиксом .override и override-only расширением как override", () => {
      expect(classifyFile("readme.override.md")).toBe("override");
      expect(classifyFile("data.override.xml")).toBe("override");
    });
  });

  // =============================================================================
  // § Конвенция .override — удаление суффикса при записи
  // =============================================================================

  describe("Конвенция .override — удаление суффикса", () => {
    // § Удаление суффикса при записи:
    // Файл settings.override.json → settings.json
    it("удаляет суффикс .override из имени файла", () => {
      expect(stripOverrideSuffix("settings.override.json")).toBe("settings.json");
    });

    it("удаляет суффикс .override из YAML-файла", () => {
      expect(stripOverrideSuffix("config.override.yaml")).toBe("config.yaml");
    });

    it("удаляет суффикс .override из override-only форматов", () => {
      expect(stripOverrideSuffix("readme.override.md")).toBe("readme.md");
    });

    // Граничное условие: файл без суффикса .override — возвращает как есть
    it("возвращает имя файла без изменений, если суффикс .override отсутствует", () => {
      expect(stripOverrideSuffix("settings.json")).toBe("settings.json");
    });

    // Граничное условие: файл с .override в пути (но не перед финальным расширением)
    it("обрабатывает путь с директорией, содержащей .override в имени", () => {
      expect(stripOverrideSuffix(path.join("overrides", "settings.override.json"))).toBe(
        path.join("overrides", "settings.json"),
      );
    });

    // Граничное условие: файл с множественными точками в имени
    it("удаляет только суффикс .override непосредственно перед финальным расширением", () => {
      expect(stripOverrideSuffix("my.config.override.json")).toBe("my.config.json");
    });
  });

  // =============================================================================
  // § Алгоритм deep merge
  // =============================================================================

  describe("Алгоритм deep merge", () => {
    // --- Правило 1: оба значения — объекты → рекурсивное слияние ---
    // § Правила слияния, п. 1
    it("рекурсивно сливает два объекта, сохраняя ключи только из base", () => {
      const base = { a: 1, b: { x: 10, y: 20 } };
      const incoming = { b: { x: 30, z: 40 } };
      const result = deepMerge(base, incoming);
      expect(result).toEqual({ a: 1, b: { x: 30, y: 20, z: 40 } });
    });

    // --- Правило 2: incoming — массив → полная замена ---
    // § Правила слияния, п. 2
    it("заменяет массив base целиком массивом incoming (не append)", () => {
      const base = { rulers: [80, 120] };
      const incoming = { rulers: [100] };
      const result = deepMerge(base, incoming);
      expect(result).toEqual({ rulers: [100] });
    });

    it("заменяет не-массив в base массивом из incoming", () => {
      const base = { items: "not-an-array" };
      const incoming = { items: [1, 2, 3] };
      const result = deepMerge(base, incoming);
      expect(result).toEqual({ items: [1, 2, 3] });
    });

    // --- Правило 3: incoming === null → удаление ключа ---
    // § Правила слияния, п. 3
    it("удаляет ключ из результата, если incoming имеет значение null", () => {
      const base = { a: 1, b: 2, c: 3 };
      const incoming = { b: null };
      const result = deepMerge(base, incoming);
      expect(result).toEqual({ a: 1, c: 3 });
      expect("b" in result).toBe(false);
    });

    it("удаляет вложенный объект при null в incoming", () => {
      const base = { files: { exclude: ["node_modules"] } };
      const incoming = { files: null };
      const result = deepMerge(base, incoming);
      expect(result).toEqual({});
      expect("files" in result).toBe(false);
    });

    // --- Правило 4: скалярные значения → last-writer-wins ---
    // § Правила слияния, п. 4
    it("заменяет скалярное значение base значением incoming (last-writer-wins)", () => {
      const base = { fontSize: 14 };
      const incoming = { fontSize: 16 };
      const result = deepMerge(base, incoming);
      expect(result).toEqual({ fontSize: 16 });
    });

    it("заменяет строковое значение", () => {
      const base = { name: "old" };
      const incoming = { name: "new" };
      const result = deepMerge(base, incoming);
      expect(result).toEqual({ name: "new" });
    });

    it("заменяет булево значение", () => {
      const base = { enabled: true };
      const incoming = { enabled: false };
      const result = deepMerge(base, incoming);
      expect(result).toEqual({ enabled: false });
    });

    // --- Правило 5: incoming — объект, base — не объект → замена ---
    // § Правила слияния, п. 5
    it("заменяет скалярное значение base объектом из incoming", () => {
      const base = { config: "string-value" };
      const incoming = { config: { key: "value" } };
      const result = deepMerge(base, incoming);
      expect(result).toEqual({ config: { key: "value" } });
    });

    it("заменяет массив в base объектом из incoming", () => {
      const base = { config: [1, 2, 3] };
      const incoming = { config: { key: "value" } };
      const result = deepMerge(base, incoming);
      expect(result).toEqual({ config: { key: "value" } });
    });

    // --- Комплексный пример из спецификации ---
    // § Пример deep merge
    it("корректно выполняет deep merge из примера в спецификации", () => {
      const base = {
        editor: {
          fontSize: 14,
          tabSize: 2,
          rulers: [80, 120],
        },
        files: {
          exclude: ["node_modules"],
        },
      };
      const incoming = {
        editor: {
          fontSize: 16,
          rulers: [100],
          wordWrap: "on",
        },
        files: null,
      };
      const result = deepMerge(base, incoming);
      expect(result).toEqual({
        editor: {
          fontSize: 16,
          tabSize: 2,
          rulers: [100],
          wordWrap: "on",
        },
      });
      expect("files" in result).toBe(false);
    });

    // --- Граничные условия ---

    it("возвращает копию incoming, если base — пустой объект", () => {
      const base = {};
      const incoming = { a: 1, b: { c: 2 } };
      const result = deepMerge(base, incoming);
      expect(result).toEqual({ a: 1, b: { c: 2 } });
    });

    it("возвращает копию base, если incoming — пустой объект", () => {
      const base = { a: 1, b: { c: 2 } };
      const incoming = {};
      const result = deepMerge(base, incoming);
      expect(result).toEqual({ a: 1, b: { c: 2 } });
    });

    it("корректно обрабатывает глубокую вложенность (3+ уровня)", () => {
      const base = { a: { b: { c: { d: 1 } } } };
      const incoming = { a: { b: { c: { e: 2 } } } };
      const result = deepMerge(base, incoming);
      expect(result).toEqual({ a: { b: { c: { d: 1, e: 2 } } } });
    });

    it("null удаляет ключ на глубоком уровне вложенности", () => {
      const base = { a: { b: { c: 1, d: 2 } } };
      const incoming = { a: { b: { c: null } } };
      const result = deepMerge(base, incoming);
      expect(result).toEqual({ a: { b: { d: 2 } } });
      expect("c" in (result as Record<string, unknown>).a!).toBe(false);
    });

    it("пустой массив в incoming заменяет непустой массив в base", () => {
      const base = { items: [1, 2, 3] };
      const incoming = { items: [] };
      const result = deepMerge(base, incoming);
      expect(result).toEqual({ items: [] });
    });
  });

  // =============================================================================
  // § Рефакторинг операции overlay (cli:procedure) — multi-layer processing
  // =============================================================================

  describe("Операция overlay — multi-layer processing", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-layer-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    /**
     * Создаёт директорию слоя с указанными файлами.
     * Возвращает абсолютный путь к директории слоя.
     */
    function createLayer(layerId: string, files: Record<string, string | Buffer>): string {
      const layerDir = path.join(tmpDir, "layers", layerId);
      for (const [relativePath, content] of Object.entries(files)) {
        const filePath = path.join(layerDir, relativePath);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        if (typeof content === "string") {
          fs.writeFileSync(filePath, content, "utf-8");
        } else {
          fs.writeFileSync(filePath, content);
        }
      }
      return layerDir;
    }

    // --- Happy path: шаги 1-4 основного поведения ---
    // § Изменения в поведении, шаги 1-4
    it("применяет единственный слой с merge-eligible файлом и записывает результат", () => {
      const entry = createTestEntry({ id: "claude" });
      const layerDir = createLayer("local", {
        "settings.json": JSON.stringify({ editor: { fontSize: 14 } }),
      });

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [{ id: "local", overlayDir: layerDir }],
      });

      expect(outcome.name).toBe("Overlay");
      expect(outcome.writtenCount).toBe(1);
      expect(outcome.errors).toEqual([]);

      const written = JSON.parse(fs.readFileSync(path.join(tmpDir, "settings.json"), "utf-8"));
      expect(written).toEqual({ editor: { fontSize: 14 } });
    });

    // --- Happy path: deep merge между двумя слоями ---
    // § Порядок применения слоёв + § Алгоритм deep merge
    it("выполняет deep merge JSON-файла из двух слоёв (позднейший слой имеет приоритет)", () => {
      const entry = createTestEntry({ id: "claude" });

      const pluginDir = createLayer("plugin-a", {
        "settings.json": JSON.stringify({
          editor: { fontSize: 14, tabSize: 2 },
        }),
      });
      const localDir = createLayer("local", {
        "settings.json": JSON.stringify({ editor: { fontSize: 16 } }),
      });

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [
          { id: "plugin-a", overlayDir: pluginDir },
          { id: "local", overlayDir: localDir },
        ],
      });

      expect(outcome.writtenCount).toBe(1);
      expect(outcome.errors).toEqual([]);

      const written = JSON.parse(fs.readFileSync(path.join(tmpDir, "settings.json"), "utf-8"));
      expect(written).toEqual({ editor: { fontSize: 16, tabSize: 2 } });
    });

    // --- Deep merge с тремя слоями ---
    // § Приоритет слоёв: первый плагин → второй плагин → локальный проект
    it("применяет три слоя последовательно, каждый мержится поверх предыдущего", () => {
      const entry = createTestEntry({ id: "claude" });

      const layer1 = createLayer("plugin-a", {
        "config.yaml": "editor:\n  fontSize: 12\n  tabSize: 4\n  theme: dark\n",
      });
      const layer2 = createLayer("plugin-b", {
        "config.yaml": "editor:\n  fontSize: 14\n  wordWrap: 'on'\n",
      });
      const layer3 = createLayer("local", {
        "config.yaml": "editor:\n  fontSize: 16\n",
      });

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [
          { id: "plugin-a", overlayDir: layer1 },
          { id: "plugin-b", overlayDir: layer2 },
          { id: "local", overlayDir: layer3 },
        ],
      });

      expect(outcome.writtenCount).toBe(1);
      expect(outcome.errors).toEqual([]);

      // Результат: fontSize=16 (local wins), tabSize=4 (plugin-a, сохранён),
      // theme=dark (plugin-a, сохранён), wordWrap=on (plugin-b, сохранён)
      const content = fs.readFileSync(path.join(tmpDir, "config.yaml"), "utf-8");
      const parsed = yaml.load(content) as Record<string, unknown>;
      expect(parsed).toEqual({
        editor: {
          fontSize: 16,
          tabSize: 4,
          theme: "dark",
          wordWrap: "on",
        },
      });
    });

    // --- Override-only файл: последний слой полностью заменяет ---
    // § При конфликте для override-only файлов — последний слой полностью заменяет
    it("полностью заменяет override-only файл (.md) последним слоем", () => {
      const entry = createTestEntry({ id: "claude" });

      const pluginDir = createLayer("plugin-a", {
        "readme.md": "Plugin content",
      });
      const localDir = createLayer("local", {
        "readme.md": "Local content",
      });

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [
          { id: "plugin-a", overlayDir: pluginDir },
          { id: "local", overlayDir: localDir },
        ],
      });

      expect(outcome.writtenCount).toBe(1);
      expect(outcome.errors).toEqual([]);

      const written = fs.readFileSync(path.join(tmpDir, "readme.md"), "utf-8");
      expect(written).toBe("Local content");
    });

    // --- Суффикс .override: файл записывается без суффикса ---
    // § Удаление суффикса при записи: settings.override.json → settings.json
    it("удаляет суффикс .override из имени файла при записи в целевой путь", () => {
      const entry = createTestEntry({ id: "claude" });

      const layerDir = createLayer("local", {
        "settings.override.json": JSON.stringify({ key: "value" }),
      });

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [{ id: "local", overlayDir: layerDir }],
      });

      expect(outcome.writtenCount).toBe(1);
      expect(outcome.errors).toEqual([]);

      // Файл записан как settings.json, не settings.override.json
      expect(fs.existsSync(path.join(tmpDir, "settings.json"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, "settings.override.json"))).toBe(false);
    });

    // --- Суффикс .override для merge-eligible → полная замена (не merge) ---
    // § Определение стратегии, правило 1: .override → override, независимо от расширения
    it("использует стратегию override (полная замена) для merge-eligible файла с суффиксом .override", () => {
      const entry = createTestEntry({ id: "claude" });

      const pluginDir = createLayer("plugin-a", {
        "settings.json": JSON.stringify({ a: 1, b: 2 }),
      });
      const localDir = createLayer("local", {
        // .override.json → стратегия override, полная замена, записывается как settings.json
        "settings.override.json": JSON.stringify({ c: 3 }),
      });

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [
          { id: "plugin-a", overlayDir: pluginDir },
          { id: "local", overlayDir: localDir },
        ],
      });

      expect(outcome.writtenCount).toBe(1);
      expect(outcome.errors).toEqual([]);

      const written = JSON.parse(fs.readFileSync(path.join(tmpDir, "settings.json"), "utf-8"));
      // Полная замена, не merge: только {c: 3}, без a и b
      expect(written).toEqual({ c: 3 });
    });

    // --- null в incoming удаляет ключ при merge через слои ---
    // § Правила слияния, п. 3 — null удаляет ключ
    it("удаляет ключ из merge результата при null в incoming слое", () => {
      const entry = createTestEntry({ id: "claude" });

      const pluginDir = createLayer("plugin-a", {
        "settings.json": JSON.stringify({ a: 1, b: 2, c: 3 }),
      });
      const localDir = createLayer("local", {
        "settings.json": JSON.stringify({ b: null }),
      });

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [
          { id: "plugin-a", overlayDir: pluginDir },
          { id: "local", overlayDir: localDir },
        ],
      });

      expect(outcome.writtenCount).toBe(1);
      expect(outcome.errors).toEqual([]);

      const written = JSON.parse(fs.readFileSync(path.join(tmpDir, "settings.json"), "utf-8"));
      expect(written).toEqual({ a: 1, c: 3 });
      expect("b" in written).toBe(false);
    });

    // --- Массивы заменяются целиком при merge ---
    // § Правила слияния, п. 2
    it("заменяет массив целиком при merge через слои (не append)", () => {
      const entry = createTestEntry({ id: "claude" });

      const pluginDir = createLayer("plugin-a", {
        "settings.json": JSON.stringify({ rulers: [80, 120] }),
      });
      const localDir = createLayer("local", {
        "settings.json": JSON.stringify({ rulers: [100] }),
      });

      const _outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [
          { id: "plugin-a", overlayDir: pluginDir },
          { id: "local", overlayDir: localDir },
        ],
      });

      const written = JSON.parse(fs.readFileSync(path.join(tmpDir, "settings.json"), "utf-8"));
      expect(written).toEqual({ rulers: [100] });
    });

    // --- Интерполяция выполняется перед merge ---
    // § Взаимодействие с интерполяцией: интерполяция ПЕРЕД merge
    it("выполняет интерполяцию содержимого перед deep merge", () => {
      const entry = createTestEntry({ id: "claude" });

      const pluginDir = createLayer("plugin-a", {
        "config.json": JSON.stringify({ root: "plugin-value", keep: true }),
      });
      const localDir = createLayer("local", {
        "config.json": '{"root": "${agloom:ROOT_DIR}"}',
      });

      const variables: Record<string, string> = { ROOT_DIR: ".claude" };

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [
          { id: "plugin-a", overlayDir: pluginDir },
          { id: "local", overlayDir: localDir },
        ],
        variables,
        env: {},
      });

      expect(outcome.errors).toEqual([]);

      const written = JSON.parse(fs.readFileSync(path.join(tmpDir, "config.json"), "utf-8"));
      // root заменён интерполированным значением, keep сохранён из plugin
      expect(written).toEqual({ root: ".claude", keep: true });
    });

    // --- Файлы из разных слоёв по разным путям не конфликтуют ---
    // § Шаг 2.3: для каждого файла определить относительный путь
    it("записывает файлы из разных слоёв по разным путям без конфликтов", () => {
      const entry = createTestEntry({ id: "claude" });

      const pluginDir = createLayer("plugin-a", {
        "a.json": JSON.stringify({ from: "plugin" }),
      });
      const localDir = createLayer("local", {
        "b.json": JSON.stringify({ from: "local" }),
      });

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [
          { id: "plugin-a", overlayDir: pluginDir },
          { id: "local", overlayDir: localDir },
        ],
      });

      expect(outcome.writtenCount).toBe(2);
      expect(outcome.errors).toEqual([]);

      expect(JSON.parse(fs.readFileSync(path.join(tmpDir, "a.json"), "utf-8"))).toEqual({ from: "plugin" });
      expect(JSON.parse(fs.readFileSync(path.join(tmpDir, "b.json"), "utf-8"))).toEqual({ from: "local" });
    });

    // --- mergeState с существующим целевым файлом ---
    // § Шаг 2.7: deep merge с mergeState или с содержимым существующего целевого файла
    it("мержит первый слой с существующим целевым файлом, если mergeState пуст", () => {
      const entry = createTestEntry({ id: "claude" });

      // Существующий файл в целевой директории (от предыдущих транспилерных шагов)
      fs.writeFileSync(
        path.join(tmpDir, "settings.json"),
        JSON.stringify({ existing: true, editor: { fontSize: 12 } }),
      );

      const layerDir = createLayer("local", {
        "settings.json": JSON.stringify({
          editor: { fontSize: 16, theme: "dark" },
        }),
      });

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [{ id: "local", overlayDir: layerDir }],
      });

      expect(outcome.errors).toEqual([]);

      const written = JSON.parse(fs.readFileSync(path.join(tmpDir, "settings.json"), "utf-8"));
      expect(written).toEqual({
        existing: true,
        editor: { fontSize: 16, theme: "dark" },
      });
    });

    // --- hotfix-регрессия: .jsonc merge-eligible с JSON.parse ---
    // § Парсинг файлов для merge: "Для .jsonc ТРЕБУЕТСЯ использовать стандартный
    // JSON-парсер (JSON.parse)". Два слоя .jsonc должны deep-merge'иться как JSON.
    it("выполняет deep merge .jsonc-файла из двух слоёв (JSON.parse)", () => {
      const entry = createTestEntry({ id: "kilocode" });

      const pluginDir = createLayer("plugin-a", {
        "kilo.jsonc": JSON.stringify({
          $schema: "https://app.kilo.ai/config.json",
          mcpServers: { a: { command: "npx", args: ["-y", "a"] } },
        }),
      });
      const localDir = createLayer("local", {
        "kilo.jsonc": JSON.stringify({
          mcpServers: { b: { command: "node", args: ["b.js"] } },
        }),
      });

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [
          { id: "plugin-a", overlayDir: pluginDir },
          { id: "local", overlayDir: localDir },
        ],
      });

      expect(outcome.writtenCount).toBe(1);
      expect(outcome.errors).toEqual([]);

      const written = JSON.parse(fs.readFileSync(path.join(tmpDir, "kilo.jsonc"), "utf-8"));
      expect(written).toEqual({
        $schema: "https://app.kilo.ai/config.json",
        mcpServers: {
          a: { command: "npx", args: ["-y", "a"] },
          b: { command: "node", args: ["b.js"] },
        },
      });
    });

    // --- hotfix-регрессия: невалидный JSONC base → rewrite целиком ---
    // § Парсинг файлов для merge: "Если существующий базовый .jsonc-файл содержит
    // JSONC-специфичные конструкции ... и не распарсивается стандартным JSON-парсером --
    // base ТРЕБУЕТСЯ игнорировать и полностью перезаписать файл результатом merge".
    it("перезаписывает .jsonc целиком, если существующий base содержит // комментарии", () => {
      const entry = createTestEntry({ id: "kilocode" });

      // Существующий файл с JSONC-комментариями — невалидный JSON
      fs.writeFileSync(
        path.join(tmpDir, "kilo.jsonc"),
        '// user comment\n{\n  "mcpServers": { "old": { "command": "old" } }\n}\n',
      );

      const layerDir = createLayer("local", {
        "kilo.jsonc": JSON.stringify({
          $schema: "https://app.kilo.ai/config.json",
          mcpServers: { fresh: { command: "npx" } },
        }),
      });

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [{ id: "local", overlayDir: layerDir }],
      });

      expect(outcome.errors).toEqual([]);

      const written = JSON.parse(fs.readFileSync(path.join(tmpDir, "kilo.jsonc"), "utf-8"));
      // base полностью отброшен: нет сервера "old", только "fresh"
      expect(written).toEqual({
        $schema: "https://app.kilo.ai/config.json",
        mcpServers: { fresh: { command: "npx" } },
      });
    });

    // --- Сериализация результата в формат incoming файла ---
    // § Парсинг файлов для merge: после merge результат сериализуется в формат incoming
    it("сериализует результат merge в формат incoming файла (YAML)", () => {
      const entry = createTestEntry({ id: "claude" });

      const pluginDir = createLayer("plugin-a", {
        "config.yml": "editor:\n  fontSize: 14\n  tabSize: 2\n",
      });
      const localDir = createLayer("local", {
        "config.yml": "editor:\n  fontSize: 16\n",
      });

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [
          { id: "plugin-a", overlayDir: pluginDir },
          { id: "local", overlayDir: localDir },
        ],
      });

      expect(outcome.errors).toEqual([]);

      // Результат записан как YAML (не JSON)
      const content = fs.readFileSync(path.join(tmpDir, "config.yml"), "utf-8");
      // Должен содержать YAML-формат, а не JSON
      expect(content).not.toContain("{");
      expect(content).toContain("fontSize");
    });

    // ==========================================================================
    // Расширения
    // ==========================================================================

    // --- Расширение 2.2a: директория-источник слоя не существует → пропустить ---
    // § Новые расширения, 2.2a
    it("пропускает слой, если его директория-источник не существует", () => {
      const entry = createTestEntry({ id: "claude" });

      const localDir = createLayer("local", {
        "settings.json": JSON.stringify({ key: "value" }),
      });

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [
          { id: "plugin-missing", overlayDir: "/nonexistent/path" },
          { id: "local", overlayDir: localDir },
        ],
      });

      expect(outcome.writtenCount).toBe(1);
      expect(outcome.errors).toEqual([]);

      const written = JSON.parse(fs.readFileSync(path.join(tmpDir, "settings.json"), "utf-8"));
      expect(written).toEqual({ key: "value" });
    });

    // --- Расширение 2.6a: InterpolationError → добавить в errors, пропустить файл ---
    // § Новые расширения, 2.6a
    it("добавляет ошибку интерполяции в errors с идентификатором слоя и продолжает", () => {
      const entry = createTestEntry({ id: "claude" });

      const layerDir = createLayer("plugin-a", {
        "bad.md": "Value: ${agloom:NONEXISTENT}",
        "good.md": "Value: ${agloom:ROOT_DIR}",
      });

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [{ id: "plugin-a", overlayDir: layerDir }],
        variables: { ROOT_DIR: ".claude" },
        env: {},
      });

      expect(outcome.writtenCount).toBe(1);
      expect(outcome.errors).toHaveLength(1);
      // Формат: "Interpolation failed for {layer.id}:{relativePath}: {причина}"
      expect(outcome.errors[0]).toContain("Interpolation failed for");
      expect(outcome.errors[0]).toContain("plugin-a");
      expect(outcome.errors[0]).toContain("bad.md");
    });

    // --- Расширение 2.7a: ошибка парсинга → добавить в errors, пропустить файл ---
    // § Новые расширения, 2.7a
    it("добавляет ошибку парсинга в errors с идентификатором слоя при невалидном JSON", () => {
      const entry = createTestEntry({ id: "claude" });

      const layerDir = createLayer("plugin-a", {
        "bad.json": "{ invalid json ]]]",
        "good.json": JSON.stringify({ key: "value" }),
      });

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [{ id: "plugin-a", overlayDir: layerDir }],
      });

      // good.json записан, bad.json пропущен
      expect(outcome.writtenCount).toBe(1);
      expect(outcome.errors).toHaveLength(1);
      // Формат: "Parse failed for {layer.id}:{relativePath}: {причина}"
      expect(outcome.errors[0]).toContain("Parse failed for");
      expect(outcome.errors[0]).toContain("plugin-a");
      expect(outcome.errors[0]).toContain("bad.json");
    });

    // --- Расширение 2.7a: ошибка парсинга YAML ---
    it("добавляет ошибку парсинга в errors при невалидном YAML", () => {
      const entry = createTestEntry({ id: "claude" });

      const layerDir = createLayer("local", {
        "bad.yaml": ":\n  - :\n    :\n  invalid: [yaml: [",
      });

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [{ id: "local", overlayDir: layerDir }],
      });

      expect(outcome.errors).toHaveLength(1);
      expect(outcome.errors[0]).toContain("Parse failed for");
      expect(outcome.errors[0]).toContain("local");
    });

    // --- Расширение 3.3a: ошибка записи → добавить в errors, продолжить ---
    // § Новые расширения, 3.3a
    it("добавляет ошибку записи в errors и продолжает с оставшимися записями", () => {
      const entry = createTestEntry({ id: "claude" });

      const layerDir = createLayer("local", {
        "blocked-dir/file.json": JSON.stringify({ key: "blocked" }),
        "ok-file.json": JSON.stringify({ key: "ok" }),
      });

      // Создаём файл (не каталог) по целевому пути, чтобы запись в подкаталог провалилась
      fs.writeFileSync(path.join(tmpDir, "blocked-dir"), "I am a file");

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [{ id: "local", overlayDir: layerDir }],
      });

      expect(outcome.errors.length).toBeGreaterThanOrEqual(1);
      // ok-file.json должен быть записан
      const okFile = JSON.parse(fs.readFileSync(path.join(tmpDir, "ok-file.json"), "utf-8"));
      expect(okFile).toEqual({ key: "ok" });
    });

    // --- Обратная совместимость: без параметра layers ---
    // § Отношение к существующим спецификациям: при вызове без layers поведение
    // ДОЛЖНО соответствовать текущей спецификации provider-overlay.md
    it("работает в режиме обратной совместимости без параметра layers (единственный источник)", () => {
      const entry = createTestEntry({ id: "claude" });

      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      fs.mkdirSync(overlayDir, { recursive: true });
      fs.writeFileSync(path.join(overlayDir, "config.md"), "Root: ${agloom:ROOT_DIR}");

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        variables: { ROOT_DIR: ".claude" },
        env: {},
      });

      expect(outcome.name).toBe("Overlay");
      expect(outcome.writtenCount).toBe(1);
      expect(outcome.errors).toEqual([]);
    });

    // --- Граничное условие: пустой массив layers ---
    it("возвращает writtenCount: 0 при пустом массиве layers", () => {
      const entry = createTestEntry({ id: "claude" });

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [],
      });

      expect(outcome.name).toBe("Overlay");
      expect(outcome.writtenCount).toBe(0);
      expect(outcome.errors).toEqual([]);
    });

    // --- Суффикс .override удаляется для override-only форматов тоже ---
    // § Область применения суффикса: суффикс всё равно ТРЕБУЕТСЯ удалить при записи
    it("удаляет суффикс .override при записи для override-only форматов", () => {
      const entry = createTestEntry({ id: "claude" });

      const layerDir = createLayer("local", {
        "readme.override.md": "Content",
      });

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [{ id: "local", overlayDir: layerDir }],
      });

      expect(outcome.writtenCount).toBe(1);
      expect(fs.existsSync(path.join(tmpDir, "readme.md"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, "readme.override.md"))).toBe(false);
    });

    // --- TranspilerStepOutcome содержит name: "Overlay" и корректный writtenCount ---
    // § Шаг 4: сформировать TranspilerStepOutcome
    it("возвращает TranspilerStepOutcome с корректным writtenCount для нескольких файлов из нескольких слоёв", () => {
      const entry = createTestEntry({ id: "claude" });

      const pluginDir = createLayer("plugin-a", {
        "a.json": JSON.stringify({ from: "plugin" }),
        "b.md": "plugin readme",
      });
      const localDir = createLayer("local", {
        "c.json": JSON.stringify({ from: "local" }),
      });

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [
          { id: "plugin-a", overlayDir: pluginDir },
          { id: "local", overlayDir: localDir },
        ],
      });

      expect(outcome.name).toBe("Overlay");
      // 3 уникальных целевых пути: a.json, b.md, c.json
      expect(outcome.writtenCount).toBe(3);
      expect(outcome.errors).toEqual([]);
    });

    // --- Бинарные файлы копируются побайтово в multi-layer режиме ---
    // § Шаг 2.8: override — сохранить содержимое или путь для побайтового копирования
    it("копирует бинарные файлы побайтово в режиме multi-layer", () => {
      const entry = createTestEntry({ id: "claude" });

      const binaryContent = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      const layerDir = createLayer("local", {
        "image.png": binaryContent,
      });

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [{ id: "local", overlayDir: layerDir }],
      });

      expect(outcome.writtenCount).toBe(1);
      expect(outcome.errors).toEqual([]);

      const copied = fs.readFileSync(path.join(tmpDir, "image.png"));
      expect(Buffer.compare(copied, binaryContent)).toBe(0);
    });
  });
});
