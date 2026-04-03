// mcp-transpiler.spec.ts
// Спецификация: docs/specs/mcp-transpiler.md

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createMcpTranspiler } from "../index.js";
import {
  ConfigError,
  DiscoverError,
  TransformError,
  WriteError,
} from "../errors.js";
import { validateCanonicalContent } from "../validate.js";
import { ClaudeMcpAdapter } from "../adapters/claude-adapter.js";

/**
 * Стаб-адаптер, реализующий минимальный интерфейс McpAdapter.
 * Используется для тестирования фабричной функции и транспиляции,
 * а не поведения конкретного адаптера.
 */
function createStubAdapter(agentId: string) {
  return {
    agentId,
    transpile: () => [],
  };
}

// =============================================================================
// Инициализация
// Спецификация: docs/specs/mcp-transpiler.md § Инициализация
// =============================================================================

describe("McpTranspiler", () => {
  describe("Инициализация", () => {
    // --- Happy path: шаги 1-5 ---
    it("создаёт экземпляр с методами discover, transpile, writeResults", () => {
      const transpiler = createMcpTranspiler({
        projectRoot: "/absolute/path/to/project",
        adapters: [createStubAdapter("claude")],
      });

      expect(transpiler).toBeDefined();
      expect(typeof transpiler.discover).toBe("function");
      expect(typeof transpiler.transpile).toBe("function");
      expect(typeof transpiler.writeResults).toBe("function");
    });

    // --- Расширение 1a: projectRoot не абсолютный путь ---
    it("выбрасывает ConfigError, если projectRoot -- относительный путь", () => {
      expect(() =>
        createMcpTranspiler({
          projectRoot: "relative/path",
          adapters: [createStubAdapter("claude")],
        }),
      ).toThrow(ConfigError);

      expect(() =>
        createMcpTranspiler({
          projectRoot: "relative/path",
          adapters: [createStubAdapter("claude")],
        }),
      ).toThrow("projectRoot must be an absolute path");
    });

    // --- Расширение 2a: пустой массив adapters ---
    it("выбрасывает ConfigError, если массив adapters пуст", () => {
      expect(() =>
        createMcpTranspiler({
          projectRoot: "/absolute/path",
          adapters: [],
        }),
      ).toThrow(ConfigError);

      expect(() =>
        createMcpTranspiler({
          projectRoot: "/absolute/path",
          adapters: [],
        }),
      ).toThrow("At least one adapter is required");
    });

    // --- Расширение 3a: адаптер не реализует интерфейс ---
    it("выбрасывает ConfigError, если адаптер не реализует интерфейс McpAdapter", () => {
      const invalidAdapter = { notAnAdapter: true } as any;

      expect(() =>
        createMcpTranspiler({
          projectRoot: "/absolute/path",
          adapters: [invalidAdapter],
        }),
      ).toThrow(ConfigError);

      expect(() =>
        createMcpTranspiler({
          projectRoot: "/absolute/path",
          adapters: [invalidAdapter],
        }),
      ).toThrow("Adapter at index 0 does not implement McpAdapter interface");
    });

    // --- Расширение 4a: дублирующийся agentId ---
    it("выбрасывает ConfigError при дублировании agentId среди адаптеров", () => {
      expect(() =>
        createMcpTranspiler({
          projectRoot: "/absolute/path",
          adapters: [createStubAdapter("claude"), createStubAdapter("claude")],
        }),
      ).toThrow(ConfigError);

      expect(() =>
        createMcpTranspiler({
          projectRoot: "/absolute/path",
          adapters: [createStubAdapter("claude"), createStubAdapter("claude")],
        }),
      ).toThrow("Duplicate agentId: claude");
    });
  });

  // ===========================================================================
  // Обнаружение канонического файла
  // Спецификация: docs/specs/mcp-transpiler.md § Обнаружение канонического файла
  // ===========================================================================

  describe("Обнаружение канонического файла", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-mcp-discover-"));
      fs.mkdirSync(path.join(tmpDir, ".agloom"), { recursive: true });
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Happy path: шаги 1-6 -- обнаружение .agloom/mcp.yml ---
    it("обнаруживает .agloom/mcp.yml и возвращает McpCanonicalFile с format yaml", () => {
      const yamlContent = "mcpServers:\n  context7:\n    command: npx\n";
      fs.writeFileSync(path.join(tmpDir, ".agloom", "mcp.yml"), yamlContent);

      const transpiler = createMcpTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const result = transpiler.discover();

      expect(result).not.toBeNull();
      expect(result!.relativePath).toBe(".agloom/mcp.yml");
      expect(result!.format).toBe("yaml");
      expect(result!.content.mcpServers).toBeDefined();
      expect(result!.content.mcpServers.context7).toBeDefined();
      expect(result!.content.mcpServers.context7.command).toBe("npx");
    });

    // --- Happy path: шаги 1-6 -- обнаружение .agloom/mcp.json ---
    it("обнаруживает .agloom/mcp.json и возвращает McpCanonicalFile с format json", () => {
      const jsonContent = JSON.stringify({
        mcpServers: {
          context7: {
            command: "npx",
            args: ["-y", "@upstash/context7-mcp@latest"],
          },
        },
      });
      fs.writeFileSync(path.join(tmpDir, ".agloom", "mcp.json"), jsonContent);

      const transpiler = createMcpTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const result = transpiler.discover();

      expect(result).not.toBeNull();
      expect(result!.relativePath).toBe(".agloom/mcp.json");
      expect(result!.format).toBe("json");
      expect(result!.content.mcpServers.context7.command).toBe("npx");
      expect(result!.content.mcpServers.context7.args).toEqual([
        "-y",
        "@upstash/context7-mcp@latest",
      ]);
    });

    // --- Расширение 3a: оба файла существуют ---
    it("выбрасывает DiscoverError, если оба .agloom/mcp.yml и .agloom/mcp.json существуют", () => {
      fs.writeFileSync(
        path.join(tmpDir, ".agloom", "mcp.yml"),
        "mcpServers: {}",
      );
      fs.writeFileSync(
        path.join(tmpDir, ".agloom", "mcp.json"),
        '{"mcpServers": {}}',
      );

      const transpiler = createMcpTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      expect(() => transpiler.discover()).toThrow(DiscoverError);
      expect(() => transpiler.discover()).toThrow(
        "Both .agloom/mcp.yml and .agloom/mcp.json exist. Remove one to resolve the conflict.",
      );
    });

    // --- Расширение 3b: ни один файл не обнаружен ---
    it("возвращает null, если ни .agloom/mcp.yml, ни .agloom/mcp.json не существуют", () => {
      const transpiler = createMcpTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const result = transpiler.discover();

      expect(result).toBeNull();
    });

    // --- Расширение 5a: ошибка парсинга YAML ---
    it("выбрасывает DiscoverError при невалидном YAML", () => {
      fs.writeFileSync(
        path.join(tmpDir, ".agloom", "mcp.yml"),
        "mcpServers:\n  - invalid: [yaml: {\n",
      );

      const transpiler = createMcpTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      expect(() => transpiler.discover()).toThrow(DiscoverError);
      expect(() => transpiler.discover()).toThrow(
        /Failed to parse \.agloom\/mcp\.yml/,
      );
    });

    // --- Расширение 5b: ошибка парсинга JSON ---
    it("выбрасывает DiscoverError при невалидном JSON", () => {
      fs.writeFileSync(
        path.join(tmpDir, ".agloom", "mcp.json"),
        "{invalid json",
      );

      const transpiler = createMcpTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      expect(() => transpiler.discover()).toThrow(DiscoverError);
      expect(() => transpiler.discover()).toThrow(
        /Failed to parse \.agloom\/mcp\.json/,
      );
    });

    // --- Расширение 4a: ошибка чтения файла ---
    it("выбрасывает DiscoverError при ошибке чтения файла", () => {
      const ymlPath = path.join(tmpDir, ".agloom", "mcp.yml");
      fs.writeFileSync(ymlPath, "mcpServers: {}");
      fs.chmodSync(ymlPath, 0o000);

      const transpiler = createMcpTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      try {
        expect(() => transpiler.discover()).toThrow(DiscoverError);
        expect(() => transpiler.discover()).toThrow(/Failed to read/);
      } finally {
        fs.chmodSync(ymlPath, 0o644);
      }
    });

    // --- Граничное условие: пустой mcpServers ---
    it("обнаруживает файл с пустым mcpServers", () => {
      fs.writeFileSync(
        path.join(tmpDir, ".agloom", "mcp.yml"),
        "mcpServers: {}",
      );

      const transpiler = createMcpTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const result = transpiler.discover();

      expect(result).not.toBeNull();
      expect(result!.content.mcpServers).toEqual({});
    });

    // --- Трансформация: шаг 5 -- парсинг YAML с args массивом ---
    it("корректно парсит YAML с массивом args", () => {
      const yamlContent = [
        "mcpServers:",
        "  filesystem:",
        "    command: npx",
        "    args:",
        '      - "-y"',
        '      - "@modelcontextprotocol/server-filesystem"',
        "    env:",
        '      ROOT_DIR: "/home/user"',
      ].join("\n");
      fs.writeFileSync(path.join(tmpDir, ".agloom", "mcp.yml"), yamlContent);

      const transpiler = createMcpTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const result = transpiler.discover();

      expect(result).not.toBeNull();
      expect(result!.content.mcpServers.filesystem.args).toEqual([
        "-y",
        "@modelcontextprotocol/server-filesystem",
      ]);
      expect(result!.content.mcpServers.filesystem.env).toEqual({
        ROOT_DIR: "/home/user",
      });
    });
  });

  // ===========================================================================
  // Валидация канонического файла
  // Спецификация: docs/specs/mcp-transpiler.md § Валидация канонического файла
  // ===========================================================================

  describe("Валидация канонического файла", () => {
    // --- Happy path: шаги 1-3 -- валидный контент ---
    it("принимает валидный контент с обязательными и опциональными полями", () => {
      const content = {
        mcpServers: {
          context7: {
            command: "npx",
            args: ["-y", "@upstash/context7-mcp@latest"],
            env: { API_KEY: "test" },
          },
        },
      };

      const result = validateCanonicalContent(content);

      expect(result.mcpServers.context7.command).toBe("npx");
    });

    // --- Happy path: минимальный валидный контент ---
    it("принимает контент с только обязательным полем command", () => {
      const content = {
        mcpServers: {
          simple: { command: "node" },
        },
      };

      const result = validateCanonicalContent(content);

      expect(result.mcpServers.simple.command).toBe("node");
    });

    // --- Happy path: контент с includeTools ---
    it("принимает контент с includeTools", () => {
      const content = {
        mcpServers: {
          filesystem: {
            command: "npx",
            includeTools: ["read_file", "list_directory"],
          },
        },
      };

      const result = validateCanonicalContent(content);

      expect(result.mcpServers.filesystem.includeTools).toEqual([
        "read_file",
        "list_directory",
      ]);
    });

    // --- Happy path: контент с excludeTools ---
    it("принимает контент с excludeTools", () => {
      const content = {
        mcpServers: {
          filesystem: {
            command: "npx",
            excludeTools: ["delete_file"],
          },
        },
      };

      const result = validateCanonicalContent(content);

      expect(result.mcpServers.filesystem.excludeTools).toEqual([
        "delete_file",
      ]);
    });

    // --- Расширение 1a: content не является объектом ---
    it("выбрасывает TransformError, если content не является объектом", () => {
      expect(() => validateCanonicalContent("not an object" as any)).toThrow(
        TransformError,
      );
      expect(() => validateCanonicalContent("not an object" as any)).toThrow(
        "MCP config must be an object",
      );
    });

    it("выбрасывает TransformError, если content равен null", () => {
      expect(() => validateCanonicalContent(null as any)).toThrow(
        TransformError,
      );
      expect(() => validateCanonicalContent(null as any)).toThrow(
        "MCP config must be an object",
      );
    });

    // --- Расширение 2a: поле mcpServers отсутствует ---
    it("выбрасывает TransformError, если mcpServers отсутствует", () => {
      expect(() => validateCanonicalContent({} as any)).toThrow(TransformError);
      expect(() => validateCanonicalContent({} as any)).toThrow(
        "MCP config must contain 'mcpServers' field",
      );
    });

    // --- Расширение 2b: mcpServers не является объектом ---
    it("выбрасывает TransformError, если mcpServers не является объектом", () => {
      expect(() =>
        validateCanonicalContent({ mcpServers: "not an object" } as any),
      ).toThrow(TransformError);
      expect(() =>
        validateCanonicalContent({ mcpServers: "not an object" } as any),
      ).toThrow("'mcpServers' must be an object");
    });

    it("выбрасывает TransformError, если mcpServers является массивом", () => {
      expect(() => validateCanonicalContent({ mcpServers: [] } as any)).toThrow(
        TransformError,
      );
      expect(() => validateCanonicalContent({ mcpServers: [] } as any)).toThrow(
        "'mcpServers' must be an object",
      );
    });

    // --- Расширение 3b: command отсутствует ---
    it("выбрасывает TransformError, если command отсутствует у сервера", () => {
      expect(() =>
        validateCanonicalContent({
          mcpServers: { myserver: { args: ["--port", "8080"] } },
        } as any),
      ).toThrow(TransformError);
      expect(() =>
        validateCanonicalContent({
          mcpServers: { myserver: { args: ["--port", "8080"] } },
        } as any),
      ).toThrow(
        "Server 'myserver': 'command' is required and must be a string",
      );
    });

    // --- Расширение 3b: command не является строкой ---
    it("выбрасывает TransformError, если command не является строкой", () => {
      expect(() =>
        validateCanonicalContent({
          mcpServers: { myserver: { command: 123 } },
        } as any),
      ).toThrow(TransformError);
      expect(() =>
        validateCanonicalContent({
          mcpServers: { myserver: { command: 123 } },
        } as any),
      ).toThrow(
        "Server 'myserver': 'command' is required and must be a string",
      );
    });

    // --- Расширение 3c: args не является массивом строк ---
    it("выбрасывает TransformError, если args не является массивом строк", () => {
      expect(() =>
        validateCanonicalContent({
          mcpServers: { myserver: { command: "npx", args: "not-array" } },
        } as any),
      ).toThrow(TransformError);
      expect(() =>
        validateCanonicalContent({
          mcpServers: { myserver: { command: "npx", args: "not-array" } },
        } as any),
      ).toThrow("Server 'myserver': 'args' must be an array of strings");
    });

    it("выбрасывает TransformError, если args содержит нестроковые элементы", () => {
      expect(() =>
        validateCanonicalContent({
          mcpServers: { myserver: { command: "npx", args: [1, 2] } },
        } as any),
      ).toThrow(TransformError);
      expect(() =>
        validateCanonicalContent({
          mcpServers: { myserver: { command: "npx", args: [1, 2] } },
        } as any),
      ).toThrow("Server 'myserver': 'args' must be an array of strings");
    });

    // --- Расширение 3d: env не является объектом с string-значениями ---
    it("выбрасывает TransformError, если env не является объектом", () => {
      expect(() =>
        validateCanonicalContent({
          mcpServers: { myserver: { command: "npx", env: "not-object" } },
        } as any),
      ).toThrow(TransformError);
      expect(() =>
        validateCanonicalContent({
          mcpServers: { myserver: { command: "npx", env: "not-object" } },
        } as any),
      ).toThrow(
        "Server 'myserver': 'env' must be an object with string values",
      );
    });

    it("выбрасывает TransformError, если env содержит нестроковые значения", () => {
      expect(() =>
        validateCanonicalContent({
          mcpServers: {
            myserver: { command: "npx", env: { PORT: 8080 } },
          },
        } as any),
      ).toThrow(TransformError);
      expect(() =>
        validateCanonicalContent({
          mcpServers: {
            myserver: { command: "npx", env: { PORT: 8080 } },
          },
        } as any),
      ).toThrow(
        "Server 'myserver': 'env' must be an object with string values",
      );
    });

    // --- Расширение 3e: includeTools не является массивом строк ---
    it("выбрасывает TransformError, если includeTools не является массивом строк", () => {
      expect(() =>
        validateCanonicalContent({
          mcpServers: {
            myserver: { command: "npx", includeTools: "read_file" },
          },
        } as any),
      ).toThrow(TransformError);
      expect(() =>
        validateCanonicalContent({
          mcpServers: {
            myserver: { command: "npx", includeTools: "read_file" },
          },
        } as any),
      ).toThrow(
        "Server 'myserver': 'includeTools' must be an array of strings",
      );
    });

    // --- Расширение 3f: excludeTools не является массивом строк ---
    it("выбрасывает TransformError, если excludeTools не является массивом строк", () => {
      expect(() =>
        validateCanonicalContent({
          mcpServers: {
            myserver: { command: "npx", excludeTools: 42 },
          },
        } as any),
      ).toThrow(TransformError);
      expect(() =>
        validateCanonicalContent({
          mcpServers: {
            myserver: { command: "npx", excludeTools: 42 },
          },
        } as any),
      ).toThrow(
        "Server 'myserver': 'excludeTools' must be an array of strings",
      );
    });

    // --- Расширение 3a: includeTools и excludeTools одновременно ---
    it("выбрасывает TransformError, если includeTools и excludeTools указаны одновременно", () => {
      expect(() =>
        validateCanonicalContent({
          mcpServers: {
            myserver: {
              command: "npx",
              includeTools: ["read_file"],
              excludeTools: ["delete_file"],
            },
          },
        }),
      ).toThrow(TransformError);
      expect(() =>
        validateCanonicalContent({
          mcpServers: {
            myserver: {
              command: "npx",
              includeTools: ["read_file"],
              excludeTools: ["delete_file"],
            },
          },
        }),
      ).toThrow(
        "Server 'myserver': 'includeTools' and 'excludeTools' are mutually exclusive",
      );
    });

    // --- Граничное условие: пустой mcpServers ---
    it("принимает пустой объект mcpServers", () => {
      const result = validateCanonicalContent({ mcpServers: {} });

      expect(result.mcpServers).toEqual({});
    });

    // --- Граничное условие: несколько серверов ---
    it("валидирует все серверы в mcpServers", () => {
      const content = {
        mcpServers: {
          server1: { command: "node" },
          server2: { command: "npx", args: ["--flag"] },
          server3: { command: "python", env: { PATH: "/usr/bin" } },
        },
      };

      const result = validateCanonicalContent(content);

      expect(Object.keys(result.mcpServers)).toHaveLength(3);
    });
  });

  // ===========================================================================
  // Транспиляция
  // Спецификация: docs/specs/mcp-transpiler.md § Транспиляция
  // ===========================================================================

  describe("Транспиляция", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-mcp-transpile-"));
      fs.mkdirSync(path.join(tmpDir, ".agloom"), { recursive: true });
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Happy path: шаги 1-5 -- полный цикл транспиляции ---
    it("выполняет полный цикл транспиляции: discover -> validate -> interpolate -> adapter.transpile -> собрать результаты", () => {
      const yamlContent = [
        "mcpServers:",
        "  context7:",
        "    command: npx",
        '    args: ["-y", "@upstash/context7-mcp@latest"]',
      ].join("\n");
      fs.writeFileSync(path.join(tmpDir, ".agloom", "mcp.yml"), yamlContent);

      const receivedFiles: unknown[] = [];
      const stubAdapter = {
        agentId: "test",
        transpile: (file: any) => {
          receivedFiles.push(file);
          return [
            {
              relativePath: ".mcp.json",
              content: JSON.stringify({ mcpServers: {} }),
            },
          ];
        },
      };

      const transpiler = createMcpTranspiler({
        projectRoot: tmpDir,
        adapters: [stubAdapter],
      });

      const results = transpiler.transpile();

      expect(results).toHaveLength(1);
      expect(results[0].agentId).toBe("test");
      expect(results[0].files).toHaveLength(1);
      expect(results[0].errors).toHaveLength(0);
      expect(receivedFiles).toHaveLength(1);
    });

    // --- Расширение 1a: канонический файл не обнаружен ---
    it("возвращает пустой массив TranspileResult, если канонический файл не обнаружен", () => {
      // .agloom/ пуст -- нет mcp.yml / mcp.json

      const transpiler = createMcpTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const results = transpiler.transpile();

      expect(results).toEqual([]);
    });

    // --- Расширение 1b: discover() выбрасывает DiscoverError ---
    it("пробрасывает DiscoverError к вызывающему коду", () => {
      fs.writeFileSync(
        path.join(tmpDir, ".agloom", "mcp.yml"),
        "mcpServers: {}",
      );
      fs.writeFileSync(
        path.join(tmpDir, ".agloom", "mcp.json"),
        '{"mcpServers": {}}',
      );

      const transpiler = createMcpTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      expect(() => transpiler.transpile()).toThrow(DiscoverError);
    });

    // --- Расширение 2a: валидация выбрасывает TransformError ---
    it("пробрасывает TransformError при невалидном каноническом файле", () => {
      fs.writeFileSync(
        path.join(tmpDir, ".agloom", "mcp.yml"),
        "notMcpServers: true",
      );

      const transpiler = createMcpTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      expect(() => transpiler.transpile()).toThrow(TransformError);
    });

    // --- Расширение 4a: адаптер выбрасывает исключение ---
    it("создаёт TranspileResult с ошибкой при исключении адаптера и продолжает остальные", () => {
      fs.writeFileSync(
        path.join(tmpDir, ".agloom", "mcp.yml"),
        "mcpServers:\n  s1:\n    command: npx\n",
      );

      const failingAdapter = {
        agentId: "failing",
        transpile: () => {
          throw new Error("Adapter internal failure");
        },
      };
      const successAdapter = {
        agentId: "success",
        transpile: () => [{ relativePath: "test.json", content: "{}" }],
      };

      const transpiler = createMcpTranspiler({
        projectRoot: tmpDir,
        adapters: [failingAdapter, successAdapter],
      });

      const results = transpiler.transpile();

      expect(results).toHaveLength(2);

      const failingResult = results.find((r) => r.agentId === "failing");
      expect(failingResult).toBeDefined();
      expect(failingResult!.files).toHaveLength(0);
      expect(failingResult!.errors).toHaveLength(1);
      expect(failingResult!.errors[0].message).toContain(
        "Adapter internal failure",
      );
      expect(failingResult!.errors[0].agentId).toBe("failing");
      expect(failingResult!.errors[0].cause).toBeInstanceOf(Error);

      const successResult = results.find((r) => r.agentId === "success");
      expect(successResult).toBeDefined();
      expect(successResult!.files).toHaveLength(1);
      expect(successResult!.errors).toHaveLength(0);
    });

    // --- Трансформация: интерполяция ${env:VAR} в env через writeResults ---
    it("интерполирует ${env:VAR} в значениях env при записи", () => {
      const originalEnv = process.env.TEST_MCP_VAR;
      process.env.TEST_MCP_VAR = "/custom/path";

      try {
        fs.writeFileSync(
          path.join(tmpDir, ".agloom", "mcp.yml"),
          "mcpServers:\n  s1:\n    command: npx\n    env:\n      ROOT: '${env:TEST_MCP_VAR}'\n",
        );

        // ClaudeMcpAdapter imported at top of file
        const transpiler = createMcpTranspiler({
          projectRoot: tmpDir,
          adapters: [new ClaudeMcpAdapter()],
        });

        const results = transpiler.transpile();
        transpiler.writeResults(results);

        const written = JSON.parse(
          fs.readFileSync(path.join(tmpDir, ".mcp.json"), "utf-8"),
        );
        expect(written.mcpServers.s1.env.ROOT).toBe("/custom/path");
      } finally {
        if (originalEnv === undefined) {
          delete process.env.TEST_MCP_VAR;
        } else {
          process.env.TEST_MCP_VAR = originalEnv;
        }
      }
    });

    // --- Трансформация: шаг 3 -- ${VAR} без namespace передаётся as-is ---
    it("передаёт ${VAR} без namespace-prefix as-is (не интерполирует)", () => {
      fs.writeFileSync(
        path.join(tmpDir, ".agloom", "mcp.yml"),
        "mcpServers:\n  s1:\n    command: npx\n    env:\n      HOME: '${HOME}'\n",
      );

      let receivedFile: any = null;
      const captureAdapter = {
        agentId: "capture",
        transpile: (file: any) => {
          receivedFile = file;
          return [];
        },
      };

      const transpiler = createMcpTranspiler({
        projectRoot: tmpDir,
        adapters: [captureAdapter],
      });

      transpiler.transpile();

      expect(receivedFile).not.toBeNull();
      expect(receivedFile.content.mcpServers.s1.env.HOME).toBe("${HOME}");
    });

    // --- Трансформация: интерполяция ${env:VAR} в command и args через writeResults ---
    it("интерполирует ${env:VAR} в полях command и args при записи", () => {
      const originalEnv = process.env.TEST_MCP_CMD;
      process.env.TEST_MCP_CMD = "custom-npx";

      try {
        fs.writeFileSync(
          path.join(tmpDir, ".agloom", "mcp.yml"),
          "mcpServers:\n  s1:\n    command: '${env:TEST_MCP_CMD}'\n    args: ['${env:TEST_MCP_CMD}']\n",
        );

        // ClaudeMcpAdapter imported at top of file
        const transpiler = createMcpTranspiler({
          projectRoot: tmpDir,
          adapters: [new ClaudeMcpAdapter()],
        });

        const results = transpiler.transpile();
        transpiler.writeResults(results);

        const written = JSON.parse(
          fs.readFileSync(path.join(tmpDir, ".mcp.json"), "utf-8"),
        );
        expect(written.mcpServers.s1.command).toBe("custom-npx");
        expect(written.mcpServers.s1.args[0]).toBe("custom-npx");
      } finally {
        if (originalEnv === undefined) {
          delete process.env.TEST_MCP_CMD;
        } else {
          process.env.TEST_MCP_CMD = originalEnv;
        }
      }
    });

    // --- InterpolationError при writeResults ---
    it("пробрасывает ошибку при интерполяции неопределённой переменной окружения", () => {
      fs.writeFileSync(
        path.join(tmpDir, ".agloom", "mcp.yml"),
        "mcpServers:\n  s1:\n    command: '${env:VAR_THAT_DEFINITELY_DOES_NOT_EXIST_XYZ}'\n",
      );

      // ClaudeMcpAdapter imported at top of file
      const transpiler = createMcpTranspiler({
        projectRoot: tmpDir,
        adapters: [new ClaudeMcpAdapter()],
      });

      const results = transpiler.transpile();
      const writeResult = transpiler.writeResults(results);
      // Interpolation error captured in writeResults errors
      expect(writeResult.errors.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // Запись результатов
  // Спецификация: docs/specs/mcp-transpiler.md § Запись результатов
  // ===========================================================================

  describe("Запись результатов", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-mcp-write-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Happy path: шаги 1-6 -- запись файлов и возврат путей ---
    it("записывает файлы в файловую систему и возвращает пути записанных файлов", () => {
      const transpiler = createMcpTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "claude",
          files: [
            {
              relativePath: ".mcp.json",
              content: '{\n  "mcpServers": {}\n}\n',
            },
          ],
          errors: [],
        },
      ]);

      expect(writeResult.written).toContain(".mcp.json");
      expect(writeResult.errors).toHaveLength(0);

      const writtenContent = fs.readFileSync(
        path.join(tmpDir, ".mcp.json"),
        "utf-8",
      );
      expect(writtenContent).toBe('{\n  "mcpServers": {}\n}\n');
    });

    // --- Трансформация: шаг 5 -- создание промежуточных каталогов ---
    it("создаёт промежуточные каталоги при записи файла", () => {
      const transpiler = createMcpTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "claude",
          files: [
            {
              relativePath: "deep/nested/config.json",
              content: "{}",
            },
          ],
          errors: [],
        },
      ]);

      expect(writeResult.written).toContain("deep/nested/config.json");
      expect(
        fs.existsSync(path.join(tmpDir, "deep", "nested", "config.json")),
      ).toBe(true);
    });

    // --- Расширение 1a: TranspileResult содержит ошибки ---
    it("пропускает запись файлов адаптера при наличии ошибок в TranspileResult", () => {
      const transpiler = createMcpTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("failing")],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "failing",
          files: [
            {
              relativePath: "should-not-exist.json",
              content: "{}",
            },
          ],
          errors: [
            {
              agentId: "failing",
              message: "Adapter failed",
              cause: new Error("original"),
            },
          ],
        },
      ]);

      expect(fs.existsSync(path.join(tmpDir, "should-not-exist.json"))).toBe(
        false,
      );
      expect(writeResult.errors.length).toBeGreaterThan(0);
      expect(writeResult.written).not.toContain("should-not-exist.json");
    });

    // --- Трансформация: шаг 3 -- deep merge для JSON при одинаковом relativePath ---
    it("выполняет deep merge при одинаковом relativePath для JSON-файлов из разных адаптеров", () => {
      const transpiler = createMcpTranspiler({
        projectRoot: tmpDir,
        adapters: [
          createStubAdapter("adapter1"),
          createStubAdapter("adapter2"),
        ],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "adapter1",
          files: [
            {
              relativePath: "opencode.json",
              content:
                JSON.stringify(
                  { mcp: { server1: { command: "npx" } } },
                  null,
                  2,
                ) + "\n",
            },
          ],
          errors: [],
        },
        {
          agentId: "adapter2",
          files: [
            {
              relativePath: "opencode.json",
              content:
                JSON.stringify({ other: { key: "value" } }, null, 2) + "\n",
            },
          ],
          errors: [],
        },
      ]);

      expect(writeResult.written).toContain("opencode.json");

      const writtenContent = JSON.parse(
        fs.readFileSync(path.join(tmpDir, "opencode.json"), "utf-8"),
      );
      // deep merge: оба ключа должны присутствовать
      expect(writtenContent.mcp).toBeDefined();
      expect(writtenContent.mcp.server1.command).toBe("npx");
      expect(writtenContent.other).toBeDefined();
      expect(writtenContent.other.key).toBe("value");
    });

    // --- Трансформация: шаг 4 -- deep merge с существующим файлом ---
    it("выполняет deep merge с существующим файлом на диске", () => {
      // Предварительно записываем файл (от overlay или предыдущего шага)
      const existingContent = {
        existing: { key: "preserved" },
        replaced: { old: true },
      };
      fs.writeFileSync(
        path.join(tmpDir, "opencode.json"),
        JSON.stringify(existingContent, null, 2),
      );

      const transpiler = createMcpTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("opencode")],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "opencode",
          files: [
            {
              relativePath: "opencode.json",
              content:
                JSON.stringify(
                  {
                    mcp: { server1: { command: "npx" } },
                    replaced: { new: true },
                  },
                  null,
                  2,
                ) + "\n",
            },
          ],
          errors: [],
        },
      ]);

      expect(writeResult.written).toContain("opencode.json");

      const writtenContent = JSON.parse(
        fs.readFileSync(path.join(tmpDir, "opencode.json"), "utf-8"),
      );
      expect(writtenContent.existing.key).toBe("preserved");
      expect(writtenContent.mcp.server1.command).toBe("npx");
      expect(writtenContent.replaced.new).toBe(true);
    });

    // --- Расширение 4a: существующий файл содержит невалидный JSON ---
    it("перезаписывает файл целиком, если существующий файл содержит невалидный JSON", () => {
      fs.writeFileSync(
        path.join(tmpDir, "opencode.json"),
        "{invalid json content",
      );

      const transpiler = createMcpTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("opencode")],
      });

      const newContent = { mcp: { s1: { command: "npx" } } };
      const writeResult = transpiler.writeResults([
        {
          agentId: "opencode",
          files: [
            {
              relativePath: "opencode.json",
              content: JSON.stringify(newContent, null, 2) + "\n",
            },
          ],
          errors: [],
        },
      ]);

      expect(writeResult.written).toContain("opencode.json");

      const writtenContent = JSON.parse(
        fs.readFileSync(path.join(tmpDir, "opencode.json"), "utf-8"),
      );
      expect(writtenContent.mcp.s1.command).toBe("npx");
    });

    // --- Расширение 5a: ошибка записи файла ---
    it("возвращает WriteError при ошибке записи файла", () => {
      // Создаём файл вместо каталога -- запись в подпапку невозможна
      fs.writeFileSync(path.join(tmpDir, "blocker"), "not a directory");

      const transpiler = createMcpTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "claude",
          files: [
            {
              relativePath: "blocker/config.json",
              content: "{}",
            },
          ],
          errors: [],
        },
      ]);

      expect(writeResult.errors.length).toBeGreaterThan(0);
      expect(writeResult.errors[0]).toBeInstanceOf(WriteError);
      expect(writeResult.errors[0].message).toMatch(
        /Failed to write blocker\/config\.json/,
      );
    });

    // --- Запись UTF-8 ---
    it("записывает файлы в кодировке UTF-8", () => {
      const transpiler = createMcpTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const unicodeContent =
        '{\n  "mcpServers": {\n    "description": "Описание на русском"\n  }\n}\n';

      transpiler.writeResults([
        {
          agentId: "claude",
          files: [{ relativePath: ".mcp.json", content: unicodeContent }],
          errors: [],
        },
      ]);

      const writtenContent = fs.readFileSync(
        path.join(tmpDir, ".mcp.json"),
        "utf-8",
      );
      expect(writtenContent).toBe(unicodeContent);
    });

    // --- Смешанный сценарий: один адаптер с ошибками, другой без ---
    it("пропускает файлы адаптера с ошибками, но записывает файлы успешного адаптера", () => {
      const transpiler = createMcpTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("failing"), createStubAdapter("claude")],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "failing",
          files: [{ relativePath: "fail.json", content: "{}" }],
          errors: [
            {
              agentId: "failing",
              message: "Adapter failed",
              cause: new Error("original"),
            },
          ],
        },
        {
          agentId: "claude",
          files: [{ relativePath: ".mcp.json", content: '{"mcpServers":{}}' }],
          errors: [],
        },
      ]);

      expect(fs.existsSync(path.join(tmpDir, "fail.json"))).toBe(false);
      expect(fs.existsSync(path.join(tmpDir, ".mcp.json"))).toBe(true);
      expect(writeResult.written).toContain(".mcp.json");
      expect(writeResult.written).not.toContain("fail.json");
    });
  });
});
