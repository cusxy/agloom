// kilocode-adapter.spec.ts
// Спецификация: docs/specs/commands-transpiler.md § KiloCode адаптер

import { describe, it, expect } from "vitest";
import { KiloCodeCommandAdapter } from "../adapters/kilocode-adapter.js";
import { CommandTransformError } from "../errors.js";
import type { CommandDefinition } from "../types.js";

function makeDefinition(name: string, rawContent: string, relativePath?: string): CommandDefinition {
  return {
    name,
    relativePath: relativePath ?? `.agloom/commands/${name}.md`,
    rawContent,
  };
}

describe("KiloCodeCommandAdapter", () => {
  describe("transpile", () => {
    // --- Свойство: agentId адаптера ---
    it('имеет agentId равный "kilocode"', () => {
      const adapter = new KiloCodeCommandAdapter();
      expect(adapter.agentId).toBe("kilocode");
    });

    // --- Свойство: targetDir адаптера ---
    it('имеет targetDir равный ".kilo/commands"', () => {
      const adapter = new KiloCodeCommandAdapter();
      expect(adapter.targetDir).toBe(".kilo/commands");
    });

    // --- Happy path: шаги 1–4 — flatten + трансформация ---
    // § KiloCode адаптер → transpile → Поведение, шаги 1–4
    it("выполняет flatten subdirectory structure и трансформирует содержимое", () => {
      const adapter = new KiloCodeCommandAdapter();

      const rawContent = "---\ndescription: Commit\n---\nCommit body.";

      const files = adapter.transpile([makeDefinition("git/commit", rawContent, ".agloom/commands/git/commit.md")]);

      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe(".agloom/commands/commit.md");
      expect(files[0].content).toContain("Commit body.");
    });

    // --- Расширение 3a: конфликт имён после flatten ---
    it("выбрасывает CommandTransformError при конфликте имён после flatten", () => {
      const adapter = new KiloCodeCommandAdapter();

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
      const adapter = new KiloCodeCommandAdapter();

      const rawContent = ["---", "description: Bad", "override: not-an-object", "---", "Body."].join("\n");

      expect(() => adapter.transpile([makeDefinition("bad", rawContent)])).toThrow(CommandTransformError);
    });

    // --- Happy path: обработка нескольких определений без конфликтов ---
    it("обрабатывает несколько определений из разных подкаталогов без конфликтов", () => {
      const adapter = new KiloCodeCommandAdapter();

      const files = adapter.transpile([
        makeDefinition("git/commit", "---\ndescription: Commit\n---\nBody.", ".agloom/commands/git/commit.md"),
        makeDefinition("git/push", "---\ndescription: Push\n---\nBody.", ".agloom/commands/git/push.md"),
      ]);

      expect(files).toHaveLength(2);
      expect(files.map((f) => f.relativePath)).toContain(".agloom/commands/commit.md");
      expect(files.map((f) => f.relativePath)).toContain(".agloom/commands/push.md");
    });
  });
});
