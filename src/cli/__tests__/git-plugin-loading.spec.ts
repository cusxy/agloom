// git-plugin-loading.spec.ts
// Спецификация: docs/specs/git-plugin-loading.md § Процедура Parse Plugin Entry
// Спецификация: docs/specs/git-plugin-loading.md § Расширение процедуры Load Config
// Спецификация: docs/specs/git-plugin-loading.md § Алгоритм хеширования URL
// Спецификация: docs/specs/git-plugin-loading.md § Процедура Resolve Git Ref
// Спецификация: docs/specs/git-plugin-loading.md § Процедура Clone Git Repository
// Спецификация: docs/specs/git-plugin-loading.md § Расширение процедуры Resolve Plugins
// Спецификация: docs/specs/git-plugin-loading.md § Команда agloom cache clean

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";
import { loadConfig } from "../config.js";

// =====================================================================
// Вспомогательные функции
// =====================================================================

/** Записывает plugin.yml из YAML-строки. */
function writePluginYaml(pluginDir: string, yamlContent: string): void {
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.writeFileSync(path.join(pluginDir, "plugin.yml"), yamlContent);
}

/** Минимальный валидный plugin.yml. */
function validManifest(name: string): string {
  return `name: ${name}\nversion: 1.0.0\ndescription: Plugin ${name}\nauthor:\n  name: Test\n  email: test@test.com\n`;
}

/**
 * Эталонная реализация хеширования URL для проверки в тестах.
 * Spec: docs/specs/git-plugin-loading.md § Алгоритм хеширования URL
 */
