// interpolate-values.spec.ts
// Спецификация: docs/specs/plugin-values.md § Расширение namespace интерполяции
// Спецификация: docs/specs/plugin-values.md § Расширение функции interpolate

import { describe, it, expect } from "vitest";
import { interpolate } from "../interpolate.js";
import { InterpolationError } from "../errors.js";

describe("Interpolation", () => {
  // =====================================================================
  // § plugin-values.md § Расширение функции interpolate
  // Поддержка namespace ${values:NAME} в интерполяции.
  // =====================================================================
  describe("Расширение интерполяции — namespace values", () => {
    // =================================================================
    // Happy path: шаг 7 — подстановка ${values:NAME}
    // =================================================================

    // § Поведение шаг 7: подстановка ${values:NAME} из карты values
    it("подставляет значение ${values:NAME} из карты values", () => {
      const content = "Team: ${values:team_name}";
      const variables: Record<string, string> = {};
      const env: Record<string, string> = {};
      const values: Record<string, string> = { team_name: "platform" };

      const result = interpolate(content, variables, env, values);

      expect(result).toBe("Team: platform");
    });

    // § Поведение шаг 7: несколько ${values:*} в одной строке
    it("подставляет несколько ${values:*} в одной строке", () => {
      const content =
        "Team: ${values:team_name}, Command: ${values:lint_command}";
      const values: Record<string, string> = {
        team_name: "platform",
        lint_command: "pnpm run lint",
      };

      const result = interpolate(content, {}, {}, values);

      expect(result).toBe("Team: platform, Command: pnpm run lint");
    });

    // § Поведение шаги 6-7: escape \${values:NAME} → литерал ${values:NAME}
    it("заменяет escape \\${values:NAME} на литерал ${values:NAME}", () => {
      const content = "Escaped: \\${values:team_name}";
      const values: Record<string, string> = { team_name: "platform" };

      const result = interpolate(content, {}, {}, values);

      expect(result).toBe("Escaped: ${values:team_name}");
    });

    // § Поведение: комбинация agloom, env и values в одном контенте
    it("подставляет agloom, env и values переменные в одном контенте", () => {
      const content = [
        "Root: ${agloom:ROOT_DIR}",
        "Env: ${env:PROJECT_NAME}",
        "Team: ${values:team_name}",
        "Escaped: \\${values:team_name}",
      ].join("\n");

      const variables: Record<string, string> = { ROOT_DIR: ".claude" };
      const env: Record<string, string> = { PROJECT_NAME: "myapp" };
      const values: Record<string, string> = { team_name: "platform" };

      const result = interpolate(content, variables, env, values);

      expect(result).toBe(
        [
          "Root: .claude",
          "Env: myapp",
          "Team: platform",
          "Escaped: ${values:team_name}",
        ].join("\n"),
      );
    });

    // =================================================================
    // Расширение 7a: unknown values variable
    // =================================================================

    // § Расширения 7a: NAME не найден в values → InterpolationError
    it('выбрасывает InterpolationError "Unknown values variable: {NAME}" при неизвестной переменной', () => {
      const content = "Value: ${values:nonexistent}";

      expect(() => interpolate(content, {}, {}, {})).toThrow(
        InterpolationError,
      );
      expect(() => interpolate(content, {}, {}, {})).toThrow(
        "Unknown values variable: nonexistent",
      );
    });

    // § Расширения 7a: values не передан (undefined/default) → InterpolationError
    it("выбрасывает InterpolationError при использовании ${values:*} без передачи values", () => {
      const content = "Value: ${values:team_name}";

      expect(() => interpolate(content, {}, {})).toThrow(InterpolationError);
      expect(() => interpolate(content, {}, {})).toThrow(
        "Unknown values variable: team_name",
      );
    });

    // =================================================================
    // Обратная совместимость
    // =================================================================

    // § Обратная совместимость: при пустой карте values, контент без ${values:*} — без изменений
    it("при пустой карте values и контенте без ${values:*} возвращает контент без изменений", () => {
      const content = "Root: ${agloom:ROOT_DIR}, Env: ${env:NAME}";
      const variables: Record<string, string> = { ROOT_DIR: ".claude" };
      const env: Record<string, string> = { NAME: "myapp" };

      const result = interpolate(content, variables, env, {});

      expect(result).toBe("Root: .claude, Env: myapp");
    });

    // § Обратная совместимость: без параметра values — существующее поведение сохраняется
    it("без параметра values существующие agloom и env переменные работают как прежде", () => {
      const content = "Root: ${agloom:ROOT_DIR}";
      const variables: Record<string, string> = { ROOT_DIR: ".claude" };

      const result = interpolate(content, variables, {});

      expect(result).toBe("Root: .claude");
    });

    // =================================================================
    // Граничные условия
    // =================================================================

    // § Синтаксис: NAME — один или более символов, не содержащих }
    it("поддерживает NAME с любыми символами кроме } в values", () => {
      const content = "Value: ${values:MY_COMPLEX-NAME.123}";
      const values: Record<string, string> = {
        "MY_COMPLEX-NAME.123": "resolved",
      };

      const result = interpolate(content, {}, {}, values);

      expect(result).toBe("Value: resolved");
    });

    // § Рекурсивная интерполяция не выполняется для values
    it("не выполняет рекурсивную интерполяцию для values (значение содержит ${...})", () => {
      const content = "Value: ${values:var}";
      const values: Record<string, string> = {
        var: "${values:other}",
        other: "should-not-appear",
      };

      const result = interpolate(content, {}, {}, values);

      expect(result).toBe("Value: ${values:other}");
    });

    // § Изоляция per-plugin: каждый плагин получает только свои resolved values
    // Этот тест проверяет, что при вызове interpolate с конкретным набором values
    // только эти values доступны — другие вызовут ошибку
    it("при отсутствии ключа в переданных values выбрасывает ошибку (изоляция per-plugin)", () => {
      const content = "Team A: ${values:team_a}, Team B: ${values:team_b}";
      const valuesPluginA: Record<string, string> = { team_a: "alpha" };

      // Plugin A не имеет доступа к team_b
      expect(() => interpolate(content, {}, {}, valuesPluginA)).toThrow(
        "Unknown values variable: team_b",
      );
    });
  });
});
