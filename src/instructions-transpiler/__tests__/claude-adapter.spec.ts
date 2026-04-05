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

    // --- Граничное условие: тип "local" НЕ ДОЛЖЕН обрабатываться ---
    // § instructions-transpiler.md § Claude Code адаптер:
    // Типы local и directory-local удалены из спецификации.
    // Адаптер ДОЛЖЕН фильтровать только root и directory.
    it('НЕ генерирует файлы для типа "local" (тип удалён из спецификации)', () => {
      const adapter = new ClaudeAdapter();

      const files = adapter.transpile([
        makeCanonicalFile("AGLOOM.local.md", "local", "Personal settings."),
      ]);

      expect(files).toHaveLength(0);
    });

    // --- Граничное условие: тип "directory-local" НЕ ДОЛЖЕН обрабатываться ---
    // § instructions-transpiler.md § Claude Code адаптер:
    // Типы local и directory-local удалены из спецификации.
    it('НЕ генерирует файлы для типа "directory-local" (тип удалён из спецификации)', () => {
      const adapter = new ClaudeAdapter();

      const files = adapter.transpile([
        makeCanonicalFile(
          "src/feature/AGLOOM.local.md",
          "directory-local",
          "Feature local settings.",
        ),
      ]);

      expect(files).toHaveLength(0);
    });

    // --- Happy path: обработка root и directory файлов одновременно ---
    // § instructions-transpiler.md § Claude Code адаптер:
    // Шаг 1: отфильтровать файлы типов root и directory.
    it("обрабатывает root и directory файлы, игнорируя local и directory-local", () => {
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

      // Только root и directory обработаны, local и directory-local игнорированы
      expect(files).toHaveLength(2);
      const paths = files.map((f) => f.relativePath);
      expect(paths).toContain("CLAUDE.md");
      expect(paths).toContain("src/CLAUDE.md");
      expect(paths).not.toContain("CLAUDE.local.md");
      expect(paths).not.toContain("src/CLAUDE.local.md");
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
