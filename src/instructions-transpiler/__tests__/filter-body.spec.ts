// filter-body.spec.ts
// Спецификация: docs/specs/instructions-transpiler.md § Фильтрация body

import { describe, it, expect } from "vitest";
import { filterBody } from "../filter-body.js";
import { TransformError } from "../errors.js";

describe("InstructionsTranspiler", () => {
  describe("Фильтрация body", () => {
    // --- Happy path: шаги 1–10 — раскрытие совпадающего agentId, удаление несовпадающих ---
    it("раскрывает секцию совпадающего agentId, удаляет несовпадающие и сохраняет общий контент", () => {
      const body = [
        "General instructions.",
        "",
        "<!-- agent:claude -->",
        "Claude-specific instructions.",
        "<!-- /agent:claude -->",
        "<!-- agent:agentsmd -->",
        "AGENTS.md-specific instructions.",
        "<!-- /agent:agentsmd -->",
        "",
        "More general instructions.",
      ].join("\n");

      const result = filterBody(body, "claude");

      expect(result).toContain("General instructions.");
      expect(result).toContain("Claude-specific instructions.");
      expect(result).not.toContain("AGENTS.md-specific instructions.");
      expect(result).toContain("More general instructions.");
      expect(result).not.toContain("<!-- agent:");
      expect(result).not.toContain("<!-- /agent:");
    });

    // --- Шаг 3: валидация agent-id по паттерну [a-z][a-z0-9-]* ---
    it("выбрасывает TransformError при невалидном agent-id (начинается с цифры)", () => {
      const body = ["Before.", "<!-- agent:1invalid -->", "Content.", "<!-- /agent:1invalid -->", "After."].join("\n");

      expect(() => filterBody(body, "claude")).toThrow(TransformError);
      expect(() => filterBody(body, "claude")).toThrow(/Invalid agent-id '1invalid' in tag at line 2/);
    });

    // --- Расширение 3a: невалидный agent-id с заглавными буквами ---
    it("выбрасывает TransformError при невалидном agent-id с заглавными буквами", () => {
      const body = ["<!-- agent:Claude -->", "Content.", "<!-- /agent:Claude -->"].join("\n");

      expect(() => filterBody(body, "claude")).toThrow(TransformError);
      expect(() => filterBody(body, "claude")).toThrow(/Invalid agent-id 'Claude' in tag at line 1/);
    });

    // --- Расширение 4a: agent-id не входит в allowedAgentIds ---
    it("выбрасывает TransformError, если agent-id не входит в allowedAgentIds", () => {
      const body = [
        "General content.",
        "",
        "<!-- agent:opencode -->",
        "OpenCode content.",
        "<!-- /agent:opencode -->",
      ].join("\n");

      expect(() => filterBody(body, "claude", ["claude", "agentsmd"])).toThrow(TransformError);
      expect(() => filterBody(body, "claude", ["claude", "agentsmd"])).toThrow(
        /Invalid agent-id 'opencode' in instruction file: 'opencode' does not have its own instruction format/,
      );
    });

    // --- Расширение 4a: допустимый agent-id проходит валидацию ---
    it("не выбрасывает ошибку для допустимого agent-id при наличии allowedAgentIds", () => {
      const body = [
        "General content.",
        "",
        "<!-- agent:claude -->",
        "Claude content.",
        "<!-- /agent:claude -->",
        "<!-- agent:agentsmd -->",
        "AGENTS.md content.",
        "<!-- /agent:agentsmd -->",
      ].join("\n");

      expect(() => filterBody(body, "claude", ["claude", "agentsmd"])).not.toThrow();

      const result = filterBody(body, "claude", ["claude", "agentsmd"]);
      expect(result).toContain("Claude content.");
      expect(result).not.toContain("AGENTS.md content.");
    });

    // --- Расширение 4a: allowedAgentIds не передан → валидация не выполняется ---
    it("не выполняет валидацию allowedAgentIds, если параметр не передан", () => {
      const body = ["<!-- agent:opencode -->", "OpenCode content.", "<!-- /agent:opencode -->"].join("\n");

      // Без allowedAgentIds — ошибки быть не должно, даже для "opencode"
      expect(() => filterBody(body, "claude")).not.toThrow();
    });

    // --- Расширение 5a: тег открытия без закрытия ---
    it("выбрасывает TransformError при отсутствии тега закрытия", () => {
      const body = ["Before.", "<!-- agent:claude -->", "Claude content without closing tag."].join("\n");

      expect(() => filterBody(body, "claude")).toThrow(TransformError);
      expect(() => filterBody(body, "claude")).toThrow(/Unmatched opening tag for agent:claude/);
    });

    // --- Расширение 5b: тег закрытия без открытия ---
    it("выбрасывает TransformError при теге закрытия без соответствующего открытия", () => {
      const body = ["Before.", "<!-- /agent:claude -->", "After."].join("\n");

      expect(() => filterBody(body, "claude")).toThrow(TransformError);
      expect(() => filterBody(body, "claude")).toThrow(/Unmatched closing tag for agent:claude/);
    });

    // --- Расширение 5c: несовпадение идентификаторов в тегах ---
    it("выбрасывает TransformError при несовпадении идентификаторов в тегах открытия и закрытия", () => {
      const body = ["<!-- agent:claude -->", "Content.", "<!-- /agent:agentsmd -->"].join("\n");

      expect(() => filterBody(body, "claude")).toThrow(TransformError);
      expect(() => filterBody(body, "claude")).toThrow(
        /Mismatched closing tag: expected agent:claude, got agent:agentsmd/,
      );
    });

    // --- Расширение 6a: вложенные секции ---
    it("выбрасывает TransformError при обнаружении вложенных секций", () => {
      const body = [
        "<!-- agent:claude -->",
        "Outer content.",
        "<!-- agent:agentsmd -->",
        "Nested content.",
        "<!-- /agent:agentsmd -->",
        "<!-- /agent:claude -->",
      ].join("\n");

      expect(() => filterBody(body, "claude")).toThrow(TransformError);
      expect(() => filterBody(body, "claude")).toThrow(
        /Nested agent section detected: agent:agentsmd inside agent:claude/,
      );
    });

    // --- Без agent-specific секций → возвращается без изменений ---
    it("возвращает body без изменений, если agent-specific секции отсутствуют", () => {
      const body = "Just plain content.\n\nNo sections here.";

      const result = filterBody(body, "claude");

      expect(result).toBe(body);
    });

    // --- Дополнительные правила: последовательные пустые строки НЕ схлопываются ---
    it("не схлопывает последовательные пустые строки, образовавшиеся при удалении секций", () => {
      const body = [
        "Before.",
        "",
        "<!-- agent:agentsmd -->",
        "AGENTS.md content.",
        "<!-- /agent:agentsmd -->",
        "",
        "After.",
      ].join("\n");

      const result = filterBody(body, "claude");

      // Должно остаться две пустые строки подряд
      expect(result).toContain("Before.\n\n\nAfter.");
    });

    // --- Синтаксис тегов: пробелы внутри тега допустимы ---
    it("распознаёт теги с дополнительными пробелами между компонентами", () => {
      const body = [
        "Before.",
        "<!--  agent: claude  -->",
        "Claude content.",
        "<!--  /agent: claude  -->",
        "After.",
      ].join("\n");

      const result = filterBody(body, "claude");

      expect(result).toContain("Claude content.");
      expect(result).not.toContain("<!--");
    });

    // --- Дополнительные правила: Markdown code blocks не учитываются ---
    it("обрабатывает теги внутри Markdown code blocks как обычные теги", () => {
      const body = ["```", "<!-- agent:claude -->", "Code block content.", "<!-- /agent:claude -->", "```"].join("\n");

      const result = filterBody(body, "claude");

      expect(result).toContain("Code block content.");
      expect(result).not.toContain("<!-- agent:claude -->");
    });

    // --- Кросс-расширение: валидация 4a с конкретным примером "opencode" ---
    it("выбрасывает TransformError для opencode при allowedAgentIds=['claude','agentsmd'] с правильным сообщением", () => {
      const body = ["<!-- agent:opencode -->", "OpenCode specific.", "<!-- /agent:opencode -->"].join("\n");

      expect(() => filterBody(body, "agentsmd", ["claude", "agentsmd"])).toThrow(TransformError);
      expect(() => filterBody(body, "agentsmd", ["claude", "agentsmd"])).toThrow(
        "Invalid agent-id 'opencode' in instruction file: 'opencode' does not have its own instruction format. Use the corresponding format-specific agent-id instead.",
      );
    });
  });
});
