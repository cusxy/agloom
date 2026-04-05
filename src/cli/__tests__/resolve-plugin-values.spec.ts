// resolve-plugin-values.spec.ts
// Спецификация: docs/specs/plugin-values.md § Процедура Resolve Plugin Values
// Спецификация: docs/specs/plugin-values.md § Валидация sensitive
// Спецификация: docs/specs/plugin-values.md § Resolution chain для plugin values

import { describe, it, expect } from "vitest";
import { resolvePluginValues } from "../resolve-plugin-values.js";
import type { VariableDeclaration } from "../plugin-manifest.js";

describe("CLI", () => {
  // =====================================================================
  // § plugin-values.md § Процедура Resolve Plugin Values
  // Резолвинг и валидация значений переменных для одного плагина.
  // =====================================================================
  describe("Процедура Resolve Plugin Values", () => {
    // =================================================================
    // Happy path: шаги 1-9
    // =================================================================

    // § Поведение шаг 1: declarations null, providedValues null → пустая карта
    it("при null declarations и null providedValues возвращает пустую карту", () => {
      const result = resolvePluginValues(null, null, {});

      expect(result).toEqual({});
    });

    // § Поведение шаги 3-9: полный цикл резолвинга с providedValues и defaults
    it("при наличии declarations и providedValues возвращает merged resolved values", () => {
      const declarations: Record<string, VariableDeclaration> = {
        team_name: {
          description: "Team name",
          required: true,
          sensitive: false,
          default: null,
        },
        lint_command: {
          description: "Lint command",
          required: false,
          sensitive: false,
          default: "pnpm run lint",
        },
        base_url: {
          description: "Base URL",
          required: false,
          sensitive: false,
          default: "http://localhost",
        },
      };
      const providedValues: Record<string, string> = {
        team_name: "platform",
        base_url: "https://api.example.com",
      };

      const result = resolvePluginValues(declarations, providedValues, {});

      expect(result).toEqual({
        team_name: "platform",
        lint_command: "pnpm run lint",
        base_url: "https://api.example.com",
      });
    });

    // § Поведение шаг 7: интерполяция ${env:*} в providedValues
    it("интерполирует ${env:*} в значениях из providedValues", () => {
      const declarations: Record<string, VariableDeclaration> = {
        api_token: {
          description: "API token",
          required: true,
          sensitive: true,
          default: null,
        },
      };
      const providedValues: Record<string, string> = {
        api_token: "${env:API_TOKEN}",
      };
      const env: Record<string, string> = { API_TOKEN: "secret-token-123" };

      const result = resolvePluginValues(declarations, providedValues, env);

      expect(result).toEqual({ api_token: "secret-token-123" });
    });

    // § Поведение шаг 7: интерполяция ${env:*} в default
    it("интерполирует ${env:*} в значениях default из declarations", () => {
      const declarations: Record<string, VariableDeclaration> = {
        base_url: {
          description: "Base URL",
          required: false,
          sensitive: false,
          default: "${env:BASE_URL}",
        },
      };
      const env: Record<string, string> = {
        BASE_URL: "https://api.example.com",
      };

      const result = resolvePluginValues(declarations, null, env);

      expect(result).toEqual({ base_url: "https://api.example.com" });
    });

    // § Resolution chain: providedValues имеет приоритет над default
    it("значение из providedValues имеет приоритет над default", () => {
      const declarations: Record<string, VariableDeclaration> = {
        lint_command: {
          description: "Lint command",
          required: false,
          sensitive: false,
          default: "pnpm run lint",
        },
      };
      const providedValues: Record<string, string> = {
        lint_command: "npm run lint",
      };

      const result = resolvePluginValues(declarations, providedValues, {});

      expect(result).toEqual({ lint_command: "npm run lint" });
    });

    // § Результат: переменные без значения и без required отсутствуют в карте
    it("переменные без значения и без required: true отсутствуют в результате", () => {
      const declarations: Record<string, VariableDeclaration> = {
        optional_var: {
          description: "Optional variable",
          required: false,
          sensitive: false,
          default: null,
        },
        with_default: {
          description: "Has default",
          required: false,
          sensitive: false,
          default: "value",
        },
      };

      const result = resolvePluginValues(declarations, null, {});

      expect(result).toEqual({ with_default: "value" });
      expect("optional_var" in result).toBe(false);
    });

    // =================================================================
    // Расширение 2a: declarations null, providedValues не null
    // =================================================================

    // § Расширения 2a: declarations null, providedValues не null → Error
    it("при null declarations и непустых providedValues выбрасывает ошибку об unknown variables", () => {
      const providedValues: Record<string, string> = {
        team_name: "platform",
        api_token: "token",
      };

      expect(() => resolvePluginValues(null, providedValues, {})).toThrow(
        "Unknown plugin values: 'team_name, api_token'. Plugin does not declare any variables.",
      );
    });

    // =================================================================
    // Расширение 3a: unknown variable в providedValues
    // =================================================================

    // § Расширения 3a: ключ из providedValues отсутствует в declarations → Error
    it("при unknown ключе в providedValues выбрасывает ошибку с перечислением declared variables", () => {
      const declarations: Record<string, VariableDeclaration> = {
        team_name: {
          description: "Team name",
          required: true,
          sensitive: false,
          default: null,
        },
      };
      const providedValues: Record<string, string> = {
        team_name: "platform",
        unknown_key: "value",
      };

      expect(() => resolvePluginValues(declarations, providedValues, {})).toThrow(
        "Unknown plugin value: 'unknown_key'. Declared variables: team_name.",
      );
    });

    // =================================================================
    // Расширение 4a: sensitive variable inline
    // =================================================================

    // § Расширения 4a: sensitive inline → Error
    it("при inline значении sensitive переменной выбрасывает ошибку", () => {
      const declarations: Record<string, VariableDeclaration> = {
        api_token: {
          description: "API token",
          required: true,
          sensitive: true,
          default: null,
        },
      };
      const providedValues: Record<string, string> = {
        api_token: "my-secret-token",
      };

      expect(() => resolvePluginValues(declarations, providedValues, {})).toThrow(
        "Sensitive variable 'api_token' must not be set inline. Use ${env:VAR_NAME} to reference an environment variable.",
      );
    });

    // § Валидация sensitive: значение с ${env:*} допустимо
    it("при значении sensitive переменной с ${env:*} не выбрасывает ошибку", () => {
      const declarations: Record<string, VariableDeclaration> = {
        api_token: {
          description: "API token",
          required: true,
          sensitive: true,
          default: null,
        },
      };
      const providedValues: Record<string, string> = {
        api_token: "${env:API_TOKEN}",
      };
      const env: Record<string, string> = { API_TOKEN: "secret" };

      const result = resolvePluginValues(declarations, providedValues, env);

      expect(result).toEqual({ api_token: "secret" });
    });

    // § Валидация sensitive: значение с prefix-${env:*} допустимо
    it("при значении sensitive переменной с prefix и ${env:*} не выбрасывает ошибку", () => {
      const declarations: Record<string, VariableDeclaration> = {
        api_token: {
          description: "API token",
          required: true,
          sensitive: true,
          default: null,
        },
      };
      const providedValues: Record<string, string> = {
        api_token: "prefix-${env:API_TOKEN}",
      };
      const env: Record<string, string> = { API_TOKEN: "secret" };

      const result = resolvePluginValues(declarations, providedValues, env);

      expect(result).toEqual({ api_token: "prefix-secret" });
    });

    // =================================================================
    // Расширение 7a: undefined env variable
    // =================================================================

    // § Расширения 7a: ${env:NAME} с undefined env → Error
    it("при undefined переменной окружения в значении выбрасывает ошибку", () => {
      const declarations: Record<string, VariableDeclaration> = {
        base_url: {
          description: "Base URL",
          required: false,
          sensitive: false,
          default: "${env:MISSING_URL}",
        },
      };

      expect(() => resolvePluginValues(declarations, null, {})).toThrow(
        "Undefined environment variable: 'MISSING_URL' in value for variable 'base_url'.",
      );
    });

    // § Расширения 7a: ${env:NAME} в providedValues с undefined env → Error
    it("при undefined переменной окружения в providedValues выбрасывает ошибку", () => {
      const declarations: Record<string, VariableDeclaration> = {
        api_url: {
          description: "API URL",
          required: true,
          sensitive: false,
          default: null,
        },
      };
      const providedValues: Record<string, string> = {
        api_url: "${env:API_URL}",
      };

      expect(() => resolvePluginValues(declarations, providedValues, {})).toThrow(
        "Undefined environment variable: 'API_URL' in value for variable 'api_url'.",
      );
    });

    // =================================================================
    // Расширение 8a: required variable not set
    // =================================================================

    // § Расширения 8a: required переменная без значения и без default → Error
    it("при required переменной без значения и без default выбрасывает ошибку", () => {
      const declarations: Record<string, VariableDeclaration> = {
        team_name: {
          description: "Team name",
          required: true,
          sensitive: false,
          default: null,
        },
      };

      expect(() => resolvePluginValues(declarations, null, {})).toThrow(
        "Required plugin variable 'team_name' is not set and has no default.",
      );
    });

    // § Поведение шаг 8: required переменная с default — не выбрасывает ошибку
    it("при required переменной с default не выбрасывает ошибку", () => {
      const declarations: Record<string, VariableDeclaration> = {
        team_name: {
          description: "Team name",
          required: true,
          sensitive: false,
          default: "default-team",
        },
      };

      const result = resolvePluginValues(declarations, null, {});

      expect(result).toEqual({ team_name: "default-team" });
    });

    // =================================================================
    // Граничные условия
    // =================================================================

    // § Поведение шаг 1: declarations не null, providedValues null, нет required → пустая карта
    it("при declarations без defaults и без required и null providedValues возвращает пустую карту", () => {
      const declarations: Record<string, VariableDeclaration> = {
        optional_var: {
          description: "Optional",
          required: false,
          sensitive: false,
          default: null,
        },
      };

      const result = resolvePluginValues(declarations, null, {});

      expect(result).toEqual({});
    });

    // § Граничное условие: пустой providedValues → используются defaults
    it("при пустом providedValues использует defaults из declarations", () => {
      const declarations: Record<string, VariableDeclaration> = {
        lint_command: {
          description: "Lint command",
          required: false,
          sensitive: false,
          default: "pnpm run lint",
        },
      };
      const providedValues: Record<string, string> = {};

      const result = resolvePluginValues(declarations, providedValues, {});

      expect(result).toEqual({ lint_command: "pnpm run lint" });
    });

    // § Граничное условие: множественные ${env:*} в одном значении
    it("интерполирует несколько ${env:*} в одном значении", () => {
      const declarations: Record<string, VariableDeclaration> = {
        full_url: {
          description: "Full URL",
          required: false,
          sensitive: false,
          default: "${env:PROTOCOL}://${env:HOST}:${env:PORT}",
        },
      };
      const env: Record<string, string> = {
        PROTOCOL: "https",
        HOST: "api.example.com",
        PORT: "443",
      };

      const result = resolvePluginValues(declarations, null, env);

      expect(result).toEqual({
        full_url: "https://api.example.com:443",
      });
    });
  });
});
