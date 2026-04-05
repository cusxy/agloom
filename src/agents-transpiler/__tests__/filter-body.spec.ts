// filter-body.spec.ts
// Спецификация: docs/specs/agents-transpiler.md § Фильтрация body

import { describe, it, expect } from "vitest";
import { filterBody } from "../filter-body.js";
import { AgentTransformError } from "../errors.js";

describe("AgentsTranspiler", () => {
  describe("Фильтрация body", () => {
    // --- Happy path: шаги 1–8 — пример из спецификации для agentId = "claude" ---
    it("раскрывает секцию совпадающего agentId, удаляет несовпадающие и сохраняет общий контент", () => {
      const body = [
        "General instructions for all agents.",
        "",
        "<!-- agent:claude -->",
        "Claude-specific instructions.",
        "<!-- /agent:claude -->",
        "<!-- agent:opencode -->",
        "OpenCode-specific instructions.",
        "<!-- /agent:opencode -->",
        "",
        "More general instructions.",
      ].join("\n");

      const result = filterBody(body, "claude");

      expect(result).toContain("General instructions for all agents.");
      expect(result).toContain("Claude-specific instructions.");
      expect(result).not.toContain("OpenCode-specific instructions.");
      expect(result).toContain("More general instructions.");
      expect(result).not.toContain("<!-- agent:");
      expect(result).not.toContain("<!-- /agent:");
    });

    // --- Happy path: пример из спецификации для agentId = "opencode" ---
    it("раскрывает секцию opencode, удаляет секцию claude", () => {
      const body = [
        "General instructions for all agents.",
        "",
        "<!-- agent:claude -->",
        "Claude-specific instructions.",
        "<!-- /agent:claude -->",
        "<!-- agent:opencode -->",
        "OpenCode-specific instructions.",
        "<!-- /agent:opencode -->",
        "",
        "More general instructions.",
      ].join("\n");

      const result = filterBody(body, "opencode");

      expect(result).toContain("General instructions for all agents.");
      expect(result).not.toContain("Claude-specific instructions.");
      expect(result).toContain("OpenCode-specific instructions.");
      expect(result).toContain("More general instructions.");
    });

    // --- Шаг 5: удаление строк тегов, сохранение строк контента ---
    it("удаляет строки тегов при раскрытии секции совпадающего agentId", () => {
      const body = [
        "Before.",
        "<!-- agent:claude -->",
        "Inside claude section.",
        "<!-- /agent:claude -->",
        "After.",
      ].join("\n");

      const result = filterBody(body, "claude");

      expect(result).not.toContain("<!-- agent:claude -->");
      expect(result).not.toContain("<!-- /agent:claude -->");
      expect(result).toContain("Inside claude section.");
      expect(result).toContain("Before.");
      expect(result).toContain("After.");
    });

    // --- Шаг 6: удаление строк тегов И контента для несовпадающего agentId ---
    it("удаляет теги и контент для несовпадающего agentId", () => {
      const body = ["Before.", "<!-- agent:opencode -->", "OpenCode only.", "<!-- /agent:opencode -->", "After."].join(
        "\n",
      );

      const result = filterBody(body, "claude");

      expect(result).not.toContain("opencode");
      expect(result).not.toContain("OpenCode only.");
      expect(result).toContain("Before.");
      expect(result).toContain("After.");
    });

    // --- Шаг 7: строки вне секций сохраняются без изменений ---
    it("сохраняет строки вне agent-specific секций без изменений", () => {
      const body = [
        "Line 1.",
        "Line 2.",
        "<!-- agent:claude -->",
        "Claude only.",
        "<!-- /agent:claude -->",
        "Line 3.",
        "Line 4.",
      ].join("\n");

      const result = filterBody(body, "other-agent");

      expect(result).toContain("Line 1.");
      expect(result).toContain("Line 2.");
      expect(result).toContain("Line 3.");
      expect(result).toContain("Line 4.");
      expect(result).not.toContain("Claude only.");
    });

    // --- Без agent-specific секций → возвращается без изменений ---
    it("возвращает body без изменений, если agent-specific секции отсутствуют", () => {
      const body = "Just plain content.\n\nNo sections here.";

      const result = filterBody(body, "claude");

      expect(result).toBe(body);
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

    // --- Синтаксис тегов: табы внутри тега допустимы ---
    it("распознаёт теги с табами между компонентами", () => {
      const body = [
        "Before.",
        "<!--\tagent:\tclaude\t-->",
        "Claude content.",
        "<!--\t/agent:\tclaude\t-->",
        "After.",
      ].join("\n");

      const result = filterBody(body, "claude");

      expect(result).toContain("Claude content.");
      expect(result).not.toContain("<!--");
    });

    // --- Синтаксис тегов: ведущие и завершающие пробелы на строке ---
    it("распознаёт теги с ведущими и завершающими пробелами на строке", () => {
      const body = [
        "Before.",
        "  <!-- agent:claude -->  ",
        "Claude content.",
        "  <!-- /agent:claude -->  ",
        "After.",
      ].join("\n");

      const result = filterBody(body, "claude");

      expect(result).toContain("Claude content.");
      expect(result).not.toContain("<!--");
    });

    // --- Дополнительные правила: последовательные пустые строки НЕ схлопываются ---
    it("не схлопывает последовательные пустые строки, образовавшиеся при удалении секций", () => {
      const body = [
        "Before.",
        "",
        "<!-- agent:opencode -->",
        "OpenCode content.",
        "<!-- /agent:opencode -->",
        "",
        "After.",
      ].join("\n");

      const result = filterBody(body, "claude");

      // Должно остаться две пустые строки подряд (одна до секции, одна после)
      expect(result).toContain("Before.\n\n\nAfter.");
    });

    // --- Множественные секции одного agentId ---
    it("раскрывает все секции совпадающего agentId", () => {
      const body = [
        "General.",
        "<!-- agent:claude -->",
        "First claude section.",
        "<!-- /agent:claude -->",
        "Middle.",
        "<!-- agent:claude -->",
        "Second claude section.",
        "<!-- /agent:claude -->",
        "End.",
      ].join("\n");

      const result = filterBody(body, "claude");

      expect(result).toContain("First claude section.");
      expect(result).toContain("Second claude section.");
      expect(result).toContain("General.");
      expect(result).toContain("Middle.");
      expect(result).toContain("End.");
    });

    // --- Расширение 2a: invalid agent-id (не соответствует [a-z][a-z0-9-]*) ---
    it("выбрасывает AgentTransformError при невалидном agent-id в теге (начинается с цифры)", () => {
      const body = ["Before.", "<!-- agent:1invalid -->", "Content.", "<!-- /agent:1invalid -->", "After."].join("\n");

      expect(() => filterBody(body, "claude")).toThrow(AgentTransformError);
      expect(() => filterBody(body, "claude")).toThrow(/Invalid agent-id '1invalid' in tag at line 2/);
    });

    // --- Расширение 2a: invalid agent-id (содержит заглавные буквы) ---
    it("выбрасывает AgentTransformError при невалидном agent-id с заглавными буквами", () => {
      const body = ["<!-- agent:Claude -->", "Content.", "<!-- /agent:Claude -->"].join("\n");

      expect(() => filterBody(body, "claude")).toThrow(AgentTransformError);
      expect(() => filterBody(body, "claude")).toThrow(/Invalid agent-id 'Claude' in tag at line 1/);
    });

    // --- Расширение 2a: invalid agent-id (содержит подчёркивание) ---
    it("выбрасывает AgentTransformError при невалидном agent-id с подчёркиванием", () => {
      const body = ["<!-- agent:my_agent -->", "Content.", "<!-- /agent:my_agent -->"].join("\n");

      expect(() => filterBody(body, "claude")).toThrow(AgentTransformError);
      expect(() => filterBody(body, "claude")).toThrow(/Invalid agent-id 'my_agent' in tag at line 1/);
    });

    // --- Расширение 3a: тег открытия без закрытия ---
    it("выбрасывает AgentTransformError при отсутствии тега закрытия", () => {
      const body = ["Before.", "<!-- agent:claude -->", "Claude content without closing tag."].join("\n");

      expect(() => filterBody(body, "claude")).toThrow(AgentTransformError);
      expect(() => filterBody(body, "claude")).toThrow(/Unmatched opening tag for agent:claude/);
    });

    // --- Расширение 3b: тег закрытия без открытия ---
    it("выбрасывает AgentTransformError при теге закрытия без соответствующего открытия", () => {
      const body = ["Before.", "<!-- /agent:claude -->", "After."].join("\n");

      expect(() => filterBody(body, "claude")).toThrow(AgentTransformError);
      expect(() => filterBody(body, "claude")).toThrow(/Unmatched closing tag for agent:claude/);
    });

    // --- Расширение 3c: несовпадение идентификаторов открытия и закрытия ---
    it("выбрасывает AgentTransformError при несовпадении идентификаторов в тегах открытия и закрытия", () => {
      const body = ["<!-- agent:claude -->", "Content.", "<!-- /agent:opencode -->"].join("\n");

      expect(() => filterBody(body, "claude")).toThrow(AgentTransformError);
      expect(() => filterBody(body, "claude")).toThrow(
        /Mismatched closing tag: expected agent:claude, got agent:opencode/,
      );
    });

    // --- Расширение 4a: вложенные секции ---
    it("выбрасывает AgentTransformError при обнаружении вложенных секций", () => {
      const body = [
        "<!-- agent:claude -->",
        "Outer content.",
        "<!-- agent:opencode -->",
        "Nested content.",
        "<!-- /agent:opencode -->",
        "<!-- /agent:claude -->",
      ].join("\n");

      expect(() => filterBody(body, "claude")).toThrow(AgentTransformError);
      expect(() => filterBody(body, "claude")).toThrow(
        /Nested agent section detected: agent:opencode inside agent:claude/,
      );
    });

    // --- Дополнительные правила: Markdown code blocks не учитываются ---
    it("обрабатывает теги внутри Markdown code blocks как обычные теги (не Markdown-aware)", () => {
      const body = ["```", "<!-- agent:claude -->", "Code block content.", "<!-- /agent:claude -->", "```"].join("\n");

      // Библиотека НЕ учитывает контекст Markdown — тег обрабатывается
      const result = filterBody(body, "claude");

      expect(result).toContain("Code block content.");
      expect(result).not.toContain("<!-- agent:claude -->");
    });
  });
});
