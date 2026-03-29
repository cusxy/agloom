// transform-content.spec.ts
// Спецификация: docs/specs/instructions-transpiler.md § Трансформация контента

import { describe, it, expect } from "vitest";
import { transformContent } from "../transform-content.js";
import { TransformError } from "../errors.js";

describe("InstructionsTranspiler", () => {
  describe("Трансформация контента", () => {
    // --- Happy path: шаги 1–10 — полная трансформация с override ---
    it("выполняет полную трансформацию: парсинг frontmatter, применение override, фильтрация body, сериализация", () => {
      const rawContent = [
        "---",
        "title: Project Instructions",
        "priority: high",
        "override:",
        "  claude:",
        "    priority: critical",
        "    extra: value",
        "---",
        "General instructions.",
        "",
        "<!-- agent:claude -->",
        "Claude-specific.",
        "<!-- /agent:claude -->",
      ].join("\n");

      const result = transformContent(rawContent, "claude");

      // Frontmatter: priority заменён, extra добавлен, override удалён
      expect(result).toContain("priority: critical");
      expect(result).toContain("extra: value");
      expect(result).toContain("title: Project Instructions");
      expect(result).not.toContain("override:");

      // Body: claude-секция раскрыта, общий контент сохранён
      expect(result).toContain("General instructions.");
      expect(result).toContain("Claude-specific.");
      expect(result).not.toContain("<!-- agent:");
    });

    // --- Трансформация: шаг 6 — shallow merge заменяет top-level ключи ---
    it("заменяет top-level ключи через shallow merge из override[agentId]", () => {
      const rawContent = [
        "---",
        "title: Instructions",
        "version: 1",
        "override:",
        "  agentsmd:",
        "    version: 2",
        "---",
        "Body.",
      ].join("\n");

      const result = transformContent(rawContent, "agentsmd");

      expect(result).toContain("version: 2");
      expect(result).not.toMatch(/version: 1/);
    });

    // --- Трансформация: shallow merge — добавление нового ключа ---
    it("добавляет новый top-level ключ из override[agentId], если он отсутствует в базовых полях", () => {
      const rawContent = [
        "---",
        "title: Instructions",
        "override:",
        "  claude:",
        "    newField: newValue",
        "---",
        "Body.",
      ].join("\n");

      const result = transformContent(rawContent, "claude");

      expect(result).toContain("newField: newValue");
      expect(result).toContain("title: Instructions");
      expect(result).not.toContain("override:");
    });

    // --- Трансформация: shallow merge заменяет массив целиком (не deep merge) ---
    it("заменяет массив целиком при shallow merge (не deep merge)", () => {
      const rawContent = [
        "---",
        "title: Instructions",
        "tags:",
        "  - general",
        "  - shared",
        "override:",
        "  claude:",
        "    tags:",
        "      - claude-specific",
        "---",
        "Body.",
      ].join("\n");

      const result = transformContent(rawContent, "claude");

      expect(result).toContain("claude-specific");
      expect(result).not.toMatch(/- general/);
      expect(result).not.toMatch(/- shared/);
    });

    // --- Трансформация: шаг 7 — ключ override удаляется из результата ---
    it("удаляет ключ override из результирующего frontmatter", () => {
      const rawContent = [
        "---",
        "title: Instructions",
        "override:",
        "  claude:",
        "    extra: value",
        "---",
        "Body.",
      ].join("\n");

      const result = transformContent(rawContent, "claude");

      expect(result).not.toContain("override:");
      expect(result).not.toMatch(/\boverride\b/);
    });

    // --- Трансформация: шаг 8 — вызов filterBody с allowedAgentIds ---
    it("передаёт allowedAgentIds в filterBody при трансформации", () => {
      const rawContent = [
        "---",
        "title: Instructions",
        "---",
        "General content.",
        "",
        "<!-- agent:opencode -->",
        "OpenCode content.",
        "<!-- /agent:opencode -->",
      ].join("\n");

      // "opencode" не входит в allowedAgentIds — должна быть ошибка TransformError
      expect(() =>
        transformContent(rawContent, "claude", ["claude", "agentsmd"]),
      ).toThrow(TransformError);
      expect(() =>
        transformContent(rawContent, "claude", ["claude", "agentsmd"]),
      ).toThrow(/Invalid agent-id 'opencode'/);
    });

    // --- Расширение 1a: ошибка парсинга frontmatter ---
    it("выбрасывает TransformError при ошибке парсинга frontmatter", () => {
      const rawContent = [
        "---",
        "title: Instructions",
        "  invalid: yaml: content: [broken",
        "---",
        "Body.",
      ].join("\n");

      expect(() => transformContent(rawContent, "claude")).toThrow(
        TransformError,
      );
      expect(() => transformContent(rawContent, "claude")).toThrow(
        /Failed to parse frontmatter/,
      );
    });

    // --- Расширение 2a: ключ override отсутствует → пропустить шаги 3–6 ---
    it("пропускает merge, если ключ override отсутствует в frontmatter", () => {
      const rawContent = [
        "---",
        "title: Instructions",
        "version: 1",
        "---",
        "Body.",
      ].join("\n");

      const result = transformContent(rawContent, "claude");

      expect(result).toContain("title: Instructions");
      expect(result).toContain("version: 1");
      expect(result).not.toContain("override");
      expect(result).toContain("Body.");
    });

    // --- Расширение 3a: значение override не является объектом ---
    it("выбрасывает TransformError, если override не является объектом", () => {
      const rawContent = [
        "---",
        "title: Instructions",
        "override: not-an-object",
        "---",
        "Body.",
      ].join("\n");

      expect(() => transformContent(rawContent, "claude")).toThrow(
        TransformError,
      );
      expect(() => transformContent(rawContent, "claude")).toThrow(
        "Override must be an object",
      );
    });

    // --- Расширение 4a: ключ agentId отсутствует в override → пропустить merge ---
    it("пропускает merge, если agentId отсутствует в override", () => {
      const rawContent = [
        "---",
        "title: Instructions",
        "version: 1",
        "override:",
        "  agentsmd:",
        "    version: 2",
        "---",
        "Body.",
      ].join("\n");

      const result = transformContent(rawContent, "claude");

      // version остаётся исходным, т.к. для claude нет override
      expect(result).toContain("version: 1");
      expect(result).not.toContain("override:");
    });

    // --- Расширение 5a: значение override[agentId] не является объектом ---
    it("выбрасывает TransformError, если override[agentId] не является объектом", () => {
      const rawContent = [
        "---",
        "title: Instructions",
        "override:",
        "  claude: just-a-string",
        "---",
        "Body.",
      ].join("\n");

      expect(() => transformContent(rawContent, "claude")).toThrow(
        TransformError,
      );
      expect(() => transformContent(rawContent, "claude")).toThrow(
        "Override for 'claude' must be an object",
      );
    });

    // --- Расширение 8a: filterBody выбрасывает TransformError → пробросить ---
    it("пробрасывает TransformError от filterBody к вызывающему коду", () => {
      const rawContent = [
        "---",
        "title: Instructions",
        "---",
        "<!-- agent:claude -->",
        "Content without closing tag.",
      ].join("\n");

      expect(() => transformContent(rawContent, "claude")).toThrow(
        TransformError,
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

      // Для agentId = "agentsmd" нет override, и единственный ключ — override,
      // который удаляется. data становится пустым.
      const result = transformContent(rawContent, "agentsmd");

      expect(result).not.toContain("---");
      expect(result).toContain("Body only.");
    });

    // --- Трансформация: шаги 9–10 — body интегрируется с frontmatter ---
    it("присоединяет отфильтрованный body к сериализованному frontmatter", () => {
      const rawContent = [
        "---",
        "title: Instructions",
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
      expect(result).toContain("title: Instructions");

      // Должен содержать body с раскрытой claude-секцией
      expect(result).toContain("General body content.");
      expect(result).toContain("Claude section.");
      expect(result).toContain("More general content.");
      expect(result).not.toContain("<!-- agent:");
    });

    // --- Без frontmatter: файл без YAML frontmatter ---
    it("обрабатывает файл без YAML frontmatter (только body)", () => {
      const rawContent = "Just plain instructions.\n\nNo frontmatter here.";

      const result = transformContent(rawContent, "claude");

      expect(result).toBe(rawContent);
    });

    // --- allowedAgentIds не передан → валидация не выполняется ---
    it("не выполняет валидацию allowedAgentIds, если параметр не передан", () => {
      const rawContent = [
        "---",
        "title: Instructions",
        "---",
        "<!-- agent:opencode -->",
        "OpenCode content.",
        "<!-- /agent:opencode -->",
      ].join("\n");

      // Без allowedAgentIds — ошибки быть не должно
      expect(() => transformContent(rawContent, "claude")).not.toThrow();
    });

    // =====================================================================
    // Спецификация: docs/specs/interpolation.md § Расширение transformContent Instructions Transpiler
    // =====================================================================

    // --- Новый шаг 11: интерполяция выполняется, когда variables передан ---
    it("выполняет интерполяцию переменных в результате, когда variables передан", () => {
      const rawContent = [
        "---",
        "title: Instructions",
        "---",
        "Path: ${agloom:ROOT_DIR}/agents",
      ].join("\n");

      const variables: Record<string, string> = { ROOT_DIR: ".claude" };

      const result = transformContent(
        rawContent,
        "claude",
        undefined,
        variables,
      );

      expect(result).toContain("Path: .claude/agents");
      expect(result).not.toContain("${agloom:ROOT_DIR}");
    });

    // --- Обратная совместимость: интерполяция пропускается, когда variables не передан ---
    it("пропускает интерполяцию, когда variables не передан (обратная совместимость)", () => {
      const rawContent = [
        "---",
        "title: Instructions",
        "---",
        "Path: ${agloom:ROOT_DIR}/agents",
      ].join("\n");

      // Без variables — ${agloom:ROOT_DIR} остаётся как есть
      const result = transformContent(rawContent, "claude");

      expect(result).toContain("${agloom:ROOT_DIR}");
    });

    // --- Расширение 11a: TransformError при InterpolationError ---
    it('выбрасывает TransformError("Interpolation failed: ...") при ошибке интерполяции', () => {
      const rawContent = [
        "---",
        "title: Instructions",
        "---",
        "Path: ${agloom:NONEXISTENT}",
      ].join("\n");

      const variables: Record<string, string> = {};

      expect(() =>
        transformContent(rawContent, "claude", undefined, variables),
      ).toThrow(TransformError);
      expect(() =>
        transformContent(rawContent, "claude", undefined, variables),
      ).toThrow(/Interpolation failed/);
    });
  });
});
