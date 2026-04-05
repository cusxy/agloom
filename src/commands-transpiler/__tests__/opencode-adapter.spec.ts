// opencode-adapter.spec.ts
// Спецификация: docs/specs/commands-transpiler.md § OpenCode адаптер

import { describe, it, expect } from "vitest";
import { OpenCodeCommandAdapter } from "../adapters/opencode-adapter.js";
import { CommandTransformError } from "../errors.js";
import type { CommandDefinition } from "../types.js";

function makeDefinition(name: string, rawContent: string, relativePath?: string): CommandDefinition {
  return {
    name,
    relativePath: relativePath ?? `.agloom/commands/${name}.md`,
    rawContent,
  };
}

describe("OpenCodeCommandAdapter", () => {
  describe("transpile", () => {
    // --- Свойство: agentId адаптера ---
    it('имеет agentId равный "opencode"', () => {
      const adapter = new OpenCodeCommandAdapter();
      expect(adapter.agentId).toBe("opencode");
    });

    // --- Свойство: targetDir адаптера ---
    it('имеет targetDir равный ".opencode/commands"', () => {
      const adapter = new OpenCodeCommandAdapter();
      expect(adapter.targetDir).toBe(".opencode/commands");
    });

    // --- Happy path: шаги 1–4 — flatten + трансформация ---
    // § OpenCode адаптер → transpile → Поведение, шаги 1–4
    // § Режимы обработки subdirectories — Flatten: файлы копируются в корень
    it("выполняет flatten subdirectory structure и трансформирует содержимое", () => {
      const adapter = new OpenCodeCommandAdapter();

      const rawContent = "---\ndescription: Commit\n---\nCommit body.";

      const files = adapter.transpile([makeDefinition("git/commit", rawContent, ".agloom/commands/git/commit.md")]);

      expect(files).toHaveLength(1);
      // Flatten: git/commit.md → commit.md (удалены сегменты подкаталога)
      expect(files[0].relativePath).toBe(".agloom/commands/commit.md");
      expect(files[0].content).toContain("Commit body.");
    });

    // --- Трансформация: шаг 2 — flatten для глубоко вложенных файлов ---
    it("выполняет flatten для глубоко вложенных файлов", () => {
      const adapter = new OpenCodeCommandAdapter();

      const files = adapter.transpile([
        makeDefinition("a/b/c/deep.md", "---\ndescription: Deep\n---\nBody.", ".agloom/commands/a/b/c/deep.md"),
      ]);

      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe(".agloom/commands/deep.md");
    });

    // --- Happy path: файлы без подкаталогов остаются без изменений ---
    it("не изменяет relativePath для файлов в корне commands/", () => {
      const adapter = new OpenCodeCommandAdapter();

      const files = adapter.transpile([makeDefinition("deploy", "---\ndescription: Deploy\n---\nBody.")]);

      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe(".agloom/commands/deploy.md");
    });

    // --- Расширение 3a: конфликт имён после flatten ---
    // § OpenCode адаптер → transpile → Расширение 3a
    // § Режимы обработки subdirectories — Flatten:
    // "Адаптер ДОЛЖЕН обнаружить конфликт и выбросить CommandTransformError"
    it("выбрасывает CommandTransformError при конфликте имён после flatten", () => {
      const adapter = new OpenCodeCommandAdapter();

      expect(() =>
        adapter.transpile([
          makeDefinition("git/status", "---\ndescription: Git status\n---\nBody.", ".agloom/commands/git/status.md"),
          makeDefinition(
            "docker/status",
            "---\ndescription: Docker status\n---\nBody.",
            ".agloom/commands/docker/status.md",
          ),
        ]),
      ).toThrow(CommandTransformError);

      expect(() =>
        adapter.transpile([
          makeDefinition("git/status", "---\ndescription: Git status\n---\nBody.", ".agloom/commands/git/status.md"),
          makeDefinition(
            "docker/status",
            "---\ndescription: Docker status\n---\nBody.",
            ".agloom/commands/docker/status.md",
          ),
        ]),
      ).toThrow(/Name conflict after flatten: 'status' appears in multiple subdirectories/);
    });

    // --- Расширение 1a: transformContent выбрасывает ошибку → CommandTransformError ---
    it("оборачивает ошибку transformContent в CommandTransformError", () => {
      const adapter = new OpenCodeCommandAdapter();

      const rawContent = ["---", "description: Bad", "override: not-an-object", "---", "Body."].join("\n");

      expect(() => adapter.transpile([makeDefinition("bad", rawContent)])).toThrow(CommandTransformError);
    });

    // --- Happy path: обработка нескольких определений ---
    it("обрабатывает несколько определений команд", () => {
      const adapter = new OpenCodeCommandAdapter();

      const files = adapter.transpile([
        makeDefinition("deploy", "---\ndescription: Deploy\n---\nDeploy body."),
        makeDefinition("test", "---\ndescription: Test\n---\nTest body."),
      ]);

      expect(files).toHaveLength(2);
    });
  });
});
