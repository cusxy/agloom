// config-variables.spec.ts
// Спецификация: docs/specs/plugin-values.md § Расширение формата конфигурационного файла
// Спецификация: docs/specs/plugin-values.md § Расширение процедуры Load Config

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { loadConfigFromFile } from "./load-config-test-helper.js";

function writeConfig(projectRoot: string, content: string): void {
  const configDir = path.join(projectRoot, ".agloom");
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(path.join(configDir, "config.yml"), content);
}

describe("CLI", () => {
  // =====================================================================
  // § plugin-values.md § Расширение процедуры Load Config — обработка variables
  // =====================================================================
  describe("Расширение процедуры Load Config — variables", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-config-variables-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // =================================================================
    // Happy path: шаги 7-9 — config с variables (полный и сокращённый формат)
    // =================================================================

    // § Поведение шаги 7-9: variables с полным и сокращённым форматом
    it("при config.yml с variables в полном и сокращённом формате возвращает нормализованные декларации", () => {
      writeConfig(
        tmpDir,
        `adapters:
  - claude
variables:
  project_name: "\${env:PROJECT_NAME}"
  team:
    description: "Team name"
    default: "platform"
  api_key:
    description: "API key"
    default: "\${env:API_KEY}"
    sensitive: true
`,
      );

      const result = loadConfigFromFile(tmpDir);

      expect(result).not.toBeNull();
      expect(result!.configVariables).toEqual({
        project_name: {
          description: "",
          required: false,
          default: "${env:PROJECT_NAME}",
          sensitive: false,
        },
        team: {
          description: "Team name",
          required: false,
          default: "platform",
          sensitive: false,
        },
        api_key: {
          description: "API key",
          required: false,
          default: "${env:API_KEY}",
          sensitive: true,
        },
      });
    });

    // =================================================================
    // Расширение 7a: variables отсутствует → configVariables = null
    // =================================================================

    // § Расширения 7a: variables отсутствует → null
    it("при отсутствии поля variables возвращает configVariables равный null", () => {
      writeConfig(
        tmpDir,
        `adapters:
  - claude
`,
      );

      const result = loadConfigFromFile(tmpDir);

      expect(result).not.toBeNull();
      expect(result!.configVariables).toBeNull();
    });

    // =================================================================
    // Расширение 8a: variables не является объектом
    // =================================================================

    // § Расширения 8a: variables не объект → Error
    it("при variables как массиве выбрасывает ошибку о типе объекта", () => {
      writeConfig(
        tmpDir,
        `adapters:
  - claude
variables:
  - team_name
`,
      );

      expect(() => loadConfigFromFile(tmpDir)).toThrow("Invalid config: 'variables' must be an object.");
    });

    // § Расширения 8a: variables как число → Error
    it("при variables как числе выбрасывает ошибку о типе объекта", () => {
      writeConfig(
        tmpDir,
        `adapters:
  - claude
variables: 42
`,
      );

      expect(() => loadConfigFromFile(tmpDir)).toThrow("Invalid config: 'variables' must be an object.");
    });

    // =================================================================
    // Трансформация: шаг 9.1 — строка нормализуется в VariableDeclaration
    // =================================================================

    // § Поведение шаг 9.1: строковое значение → { description: "", required: false, default: <значение>, sensitive: false }
    it("при строковом значении переменной нормализует в VariableDeclaration с default", () => {
      writeConfig(
        tmpDir,
        `adapters:
  - claude
variables:
  project_name: "my-project"
`,
      );

      const result = loadConfigFromFile(tmpDir);

      expect(result!.configVariables!["project_name"]).toEqual({
        description: "",
        required: false,
        default: "my-project",
        sensitive: false,
      });
    });

    // =================================================================
    // Расширение 9.2a: значение записи не является ни строкой, ни объектом
    // =================================================================

    // § Расширения 9.2a: значение не строка и не объект → Error
    it("при числовом значении переменной выбрасывает ошибку о допустимых типах", () => {
      writeConfig(
        tmpDir,
        `adapters:
  - claude
variables:
  count: 42
`,
      );

      expect(() => loadConfigFromFile(tmpDir)).toThrow(
        "Invalid config: variable 'count' must be a string or an object.",
      );
    });

    // § Расширения 9.2a: массив → Error
    it("при массивном значении переменной выбрасывает ошибку о допустимых типах", () => {
      writeConfig(
        tmpDir,
        `adapters:
  - claude
variables:
  tags:
    - one
    - two
`,
      );

      expect(() => loadConfigFromFile(tmpDir)).toThrow(
        "Invalid config: variable 'tags' must be a string or an object.",
      );
    });

    // =================================================================
    // Расширение 9.2.1a: description не является строкой
    // =================================================================

    // § Расширения 9.2.1a: description не строка → Error
    it("при числовом description в переменной config.yml выбрасывает ошибку", () => {
      writeConfig(
        tmpDir,
        `adapters:
  - claude
variables:
  team:
    description: 42
    default: "platform"
`,
      );

      expect(() => loadConfigFromFile(tmpDir)).toThrow(
        "Invalid config: variable 'team' field 'description' must be a string.",
      );
    });

    // =================================================================
    // Расширение 9.2.2a: required не является boolean
    // =================================================================

    // § Расширения 9.2.2a: required не boolean → Error
    it("при строковом required в переменной config.yml выбрасывает ошибку", () => {
      writeConfig(
        tmpDir,
        `adapters:
  - claude
variables:
  team:
    description: "Team name"
    required: "yes"
`,
      );

      expect(() => loadConfigFromFile(tmpDir)).toThrow(
        "Invalid config: variable 'team' field 'required' must be a boolean.",
      );
    });

    // =================================================================
    // Расширение 9.2.3a: default не является строкой
    // =================================================================

    // § Расширения 9.2.3a: default не строка → Error
    it("при числовом default в переменной config.yml выбрасывает ошибку", () => {
      writeConfig(
        tmpDir,
        `adapters:
  - claude
variables:
  port:
    description: "Port"
    default: 8080
`,
      );

      expect(() => loadConfigFromFile(tmpDir)).toThrow(
        "Invalid config: variable 'port' field 'default' must be a string.",
      );
    });

    // =================================================================
    // Расширение 9.2.4a: sensitive не является boolean
    // =================================================================

    // § Расширения 9.2.4a: sensitive не boolean → Error
    it("при строковом sensitive в переменной config.yml выбрасывает ошибку", () => {
      writeConfig(
        tmpDir,
        `adapters:
  - claude
variables:
  api_key:
    description: "API key"
    sensitive: "true"
`,
      );

      expect(() => loadConfigFromFile(tmpDir)).toThrow(
        "Invalid config: variable 'api_key' field 'sensitive' must be a boolean.",
      );
    });

    // =================================================================
    // Граничные условия: description опционально в config.yml
    // =================================================================

    // § Секция variables в config.yml: description НЕОБЯЗАТЕЛЬНО (default: "")
    it("при отсутствии description в объектном формате config.yml применяет default пустую строку", () => {
      writeConfig(
        tmpDir,
        `adapters:
  - claude
variables:
  team:
    default: "platform"
`,
      );

      const result = loadConfigFromFile(tmpDir);

      expect(result!.configVariables!["team"].description).toBe("");
    });

    // =================================================================
    // Граничные условия: пустой объект variables
    // =================================================================

    // § Поведение шаг 7: variables как пустой объект — валидно
    it("при пустом объекте variables возвращает пустую карту", () => {
      writeConfig(
        tmpDir,
        `adapters:
  - claude
variables: {}
`,
      );

      const result = loadConfigFromFile(tmpDir);

      expect(result!.configVariables).toEqual({});
    });
  });

  // =====================================================================
  // § plugin-values.md § Обработка values в plugin entries
  // =====================================================================
  describe("Расширение процедуры Load Config — values в plugin entries", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-config-plugin-values-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // =================================================================
    // Расширение 6.3a: values не является объектом
    // =================================================================

    // § Расширения 6.3a: values не объект → Error
    it("при values как строке в plugin entry выбрасывает ошибку о типе объекта", () => {
      writeConfig(
        tmpDir,
        `adapters:
  - claude
plugins:
  - path: ../local-plugin
    values: "not an object"
`,
      );

      expect(() => loadConfigFromFile(tmpDir)).toThrow("Invalid config: plugin 'values' must be an object.");
    });

    // § Расширения 6.3a: values как массив → Error
    it("при values как массиве в plugin entry выбрасывает ошибку о типе объекта", () => {
      writeConfig(
        tmpDir,
        `adapters:
  - claude
plugins:
  - path: ../local-plugin
    values:
      - one
      - two
`,
      );

      expect(() => loadConfigFromFile(tmpDir)).toThrow("Invalid config: plugin 'values' must be an object.");
    });

    // =================================================================
    // Расширение 6.3b: значение в values не является строкой
    // =================================================================

    // § Расширения 6.3b: значение в values не строка → Error
    it("при числовом значении в values выбрасывает ошибку о типе строки", () => {
      writeConfig(
        tmpDir,
        `adapters:
  - claude
plugins:
  - path: ../local-plugin
    values:
      port: 8080
`,
      );

      expect(() => loadConfigFromFile(tmpDir)).toThrow(
        "Invalid config: plugin 'values' entry 'port' must be a string.",
      );
    });

    // § Расширения 6.3b: boolean значение → Error
    it("при boolean значении в values выбрасывает ошибку о типе строки", () => {
      writeConfig(
        tmpDir,
        `adapters:
  - claude
plugins:
  - path: ../local-plugin
    values:
      enabled: true
`,
      );

      expect(() => loadConfigFromFile(tmpDir)).toThrow(
        "Invalid config: plugin 'values' entry 'enabled' must be a string.",
      );
    });

    // =================================================================
    // Happy path: values корректно парсятся в ParsedPluginEntry
    // =================================================================

    // § Расширение типа ParsedPluginEntry: values → Record<string, string> | null
    it("при корректных values в local plugin entry включает их в pluginEntries", () => {
      writeConfig(
        tmpDir,
        `adapters:
  - claude
plugins:
  - path: ../local-plugin
    values:
      team_name: "platform"
      api_token: "\${env:TOKEN}"
`,
      );

      const result = loadConfigFromFile(tmpDir);

      expect(result).not.toBeNull();
      expect(result!.pluginEntries).not.toBeNull();
      expect(result!.pluginEntries![0].values).toEqual({
        team_name: "platform",
        api_token: "${env:TOKEN}",
      });
    });

    // § Расширение процедуры Parse Plugin Entry: строковые записи → values: null
    it("при строковой записи плагина values равен null", () => {
      writeConfig(
        tmpDir,
        `adapters:
  - claude
plugins:
  - ../local-plugin
`,
      );

      const result = loadConfigFromFile(tmpDir);

      expect(result).not.toBeNull();
      expect(result!.pluginEntries).not.toBeNull();
      expect(result!.pluginEntries![0].values).toBeNull();
    });

    // § Расширение процедуры Parse Plugin Entry: объект без values → values: null
    it("при объектной записи плагина без values возвращает values равный null", () => {
      writeConfig(
        tmpDir,
        `adapters:
  - claude
plugins:
  - path: ../local-plugin
`,
      );

      const result = loadConfigFromFile(tmpDir);

      expect(result).not.toBeNull();
      expect(result!.pluginEntries).not.toBeNull();
      expect(result!.pluginEntries![0].values).toBeNull();
    });

    // § Расширение процедуры Parse Plugin Entry: git entry с values
    it("при git plugin entry с values включает их в pluginEntries", () => {
      writeConfig(
        tmpDir,
        `adapters:
  - claude
plugins:
  - git: git@github.com:cusxy/skill-cycling
    values:
      team_name: "platform"
`,
      );

      const result = loadConfigFromFile(tmpDir);

      expect(result).not.toBeNull();
      expect(result!.pluginEntries).not.toBeNull();
      expect(result!.pluginEntries![0].values).toEqual({
        team_name: "platform",
      });
    });
  });
});
