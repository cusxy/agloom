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

    // ===================================================================
    // НОВЫЕ ТЕСТЫ: Claude адаптер вызывает transformContent
    // Спецификация: docs/specs/instructions-transpiler.md § Claude Code адаптер (обновлённая)
    // Шаг 2: вызвать transformContent(file.content, "claude", this.allowedAgentIds)
    // ===================================================================

    // --- Трансформация: шаг 2 — адаптер применяет override из frontmatter ---
    it("применяет override из frontmatter через transformContent", () => {
      const adapter = new ClaudeAdapter();

      const content = [
        "---",
        "title: Project",
        "override:",
        "  claude:",
        "    title: Claude Project",
        "---",
        "Body content.",
      ].join("\n");

      const files = adapter.transpile([
        makeCanonicalFile("AGLOOM.md", "root", content),
      ]);

      expect(files).toHaveLength(1);
      // Если transformContent вызван, override будет применён
      expect(files[0].content).toContain("title: Claude Project");
      expect(files[0].content).not.toContain("override:");
    });

    // --- Трансформация: шаг 2 — адаптер фильтрует agent-specific секции в body ---
    it("фильтрует agent-specific секции через transformContent", () => {
      const adapter = new ClaudeAdapter();

      const content = [
        "General instructions.",
        "",
        "<!-- agent:claude -->",
        "Claude-specific.",
        "<!-- /agent:claude -->",
        "<!-- agent:agentsmd -->",
        "AGENTS.md-specific.",
        "<!-- /agent:agentsmd -->",
      ].join("\n");

      const files = adapter.transpile([
        makeCanonicalFile("AGLOOM.md", "root", content),
      ]);

      expect(files).toHaveLength(1);
      // Если transformContent вызван, claude секция раскрыта, agentsmd удалена
      expect(files[0].content).toContain("Claude-specific.");
      expect(files[0].content).not.toContain("AGENTS.md-specific.");
      expect(files[0].content).not.toContain("<!-- agent:");
    });

    // --- Расширение 2a: transformContent выбрасывает TransformError → пробросить ---
    it("пробрасывает TransformError от transformContent к вызывающему коду", () => {
      const adapter = new ClaudeAdapter();

      const content = [
        "---",
        "title: Test",
        "override: not-an-object",
        "---",
        "Body.",
      ].join("\n");

      expect(() =>
        adapter.transpile([makeCanonicalFile("AGLOOM.md", "root", content)]),
      ).toThrow(/Override must be an object/);
    });

    // --- Конструктор: allowedAgentIds передаётся и используется ---
    it("принимает allowedAgentIds в конструкторе и использует при transpile", () => {
      const adapter = new ClaudeAdapter(["claude", "agentsmd"]);

      const content = [
        "General instructions.",
        "",
        "<!-- agent:opencode -->",
        "OpenCode content.",
        "<!-- /agent:opencode -->",
      ].join("\n");

      // "opencode" не входит в allowedAgentIds — должна быть ошибка
      expect(() =>
        adapter.transpile([makeCanonicalFile("AGLOOM.md", "root", content)]),
      ).toThrow(/Invalid agent-id 'opencode'/);
    });
  });
});
