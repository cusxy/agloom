// discover.spec.ts
// Спецификация: docs/specs/docs-transpiler.md § Обнаружение файлов ресурсов

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
  describe("Обнаружение файлов ресурсов", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-resource-discover-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Happy path: шаги 1–4 — обнаружение файлов в .agloom/docs/ ---
    it("обнаруживает все файлы в каталоге ресурсов рекурсивно", () => {
      // Arrange: создаём файлы в .agloom/docs/
      const docsDir = path.join(tmpDir, ".agloom", "docs");
      const cyclingDir = path.join(docsDir, "cycling");
      fs.mkdirSync(cyclingDir, { recursive: true });
      fs.writeFileSync(path.join(docsDir, "overview.md"), "# Overview");
      fs.writeFileSync(
        path.join(cyclingDir, "agent-protocol.md"),
        "# Agent Protocol",
      );

      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude", ".claude/docs")],
        resourceType: "docs",
      });

      // Act
      const files = transpiler.discover();

      // Assert
      expect(files).toHaveLength(2);
      const paths = files.map((f) => f.relativePath).sort();
      expect(paths).toContain(".agloom/docs/overview.md");
      expect(paths).toContain(".agloom/docs/cycling/agent-protocol.md");
    });

    // --- Happy path: шаги 1–4 — обнаружение файлов в .agloom/schemas/ ---
    it("обнаруживает файлы в каталоге schemas при resourceType schemas", () => {
      // Arrange
      const schemasDir = path.join(tmpDir, ".agloom", "schemas");
      fs.mkdirSync(schemasDir, { recursive: true });
      fs.writeFileSync(
        path.join(schemasDir, "config.schema.json"),
        '{"type": "object"}',
      );

      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude", ".claude/schemas")],
        resourceType: "schemas",
      });

      // Act
      const files = transpiler.discover();

      // Assert
      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe(".agloom/schemas/config.schema.json");
    });

    // --- Трансформация: шаг 4 — relativePath относительно projectRoot ---
    it("формирует relativePath относительно projectRoot", () => {
      const docsDir = path.join(tmpDir, ".agloom", "docs");
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(path.join(docsDir, "readme.md"), "# Readme");

      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude", ".claude/docs")],
        resourceType: "docs",
      });

      const files = transpiler.discover();

      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe(".agloom/docs/readme.md");
    });

    // --- Расширение 2a: каталог ресурсов не существует → пустой массив ---
    it("возвращает пустой массив, если каталог ресурсов не существует", () => {
      // tmpDir пуст — нет .agloom/docs/

      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude", ".claude/docs")],
        resourceType: "docs",
      });

      const files = transpiler.discover();

      expect(files).toEqual([]);
    });

    // --- Расширение 3a: ошибка доступа к каталогу (EACCES) ---
    it("выбрасывает ResourceDiscoverError при ошибке доступа к каталогу ресурсов", () => {
      const docsDir = path.join(tmpDir, ".agloom", "docs");
      fs.mkdirSync(docsDir, { recursive: true });
      fs.chmodSync(docsDir, 0o000);

      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude", ".claude/docs")],
        resourceType: "docs",
      });

      try {
        expect(() => transpiler.discover()).toThrow(ResourceDiscoverError);
        expect(() => transpiler.discover()).toThrow(/Failed to scan directory/);
      } finally {
        fs.chmodSync(docsDir, 0o755);
      }
    });

    // --- Happy path: кастомный agloomDir ---
    it("использует кастомный agloomDir для определения пути к каталогу ресурсов", () => {
      const docsDir = path.join(tmpDir, ".custom", "docs");
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(path.join(docsDir, "file.md"), "# File");

      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude", ".claude/docs")],
        resourceType: "docs",
        agloomDir: ".custom",
      });

      const files = transpiler.discover();

      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe(".custom/docs/file.md");
    });

    // --- Граничное условие: пустой каталог ресурсов (существует, но без файлов) ---
    it("возвращает пустой массив, если каталог ресурсов существует, но пуст", () => {
      const docsDir = path.join(tmpDir, ".agloom", "docs");
      fs.mkdirSync(docsDir, { recursive: true });

      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude", ".claude/docs")],
        resourceType: "docs",
      });

      const files = transpiler.discover();

      expect(files).toEqual([]);
    });

    // --- Граничное условие: глубокая вложенность каталогов ---
    it("обнаруживает файлы в глубоко вложенных каталогах", () => {
      const deepDir = path.join(tmpDir, ".agloom", "docs", "a", "b", "c", "d");
      fs.mkdirSync(deepDir, { recursive: true });
      fs.writeFileSync(path.join(deepDir, "deep.md"), "# Deep");

      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude", ".claude/docs")],
        resourceType: "docs",
      });

      const files = transpiler.discover();

      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe(".agloom/docs/a/b/c/d/deep.md");
    });

    // --- Граничное условие: файлы разных типов (не только .md) ---
    it("обнаруживает файлы любых типов, не только .md", () => {
      const docsDir = path.join(tmpDir, ".agloom", "docs");
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(path.join(docsDir, "readme.md"), "# Readme");
      fs.writeFileSync(path.join(docsDir, "config.json"), "{}");
      fs.writeFileSync(
        path.join(docsDir, "image.png"),
        Buffer.from([0x89, 0x50]),
      );

      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude", ".claude/docs")],
        resourceType: "docs",
      });

      const files = transpiler.discover();

      expect(files).toHaveLength(3);
      const paths = files.map((f) => f.relativePath).sort();
      expect(paths).toContain(".agloom/docs/config.json");
      expect(paths).toContain(".agloom/docs/image.png");
      expect(paths).toContain(".agloom/docs/readme.md");
    });
  });
});
