// layer-model-toml.spec.ts
// Спецификация: docs/specs/layer-model.md § Алгоритм deep merge (TOML),
//               § Правила слияния (правило 2: массивы заменяются целиком)

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as TOML from "smol-toml";
// LayerMergeError будет реализован в фазе Implement (Cycle 1).
// Местоположение: предполагается src/cli/overlay-step.ts (рядом с остальным кодом
// layer-model). Если implementer решит вынести в отдельный модуль (например,
// src/cli/errors.ts) — путь импорта ТРЕБУЕТСЯ обновить.
import { deepMerge, runOverlayStep } from "../overlay-step.js";
import type { AdapterRegistryEntry } from "../types.js";

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
// § Алгоритм deep merge — поддержка TOML как merge-eligible формата
// =============================================================================

describe("Layer model — TOML deep merge", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-toml-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function createLayer(layerId: string, files: Record<string, string>): string {
    const layerDir = path.join(tmpDir, "layers", layerId);
    for (const [rel, content] of Object.entries(files)) {
      const filePath = path.join(layerDir, rel);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, "utf-8");
    }
    return layerDir;
  }

  // --- Два TOML с непересекающимися top-level таблицами → все таблицы сохранены ---
  it("сливает два TOML-файла с непересекающимися top-level таблицами", () => {
    const entry = createTestEntry({ id: "codex" });
    const layer1 = createLayer("plugin-a", {
      "config.toml": "[editor]\nfontSize = 14\n",
    });
    const layer2 = createLayer("local", {
      "config.toml": "[window]\nwidth = 800\n",
    });

    const outcome = runOverlayStep({
      entry,
      projectRoot: tmpDir,
      layers: [
        { id: "plugin-a", overlayDir: layer1 },
        { id: "local", overlayDir: layer2 },
      ],
    });

    expect(outcome.errors).toEqual([]);
    const content = fs.readFileSync(path.join(tmpDir, "config.toml"), "utf-8");
    const parsed = TOML.parse(content) as any;
    expect(parsed.editor).toEqual({ fontSize: 14 });
    expect(parsed.window).toEqual({ width: 800 });
  });

  // --- Вложенные таблицы: рекурсивный merge ---
  it("рекурсивно сливает вложенные таблицы TOML (nested tables)", () => {
    const entry = createTestEntry({ id: "codex" });
    const layer1 = createLayer("plugin-a", {
      "config.toml": '[mcp_servers.fs]\ncommand = "npx"\n\n[mcp_servers.fs.env]\nA = "1"\n',
    });
    const layer2 = createLayer("local", {
      "config.toml": '[mcp_servers.fs.env]\nB = "2"\n',
    });

    const outcome = runOverlayStep({
      entry,
      projectRoot: tmpDir,
      layers: [
        { id: "plugin-a", overlayDir: layer1 },
        { id: "local", overlayDir: layer2 },
      ],
    });

    expect(outcome.errors).toEqual([]);
    const parsed = TOML.parse(fs.readFileSync(path.join(tmpDir, "config.toml"), "utf-8")) as any;
    expect(parsed.mcp_servers.fs.command).toBe("npx");
    expect(parsed.mcp_servers.fs.env).toEqual({ A: "1", B: "2" });
  });

  // --- Конфликтующие скаляры: last-writer-wins ---
  it("конфликтующие скалярные значения разрешаются last-writer-wins", () => {
    const entry = createTestEntry({ id: "codex" });
    const layer1 = createLayer("plugin-a", {
      "config.toml": '[editor]\nfontSize = 14\ntheme = "dark"\n',
    });
    const layer2 = createLayer("local", {
      "config.toml": "[editor]\nfontSize = 16\n",
    });

    runOverlayStep({
      entry,
      projectRoot: tmpDir,
      layers: [
        { id: "plugin-a", overlayDir: layer1 },
        { id: "local", overlayDir: layer2 },
      ],
    });

    const parsed = TOML.parse(fs.readFileSync(path.join(tmpDir, "config.toml"), "utf-8")) as any;
    expect(parsed.editor.fontSize).toBe(16);
    expect(parsed.editor.theme).toBe("dark");
  });

  // --- Arrays в TOML: replace (симметрично JSON-поведению) ---
  it("массивы в TOML заменяются целиком (не union)", () => {
    const entry = createTestEntry({ id: "codex" });
    const layer1 = createLayer("plugin-a", {
      "config.toml": '[fs]\nargs = ["a", "b"]\n',
    });
    const layer2 = createLayer("local", {
      "config.toml": '[fs]\nargs = ["c"]\n',
    });

    runOverlayStep({
      entry,
      projectRoot: tmpDir,
      layers: [
        { id: "plugin-a", overlayDir: layer1 },
        { id: "local", overlayDir: layer2 },
      ],
    });

    const parsed = TOML.parse(fs.readFileSync(path.join(tmpDir, "config.toml"), "utf-8")) as any;
    expect(parsed.fs.args).toEqual(["c"]);
  });

  // --- Fail-fast: невалидный TOML в существующем base-файле → non-throw, 3-line errors ---
  // Spec: docs/specs/layer-model.md § Парсинг файлов для merge (fail-fast для невалидного base).
  // Spec: docs/specs/layer-model.md § Рефакторинг операции overlay, расширение 2.7a.
  // Cycle 1 follow-up: runOverlayStep ловит LayerMergeError и возвращает outcome
  // с трёхстрочным errors. Silent overwrite остаётся запрещён.
  it("возвращает outcome с 3-строчным errors при невалидном существующем TOML base (non-throw)", () => {
    const entry = createTestEntry({ id: "codex" });
    const invalidPath = path.join(tmpDir, "config.toml");
    const invalidContent = "this is :: not valid ===\n";
    fs.writeFileSync(invalidPath, invalidContent);

    const layer1 = createLayer("local", {
      "config.toml": "[editor]\nfontSize = 16\n",
    });

    const outcome = runOverlayStep({
      entry,
      projectRoot: tmpDir,
      layers: [{ id: "local", overlayDir: layer1 }],
    });

    expect(outcome.name).toBe("Overlay");
    expect(outcome.errors).toHaveLength(3);
    expect(outcome.errors[0]).toBe(`Failed to parse .toml file at ${invalidPath}:`);
    expect(outcome.errors[1].length).toBeGreaterThan(0);
    expect(outcome.errors[2]).toBe("Please fix or remove the file and retry transpilation.");

    // Регрессия: файл на диске остался в исходном (невалидном) состоянии — silent overwrite запрещён.
    expect(fs.readFileSync(invalidPath, "utf-8")).toBe(invalidContent);
  });
});

