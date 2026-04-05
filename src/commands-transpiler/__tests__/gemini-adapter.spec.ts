// gemini-adapter.spec.ts
// Спецификация: docs/specs/commands-transpiler.md § Gemini адаптер

import { describe, it, expect } from "vitest";
import { GeminiCommandAdapter } from "../adapters/gemini-adapter.js";
import { CommandTransformError } from "../errors.js";
import type { CommandDefinition } from "../types.js";
import { parse as parseToml } from "smol-toml";

function makeDefinition(name: string, rawContent: string, relativePath?: string): CommandDefinition {
  return {
    name,
    relativePath: relativePath ?? `.agloom/commands/${name}.md`,
    rawContent,
  };
}

describe("GeminiCommandAdapter", () => {
  describe("transpile", () => {
    // --- Свойство: agentId адаптера ---
    it('имеет agentId равный "gemini"', () => {
      const adapter = new GeminiCommandAdapter();
      expect(adapter.agentId).toBe("gemini");
    });

    // --- Свойство: targetDir адаптера ---
    it('имеет targetDir равный ".gemini/commands"', () => {
      const adapter = new GeminiCommandAdapter();
      expect(adapter.targetDir).toBe(".gemini/commands");
    });

    // --- Свойство: subdirectories — preserve ---
    // § Gemini адаптер — Subdirectories: preserve
    it("сохраняет subdirectory structure (preserve mode)", () => {
      const adapter = new GeminiCommandAdapter();

      const rawContent = "---\ndescription: Commit\n---\nCommit body.";

      const files = adapter.transpile([makeDefinition("git/commit", rawContent, ".agloom/commands/git/commit.md")]);

      expect(files).toHaveLength(1);
      // Preserve: subdirectory сохраняется, расширение .md → .toml
      expect(files[0].relativePath).toBe(".agloom/commands/git/commit.toml");
    });

    // --- Happy path: шаги 1–5 — базовый кейс: frontmatter + body → TOML ---
    // § Gemini адаптер → transpile → Поведение, шаги 1–5
    // § Правила конвертации в TOML: body → prompt
    it("конвертирует frontmatter и body в формат TOML с prompt", () => {
      const adapter = new GeminiCommandAdapter();

      const rawContent = [
        "---",
        "description: Deploy to production",
        "---",
        "",
        "Deploy the current branch to production environment.",
      ].join("\n");

      const files = adapter.transpile([makeDefinition("deploy", rawContent)]);

      expect(files).toHaveLength(1);

      const parsed = parseToml(files[0].content);
      expect(parsed.description).toBe("Deploy to production");
      expect(parsed.prompt).toBe("Deploy the current branch to production environment.");
    });

    // --- Трансформация: шаг 5 — расширение файла .md → .toml ---
    it("заменяет расширение файла .md на .toml в relativePath", () => {
      const adapter = new GeminiCommandAdapter();

      const files = adapter.transpile([makeDefinition("test-cmd", "---\ndescription: Test\n---\nBody.")]);

      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe(".agloom/commands/test-cmd.toml");
    });

    // --- Трансформация: шаг 1 — override.gemini применяется через transformContent ---
    // § Пример конвертации
    it("применяет override.gemini через transformContent перед конвертацией в TOML", () => {
      const adapter = new GeminiCommandAdapter();

      const rawContent = [
        "---",
        "description: Deploy to production",
        "override:",
        "  gemini:",
        "    description: Deploy the app to production",
        "---",
        "",
        "Deploy the current branch to production environment.",
        "",
        "<!-- agent:gemini -->",
        "",
        "Use !{gcloud app deploy} to deploy.",
        "",
        "<!-- /agent:gemini -->",
      ].join("\n");

      const files = adapter.transpile([makeDefinition("deploy", rawContent)]);

      const parsed = parseToml(files[0].content);
      expect(parsed.description).toBe("Deploy the app to production");
      expect(parsed).not.toHaveProperty("override");
      expect(parsed.prompt as string).toContain("Deploy the current branch to production environment.");
      expect(parsed.prompt as string).toContain("Use !{gcloud app deploy} to deploy.");
    });

    // --- Граничное условие: пустой body → prompt отсутствует ---
    // § Правила конвертации в TOML:
    // "Если body пустое (после trim) — ключ prompt НЕ ВКЛЮЧАЕТСЯ в TOML."
    it("не включает prompt при пустом body", () => {
      const adapter = new GeminiCommandAdapter();

      const rawContent = ["---", "description: Minimal command", "---"].join("\n");

      const files = adapter.transpile([makeDefinition("minimal", rawContent)]);

      const parsed = parseToml(files[0].content);
      expect(parsed.description).toBe("Minimal command");
      expect(parsed).not.toHaveProperty("prompt");
    });

    // --- Трансформация: типы значений frontmatter сохраняются в TOML ---
    // § Правила конвертации в TOML:
    // "Типы значений frontmatter сохраняются"
    it("сохраняет типы значений frontmatter при конвертации в TOML", () => {
      const adapter = new GeminiCommandAdapter();

      const rawContent = [
        "---",
        "description: Typed command",
        "timeout: 30",
        "verbose: true",
        "tags:",
        "  - deploy",
        "  - production",
        "---",
        "Instructions.",
      ].join("\n");

      const files = adapter.transpile([makeDefinition("typed", rawContent)]);

      const parsed = parseToml(files[0].content);
      expect(parsed.description).toBe("Typed command");
      expect(parsed.timeout).toBe(30);
      expect(parsed.verbose).toBe(true);
      expect(parsed.tags).toEqual(["deploy", "production"]);
    });

    // --- Расширение 1a: transformContent выбрасывает ошибку → CommandTransformError ---
    it("оборачивает ошибку transformContent в CommandTransformError", () => {
      const adapter = new GeminiCommandAdapter();

      const rawContent = ["---", "description: Bad", "override: not-an-object", "---", "Body."].join("\n");

      expect(() => adapter.transpile([makeDefinition("bad", rawContent)])).toThrow(CommandTransformError);
    });

    // --- Расширение 2a: ошибка парсинга gray-matter результата ---
    it("выбрасывает CommandTransformError при ошибке повторного парсинга результата transformContent (расширение 2a)", () => {
      const adapter = new GeminiCommandAdapter();

      const rawContent = [
        "---",
        "description: bad-cmd",
        "---",
        "---",
        "  invalid: yaml: content: [",
        "---",
        "Body after second frontmatter.",
      ].join("\n");

      expect(() => adapter.transpile([makeDefinition("bad-cmd", rawContent)])).toThrow(CommandTransformError);
    });

    // --- Расширение 4a: ошибка сериализации TOML ---
    it("выбрасывает CommandTransformError при ошибке сериализации TOML (расширение 4a)", () => {
      const adapter = new GeminiCommandAdapter();

      // YAML null в массиве → smol-toml не может сериализовать
      const rawContent = ["---", "description: null-array", "items:", "  - a", "  - ~", "  - b", "---", "Body."].join(
        "\n",
      );

      expect(() => adapter.transpile([makeDefinition("null-array", rawContent)])).toThrow(CommandTransformError);
    });

    // --- Happy path: контент без frontmatter ---
    it("обрабатывает определения без frontmatter", () => {
      const adapter = new GeminiCommandAdapter();

      const files = adapter.transpile([makeDefinition("simple", "Just plain markdown body.")]);

      expect(files).toHaveLength(1);
      const parsed = parseToml(files[0].content);
      expect(parsed.prompt).toBe("Just plain markdown body.");
    });

    // --- Happy path: обработка нескольких определений ---
    it("обрабатывает несколько определений команд", () => {
      const adapter = new GeminiCommandAdapter();

      const files = adapter.transpile([
        makeDefinition("cmd-a", "---\ndescription: A\n---\nBody A."),
        makeDefinition("cmd-b", "---\ndescription: B\n---\nBody B."),
      ]);

      expect(files).toHaveLength(2);
      const paths = files.map((f) => f.relativePath);
      expect(paths).toContain(".agloom/commands/cmd-a.toml");
      expect(paths).toContain(".agloom/commands/cmd-b.toml");
    });
  });
});
