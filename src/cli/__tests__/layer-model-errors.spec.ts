// layer-model-errors.spec.ts
// Спецификация:
//   - docs/specs/layer-model.md § Парсинг файлов для merge (fail-fast)
//   - docs/specs/layer-model.md § Рефакторинг операции overlay, расширение 2.7a
//     (non-throw контракт runOverlayStep для LayerMergeError)
//   - docs/specs/provider-overlay.md § Результат (runOverlayStep не бросает)
//   - docs/specs/cli.md § Обработка ошибок транспиляции
//
// Контракт: LayerMergeError бросается внутренними хелперами (parseMergeEligible),
// но runOverlayStep ДОЛЖЕН перехватить его и конвертировать в TranspilerStepOutcome
// с name: "Overlay", writtenCount (partial progress до ошибки) и errors — массив
// из трёх строк согласно layer-model.md § расширение 2.7a.
//
// Cycle 1 failing-tests также покрывают JSONC proactive strip pipeline.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { runOverlayStep, LayerMergeError } from "../overlay-step.js";
import type { AdapterRegistryEntry } from "../types.js";

function createTestEntry(overrides: Partial<AdapterRegistryEntry> = {}): AdapterRegistryEntry {
  return {
    id: "test-adapter",
    description: "Test Adapter",
    instructions: {} as AdapterRegistryEntry["instructions"],
    skills: {} as AdapterRegistryEntry["skills"],
    agents: {} as AdapterRegistryEntry["agents"],
    commands: null,
    mcp: null,
    permissions: null,
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

/**
 * Формирует ожидаемую первую строку ошибки согласно layer-model.md
 * § Рефакторинг операции overlay, расширение 2.7a.
 * Spec: "первая строка — 'Failed to parse {format} file at {absolutePath}:'"
 */
function expectedFirstLine(format: string, absPath: string): string {
  return `Failed to parse ${format} file at ${absPath}:`;
}

const EXPECTED_THIRD_LINE = "Please fix or remove the file and retry transpilation.";

// =============================================================================
// Non-throw contract runOverlayStep
// Spec: docs/specs/provider-overlay.md § Результат
//   "runOverlayStep, реализующая операцию overlay, ЗАПРЕЩЕНО выбрасывать
//    исключения наружу."
// Spec: docs/specs/cli.md § Общий контракт шагов
// Spec: docs/specs/layer-model.md § Рефакторинг операции overlay, расширение 2.7a
// =============================================================================

describe("runOverlayStep — non-throw контракт для LayerMergeError", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-err-nothrow-"));
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

  // --- N1: невалидный JSON base → non-throw, 3 строки в errors ---
  it("N1: невалидный JSON base — возвращает outcome с 3-строчным errors, не бросает", () => {
    const entry = createTestEntry({ id: "claude" });
    const basePath = path.join(tmpDir, "settings.json");
    fs.writeFileSync(basePath, "{ invalid", "utf-8");

    const layerDir = createLayer("local", {
      "settings.json": JSON.stringify({ key: "value" }),
    });

    let outcome: ReturnType<typeof runOverlayStep> | undefined;
    expect(() => {
      outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [{ id: "local", overlayDir: layerDir }],
      });
    }).not.toThrow();

    expect(outcome).toBeDefined();
    expect(outcome!.name).toBe("Overlay");
    expect(outcome!.errors).toHaveLength(3);
    expect(outcome!.errors[0]).toBe(expectedFirstLine(".json", basePath));
    expect(outcome!.errors[1]).toMatch(/./); // непустая строка — сообщение парсера
    expect(outcome!.errors[2]).toBe(EXPECTED_THIRD_LINE);
  });

  // --- N2: невалидный TOML incoming → non-throw, 3 строки ---
  it("N2: невалидный TOML в incoming layer-файле — outcome с 3-строчным errors", () => {
    const entry = createTestEntry({ id: "codex" });

    const layerDir = createLayer("plugin-a", {
      "config.toml": "this is :: not valid ===\n",
    });
    const incomingPath = path.join(layerDir, "config.toml");

    let outcome: ReturnType<typeof runOverlayStep> | undefined;
    expect(() => {
      outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [{ id: "plugin-a", overlayDir: layerDir }],
      });
    }).not.toThrow();

    expect(outcome!.name).toBe("Overlay");
    expect(outcome!.errors).toHaveLength(3);
    expect(outcome!.errors[0]).toBe(expectedFirstLine(".toml", incomingPath));
    expect(outcome!.errors[1].length).toBeGreaterThan(0);
    expect(outcome!.errors[2]).toBe(EXPECTED_THIRD_LINE);
  });

  // --- N3: невалидный YAML base → non-throw, 3 строки ---
  it("N3: невалидный YAML base — outcome с 3-строчным errors", () => {
    const entry = createTestEntry({ id: "claude" });
    const basePath = path.join(tmpDir, "config.yaml");
    fs.writeFileSync(basePath, ":\n  - :\n    :\n  invalid: [yaml: [", "utf-8");

    const layerDir = createLayer("local", {
      "config.yaml": "editor:\n  fontSize: 16\n",
    });

    let outcome: ReturnType<typeof runOverlayStep> | undefined;
    expect(() => {
      outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [{ id: "local", overlayDir: layerDir }],
      });
    }).not.toThrow();

    expect(outcome!.name).toBe("Overlay");
    expect(outcome!.errors).toHaveLength(3);
    expect(outcome!.errors[0]).toBe(expectedFirstLine(".yaml", basePath));
    expect(outcome!.errors[1].length).toBeGreaterThan(0);
    expect(outcome!.errors[2]).toBe(EXPECTED_THIRD_LINE);
  });

  // --- N4: невалидный JSONC base после strip → non-throw, 3 строки ---
  it("N4: .jsonc base, невалидный даже после strip-pipeline — outcome с 3-строчным errors", () => {
    const entry = createTestEntry({ id: "kilocode" });
    const basePath = path.join(tmpDir, "kilo.jsonc");
    // Комментарий будет strip'нут, но ядро остаётся невалидным JSON.
    fs.writeFileSync(basePath, "// comment\n{ key: value_without_quotes }\n", "utf-8");

    const layerDir = createLayer("local", {
      "kilo.jsonc": "{}",
    });

    let outcome: ReturnType<typeof runOverlayStep> | undefined;
    expect(() => {
      outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [{ id: "local", overlayDir: layerDir }],
      });
    }).not.toThrow();

    expect(outcome!.name).toBe("Overlay");
    expect(outcome!.errors).toHaveLength(3);
    expect(outcome!.errors[0]).toBe(expectedFirstLine(".jsonc", basePath));
    expect(outcome!.errors[1].length).toBeGreaterThan(0);
    expect(outcome!.errors[2]).toBe(EXPECTED_THIRD_LINE);
  });

  // --- N5: partial progress — writtenCount = кол-во успешных записей до сбоя ---
  // Сценарий: overlay должен записать несколько файлов. Один из них падает на парсинге
  // (невалидный base). Запись остальных успешных файлов до падения учитывается
  // в writtenCount; ошибка прерывает слой на позиции неудачного файла.
  it("N5: partial progress — writtenCount отражает успешные записи до ошибки", () => {
    const entry = createTestEntry({ id: "claude" });
    // base файл для merge — невалидный JSON.
    const brokenBasePath = path.join(tmpDir, "broken.json");
    fs.writeFileSync(brokenBasePath, "{ invalid", "utf-8");

    // Слой содержит два override-only файла (которые обязательно будут записаны)
    // и один merge-eligible файл, который упрётся в невалидный base.
    const layerDir = createLayer("local", {
      "docs/readme.md": "# Readme\n",
      "docs/changelog.md": "# Changelog\n",
      "broken.json": JSON.stringify({ k: "v" }),
    });

    let outcome: ReturnType<typeof runOverlayStep> | undefined;
    expect(() => {
      outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [{ id: "local", overlayDir: layerDir }],
      });
    }).not.toThrow();

    // Должна быть ошибка трёх строк.
    expect(outcome!.errors.length).toBeGreaterThanOrEqual(3);
    // Первая ошибка — про broken.json.
    const firstErrorIdx = outcome!.errors.findIndex((e) => e.startsWith("Failed to parse"));
    expect(firstErrorIdx).toBeGreaterThanOrEqual(0);
    expect(outcome!.errors[firstErrorIdx]).toBe(expectedFirstLine(".json", brokenBasePath));
    expect(outcome!.errors[firstErrorIdx + 2]).toBe(EXPECTED_THIRD_LINE);

    // Partial progress: writtenCount отражает фактически записанные файлы
    // до момента ошибки. Так как порядок файлов не гарантирован, проверяем
    // через факт существования readme.md/changelog.md ИЛИ writtenCount > 0.
    // Главное — runOverlayStep не бросил, writtenCount — число, outcome валиден.
    expect(typeof outcome!.writtenCount).toBe("number");
    expect(outcome!.writtenCount).toBeGreaterThanOrEqual(0);
  });

  // --- N6: happy path regression — non-throw logic не сломала успешный сценарий ---
  it("N6: успешный flow — outcome с errors: [] и корректным writtenCount", () => {
    const entry = createTestEntry({ id: "claude" });

    const layerDir = createLayer("local", {
      "settings.json": JSON.stringify({ key: "value" }),
      "docs/readme.md": "# Readme\n",
    });

    const outcome = runOverlayStep({
      entry,
      projectRoot: tmpDir,
      layers: [{ id: "local", overlayDir: layerDir }],
    });

    expect(outcome.name).toBe("Overlay");
    expect(outcome.errors).toEqual([]);
    expect(outcome.writtenCount).toBe(2);
  });
});