// =============================================================================
// § Правила слияния — permission-массивы в .claude/settings.json.
// Cycle 1: секция "Union-merge для permission-ключей" удалена из спецификации.
// Массивы permissions.allow / permissions.deny теперь подчиняются стандартному
// правилу 2 (deep merge): incoming-массив полностью заменяет base-массив.
// =============================================================================

describe("Layer model — permission-массивы подчиняются правилу 2 (replace)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-union-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function createLayer(layerId: string, files: Record<string, string>): string {
    const layerDir = path.join(tmpDir, "layers", layerId);
    for (const [rel, content] of Object.entries(files)) {
      const filePath = path.join(layerDir, rel);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, "utf-8");
    }
    return layerDir;
  }

  // --- permissions.allow: последний слой полностью заменяет массив ---
  // Test 1.1: base permissions.allow: ["A","B"], incoming permissions.allow: ["C"]
  //   → после merge permissions.allow: ["C"] (не ["A","B","C"]).
  it("permissions.allow из позднейшего слоя полностью заменяет массив, без объединения", () => {
    const entry = createTestEntry({ id: "claude" });
    const layer1 = createLayer("plugin-a", {
      ".claude/settings.json": JSON.stringify({
        permissions: { allow: ["mcp__fs__read_file", "mcp__fs__list_directory"] },
      }),
    });
    const layer2 = createLayer("local", {
      ".claude/settings.json": JSON.stringify({
        permissions: { allow: ["Read(*)"] },
      }),
    });

    const outcome = runOverlayStep({
      entry,
      projectRoot: tmpDir,
      layers: [
        { id: "plugin-a", overlayDir: layer1 },
        { id: "local", overlayDir: layer2 },
      ],
    });

    expect(outcome.errors).toEqual([]);
    const written = JSON.parse(fs.readFileSync(path.join(tmpDir, ".claude/settings.json"), "utf-8"));
    expect(written.permissions.allow).toEqual(["Read(*)"]);
  });

  // --- permissions.deny: последний слой полностью заменяет массив ---
  // Test 1.2: base permissions.deny: ["X"], incoming permissions.deny: ["Y","Z"]
  //   → после merge permissions.deny: ["Y","Z"].
  it("permissions.deny из позднейшего слоя полностью заменяет массив", () => {
    const entry = createTestEntry({ id: "claude" });
    const layer1 = createLayer("plugin-a", {
      ".claude/settings.json": JSON.stringify({
        permissions: { deny: ["mcp__figma__delete"] },
      }),
    });
    const layer2 = createLayer("local", {
      ".claude/settings.json": JSON.stringify({
        permissions: { deny: ["Write(/etc/**)", "Bash(rm *)"] },
      }),
    });

    runOverlayStep({
      entry,
      projectRoot: tmpDir,
      layers: [
        { id: "plugin-a", overlayDir: layer1 },
        { id: "local", overlayDir: layer2 },
      ],
    });

    const written = JSON.parse(fs.readFileSync(path.join(tmpDir, ".claude/settings.json"), "utf-8"));
    expect(written.permissions.deny).toEqual(["Write(/etc/**)", "Bash(rm *)"]);
  });

  // --- Test 1.3: incoming не содержит permissions.allow → ключ сохраняется из base ---
  // Правило 1 deep merge для объектов: ключи из base сохраняются, если отсутствуют в incoming.
  it("сохраняет permissions.allow из base, если incoming не содержит этот ключ", () => {
    const entry = createTestEntry({ id: "claude" });
    const layer1 = createLayer("plugin-a", {
      ".claude/settings.json": JSON.stringify({
        permissions: { allow: ["Read(*)", "Bash(echo)"] },
      }),
    });
    const layer2 = createLayer("local", {
      ".claude/settings.json": JSON.stringify({
        permissions: { deny: ["Write(/etc/**)"] },
      }),
    });

    runOverlayStep({
      entry,
      projectRoot: tmpDir,
      layers: [
        { id: "plugin-a", overlayDir: layer1 },
        { id: "local", overlayDir: layer2 },
      ],
    });

    const written = JSON.parse(fs.readFileSync(path.join(tmpDir, ".claude/settings.json"), "utf-8"));
    expect(written.permissions.allow).toEqual(["Read(*)", "Bash(echo)"]);
    expect(written.permissions.deny).toEqual(["Write(/etc/**)"]);
  });

  // --- Регрессия: все прочие массивы в .claude/settings.json тоже replace ---
  it("прочие массивы в .claude/settings.json также подчиняются правилу 2 (replace)", () => {
    const entry = createTestEntry({ id: "claude" });
    const layer1 = createLayer("plugin-a", {
      ".claude/settings.json": JSON.stringify({
        someList: ["a", "b"],
      }),
    });
    const layer2 = createLayer("local", {
      ".claude/settings.json": JSON.stringify({
        someList: ["c"],
      }),
    });

    runOverlayStep({
      entry,
      projectRoot: tmpDir,
      layers: [
        { id: "plugin-a", overlayDir: layer1 },
        { id: "local", overlayDir: layer2 },
      ],
    });

    const written = JSON.parse(fs.readFileSync(path.join(tmpDir, ".claude/settings.json"), "utf-8"));
    // Стандартное правило 2: полная замена
    expect(written.someList).toEqual(["c"]);
  });

  // --- permissions.allow в opencode.json тоже replace (стандартное правило 2) ---
  it("permissions.allow в opencode.json подчиняется стандартному правилу 2 (replace)", () => {
    const entry = createTestEntry({ id: "opencode" });
    const layer1 = createLayer("plugin-a", {
      "opencode.json": JSON.stringify({
        permissions: { allow: ["a", "b"] },
      }),
    });
    const layer2 = createLayer("local", {
      "opencode.json": JSON.stringify({
        permissions: { allow: ["c"] },
      }),
    });

    runOverlayStep({
      entry,
      projectRoot: tmpDir,
      layers: [
        { id: "plugin-a", overlayDir: layer1 },
        { id: "local", overlayDir: layer2 },
      ],
    });

    const written = JSON.parse(fs.readFileSync(path.join(tmpDir, "opencode.json"), "utf-8"));
    // union не применяется — стандартное replace
    expect(written.permissions.allow).toEqual(["c"]);
  });

  // --- End-to-end: второй слой полностью заменяет permission-массивы первого ---
  // Cycle 1: union-merge удалён; если оба слоя задают permissions.{allow,deny},
  // позднейший слой полностью заменяет массивы. Объединение entries из MCP и
  // Permissions транспайлеров теперь требует других механизмов (например,
  // агрегации до overlay-шага) и явно вне scope layer-model.
  it("позднейший слой полностью заменяет permissions.{allow,deny}; прочие ключи мержатся", () => {
    const entry = createTestEntry({ id: "claude" });
    const layer1 = createLayer("mcp-output", {
      ".claude/settings.json": JSON.stringify({
        $schema: "https://json.schemastore.org/claude-code-settings.json",
        permissions: {
          allow: ["mcp__fs__read_file"],
          deny: ["mcp__figma__delete"],
        },
      }),
    });
    const layer2 = createLayer("permissions-output", {
      ".claude/settings.json": JSON.stringify({
        permissions: {
          allow: ["Read(*)"],
          deny: ["Write(/etc/**)"],
        },
      }),
    });

    runOverlayStep({
      entry,
      projectRoot: tmpDir,
      layers: [
        { id: "mcp", overlayDir: layer1 },
        { id: "permissions", overlayDir: layer2 },
      ],
    });

    const written = JSON.parse(fs.readFileSync(path.join(tmpDir, ".claude/settings.json"), "utf-8"));
    // Массивы полностью заменены последним слоем.
    expect(written.permissions.allow).toEqual(["Read(*)"]);
    expect(written.permissions.deny).toEqual(["Write(/etc/**)"]);
    // $schema сохранён (правило 1 — deep merge объектов, ключа нет в incoming).
    expect(written.$schema).toBe("https://json.schemastore.org/claude-code-settings.json");
  });
});

