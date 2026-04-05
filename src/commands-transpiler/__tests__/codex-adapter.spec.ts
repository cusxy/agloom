// codex-adapter.spec.ts
// Спецификация: docs/specs/commands-transpiler.md § Codex адаптер

import { describe, it, expect } from "vitest";
import { CodexCommandAdapter } from "../adapters/codex-adapter.js";
import { CommandTransformError } from "../errors.js";
import type { CommandDefinition } from "../types.js";

function makeDefinition(name: string, rawContent: string, relativePath?: string): CommandDefinition {
  return {
    name,
    relativePath: relativePath ?? `.agloom/commands/${name}.md`,
    rawContent,
  };
}

describe("CodexCommandAdapter", () => {
  describe("transpile", () => {
    // --- Свойство: agentId адаптера ---
    it('имеет agentId равный "codex"', () => {
      const adapter = new CodexCommandAdapter();
      expect(adapter.agentId).toBe("codex");
    });

    // --- Свойство: targetDir адаптера ---
    // § Codex адаптер — targetDir: ".agents/skills"
    it('имеет targetDir равный ".agents/skills"', () => {
      const adapter = new CodexCommandAdapter();
      expect(adapter.targetDir).toBe(".agents/skills");
    });

    // --- Happy path: шаги 1–4 — skill package generation ---
    // § Codex адаптер → transpile → Поведение, шаги 1–4
    it("конвертирует команду в skill package с SKILL.md", () => {
      const adapter = new CodexCommandAdapter();

      const rawContent = [
        "---",
        "description: Create a git commit",
        "---",
        "",
        "Create a commit with a descriptive message.",
      ].join("\n");

      const files = adapter.transpile([makeDefinition("git/commit", rawContent, ".agloom/commands/git/commit.md")]);

      expect(files).toHaveLength(1);
      // Шаг 2: name "git/commit" → skill package name "git-commit"
      // Шаг 4: relativePath = <agloomDir>/commands/<skill-package-name>/SKILL.md
      expect(files[0].relativePath).toBe(".agloom/commands/git-commit/SKILL.md");
      expect(files[0].content).toContain("Create a commit with a descriptive message.");
    });

    // --- Трансформация: шаг 2 — замена / на - в имени ---
    it("заменяет / на - в имени для формирования skill package name", () => {
      const adapter = new CodexCommandAdapter();

      const files = adapter.transpile([
        makeDefinition("a/b/c", "---\ndescription: Deep\n---\nBody.", ".agloom/commands/a/b/c.md"),
      ]);

      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe(".agloom/commands/a-b-c/SKILL.md");
    });

    // --- Happy path: команда без подкаталога ---
    it("формирует skill package для команды без подкаталога", () => {
      const adapter = new CodexCommandAdapter();

      const files = adapter.transpile([makeDefinition("deploy", "---\ndescription: Deploy\n---\nDeploy body.")]);

      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe(".agloom/commands/deploy/SKILL.md");
    });

    // --- Расширение 3a: конфликт имён после преобразования ---
    // § Codex адаптер → transpile → Расширение 3a
    it("выбрасывает CommandTransformError при конфликте имён после преобразования", () => {
      const adapter = new CodexCommandAdapter();

      // "git/status" → "git-status" и "git-status" → "git-status" — конфликт
      expect(() =>
        adapter.transpile([
          makeDefinition("git/status", "---\ndescription: A\n---\nBody.", ".agloom/commands/git/status.md"),
          makeDefinition("git-status", "---\ndescription: B\n---\nBody.", ".agloom/commands/git-status.md"),
        ]),
      ).toThrow(CommandTransformError);

      expect(() =>
        adapter.transpile([
          makeDefinition("git/status", "---\ndescription: A\n---\nBody.", ".agloom/commands/git/status.md"),
          makeDefinition("git-status", "---\ndescription: B\n---\nBody.", ".agloom/commands/git-status.md"),
        ]),
      ).toThrow(/Name conflict after flatten: 'git-status' appears in multiple subdirectories/);
    });

    // --- Трансформация: шаг 1 — override.codex применяется через transformContent ---
    it("применяет override.codex через transformContent", () => {
      const adapter = new CodexCommandAdapter();

      const rawContent = [
        "---",
        "description: Base description",
        "override:",
        "  codex:",
        "    description: Codex description",
        "---",
        "",
        "Body content.",
      ].join("\n");

      const files = adapter.transpile([makeDefinition("cmd", rawContent)]);

      expect(files[0].content).toContain("Codex description");
      expect(files[0].content).not.toContain("override:");
    });

    // --- Расширение 1a: transformContent выбрасывает ошибку → CommandTransformError ---
    it("оборачивает ошибку transformContent в CommandTransformError", () => {
      const adapter = new CodexCommandAdapter();

      const rawContent = ["---", "description: Bad", "override: not-an-object", "---", "Body."].join("\n");

      expect(() => adapter.transpile([makeDefinition("bad", rawContent)])).toThrow(CommandTransformError);
    });

    // --- Happy path: обработка нескольких определений ---
    it("обрабатывает несколько определений команд без конфликтов", () => {
      const adapter = new CodexCommandAdapter();

      const files = adapter.transpile([
        makeDefinition("deploy", "---\ndescription: Deploy\n---\nDeploy."),
        makeDefinition("test", "---\ndescription: Test\n---\nTest."),
      ]);

      expect(files).toHaveLength(2);
      expect(files.map((f) => f.relativePath)).toContain(".agloom/commands/deploy/SKILL.md");
      expect(files.map((f) => f.relativePath)).toContain(".agloom/commands/test/SKILL.md");
    });
  });
});