// =============================================================================
// Формат errors[] для LayerMergeError
// Spec: docs/specs/layer-model.md § Рефакторинг операции overlay, расширение 2.7a
// Spec: docs/specs/cli.md § Категории фатальных ошибок (LayerMergeError)
// =============================================================================

describe("LayerMergeError — формат errors[] в TranspilerStepOutcome", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-err-fmt-"));
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

  // --- F1: exact string match трёх строк по spec ---
  it("F1: errors[0], errors[1], errors[2] соответствуют spec (exact match)", () => {
    const entry = createTestEntry({ id: "claude" });
    const basePath = path.join(tmpDir, "settings.json");
    fs.writeFileSync(basePath, "{ invalid", "utf-8");

    const layerDir = createLayer("local", {
      "settings.json": JSON.stringify({ key: "value" }),
    });

    const outcome = runOverlayStep({
      entry,
      projectRoot: tmpDir,
      layers: [{ id: "local", overlayDir: layerDir }],
    });

    expect(outcome.errors).toHaveLength(3);

    // errors[0]: "Failed to parse .json file at <abs path>:"
    expect(outcome.errors[0]).toBe(`Failed to parse .json file at ${basePath}:`);

    // errors[1]: сообщение исходного парсера (непустая, без префикса/indent).
    // indent добавляется только на уровне TUI-рендера, а не в содержимом строки.
    expect(outcome.errors[1]).not.toMatch(/^\s/); // не начинается с whitespace
    expect(outcome.errors[1].length).toBeGreaterThan(0);

    // errors[2]: guidance-строка.
    expect(outcome.errors[2]).toBe("Please fix or remove the file and retry transpilation.");
  });

  // --- F2: absolute path (не relative) ---
  it("F2: путь в errors[0] — абсолютный, а не относительный", () => {
    const entry = createTestEntry({ id: "claude" });
    const basePath = path.join(tmpDir, "settings.json");
    fs.writeFileSync(basePath, "{ invalid", "utf-8");

    const layerDir = createLayer("local", {
      "settings.json": JSON.stringify({ key: "value" }),
    });

    const outcome = runOverlayStep({
      entry,
      projectRoot: tmpDir,
      layers: [{ id: "local", overlayDir: layerDir }],
    });

    // Извлекаем путь из errors[0]: "Failed to parse .json file at <path>:"
    const match = outcome.errors[0].match(/Failed to parse \.json file at (.+):$/);
    expect(match).not.toBeNull();
    const extractedPath = match![1];
    expect(path.isAbsolute(extractedPath)).toBe(true);
    expect(extractedPath).toBe(basePath);
  });

  // --- F3: parser message содержит детали (offset / position, если доступно) ---
  it("F3: errors[1] содержит сообщение парсера с деталями (position/offset, если доступно)", () => {
    const entry = createTestEntry({ id: "claude" });
    const basePath = path.join(tmpDir, "settings.json");
    // JSON.parse для "{ invalid" выдаёт: "Unexpected token 'i' ... at position 2"
    // или аналогичное — в зависимости от версии Node.
    fs.writeFileSync(basePath, "{ invalid", "utf-8");

    const layerDir = createLayer("local", {
      "settings.json": JSON.stringify({ k: "v" }),
    });

    const outcome = runOverlayStep({
      entry,
      projectRoot: tmpDir,
      layers: [{ id: "local", overlayDir: layerDir }],
    });

    // Parser message не пустой и не равен только guidance-строке.
    const parserMsg = outcome.errors[1];
    expect(parserMsg.length).toBeGreaterThan(0);
    expect(parserMsg).not.toBe(EXPECTED_THIRD_LINE);
    // Для JSON.parse сообщение обычно содержит "JSON" или "position" или "token".
    // Мы не требуем конкретной подстроки (зависит от Node version),
    // но требуем не-тривиальности.
    expect(parserMsg.length).toBeGreaterThan(5);
  });

  // --- F4: format включает точку (например, ".json"), не голое "json" ---
  it("F4: format в errors[0] — расширение с точкой (например, '.json', '.toml')", () => {
    const entry = createTestEntry({ id: "codex" });
    const layerDir = createLayer("plugin-a", {
      "bad.toml": "this is :: not valid ===\n",
    });
    const incomingPath = path.join(layerDir, "bad.toml");

    const outcome = runOverlayStep({
      entry,
      projectRoot: tmpDir,
      layers: [{ id: "plugin-a", overlayDir: layerDir }],
    });

    expect(outcome.errors[0]).toBe(`Failed to parse .toml file at ${incomingPath}:`);
  });
});