// =============================================================================
// Низкоуровневые unit-тесты deepMerge: permission-массивы подчиняются правилу 2.
// Cycle 1: секция § Union-merge для permission-ключей удалена из спецификации,
// поэтому контекст пути больше НЕ должен активировать union-merge.
// =============================================================================

describe("deepMerge — permission-массивы подчиняются правилу 2 (replace)", () => {
  it("permissions.allow заменяется целиком даже при filePath=.claude/settings.json", () => {
    const base = { permissions: { allow: ["a", "b"] } };
    const incoming = { permissions: { allow: ["c"] } };
    // Даже если DeepMergeContext с filePath передан, массив должен
    // быть заменён (старое union-merge поведение удалено).
    const result = deepMerge(base, incoming, { filePath: ".claude/settings.json" });
    expect(result.permissions).toEqual({ allow: ["c"] });
  });

  it("permissions.deny заменяется целиком даже при filePath=.claude/settings.json", () => {
    const base = { permissions: { deny: ["x"] } };
    const incoming = { permissions: { deny: ["y", "z"] } };
    const result = deepMerge(base, incoming, { filePath: ".claude/settings.json" });
    expect(result.permissions).toEqual({ deny: ["y", "z"] });
  });

  it("без контекста пути permissions.allow сливается стандартным replace", () => {
    const base = { permissions: { allow: ["a", "b"] } };
    const incoming = { permissions: { allow: ["c"] } };
    const result = deepMerge(base, incoming);
    expect(result.permissions).toEqual({ allow: ["c"] });
  });
});
