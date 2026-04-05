// claude-adapter.spec.ts
// Спецификация: docs/specs/commands-transpiler.md § Claude Code адаптер

import { describe, it, expect } from "vitest";
import { ClaudeCommandAdapter } from "../adapters/claude-adapter.js";
import { CommandTransformError } from "../errors.js";
import type { CommandDefinition } from "../types.js";

function makeDefinition(name: string, rawContent: string, relativePath?: string): CommandDefinition {
  return {
    name,
    relativePath: relativePath ?? `.agloom/commands/${name}.md`,
    rawContent,
  };
}

describe("ClaudeCommandAdapter", () => {
  describe("transpile", () => {
    // --- Свойство: agentId адаптера ---
    // § Claude Code адаптер — agentId: "claude"
    it('имеет agentId равный "claude"', () => {
      const adapter = new ClaudeCommandAdapter();
      expect(adapter.agentId).toBe("claude");
    });

    // --- Свойство: targetDir адаптера ---
    // § Claude Code адаптер — targetDir: ".claude/commands"
    it('имеет targetDir равный ".claude/commands"', () => {
      const adapter = new ClaudeCommandAdapter();
      expect(adapter.targetDir).toBe(".claude/commands");
    });

    // --- Свойство: subdirectories — preserve ---
    // § Claude Code адаптер — Subdirectories: preserve
    // § Режимы обработки subdirectories — Preserve: structure сохраняется
    it("сохраняет subdirectory structure (preserve mode)", () => {
      const adapter = new ClaudeCommandAdapter();

      const rawContent = "---\ndescription: Commit\n---\nCommit body.";

      const files = adapter.transpile([makeDefinition("git/commit", rawContent, ".agloom/commands/git/commit.md")]);

      expect(files).toHaveLength(1);
      // Адаптер возвращает definition.relativePath без ремаппинга
      expect(files[0].relativePath).toBe(".agloom/commands/git/commit.md");
    });

    // --- Happy path: шаги 1–2 — трансформация и формирование CommandOutputFile ---
    it("трансформирует содержимое для claude и возвращает definition.relativePath без ремаппинга", () => {
      const adapter = new ClaudeCommandAdapter();

      const rawContent = [
        "---",
        "description: Run git commit",
        "override:",
        "  claude:",
        '    argument-hint: "[message]"',
        "---",
        "General instructions.",
        "",
        "<!-- agent:claude -->",
        "Claude-specific.",
        "<!-- /agent:claude -->",
        "",
        "<!-- agent:opencode -->",
        "OpenCode-specific.",
        "<!-- /agent:opencode -->",
      ].join("\n");

      const files = adapter.transpile([makeDefinition("commit", rawContent)]);

      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe(".agloom/commands/commit.md");

      // Содержимое трансформировано для claude
      expect(files[0].content).toContain("argument-hint:");
      expect(files[0].content).toContain("General instructions.");
      expect(files[0].content).toContain("Claude-specific.");
      expect(files[0].content).not.toContain("OpenCode-specific.");
      expect(files[0].content).not.toContain("override:");
    });

    // --- Happy path: обработка нескольких определений ---
    it("обрабатывает несколько определений команд", () => {
      const adapter = new ClaudeCommandAdapter();

      const files = adapter.transpile([
        makeDefinition("deploy", "---\ndescription: Deploy\n---\nDeploy body."),
        makeDefinition("test", "---\ndescription: Test\n---\nTest body."),
      ]);

      expect(files).toHaveLength(2);
      const paths = files.map((f) => f.relativePath);
      expect(paths).toContain(".agloom/commands/deploy.md");
      expect(paths).toContain(".agloom/commands/test.md");
    });

    // --- Расширение 1a: transformContent выбрасывает ошибку → обернуть в CommandTransformError ---
    it("оборачивает ошибку transformContent в CommandTransformError и пробрасывает", () => {
      const adapter = new ClaudeCommandAdapter();

      const rawContent = ["---", "description: Bad", "override: not-an-object", "---", "Body."].join("\n");

      expect(() => adapter.transpile([makeDefinition("bad", rawContent)])).toThrow(CommandTransformError);
    });

    // --- Happy path: контент без frontmatter ---
    it("обрабатывает определения без frontmatter", () => {
      const adapter = new ClaudeCommandAdapter();

      const files = adapter.transpile([makeDefinition("simple", "Just plain markdown body.")]);

      expect(files).toHaveLength(1);
      expect(files[0].content).toContain("Just plain markdown body.");
    });
  });
});