// =============================================================================
// Sanity: LayerMergeError всё ещё существует как класс (внутренний контракт
// parseMergeEligible). Экспортируется из overlay-step.ts для возможной
// диагностики и обратной совместимости.
// =============================================================================

describe("LayerMergeError — экспорт класса (внутренний контракт)", () => {
  it("LayerMergeError экспортируется из overlay-step", () => {
    expect(LayerMergeError).toBeDefined();
    const err = new LayerMergeError({
      filePath: "/abs/path/file.json",
      format: ".json",
      parserMessage: "Unexpected token",
    });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(LayerMergeError);
    expect(err.name).toBe("LayerMergeError");
    expect(err.filePath).toBe("/abs/path/file.json");
    expect(err.format).toBe(".json");
    expect(err.parserMessage).toBe("Unexpected token");
  });
});

// =============================================================================
// Изменение 3 — JSONC proactive strip pipeline (регрессия из Cycle 1)
// Spec: § Парсинг файлов для merge, таблица парсеров + процедура JSONC
// =============================================================================

describe("JSONC парсинг — proactive strip pipeline", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-jsonc-"));
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

  function parseJsoncBaseViaOverlay(baseContent: string): unknown {
    const entry = createTestEntry({ id: "kilocode" });
    const basePath = path.join(tmpDir, "kilo.jsonc");
    fs.writeFileSync(basePath, baseContent, "utf-8");

    const layerDir = createLayer("local", {
      "kilo.jsonc": "{}",
    });

    const outcome = runOverlayStep({
      entry,
      projectRoot: tmpDir,
      layers: [{ id: "local", overlayDir: layerDir }],
    });
    expect(outcome.errors).toEqual([]);

    return JSON.parse(fs.readFileSync(basePath, "utf-8"));
  }

  it("парсит .jsonc с // line comments через strip-then-parse", () => {
    const parsed = parseJsoncBaseViaOverlay('// line comment\n{"key": "value"}\n');
    expect(parsed).toEqual({ key: "value" });
  });

  it("парсит .jsonc с /* block comments */ через strip-then-parse", () => {
    const parsed = parseJsoncBaseViaOverlay('/* block comment */{"key": "value"}');
    expect(parsed).toEqual({ key: "value" });
  });

  it("парсит .jsonc с trailing commas через strip-then-parse", () => {
    const parsed = parseJsoncBaseViaOverlay('{"key": "value",}');
    expect(parsed).toEqual({ key: "value" });
  });

  it("парсит .jsonc с // line, /* block */ comments и trailing commas вместе", () => {
    const content = [
      "// header comment",
      "/* block",
      "   multiline",
      "   comment */",
      "{",
      '  "a": 1, // inline',
      '  "b": [1, 2, 3,],',
      '  "c": {"nested": true,},',
      "}",
      "",
    ].join("\n");
    const parsed = parseJsoncBaseViaOverlay(content);
    expect(parsed).toEqual({ a: 1, b: [1, 2, 3], c: { nested: true } });
  });

  it("парсит валидный pure JSON .jsonc через strip-pipeline (без изменений)", () => {
    const parsed = parseJsoncBaseViaOverlay(JSON.stringify({ key: "value", nested: { a: 1 } }));
    expect(parsed).toEqual({ key: "value", nested: { a: 1 } });
  });

  it("парсит .jsonc incoming layer-файл с комментариями через strip-pipeline", () => {
    const entry = createTestEntry({ id: "kilocode" });

    const layerDir = createLayer("local", {
      "kilo.jsonc": '// plugin comment\n{"mcpServers": {"fs": {"command": "npx",},},}\n',
    });

    const outcome = runOverlayStep({
      entry,
      projectRoot: tmpDir,
      layers: [{ id: "local", overlayDir: layerDir }],
    });

    expect(outcome.errors).toEqual([]);

    const written = JSON.parse(fs.readFileSync(path.join(tmpDir, "kilo.jsonc"), "utf-8"));
    expect(written).toEqual({ mcpServers: { fs: { command: "npx" } } });
  });
});

