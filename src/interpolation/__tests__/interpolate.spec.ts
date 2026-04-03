// interpolate.spec.ts
// Спецификация: docs/specs/interpolation.md § Интерполяция контента

import { describe, it, expect } from "vitest";
import { interpolate } from "../interpolate.js";
import { InterpolationError } from "../errors.js";

describe("Interpolation", () => {
  describe("Интерполяция контента", () => {
    // --- Happy path: шаги 1–7 — полная подстановка agloom- и env-переменных ---
    it("подставляет agloom- и env-переменные и обрабатывает escape в многострочном контенте", () => {
      const content = [
        "Root: ${agloom:ROOT_DIR}",
        "Skills: ${agloom:SKILLS_DIR}",
        "Env: ${env:PROJECT_NAME}",
        "Escaped: \\${agloom:ROOT_DIR}",
        "Plain text.",
      ].join("\n");

      const variables: Record<string, string> = {
        ROOT_DIR: ".claude",
        SKILLS_DIR: ".claude/skills",
      };
      const env: Record<string, string> = { PROJECT_NAME: "myapp" };

      const result = interpolate(content, variables, env);

      expect(result).toBe(
        [
          "Root: .claude",
          "Skills: .claude/skills",
          "Env: myapp",
          "Escaped: ${agloom:ROOT_DIR}",
          "Plain text.",
        ].join("\n"),
      );
    });

    // --- Трансформация: шаг 2 — escape \${agloom:NAME} → литерал ${agloom:NAME} ---
    it("заменяет escape \\${agloom:NAME} на литерал ${agloom:NAME}", () => {
      const content = "Value: \\${agloom:ROOT_DIR}";
      const variables: Record<string, string> = { ROOT_DIR: ".claude" };

      const result = interpolate(content, variables, {});

      expect(result).toBe("Value: ${agloom:ROOT_DIR}");
    });

    // --- Трансформация: шаг 3 — escape \${env:NAME} → литерал ${env:NAME} ---
    it("заменяет escape \\${env:NAME} на литерал ${env:NAME}", () => {
      const content = "Home: \\${env:HOME}";
      const variables: Record<string, string> = {};

      const result = interpolate(content, variables, {});

      expect(result).toBe("Home: ${env:HOME}");
    });

    // --- Трансформация: шаг 4 — подстановка ${agloom:NAME} из variables ---
    it("подставляет значение agloom-переменной из карты variables", () => {
      const content = "Dir: ${agloom:AGENTS_DIR}";
      const variables: Record<string, string> = {
        AGENTS_DIR: ".claude/agents",
      };

      const result = interpolate(content, variables, {});

      expect(result).toBe("Dir: .claude/agents");
    });

    // --- Трансформация: шаг 4 — несколько agloom-переменных в одной строке ---
    it("подставляет несколько agloom-переменных в одной строке", () => {
      const content = "From ${agloom:AGLOOM_DIR} to ${agloom:ROOT_DIR}";
      const variables: Record<string, string> = {
        AGLOOM_DIR: ".agloom",
        ROOT_DIR: ".claude",
      };

      const result = interpolate(content, variables, {});

      expect(result).toBe("From .agloom to .claude");
    });

    // --- Трансформация: шаг 5 — подстановка ${env:NAME} из env ---
    it("подставляет значение переменной окружения из env", () => {
      const content = "Project: ${env:PROJECT_NAME}";
      const env: Record<string, string> = { PROJECT_NAME: "agloom" };

      const result = interpolate(content, {}, env);

      expect(result).toBe("Project: agloom");
    });

    // --- Трансформация: шаг 5 — использует process.env по умолчанию, если env не передан ---
    it("использует process.env по умолчанию, если параметр env не передан", () => {
      const envKey = "__AGLOOM_TEST_INTERPOLATE_DEFAULT_ENV__";
      process.env[envKey] = "test-value-from-process-env";

      try {
        const content = `Value: \${env:${envKey}}`;
        const result = interpolate(content, {});

        expect(result).toBe("Value: test-value-from-process-env");
      } finally {
        delete process.env[envKey];
      }
    });

    // --- Трансформация: шаг 6 — текст без паттернов сохраняется без изменений ---
    it("сохраняет текст без паттернов интерполяции без изменений", () => {
      const content = "Just plain text.\nNo variables here.\n";

      const result = interpolate(content, {}, {});

      expect(result).toBe(content);
    });

    // --- Трансформация: шаг 6 — паттерны с другими namespace не обрабатываются ---
    it("сохраняет паттерны с неизвестным namespace как литеральный текст", () => {
      const content = "Unknown: ${foo:bar} and ${custom:value}";

      const result = interpolate(content, {}, {});

      expect(result).toBe("Unknown: ${foo:bar} and ${custom:value}");
    });

    // --- Трансформация: шаг 1 — рекурсивная интерполяция не выполняется ---
    it("не выполняет рекурсивную интерполяцию (значение переменной содержит ${...})", () => {
      const content = "Value: ${agloom:VAR}";
      const variables: Record<string, string> = {
        VAR: "${agloom:OTHER}",
        OTHER: "should-not-appear",
      };

      const result = interpolate(content, variables, {});

      // Должно подставить "${agloom:OTHER}" как есть, без повторной подстановки
      expect(result).toBe("Value: ${agloom:OTHER}");
    });

    // --- Расширение 4a: InterpolationError при неизвестной agloom-переменной ---
    it('выбрасывает InterpolationError "Unknown agloom variable: {NAME}" при неизвестной переменной', () => {
      const content = "Value: ${agloom:NONEXISTENT}";
      const variables: Record<string, string> = {};

      expect(() => interpolate(content, variables, {})).toThrow(
        InterpolationError,
      );
      expect(() => interpolate(content, variables, {})).toThrow(
        "Unknown agloom variable: NONEXISTENT",
      );
    });

    // --- Расширение 5a: InterpolationError при неопределённой переменной окружения ---
    it('выбрасывает InterpolationError "Undefined environment variable: {NAME}" при отсутствующей env-переменной', () => {
      const content = "Value: ${env:MISSING_VAR}";
      const env: Record<string, string> = {};

      expect(() => interpolate(content, {}, env)).toThrow(InterpolationError);
      expect(() => interpolate(content, {}, env)).toThrow(
        "Undefined environment variable: MISSING_VAR",
      );
    });

    // --- Расширение 5a: InterpolationError при значении undefined в env ---
    it("выбрасывает InterpolationError, когда значение переменной окружения равно undefined", () => {
      const content = "Value: ${env:UNDEF_VAR}";
      const env: Record<string, string | undefined> = {
        UNDEF_VAR: undefined,
      };

      expect(() => interpolate(content, {}, env)).toThrow(InterpolationError);
      expect(() => interpolate(content, {}, env)).toThrow(
        "Undefined environment variable: UNDEF_VAR",
      );
    });

    // --- Трансформация: композиция PROJECT_DIR с другими переменными ---
    it("подставляет композицию ${agloom:PROJECT_DIR}/${agloom:SKILLS_DIR} как абсолютный путь к skills", () => {
      const content = "Skills: ${agloom:PROJECT_DIR}/${agloom:SKILLS_DIR}";
      const variables: Record<string, string> = {
        PROJECT_DIR: "/home/user/myapp",
        SKILLS_DIR: ".claude/skills",
      };

      const result = interpolate(content, variables, {});

      expect(result).toBe("Skills: /home/user/myapp/.claude/skills");
    });

    // --- Трансформация: композиция PROJECT_DIR с AGLOOM_DIR ---
    it("подставляет композицию ${agloom:PROJECT_DIR}/${agloom:AGLOOM_DIR} как абсолютный путь к .agloom", () => {
      const content = "Agloom: ${agloom:PROJECT_DIR}/${agloom:AGLOOM_DIR}";
      const variables: Record<string, string> = {
        PROJECT_DIR: "/home/user/myapp",
        AGLOOM_DIR: ".agloom",
      };

      const result = interpolate(content, variables, {});

      expect(result).toBe("Agloom: /home/user/myapp/.agloom");
    });

    // --- Пример из спецификации: трансформация для адаптера claude (с PROJECT_DIR) ---
    it("трансформирует контент для адаптера claude согласно примеру из спецификации", () => {
      const content = [
        "| agent-protocol | `${agloom:AGLOOM_DIR}/docs/cycling/agent-protocol.md` |",
        "| spec-writer | `${agloom:AGENTS_DIR}/spec-writer/spec-writer.md` |",
        "| skills-abs | `${agloom:PROJECT_DIR}/${agloom:SKILLS_DIR}` |",
        "Env: ${env:PROJECT_NAME}",
        "Escaped: \\${env:HOME}",
      ].join("\n");

      const variables: Record<string, string> = {
        AGLOOM_DIR: ".agloom",
        AGENTS_DIR: ".claude/agents",
        PROJECT_DIR: "/home/user/myapp",
        SKILLS_DIR: ".claude/skills",
      };
      const env: Record<string, string> = { PROJECT_NAME: "myapp" };

      const result = interpolate(content, variables, env);

      expect(result).toBe(
        [
          "| agent-protocol | `.agloom/docs/cycling/agent-protocol.md` |",
          "| spec-writer | `.claude/agents/spec-writer/spec-writer.md` |",
          "| skills-abs | `/home/user/myapp/.claude/skills` |",
          "Env: myapp",
          "Escaped: ${env:HOME}",
        ].join("\n"),
      );
    });

    // --- Пример из спецификации: трансформация для адаптера opencode (с PROJECT_DIR) ---
    it("трансформирует контент для адаптера opencode согласно примеру из спецификации", () => {
      const content = [
        "| agent-protocol | `${agloom:AGLOOM_DIR}/docs/cycling/agent-protocol.md` |",
        "| spec-writer | `${agloom:AGENTS_DIR}/spec-writer/spec-writer.md` |",
        "| skills-abs | `${agloom:PROJECT_DIR}/${agloom:SKILLS_DIR}` |",
        "Env: ${env:PROJECT_NAME}",
        "Escaped: \\${env:HOME}",
      ].join("\n");

      const variables: Record<string, string> = {
        AGLOOM_DIR: ".agloom",
        AGENTS_DIR: ".opencode/agents",
        PROJECT_DIR: "/home/user/myapp",
        SKILLS_DIR: ".opencode/skills",
      };
      const env: Record<string, string> = { PROJECT_NAME: "myapp" };

      const result = interpolate(content, variables, env);

      expect(result).toBe(
        [
          "| agent-protocol | `.agloom/docs/cycling/agent-protocol.md` |",
          "| spec-writer | `.opencode/agents/spec-writer/spec-writer.md` |",
          "| skills-abs | `/home/user/myapp/.opencode/skills` |",
          "Env: myapp",
          "Escaped: ${env:HOME}",
        ].join("\n"),
      );
    });

    // --- Синтаксис: NAME — один или более символов, не содержащих } ---
    it("поддерживает NAME с любыми символами кроме }", () => {
      const content = "Value: ${agloom:MY_COMPLEX-NAME.123}";
      const variables: Record<string, string> = {
        "MY_COMPLEX-NAME.123": "resolved",
      };

      const result = interpolate(content, variables, {});

      expect(result).toBe("Value: resolved");
    });
  });
});
