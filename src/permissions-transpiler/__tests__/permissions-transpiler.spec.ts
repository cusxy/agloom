// permissions-transpiler.spec.ts
// Спецификация: docs/specs/permissions-transpiler.md

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createPermissionsTranspiler } from "../index.js";
import { ConfigError, DiscoverError, TransformError, WriteError } from "../errors.js";
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
      ).toThrow("Adapter at index 0 does not implement PermissionsAdapter interface");
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

    // --- Happy path: шаги 1-6 -- обнаружение .agloom/permissions.yml (новый формат: ordered list) ---
    it("обнаруживает .agloom/permissions.yml и возвращает PermissionsCanonicalFile с format yaml", () => {
      const yamlContent = ["shell:", '  - "ls *": allow', '  - "*": deny'].join("\n");
      fs.writeFileSync(path.join(tmpDir, ".agloom", "permissions.yml"), yamlContent);

      const transpiler = createPermissionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const result = transpiler.discover();

      expect(result).not.toBeNull();
      expect(result!.relativePath).toBe(".agloom/permissions.yml");
      expect(result!.format).toBe("yaml");
      expect(result!.content.shell).toBeDefined();
      expect(Array.isArray(result!.content.shell)).toBe(true);
      expect(result!.content.shell).toHaveLength(2);
    });

    // --- Happy path: шаги 1-6 -- обнаружение .agloom/permissions.json (новый формат: ordered list) ---
    it("обнаруживает .agloom/permissions.json и возвращает PermissionsCanonicalFile с format json", () => {
      const jsonContent = JSON.stringify({
        shell: [{ "ls *": "allow" }, { "*": "deny" }],
      });
      fs.writeFileSync(path.join(tmpDir, ".agloom", "permissions.json"), jsonContent);

      const transpiler = createPermissionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const result = transpiler.discover();

      expect(result).not.toBeNull();
      expect(result!.relativePath).toBe(".agloom/permissions.json");
      expect(result!.format).toBe("json");
      expect(Array.isArray(result!.content.shell)).toBe(true);
      expect(result!.content.shell).toEqual([{ "ls *": "allow" }, { "*": "deny" }]);
    });

    // --- Расширение 3a: оба файла существуют ---
    it("выбрасывает DiscoverError, если оба .agloom/permissions.yml и .agloom/permissions.json существуют", () => {
      fs.writeFileSync(path.join(tmpDir, ".agloom", "permissions.yml"), "shell: []");
      fs.writeFileSync(path.join(tmpDir, ".agloom", "permissions.json"), '{"shell": []}');

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
      fs.writeFileSync(ymlPath, "shell: []");
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
      fs.writeFileSync(path.join(tmpDir, ".agloom", "permissions.yml"), "shell:\n  - invalid: [yaml: {\n");

      const transpiler = createPermissionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      expect(() => transpiler.discover()).toThrow(DiscoverError);
      expect(() => transpiler.discover()).toThrow(/Failed to parse \.agloom\/permissions\.yml/);
    });

    // --- Расширение 5b: ошибка парсинга JSON ---
    it("выбрасывает DiscoverError при невалидном JSON", () => {
      fs.writeFileSync(path.join(tmpDir, ".agloom", "permissions.json"), "{invalid json");

      const transpiler = createPermissionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      expect(() => transpiler.discover()).toThrow(DiscoverError);
      expect(() => transpiler.discover()).toThrow(/Failed to parse \.agloom\/permissions\.json/);
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

    // --- Трансформация: шаг 5 -- парсинг YAML со всеми секциями (новый формат) ---
    it("корректно парсит YAML со всеми тремя секциями в формате ordered list", () => {
      const yamlContent = [
        "shell:",
        '  - "git push *": deny',
        '  - "./gradlew *": allow',
        '  - "ls *": allow',
        '  - "git status *": allow',
        '  - "npm *": ask',
        '  - "*": deny',
        "mcp:",
        '  - "untrusted-server:*": deny',
        '  - "bitbucket:get_pull_request": allow',
        '  - "jenkins:get_build": allow',
        '  - "bitbucket:*": ask',
        '  - "jenkins:*": ask',
        '  - "*:*": deny',
        "file:",
        '  - "**/.env": deny',
        '  - "src/**/*.ts": write',
        '  - "src/**": read',
      ].join("\n");
      fs.writeFileSync(path.join(tmpDir, ".agloom", "permissions.yml"), yamlContent);

      const transpiler = createPermissionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const result = transpiler.discover();

      expect(result).not.toBeNull();
      // shell -- массив пар pattern:action
      expect(Array.isArray(result!.content.shell)).toBe(true);
      expect(result!.content.shell).toHaveLength(6);
      expect(result!.content.shell![0]).toEqual({ "git push *": "deny" });
      expect(result!.content.shell![1]).toEqual({ "./gradlew *": "allow" });
      expect(result!.content.shell![5]).toEqual({ "*": "deny" });
      // mcp -- массив пар pattern:action
      expect(Array.isArray(result!.content.mcp)).toBe(true);
      expect(result!.content.mcp).toHaveLength(6);
      expect(result!.content.mcp![0]).toEqual({
        "untrusted-server:*": "deny",
      });
      // file -- массив пар pattern:action
      expect(Array.isArray(result!.content.file)).toBe(true);
      expect(result!.content.file).toHaveLength(3);
      expect(result!.content.file![0]).toEqual({ "**/.env": "deny" });
      expect(result!.content.file![1]).toEqual({ "src/**/*.ts": "write" });
      expect(result!.content.file![2]).toEqual({ "src/**": "read" });
    });
  });

  // ===========================================================================
  // Валидация канонического файла
  // Спецификация: docs/specs/permissions-transpiler.md § Валидация канонического файла
  // ===========================================================================

  describe("Валидация канонического файла", () => {
    // --- Happy path: шаги 1-5 -- валидный контент со всеми секциями (новый формат) ---
    it("принимает валидный контент со всеми тремя секциями в формате ordered list", () => {
      const content = {
        shell: [{ "git push *": "deny" }, { "ls *": "allow" }, { "npm *": "ask" }, { "*": "deny" }],
        mcp: [{ "bitbucket:get_pull_request": "allow" }, { "*:*": "deny" }],
        file: [{ "**/.env": "deny" }, { "src/**": "read" }, { "src/**/*.ts": "write" }],
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
        shell: [{ "ls *": "allow" }],
      };

      const result = validatePermissionsContent(content);

      expect(result.shell).toBeDefined();
      expect(result.shell).toHaveLength(1);
    });

    // --- Happy path: пустой массив в секции ---
    it("принимает секцию с пустым массивом правил", () => {
      const content = {
        shell: [],
        mcp: [],
        file: [],
      };

      const result = validatePermissionsContent(content);

      expect(result.shell).toEqual([]);
      expect(result.mcp).toEqual([]);
      expect(result.file).toEqual([]);
    });

    // --- Расширение 1a: content не является объектом ---
    it("выбрасывает TransformError, если content не является объектом", () => {
      expect(() => validatePermissionsContent("not an object" as any)).toThrow(TransformError);
      expect(() => validatePermissionsContent("not an object" as any)).toThrow("Permissions config must be an object");
    });

    it("выбрасывает TransformError, если content равен null", () => {
      expect(() => validatePermissionsContent(null as any)).toThrow(TransformError);
      expect(() => validatePermissionsContent(null as any)).toThrow("Permissions config must be an object");
    });

    // --- Расширение 2a: неизвестный ключ ---
    it("выбрасывает TransformError при неизвестном ключе в корне", () => {
      expect(() => validatePermissionsContent({ shell: [], unknown: [] } as any)).toThrow(TransformError);
      expect(() => validatePermissionsContent({ shell: [], unknown: [] } as any)).toThrow(
        "Unknown key 'unknown' in permissions config. Allowed keys: shell, mcp, file",
      );
    });

    // --- Расширение 3a: shell не является массивом ---
    it("выбрасывает TransformError, если shell не является массивом", () => {
      expect(() => validatePermissionsContent({ shell: "not-array" } as any)).toThrow(TransformError);
      expect(() => validatePermissionsContent({ shell: "not-array" } as any)).toThrow(
        "'shell' must be an array of permission rules",
      );
    });

    // --- Обратная совместимость: старый формат (allow/ask/deny блоки) -- ошибка валидации ---
    it("выбрасывает TransformError при старом формате shell с allow/ask/deny блоками", () => {
      expect(() =>
        validatePermissionsContent({
          shell: { allow: ["ls:*"], deny: ["*:*"] },
        } as any),
      ).toThrow(TransformError);
      expect(() =>
        validatePermissionsContent({
          shell: { allow: ["ls:*"], deny: ["*:*"] },
        } as any),
      ).toThrow("'shell' must be an array of permission rules");
    });

    // --- Расширение 3b: элемент shell не является объектом с ровно одним ключом ---
    it("выбрасывает TransformError, если элемент shell не является объектом с ровно одним ключом", () => {
      expect(() =>
        validatePermissionsContent({
          shell: ["not-an-object"],
        } as any),
      ).toThrow(TransformError);
      expect(() =>
        validatePermissionsContent({
          shell: ["not-an-object"],
        } as any),
      ).toThrow("Each rule in 'shell' must be an object with exactly one key (pattern) and one value (action)");
    });

    it("выбрасывает TransformError, если элемент shell содержит два ключа", () => {
      expect(() =>
        validatePermissionsContent({
          shell: [{ "ls *": "allow", "git *": "deny" }],
        } as any),
      ).toThrow(TransformError);
      expect(() =>
        validatePermissionsContent({
          shell: [{ "ls *": "allow", "git *": "deny" }],
        } as any),
      ).toThrow("Each rule in 'shell' must be an object with exactly one key (pattern) and one value (action)");
    });

    it("выбрасывает TransformError, если элемент shell является пустым объектом", () => {
      expect(() =>
        validatePermissionsContent({
          shell: [{}],
        } as any),
      ).toThrow(TransformError);
      expect(() =>
        validatePermissionsContent({
          shell: [{}],
        } as any),
      ).toThrow("Each rule in 'shell' must be an object with exactly one key (pattern) and one value (action)");
    });

    // --- Расширение 3c: невалидное действие shell ---
    it("выбрасывает TransformError при невалидном действии в shell-правиле", () => {
      expect(() =>
        validatePermissionsContent({
          shell: [{ "ls *": "invalid" }],
        }),
      ).toThrow(TransformError);
      expect(() =>
        validatePermissionsContent({
          shell: [{ "ls *": "invalid" }],
        }),
      ).toThrow("Invalid action 'invalid' in 'shell' rule 'ls *'. Allowed actions: allow, ask, deny");
    });

    // --- Расширение 4a: mcp не является массивом ---
    it("выбрасывает TransformError, если mcp не является массивом", () => {
      expect(() => validatePermissionsContent({ mcp: "not-array" } as any)).toThrow(TransformError);
      expect(() => validatePermissionsContent({ mcp: "not-array" } as any)).toThrow(
        "'mcp' must be an array of permission rules",
      );
    });

    // --- Расширение 4b: элемент mcp не является объектом с ровно одним ключом ---
    it("выбрасывает TransformError, если элемент mcp не является объектом с ровно одним ключом", () => {
      expect(() =>
        validatePermissionsContent({
          mcp: [42],
        } as any),
      ).toThrow(TransformError);
      expect(() =>
        validatePermissionsContent({
          mcp: [42],
        } as any),
      ).toThrow("Each rule in 'mcp' must be an object with exactly one key (pattern) and one value (action)");
    });

    // --- Расширение 4c: невалидное действие mcp ---
    it("выбрасывает TransformError при невалидном действии в mcp-правиле", () => {
      expect(() =>
        validatePermissionsContent({
          mcp: [{ "bitbucket:*": "invalid" }],
        }),
      ).toThrow(TransformError);
      expect(() =>
        validatePermissionsContent({
          mcp: [{ "bitbucket:*": "invalid" }],
        }),
      ).toThrow("Invalid action 'invalid' in 'mcp' rule 'bitbucket:*'. Allowed actions: allow, ask, deny");
    });

    // --- Расширение 4d: невалидный MCP-паттерн (нет разделителя :) ---
    it("выбрасывает TransformError при MCP-паттерне без разделителя ':'", () => {
      expect(() =>
        validatePermissionsContent({
          mcp: [{ bitbucket_get_pull_request: "allow" }],
        }),
      ).toThrow(TransformError);
      expect(() =>
        validatePermissionsContent({
          mcp: [{ bitbucket_get_pull_request: "allow" }],
        }),
      ).toThrow("Invalid MCP pattern 'bitbucket_get_pull_request': must match format '<server>:<tool>'");
    });

    // --- Расширение 4d: MCP-паттерн с двумя разделителями : ---
    it("выбрасывает TransformError при MCP-паттерне с двумя разделителями ':'", () => {
      expect(() =>
        validatePermissionsContent({
          mcp: [{ "a:b:c": "allow" }],
        }),
      ).toThrow(TransformError);
      expect(() =>
        validatePermissionsContent({
          mcp: [{ "a:b:c": "allow" }],
        }),
      ).toThrow("Invalid MCP pattern 'a:b:c': must match format '<server>:<tool>'");
    });

    // --- Расширение 5a: file не является массивом ---
    it("выбрасывает TransformError, если file не является массивом", () => {
      expect(() => validatePermissionsContent({ file: "string" } as any)).toThrow(TransformError);
      expect(() => validatePermissionsContent({ file: "string" } as any)).toThrow(
        "'file' must be an array of permission rules",
      );
    });

    // --- Расширение 5b: элемент file не является объектом с ровно одним ключом ---
    it("выбрасывает TransformError, если элемент file не является объектом с ровно одним ключом", () => {
      expect(() =>
        validatePermissionsContent({
          file: [null],
        } as any),
      ).toThrow(TransformError);
      expect(() =>
        validatePermissionsContent({
          file: [null],
        } as any),
      ).toThrow("Each rule in 'file' must be an object with exactly one key (pattern) and one value (action)");
    });

    // --- Расширение 5c: невалидное действие file ---
    it("выбрасывает TransformError при невалидном действии в file-правиле", () => {
      expect(() =>
        validatePermissionsContent({
          file: [{ "src/**": "allow" }],
        }),
      ).toThrow(TransformError);
      expect(() =>
        validatePermissionsContent({
          file: [{ "src/**": "allow" }],
        }),
      ).toThrow("Invalid action 'allow' in 'file' rule 'src/**'. Allowed actions: deny, read, write");
    });

    // --- Граничное условие: MCP-паттерн *:* (wildcard) ---
    it("принимает валидный MCP-паттерн *:*", () => {
      const content = {
        mcp: [{ "*:*": "deny" }],
      };

      const result = validatePermissionsContent(content);

      expect(result.mcp).toEqual([{ "*:*": "deny" }]);
    });

    // --- Граничное условие: массив содержит нестроковое действие ---
    it("выбрасывает TransformError, если действие shell-правила не является строкой", () => {
      expect(() =>
        validatePermissionsContent({
          shell: [{ "ls *": 42 }],
        } as any),
      ).toThrow(TransformError);
    });

    // --- Граничное условие: content является массивом ---
    it("выбрасывает TransformError, если content является массивом", () => {
      expect(() => validatePermissionsContent([] as any)).toThrow(TransformError);
      expect(() => validatePermissionsContent([] as any)).toThrow("Permissions config must be an object");
    });

    // --- Обратная совместимость: старый формат mcp с allow/ask/deny блоками ---
    it("выбрасывает TransformError при старом формате mcp с allow/ask/deny блоками", () => {
      expect(() =>
        validatePermissionsContent({
          mcp: { allow: ["bitbucket:*"], deny: ["*:*"] },
        } as any),
      ).toThrow(TransformError);
      expect(() =>
        validatePermissionsContent({
          mcp: { allow: ["bitbucket:*"], deny: ["*:*"] },
        } as any),
      ).toThrow("'mcp' must be an array of permission rules");
    });

    // --- Обратная совместимость: старый формат file с deny/read/write блоками ---
    it("выбрасывает TransformError при старом формате file с deny/read/write блоками", () => {
      expect(() =>
        validatePermissionsContent({
          file: { deny: ["**/.env"], read: ["src/**"], write: ["src/**/*.ts"] },
        } as any),
      ).toThrow(TransformError);
      expect(() =>
        validatePermissionsContent({
          file: { deny: ["**/.env"], read: ["src/**"], write: ["src/**/*.ts"] },
        } as any),
      ).toThrow("'file' must be an array of permission rules");
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

    // --- Happy path: шаги 1-4 -- полный цикл транспиляции (новый формат) ---
    it("выполняет полный цикл транспиляции: discover -> validate -> adapter.transpile -> собрать результаты", () => {
      const yamlContent = ["shell:", '  - "ls *": allow', '  - "*": deny'].join("\n");
      fs.writeFileSync(path.join(tmpDir, ".agloom", "permissions.yml"), yamlContent);

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
      fs.writeFileSync(path.join(tmpDir, ".agloom", "permissions.yml"), "shell: []");
      fs.writeFileSync(path.join(tmpDir, ".agloom", "permissions.json"), '{"shell": []}');

      const transpiler = createPermissionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      expect(() => transpiler.transpile()).toThrow(DiscoverError);
    });

    // --- Расширение 2a: валидация выбрасывает TransformError ---
    it("пробрасывает TransformError при невалидном каноническом файле", () => {
      fs.writeFileSync(path.join(tmpDir, ".agloom", "permissions.yml"), "unknownKey: true");

      const transpiler = createPermissionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      expect(() => transpiler.transpile()).toThrow(TransformError);
    });

    // --- Расширение 3a: адаптер выбрасывает исключение ---
    it("создаёт TranspileResult с ошибкой при исключении адаптера и продолжает остальные", () => {
      const yamlContent = ["shell:", '  - "ls *": allow'].join("\n");
      fs.writeFileSync(path.join(tmpDir, ".agloom", "permissions.yml"), yamlContent);

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
      expect(failingResult!.errors[0].message).toContain("Adapter internal failure");
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

      const writtenContent = fs.readFileSync(path.join(tmpDir, ".claude", "settings.json"), "utf-8");
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
      expect(fs.existsSync(path.join(tmpDir, ".claude", "settings.json"))).toBe(true);
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

      expect(fs.existsSync(path.join(tmpDir, "should-not-exist.json"))).toBe(false);
      expect(writeResult.errors.length).toBeGreaterThan(0);
      expect(writeResult.written).not.toContain("should-not-exist.json");
    });

    // --- Трансформация: шаг 3 -- deep merge при одинаковом relativePath ---
    it("выполняет deep merge при одинаковом relativePath для JSON-файлов из разных адаптеров", () => {
      const transpiler = createPermissionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("adapter1"), createStubAdapter("adapter2")],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "adapter1",
          files: [
            {
              relativePath: "opencode.json",
              content: JSON.stringify({ permission: { "*_*": "deny" } }, null, 2) + "\n",
            },
          ],
          errors: [],
        },
        {
          agentId: "adapter2",
          files: [
            {
              relativePath: "opencode.json",
              content: JSON.stringify({ mcp: { server1: { command: "npx" } } }, null, 2) + "\n",
            },
          ],
          errors: [],
        },
      ]);

      expect(writeResult.written).toContain("opencode.json");

      const writtenContent = JSON.parse(fs.readFileSync(path.join(tmpDir, "opencode.json"), "utf-8"));
      expect(writtenContent.permission).toBeDefined();
      expect(writtenContent.mcp).toBeDefined();
    });

    // --- Трансформация: шаг 4 -- deep merge с существующим файлом ---
    it("выполняет deep merge с существующим файлом на диске", () => {
      const existingContent = {
        mcp: { server1: { command: "npx" } },
      };
      fs.writeFileSync(path.join(tmpDir, "opencode.json"), JSON.stringify(existingContent, null, 2));

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
              content: JSON.stringify({ permission: { "*_*": "deny" } }, null, 2) + "\n",
            },
          ],
          errors: [],
        },
      ]);

      expect(writeResult.written).toContain("opencode.json");

      const writtenContent = JSON.parse(fs.readFileSync(path.join(tmpDir, "opencode.json"), "utf-8"));
      expect(writtenContent.mcp.server1.command).toBe("npx");
      expect(writtenContent.permission["*_*"]).toBe("deny");
    });

    // --- Расширение 4a: существующий файл содержит невалидный JSON ---
    it("перезаписывает файл целиком, если существующий файл содержит невалидный JSON", () => {
      fs.writeFileSync(path.join(tmpDir, "opencode.json"), "{invalid json content");

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

      const writtenContent = JSON.parse(fs.readFileSync(path.join(tmpDir, "opencode.json"), "utf-8"));
      expect(writtenContent.permission["*_*"]).toBe("deny");
    });

    // --- Трансформация: deep merge для .jsonc файлов из разных адаптеров ---
    // Спецификация: docs/specs/permissions-transpiler.md § "Deep merge с существующим kilo.jsonc"
    // BUG: .endsWith(".json") не покрывает .jsonc — файлы перезаписываются вместо merge
    it("выполняет deep merge при одинаковом relativePath для JSONC-файлов из разных адаптеров", () => {
      const transpiler = createPermissionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("adapter1"), createStubAdapter("adapter2")],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "adapter1",
          files: [
            {
              relativePath: "kilo.jsonc",
              content: JSON.stringify({ mcpServers: { context7: { command: "npx" } } }, null, 2) + "\n",
            },
          ],
          errors: [],
        },
        {
          agentId: "adapter2",
          files: [
            {
              relativePath: "kilo.jsonc",
              content: JSON.stringify({ permission: { bash: { "*": "ask" } } }, null, 2) + "\n",
            },
          ],
          errors: [],
        },
      ]);

      expect(writeResult.written).toContain("kilo.jsonc");

      const writtenContent = JSON.parse(fs.readFileSync(path.join(tmpDir, "kilo.jsonc"), "utf-8"));
      // deep merge: оба ключа должны присутствовать
      expect(writtenContent.mcpServers).toBeDefined();
      expect(writtenContent.mcpServers.context7.command).toBe("npx");
      expect(writtenContent.permission).toBeDefined();
      expect(writtenContent.permission.bash["*"]).toBe("ask");
    });

    // --- Трансформация: deep merge .jsonc с существующим файлом на диске ---
    // Спецификация: docs/specs/permissions-transpiler.md § "Deep merge с существующим kilo.jsonc"
    // BUG: .endsWith(".json") не покрывает .jsonc — существующий файл перезаписывается
    it("выполняет deep merge .jsonc с существующим файлом на диске", () => {
      // Предварительно записываем файл (например, от MCP transpiler)
      const existingContent = {
        $schema: "https://example.com/schema.json",
        mcpServers: { context7: { command: "npx", args: ["-y", "@upstash/context7-mcp@latest"] } },
      };
      fs.writeFileSync(path.join(tmpDir, "kilo.jsonc"), JSON.stringify(existingContent, null, 2));

      const transpiler = createPermissionsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("kilocode")],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "kilocode",
          files: [
            {
              relativePath: "kilo.jsonc",
              content:
                JSON.stringify(
                  {
                    permission: { bash: { "*": "ask" } },
                  },
                  null,
                  2,
                ) + "\n",
            },
          ],
          errors: [],
        },
      ]);

      expect(writeResult.written).toContain("kilo.jsonc");

      const writtenContent = JSON.parse(fs.readFileSync(path.join(tmpDir, "kilo.jsonc"), "utf-8"));
      // Существующий контент от MCP transpiler должен быть сохранён (deep merge)
      expect(writtenContent.mcpServers).toBeDefined();
      expect(writtenContent.mcpServers.context7.command).toBe("npx");
      expect(writtenContent["$schema"]).toBe("https://example.com/schema.json");
      // Новый контент permissions должен быть добавлен
      expect(writtenContent.permission).toBeDefined();
      expect(writtenContent.permission.bash["*"]).toBe("ask");
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
      expect(writeResult.errors[0].message).toMatch(/Failed to write blocker\/settings\.json/);
    });
  });
});