function referenceUrlHash(url: string): string {
  let normalized = url;
  // 1. Удалить trailing /
  if (normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  // 2. Удалить суффикс .git
  if (normalized.endsWith(".git")) {
    normalized = normalized.slice(0, -4);
  }
  // 3. Привести к нижнему регистру
  normalized = normalized.toLowerCase();
  // 4. SHA-256
  const hash = crypto
    .createHash("sha256")
    .update(normalized, "utf-8")
    .digest("hex");
  // 5. Первые 16 hex-символов
  return hash.slice(0, 16);
}

describe("CLI", () => {
  // =====================================================================
  // § git-plugin-loading.md § Процедура Parse Plugin Entry
  // Разбор элемента массива plugins из raw entry в ParsedPluginEntry.
  // =====================================================================
  describe("Процедура Parse Plugin Entry", () => {
    // --- Happy path: строка без # → local ---
    // § Поведение шаг 2-3: строка НЕ содержит # → { type: "local", path: entry }
    it("при строке без # возвращает type: local с path равным строке", async () => {
      const { parsePluginEntry } = (await import("../resolve-plugins.js")) as {
        parsePluginEntry: (entry: string | Record<string, unknown>) => {
          type: string;
          path: string | null;
          url: string | null;
          ref: string | null;
        };
      };

      const result = parsePluginEntry("../local-plugin");

      expect(result).toEqual({
        type: "local",
        path: "../local-plugin",
        url: null,
        ref: null,
        values: null,
      });
    });

    // --- Happy path: строка с # → git (url + ref) ---
    // § Поведение шаг 4: строка содержит # → разбить по последнему #
    // § Поведение шаг 4.3: URL-часть НЕ содержит // → subpath = null
    it("при строке с # возвращает type: git с url и ref", async () => {
      const { parsePluginEntry } = (await import("../resolve-plugins.js")) as {
        parsePluginEntry: (entry: string | Record<string, unknown>) => {
          type: string;
          path: string | null;
          url: string | null;
          ref: string | null;
        };
      };

      const result = parsePluginEntry("https://github.com/org/repo#v1.0.0");

      expect(result).toEqual({
        type: "git",
        url: "https://github.com/org/repo",
        ref: "v1.0.0",
        path: null,
        values: null,
      });
    });

    // --- Happy path: строка с // и # → git (url + subpath + ref) ---
    // § Поведение шаг 4.1-4.2: URL-часть содержит // → разбить на url и subpath
    it("при строке с // и # возвращает type: git с url, subpath и ref", async () => {
      const { parsePluginEntry } = (await import("../resolve-plugins.js")) as {
        parsePluginEntry: (entry: string | Record<string, unknown>) => {
          type: string;
          path: string | null;
          url: string | null;
          ref: string | null;
        };
      };

      const result = parsePluginEntry(
        "https://github.com/org/repo//plugins/eslint#v1.0.0",
      );

      expect(result).toEqual({
        type: "git",
        url: "https://github.com/org/repo",
        ref: "v1.0.0",
        path: "plugins/eslint",
        values: null,
      });
    });

    // --- Happy path: SSH URL ---
    // § Унифицированный формат записи плагина: SSH: git@github.com:org/repo#main
    it("при SSH URL с # возвращает type: git с SSH url и ref", async () => {
      const { parsePluginEntry } = (await import("../resolve-plugins.js")) as {
        parsePluginEntry: (entry: string | Record<string, unknown>) => {
          type: string;
          path: string | null;
          url: string | null;
          ref: string | null;
        };
      };

      const result = parsePluginEntry("git@github.com:org/repo#main");

      expect(result).toEqual({
        type: "git",
        url: "git@github.com:org/repo",
        ref: "main",
        path: null,
        values: null,
      });
    });

    // --- Happy path: объект { path: "..." } → local ---
    // § Поведение шаг 5: объект с полем path → { type: "local", path: entry.path }
    it("при объекте с полем path возвращает type: local", async () => {
      const { parsePluginEntry } = (await import("../resolve-plugins.js")) as {
        parsePluginEntry: (entry: string | Record<string, unknown>) => {
          type: string;
          path: string | null;
          url: string | null;
          ref: string | null;
        };
      };

      const result = parsePluginEntry({ path: "../local-plugin" });

      expect(result).toEqual({
        type: "local",
        path: "../local-plugin",
        url: null,
        ref: null,
        values: null,
      });
    });

    // --- Happy path: объект { git: "...", ref: "..." } → git ---
    // § Поведение шаг 6: объект с полем git → { type: "git", url: entry.git, ref: entry.ref }
    it("при объекте с полями git и ref возвращает type: git", async () => {
      const { parsePluginEntry } = (await import("../resolve-plugins.js")) as {
        parsePluginEntry: (entry: string | Record<string, unknown>) => {
          type: string;
          path: string | null;
          url: string | null;
          ref: string | null;
        };
      };

      const result = parsePluginEntry({
        git: "https://github.com/org/repo",
        ref: "v1.0.0",
      });

      expect(result).toEqual({
        type: "git",
        url: "https://github.com/org/repo",
        ref: "v1.0.0",
        path: null,
        values: null,
      });
    });

    // --- Happy path: объект { git: "...", ref: "...", path: "..." } → git с subpath ---
    // § Поведение шаг 6: entry.path ?? null
    it("при объекте с полями git, ref и path возвращает type: git с subpath", async () => {
      const { parsePluginEntry } = (await import("../resolve-plugins.js")) as {
        parsePluginEntry: (entry: string | Record<string, unknown>) => {
          type: string;
          path: string | null;
          url: string | null;
          ref: string | null;
        };
      };

      const result = parsePluginEntry({
        git: "https://github.com/org/repo",
        ref: "v1.0.0",
        path: "plugins/eslint",
      });

      expect(result).toEqual({
        type: "git",
        url: "https://github.com/org/repo",
        ref: "v1.0.0",
        path: "plugins/eslint",
        values: null,
      });
    });

    // --- Расширение 1a: невалидный вход (объект без path и git) ---
    // § Расширения 1a: Error("Invalid config: each 'plugins' entry must be...")
    it("при объекте без полей path и git выбрасывает ошибку", async () => {
      const { parsePluginEntry } = (await import("../resolve-plugins.js")) as {
        parsePluginEntry: (entry: string | Record<string, unknown>) => unknown;
      };

      expect(() => parsePluginEntry({ name: "something" })).toThrow(
        "Invalid config: each 'plugins' entry must be a string, an object with 'path' field, or an object with 'git' field.",
      );
    });

    // --- Расширение 1a: невалидный вход (не строка и не объект) ---
    // § Расширения 1a: entry не является ни строкой, ни объектом
    it("при числовом входе выбрасывает ошибку", async () => {
      const { parsePluginEntry } = (await import("../resolve-plugins.js")) as {
        parsePluginEntry: (entry: unknown) => unknown;
      };

      expect(() => parsePluginEntry(42)).toThrow(
        "Invalid config: each 'plugins' entry must be a string, an object with 'path' field, or an object with 'git' field.",
      );
    });

    // --- Расширение 4a: пустой ref (после #) ---
    // § Расширения 4a: Error("Invalid config: git plugin ref must not be empty in '{entry}'.")
    it("при строке с пустым ref после # выбрасывает ошибку", async () => {
      const { parsePluginEntry } = (await import("../resolve-plugins.js")) as {
        parsePluginEntry: (entry: string) => unknown;
      };

      expect(() => parsePluginEntry("https://github.com/org/repo#")).toThrow(
        /Invalid config: git plugin ref must not be empty/,
      );
    });

    // --- Расширение 4b: пустой URL (до #) ---
    // § Расширения 4b: Error("Invalid config: git plugin URL must not be empty in '{entry}'.")
    it("при строке с пустым URL до # выбрасывает ошибку", async () => {
      const { parsePluginEntry } = (await import("../resolve-plugins.js")) as {
        parsePluginEntry: (entry: string) => unknown;
      };

      expect(() => parsePluginEntry("#v1.0.0")).toThrow(
        /Invalid config: git plugin URL must not be empty/,
      );
    });

    // --- Happy path: git@ URL без # → type: "git", ref: null ---
    // § Поведение шаг 3.1-3.2: строка НЕ содержит #, isGitUrl возвращает true → git с ref: null
    // § Функция isGitUrl: начинается с git@ → true
    it("при git@ URL без # возвращает type: git с ref: null", async () => {
      const { parsePluginEntry } = (await import("../resolve-plugins.js")) as {
        parsePluginEntry: (entry: string | Record<string, unknown>) => {
          type: string;
          path: string | null;
          url: string | null;
          ref: string | null;
        };
      };

      const result = parsePluginEntry("git@github.com:org/repo");

      expect(result).toEqual({
        type: "git",
        url: "git@github.com:org/repo",
        ref: null,
        path: null,
        values: null,
      });
    });

    // --- Happy path: https:// URL без # → type: "git", ref: null ---
    // § Поведение шаг 3.1-3.2: строка НЕ содержит #, isGitUrl возвращает true (содержит ://)
    it("при https:// URL без # возвращает type: git с ref: null", async () => {
      const { parsePluginEntry } = (await import("../resolve-plugins.js")) as {
        parsePluginEntry: (entry: string | Record<string, unknown>) => {
          type: string;
          path: string | null;
          url: string | null;
          ref: string | null;
        };
      };

      const result = parsePluginEntry("https://github.com/org/repo");

      expect(result).toEqual({
        type: "git",
        url: "https://github.com/org/repo",
        ref: null,
        path: null,
        values: null,
      });
    });

    // --- Happy path: URL с .git суффиксом без # → type: "git", ref: null ---
    // § Поведение шаг 3.1-3.2: строка НЕ содержит #, isGitUrl возвращает true (заканчивается на .git)
    it("при URL с .git суффиксом без # возвращает type: git с ref: null", async () => {
      const { parsePluginEntry } = (await import("../resolve-plugins.js")) as {
        parsePluginEntry: (entry: string | Record<string, unknown>) => {
          type: string;
          path: string | null;
          url: string | null;
          ref: string | null;
        };
      };

      const result = parsePluginEntry("https://github.com/org/repo.git");

      expect(result).toEqual({
        type: "git",
        url: "https://github.com/org/repo.git",
        ref: null,
        path: null,
        values: null,
      });
    });

    // --- Happy path: git URL без # с // subpath → git с subpath и ref: null ---
    // § Поведение шаг 3.1-3.2: строка без # + isGitUrl true, содержит // → subpath
    it("при git URL без # с // subpath возвращает git с subpath и ref: null", async () => {
      const { parsePluginEntry } = (await import("../resolve-plugins.js")) as {
        parsePluginEntry: (entry: string | Record<string, unknown>) => {
          type: string;
          path: string | null;
          url: string | null;
          ref: string | null;
        };
      };

      const result = parsePluginEntry(
        "https://github.com/org/repo//plugins/eslint",
      );

      expect(result).toEqual({
        type: "git",
        url: "https://github.com/org/repo",
        ref: null,
        path: "plugins/eslint",
        values: null,
      });
    });

    // --- Happy path: объект { git: "..." } без ref → type: "git", ref: null ---
    // § Поведение шаг 6: entry.ref ?? null → ref: null при отсутствии поля ref
    it("при объекте с полем git без ref возвращает type: git с ref: null", async () => {
      const { parsePluginEntry } = (await import("../resolve-plugins.js")) as {
        parsePluginEntry: (entry: string | Record<string, unknown>) => {
          type: string;
          path: string | null;
          url: string | null;
          ref: string | null;
        };
      };

      const result = parsePluginEntry({
        git: "https://github.com/org/repo",
      });

      expect(result).toEqual({
        type: "git",
        url: "https://github.com/org/repo",
        ref: null,
        path: null,
        values: null,
      });
    });

    // --- Граничное условие: строка с несколькими # → разбить по последнему ---
    // § Поведение шаг 4: разбить по последнему #
    it("при строке с несколькими # разбивает по последнему символу #", async () => {
      const { parsePluginEntry } = (await import("../resolve-plugins.js")) as {
        parsePluginEntry: (entry: string) => {
          type: string;
          path: string | null;
          url: string | null;
          ref: string | null;
        };
      };

      // URL содержит # в fragment, последний # отделяет ref
      const result = parsePluginEntry(
        "https://github.com/org/repo#branch#v1.0.0",
      );

      expect(result.ref).toBe("v1.0.0");
      expect(result.url).toBe("https://github.com/org/repo#branch");
    });

    // --- Граничное условие: :// в URL не считается // для subpath ---
    // § Поведение шаг 4.1: исключая :// в начале протокола
    it("не интерпретирует :// в протоколе как разделитель subpath", async () => {
      const { parsePluginEntry } = (await import("../resolve-plugins.js")) as {
        parsePluginEntry: (entry: string) => {
          type: string;
          path: string | null;
          url: string | null;
          ref: string | null;
        };
      };

      const result = parsePluginEntry("https://github.com/org/repo#v1.0.0");

      expect(result.path).toBeNull();
      expect(result.url).toBe("https://github.com/org/repo");
    });
  });

  // =====================================================================
  // § git-plugin-loading.md § Расширение процедуры Load Config
  // Валидация нового формата поля plugins (строки + объекты).
  // =====================================================================
  describe("Расширение процедуры Load Config — смешанный формат plugins", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-git-config-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Happy path: массив со смешанными типами ---
    // § git-plugin-loading.md § Расширение процедуры Load Config § Изменения в шаге 6:
    // Массив, каждый элемент — строка, LocalPluginEntry или GitPluginEntry.
    // § Изменения в результате: pluginEntries вместо pluginPaths.
    it("при массиве со смешанными типами (строки + объекты) возвращает pluginEntries", () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(configDir, "config.yml"),
        [
          "adapters:",
          "  - claude",
          "plugins:",
          "  - ../local-plugin",
          "  - https://github.com/org/repo#v1.0.0",
          "  - git: https://github.com/org/repo2",
          "    ref: main",
          "    path: plugins/eslint",
        ].join("\n") + "\n",
      );

      const result = loadConfig(tmpDir);
      expect(result).not.toBeNull();
      // Должен возвращать pluginEntries (массив ParsedPluginEntry)
      expect(result).toHaveProperty("pluginEntries");
      const entries = (result as unknown as { pluginEntries: unknown[] })
        .pluginEntries;
      expect(entries).toHaveLength(3);
    });

    // --- Расширение 6.2.1a: невалидный Git URL ---
    // § git-plugin-loading.md § Расширение процедуры Load Config § Новые расширения 6.2.1a:
    // Error("Invalid config: plugin entry 'git' must be an HTTPS or SSH git URL.")
    it("при невалидном Git URL в объектном формате выбрасывает ошибку", () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(configDir, "config.yml"),
        [
          "adapters:",
          "  - claude",
          "plugins:",
          "  - git: ftp://invalid-protocol.com/repo",
          "    ref: main",
        ].join("\n") + "\n",
      );

      expect(() => loadConfig(tmpDir)).toThrow(
        "Invalid config: plugin entry 'git' must be an HTTPS or SSH git URL.",
      );
    });

    // --- Happy path: объект git без ref → ref: null (опциональный) ---
    // § git-plugin-loading.md § Тип GitPluginEntry: ref (string, опционально)
    // § git-plugin-loading.md § Поведение шаг 6: entry.ref ?? null
    it("при объекте git без ref принимает конфигурацию без ошибки (ref: null)", () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(configDir, "config.yml"),
        [
          "adapters:",
          "  - claude",
          "plugins:",
          "  - git: https://github.com/org/repo",
        ].join("\n") + "\n",
      );

      const result = loadConfig(tmpDir);
      expect(result).not.toBeNull();
      const entries = (result as unknown as { pluginEntries: unknown[] })
        .pluginEntries;
      expect(entries).toHaveLength(1);
    });

    // --- Расширение 6.2.3a: path с .. ---
    // § git-plugin-loading.md § Расширение процедуры Load Config § Новые расширения 6.2.3a:
    // Error("Invalid config: plugin entry 'path' must be a relative path without '..' components.")
    it("при path с компонентом .. выбрасывает ошибку", () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(configDir, "config.yml"),
        [
          "adapters:",
          "  - claude",
          "plugins:",
          "  - git: https://github.com/org/repo",
          "    ref: v1.0.0",
          "    path: ../escape",
        ].join("\n") + "\n",
      );

      expect(() => loadConfig(tmpDir)).toThrow(
        "Invalid config: plugin entry 'path' must be a relative path without '..' components.",
      );
    });

    // --- Расширение 6.2.3a: path начинается с / ---
    // § git-plugin-loading.md § Расширение процедуры Load Config § Новые расширения 6.2.3a
    it("при path начинающимся с / выбрасывает ошибку", () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(configDir, "config.yml"),
        [
          "adapters:",
          "  - claude",
          "plugins:",
          "  - git: https://github.com/org/repo",
          "    ref: v1.0.0",
          "    path: /absolute/path",
        ].join("\n") + "\n",
      );

      expect(() => loadConfig(tmpDir)).toThrow(
        "Invalid config: plugin entry 'path' must be a relative path without '..' components.",
      );
    });

    // --- Расширение 6.1a: Parse Plugin Entry вернул ошибку ---
    // § git-plugin-loading.md § Расширение процедуры Load Config § Новые расширения 6.1a
    it("при строке с пустым ref пробрасывает ошибку Parse Plugin Entry", () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(configDir, "config.yml"),
        [
          "adapters:",
          "  - claude",
          "plugins:",
          "  - https://github.com/org/repo#",
        ].join("\n") + "\n",
      );

      expect(() => loadConfig(tmpDir)).toThrow(
        /Invalid config: git plugin ref must not be empty/,
      );
    });
  });

  // =====================================================================
  // § git-plugin-loading.md § Алгоритм хеширования URL
  // Нормализация URL и детерминированный SHA-256 хеш.
  // =====================================================================
  describe("Алгоритм хеширования URL", () => {
    // --- Трансформация: нормализация trailing / ---
    // § Алгоритм хеширования URL шаг 1: Удалить trailing /
    it("URL с trailing / и без дают одинаковый хеш", async () => {
      const { hashGitUrl } = (await import("../resolve-plugins.js")) as {
        hashGitUrl: (url: string) => string;
      };

      const hash1 = hashGitUrl("https://github.com/org/repo/");
      const hash2 = hashGitUrl("https://github.com/org/repo");
      expect(hash1).toBe(hash2);
    });

    // --- Трансформация: нормализация .git суффикса ---
    // § Алгоритм хеширования URL шаг 2: Удалить суффикс .git
    it("URL с .git и без дают одинаковый хеш", async () => {
      const { hashGitUrl } = (await import("../resolve-plugins.js")) as {
        hashGitUrl: (url: string) => string;
      };

      const hash1 = hashGitUrl("https://github.com/org/repo.git");
      const hash2 = hashGitUrl("https://github.com/org/repo");
      expect(hash1).toBe(hash2);
    });

    // --- Трансформация: нормализация регистра ---
    // § Алгоритм хеширования URL шаг 3: Привести к нижнему регистру
    it("URL в разных регистрах дают одинаковый хеш", async () => {
      const { hashGitUrl } = (await import("../resolve-plugins.js")) as {
        hashGitUrl: (url: string) => string;
      };

      const hash1 = hashGitUrl("https://GitHub.com/Org/Repo");
      const hash2 = hashGitUrl("https://github.com/org/repo");
      expect(hash1).toBe(hash2);
    });

    // --- Трансформация: детерминированность ---
    // § Алгоритм хеширования URL шаги 4-5: SHA-256, первые 16 hex-символов
    it("одинаковый URL возвращает одинаковый хеш длиной 16 hex-символов", async () => {
      const { hashGitUrl } = (await import("../resolve-plugins.js")) as {
        hashGitUrl: (url: string) => string;
      };

      const url = "https://github.com/org/repo";
      const hash1 = hashGitUrl(url);
      const hash2 = hashGitUrl(url);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(16);
      expect(hash1).toMatch(/^[0-9a-f]{16}$/);
    });

    // --- Трансформация: корректность вычисления ---
    // § Алгоритм хеширования URL: полный пайплайн нормализации + SHA-256
    it("вычисляет корректный хеш с учётом всех нормализаций", async () => {
      const { hashGitUrl } = (await import("../resolve-plugins.js")) as {
        hashGitUrl: (url: string) => string;
      };

      const url = "https://GitHub.com/Org/Repo.git/";
      const result = hashGitUrl(url);
      const expected = referenceUrlHash(url);

      expect(result).toBe(expected);
    });

    // --- Граничное условие: URL с trailing / и .git ---
    // § Алгоритм хеширования URL шаги 1-2: оба суффикса
    it("URL с trailing / после .git нормализуется корректно", async () => {
      const { hashGitUrl } = (await import("../resolve-plugins.js")) as {
        hashGitUrl: (url: string) => string;
      };

      // .git/ → сначала удалить /, потом .git
      const hash1 = hashGitUrl("https://github.com/org/repo.git/");
      const hash2 = hashGitUrl("https://github.com/org/repo");
      expect(hash1).toBe(hash2);
    });
  });

  // =====================================================================
  // § git-plugin-loading.md § Процедура Resolve Git Ref
  // Разрешение Git ref в commit SHA с учётом кеша и TTL.
  // =====================================================================
  describe("Процедура Resolve Git Ref", () => {
    let tmpDir: string;
    let originalHome: string | undefined;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-resolve-ref-"));
      originalHome = process.env.HOME;
      process.env.HOME = tmpDir;
    });

    afterEach(() => {
      process.env.HOME = originalHome;
      fs.rmSync(tmpDir, { recursive: true, force: true });
      vi.restoreAllMocks();
    });

    // --- Happy path: ref: null → нормализуется в "HEAD" ---
    // § Поведение шаг 1b: Если ref равен null — установить ref = "HEAD"
    // § Поведение шаг 5: git ls-remote <gitUrl> HEAD
    it("при ref: null нормализует в HEAD и вызывает git ls-remote с HEAD", async () => {
      const childProcess = await import("node:child_process");
      const resolvedSha = "abc123def456789012345678901234567890abcd";
      let capturedCmd: string | undefined;

      vi.spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
        if (typeof cmd === "string" && cmd.includes("ls-remote")) {
          capturedCmd = cmd;
          return Buffer.from(`${resolvedSha}\tHEAD\n`);
        }
        throw new Error(`Unexpected command: ${cmd}`);
      });

      const { resolveGitRef, hashGitUrl } =
        (await import("../resolve-plugins.js")) as {
          resolveGitRef: (params: {
            gitUrl: string;
            ref: string | null;
            forceRefresh: boolean;
          }) => { resolvedSha: string; cachePath: string };
          hashGitUrl: (url: string) => string;
        };

      // Создаём директорию кеша для resolved SHA
      const urlHash = hashGitUrl("https://github.com/org/repo");
      const cacheDir = path.join(
        tmpDir,
        ".agloom",
        "cache",
        "plugins",
        urlHash,
        resolvedSha,
      );
      fs.mkdirSync(cacheDir, { recursive: true });

      const result = resolveGitRef({
        gitUrl: "https://github.com/org/repo",
        ref: null,
        forceRefresh: false,
      });

      expect(result.resolvedSha).toBe(resolvedSha);
      // ls-remote должен быть вызван с HEAD
      expect(capturedCmd).toBeDefined();
      expect(capturedCmd).toContain("ls-remote");
      expect(capturedCmd).toContain("HEAD");
    });

    // --- Happy path: immutable ref (40-hex SHA) → без ls-remote ---
    // § Поведение шаг 2.1: ref является полным commit SHA → resolvedSha = ref
    it("при 40-hex SHA ref возвращает его как resolvedSha без вызова git ls-remote", async () => {
      const { resolveGitRef } = (await import("../resolve-plugins.js")) as {
        resolveGitRef: (params: {
          gitUrl: string;
          ref: string;
          forceRefresh: boolean;
        }) => { resolvedSha: string; cachePath: string };
      };

      const sha = "a".repeat(40);

      // Создаём директорию кеша чтобы шаг 8 нашёл её
      const { hashGitUrl } = (await import("../resolve-plugins.js")) as {
        hashGitUrl: (url: string) => string;
      };
      const urlHash = hashGitUrl("https://github.com/org/repo");
      const cacheDir = path.join(
        tmpDir,
        ".agloom",
        "cache",
        "plugins",
        urlHash,
        sha,
      );
      fs.mkdirSync(cacheDir, { recursive: true });

      const result = resolveGitRef({
        gitUrl: "https://github.com/org/repo",
        ref: sha,
        forceRefresh: false,
      });

      expect(result.resolvedSha).toBe(sha);
      expect(result.cachePath).toBe(cacheDir);
    });

    // --- Happy path: тег → ls-remote → mutable: false ---
    // § Поведение шаги 5-6: ls-remote, вывод содержит refs/tags/<ref> → mutable: false
    it("при теге разрешает через ls-remote и помечает как immutable", async () => {
      // Мокаем child_process для git ls-remote
      const childProcess = await import("node:child_process");
      const lsRemoteOutput = `def456789012345678901234567890abcdef1234\trefs/tags/v1.0.0\n`;

      vi.spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
        if (typeof cmd === "string" && cmd.includes("ls-remote")) {
          return Buffer.from(lsRemoteOutput);
        }
        throw new Error(`Unexpected command: ${cmd}`);
      });

      const { resolveGitRef, hashGitUrl } =
        (await import("../resolve-plugins.js")) as {
          resolveGitRef: (params: {
            gitUrl: string;
            ref: string;
            forceRefresh: boolean;
          }) => { resolvedSha: string; cachePath: string };
          hashGitUrl: (url: string) => string;
        };

      // Создаём директорию кеша для resolved SHA
      const urlHash = hashGitUrl("https://github.com/org/repo");
      const resolvedSha = "def456789012345678901234567890abcdef1234";
      const cacheDir = path.join(
        tmpDir,
        ".agloom",
        "cache",
        "plugins",
        urlHash,
        resolvedSha,
      );
      fs.mkdirSync(cacheDir, { recursive: true });

      const result = resolveGitRef({
        gitUrl: "https://github.com/org/repo",
        ref: "v1.0.0",
        forceRefresh: false,
      });

      expect(result.resolvedSha).toBe(resolvedSha);

      // Проверяем, что refs.yml записан с mutable: false
      const refsPath = path.join(
        tmpDir,
        ".agloom",
        "cache",
        "plugins",
        urlHash,
        "refs.yml",
      );
      expect(fs.existsSync(refsPath)).toBe(true);
      const refsContent = fs.readFileSync(refsPath, "utf-8");
      expect(refsContent).toContain("mutable: false");
    });

    // --- Happy path: ветка → ls-remote → mutable: true ---
    // § Поведение шаги 5-6.2: вывод НЕ содержит refs/tags → mutable: true
    it("при ветке разрешает через ls-remote и помечает как mutable", async () => {
      const childProcess = await import("node:child_process");
      const lsRemoteOutput = `abc123def456789012345678901234567890abcd\trefs/heads/main\n`;

      vi.spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
        if (typeof cmd === "string" && cmd.includes("ls-remote")) {
          return Buffer.from(lsRemoteOutput);
        }
        throw new Error(`Unexpected command: ${cmd}`);
      });

      const { resolveGitRef, hashGitUrl } =
        (await import("../resolve-plugins.js")) as {
          resolveGitRef: (params: {
            gitUrl: string;
            ref: string;
            forceRefresh: boolean;
          }) => { resolvedSha: string; cachePath: string };
          hashGitUrl: (url: string) => string;
        };

      const urlHash = hashGitUrl("https://github.com/org/repo");
      const resolvedSha = "abc123def456789012345678901234567890abcd";
      const cacheDir = path.join(
        tmpDir,
        ".agloom",
        "cache",
        "plugins",
        urlHash,
        resolvedSha,
      );
      fs.mkdirSync(cacheDir, { recursive: true });

      const result = resolveGitRef({
        gitUrl: "https://github.com/org/repo",
        ref: "main",
        forceRefresh: false,
      });

      expect(result.resolvedSha).toBe(resolvedSha);

      // Проверяем refs.yml: mutable: true
      const refsPath = path.join(
        tmpDir,
        ".agloom",
        "cache",
        "plugins",
        urlHash,
        "refs.yml",
      );
      expect(fs.existsSync(refsPath)).toBe(true);
      const refsContent = fs.readFileSync(refsPath, "utf-8");
      expect(refsContent).toContain("mutable: true");
    });

    // --- TTL: mutable ref с не истёкшим TTL → кеш ---
    // § Поведение шаги 4.2-4.3: mutable: true, resolvedAt + TTL > now → кеш
    it("при mutable ref с не истёкшим TTL возвращает кешированный SHA без ls-remote", async () => {
      const { hashGitUrl } = (await import("../resolve-plugins.js")) as {
        hashGitUrl: (url: string) => string;
      };

      const urlHash = hashGitUrl("https://github.com/org/repo");
      const resolvedSha = "abc123def456789012345678901234567890abcd";
      const cacheBase = path.join(
        tmpDir,
        ".agloom",
        "cache",
        "plugins",
        urlHash,
      );
      const cacheDir = path.join(cacheBase, resolvedSha);
      fs.mkdirSync(cacheDir, { recursive: true });

      // Записываем refs.yml с resolvedAt = сейчас (TTL по умолчанию 24h, не истёк)
      const refsYml =
        [
          "refs:",
          "  main:",
          `    sha: ${resolvedSha}`,
          `    resolvedAt: "${new Date().toISOString()}"`,
          "    mutable: true",
        ].join("\n") + "\n";
      fs.writeFileSync(path.join(cacheBase, "refs.yml"), refsYml);

      // НЕ мокаем execSync — если ls-remote вызовется, тест упадёт
      const { resolveGitRef } = (await import("../resolve-plugins.js")) as {
        resolveGitRef: (params: {
          gitUrl: string;
          ref: string;
          forceRefresh: boolean;
        }) => { resolvedSha: string; cachePath: string };
      };

      const result = resolveGitRef({
        gitUrl: "https://github.com/org/repo",
        ref: "main",
        forceRefresh: false,
      });

      expect(result.resolvedSha).toBe(resolvedSha);
    });

    // --- TTL: mutable ref с истёкшим TTL → ls-remote ---
    // § Поведение шаг 4.4: TTL истёк → перейти к шагу 5
    it("при mutable ref с истёкшим TTL выполняет ls-remote для обновления", async () => {
      const { hashGitUrl } = (await import("../resolve-plugins.js")) as {
        hashGitUrl: (url: string) => string;
      };

      const urlHash = hashGitUrl("https://github.com/org/repo");
      const oldSha = "abc123def456789012345678901234567890abcd";
      const newSha = "def456789012345678901234567890abcdef1234";
      const cacheBase = path.join(
        tmpDir,
        ".agloom",
        "cache",
        "plugins",
        urlHash,
      );
      fs.mkdirSync(path.join(cacheBase, newSha), { recursive: true });

      // resolvedAt = 48 часов назад (TTL по умолчанию 24h, истёк)
      const expiredDate = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const refsYml =
        [
          "refs:",
          "  main:",
          `    sha: ${oldSha}`,
          `    resolvedAt: "${expiredDate.toISOString()}"`,
          "    mutable: true",
        ].join("\n") + "\n";
      fs.writeFileSync(path.join(cacheBase, "refs.yml"), refsYml);

      const childProcess = await import("node:child_process");
      vi.spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
        if (typeof cmd === "string" && cmd.includes("ls-remote")) {
          return Buffer.from(`${newSha}\trefs/heads/main\n`);
        }
        throw new Error(`Unexpected command: ${cmd}`);
      });

      const { resolveGitRef } = (await import("../resolve-plugins.js")) as {
        resolveGitRef: (params: {
          gitUrl: string;
          ref: string;
          forceRefresh: boolean;
        }) => { resolvedSha: string; cachePath: string };
      };

      const result = resolveGitRef({
        gitUrl: "https://github.com/org/repo",
        ref: "main",
        forceRefresh: false,
      });

      expect(result.resolvedSha).toBe(newSha);
    });

    // --- forceRefresh: true → ls-remote даже с валидным TTL ---
    // § Поведение шаг 4.2: forceRefresh равен true → пропустить TTL проверку
    it("при forceRefresh: true выполняет ls-remote даже если TTL не истёк", async () => {
      const { hashGitUrl } = (await import("../resolve-plugins.js")) as {
        hashGitUrl: (url: string) => string;
      };

      const urlHash = hashGitUrl("https://github.com/org/repo");
      const resolvedSha = "abc123def456789012345678901234567890abcd";
      const cacheBase = path.join(
        tmpDir,
        ".agloom",
        "cache",
        "plugins",
        urlHash,
      );
      fs.mkdirSync(path.join(cacheBase, resolvedSha), { recursive: true });

      // resolvedAt = сейчас (TTL не истёк)
      const refsYml =
        [
          "refs:",
          "  main:",
          `    sha: ${resolvedSha}`,
          `    resolvedAt: "${new Date().toISOString()}"`,
          "    mutable: true",
        ].join("\n") + "\n";
      fs.writeFileSync(path.join(cacheBase, "refs.yml"), refsYml);

      const childProcess = await import("node:child_process");
      const execSyncSpy = vi
        .spyOn(childProcess, "execSync")
        .mockImplementation((cmd: string) => {
          if (typeof cmd === "string" && cmd.includes("ls-remote")) {
            return Buffer.from(`${resolvedSha}\trefs/heads/main\n`);
          }
          throw new Error(`Unexpected command: ${cmd}`);
        });

      const { resolveGitRef } = (await import("../resolve-plugins.js")) as {
        resolveGitRef: (params: {
          gitUrl: string;
          ref: string;
          forceRefresh: boolean;
        }) => { resolvedSha: string; cachePath: string };
      };

      resolveGitRef({
        gitUrl: "https://github.com/org/repo",
        ref: "main",
        forceRefresh: true,
      });

      // ls-remote должен быть вызван несмотря на валидный TTL
      expect(execSyncSpy).toHaveBeenCalledWith(
        expect.stringContaining("ls-remote"),
        expect.anything(),
      );
    });

    // --- Расширение 3a: refs.yml не существует → перейти к шагу 5 ---
    // § Расширения 3a: Файл refs.yml не существует → перейти к шагу 5
    it("при отсутствии refs.yml выполняет ls-remote", async () => {
      const childProcess = await import("node:child_process");
      const resolvedSha = "abc123def456789012345678901234567890abcd";

      const execSyncSpy = vi
        .spyOn(childProcess, "execSync")
        .mockImplementation((cmd: string) => {
          if (typeof cmd === "string" && cmd.includes("ls-remote")) {
            return Buffer.from(`${resolvedSha}\trefs/heads/main\n`);
          }
          throw new Error(`Unexpected command: ${cmd}`);
        });

      const { resolveGitRef, hashGitUrl } =
        (await import("../resolve-plugins.js")) as {
          resolveGitRef: (params: {
            gitUrl: string;
            ref: string;
            forceRefresh: boolean;
          }) => { resolvedSha: string; cachePath: string };
          hashGitUrl: (url: string) => string;
        };

      // Создаём директорию кеша для resolved SHA
      const urlHash = hashGitUrl("https://github.com/org/repo");
      const cacheDir = path.join(
        tmpDir,
        ".agloom",
        "cache",
        "plugins",
        urlHash,
        resolvedSha,
      );
      fs.mkdirSync(cacheDir, { recursive: true });

      const result = resolveGitRef({
        gitUrl: "https://github.com/org/repo",
        ref: "main",
        forceRefresh: false,
      });

      expect(result.resolvedSha).toBe(resolvedSha);
      expect(execSyncSpy).toHaveBeenCalledWith(
        expect.stringContaining("ls-remote"),
        expect.anything(),
      );
    });

    // --- Расширение 5a: ls-remote ошибка аутентификации ---
    // § Расширения 5a: stderr содержит сообщение об аутентификации →
    // Error("Authentication failed for '<gitUrl>': <stderr>")
    it("при ошибке аутентификации ls-remote выбрасывает ошибку Authentication failed", async () => {
      const childProcess = await import("node:child_process");
      vi.spyOn(childProcess, "execSync").mockImplementation(() => {
        const err = new Error("Command failed") as Error & { stderr: Buffer };
        err.stderr = Buffer.from(
          "fatal: Authentication failed for 'https://github.com/org/repo'",
        );
        throw err;
      });

      const { resolveGitRef } = (await import("../resolve-plugins.js")) as {
        resolveGitRef: (params: {
          gitUrl: string;
          ref: string;
          forceRefresh: boolean;
        }) => unknown;
      };

      expect(() =>
        resolveGitRef({
          gitUrl: "https://github.com/org/repo",
          ref: "main",
          forceRefresh: false,
        }),
      ).toThrow(/Authentication failed for/);
    });

    // --- Расширение 5b: ref не найден в ls-remote ---
    // § Расширения 5b: Вывод не содержит строки с указанным ref →
    // Error("Ref '<ref>' not found in '<gitUrl>': <stderr>")
    it("при отсутствии ref в выводе ls-remote выбрасывает ошибку Ref not found", async () => {
      const childProcess = await import("node:child_process");
      vi.spyOn(childProcess, "execSync").mockImplementation(() => {
        // Пустой вывод — ref не найден
        return Buffer.from("");
      });

      const { resolveGitRef } = (await import("../resolve-plugins.js")) as {
        resolveGitRef: (params: {
          gitUrl: string;
          ref: string;
          forceRefresh: boolean;
        }) => unknown;
      };

      expect(() =>
        resolveGitRef({
          gitUrl: "https://github.com/org/repo",
          ref: "nonexistent-branch",
          forceRefresh: false,
        }),
      ).toThrow(/Ref 'nonexistent-branch' not found in/);
    });

    // --- Расширение 5a: ls-remote общая ошибка (не аутентификация) ---
    // § Расширения 5a: иначе → Error("Failed to resolve ref...")
    it("при общей ошибке ls-remote выбрасывает ошибку Failed to resolve ref", async () => {
      const childProcess = await import("node:child_process");
      vi.spyOn(childProcess, "execSync").mockImplementation(() => {
        const err = new Error("Command failed") as Error & { stderr: Buffer };
        err.stderr = Buffer.from(
          "fatal: repository 'https://github.com/org/repo' not found",
        );
        throw err;
      });

      const { resolveGitRef } = (await import("../resolve-plugins.js")) as {
        resolveGitRef: (params: {
          gitUrl: string;
          ref: string;
          forceRefresh: boolean;
        }) => unknown;
      };

      expect(() =>
        resolveGitRef({
          gitUrl: "https://github.com/org/repo",
          ref: "main",
          forceRefresh: false,
        }),
      ).toThrow(/Failed to resolve ref 'main' for/);
    });

    // --- Шаг 4.1: immutable cached ref (тег) → извлечь SHA без ls-remote ---
    // § Поведение шаг 4.1: mutable: false → извлечь resolvedSha из записи
    it("при кешированном immutable ref (тег) возвращает SHA из кеша без ls-remote", async () => {
      const { hashGitUrl } = (await import("../resolve-plugins.js")) as {
        hashGitUrl: (url: string) => string;
      };

      const urlHash = hashGitUrl("https://github.com/org/repo");
      const resolvedSha = "def456789012345678901234567890abcdef1234";
      const cacheBase = path.join(
        tmpDir,
        ".agloom",
        "cache",
        "plugins",
        urlHash,
      );
      const cacheDir = path.join(cacheBase, resolvedSha);
      fs.mkdirSync(cacheDir, { recursive: true });

      // refs.yml с mutable: false (тег)
      const refsYml =
        [
          "refs:",
          "  v1.0.0:",
          `    sha: ${resolvedSha}`,
          `    resolvedAt: "2020-01-01T00:00:00Z"`,
          "    mutable: false",
        ].join("\n") + "\n";
      fs.writeFileSync(path.join(cacheBase, "refs.yml"), refsYml);

      const { resolveGitRef } = (await import("../resolve-plugins.js")) as {
        resolveGitRef: (params: {
          gitUrl: string;
          ref: string;
          forceRefresh: boolean;
        }) => { resolvedSha: string; cachePath: string };
      };

      // Не мокаем execSync — если вызовется, тест упадёт
      const result = resolveGitRef({
        gitUrl: "https://github.com/org/repo",
        ref: "v1.0.0",
        forceRefresh: false,
      });

      expect(result.resolvedSha).toBe(resolvedSha);
    });
  });

  // =====================================================================
  // § git-plugin-loading.md § Процедура Clone Git Repository
  // Клонирование git-репозитория в кеш.
  // =====================================================================
  describe("Процедура Clone Git Repository", () => {
    let tmpDir: string;
    let originalHome: string | undefined;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-clone-"));
      originalHome = process.env.HOME;
      process.env.HOME = tmpDir;
    });

    afterEach(() => {
      process.env.HOME = originalHome;
      fs.rmSync(tmpDir, { recursive: true, force: true });
      vi.restoreAllMocks();
    });

    // --- Happy path: ref="HEAD" → --depth 1 без --branch ---
    // § Поведение шаг 4.1: ref равен "HEAD" → git clone --depth 1 без --branch
    it("при ref равном HEAD использует --depth 1 без --branch для клонирования", async () => {
      const childProcess = await import("node:child_process");
      const commands: string[] = [];
      const execSyncSpy = vi
        .spyOn(childProcess, "execSync")
        .mockImplementation((cmd: string) => {
          commands.push(cmd);
          return Buffer.from("");
        });

      const { cloneGitRepository } =
        (await import("../resolve-plugins.js")) as {
          cloneGitRepository: (params: {
            gitUrl: string;
            resolvedSha: string;
            ref: string;
            urlHash: string;
          }) => { cachePath: string };
        };

      cloneGitRepository({
        gitUrl: "https://github.com/org/repo",
        resolvedSha: "abc123def456789012345678901234567890abcd",
        ref: "HEAD",
        urlHash: "abcdef0123456789",
      });

      // Должен вызвать git clone --depth 1 без --branch
      const cloneCmd = commands.find((c) => c.includes("git clone"));
      expect(cloneCmd).toBeDefined();
      expect(cloneCmd).toContain("--depth 1");
      expect(cloneCmd).not.toContain("--branch");
    });

    // --- Happy path: тег/ветка → --depth 1 --branch ---
    // § Поведение шаг 4.2: ref НЕ является commit SHA и НЕ равен "HEAD" → git clone --depth 1 --branch <ref>
    it("при ref не являющемся SHA использует --depth 1 --branch для клонирования", async () => {
      const childProcess = await import("node:child_process");
      const execSyncSpy = vi
        .spyOn(childProcess, "execSync")
        .mockImplementation(() => {
          return Buffer.from("");
        });

      const { cloneGitRepository } =
        (await import("../resolve-plugins.js")) as {
          cloneGitRepository: (params: {
            gitUrl: string;
            resolvedSha: string;
            ref: string;
            urlHash: string;
          }) => { cachePath: string };
        };

      cloneGitRepository({
        gitUrl: "https://github.com/org/repo",
        resolvedSha: "abc123def456789012345678901234567890abcd",
        ref: "v1.0.0",
        urlHash: "abcdef0123456789",
      });

      expect(execSyncSpy).toHaveBeenCalledWith(
        expect.stringContaining("--depth 1 --branch v1.0.0"),
        expect.anything(),
      );
    });

    // --- Happy path: SHA → --filter=blob:none + checkout ---
    // § Поведение шаг 4.2: ref является commit SHA → git clone --filter=blob:none
    // § Поведение шаг 5: git checkout <resolvedSha>
    it("при ref являющемся SHA использует --filter=blob:none и checkout", async () => {
      const sha = "abc123def456789012345678901234567890abcd";
      const childProcess = await import("node:child_process");
      const commands: string[] = [];

      vi.spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
        commands.push(cmd);
        return Buffer.from("");
      });

      const { cloneGitRepository } =
        (await import("../resolve-plugins.js")) as {
          cloneGitRepository: (params: {
            gitUrl: string;
            resolvedSha: string;
            ref: string;
            urlHash: string;
          }) => { cachePath: string };
        };

      cloneGitRepository({
        gitUrl: "https://github.com/org/repo",
        resolvedSha: sha,
        ref: sha,
        urlHash: "abcdef0123456789",
      });

      expect(commands.some((c) => c.includes("--filter=blob:none"))).toBe(true);
      expect(commands.some((c) => c.includes(`checkout ${sha}`))).toBe(true);
    });

    // --- Расширение 4.1a: clone --depth 1 ошибка ---
    // § Расширения 4.1a: git clone --depth 1 --branch ошибка →
    // Error("Failed to clone '<gitUrl>': <stderr>")
    it("при ошибке clone --depth 1 --branch выбрасывает ошибку Failed to clone", async () => {
      const childProcess = await import("node:child_process");
      vi.spyOn(childProcess, "execSync").mockImplementation(() => {
        const err = new Error("Command failed") as Error & { stderr: Buffer };
        err.stderr = Buffer.from("fatal: Remote branch v999 not found");
        throw err;
      });

      const { cloneGitRepository } =
        (await import("../resolve-plugins.js")) as {
          cloneGitRepository: (params: {
            gitUrl: string;
            resolvedSha: string;
            ref: string;
            urlHash: string;
          }) => unknown;
        };

      expect(() =>
        cloneGitRepository({
          gitUrl: "https://github.com/org/repo",
          resolvedSha: "abc123def456789012345678901234567890abcd",
          ref: "v999",
          urlHash: "abcdef0123456789",
        }),
      ).toThrow(/Failed to clone/);
    });

    // --- Расширение 4.2a: fallback при ошибке partial clone ---
    // § Расширения 4.2a: --filter=blob:none ошибка → fallback: git clone без фильтра
    it("при ошибке --filter=blob:none выполняет fallback full clone", async () => {
      const sha = "abc123def456789012345678901234567890abcd";
      const childProcess = await import("node:child_process");
      let callCount = 0;

      vi.spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
        callCount++;
        if (typeof cmd === "string" && cmd.includes("--filter=blob:none")) {
          const err = new Error("Command failed") as Error & { stderr: Buffer };
          err.stderr = Buffer.from("fatal: server does not support --filter");
          throw err;
        }
        return Buffer.from("");
      });

      const { cloneGitRepository } =
        (await import("../resolve-plugins.js")) as {
          cloneGitRepository: (params: {
            gitUrl: string;
            resolvedSha: string;
            ref: string;
            urlHash: string;
          }) => { cachePath: string };
        };

      const urlHash = "abcdef0123456789";

      // Должен не упасть — fallback на полный clone
      const result = cloneGitRepository({
        gitUrl: "https://github.com/org/repo",
        resolvedSha: sha,
        ref: sha,
        urlHash,
      });

      // § Результат: cachePath — абсолютный путь к директории кеша
      const expectedCachePath = path.join(
        os.homedir(),
        ".agloom",
        "cache",
        "plugins",
        urlHash,
        sha,
      );
      expect(result.cachePath).toBe(expectedCachePath);
      // Должно быть больше вызовов: partial clone (fail) + full clone + checkout
      expect(callCount).toBeGreaterThan(1);
    });

    // --- Расширение 4.2a.1: fallback clone ошибка ---
    // § Расширения 4.2a.1: git clone (fallback) ошибка →
    // Error("Failed to clone '<gitUrl>': <stderr>")
    it("при ошибке fallback clone выбрасывает ошибку Failed to clone", async () => {
      const sha = "abc123def456789012345678901234567890abcd";
      const childProcess = await import("node:child_process");

      vi.spyOn(childProcess, "execSync").mockImplementation(() => {
        const err = new Error("Command failed") as Error & { stderr: Buffer };
        err.stderr = Buffer.from("fatal: could not connect to server");
        throw err;
      });

      const { cloneGitRepository } =
        (await import("../resolve-plugins.js")) as {
          cloneGitRepository: (params: {
            gitUrl: string;
            resolvedSha: string;
            ref: string;
            urlHash: string;
          }) => unknown;
        };

      expect(() =>
        cloneGitRepository({
          gitUrl: "https://github.com/org/repo",
          resolvedSha: sha,
          ref: sha,
          urlHash: "abcdef0123456789",
        }),
      ).toThrow(/Failed to clone/);
    });

    // --- Расширение 5a: checkout ошибка ---
    // § Расширения 5a: git checkout ошибка →
    // Error("Failed to checkout '<resolvedSha>' from '<gitUrl>': <stderr>")
    it("при ошибке checkout выбрасывает ошибку Failed to checkout", async () => {
      const sha = "abc123def456789012345678901234567890abcd";
      const childProcess = await import("node:child_process");

      vi.spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
        if (typeof cmd === "string" && cmd.includes("checkout")) {
          const err = new Error("Command failed") as Error & { stderr: Buffer };
          err.stderr = Buffer.from("fatal: reference is not a tree");
          throw err;
        }
        return Buffer.from("");
      });

      const { cloneGitRepository } =
        (await import("../resolve-plugins.js")) as {
          cloneGitRepository: (params: {
            gitUrl: string;
            resolvedSha: string;
            ref: string;
            urlHash: string;
          }) => unknown;
        };

      expect(() =>
        cloneGitRepository({
          gitUrl: "https://github.com/org/repo",
          resolvedSha: sha,
          ref: sha,
          urlHash: "abcdef0123456789",
        }),
      ).toThrow(/Failed to checkout/);
    });

    // --- Шаг 2: целевой путь уже существует → кеш hit ---
    // § Поведение шаг 2: Если целевой путь уже существует → вернуть путь
    it("при существующем целевом пути возвращает его без клонирования", async () => {
      const sha = "abc123def456789012345678901234567890abcd";
      const urlHash = "abcdef0123456789";
      const cacheDir = path.join(
        tmpDir,
        ".agloom",
        "cache",
        "plugins",
        urlHash,
        sha,
      );
      fs.mkdirSync(cacheDir, { recursive: true });

      const childProcess = await import("node:child_process");
      const execSyncSpy = vi.spyOn(childProcess, "execSync");

      const { cloneGitRepository } =
        (await import("../resolve-plugins.js")) as {
          cloneGitRepository: (params: {
            gitUrl: string;
            resolvedSha: string;
            ref: string;
            urlHash: string;
          }) => { cachePath: string };
        };

      const result = cloneGitRepository({
        gitUrl: "https://github.com/org/repo",
        resolvedSha: sha,
        ref: "v1.0.0",
        urlHash: urlHash,
      });

      expect(result.cachePath).toBe(cacheDir);
      // Не должно быть вызовов git
      expect(execSyncSpy).not.toHaveBeenCalled();
    });
  });

  // =====================================================================
  // § git-plugin-loading.md § Расширение процедуры Resolve Plugins
  // Git-плагины: resolve ref → check cache → load manifest.
  // =====================================================================
  describe("Расширение процедуры Resolve Plugins — git-плагины", () => {
    let tmpDir: string;
    let originalHome: string | undefined;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-git-resolve-"));
      originalHome = process.env.HOME;
      process.env.HOME = tmpDir;
    });

    afterEach(() => {
      process.env.HOME = originalHome;
      fs.rmSync(tmpDir, { recursive: true, force: true });
      vi.restoreAllMocks();
    });

    // --- Happy path: git-плагин resolve ref → cache → manifest ---
    // § Поведение шаги 2.10-2.15: git-плагин полный флоу
    it("при git-плагине разрешает ref, проверяет кеш и загружает манифест", async () => {
      const childProcess = await import("node:child_process");
      const resolvedSha = "abc123def456789012345678901234567890abcd";

      vi.spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
        if (typeof cmd === "string" && cmd.includes("ls-remote")) {
          return Buffer.from(`${resolvedSha}\trefs/tags/v1.0.0\n`);
        }
        // Clone: создаём plugin.yml в tmpDir
        return Buffer.from("");
      });

      const { hashGitUrl } = (await import("../resolve-plugins.js")) as {
        hashGitUrl: (url: string) => string;
      };

      const urlHash = hashGitUrl("https://github.com/org/repo");
      const cacheDir = path.join(
        tmpDir,
        ".agloom",
        "cache",
        "plugins",
        urlHash,
        resolvedSha,
      );
      fs.mkdirSync(cacheDir, { recursive: true });
      writePluginYaml(cacheDir, validManifest("git-plugin"));

      const { resolvePlugins } = (await import("../resolve-plugins.js")) as {
        resolvePlugins: (params: {
          pluginEntries: {
            type: string;
            url: string | null;
            ref: string | null;
            path: string | null;
          }[];
          projectRoot: string;
          forceRefresh: boolean;
        }) => {
          name: string;
          path: string;
          resolvedSha: string | null;
          gitUrl: string | null;
        }[];
      };

      const result = resolvePlugins({
        pluginEntries: [
          {
            type: "git",
            url: "https://github.com/org/repo",
            ref: "v1.0.0",
            path: null,
          },
        ],
        projectRoot: tmpDir,
        forceRefresh: false,
      });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("git-plugin");
      expect(result[0].resolvedSha).toBe(resolvedSha);
      expect(result[0].gitUrl).toBe("https://github.com/org/repo");
    });

    // --- Шаг 2.11: subpath → <cachePath>/<path> ---
    // § Поведение шаг 2.11: entry.path указан → <cachePath>/<entry.path>
    it("при git-плагине с subpath использует <cachePath>/<path> как корень", async () => {
      const childProcess = await import("node:child_process");
      const resolvedSha = "abc123def456789012345678901234567890abcd";

      vi.spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
        if (typeof cmd === "string" && cmd.includes("ls-remote")) {
          return Buffer.from(`${resolvedSha}\trefs/tags/v1.0.0\n`);
        }
        return Buffer.from("");
      });

      const { hashGitUrl } = (await import("../resolve-plugins.js")) as {
        hashGitUrl: (url: string) => string;
      };

      const urlHash = hashGitUrl("https://github.com/org/repo");
      const cacheDir = path.join(
        tmpDir,
        ".agloom",
        "cache",
        "plugins",
        urlHash,
        resolvedSha,
      );
      const subpathDir = path.join(cacheDir, "plugins", "eslint");
      fs.mkdirSync(subpathDir, { recursive: true });
      writePluginYaml(subpathDir, validManifest("eslint-plugin"));

      const { resolvePlugins } = (await import("../resolve-plugins.js")) as {
        resolvePlugins: (params: {
          pluginEntries: {
            type: string;
            url: string | null;
            ref: string | null;
            path: string | null;
          }[];
          projectRoot: string;
          forceRefresh: boolean;
        }) => { name: string; path: string }[];
      };

      const result = resolvePlugins({
        pluginEntries: [
          {
            type: "git",
            url: "https://github.com/org/repo",
            ref: "v1.0.0",
            path: "plugins/eslint",
          },
        ],
        projectRoot: tmpDir,
        forceRefresh: false,
      });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("eslint-plugin");
      expect(result[0].path).toBe(subpathDir);
    });

    // --- Расширение 2.12a: subpath не существует ---
    // § Расширения 2.12a: Error("Plugin subpath '<entry.path>' not found in repository...")
    it("при несуществующем subpath выбрасывает ошибку Plugin subpath not found", async () => {
      const childProcess = await import("node:child_process");
      const resolvedSha = "abc123def456789012345678901234567890abcd";

      vi.spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
        if (typeof cmd === "string" && cmd.includes("ls-remote")) {
          return Buffer.from(`${resolvedSha}\trefs/tags/v1.0.0\n`);
        }
        return Buffer.from("");
      });

      const { hashGitUrl } = (await import("../resolve-plugins.js")) as {
        hashGitUrl: (url: string) => string;
      };

      const urlHash = hashGitUrl("https://github.com/org/repo");
      const cacheDir = path.join(
        tmpDir,
        ".agloom",
        "cache",
        "plugins",
        urlHash,
        resolvedSha,
      );
      fs.mkdirSync(cacheDir, { recursive: true });

      const { resolvePlugins } = (await import("../resolve-plugins.js")) as {
        resolvePlugins: (params: {
          pluginEntries: {
            type: string;
            url: string | null;
            ref: string | null;
            path: string | null;
          }[];
          projectRoot: string;
          forceRefresh: boolean;
        }) => unknown;
      };

      expect(() =>
        resolvePlugins({
          pluginEntries: [
            {
              type: "git",
              url: "https://github.com/org/repo",
              ref: "v1.0.0",
              path: "nonexistent/path",
            },
          ],
          projectRoot: tmpDir,
          forceRefresh: false,
        }),
      ).toThrow(/Plugin subpath 'nonexistent\/path' not found in repository/);
    });

    // --- Расширение 2.12b: subpath не является директорией ---
    // § Расширения 2.12b: Error("Plugin subpath '<entry.path>' is not a directory...")
    it("при subpath являющимся файлом выбрасывает ошибку is not a directory", async () => {
      const childProcess = await import("node:child_process");
      const resolvedSha = "abc123def456789012345678901234567890abcd";

      vi.spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
        if (typeof cmd === "string" && cmd.includes("ls-remote")) {
          return Buffer.from(`${resolvedSha}\trefs/tags/v1.0.0\n`);
        }
        return Buffer.from("");
      });

      const { hashGitUrl } = (await import("../resolve-plugins.js")) as {
        hashGitUrl: (url: string) => string;
      };

      const urlHash = hashGitUrl("https://github.com/org/repo");
      const cacheDir = path.join(
        tmpDir,
        ".agloom",
        "cache",
        "plugins",
        urlHash,
        resolvedSha,
      );
      fs.mkdirSync(cacheDir, { recursive: true });
      // Создаём файл вместо директории для subpath
      fs.mkdirSync(path.join(cacheDir, "plugins"), { recursive: true });
      fs.writeFileSync(path.join(cacheDir, "plugins", "eslint"), "not a dir");

      const { resolvePlugins } = (await import("../resolve-plugins.js")) as {
        resolvePlugins: (params: {
          pluginEntries: {
            type: string;
            url: string | null;
            ref: string | null;
            path: string | null;
          }[];
          projectRoot: string;
          forceRefresh: boolean;
        }) => unknown;
      };

      expect(() =>
        resolvePlugins({
          pluginEntries: [
            {
              type: "git",
              url: "https://github.com/org/repo",
              ref: "v1.0.0",
              path: "plugins/eslint",
            },
          ],
          projectRoot: tmpDir,
          forceRefresh: false,
        }),
      ).toThrow(/Plugin subpath 'plugins\/eslint' is not a directory/);
    });

    // --- Смешанный массив: local + git плагины ---
    // § Поведение шаг 2.0: определить тип записи по полю type
    it("обрабатывает массив из local и git плагинов в порядке объявления", async () => {
      const childProcess = await import("node:child_process");
      const resolvedSha = "abc123def456789012345678901234567890abcd";

      vi.spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
        if (typeof cmd === "string" && cmd.includes("ls-remote")) {
          return Buffer.from(`${resolvedSha}\trefs/tags/v1.0.0\n`);
        }
        return Buffer.from("");
      });

      const { hashGitUrl } = (await import("../resolve-plugins.js")) as {
        hashGitUrl: (url: string) => string;
      };

      // Локальный плагин
      const localPluginDir = path.join(tmpDir, "local-plugin");
      writePluginYaml(localPluginDir, validManifest("local-plugin"));

      // Git плагин (в кеше)
      const urlHash = hashGitUrl("https://github.com/org/repo");
      const cacheDir = path.join(
        tmpDir,
        ".agloom",
        "cache",
        "plugins",
        urlHash,
        resolvedSha,
      );
      fs.mkdirSync(cacheDir, { recursive: true });
      writePluginYaml(cacheDir, validManifest("git-plugin"));

      const { resolvePlugins } = (await import("../resolve-plugins.js")) as {
        resolvePlugins: (params: {
          pluginEntries: {
            type: string;
            url: string | null;
            ref: string | null;
            path: string | null;
          }[];
          projectRoot: string;
          forceRefresh: boolean;
        }) => { name: string; path: string }[];
      };

      const result = resolvePlugins({
        pluginEntries: [
          { type: "local", url: null, ref: null, path: localPluginDir },
          {
            type: "git",
            url: "https://github.com/org/repo",
            ref: "v1.0.0",
            path: null,
          },
        ],
        projectRoot: tmpDir,
        forceRefresh: false,
      });

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("local-plugin");
      expect(result[1].name).toBe("git-plugin");
    });

    // --- Расширение ResolvedPlugin: git-поля ---
    // § Расширение типа ResolvedPlugin: resolvedSha, gitUrl, gitRef
    it("для local плагинов возвращает null в git-полях ResolvedPlugin", async () => {
      const localPluginDir = path.join(tmpDir, "local-plugin");
      writePluginYaml(localPluginDir, validManifest("local-plugin"));

      const { resolvePlugins } = (await import("../resolve-plugins.js")) as {
        resolvePlugins: (params: {
          pluginEntries: {
            type: string;
            url: string | null;
            ref: string | null;
            path: string | null;
          }[];
          projectRoot: string;
          forceRefresh: boolean;
        }) => {
          name: string;
          resolvedSha: string | null;
          gitUrl: string | null;
          gitRef: string | null;
        }[];
      };

      const result = resolvePlugins({
        pluginEntries: [
          { type: "local", url: null, ref: null, path: localPluginDir },
        ],
        projectRoot: tmpDir,
        forceRefresh: false,
      });

      expect(result[0].resolvedSha).toBeNull();
      expect(result[0].gitUrl).toBeNull();
      expect(result[0].gitRef).toBeNull();
    });
  });

  // =====================================================================
  // § git-plugin-loading.md § Авторизация Git
  // Переменные окружения при git-операциях.
  // =====================================================================
  describe("Авторизация Git — переменные окружения", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    // --- GIT_TERMINAL_PROMPT=0 ---
    // § Авторизация Git § Переменные окружения при git-операциях:
    // ДОЛЖЕН устанавливать GIT_TERMINAL_PROMPT=0
    it("при git-операциях устанавливает GIT_TERMINAL_PROMPT=0", async () => {
      const childProcess = await import("node:child_process");
      let capturedEnv: Record<string, string> | undefined;

      vi.spyOn(childProcess, "execSync").mockImplementation(
        (_cmd: string, opts?: unknown) => {
          capturedEnv = (opts as { env?: Record<string, string> })?.env;
          return Buffer.from(
            "abc123def456789012345678901234567890abcd\trefs/heads/main\n",
          );
        },
      );

      const { resolveGitRef } = (await import("../resolve-plugins.js")) as {
        resolveGitRef: (params: {
          gitUrl: string;
          ref: string;
          forceRefresh: boolean;
        }) => unknown;
      };

      try {
        resolveGitRef({
          gitUrl: "https://github.com/org/repo",
          ref: "main",
          forceRefresh: true,
        });
      } catch {
        // Может упасть из-за отсутствия кеша — нас интересует env
      }

      expect(capturedEnv).toBeDefined();
      expect(capturedEnv!.GIT_TERMINAL_PROMPT).toBe("0");
    });

    // --- AGLOOM_GIT_TOKEN → GIT_ASKPASS ---
    // § Авторизация Git § Переменная окружения AGLOOM_GIT_TOKEN:
    // Если AGLOOM_GIT_TOKEN установлена → GIT_ASKPASS
    it("при установленном AGLOOM_GIT_TOKEN передаёт GIT_ASKPASS", async () => {
      const childProcess = await import("node:child_process");
      let capturedEnv: Record<string, string> | undefined;

      process.env.AGLOOM_GIT_TOKEN = "test-token-123";

      vi.spyOn(childProcess, "execSync").mockImplementation(
        (_cmd: string, opts?: unknown) => {
          capturedEnv = (opts as { env?: Record<string, string> })?.env;
          return Buffer.from(
            "abc123def456789012345678901234567890abcd\trefs/heads/main\n",
          );
        },
      );

      const { resolveGitRef } = (await import("../resolve-plugins.js")) as {
        resolveGitRef: (params: {
          gitUrl: string;
          ref: string;
          forceRefresh: boolean;
        }) => unknown;
      };

      try {
        resolveGitRef({
          gitUrl: "https://github.com/org/repo",
          ref: "main",
          forceRefresh: true,
        });
      } catch {
        // Может упасть — нас интересует env
      }

      expect(capturedEnv).toBeDefined();
      expect(capturedEnv!.GIT_ASKPASS).toBeDefined();

      delete process.env.AGLOOM_GIT_TOKEN;
    });
  });

  // =====================================================================
  // § git-plugin-loading.md § Команда agloom cache clean
  // Удаление глобального кеша git-плагинов.
  // =====================================================================
  describe("Команда agloom cache clean", () => {
    let tmpDir: string;
    let originalHome: string | undefined;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-cache-clean-"));
      originalHome = process.env.HOME;
      process.env.HOME = tmpDir;
    });

    afterEach(() => {
      process.env.HOME = originalHome;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Happy path: кеш существует → удалить ---
    // § Поведение шаги 1-3: определить путь, проверить существование, удалить
    // § Вывод: Cache cleaned: ~/.agloom/cache/plugins/
    it("при существующем кеше удаляет директорию и выводит сообщение об успехе", async () => {
      const cacheDir = path.join(tmpDir, ".agloom", "cache", "plugins");
      fs.mkdirSync(path.join(cacheDir, "some-hash", "some-sha"), {
        recursive: true,
      });

      const React = await import("react");
      const { render } = await import("ink-testing-library");
      const { App } = await import("../app.js");

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["cache", "clean"],
          projectRoot: tmpDir,
        }),
      );

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toBeDefined();
          expect(frame!).toContain("Cache cleaned");
        },
        { timeout: 5000 },
      );

      // Директория должна быть удалена
      expect(fs.existsSync(cacheDir)).toBe(false);

      unmount();
    });

    // --- Расширение 2a: кеш не существует ---
    // § Расширения 2a: Директория не существует →
    // "Cache directory does not exist. Nothing to clean."; exit code 0
    it("при несуществующем кеше выводит сообщение и завершается с exit code 0", async () => {
      // Не создаём директорию кеша

      const React = await import("react");
      const { render } = await import("ink-testing-library");
      const { App } = await import("../app.js");

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["cache", "clean"],
          projectRoot: tmpDir,
        }),
      );

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toBeDefined();
          expect(frame!).toContain("Cache directory does not exist");
        },
        { timeout: 5000 },
      );

      expect(process.exitCode).not.toBe(1);

      unmount();
    });
  });

  // =====================================================================
  // § git-plugin-loading.md § Расширение команды transpile
  // Флаг --refresh.
  // =====================================================================
  describe("Расширение команды transpile — флаг --refresh", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-refresh-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Новый аргумент --refresh ---
    // § git-plugin-loading.md § Расширение команды transpile § Новые аргументы:
    // --refresh (boolean, опционально, default: false)
    it("команда transpile принимает флаг --refresh без ошибки", async () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(configDir, "config.yml"),
        "adapters:\n  - claude\n",
      );
      fs.writeFileSync(path.join(tmpDir, "AGLOOM.md"), "Content.");

      const React = await import("react");
      const { render } = await import("ink-testing-library");
      const { App } = await import("../app.js");

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["transpile", "--refresh"],
          projectRoot: tmpDir,
        }),
      );

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toBeDefined();
          // Команда должна начать выполнение без ошибки парсинга аргументов
          expect(frame!.length).toBeGreaterThan(0);
        },
        { timeout: 5000 },
      );

      unmount();
    });
  });

  // =====================================================================
  // § git-plugin-loading.md § Настройка TTL
  // Файл ~/.agloom/settings.yml для cache.ttl.
  // =====================================================================
  describe("Настройка TTL — settings.yml", () => {
    let tmpDir: string;
    let originalHome: string | undefined;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-ttl-"));
      originalHome = process.env.HOME;
      process.env.HOME = tmpDir;
    });

    afterEach(() => {
      process.env.HOME = originalHome;
      fs.rmSync(tmpDir, { recursive: true, force: true });
      vi.restoreAllMocks();
    });

    // --- Default TTL: 24h ---
    // § Настройка TTL: Если файл settings.yml отсутствует — default "24h"
    it("при отсутствии settings.yml использует TTL по умолчанию 24 часа", async () => {
      // Не создаём settings.yml
      // Создаём refs.yml с resolvedAt = 23 часа назад (менее 24h)
      const { hashGitUrl } = (await import("../resolve-plugins.js")) as {
        hashGitUrl: (url: string) => string;
      };

      const urlHash = hashGitUrl("https://github.com/org/repo");
      const resolvedSha = "abc123def456789012345678901234567890abcd";
      const cacheBase = path.join(
        tmpDir,
        ".agloom",
        "cache",
        "plugins",
        urlHash,
      );
      fs.mkdirSync(path.join(cacheBase, resolvedSha), { recursive: true });

      const almostExpired = new Date(Date.now() - 23 * 60 * 60 * 1000);
      const refsYml =
        [
          "refs:",
          "  main:",
          `    sha: ${resolvedSha}`,
          `    resolvedAt: "${almostExpired.toISOString()}"`,
          "    mutable: true",
        ].join("\n") + "\n";
      fs.writeFileSync(path.join(cacheBase, "refs.yml"), refsYml);

      const { resolveGitRef } = (await import("../resolve-plugins.js")) as {
        resolveGitRef: (params: {
          gitUrl: string;
          ref: string;
          forceRefresh: boolean;
        }) => { resolvedSha: string; cachePath: string };
      };

      // Не мокаем execSync — если TTL не истёк, ls-remote не вызовется
      const result = resolveGitRef({
        gitUrl: "https://github.com/org/repo",
        ref: "main",
        forceRefresh: false,
      });

      expect(result.resolvedSha).toBe(resolvedSha);
    });

    // --- Custom TTL из settings.yml ---
    // § Настройка TTL: cache.ttl: "1h" → 1 час
    it("при settings.yml с cache.ttl: '1h' использует TTL 1 час", async () => {
      // Создаём settings.yml
      const settingsDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(settingsDir, { recursive: true });
      fs.writeFileSync(
        path.join(settingsDir, "settings.yml"),
        "cache:\n  ttl: 1h\n",
      );

      const { hashGitUrl } = (await import("../resolve-plugins.js")) as {
        hashGitUrl: (url: string) => string;
      };

      const urlHash = hashGitUrl("https://github.com/org/repo");
      const resolvedSha = "abc123def456789012345678901234567890abcd";
      const newSha = "def456789012345678901234567890abcdef1234";
      const cacheBase = path.join(
        tmpDir,
        ".agloom",
        "cache",
        "plugins",
        urlHash,
      );
      fs.mkdirSync(path.join(cacheBase, newSha), { recursive: true });

      // resolvedAt = 2 часа назад (> 1h TTL, истёк)
      const expired = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const refsYml =
        [
          "refs:",
          "  main:",
          `    sha: ${resolvedSha}`,
          `    resolvedAt: "${expired.toISOString()}"`,
          "    mutable: true",
        ].join("\n") + "\n";
      fs.writeFileSync(path.join(cacheBase, "refs.yml"), refsYml);

      const childProcess = await import("node:child_process");
      vi.spyOn(childProcess, "execSync").mockImplementation((cmd: string) => {
        if (typeof cmd === "string" && cmd.includes("ls-remote")) {
          return Buffer.from(`${newSha}\trefs/heads/main\n`);
        }
        throw new Error(`Unexpected command: ${cmd}`);
      });

      const { resolveGitRef } = (await import("../resolve-plugins.js")) as {
        resolveGitRef: (params: {
          gitUrl: string;
          ref: string;
          forceRefresh: boolean;
        }) => { resolvedSha: string; cachePath: string };
      };

      const result = resolveGitRef({
        gitUrl: "https://github.com/org/repo",
        ref: "main",
        forceRefresh: false,
      });

      // TTL истёк → ls-remote → новый SHA
      expect(result.resolvedSha).toBe(newSha);
    });

    // --- TTL: "0" → всегда re-resolve ---
    // § Настройка TTL: Значение "0" — всегда выполнять re-resolve для mutable refs
    it("при cache.ttl: '0' всегда выполняет ls-remote для mutable refs", async () => {
      const settingsDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(settingsDir, { recursive: true });
      fs.writeFileSync(
        path.join(settingsDir, "settings.yml"),
        'cache:\n  ttl: "0"\n',
      );

      const { hashGitUrl } = (await import("../resolve-plugins.js")) as {
        hashGitUrl: (url: string) => string;
      };

      const urlHash = hashGitUrl("https://github.com/org/repo");
      const resolvedSha = "abc123def456789012345678901234567890abcd";
      const cacheBase = path.join(
        tmpDir,
        ".agloom",
        "cache",
        "plugins",
        urlHash,
      );
      fs.mkdirSync(path.join(cacheBase, resolvedSha), { recursive: true });

      // resolvedAt = только что (не истёк по любому TTL, кроме 0)
      const refsYml =
        [
          "refs:",
          "  main:",
          `    sha: ${resolvedSha}`,
          `    resolvedAt: "${new Date().toISOString()}"`,
          "    mutable: true",
        ].join("\n") + "\n";
      fs.writeFileSync(path.join(cacheBase, "refs.yml"), refsYml);

      const childProcess = await import("node:child_process");
      const execSyncSpy = vi
        .spyOn(childProcess, "execSync")
        .mockImplementation((cmd: string) => {
          if (typeof cmd === "string" && cmd.includes("ls-remote")) {
            return Buffer.from(`${resolvedSha}\trefs/heads/main\n`);
          }
          throw new Error(`Unexpected command: ${cmd}`);
        });

      const { resolveGitRef } = (await import("../resolve-plugins.js")) as {
        resolveGitRef: (params: {
          gitUrl: string;
          ref: string;
          forceRefresh: boolean;
        }) => { resolvedSha: string; cachePath: string };
      };

      resolveGitRef({
        gitUrl: "https://github.com/org/repo",
        ref: "main",
        forceRefresh: false,
      });

      // ls-remote должен быть вызван несмотря на свежий resolvedAt
      expect(execSyncSpy).toHaveBeenCalledWith(
        expect.stringContaining("ls-remote"),
        expect.anything(),
      );
    });
  });
});
