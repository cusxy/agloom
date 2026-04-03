// plugin-manifest.spec.ts
// Спецификация: docs/specs/plugin-manifest.md § Процедура Load Plugin Manifest
// Спецификация: docs/specs/plugin-manifest.md § Валидация имени плагина
// Спецификация: docs/specs/plugin-manifest.md § Валидация версии
// Спецификация: docs/specs/plugin-manifest.md § Тип PluginManifest

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { loadPluginManifest } from "../plugin-manifest.js";

/**
 * Вспомогательная функция: создаёт plugin.yml с указанным содержимым.
 */
function writeManifest(pluginDir: string, content: string): void {
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.writeFileSync(path.join(pluginDir, "plugin.yml"), content);
}

/**
 * Минимальный валидный манифест для использования в тестах.
 */
const VALID_MANIFEST = `name: my-plugin
version: 1.0.0
description: "A test plugin"
author:
  name: "John Doe"
  email: "john@example.com"
`;

describe("CLI", () => {
  // =====================================================================
  // § plugin-manifest.md § Процедура Load Plugin Manifest
  // Загрузка, парсинг и валидация манифеста плагина из указанной директории.
  // =====================================================================
  describe("Процедура Load Plugin Manifest", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-plugin-manifest-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // =================================================================
    // Happy path: шаги 1-11
    // =================================================================

    // § Поведение шаги 1-11: полный манифест со всеми полями
    it("при валидном манифесте со всеми полями возвращает PluginManifest с корректными значениями", () => {
      const pluginDir = path.join(tmpDir, "my-plugin");
      writeManifest(
        pluginDir,
        `name: my-plugin
version: 1.0.0
description: "Shared ESLint configuration for agloom projects"
license: MIT
author:
  name: "John Doe"
  email: "john@example.com"
  url: "https://example.com"
homepage: "https://github.com/example/my-eslint-config"
keywords:
  - eslint
  - config
`,
      );

      const result = loadPluginManifest(pluginDir);

      expect(result).toEqual({
        name: "my-plugin",
        version: "1.0.0",
        description: "Shared ESLint configuration for agloom projects",
        license: "MIT",
        author: {
          name: "John Doe",
          email: "john@example.com",
          url: "https://example.com",
        },
        homepage: "https://github.com/example/my-eslint-config",
        keywords: ["eslint", "config"],
        variables: null,
      });
    });

    // § Поведение шаги 1-7: минимальный манифест (только обязательные поля)
    // § Тип PluginManifest: опциональные поля → null / пустой массив
    it("при минимальном валидном манифесте возвращает PluginManifest с null для опциональных полей", () => {
      const pluginDir = path.join(tmpDir, "minimal");
      writeManifest(pluginDir, VALID_MANIFEST);

      const result = loadPluginManifest(pluginDir);

      expect(result.name).toBe("my-plugin");
      expect(result.version).toBe("1.0.0");
      expect(result.description).toBe("A test plugin");
      expect(result.license).toBeNull();
      expect(result.author).toEqual({
        name: "John Doe",
        email: "john@example.com",
        url: null,
      });
      expect(result.homepage).toBeNull();
      expect(result.keywords).toEqual([]);
    });

    // =================================================================
    // Расширение 2a: файл plugin.yml не существует
    // =================================================================

    // § Расширения 2a: Error("Plugin manifest not found: <pluginDir>/plugin.yml")
    it("при отсутствии plugin.yml выбрасывает ошибку Plugin manifest not found", () => {
      const pluginDir = path.join(tmpDir, "no-manifest");
      fs.mkdirSync(pluginDir, { recursive: true });

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        `Plugin manifest not found: ${pluginDir}/plugin.yml`,
      );
    });

    // =================================================================
    // Расширение 3a: невалидный YAML
    // =================================================================

    // § Расширения 3a: Error("Invalid plugin manifest: <причина парсинга>")
    it("при невалидном YAML выбрасывает ошибку Invalid plugin manifest", () => {
      const pluginDir = path.join(tmpDir, "invalid-yaml");
      writeManifest(pluginDir, "name: [invalid yaml\n  : : :\n");

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        /Invalid plugin manifest:/,
      );
    });

    // =================================================================
    // Расширение 4a: поле name отсутствует
    // =================================================================

    // § Расширения 4a: Error("Invalid plugin manifest: 'name' is required.")
    it("при отсутствии поля name выбрасывает ошибку о его обязательности", () => {
      const pluginDir = path.join(tmpDir, "no-name");
      writeManifest(
        pluginDir,
        `version: 1.0.0
description: "A plugin"
author:
  name: "Doe"
  email: "d@e.com"
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        "Invalid plugin manifest: 'name' is required.",
      );
    });

    // =================================================================
    // Расширение 4b: невалидное имя
    // =================================================================

    // § Расширения 4b + § Валидация имени плагина: заглавные буквы
    it("при имени с заглавными буквами выбрасывает ошибку валидации name", () => {
      const pluginDir = path.join(tmpDir, "upper-name");
      writeManifest(
        pluginDir,
        `name: My-Plugin
version: 1.0.0
description: "A plugin"
author:
  name: "Doe"
  email: "d@e.com"
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        /Invalid plugin manifest: 'name' must contain only lowercase/,
      );
    });

    // § Расширения 4b + § Валидация имени плагина: начинается с дефиса
    it("при имени, начинающемся с дефиса, выбрасывает ошибку валидации name", () => {
      const pluginDir = path.join(tmpDir, "dash-start");
      writeManifest(
        pluginDir,
        `name: "-plugin"
version: 1.0.0
description: "A plugin"
author:
  name: "Doe"
  email: "d@e.com"
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        /Invalid plugin manifest: 'name' must contain only lowercase/,
      );
    });

    // § Расширения 4b + § Валидация имени плагина: заканчивается дефисом
    it("при имени, заканчивающемся дефисом, выбрасывает ошибку валидации name", () => {
      const pluginDir = path.join(tmpDir, "dash-end");
      writeManifest(
        pluginDir,
        `name: "plugin-"
version: 1.0.0
description: "A plugin"
author:
  name: "Doe"
  email: "d@e.com"
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        /Invalid plugin manifest: 'name' must contain only lowercase/,
      );
    });

    // § Расширения 4b + § Валидация имени плагина: последовательные дефисы
    it("при имени с последовательными дефисами выбрасывает ошибку валидации name", () => {
      const pluginDir = path.join(tmpDir, "double-dash");
      writeManifest(
        pluginDir,
        `name: "my--plugin"
version: 1.0.0
description: "A plugin"
author:
  name: "Doe"
  email: "d@e.com"
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        /Invalid plugin manifest: 'name' must contain only lowercase/,
      );
    });

    // § Расширения 4b + § Валидация имени плагина: содержит пробел
    it("при имени с пробелом выбрасывает ошибку валидации name", () => {
      const pluginDir = path.join(tmpDir, "space-name");
      writeManifest(
        pluginDir,
        `name: "my plugin"
version: 1.0.0
description: "A plugin"
author:
  name: "Doe"
  email: "d@e.com"
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        /Invalid plugin manifest: 'name' must contain only lowercase/,
      );
    });

    // § Расширения 4b + § Валидация имени плагина: содержит подчёркивание
    it("при имени с подчёркиванием выбрасывает ошибку валидации name", () => {
      const pluginDir = path.join(tmpDir, "underscore-name");
      writeManifest(
        pluginDir,
        `name: "my_plugin"
version: 1.0.0
description: "A plugin"
author:
  name: "Doe"
  email: "d@e.com"
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        /Invalid plugin manifest: 'name' must contain only lowercase/,
      );
    });

    // =================================================================
    // Граничные условия: имя плагина
    // =================================================================

    // § Валидация имени плагина: однобуквенное имя ("a") — валидно
    it("при однобуквенном имени 'a' не выбрасывает ошибку", () => {
      const pluginDir = path.join(tmpDir, "single-char");
      writeManifest(
        pluginDir,
        `name: a
version: 1.0.0
description: "A plugin"
author:
  name: "Doe"
  email: "d@e.com"
`,
      );

      const result = loadPluginManifest(pluginDir);
      expect(result.name).toBe("a");
    });

    // § Валидация имени плагина: максимальная длина 214 символов — валидно
    it("при имени длиной 214 символов не выбрасывает ошибку", () => {
      // "a" + 212 * "b" + "c" = 214 символов, начинается с буквы, заканчивается буквой
      const name = "a" + "b".repeat(212) + "c";
      const pluginDir = path.join(tmpDir, "max-length");
      writeManifest(
        pluginDir,
        `name: ${name}
version: 1.0.0
description: "A plugin"
author:
  name: "Doe"
  email: "d@e.com"
`,
      );

      const result = loadPluginManifest(pluginDir);
      expect(result.name).toBe(name);
      expect(result.name).toHaveLength(214);
    });

    // § Валидация имени плагина: длина 215 символов — невалидно
    it("при имени длиной 215 символов выбрасывает ошибку валидации name", () => {
      const name = "a" + "b".repeat(213) + "c";
      const pluginDir = path.join(tmpDir, "over-max-length");
      writeManifest(
        pluginDir,
        `name: ${name}
version: 1.0.0
description: "A plugin"
author:
  name: "Doe"
  email: "d@e.com"
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        /Invalid plugin manifest: 'name' must contain only lowercase/,
      );
    });

    // § Валидация имени плагина: пустая строка — невалидно (не матчит regex)
    it("при пустом имени выбрасывает ошибку валидации name", () => {
      const pluginDir = path.join(tmpDir, "empty-name");
      writeManifest(
        pluginDir,
        `name: ""
version: 1.0.0
description: "A plugin"
author:
  name: "Doe"
  email: "d@e.com"
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        /Invalid plugin manifest: 'name'/,
      );
    });

    // § Валидация имени плагина: имя с цифрой в конце — валидно
    it("при имени 'plugin1' (заканчивается цифрой) не выбрасывает ошибку", () => {
      const pluginDir = path.join(tmpDir, "digit-end");
      writeManifest(
        pluginDir,
        `name: plugin1
version: 1.0.0
description: "A plugin"
author:
  name: "Doe"
  email: "d@e.com"
`,
      );

      const result = loadPluginManifest(pluginDir);
      expect(result.name).toBe("plugin1");
    });

    // § Валидация имени плагина: имя, начинающееся с цифры — невалидно
    it("при имени, начинающемся с цифры, выбрасывает ошибку валидации name", () => {
      const pluginDir = path.join(tmpDir, "digit-start");
      writeManifest(
        pluginDir,
        `name: "1plugin"
version: 1.0.0
description: "A plugin"
author:
  name: "Doe"
  email: "d@e.com"
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        /Invalid plugin manifest: 'name' must contain only lowercase/,
      );
    });

    // =================================================================
    // Расширение 5a: поле version отсутствует
    // =================================================================

    // § Расширения 5a: Error("Invalid plugin manifest: 'version' is required.")
    it("при отсутствии поля version выбрасывает ошибку о его обязательности", () => {
      const pluginDir = path.join(tmpDir, "no-version");
      writeManifest(
        pluginDir,
        `name: my-plugin
description: "A plugin"
author:
  name: "Doe"
  email: "d@e.com"
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        "Invalid plugin manifest: 'version' is required.",
      );
    });

    // =================================================================
    // Расширение 5b: невалидная версия
    // =================================================================

    // § Расширения 5b + § Валидация версии: неполный формат "1.0"
    it('при версии "1.0" выбрасывает ошибку валидации version', () => {
      const pluginDir = path.join(tmpDir, "bad-version-1");
      writeManifest(
        pluginDir,
        `name: my-plugin
version: "1.0"
description: "A plugin"
author:
  name: "Doe"
  email: "d@e.com"
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        "Invalid plugin manifest: 'version' must be a valid semver string.",
      );
    });

    // § Расширения 5b + § Валидация версии: префикс "v" — "v1.0.0"
    it('при версии "v1.0.0" выбрасывает ошибку валидации version', () => {
      const pluginDir = path.join(tmpDir, "bad-version-2");
      writeManifest(
        pluginDir,
        `name: my-plugin
version: "v1.0.0"
description: "A plugin"
author:
  name: "Doe"
  email: "d@e.com"
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        "Invalid plugin manifest: 'version' must be a valid semver string.",
      );
    });

    // § Расширения 5b + § Валидация версии: лишний компонент "1.0.0.0"
    it('при версии "1.0.0.0" выбрасывает ошибку валидации version', () => {
      const pluginDir = path.join(tmpDir, "bad-version-3");
      writeManifest(
        pluginDir,
        `name: my-plugin
version: "1.0.0.0"
description: "A plugin"
author:
  name: "Doe"
  email: "d@e.com"
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        "Invalid plugin manifest: 'version' must be a valid semver string.",
      );
    });

    // § Валидация версии: semver с prerelease — "1.2.3-beta.1" — валидно
    it('при версии "1.2.3-beta.1" не выбрасывает ошибку', () => {
      const pluginDir = path.join(tmpDir, "prerelease-version");
      writeManifest(
        pluginDir,
        `name: my-plugin
version: "1.2.3-beta.1"
description: "A plugin"
author:
  name: "Doe"
  email: "d@e.com"
`,
      );

      const result = loadPluginManifest(pluginDir);
      expect(result.version).toBe("1.2.3-beta.1");
    });

    // § Валидация версии: semver с build metadata — "1.0.0+build.123" — валидно
    it('при версии "1.0.0+build.123" не выбрасывает ошибку', () => {
      const pluginDir = path.join(tmpDir, "build-meta-version");
      writeManifest(
        pluginDir,
        `name: my-plugin
version: "1.0.0+build.123"
description: "A plugin"
author:
  name: "Doe"
  email: "d@e.com"
`,
      );

      const result = loadPluginManifest(pluginDir);
      expect(result.version).toBe("1.0.0+build.123");
    });

    // =================================================================
    // Расширение 6a: поле description отсутствует
    // =================================================================

    // § Расширения 6a: Error("Invalid plugin manifest: 'description' is required.")
    it("при отсутствии поля description выбрасывает ошибку о его обязательности", () => {
      const pluginDir = path.join(tmpDir, "no-desc");
      writeManifest(
        pluginDir,
        `name: my-plugin
version: 1.0.0
author:
  name: "Doe"
  email: "d@e.com"
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        "Invalid plugin manifest: 'description' is required.",
      );
    });

    // =================================================================
    // Расширение 6b: description не является непустой строкой
    // =================================================================

    // § Расширения 6b: Error("Invalid plugin manifest: 'description' must be a non-empty string.")
    it("при пустой строке description выбрасывает ошибку о непустой строке", () => {
      const pluginDir = path.join(tmpDir, "empty-desc");
      writeManifest(
        pluginDir,
        `name: my-plugin
version: 1.0.0
description: ""
author:
  name: "Doe"
  email: "d@e.com"
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        "Invalid plugin manifest: 'description' must be a non-empty string.",
      );
    });

    // =================================================================
    // Расширение 7a: поле author отсутствует
    // =================================================================

    // § Расширения 7a: Error("Invalid plugin manifest: 'author' is required.")
    it("при отсутствии поля author выбрасывает ошибку о его обязательности", () => {
      const pluginDir = path.join(tmpDir, "no-author");
      writeManifest(
        pluginDir,
        `name: my-plugin
version: 1.0.0
description: "A plugin"
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        "Invalid plugin manifest: 'author' is required.",
      );
    });

    // =================================================================
    // Расширение 7b: author не является объектом
    // =================================================================

    // § Расширения 7b: Error("Invalid plugin manifest: 'author' must be an object.")
    it("при author как строке выбрасывает ошибку о типе объекта", () => {
      const pluginDir = path.join(tmpDir, "author-string");
      writeManifest(
        pluginDir,
        `name: my-plugin
version: 1.0.0
description: "A plugin"
author: "John Doe"
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        "Invalid plugin manifest: 'author' must be an object.",
      );
    });

    // =================================================================
    // Расширение 7c: author.name отсутствует или не является непустой строкой
    // =================================================================

    // § Расширения 7c: Error("Invalid plugin manifest: 'author.name' must be a non-empty string.")
    it("при отсутствии author.name выбрасывает ошибку о непустой строке", () => {
      const pluginDir = path.join(tmpDir, "no-author-name");
      writeManifest(
        pluginDir,
        `name: my-plugin
version: 1.0.0
description: "A plugin"
author:
  email: "d@e.com"
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        "Invalid plugin manifest: 'author.name' must be a non-empty string.",
      );
    });

    // § Расширения 7c: author.name — пустая строка
    it("при пустом author.name выбрасывает ошибку о непустой строке", () => {
      const pluginDir = path.join(tmpDir, "empty-author-name");
      writeManifest(
        pluginDir,
        `name: my-plugin
version: 1.0.0
description: "A plugin"
author:
  name: ""
  email: "d@e.com"
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        "Invalid plugin manifest: 'author.name' must be a non-empty string.",
      );
    });

    // =================================================================
    // Расширение 7d: author.email отсутствует или не является непустой строкой
    // =================================================================

    // § Расширения 7d: Error("Invalid plugin manifest: 'author.email' must be a non-empty string.")
    it("при отсутствии author.email выбрасывает ошибку о непустой строке", () => {
      const pluginDir = path.join(tmpDir, "no-author-email");
      writeManifest(
        pluginDir,
        `name: my-plugin
version: 1.0.0
description: "A plugin"
author:
  name: "Doe"
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        "Invalid plugin manifest: 'author.email' must be a non-empty string.",
      );
    });

    // § Расширения 7d: author.email — пустая строка
    it("при пустом author.email выбрасывает ошибку о непустой строке", () => {
      const pluginDir = path.join(tmpDir, "empty-author-email");
      writeManifest(
        pluginDir,
        `name: my-plugin
version: 1.0.0
description: "A plugin"
author:
  name: "Doe"
  email: ""
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        "Invalid plugin manifest: 'author.email' must be a non-empty string.",
      );
    });

    // =================================================================
    // Расширение 8a: author.url не является валидным URL
    // =================================================================

    // § Расширения 8a: Error("Invalid plugin manifest: 'author.url' must be a valid URL.")
    it("при невалидном author.url выбрасывает ошибку валидации URL", () => {
      const pluginDir = path.join(tmpDir, "bad-author-url");
      writeManifest(
        pluginDir,
        `name: my-plugin
version: 1.0.0
description: "A plugin"
author:
  name: "Doe"
  email: "d@e.com"
  url: "not-a-url"
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        "Invalid plugin manifest: 'author.url' must be a valid URL.",
      );
    });

    // § Поведение шаг 8: author.url присутствует и валиден — не выбрасывает ошибку
    it("при валидном author.url возвращает его в результате", () => {
      const pluginDir = path.join(tmpDir, "good-author-url");
      writeManifest(
        pluginDir,
        `name: my-plugin
version: 1.0.0
description: "A plugin"
author:
  name: "Doe"
  email: "d@e.com"
  url: "https://example.com"
`,
      );

      const result = loadPluginManifest(pluginDir);
      expect(result.author.url).toBe("https://example.com");
    });

    // =================================================================
    // Расширение 9a: license присутствует, но не является непустой строкой
    // =================================================================

    // § Расширения 9a: Error("Invalid plugin manifest: 'license' must be a non-empty string.")
    it("при пустой строке license выбрасывает ошибку о непустой строке", () => {
      const pluginDir = path.join(tmpDir, "empty-license");
      writeManifest(
        pluginDir,
        `name: my-plugin
version: 1.0.0
description: "A plugin"
license: ""
author:
  name: "Doe"
  email: "d@e.com"
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        "Invalid plugin manifest: 'license' must be a non-empty string.",
      );
    });

    // § Тип PluginManifest: license — string | null. Если указан, возвращается как строка.
    it("при указанном license возвращает его значение", () => {
      const pluginDir = path.join(tmpDir, "with-license");
      writeManifest(
        pluginDir,
        `name: my-plugin
version: 1.0.0
description: "A plugin"
license: Apache-2.0
author:
  name: "Doe"
  email: "d@e.com"
`,
      );

      const result = loadPluginManifest(pluginDir);
      expect(result.license).toBe("Apache-2.0");
    });

    // =================================================================
    // Расширение 10a: homepage не является валидным URL
    // =================================================================

    // § Расширения 10a: Error("Invalid plugin manifest: 'homepage' must be a valid URL.")
    it("при невалидном homepage выбрасывает ошибку валидации URL", () => {
      const pluginDir = path.join(tmpDir, "bad-homepage");
      writeManifest(
        pluginDir,
        `name: my-plugin
version: 1.0.0
description: "A plugin"
homepage: "not-a-url"
author:
  name: "Doe"
  email: "d@e.com"
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        "Invalid plugin manifest: 'homepage' must be a valid URL.",
      );
    });

    // § Поведение шаг 10: homepage присутствует и валиден — возвращается в результате
    it("при валидном homepage возвращает его значение", () => {
      const pluginDir = path.join(tmpDir, "good-homepage");
      writeManifest(
        pluginDir,
        `name: my-plugin
version: 1.0.0
description: "A plugin"
homepage: "https://github.com/example/plugin"
author:
  name: "Doe"
  email: "d@e.com"
`,
      );

      const result = loadPluginManifest(pluginDir);
      expect(result.homepage).toBe("https://github.com/example/plugin");
    });

    // =================================================================
    // Расширение 11a: keywords не является массивом
    // =================================================================

    // § Расширения 11a: Error("Invalid plugin manifest: 'keywords' must be an array of strings.")
    it("при keywords как строке выбрасывает ошибку о типе массива", () => {
      const pluginDir = path.join(tmpDir, "keywords-string");
      writeManifest(
        pluginDir,
        `name: my-plugin
version: 1.0.0
description: "A plugin"
keywords: "eslint"
author:
  name: "Doe"
  email: "d@e.com"
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        "Invalid plugin manifest: 'keywords' must be an array of strings.",
      );
    });

    // =================================================================
    // Расширение 11b: keywords содержит непустую строку
    // =================================================================

    // § Расширения 11b: Error("Invalid plugin manifest: each keyword must be a non-empty string.")
    it("при пустой строке в keywords выбрасывает ошибку о непустых строках", () => {
      const pluginDir = path.join(tmpDir, "keywords-empty-item");
      writeManifest(
        pluginDir,
        `name: my-plugin
version: 1.0.0
description: "A plugin"
keywords:
  - eslint
  - ""
author:
  name: "Doe"
  email: "d@e.com"
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        "Invalid plugin manifest: each keyword must be a non-empty string.",
      );
    });

    // § Расширения 11b: keywords содержит нестроковый элемент
    it("при числовом элементе в keywords выбрасывает ошибку о непустых строках", () => {
      const pluginDir = path.join(tmpDir, "keywords-number-item");
      writeManifest(
        pluginDir,
        `name: my-plugin
version: 1.0.0
description: "A plugin"
keywords:
  - eslint
  - 123
author:
  name: "Doe"
  email: "d@e.com"
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        "Invalid plugin manifest: each keyword must be a non-empty string.",
      );
    });

    // =================================================================
    // Трансформации: опциональные поля → null / пустой массив
    // =================================================================

    // § Тип PluginManifest: author.url — string | null. Отсутствие → null.
    it("при отсутствии author.url возвращает null", () => {
      const pluginDir = path.join(tmpDir, "no-author-url");
      writeManifest(pluginDir, VALID_MANIFEST);

      const result = loadPluginManifest(pluginDir);
      expect(result.author.url).toBeNull();
    });

    // § Тип PluginManifest: homepage — string | null. Отсутствие → null.
    it("при отсутствии homepage возвращает null", () => {
      const pluginDir = path.join(tmpDir, "no-homepage");
      writeManifest(pluginDir, VALID_MANIFEST);

      const result = loadPluginManifest(pluginDir);
      expect(result.homepage).toBeNull();
    });

    // § Тип PluginManifest: keywords — array<string>. Отсутствие → [].
    it("при отсутствии keywords возвращает пустой массив", () => {
      const pluginDir = path.join(tmpDir, "no-keywords");
      writeManifest(pluginDir, VALID_MANIFEST);

      const result = loadPluginManifest(pluginDir);
      expect(result.keywords).toEqual([]);
    });

    // § Тип PluginManifest: license — string | null. Отсутствие → null.
    it("при отсутствии license возвращает null", () => {
      const pluginDir = path.join(tmpDir, "no-license");
      writeManifest(pluginDir, VALID_MANIFEST);

      const result = loadPluginManifest(pluginDir);
      expect(result.license).toBeNull();
    });

    // =================================================================
    // Граничные условия: description
    // =================================================================

    // § Поведение шаг 6 + § Формат манифеста: description — непустая строка.
    // Числовое значение — не строка.
    it("при числовом description выбрасывает ошибку о непустой строке", () => {
      const pluginDir = path.join(tmpDir, "number-desc");
      writeManifest(
        pluginDir,
        `name: my-plugin
version: 1.0.0
description: 42
author:
  name: "Doe"
  email: "d@e.com"
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        "Invalid plugin manifest: 'description' must be a non-empty string.",
      );
    });

    // =================================================================
    // Граничные условия: author — пустой объект
    // =================================================================

    // § Расширения 7c: пустой объект author не содержит name
    it("при пустом объекте author выбрасывает ошибку о author.name", () => {
      const pluginDir = path.join(tmpDir, "empty-author");
      writeManifest(
        pluginDir,
        `name: my-plugin
version: 1.0.0
description: "A plugin"
author: {}
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        "Invalid plugin manifest: 'author.name' must be a non-empty string.",
      );
    });

    // =================================================================
    // Граничные условия: keywords — пустой массив (валидно)
    // =================================================================

    // § Формат манифеста: keywords (array<string>, опционально, default: [])
    it("при пустом массиве keywords возвращает пустой массив", () => {
      const pluginDir = path.join(tmpDir, "empty-keywords");
      writeManifest(
        pluginDir,
        `name: my-plugin
version: 1.0.0
description: "A plugin"
keywords: []
author:
  name: "Doe"
  email: "d@e.com"
`,
      );

      const result = loadPluginManifest(pluginDir);
      expect(result.keywords).toEqual([]);
    });
  });
});
