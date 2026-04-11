// layer-model-toml.spec.ts
// Спецификация: docs/specs/layer-model.md § Алгоритм deep merge (TOML),
//               § Union-merge для permission-ключей

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as TOML from "smol-toml";
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

  // --- Невалидный TOML в существующем base-файле → перезаписывается целиком ---
  it("невалидный существующий TOML-файл перезаписывается целиком", () => {
    const entry = createTestEntry({ id: "codex" });
    // Заранее положим невалидный TOML в target
    fs.writeFileSync(path.join(tmpDir, "config.toml"), "this is :: not valid ===\n");

    const layer1 = createLayer("local", {
      "config.toml": "[editor]\nfontSize = 16\n",
    });

    const outcome = runOverlayStep({
      entry,
      projectRoot: tmpDir,
      layers: [{ id: "local", overlayDir: layer1 }],
    });

    expect(outcome.errors).toEqual([]);
    const parsed = TOML.parse(fs.readFileSync(path.join(tmpDir, "config.toml"), "utf-8")) as any;
    expect(parsed.editor).toEqual({ fontSize: 16 });
  });
});

// =============================================================================
// § Union-merge для permission-ключей в .claude/settings.json
// =============================================================================

describe("Layer model — union-merge для permission arrays", () => {
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

  // --- permissions.allow: union двух слоёв ---
  it("permissions.allow объединяется union-merge из двух слоёв", () => {
    const entry = createTestEntry({ id: "claude" });
    const layer1 = createLayer("plugin-a", {
      ".claude/settings.json": JSON.stringify({
        permissions: { allow: ["mcp__fs__read_file", "mcp__fs__list_directory"] },
      }),
    });
    const layer2 = createLayer("local", {
      ".claude/settings.json": JSON.stringify({
        permissions: { allow: ["Read(*)", "Bash(echo)"] },
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
    expect(written.permissions.allow).toEqual([
      "mcp__fs__read_file",
      "mcp__fs__list_directory",
      "Read(*)",
      "Bash(echo)",
    ]);
  });

  // --- permissions.deny: union двух слоёв ---
  it("permissions.deny объединяется union-merge из двух слоёв", () => {
    const entry = createTestEntry({ id: "claude" });
    const layer1 = createLayer("plugin-a", {
      ".claude/settings.json": JSON.stringify({
        permissions: { deny: ["mcp__figma__delete"] },
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
    expect(written.permissions.deny).toEqual(["mcp__figma__delete", "Write(/etc/**)"]);
  });

  // --- Дедупликация: одинаковые записи из разных слоёв ---
  it("одинаковые записи из разных слоёв дедуплицируются (first-occurrence)", () => {
    const entry = createTestEntry({ id: "claude" });
    const layer1 = createLayer("plugin-a", {
      ".claude/settings.json": JSON.stringify({
        permissions: { allow: ["Read(*)", "Bash(echo)"] },
      }),
    });
    const layer2 = createLayer("local", {
      ".claude/settings.json": JSON.stringify({
        permissions: { allow: ["Bash(echo)", "Read(*)"] },
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
    // first-occurrence порядок
    expect(written.permissions.allow).toEqual(["Read(*)", "Bash(echo)"]);
  });

  // --- Union НЕ применяется к другим массивам в .claude/settings.json ---
  it("union-merge НЕ применяется к другим массивам в .claude/settings.json", () => {
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

  // --- Union НЕ применяется к permissions.allow в других файлах ---
  it("union-merge НЕ применяется к permissions.allow в opencode.json", () => {
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

  // --- End-to-end: MCP пишет entries, затем Permissions пишет в тот же файл ---
  // § Инвариант приоритета MCP над Permissions
  it("MCP-слой и Permissions-слой оба сохраняют свои entries в .claude/settings.json", () => {
    const entry = createTestEntry({ id: "claude" });
    // Слой 1 = вывод MCP-транспайлера
    const mcpLayer = createLayer("mcp-output", {
      ".claude/settings.json": JSON.stringify({
        $schema: "https://json.schemastore.org/claude-code-settings.json",
        permissions: {
          allow: ["mcp__fs__read_file"],
          deny: ["mcp__figma__delete"],
        },
      }),
    });
    // Слой 2 = вывод Permissions-транспайлера
    const permLayer = createLayer("permissions-output", {
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
        { id: "mcp", overlayDir: mcpLayer },
        { id: "permissions", overlayDir: permLayer },
      ],
    });

    const written = JSON.parse(fs.readFileSync(path.join(tmpDir, ".claude/settings.json"), "utf-8"));
    expect(written.permissions.allow).toEqual(["mcp__fs__read_file", "Read(*)"]);
    expect(written.permissions.deny).toEqual(["mcp__figma__delete", "Write(/etc/**)"]);
    // $schema сохранён
    expect(written.$schema).toBe("https://json.schemastore.org/claude-code-settings.json");
  });
});

// =============================================================================
// Низкоуровневые unit-тесты deepMerge для union-merge (если API его поддерживает)
// =============================================================================

describe("deepMerge — union-merge API", () => {
  // Эти тесты проверяют, что deepMerge поддерживает указание path-контекста
  // для union-merge permission-массивов. Если сигнатура не поддерживает
  // path-параметр, тесты упадут на этапе вызова.

  it("объединяет permissions.allow через union-merge при указании контекста пути", () => {
    const base = { permissions: { allow: ["a", "b"] } };
    const incoming = { permissions: { allow: ["b", "c"] } };
    // deepMerge должен принимать опциональный контекст вида
    // { filePath: ".claude/settings.json" } для активации union-merge.
    const result = (deepMerge as any)(base, incoming, {
      filePath: ".claude/settings.json",
    });
    expect(result.permissions.allow).toEqual(["a", "b", "c"]);
  });

  it("объединяет permissions.deny через union-merge при указании контекста пути", () => {
    const base = { permissions: { deny: ["x"] } };
    const incoming = { permissions: { deny: ["x", "y"] } };
    const result = (deepMerge as any)(base, incoming, {
      filePath: ".claude/settings.json",
    });
    expect(result.permissions.deny).toEqual(["x", "y"]);
  });

  it("без контекста пути permissions.allow сливается стандартным replace", () => {
    const base = { permissions: { allow: ["a", "b"] } };
    const incoming = { permissions: { allow: ["c"] } };
    const result = deepMerge(base, incoming);
    expect(result.permissions).toEqual({ allow: ["c"] });
  });
});
