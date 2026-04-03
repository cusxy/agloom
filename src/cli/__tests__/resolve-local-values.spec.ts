// resolve-local-values.spec.ts
// Спецификация: docs/specs/plugin-values.md § Процедура Resolve Local Values
// Спецификация: docs/specs/plugin-values.md § Resolution chain для config variables

import { describe, it, expect } from "vitest";
import { resolveLocalValues } from "../resolve-plugin-values.js";
import type { VariableDeclaration } from "../plugin-manifest.js";

describe("CLI", () => {
  // =====================================================================
  // § plugin-values.md § Процедура Resolve Local Values
  // Резолвинг значений переменных локального проекта из config.yml.
  // =====================================================================
  describe("Процедура Resolve Local Values", () => {
    // =================================================================
    // Happy path: шаги 1-6
    // =================================================================

    // § Поведение шаг 1: declarations null → пустая карта
    it("при null declarations возвращает пустую карту", () => {
      const result = resolveLocalValues(null, {});

      expect(result).toEqual({});
    });

    // § Поведение шаги 2-6: полный цикл резолвинга с defaults
    it("при наличии declarations с defaults возвращает resolved values", () => {
      const declarations: Record<string, VariableDeclaration> = {
        project_name: {
          description: "",
          required: false,
          sensitive: false,
          default: "my-project",
        },
        team: {
          description: "Team name",
          required: false,
          sensitive: false,
          default: "platform",
        },
      };

      const result = resolveLocalValues(declarations, {});

      expect(result).toEqual({
        project_name: "my-project",
        team: "platform",
      });
    });

    // § Поведение шаг 4: интерполяция ${env:*} в defaults
    it("интерполирует ${env:*} в значениях default", () => {
      const declarations: Record<string, VariableDeclaration> = {
        project_name: {
          description: "",
          required: false,
          sensitive: false,
          default: "${env:PROJECT_NAME}",
        },
      };
      const env: Record<string, string> = { PROJECT_NAME: "agloom" };

      const result = resolveLocalValues(declarations, env);

      expect(result).toEqual({ project_name: "agloom" });
    });

    // § Результат: переменные без default и без required отсутствуют в карте
    it("переменные без default и без required: true отсутствуют в результате", () => {
      const declarations: Record<string, VariableDeclaration> = {
        optional_var: {
          description: "Optional",
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

      const result = resolveLocalValues(declarations, {});

      expect(result).toEqual({ with_default: "value" });
      expect("optional_var" in result).toBe(false);
    });

    // =================================================================
    // Расширение 4a: undefined env variable
    // =================================================================

    // § Расширения 4a: ${env:NAME} с undefined env → Error
    it("при undefined переменной окружения в default выбрасывает ошибку", () => {
      const declarations: Record<string, VariableDeclaration> = {
        api_key: {
          description: "API key",
          required: false,
          sensitive: true,
          default: "${env:MISSING_KEY}",
        },
      };

      expect(() => resolveLocalValues(declarations, {})).toThrow(
        "Undefined environment variable: 'MISSING_KEY' in value for variable 'api_key'.",
      );
    });

    // =================================================================
    // Расширение 5a: required variable not set
    // =================================================================

    // § Расширения 5a: required переменная без default → Error
    it("при required переменной без default выбрасывает ошибку", () => {
      const declarations: Record<string, VariableDeclaration> = {
        project_name: {
          description: "Project name",
          required: true,
          sensitive: false,
          default: null,
        },
      };

      expect(() => resolveLocalValues(declarations, {})).toThrow(
        "Required config variable 'project_name' is not set and has no default.",
      );
    });

    // § Поведение шаг 5: required переменная с default — не выбрасывает ошибку
    it("при required переменной с default не выбрасывает ошибку", () => {
      const declarations: Record<string, VariableDeclaration> = {
        project_name: {
          description: "Project name",
          required: true,
          sensitive: false,
          default: "default-project",
        },
      };

      const result = resolveLocalValues(declarations, {});

      expect(result).toEqual({ project_name: "default-project" });
    });

    // =================================================================
    // Граничные условия
    // =================================================================

    // § Граничное условие: пустой объект declarations → пустая карта
    it("при пустом объекте declarations возвращает пустую карту", () => {
      const result = resolveLocalValues({}, {});

      expect(result).toEqual({});
    });

    // § Граничное условие: множественные ${env:*} в одном default
    it("интерполирует несколько ${env:*} в одном значении default", () => {
      const declarations: Record<string, VariableDeclaration> = {
        connection_string: {
          description: "DB connection",
          required: false,
          sensitive: true,
          default: "${env:DB_USER}:${env:DB_PASS}@${env:DB_HOST}",
        },
      };
      const env: Record<string, string> = {
        DB_USER: "admin",
        DB_PASS: "secret",
        DB_HOST: "localhost",
      };

      const result = resolveLocalValues(declarations, env);

      expect(result).toEqual({
        connection_string: "admin:secret@localhost",
      });
    });
  });
});
