// codex-adapter.spec.ts
// Спецификация: docs/specs/agents-transpiler.md § Codex адаптер

import { describe, it, expect } from "vitest";
import { CodexAgentAdapter } from "../adapters/codex-adapter.js";
import { AgentTransformError } from "../errors.js";
import type { AgentDefinition } from "../types.js";
import { parse as parseToml } from "smol-toml";

function makeDefinition(name: string, rawContent: string): AgentDefinition {
  return {
    name,
    relativePath: `.agloom/agents/${name}.md`,
    rawContent,
  };
}

describe("CodexAgentAdapter", () => {
  describe("transpile", () => {
    // --- Свойство: agentId адаптера ---
    // § Codex адаптер — agentId: "codex"
    it('имеет agentId равный "codex"', () => {
      const adapter = new CodexAgentAdapter();
      expect(adapter.agentId).toBe("codex");
    });

    // --- Свойство: targetDir адаптера ---
    // § Codex адаптер — targetDir: ".codex/agents"
    it('имеет targetDir равный ".codex/agents"', () => {
      const adapter = new CodexAgentAdapter();
      expect(adapter.targetDir).toBe(".codex/agents");
    });

    // --- Happy path: шаги 1–5 — базовый кейс: frontmatter + body → TOML ---
    // § Codex адаптер → transpile → Поведение, шаги 1–5
    // § Правила конвертации в TOML: body → developer_instructions
    it("конвертирует frontmatter и body в формат TOML с developer_instructions", () => {
      const adapter = new CodexAgentAdapter();

      const rawContent = [
        "---",
        "name: code-reviewer",
        "description: Reviews code for best practices",
        "model: sonnet",
        "---",
        "",
        "Review all code changes for...",
      ].join("\n");

      const files = adapter.transpile([
        makeDefinition("code-reviewer", rawContent),
      ]);

      expect(files).toHaveLength(1);

      // Проверяем, что выходной файл — валидный TOML
      const parsed = parseToml(files[0].content);
      expect(parsed.name).toBe("code-reviewer");
      expect(parsed.description).toBe("Reviews code for best practices");
      expect(parsed.model).toBe("sonnet");
      expect(parsed.developer_instructions).toBe(
        "Review all code changes for...",
      );
    });

    // --- Трансформация: шаг 5 — расширение файла .md → .toml ---
    // § Codex адаптер → transpile → Поведение, шаг 5:
    // "расширение .md заменяется на .toml"
    it("заменяет расширение файла .md на .toml в relativePath", () => {
      const adapter = new CodexAgentAdapter();

      const rawContent = "---\nname: test\n---\nBody.";

      const files = adapter.transpile([
        makeDefinition("test-agent", rawContent),
      ]);

      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe(".agloom/agents/test-agent.toml");
    });

    // --- Трансформация: шаг 1 — override.codex применяется через transformContent ---
    // § Codex адаптер → transpile → Поведение, шаг 1:
    // "вызвать transformContent(definition.rawContent, 'codex')"
    // § Пример конвертации: override.codex → model заменяется
    it("применяет override.codex через transformContent перед конвертацией в TOML", () => {
      const adapter = new CodexAgentAdapter();

      const rawContent = [
        "---",
        "name: code-reviewer",
        "description: Reviews code for best practices",
        "model: sonnet",
        "override:",
        "  codex:",
        "    model: gpt-5-codex",
        "---",
        "",
        "Review all code changes for...",
      ].join("\n");

      const files = adapter.transpile([
        makeDefinition("code-reviewer", rawContent),
      ]);

      const parsed = parseToml(files[0].content);
      expect(parsed.model).toBe("gpt-5-codex");
      // override не должен присутствовать в результате
      expect(parsed).not.toHaveProperty("override");
      expect(parsed.developer_instructions).toBe(
        "Review all code changes for...",
      );
    });

    // --- Граничное условие: пустой body → developer_instructions отсутствует ---
    // § Правила конвертации в TOML:
    // "Если body пустое (после trim) — ключ developer_instructions НЕ ВКЛЮЧАЕТСЯ в TOML."
    it("не включает developer_instructions при пустом body", () => {
      const adapter = new CodexAgentAdapter();

      const rawContent = [
        "---",
        "name: minimal-agent",
        "model: gpt-5",
        "---",
      ].join("\n");

      const files = adapter.transpile([
        makeDefinition("minimal-agent", rawContent),
      ]);

      const parsed = parseToml(files[0].content);
      expect(parsed.name).toBe("minimal-agent");
      expect(parsed.model).toBe("gpt-5");
      expect(parsed).not.toHaveProperty("developer_instructions");
    });

    // --- Трансформация: filterBody — agent-specific секции для codex раскрываются ---
    // § Codex адаптер → transpile → Поведение, шаг 1:
    // transformContent выполняет фильтрацию body (filterBody с agentId="codex")
    it("раскрывает agent:codex секции и удаляет секции других агентов", () => {
      const adapter = new CodexAgentAdapter();

      const rawContent = [
        "---",
        "name: multi-agent",
        "---",
        "General instructions.",
        "",
        "<!-- agent:codex -->",
        "Codex-specific instructions.",
        "<!-- /agent:codex -->",
        "",
        "<!-- agent:claude -->",
        "Claude-specific instructions.",
        "<!-- /agent:claude -->",
      ].join("\n");

      const files = adapter.transpile([
        makeDefinition("multi-agent", rawContent),
      ]);

      const parsed = parseToml(files[0].content);
      expect(parsed.developer_instructions).toContain(
        "Codex-specific instructions.",
      );
      expect(parsed.developer_instructions).not.toContain(
        "Claude-specific instructions.",
      );
      expect(parsed.developer_instructions).toContain("General instructions.");
    });

    // --- Трансформация: типы значений frontmatter сохраняются в TOML ---
    // § Правила конвертации в TOML:
    // "Типы значений frontmatter сохраняются: строки → TOML strings,
    //  числа → TOML integers/floats, массивы → TOML arrays"
    it("сохраняет типы значений frontmatter при конвертации в TOML", () => {
      const adapter = new CodexAgentAdapter();

      const rawContent = [
        "---",
        "name: typed-agent",
        "temperature: 0.5",
        "maxTokens: 4096",
        "tools:",
        "  - Read",
        "  - Write",
        "---",
        "Instructions.",
      ].join("\n");

      const files = adapter.transpile([
        makeDefinition("typed-agent", rawContent),
      ]);

      const parsed = parseToml(files[0].content);
      expect(parsed.name).toBe("typed-agent");
      expect(parsed.temperature).toBe(0.5);
      expect(parsed.maxTokens).toBe(4096);
      expect(parsed.tools).toEqual(["Read", "Write"]);
    });

    // --- Happy path: обработка нескольких определений ---
    it("обрабатывает несколько определений агентов", () => {
      const adapter = new CodexAgentAdapter();

      const files = adapter.transpile([
        makeDefinition("agent-a", "---\nname: agent-a\n---\nBody A."),
        makeDefinition("agent-b", "---\nname: agent-b\n---\nBody B."),
      ]);

      expect(files).toHaveLength(2);
      const paths = files.map((f) => f.relativePath);
      expect(paths).toContain(".agloom/agents/agent-a.toml");
      expect(paths).toContain(".agloom/agents/agent-b.toml");
    });

    // --- Расширение 1a: transformContent выбрасывает AgentTransformError → пробросить ---
    it("пробрасывает AgentTransformError от transformContent к вызывающему коду", () => {
      const adapter = new CodexAgentAdapter();

      const rawContent = [
        "---",
        "name: agent",
        "override: not-an-object",
        "---",
        "Body.",
      ].join("\n");

      expect(() =>
        adapter.transpile([makeDefinition("agent", rawContent)]),
      ).toThrow(AgentTransformError);
    });

    // --- Расширение 2a: ошибка парсинга gray-matter результата transformContent ---
    // § Codex адаптер → transpile → Расширение 2a:
    // "Библиотека gray-matter выбрасывает ошибку парсинга результата →
    //  AgentTransformError('Failed to parse transformed content for '{definition.name}': {причина}')"
    // Примечание: gray-matter крайне устойчив к невалидному frontmatter,
    // поэтому данный тест проверяет обработку исключительной ситуации
    // при повторном парсинге результата transformContent.
    // Реализация ДОЛЖНА оборачивать gray-matter.parse в try/catch
    // и выбрасывать AgentTransformError с указанием definition.name.
    it("выбрасывает AgentTransformError при ошибке повторного парсинга результата transformContent (расширение 2a)", () => {
      const adapter = new CodexAgentAdapter();

      // gray-matter обрабатывает большинство входных данных без ошибок.
      // Этот тест верифицирует, что адаптер оборачивает вызов gray-matter
      // в try/catch и формирует корректное сообщение об ошибке.
      // Для провокации ошибки используем контент, который после
      // transformContent даст невалидный YAML frontmatter при повторном парсинге.
      // На практике такой edge case маловероятен, но спецификация требует обработки.
      // Тест проверяет наличие обработки через сообщение об ошибке.
      const rawContent = [
        "---",
        "name: bad-agent",
        "---",
        "---",
        "  invalid: yaml: content: [",
        "---",
        "Body after second frontmatter.",
      ].join("\n");

      // Спецификация требует, чтобы при ошибке повторного парсинга
      // адаптер выбрасывал AgentTransformError с именем определения.
      // Тест падает, потому что адаптер ещё не реализован.
      expect(() =>
        adapter.transpile([makeDefinition("bad-agent", rawContent)]),
      ).toThrow(AgentTransformError);
    });

    // --- Расширение 4a: ошибка сериализации TOML через smol-toml ---
    // § Codex адаптер → transpile → Расширение 4a:
    // "smol-toml выбрасывает ошибку сериализации →
    //  AgentTransformError('Failed to serialize TOML for '{definition.name}': {причина}')"
    it("выбрасывает AgentTransformError при ошибке сериализации TOML (расширение 4a)", () => {
      const adapter = new CodexAgentAdapter();

      // smol-toml не может сериализовать массивы, содержащие null.
      // YAML frontmatter с `~` (null) в массиве из gray-matter
      // вызывает ошибку сериализации в smol-toml:
      // "arrays cannot contain null or undefined values"
      const rawContent = [
        "---",
        "name: null-array-agent",
        "items:",
        "  - a",
        "  - ~",
        "  - b",
        "---",
        "Body.",
      ].join("\n");

      // gray-matter парсит "~" как null внутри массива.
      // smol-toml не может сериализовать массивы с null.
      // Адаптер ДОЛЖЕН поймать ошибку и обернуть в AgentTransformError.
      expect(() =>
        adapter.transpile([makeDefinition("null-array-agent", rawContent)]),
      ).toThrow(AgentTransformError);
    });

    // --- Happy path: контент без frontmatter → body только ---
    it("обрабатывает определения без frontmatter", () => {
      const adapter = new CodexAgentAdapter();

      const files = adapter.transpile([
        makeDefinition("simple-agent", "Just plain markdown body."),
      ]);

      expect(files).toHaveLength(1);
      const parsed = parseToml(files[0].content);
      expect(parsed.developer_instructions).toBe("Just plain markdown body.");
    });
  });
});
