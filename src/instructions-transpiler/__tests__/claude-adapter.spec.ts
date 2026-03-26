// claude-adapter.spec.ts
// Спецификация: docs/specs/instructions-transpiler.md § Claude Code адаптер

import { describe, it, expect } from "vitest";
import { ClaudeAdapter } from "../adapters/claude-adapter.js";
import type { CanonicalFile } from "../types.js";

function makeCanonicalFile(
  relativePath: string,
  type: "root" | "directory" | "local" | "directory-local",
  content: string,
): CanonicalFile {
  return { relativePath, type, content };
}

describe("ClaudeAdapter", () => {
  describe("transpile", () => {
    // --- Happy path: шаги 1–4 — генерация для всех типов файлов ---
    it('генерирует CLAUDE.md из AGLOOM.md в корне проекта (тип "root")', () => {
      const adapter = new ClaudeAdapter();

      const files = adapter.transpile([
        makeCanonicalFile("AGLOOM.md", "root", "General instructions."),
      ]);

      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe("CLAUDE.md");
      expect(files[0].content).toBe("General instructions.");
    });

    // --- Трансформация: шаг 2 — замена AGLOOM.md → CLAUDE.md для directory ---
    it('генерирует CLAUDE.md в подпапке из AGLOOM.md в подпапке (тип "directory")', () => {
      const adapter = new ClaudeAdapter();

      const files = adapter.transpile([
        makeCanonicalFile(
          "src/module/AGLOOM.md",
          "directory",
          "Module instructions.",
        ),
      ]);

      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe("src/module/CLAUDE.md");
      expect(files[0].content).toBe("Module instructions.");
    });

    // --- Трансформация: шаг 3 — замена AGLOOM.local.md → CLAUDE.local.md для local ---
    it('генерирует CLAUDE.local.md из AGLOOM.local.md в корне (тип "local")', () => {
      const adapter = new ClaudeAdapter();

      const files = adapter.transpile([
        makeCanonicalFile("AGLOOM.local.md", "local", "Personal settings."),
      ]);

      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe("CLAUDE.local.md");
      expect(files[0].content).toBe("Personal settings.");
    });

    // --- Трансформация: шаг 3 — замена AGLOOM.local.md → CLAUDE.local.md для directory-local ---
    it('генерирует CLAUDE.local.md в подпапке из AGLOOM.local.md в подпапке (тип "directory-local")', () => {
      const adapter = new ClaudeAdapter();

      const files = adapter.transpile([
        makeCanonicalFile(
          "src/feature/AGLOOM.local.md",
          "directory-local",
          "Feature local settings.",
        ),
      ]);

      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe("src/feature/CLAUDE.local.md");
      expect(files[0].content).toBe("Feature local settings.");
    });

    // --- Happy path: обработка всех четырёх типов файлов одновременно ---
    it("обрабатывает root, directory, local и directory-local файлы в одном вызове", () => {
      const adapter = new ClaudeAdapter();

      const files = adapter.transpile([
        makeCanonicalFile("AGLOOM.md", "root", "Root."),
        makeCanonicalFile("src/AGLOOM.md", "directory", "Dir."),
        makeCanonicalFile("AGLOOM.local.md", "local", "Local."),
        makeCanonicalFile(
          "src/AGLOOM.local.md",
          "directory-local",
          "Dir local.",
        ),
      ]);

      expect(files).toHaveLength(4);
      const paths = files.map((f) => f.relativePath);
      expect(paths).toContain("CLAUDE.md");
      expect(paths).toContain("src/CLAUDE.md");
      expect(paths).toContain("CLAUDE.local.md");
      expect(paths).toContain("src/CLAUDE.local.md");
    });

    // --- Трансформация: шаг 4 — контент берётся из file.content напрямую ---
    it("использует file.content напрямую как содержимое выходного файла", () => {
      const adapter = new ClaudeAdapter();
      const originalContent =
        "# Instructions\n\nMultiline content with **markdown**.";

      const files = adapter.transpile([
        makeCanonicalFile("AGLOOM.md", "root", originalContent),
      ]);

      expect(files[0].content).toBe(originalContent);
    });

    // --- Свойство: agentId адаптера ---
    it('имеет agentId равный "claude"', () => {
      const adapter = new ClaudeAdapter();
      expect(adapter.agentId).toBe("claude");
    });
  });
});
