// discover.spec.ts
// Спецификация: docs/specs/agents-transpiler.md § Обнаружение определений агентов

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createAgentsTranspiler } from "../index.js";
import { AgentDiscoverError } from "../errors.js";

/**
 * Стаб-адаптер для тестов discover(). Транспиляция здесь не тестируется.
 */
function createStubAdapter(agentId: string) {
  return {
    agentId,
    transpile: () => [],
  };
}

describe("AgentsTranspiler", () => {
  describe("Обнаружение определений агентов", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sds-agents-discover-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Happy path: шаги 1–5 ---
    it("обнаруживает .md файлы в .agents/agents/ и формирует AgentDefinition[]", () => {
      // Arrange
      const agentsDir = path.join(tmpDir, ".agents", "agents");
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.writeFileSync(
        path.join(agentsDir, "code-reviewer.md"),
        "---\nname: code-reviewer\n---\nBody content.",
      );
      fs.writeFileSync(
        path.join(agentsDir, "test-writer.md"),
        "---\nname: test-writer\n---\nTest body.",
      );

      const transpiler = createAgentsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      // Act
      const definitions = transpiler.discover();

      // Assert
      expect(definitions).toHaveLength(2);

      const reviewer = definitions.find((d) => d.name === "code-reviewer");
      expect(reviewer).toBeDefined();
      expect(reviewer!.relativePath).toBe(".agents/agents/code-reviewer.md");
      expect(reviewer!.rawContent).toBe(
        "---\nname: code-reviewer\n---\nBody content.",
      );

      const writer = definitions.find((d) => d.name === "test-writer");
      expect(writer).toBeDefined();
      expect(writer!.relativePath).toBe(".agents/agents/test-writer.md");
      expect(writer!.rawContent).toBe(
        "---\nname: test-writer\n---\nTest body.",
      );
    });

    // --- Трансформация: шаг 3 — фильтрация только .md файлов ---
    it("отфильтровывает файлы без расширения .md", () => {
      const agentsDir = path.join(tmpDir, ".agents", "agents");
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.writeFileSync(path.join(agentsDir, "agent.md"), "md content");
      fs.writeFileSync(path.join(agentsDir, "readme.txt"), "txt content");
      fs.writeFileSync(path.join(agentsDir, "config.yaml"), "yaml content");

      const transpiler = createAgentsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const definitions = transpiler.discover();

      expect(definitions).toHaveLength(1);
      expect(definitions[0].name).toBe("agent");
    });

    // --- Трансформация: шаг 5 — name формируется из имени файла без .md ---
    it("формирует name как имя файла без расширения .md", () => {
      const agentsDir = path.join(tmpDir, ".agents", "agents");
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.writeFileSync(path.join(agentsDir, "my-complex-agent.md"), "content");

      const transpiler = createAgentsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const definitions = transpiler.discover();

      expect(definitions).toHaveLength(1);
      expect(definitions[0].name).toBe("my-complex-agent");
    });

    // --- Трансформация: шаг 2 — только прямые дочерние файлы ---
    it("обнаруживает только прямые дочерние файлы каталога .agents/agents/", () => {
      const agentsDir = path.join(tmpDir, ".agents", "agents");
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.writeFileSync(path.join(agentsDir, "top-level.md"), "top content");

      // Вложенный каталог — не должен обнаруживаться
      const nestedDir = path.join(agentsDir, "nested");
      fs.mkdirSync(nestedDir);
      fs.writeFileSync(path.join(nestedDir, "nested-agent.md"), "nested");

      const transpiler = createAgentsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const definitions = transpiler.discover();

      expect(definitions).toHaveLength(1);
      expect(definitions[0].name).toBe("top-level");
    });

    // --- Расширение 1a: каталог .agents/agents/ не существует → пустой массив ---
    it("возвращает пустой массив, если каталог .agents/agents/ не существует", () => {
      // tmpDir не содержит .agents/agents/

      const transpiler = createAgentsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const definitions = transpiler.discover();

      expect(definitions).toEqual([]);
    });

    // --- Расширение 2a: ошибка доступа к каталогу (EACCES) ---
    it("выбрасывает AgentDiscoverError при ошибке доступа к каталогу .agents/agents/", () => {
      const agentsDir = path.join(tmpDir, ".agents", "agents");
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.chmodSync(agentsDir, 0o000);

      const transpiler = createAgentsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      try {
        expect(() => transpiler.discover()).toThrow(AgentDiscoverError);
        expect(() => transpiler.discover()).toThrow(
          /Failed to scan directory \.agents\/agents\//,
        );
      } finally {
        fs.chmodSync(agentsDir, 0o755);
      }
    });

    // --- Расширение 4a: ошибка чтения файла ---
    it("выбрасывает AgentDiscoverError при ошибке чтения файла", () => {
      const agentsDir = path.join(tmpDir, ".agents", "agents");
      fs.mkdirSync(agentsDir, { recursive: true });
      const filePath = path.join(agentsDir, "broken.md");
      fs.writeFileSync(filePath, "content");
      fs.chmodSync(filePath, 0o000);

      const transpiler = createAgentsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      try {
        expect(() => transpiler.discover()).toThrow(AgentDiscoverError);
        expect(() => transpiler.discover()).toThrow(
          /Failed to read .agents\/agents\/broken\.md/,
        );
      } finally {
        fs.chmodSync(filePath, 0o644);
      }
    });

    // --- Пустой каталог: .agents/agents/ существует, но пуст ---
    it("возвращает пустой массив, если каталог .agents/agents/ пуст", () => {
      const agentsDir = path.join(tmpDir, ".agents", "agents");
      fs.mkdirSync(agentsDir, { recursive: true });

      const transpiler = createAgentsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const definitions = transpiler.discover();

      expect(definitions).toEqual([]);
    });
  });
});
