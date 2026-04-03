// plugin-manifest-variables.spec.ts
// Спецификация: docs/specs/plugin-values.md § Расширение формата манифеста плагина
// Спецификация: docs/specs/plugin-values.md § Тип VariableDeclaration
// Спецификация: docs/specs/plugin-values.md § Расширение процедуры Load Plugin Manifest

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
const BASE_MANIFEST = `name: my-plugin
version: 1.0.0
description: "A test plugin"
author:
  name: "John Doe"
  email: "john@example.com"
`;

describe("CLI", () => {
  // =====================================================================
  // § plugin-values.md § Расширение процедуры Load Plugin Manifest
  // Валидация поля variables в манифесте плагина.
  // =====================================================================
  describe("Расширение процедуры Load Plugin Manifest — variables", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "agl-manifest-variables-"),
      );
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // =================================================================
    // Happy path: шаги 12-14 — манифест с полным набором variables
    // =================================================================

    // § Поведение шаги 12-14: манифест с variables, все поля VariableDeclaration
    it("при манифесте с variables возвращает PluginManifest с картой деклараций переменных", () => {
      const pluginDir = path.join(tmpDir, "with-variables");
      writeManifest(
        pluginDir,
        `${BASE_MANIFEST}variables:
  team_name:
    description: "Team name for commit messages"
    required: true
  api_token:
    description: "API token for external service"
    required: true
    sensitive: true
  lint_command:
    description: "Custom lint command"
    default: "pnpm run lint"
  base_url:
    description: "Base URL for API calls"
    default: "\${env:BASE_URL}"
`,
      );

      const result = loadPluginManifest(pluginDir);

      expect(result.variables).toEqual({
        team_name: {
          description: "Team name for commit messages",
          required: true,
          sensitive: false,
          default: null,
        },
        api_token: {
          description: "API token for external service",
          required: true,
          sensitive: true,
          default: null,
        },
        lint_command: {
          description: "Custom lint command",
          required: false,
          sensitive: false,
          default: "pnpm run lint",
        },
        base_url: {
          description: "Base URL for API calls",
          required: false,
          sensitive: false,
          default: "${env:BASE_URL}",
        },
      });
    });

    // =================================================================
    // Расширение 12a: поле variables отсутствует → null
    // =================================================================

    // § Расширения 12a: variables отсутствует → null
    it("при отсутствии поля variables возвращает variables равный null", () => {
      const pluginDir = path.join(tmpDir, "no-variables");
      writeManifest(pluginDir, BASE_MANIFEST);

      const result = loadPluginManifest(pluginDir);

      expect(result.variables).toBeNull();
    });

    // =================================================================
    // Расширение 13a: variables не является объектом
    // =================================================================

    // § Расширения 13a: variables не объект → Error
    it("при variables как массиве выбрасывает ошибку о типе объекта", () => {
      const pluginDir = path.join(tmpDir, "variables-array");
      writeManifest(
        pluginDir,
        `${BASE_MANIFEST}variables:
  - team_name
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        "Invalid plugin manifest: 'variables' must be an object.",
      );
    });

    // § Расширения 13a: variables как строка → Error
    it("при variables как строке выбрасывает ошибку о типе объекта", () => {
      const pluginDir = path.join(tmpDir, "variables-string");
      writeManifest(
        pluginDir,
        `${BASE_MANIFEST}variables: "not an object"
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        "Invalid plugin manifest: 'variables' must be an object.",
      );
    });

    // =================================================================
    // Расширение 14.1a: значение записи не является объектом
    // =================================================================

    // § Расширения 14.1a: variable value не объект → Error
    it("при значении переменной как строке выбрасывает ошибку о типе объекта", () => {
      const pluginDir = path.join(tmpDir, "variable-not-object");
      writeManifest(
        pluginDir,
        `${BASE_MANIFEST}variables:
  team_name: "some string"
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        "Invalid plugin manifest: variable 'team_name' must be an object.",
      );
    });

    // § Расширения 14.1a: variable value как число → Error
    it("при значении переменной как числе выбрасывает ошибку о типе объекта", () => {
      const pluginDir = path.join(tmpDir, "variable-number");
      writeManifest(
        pluginDir,
        `${BASE_MANIFEST}variables:
  count: 42
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        "Invalid plugin manifest: variable 'count' must be an object.",
      );
    });

    // =================================================================
    // Расширение 14.2a: description отсутствует или не является непустой строкой
    // =================================================================

    // § Расширения 14.2a: description отсутствует → Error
    it("при отсутствии description в переменной выбрасывает ошибку", () => {
      const pluginDir = path.join(tmpDir, "no-description");
      writeManifest(
        pluginDir,
        `${BASE_MANIFEST}variables:
  team_name:
    required: true
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        "Invalid plugin manifest: variable 'team_name' must have a non-empty 'description'.",
      );
    });

    // § Расширения 14.2a: description пустая строка → Error
    it("при пустом description в переменной выбрасывает ошибку", () => {
      const pluginDir = path.join(tmpDir, "empty-description");
      writeManifest(
        pluginDir,
        `${BASE_MANIFEST}variables:
  team_name:
    description: ""
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        "Invalid plugin manifest: variable 'team_name' must have a non-empty 'description'.",
      );
    });

    // § Расширения 14.2a: description как число → Error
    it("при числовом description в переменной выбрасывает ошибку", () => {
      const pluginDir = path.join(tmpDir, "number-description");
      writeManifest(
        pluginDir,
        `${BASE_MANIFEST}variables:
  team_name:
    description: 42
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        "Invalid plugin manifest: variable 'team_name' must have a non-empty 'description'.",
      );
    });

    // =================================================================
    // Расширение 14.3a: required не является boolean
    // =================================================================

    // § Расширения 14.3a: required не boolean → Error
    it("при строковом required в переменной выбрасывает ошибку", () => {
      const pluginDir = path.join(tmpDir, "required-string");
      writeManifest(
        pluginDir,
        `${BASE_MANIFEST}variables:
  team_name:
    description: "Team name"
    required: "yes"
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        "Invalid plugin manifest: variable 'team_name' field 'required' must be a boolean.",
      );
    });

    // =================================================================
    // Расширение 14.4a: default не является строкой
    // =================================================================

    // § Расширения 14.4a: default не строка → Error
    it("при числовом default в переменной выбрасывает ошибку", () => {
      const pluginDir = path.join(tmpDir, "default-number");
      writeManifest(
        pluginDir,
        `${BASE_MANIFEST}variables:
  port:
    description: "Port number"
    default: 8080
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        "Invalid plugin manifest: variable 'port' field 'default' must be a string.",
      );
    });

    // =================================================================
    // Расширение 14.5a: sensitive не является boolean
    // =================================================================

    // § Расширения 14.5a: sensitive не boolean → Error
    it("при строковом sensitive в переменной выбрасывает ошибку", () => {
      const pluginDir = path.join(tmpDir, "sensitive-string");
      writeManifest(
        pluginDir,
        `${BASE_MANIFEST}variables:
  api_key:
    description: "API key"
    sensitive: "true"
`,
      );

      expect(() => loadPluginManifest(pluginDir)).toThrow(
        "Invalid plugin manifest: variable 'api_key' field 'sensitive' must be a boolean.",
      );
    });

    // =================================================================
    // Трансформации: значения по умолчанию полей VariableDeclaration
    // =================================================================

    // § Тип VariableDeclaration: required default false, sensitive default false
    it("при минимальной декларации переменной (только description) применяет значения по умолчанию", () => {
      const pluginDir = path.join(tmpDir, "minimal-variable");
      writeManifest(
        pluginDir,
        `${BASE_MANIFEST}variables:
  team_name:
    description: "Team name"
`,
      );

      const result = loadPluginManifest(pluginDir);

      expect(result.variables).not.toBeNull();
      const decl = result.variables!["team_name"];
      expect(decl.required).toBe(false);
      expect(decl.sensitive).toBe(false);
      expect(decl.default).toBeNull();
    });

    // =================================================================
    // Граничные условия: пустой объект variables
    // =================================================================

    // § Поведение шаг 12: variables присутствует как пустой объект — валидно
    it("при пустом объекте variables возвращает пустую карту", () => {
      const pluginDir = path.join(tmpDir, "empty-variables");
      writeManifest(
        pluginDir,
        `${BASE_MANIFEST}variables: {}
`,
      );

      const result = loadPluginManifest(pluginDir);

      expect(result.variables).toEqual({});
    });

    // =================================================================
    // Граничные условия: default содержит ${env:*}
    // =================================================================

    // § Тип VariableDeclaration: default МОЖЕТ содержать ${env:*}
    it("при default со значением ${env:VAR} сохраняет строку как есть (без интерполяции)", () => {
      const pluginDir = path.join(tmpDir, "default-env-ref");
      writeManifest(
        pluginDir,
        `${BASE_MANIFEST}variables:
  base_url:
    description: "Base URL"
    default: "\${env:BASE_URL}"
`,
      );

      const result = loadPluginManifest(pluginDir);

      expect(result.variables!["base_url"].default).toBe("${env:BASE_URL}");
    });
  });
});