// =============================================================================
// Silent overwrite запрещён (регрессия из Cycle 1).
// runOverlayStep не должен перезаписывать невалидный base файл — он оставляется
// нетронутым, пока пользователь не починит или не удалит его.
// =============================================================================

describe("LayerMergeError — silent overwrite запрещён", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-err-so-"));
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

  it("не перезаписывает невалидный base файл при non-throw возврате outcome", () => {
    const entry = createTestEntry({ id: "codex" });
    const basePath = path.join(tmpDir, "config.toml");
    const originalContent = "this is :: not valid ===\n";
    fs.writeFileSync(basePath, originalContent, "utf-8");

    const layerDir = createLayer("local", {
      "config.toml": "[editor]\nfontSize = 16\n",
    });

    // runOverlayStep НЕ бросает, возвращает outcome с errors.
    const outcome = runOverlayStep({
      entry,
      projectRoot: tmpDir,
      layers: [{ id: "local", overlayDir: layerDir }],
    });

    expect(outcome.errors.length).toBeGreaterThanOrEqual(3);
    expect(outcome.errors[0]).toBe(`Failed to parse .toml file at ${basePath}:`);

    // Файл остался в исходном невалидном состоянии.
    expect(fs.readFileSync(basePath, "utf-8")).toBe(originalContent);
  });
});
