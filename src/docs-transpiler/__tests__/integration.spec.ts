// integration.spec.ts
// Спецификация: docs/specs/docs-transpiler.md § Транспиляция, § Запись результатов
// Полный цикл: discover → transpile → writeResults

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createResourceTranspiler } from "../index.js";
import { ResourceDiscoverError } from "../errors.js";

function createStubAdapter(agentId: string, targetDir: string) {
  return { agentId, targetDir };
}

describe("ResourceTranspiler", () => {
  describe("Integration — полный pipeline docs", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "agl-resource-integration-"),
      );
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Happy path: полный цикл docs transpiler с одним адаптером ---
    it("файлы docs обнаруживаются, транспилируются и копируются в целевой каталог", () => {
      // Arrange: создаём каноническую структуру
      const docsDir = path.join(tmpDir, ".agloom", "docs");
      const cyclingDir = path.join(docsDir, "cycling");
      fs.mkdirSync(cyclingDir, { recursive: true });
      fs.writeFileSync(path.join(docsDir, "overview.md"), "# Overview");
      fs.writeFileSync(
        path.join(cyclingDir, "agent-protocol.md"),
        "# Agent Protocol",
      );

      // Act
      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude", ".claude/docs")],
        resourceType: "docs",
      });
      const results = transpiler.transpile();
      const writeResult = transpiler.writeResults(results);

      // Assert: нет ошибок
      expect(writeResult.errors).toHaveLength(0);

      // Assert: файлы побайтово совпадают
      const sourceOverview = fs.readFileSync(path.join(docsDir, "overview.md"));
      const targetOverview = fs.readFileSync(
        path.join(tmpDir, ".claude", "docs", "overview.md"),
      );
      expect(targetOverview.equals(sourceOverview)).toBe(true);

      const sourceProtocol = fs.readFileSync(
        path.join(cyclingDir, "agent-protocol.md"),
      );
      const targetProtocol = fs.readFileSync(
        path.join(tmpDir, ".claude", "docs", "cycling", "agent-protocol.md"),
      );
      expect(targetProtocol.equals(sourceProtocol)).toBe(true);

      // Assert: writeResult.written содержит оба файла
      expect(writeResult.written).toContain(".claude/docs/overview.md");
      expect(writeResult.written).toContain(
        ".claude/docs/cycling/agent-protocol.md",
      );
    });

    // --- Happy path: полный цикл schemas transpiler ---
    it("файлы schemas обнаруживаются, транспилируются и копируются в целевой каталог", () => {
      // Arrange
      const schemasDir = path.join(tmpDir, ".agloom", "schemas");
      fs.mkdirSync(schemasDir, { recursive: true });
      fs.writeFileSync(
        path.join(schemasDir, "config.schema.json"),
        '{"type": "object"}',
      );

      // Act
      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude", ".claude/schemas")],
        resourceType: "schemas",
      });
      const results = transpiler.transpile();
      const writeResult = transpiler.writeResults(results);

      // Assert
      expect(writeResult.errors).toHaveLength(0);

      const sourceContent = fs.readFileSync(
        path.join(schemasDir, "config.schema.json"),
      );
      const targetContent = fs.readFileSync(
        path.join(tmpDir, ".claude", "schemas", "config.schema.json"),
      );
      expect(targetContent.equals(sourceContent)).toBe(true);

      expect(writeResult.written).toContain(
        ".claude/schemas/config.schema.json",
      );
    });

    // --- Happy path: полный цикл с несколькими адаптерами ---
    it("транспилирует и записывает файлы для нескольких адаптеров", () => {
      // Arrange
      const docsDir = path.join(tmpDir, ".agloom", "docs");
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(path.join(docsDir, "readme.md"), "# Readme");

      // Act
      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [
          createStubAdapter("claude", ".claude/docs"),
          createStubAdapter("opencode", ".opencode/docs"),
        ],
        resourceType: "docs",
      });
      const results = transpiler.transpile();
      const writeResult = transpiler.writeResults(results);

      // Assert
      expect(writeResult.errors).toHaveLength(0);
      expect(writeResult.written).toContain(".claude/docs/readme.md");
      expect(writeResult.written).toContain(".opencode/docs/readme.md");

      // Оба файла побайтово совпадают с исходным
      const source = fs.readFileSync(path.join(docsDir, "readme.md"));
      const claude = fs.readFileSync(
        path.join(tmpDir, ".claude", "docs", "readme.md"),
      );
      const opencode = fs.readFileSync(
        path.join(tmpDir, ".opencode", "docs", "readme.md"),
      );
      expect(claude.equals(source)).toBe(true);
      expect(opencode.equals(source)).toBe(true);
    });

    // --- Расширение 1a: пустой каталог → корректное завершение ---
    it("корректно завершается при отсутствии каталога ресурсов", () => {
      // tmpDir пуст

      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude", ".claude/docs")],
        resourceType: "docs",
      });
      const results = transpiler.transpile();

      expect(results).toHaveLength(0);

      const writeResult = transpiler.writeResults(results);
      expect(writeResult.errors).toHaveLength(0);
      expect(writeResult.written).toHaveLength(0);
    });

    // --- Трансформация: маппинг путей — замена префикса ---
    it("заменяет префикс agloomDir/resourceType на adapter.targetDir", () => {
      const docsDir = path.join(tmpDir, ".agloom", "docs", "sub");
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(path.join(docsDir, "file.md"), "# File");

      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude", ".claude/docs")],
        resourceType: "docs",
      });
      const results = transpiler.transpile();

      // Assert: маппинг путей
      expect(results).toHaveLength(1);
      expect(results[0].agentId).toBe("claude");
      expect(results[0].files).toHaveLength(1);
      expect(results[0].files[0].relativePath).toBe(".claude/docs/sub/file.md");
      expect(results[0].files[0].sourcePath).toBe(".agloom/docs/sub/file.md");
    });

    // --- Расширение 1b: discover выбрасывает ошибку → пробрасывается ---
    it("пробрасывает ResourceDiscoverError к вызывающему коду", () => {
      const docsDir = path.join(tmpDir, ".agloom", "docs");
      fs.mkdirSync(docsDir, { recursive: true });
      fs.chmodSync(docsDir, 0o000);

      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude", ".claude/docs")],
        resourceType: "docs",
      });

      try {
        expect(() => transpiler.transpile()).toThrow(ResourceDiscoverError);
      } finally {
        fs.chmodSync(docsDir, 0o755);
      }
    });

    // --- Интеграция: полный цикл с интерполяцией ---
    it("полный цикл с интерполяцией: discover → transpile → writeResults с variablesByAgentId", () => {
      const docsDir = path.join(tmpDir, ".agloom", "docs");
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(
        path.join(docsDir, "guide.md"),
        "Skills: ${agloom:SKILLS_DIR}",
      );
      fs.writeFileSync(
        path.join(docsDir, "data.json"),
        '{"path": "${agloom:SKILLS_DIR}"}',
      );

      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude", ".claude/docs")],
        resourceType: "docs",
      });
      const results = transpiler.transpile();

      const variablesByAgentId: Record<string, Record<string, string>> = {
        claude: { SKILLS_DIR: ".claude/skills" },
      };

      const writeResult = transpiler.writeResults(results, {
        variablesByAgentId,
      });

      expect(writeResult.errors).toHaveLength(0);

      // .md файл интерполирован
      const mdContent = fs.readFileSync(
        path.join(tmpDir, ".claude", "docs", "guide.md"),
        "utf-8",
      );
      expect(mdContent).toBe("Skills: .claude/skills");

      // .json файл скопирован побайтово (без интерполяции)
      const jsonContent = fs.readFileSync(
        path.join(tmpDir, ".claude", "docs", "data.json"),
        "utf-8",
      );
      expect(jsonContent).toBe('{"path": "${agloom:SKILLS_DIR}"}');
    });

    // --- IT-DOCS-01: Pipeline с Claude адаптером (docs) ---
    it("IT-DOCS-01: файлы из .agloom/docs/ копируются в целевой каталог Claude", () => {
      // Вход: создать каноническую структуру
      const docsDir = path.join(tmpDir, ".agloom", "docs");
      const cyclingDir = path.join(docsDir, "cycling");
      fs.mkdirSync(cyclingDir, { recursive: true });
      fs.writeFileSync(
        path.join(cyclingDir, "agent-protocol.md"),
        "agent protocol content",
      );
      fs.writeFileSync(path.join(docsDir, "overview.md"), "overview content");

      // Поведение: шаги 1–3
      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [{ agentId: "claude", targetDir: ".claude/docs" }],
        resourceType: "docs",
      });
      const results = transpiler.transpile();
      const writeResult = transpiler.writeResults(results);

      // Шаг 4: writeResult.errors — пустой массив
      expect(writeResult.errors).toHaveLength(0);

      // Шаги 5–6: cycling/agent-protocol.md побайтово совпадает
      const sourceProtocol = fs.readFileSync(
        path.join(cyclingDir, "agent-protocol.md"),
      );
      const targetProtocol = fs.readFileSync(
        path.join(tmpDir, ".claude", "docs", "cycling", "agent-protocol.md"),
      );
      expect(targetProtocol.equals(sourceProtocol)).toBe(true);

      // Шаги 7–8: overview.md побайтово совпадает
      const sourceOverview = fs.readFileSync(path.join(docsDir, "overview.md"));
      const targetOverview = fs.readFileSync(
        path.join(tmpDir, ".claude", "docs", "overview.md"),
      );
      expect(targetOverview.equals(sourceOverview)).toBe(true);

      // Результат: writeResult.written содержит оба файла
      expect(writeResult.written).toContain(
        ".claude/docs/cycling/agent-protocol.md",
      );
      expect(writeResult.written).toContain(".claude/docs/overview.md");
    });

    // --- IT-DOCS-02: Pipeline с Claude адаптером (schemas) ---
    it("IT-DOCS-02: файлы из .agloom/schemas/ копируются в целевой каталог Claude", () => {
      // Вход: создать каноническую структуру
      const schemasDir = path.join(tmpDir, ".agloom", "schemas");
      const draftDir = path.join(schemasDir, "draft");
      fs.mkdirSync(draftDir, { recursive: true });
      fs.writeFileSync(
        path.join(schemasDir, "spec.schema.yml"),
        "spec schema content",
      );
      fs.writeFileSync(
        path.join(draftDir, "agent.schema.yml"),
        "agent schema content",
      );

      // Поведение: шаги 1–3
      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [{ agentId: "claude", targetDir: ".claude/schemas" }],
        resourceType: "schemas",
      });
      const results = transpiler.transpile();
      const writeResult = transpiler.writeResults(results);

      // Шаг 4: writeResult.errors — пустой массив
      expect(writeResult.errors).toHaveLength(0);

      // Шаги 5–6: spec.schema.yml побайтово совпадает
      const sourceSpec = fs.readFileSync(
        path.join(schemasDir, "spec.schema.yml"),
      );
      const targetSpec = fs.readFileSync(
        path.join(tmpDir, ".claude", "schemas", "spec.schema.yml"),
      );
      expect(targetSpec.equals(sourceSpec)).toBe(true);

      // Шаги 7–8: draft/agent.schema.yml побайтово совпадает
      const sourceAgent = fs.readFileSync(
        path.join(draftDir, "agent.schema.yml"),
      );
      const targetAgent = fs.readFileSync(
        path.join(tmpDir, ".claude", "schemas", "draft", "agent.schema.yml"),
      );
      expect(targetAgent.equals(sourceAgent)).toBe(true);

      // Результат: writeResult.written содержит оба файла
      expect(writeResult.written).toContain(".claude/schemas/spec.schema.yml");
      expect(writeResult.written).toContain(
        ".claude/schemas/draft/agent.schema.yml",
      );
    });

    // --- IT-DOCS-03: Pipeline при отсутствии каталога .agloom/docs/ ---
    it("IT-DOCS-03: корректно завершается при отсутствии каталога .agloom/docs/", () => {
      // Вход: tmpDir — пустая директория

      // Поведение: шаги 1–2
      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [{ agentId: "claude", targetDir: ".claude/docs" }],
        resourceType: "docs",
      });
      const results = transpiler.transpile();

      // Шаг 3: results — пустой массив
      expect(results).toHaveLength(0);

      // Шаги 4–6
      const writeResult = transpiler.writeResults(results);
      expect(writeResult.errors).toHaveLength(0);
      expect(writeResult.written).toHaveLength(0);
    });

    // --- IT-DOCS-04: Pipeline с интерполяцией .md файлов ---
    it("IT-DOCS-04: .md файлы интерполируются, файлы с другими расширениями копируются побайтово", () => {
      // Вход: создать каноническую структуру
      const docsDir = path.join(tmpDir, ".agloom", "docs");
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(
        path.join(docsDir, "guide.md"),
        "Skills dir: ${agloom:SKILLS_DIR}",
      );
      fs.writeFileSync(
        path.join(docsDir, "data.yml"),
        "raw: ${agloom:SKILLS_DIR}",
      );

      // Поведение: шаги 1–2
      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [{ agentId: "claude", targetDir: ".claude/docs" }],
        resourceType: "docs",
      });
      const results = transpiler.transpile();

      // Шаг 3: writeResults с variablesByAgentId
      const variablesByAgentId: Record<string, Record<string, string>> = {
        claude: { SKILLS_DIR: ".claude/skills" },
      };
      const writeResult = transpiler.writeResults(results, {
        variablesByAgentId,
      });

      // Шаг 4: writeResult.errors — пустой массив
      expect(writeResult.errors).toHaveLength(0);

      // Шаги 5–6: guide.md интерполирован
      const mdContent = fs.readFileSync(
        path.join(tmpDir, ".claude", "docs", "guide.md"),
        "utf-8",
      );
      expect(mdContent).toBe("Skills dir: .claude/skills");

      // Шаги 7–8: data.yml скопирован побайтово (без интерполяции)
      const sourceYml = fs.readFileSync(path.join(docsDir, "data.yml"));
      const targetYml = fs.readFileSync(
        path.join(tmpDir, ".claude", "docs", "data.yml"),
      );
      expect(targetYml.equals(sourceYml)).toBe(true);

      // Результат: writeResult.written содержит оба файла
      expect(writeResult.written).toContain(".claude/docs/guide.md");
      expect(writeResult.written).toContain(".claude/docs/data.yml");
    });

    // --- Интеграция: кастомный agloomDir с маппингом путей ---
    it("поддерживает кастомный agloomDir в полном цикле", () => {
      const docsDir = path.join(tmpDir, ".custom", "docs");
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(path.join(docsDir, "file.md"), "# Custom");

      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude", ".claude/docs")],
        resourceType: "docs",
        agloomDir: ".custom",
      });
      const results = transpiler.transpile();

      expect(results).toHaveLength(1);
      expect(results[0].files[0].sourcePath).toBe(".custom/docs/file.md");
      expect(results[0].files[0].relativePath).toBe(".claude/docs/file.md");

      const writeResult = transpiler.writeResults(results);
      expect(writeResult.errors).toHaveLength(0);
      expect(writeResult.written).toContain(".claude/docs/file.md");
    });
  });
});
