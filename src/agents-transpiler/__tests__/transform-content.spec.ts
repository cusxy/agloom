// transform-content.spec.ts
// Спецификация: docs/specs/agents-transpiler.md § Трансформация контента

import { describe, it, expect } from "vitest";
import { transformContent } from "../transform-content.js";
import { AgentTransformError } from "../errors.js";

describe("AgentsTranspiler", () => {
  describe("Трансформация контента", () => {
    // --- Happy path: шаги 1–10 — полная трансформация с override ---
    it("выполняет полную трансформацию: парсинг frontmatter, применение override, фильтрация body, сериализация", () => {
      const rawContent = [
        "---",
        "name: code-reviewer",
        "model: sonnet",
        "tools:",
        "  - Read",
        "  - Grep",
        "override:",
        "  opencode:",
        "    model: anthropic/claude-sonnet-4-5",
        "    temperature: 0.1",
        "  claude:",
        "    permissionMode: plan",
        "---",
        "General instructions.",
        "",
        "<!-- agent:claude -->",
        "Claude-specific.",
        "<!-- /agent:claude -->",
      ].join("\n");

      const result = transformContent(rawContent, "opencode");

      // Frontmatter: model заменён, temperature добавлена, override удалён
      expect(result).toContain("model: anthropic/claude-sonnet-4-5");
      expect(result).toContain("temperature: 0.1");
      expect(result).toContain("name: code-reviewer");
      expect(result).toContain("tools:");
      expect(result).not.toContain("override:");

      // Body: claude-секция удалена, общий контент сохранён
      expect(result).toContain("General instructions.");
      expect(result).not.toContain("Claude-specific.");
      expect(result).not.toContain("<!-- agent:");
    });

    // --- Трансформация: шаг 6 — shallow merge заменяет top-level ключи ---
    it("заменяет top-level ключи через shallow merge из override[agentId]", () => {
      const rawContent = [
        "---",
        "name: code-reviewer",
        "model: sonnet",
        "tools:",
        "  - Read",
        "  - Grep",
        "override:",
        "  opencode:",
        "    model: anthropic/claude-sonnet-4-5",
        "---",
        "Body.",
      ].join("\n");

      const result = transformContent(rawContent, "opencode");

      expect(result).toContain("model: anthropic/claude-sonnet-4-5");
      expect(result).not.toContain("model: sonnet");
    });

    // --- Трансформация: shallow merge — добавление нового ключа из override ---
    it("добавляет новый top-level ключ из override[agentId], если он отсутствует в базовых полях", () => {
      const rawContent = [
        "---",
        "name: code-reviewer",
        "model: sonnet",
        "override:",
        "  claude:",
        "    permissionMode: plan",
        "---",
        "Body.",
      ].join("\n");

      const result = transformContent(rawContent, "claude");

      expect(result).toContain("permissionMode: plan");
      expect(result).toContain("name: code-reviewer");
      expect(result).toContain("model: sonnet");
      expect(result).not.toContain("override:");
    });

    // --- Трансформация: shallow merge заменяет массив целиком (не deep merge) ---
    it("заменяет массив целиком при shallow merge (не deep merge)", () => {
      const rawContent = [
        "---",
        "name: agent",
        "tools:",
        "  - Read",
        "  - Grep",
        "override:",
        "  claude:",
        "    tools:",
        "      - Write",
        "---",
        "Body.",
      ].join("\n");

      const result = transformContent(rawContent, "claude");

      // tools должен содержать только Write, не Read/Grep
      expect(result).toContain("Write");
      expect(result).not.toMatch(/- Read/);
      expect(result).not.toMatch(/- Grep/);
    });

    // --- Трансформация: шаг 7 — ключ override удаляется из результата ---
    it("удаляет ключ override из результирующего frontmatter", () => {
      const rawContent = [
        "---",
        "name: agent",
        "override:",
        "  claude:",
        "    extra: value",
        "---",
        "Body.",
      ].join("\n");

      const result = transformContent(rawContent, "claude");

      expect(result).not.toContain("override:");
      expect(result).not.toContain("override");
    });

    // --- Пример из спецификации: результат для agentId = "opencode" ---
    it("трансформирует frontmatter для opencode согласно примеру из спецификации", () => {
      const rawContent = [
        "---",
        "name: code-reviewer",
        "model: sonnet",
        "tools:",
        "  - Read",
        "  - Grep",
        "override:",
        "  opencode:",
        "    model: anthropic/claude-sonnet-4-5",
        "    temperature: 0.1",
        "  claude:",
        "    permissionMode: plan",
        "---",
        "Body content.",
      ].join("\n");

      const result = transformContent(rawContent, "opencode");

      expect(result).toContain("name: code-reviewer");
      expect(result).toContain("model: anthropic/claude-sonnet-4-5");
      expect(result).toContain("temperature: 0.1");
      expect(result).toContain("- Read");
      expect(result).toContain("- Grep");
      expect(result).not.toContain("override:");
      expect(result).not.toContain("permissionMode");
    });

    // --- Пример из спецификации: результат для agentId = "claude" ---
    it("трансформирует frontmatter для claude согласно примеру из спецификации", () => {
      const rawContent = [
        "---",
        "name: code-reviewer",
        "model: sonnet",
        "tools:",
        "  - Read",
        "  - Grep",
        "override:",
        "  opencode:",
        "    model: anthropic/claude-sonnet-4-5",
        "    temperature: 0.1",
        "  claude:",
        "    permissionMode: plan",
        "---",
        "Body content.",
      ].join("\n");

      const result = transformContent(rawContent, "claude");

      expect(result).toContain("name: code-reviewer");
      expect(result).toContain("model: sonnet");
      expect(result).toContain("permissionMode: plan");
      expect(result).toContain("- Read");
      expect(result).toContain("- Grep");
      expect(result).not.toContain("override:");
      expect(result).not.toContain("temperature");
    });

    // --- Расширение 1a: ошибка парсинга frontmatter ---
    it("выбрасывает AgentTransformError при ошибке парсинга frontmatter", () => {
      // Невалидный YAML
      const rawContent = [
        "---",
        "name: agent",
        "  invalid: yaml: content: [broken",
        "---",
        "Body.",
      ].join("\n");

      expect(() => transformContent(rawContent, "claude")).toThrow(
        AgentTransformError,
      );
      expect(() => transformContent(rawContent, "claude")).toThrow(
        /Failed to parse frontmatter/,
      );
    });

    // --- Расширение 2a: ключ override отсутствует → пропустить шаги 3–6 ---
    it("пропускает merge, если ключ override отсутствует в frontmatter", () => {
      const rawContent = [
        "---",
        "name: agent",
        "model: sonnet",
        "---",
        "Body.",
      ].join("\n");

      const result = transformContent(rawContent, "claude");

      expect(result).toContain("name: agent");
      expect(result).toContain("model: sonnet");
      expect(result).not.toContain("override");
      expect(result).toContain("Body.");
    });

    // --- Расширение 3a: значение override не является объектом ---
    it("выбрасывает AgentTransformError, если override не является объектом", () => {
      const rawContent = [
        "---",
        "name: agent",
        "override: not-an-object",
        "---",
        "Body.",
      ].join("\n");

      expect(() => transformContent(rawContent, "claude")).toThrow(
        AgentTransformError,
      );
      expect(() => transformContent(rawContent, "claude")).toThrow(
        "Override must be an object",
      );
    });

    // --- Расширение 4a: ключ agentId отсутствует в override → пропустить merge ---
    it("пропускает merge, если agentId отсутствует в override", () => {
      const rawContent = [
        "---",
        "name: agent",
        "model: sonnet",
        "override:",
        "  opencode:",
        "    model: different",
        "---",
        "Body.",
      ].join("\n");

      const result = transformContent(rawContent, "claude");

      // model остаётся исходным, т.к. для claude нет override
      expect(result).toContain("model: sonnet");
      expect(result).not.toContain("override:");
    });

    // --- Расширение 5a: значение override[agentId] не является объектом ---
    it("выбрасывает AgentTransformError, если override[agentId] не является объектом", () => {
      const rawContent = [
        "---",
        "name: agent",
        "override:",
        "  claude: just-a-string",
        "---",
        "Body.",
      ].join("\n");

      expect(() => transformContent(rawContent, "claude")).toThrow(
        AgentTransformError,
      );
      expect(() => transformContent(rawContent, "claude")).toThrow(
        "Override for 'claude' must be an object",
      );
    });

    // --- Расширение 9a: пустой data после удаления override → без frontmatter ---
    it("опускает frontmatter-разделители, если data пуст после удаления override", () => {
      const rawContent = [
        "---",
        "override:",
        "  claude:",
        "    key: value",
        "---",
        "Body only.",
      ].join("\n");

      // Для agentId = "opencode" нет override, и единственный ключ — override,
      // который удаляется. data становится пустым.
      const result = transformContent(rawContent, "opencode");

      expect(result).not.toContain("---");
      expect(result).toContain("Body only.");
    });

    // --- Расширение 8a: filterBody выбрасывает AgentTransformError → пробросить ---
    it("пробрасывает AgentTransformError от filterBody к вызывающему коду", () => {
      const rawContent = [
        "---",
        "name: agent",
        "---",
        "<!-- agent:claude -->",
        "Content without closing tag.",
      ].join("\n");

      expect(() => transformContent(rawContent, "claude")).toThrow(
        AgentTransformError,
      );
    });

    // --- Трансформация: шаги 8–10 — body интегрируется с frontmatter ---
    it("присоединяет отфильтрованный body к сериализованному frontmatter", () => {
      const rawContent = [
        "---",
        "name: agent",
        "---",
        "General body content.",
        "",
        "<!-- agent:claude -->",
        "Claude section.",
        "<!-- /agent:claude -->",
        "",
        "More general content.",
      ].join("\n");

      const result = transformContent(rawContent, "claude");

      // Должен содержать frontmatter с разделителями
      expect(result).toContain("---");
      expect(result).toContain("name: agent");

      // Должен содержать body с раскрытой claude-секцией
      expect(result).toContain("General body content.");
      expect(result).toContain("Claude section.");
      expect(result).toContain("More general content.");
      expect(result).not.toContain("<!-- agent:");
    });

    // =====================================================================
    // Спецификация: docs/specs/interpolation.md § Расширение transformContent Agents Transpiler
    // =====================================================================

    // --- Новый шаг 11: интерполяция выполняется, когда variables передан ---
    it("выполняет интерполяцию переменных в результате, когда variables передан", () => {
      const rawContent = [
        "---",
        "name: agent",
        "---",
        "Path: ${agloom:AGENTS_DIR}/spec-writer.md",
      ].join("\n");

      const variables: Record<string, string> = {
        AGENTS_DIR: ".claude/agents",
      };

      const result = transformContent(rawContent, "claude", variables);

      expect(result).toContain("Path: .claude/agents/spec-writer.md");
      expect(result).not.toContain("${agloom:AGENTS_DIR}");
    });

    // --- Обратная совместимость: интерполяция пропускается, когда variables не передан ---
    it("пропускает интерполяцию, когда variables не передан (обратная совместимость)", () => {
      const rawContent = [
        "---",
        "name: agent",
        "---",
        "Path: ${agloom:AGENTS_DIR}/spec-writer.md",
      ].join("\n");

      // Без variables — ${agloom:AGENTS_DIR} остаётся как есть
      const result = transformContent(rawContent, "claude");

      expect(result).toContain("${agloom:AGENTS_DIR}");
    });

    // --- Расширение 11a: AgentTransformError при InterpolationError ---
    it('выбрасывает AgentTransformError("Interpolation failed: ...") при ошибке интерполяции', () => {
      const rawContent = [
        "---",
        "name: agent",
        "---",
        "Path: ${agloom:NONEXISTENT}",
      ].join("\n");

      const variables: Record<string, string> = {};

      expect(() => transformContent(rawContent, "claude", variables)).toThrow(
        AgentTransformError,
      );
      expect(() => transformContent(rawContent, "claude", variables)).toThrow(
        /Interpolation failed/,
      );
    });
  });
});
