// permissions-transpiler.spec.ts
// Спецификация: docs/specs/permissions-transpiler.md

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createPermissionsTranspiler } from "../index.js";
import {
  ConfigError,
  DiscoverError,
  TransformError,
  WriteError,
} from "../errors.js";
import { validatePermissionsContent } from "../validate.js";

/**
 * Стаб-адаптер, реализующий минимальный интерфейс PermissionsAdapter.
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
// Спецификация: docs/specs/permissions-transpiler.md § Инициализация
// =============================================================================

describe("PermissionsTranspiler", () => {
  describe("Инициализация", () => {
    // --- Happy path: шаги 1-5 ---
    it("создаёт экземпляр с методами discover, transpile, writeResults", () => {
      const transpiler = createPermissionsTranspiler({
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
        createPermissionsTranspiler({
          projectRoot: "relative/path",
          adapters: [createStubAdapter("claude")],
        }),
      ).toThrow(ConfigError);

      expect(() =>
        createPermissionsTranspiler({
          projectRoot: "relative/path",
          adapters: [createStubAdapter("claude")],
        }),
      ).toThrow("projectRoot must be an absolute path");
    });

    // --- Расширение 2a: пустой массив adapters ---
    it("выбрасывает ConfigError, если массив adapters пуст", () => {
      expect(() =>
        createPermissionsTranspiler({
          projectRoot: "/absolute/path",
          adapters: [],
        }),
      ).toThrow(ConfigError);

      expect(() =>
        createPermissionsTranspiler({
          projectRoot: "/absolute/path",
          adapters: [],
        }),
      ).toThrow("At least one adapter is required");
    });

    // --- Расширение 3a: адаптер не реализует интерфейс ---
    it("выбрасывает ConfigError, если адаптер не реализует интерфейс PermissionsAdapter", () => {
      const invalidAdapter = { notAnAdapter: true } as any;

      expect(() =>
        createPermissionsTranspiler({
          projectRoot: "/absolute/path",
          adapters: [invalidAdapter],
        }),
      ).toThrow(ConfigError);

      expect(() =>
        createPermissionsTranspiler({
          projectRoot: "/absolute/path",
          adapters: [invalidAdapter],
        }),
      ).toThrow(
        "Adapter at index 0 does not implement PermissionsAdapter interface",
      );
    });

    // --- Расширение 4a: дублирующийся agentId ---
    it("выбрасывает ConfigError при дублировании agentId среди адаптеров", () => {
      expect(() =>
        createPermissionsTranspiler({
          projectRoot: "/absolute/path",
          adapters: [createStubAdapter("claude"), createStubAdapter("claude")],
        }),
      ).toThrow(ConfigError);

      expect(() =>
        createPermissionsTranspiler({
          projectRoot: "/absolute/path",
          adapters: [createStubAdapter("claude"), createStubAdapter("claude")],
        }),
      ).toThrow("Duplicate agentId: claude");
    });
  });

  // ===========================================================================
  // Обнаружение канонического файла
  // Спецификация: docs/specs/permissions-transpiler.md § Обнаружение канонического файла
  // ===========================================================================

  describe("Обнаружение канонического файла", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-perm-discover-"));
      fs.mkdirSync(path.join(tmpDir, ".agloom"), { recursive: true });
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Happy path: шаги 1-6 -- обнаружение .agloom/permissions.yml ---
    it("обнаруживает .agloom/permissions.yml и возвращает PermissionsCanonicalFile с format yaml", () => {
      const yamlContent = "shell:\n  allow:\n    - 'ls:*'\n";
      fs.writeFileSync(
        path.join(tmpDir, ".agloom", "permissions.yml"),
        yamlContent,
      );

      const transpiler = createPermissionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const result = transpiler.discover();

      expect(result).not.toBeNull();
      expect(result!.relativePath).toBe(".agloom/permissions.yml");
      expect(result!.format).toBe("yaml");
      expect(result!.content.shell).toBeDefined();
      expect(result!.content.shell!.allow).toEqual(["ls:*"]);
    });

    // --- Happy path: шаги 1-6 -- обнаружение .agloom/permissions.json ---
    it("обнаруживает .agloom/permissions.json и возвращает PermissionsCanonicalFile с format json", () => {
      const jsonContent = JSON.stringify({
        shell: {
          allow: ["ls:*"],
          deny: ["*:*"],
        },
      });
      fs.writeFileSync(
        path.join(tmpDir, ".agloom", "permissions.json"),
        jsonContent,
      );

      const transpiler = createPermissionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const result = transpiler.discover();

      expect(result).not.toBeNull();
      expect(result!.relativePath).toBe(".agloom/permissions.json");
      expect(result!.format).toBe("json");
      expect(result!.content.shell!.allow).toEqual(["ls:*"]);
      expect(result!.content.shell!.deny).toEqual(["*:*"]);
    });

    // --- Расширение 3a: оба файла существуют ---
    it("выбрасывает DiscoverError, если оба .agloom/permissions.yml и .agloom/permissions.json существуют", () => {
      fs.writeFileSync(
        path.join(tmpDir, ".agloom", "permissions.yml"),
        "shell: {}",
      );
      fs.writeFileSync(
        path.join(tmpDir, ".agloom", "permissions.json"),
        '{"shell": {}}',
      );

      const transpiler = createPermissionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      expect(() => transpiler.discover()).toThrow(DiscoverError);
      expect(() => transpiler.discover()).toThrow(
        "Both .agloom/permissions.yml and .agloom/permissions.json exist. Remove one to resolve the conflict.",
      );
    });

    // --- Расширение 3b: ни один файл не обнаружен ---
    it("возвращает null, если ни .agloom/permissions.yml, ни .agloom/permissions.json не существуют", () => {
      const transpiler = createPermissionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const result = transpiler.discover();

      expect(result).toBeNull();
    });

    // --- Расширение 4a: ошибка чтения файла ---
    it("выбрасывает DiscoverError при ошибке чтения файла", () => {
      const ymlPath = path.join(tmpDir, ".agloom", "permissions.yml");
      fs.writeFileSync(ymlPath, "shell: {}");
      fs.chmodSync(ymlPath, 0o000);

      const transpiler = createPermissionsTranspiler({
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

    // --- Расширение 5a: ошибка парсинга YAML ---
    it("выбрасывает DiscoverError при невалидном YAML", () => {
      fs.writeFileSync(
        path.join(tmpDir, ".agloom", "permissions.yml"),
        "shell:\n  - invalid: [yaml: {\n",
      );

      const transpiler = createPermissionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      expect(() => transpiler.discover()).toThrow(DiscoverError);
      expect(() => transpiler.discover()).toThrow(
        /Failed to parse \.agloom\/permissions\.yml/,
      );
    });

    // --- Расширение 5b: ошибка парсинга JSON ---
    it("выбрасывает DiscoverError при невалидном JSON", () => {
      fs.writeFileSync(
        path.join(tmpDir, ".agloom", "permissions.json"),
        "{invalid json",
      );

      const transpiler = createPermissionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      expect(() => transpiler.discover()).toThrow(DiscoverError);
      expect(() => transpiler.discover()).toThrow(
        /Failed to parse \.agloom\/permissions\.json/,
      );
    });

    // --- Граничное условие: пустой канонический файл (все секции отсутствуют) ---
    it("обнаруживает файл без секций (пустой объект)", () => {
      fs.writeFileSync(path.join(tmpDir, ".agloom", "permissions.yml"), "{}");

      const transpiler = createPermissionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const result = transpiler.discover();

      expect(result).not.toBeNull();
      expect(result!.content.shell).toBeUndefined();
      expect(result!.content.mcp).toBeUndefined();
      expect(result!.content.file).toBeUndefined();
    });

    // --- Трансформация: шаг 5 -- парсинг YAML со всеми секциями ---
    it("корректно парсит YAML со всеми тремя секциями", () => {
      const yamlContent = [
        "shell:",
        "  allow:",
        '    - "ls:*"',
        '    - "git status:*"',
        "  ask:",
        '    - "npm:*"',
        "  deny:",
        '    - "*:*"',
        "mcp:",
        "  allow:",
        '    - "bitbucket:get_pull_request"',
        "  deny:",
        '    - "*:*"',
        "file:",
        "  deny:",
        '    - "**/.env"',
        "  read:",
        '    - "src/**"',
        "  write:",
        '    - "src/**/*.ts"',
      ].join("\n");
      fs.writeFileSync(
        path.join(tmpDir, ".agloom", "permissions.yml"),
        yamlContent,
      );

      const transpiler = createPermissionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const result = transpiler.discover();

      expect(result).not.toBeNull();
      expect(result!.content.shell!.allow).toEqual(["ls:*", "git status:*"]);
      expect(result!.content.shell!.ask).toEqual(["npm:*"]);
      expect(result!.content.shell!.deny).toEqual(["*:*"]);
      expect(result!.content.mcp!.allow).toEqual([
        "bitbucket:get_pull_request",
      ]);
      expect(result!.content.mcp!.deny).toEqual(["*:*"]);
      expect(result!.content.file!.deny).toEqual(["**/.env"]);
      expect(result!.content.file!.read).toEqual(["src/**"]);
      expect(result!.content.file!.write).toEqual(["src/**/*.ts"]);
    });
  });

  // ===========================================================================
  // Валидация канонического файла
  // Спецификация: docs/specs/permissions-transpiler.md § Валидация канонического файла
  // ===========================================================================

  describe("Валидация канонического файла", () => {
    // --- Happy path: шаги 1-5 -- валидный контент со всеми секциями ---
    it("принимает валидный контент со всеми тремя секциями", () => {
      const content = {
        shell: {
          allow: ["ls:*"],
          ask: ["npm:*"],
          deny: ["*:*"],
        },
        mcp: {
          allow: ["bitbucket:get_pull_request"],
          deny: ["*:*"],
        },
        file: {
          deny: ["**/.env"],
          read: ["src/**"],
          write: ["src/**/*.ts"],
        },
      };

      const result = validatePermissionsContent(content);

      expect(result.shell).toBeDefined();
      expect(result.mcp).toBeDefined();
      expect(result.file).toBeDefined();
    });

    // --- Happy path: пустой объект (все секции опциональны) ---
    it("принимает пустой объект (все секции опциональны)", () => {
      const result = validatePermissionsContent({});

      expect(result.shell).toBeUndefined();
      expect(result.mcp).toBeUndefined();
      expect(result.file).toBeUndefined();
    });

    // --- Happy path: только одна секция ---
    it("принимает контент с единственной секцией shell", () => {
      const content = {
        shell: { allow: ["ls:*"] },
      };

      const result = validatePermissionsContent(content);

      expect(result.shell).toBeDefined();
      expect(result.shell!.allow).toEqual(["ls:*"]);
    });

    // --- Расширение 1a: content не является объектом ---
    it("выбрасывает TransformError, если content не является объектом", () => {
      expect(() => validatePermissionsContent("not an object" as any)).toThrow(
        TransformError,
      );
      expect(() => validatePermissionsContent("not an object" as any)).toThrow(
        "Permissions config must be an object",
      );
    });

    it("выбрасывает TransformError, если content равен null", () => {
      expect(() => validatePermissionsContent(null as any)).toThrow(
        TransformError,
      );
      expect(() => validatePermissionsContent(null as any)).toThrow(
        "Permissions config must be an object",
      );
    });

    // --- Расширение 2a: неизвестный ключ ---
    it("выбрасывает TransformError при неизвестном ключе в корне", () => {
      expect(() =>
        validatePermissionsContent({ shell: {}, unknown: [] } as any),
      ).toThrow(TransformError);
      expect(() =>
        validatePermissionsContent({ shell: {}, unknown: [] } as any),
      ).toThrow(
        "Unknown key 'unknown' in permissions config. Allowed keys: shell, mcp, file",
      );
    });

    // --- Расширение 3a: shell не является объектом ---
    it("выбрасывает TransformError, если shell не является объектом", () => {
      expect(() =>
        validatePermissionsContent({ shell: "not-object" } as any),
      ).toThrow(TransformError);
      expect(() =>
        validatePermissionsContent({ shell: "not-object" } as any),
      ).toThrow("'shell' must be an object");
    });

    // --- Расширение 3b: shell содержит неизвестный ключ ---
    it("выбрасывает TransformError при неизвестном ключе в shell", () => {
      expect(() =>
        validatePermissionsContent({
          shell: { allow: [], unknown: [] },
        } as any),
      ).toThrow(TransformError);
      expect(() =>
        validatePermissionsContent({
          shell: { allow: [], unknown: [] },
        } as any),
      ).toThrow(
        "Unknown key 'unknown' in 'shell'. Allowed keys: allow, ask, deny",
      );
    });

    // --- Расширение 3c: shell.allow не массив строк ---
    it("выбрасывает TransformError, если shell.allow не является массивом строк", () => {
      expect(() =>
        validatePermissionsContent({ shell: { allow: "not-array" } } as any),
      ).toThrow(TransformError);
      expect(() =>
        validatePermissionsContent({ shell: { allow: "not-array" } } as any),
      ).toThrow("'shell.allow' must be an array of strings");
    });

    // --- Расширение 3d: shell.ask не массив строк ---
    it("выбрасывает TransformError, если shell.ask не является массивом строк", () => {
      expect(() =>
        validatePermissionsContent({ shell: { ask: 42 } } as any),
      ).toThrow(TransformError);
      expect(() =>
        validatePermissionsContent({ shell: { ask: 42 } } as any),
      ).toThrow("'shell.ask' must be an array of strings");
    });

    // --- Расширение 3e: shell.deny не массив строк ---
    it("выбрасывает TransformError, если shell.deny не является массивом строк", () => {
      expect(() =>
        validatePermissionsContent({ shell: { deny: {} } } as any),
      ).toThrow(TransformError);
      expect(() =>
        validatePermissionsContent({ shell: { deny: {} } } as any),
      ).toThrow("'shell.deny' must be an array of strings");
    });

    // --- Расширение 3f: невалидный shell-паттерн (нет разделителя :) ---
    it("выбрасывает TransformError при невалидном shell-паттерне без разделителя ':'", () => {
      expect(() =>
        validatePermissionsContent({
          shell: { allow: ["ls-without-colon"] },
        }),
      ).toThrow(TransformError);
      expect(() =>
        validatePermissionsContent({
          shell: { allow: ["ls-without-colon"] },
        }),
      ).toThrow(
        "Invalid shell pattern 'ls-without-colon': must match format '<command>:<args-glob>'",
      );
    });

    // --- Расширение 3f: невалидный shell-паттерн (два разделителя :) ---
    it("выбрасывает TransformError при shell-паттерне с двумя разделителями ':'", () => {
      expect(() =>
        validatePermissionsContent({
          shell: { deny: ["a:b:c"] },
        }),
      ).toThrow(TransformError);
      expect(() =>
        validatePermissionsContent({
          shell: { deny: ["a:b:c"] },
        }),
      ).toThrow(
        "Invalid shell pattern 'a:b:c': must match format '<command>:<args-glob>'",
      );
    });

    // --- Расширение 4a: mcp не является объектом ---
    it("выбрасывает TransformError, если mcp не является объектом", () => {
      expect(() => validatePermissionsContent({ mcp: [] } as any)).toThrow(
        TransformError,
      );
      expect(() => validatePermissionsContent({ mcp: [] } as any)).toThrow(
        "'mcp' must be an object",
      );
    });

    // --- Расширение 4b: mcp содержит неизвестный ключ ---
    it("выбрасывает TransformError при неизвестном ключе в mcp", () => {
      expect(() =>
        validatePermissionsContent({
          mcp: { allow: [], badkey: [] },
        } as any),
      ).toThrow(TransformError);
      expect(() =>
        validatePermissionsContent({
          mcp: { allow: [], badkey: [] },
        } as any),
      ).toThrow(
        "Unknown key 'badkey' in 'mcp'. Allowed keys: allow, ask, deny",
      );
    });

    // --- Расширение 4c: mcp.allow не массив строк ---
    it("выбрасывает TransformError, если mcp.allow не является массивом строк", () => {
      expect(() =>
        validatePermissionsContent({ mcp: { allow: 123 } } as any),
      ).toThrow(TransformError);
      expect(() =>
        validatePermissionsContent({ mcp: { allow: 123 } } as any),
      ).toThrow("'mcp.allow' must be an array of strings");
    });

    // --- Расширение 4d: mcp.ask не массив строк ---
    it("выбрасывает TransformError, если mcp.ask не является массивом строк", () => {
      expect(() =>
        validatePermissionsContent({ mcp: { ask: null } } as any),
      ).toThrow(TransformError);
      expect(() =>
        validatePermissionsContent({ mcp: { ask: null } } as any),
      ).toThrow("'mcp.ask' must be an array of strings");
    });

    // --- Расширение 4e: mcp.deny не массив строк ---
    it("выбрасывает TransformError, если mcp.deny не является массивом строк", () => {
      expect(() =>
        validatePermissionsContent({ mcp: { deny: true } } as any),
      ).toThrow(TransformError);
      expect(() =>
        validatePermissionsContent({ mcp: { deny: true } } as any),
      ).toThrow("'mcp.deny' must be an array of strings");
    });

    // --- Расширение 4f: невалидный MCP-паттерн ---
    it("выбрасывает TransformError при невалидном MCP-паттерне без разделителя ':'", () => {
      expect(() =>
        validatePermissionsContent({
          mcp: { allow: ["bitbucket_get_pull_request"] },
        }),
      ).toThrow(TransformError);
      expect(() =>
        validatePermissionsContent({
          mcp: { allow: ["bitbucket_get_pull_request"] },
        }),
      ).toThrow(
        "Invalid MCP pattern 'bitbucket_get_pull_request': must match format '<server>:<tool>'",
      );
    });

    // --- Расширение 5a: file не является объектом ---
    it("выбрасывает TransformError, если file не является объектом", () => {
      expect(() =>
        validatePermissionsContent({ file: "string" } as any),
      ).toThrow(TransformError);
      expect(() =>
        validatePermissionsContent({ file: "string" } as any),
      ).toThrow("'file' must be an object");
    });

    // --- Расширение 5b: file содержит неизвестный ключ ---
    it("выбрасывает TransformError при неизвестном ключе в file", () => {
      expect(() =>
        validatePermissionsContent({
          file: { deny: [], allow: [] },
        } as any),
      ).toThrow(TransformError);
      expect(() =>
        validatePermissionsContent({
          file: { deny: [], allow: [] },
        } as any),
      ).toThrow(
        "Unknown key 'allow' in 'file'. Allowed keys: deny, read, write",
      );
    });

    // --- Расширение 5c: file.deny не массив строк ---
    it("выбрасывает TransformError, если file.deny не является массивом строк", () => {
      expect(() =>
        validatePermissionsContent({ file: { deny: 42 } } as any),
      ).toThrow(TransformError);
      expect(() =>
        validatePermissionsContent({ file: { deny: 42 } } as any),
      ).toThrow("'file.deny' must be an array of strings");
    });

    // --- Расширение 5d: file.read не массив строк ---
    it("выбрасывает TransformError, если file.read не является массивом строк", () => {
      expect(() =>
        validatePermissionsContent({ file: { read: {} } } as any),
      ).toThrow(TransformError);
      expect(() =>
        validatePermissionsContent({ file: { read: {} } } as any),
      ).toThrow("'file.read' must be an array of strings");
    });

    // --- Расширение 5e: file.write не массив строк ---
    it("выбрасывает TransformError, если file.write не является массивом строк", () => {
      expect(() =>
        validatePermissionsContent({ file: { write: false } } as any),
      ).toThrow(TransformError);
      expect(() =>
        validatePermissionsContent({ file: { write: false } } as any),
      ).toThrow("'file.write' must be an array of strings");
    });

    // --- Граничное условие: пустые массивы в секциях ---
    it("принимает секции с пустыми массивами", () => {
      const content = {
        shell: { allow: [], ask: [], deny: [] },
        mcp: { allow: [], ask: [], deny: [] },
        file: { deny: [], read: [], write: [] },
      };

      const result = validatePermissionsContent(content);

      expect(result.shell!.allow).toEqual([]);
      expect(result.mcp!.deny).toEqual([]);
      expect(result.file!.write).toEqual([]);
    });

    // --- Граничное условие: shell-паттерн *:* (wildcard) ---
    it("принимает валидный shell-паттерн *:*", () => {
      const content = {
        shell: { deny: ["*:*"] },
      };

      const result = validatePermissionsContent(content);

      expect(result.shell!.deny).toEqual(["*:*"]);
    });

    // --- Граничное условие: MCP-паттерн *:* (wildcard) ---
    it("принимает валидный MCP-паттерн *:*", () => {
      const content = {
        mcp: { deny: ["*:*"] },
      };

      const result = validatePermissionsContent(content);

      expect(result.mcp!.deny).toEqual(["*:*"]);
    });

    // --- Граничное условие: массив содержит нестроковый элемент ---
    it("выбрасывает TransformError, если shell.allow содержит числовой элемент", () => {
      expect(() =>
        validatePermissionsContent({
          shell: { allow: [42] },
        } as any),
      ).toThrow(TransformError);
      expect(() =>
        validatePermissionsContent({
          shell: { allow: [42] },
        } as any),
      ).toThrow("'shell.allow' must be an array of strings");
    });
  });

  // ===========================================================================
  // Транспиляция
  // Спецификация: docs/specs/permissions-transpiler.md § Транспиляция
  // ===========================================================================

  describe("Транспиляция", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-perm-transpile-"));
      fs.mkdirSync(path.join(tmpDir, ".agloom"), { recursive: true });
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Happy path: шаги 1-4 -- полный цикл транспиляции ---
    it("выполняет полный цикл транспиляции: discover -> validate -> adapter.transpile -> собрать результаты", () => {
      const yamlContent = [
        "shell:",
        "  allow:",
        '    - "ls:*"',
        "  deny:",
        '    - "*:*"',
      ].join("\n");
      fs.writeFileSync(
        path.join(tmpDir, ".agloom", "permissions.yml"),
        yamlContent,
      );

      const receivedFiles: unknown[] = [];
      const stubAdapter = {
        agentId: "test",
        transpile: (file: any) => {
          receivedFiles.push(file);
          return [
            {
              relativePath: "test-permissions.json",
              content: JSON.stringify({ permissions: {} }),
            },
          ];
        },
      };

      const transpiler = createPermissionsTranspiler({
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
      const transpiler = createPermissionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const results = transpiler.transpile();

      expect(results).toEqual([]);
    });

    // --- Расширение 1b: discover() выбрасывает DiscoverError ---
    it("пробрасывает DiscoverError к вызывающему коду", () => {
      fs.writeFileSync(
        path.join(tmpDir, ".agloom", "permissions.yml"),
        "shell: {}",
      );
      fs.writeFileSync(
        path.join(tmpDir, ".agloom", "permissions.json"),
        '{"shell": {}}',
      );

      const transpiler = createPermissionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      expect(() => transpiler.transpile()).toThrow(DiscoverError);
    });

    // --- Расширение 2a: валидация выбрасывает TransformError ---
    it("пробрасывает TransformError при невалидном каноническом файле", () => {
      fs.writeFileSync(
        path.join(tmpDir, ".agloom", "permissions.yml"),
        "unknownKey: true",
      );

      const transpiler = createPermissionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      expect(() => transpiler.transpile()).toThrow(TransformError);
    });

    // --- Расширение 3a: адаптер выбрасывает исключение ---
    it("создаёт TranspileResult с ошибкой при исключении адаптера и продолжает остальные", () => {
      fs.writeFileSync(
        path.join(tmpDir, ".agloom", "permissions.yml"),
        "shell:\n  allow:\n    - 'ls:*'\n",
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

      const transpiler = createPermissionsTranspiler({
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
  });

  // ===========================================================================
  // Запись результатов
  // Спецификация: docs/specs/permissions-transpiler.md § Запись результатов
  // ===========================================================================

  describe("Запись результатов", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-perm-write-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Happy path: шаги 1-6 -- запись файлов и возврат путей ---
    it("записывает файлы в файловую систему и возвращает пути записанных файлов", () => {
      const transpiler = createPermissionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "claude",
          files: [
            {
              relativePath: ".claude/settings.json",
              content: '{\n  "permissions": {}\n}\n',
            },
          ],
          errors: [],
        },
      ]);

      expect(writeResult.written).toContain(".claude/settings.json");
      expect(writeResult.errors).toHaveLength(0);

      const writtenContent = fs.readFileSync(
        path.join(tmpDir, ".claude", "settings.json"),
        "utf-8",
      );
      expect(writtenContent).toBe('{\n  "permissions": {}\n}\n');
    });

    // --- Трансформация: шаг 5 -- создание промежуточных каталогов ---
    it("создаёт промежуточные каталоги при записи файла", () => {
      const transpiler = createPermissionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "claude",
          files: [
            {
              relativePath: ".claude/settings.json",
              content: "{}",
            },
          ],
          errors: [],
        },
      ]);

      expect(writeResult.written).toContain(".claude/settings.json");
      expect(fs.existsSync(path.join(tmpDir, ".claude", "settings.json"))).toBe(
        true,
      );
    });

    // --- Расширение 1a: TranspileResult содержит ошибки ---
    it("пропускает запись файлов адаптера при наличии ошибок в TranspileResult", () => {
      const transpiler = createPermissionsTranspiler({
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

    // --- Трансформация: шаг 3 -- deep merge при одинаковом relativePath ---
    it("выполняет deep merge при одинаковом relativePath для JSON-файлов из разных адаптеров", () => {
      const transpiler = createPermissionsTranspiler({
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
                JSON.stringify({ permission: { "*_*": "deny" } }, null, 2) +
                "\n",
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
                JSON.stringify(
                  { mcp: { server1: { command: "npx" } } },
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
      expect(writtenContent.permission).toBeDefined();
      expect(writtenContent.mcp).toBeDefined();
    });

    // --- Трансформация: шаг 4 -- deep merge с существующим файлом ---
    it("выполняет deep merge с существующим файлом на диске", () => {
      const existingContent = {
        mcp: { server1: { command: "npx" } },
      };
      fs.writeFileSync(
        path.join(tmpDir, "opencode.json"),
        JSON.stringify(existingContent, null, 2),
      );

      const transpiler = createPermissionsTranspiler({
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
                JSON.stringify({ permission: { "*_*": "deny" } }, null, 2) +
                "\n",
            },
          ],
          errors: [],
        },
      ]);

      expect(writeResult.written).toContain("opencode.json");

      const writtenContent = JSON.parse(
        fs.readFileSync(path.join(tmpDir, "opencode.json"), "utf-8"),
      );
      expect(writtenContent.mcp.server1.command).toBe("npx");
      expect(writtenContent.permission["*_*"]).toBe("deny");
    });

    // --- Расширение 4a: существующий файл содержит невалидный JSON ---
    it("перезаписывает файл целиком, если существующий файл содержит невалидный JSON", () => {
      fs.writeFileSync(
        path.join(tmpDir, "opencode.json"),
        "{invalid json content",
      );

      const transpiler = createPermissionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("opencode")],
      });

      const newContent = { permission: { "*_*": "deny" } };
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
      expect(writtenContent.permission["*_*"]).toBe("deny");
    });

    // --- Расширение 5a: ошибка записи файла ---
    it("возвращает WriteError при ошибке записи файла", () => {
      fs.writeFileSync(path.join(tmpDir, "blocker"), "not a directory");

      const transpiler = createPermissionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "claude",
          files: [
            {
              relativePath: "blocker/settings.json",
              content: "{}",
            },
          ],
          errors: [],
        },
      ]);

      expect(writeResult.errors.length).toBeGreaterThan(0);
      expect(writeResult.errors[0]).toBeInstanceOf(WriteError);
      expect(writeResult.errors[0].message).toMatch(
        /Failed to write blocker\/settings\.json/,
      );
    });
  });
});
