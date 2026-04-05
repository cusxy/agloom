// gemini-adapter.spec.ts
// Спецификация: docs/specs/instructions-transpiler.md § Gemini адаптер

import { describe, it, expect } from "vitest";
import { GeminiAdapter } from "../adapters/gemini-adapter.js";
import type { CanonicalFile } from "../types.js";

function makeCanonicalFile(
  relativePath: string,
  type: "root" | "directory" | "local" | "directory-local",
  content: string,
): CanonicalFile {
  return { relativePath, type, content };
}

describe("GeminiAdapter", () => {
  describe("transpile", () => {
    // --- Свойство: agentId адаптера ---
    // § Gemini адаптер — agentId: "gemini"
    it('имеет agentId равный "gemini"', () => {
      const adapter = new GeminiAdapter();
      expect(adapter.agentId).toBe("gemini");
    });

    // --- Happy path: шаги 1–4 — генерация GEMINI.md из AGLOOM.md (root) ---
    // § Gemini адаптер → transpile → Поведение, шаги 1–4
    it('генерирует GEMINI.md из AGLOOM.md в корне проекта (тип "root")', () => {
      const adapter = new GeminiAdapter();

      const files = adapter.transpile([
        makeCanonicalFile("AGLOOM.md", "root", "General instructions."),
      ]);

      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe("GEMINI.md");
      expect(files[0].content).toBe("General instructions.");
    });

    // --- Трансформация: шаг 3 — замена AGLOOM.md → GEMINI.md для directory ---
    // § Gemini адаптер → transpile → Поведение, шаг 3
    it('генерирует GEMINI.md в подпапке из AGLOOM.md в подпапке (тип "directory")', () => {
      const adapter = new GeminiAdapter();

      const files = adapter.transpile([
        makeCanonicalFile(
          "src/module/AGLOOM.md",
          "directory",
          "Module instructions.",
        ),
      ]);

      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe("src/module/GEMINI.md");
      expect(files[0].content).toBe("Module instructions.");
    });

    // --- Граничное условие: тип "local" НЕ ДОЛЖЕН обрабатываться ---
    // § Gemini адаптер → transpile → Поведение, шаг 1: фильтровать root и directory
    it('НЕ генерирует файлы для типа "local"', () => {
      const adapter = new GeminiAdapter();

      const files = adapter.transpile([
        makeCanonicalFile("AGLOOM.local.md", "local", "Personal settings."),
      ]);

      expect(files).toHaveLength(0);
    });

    // --- Граничное условие: тип "directory-local" НЕ ДОЛЖЕН обрабатываться ---
    it('НЕ генерирует файлы для типа "directory-local"', () => {
      const adapter = new GeminiAdapter();

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
    // § Gemini адаптер → transpile → Поведение, шаг 1
    it("обрабатывает root и directory файлы, игнорируя local и directory-local", () => {
      const adapter = new GeminiAdapter();

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

      expect(files).toHaveLength(2);
      const paths = files.map((f) => f.relativePath);
      expect(paths).toContain("GEMINI.md");
      expect(paths).toContain("src/GEMINI.md");
    });

    // --- Трансформация: шаг 2 — адаптер вызывает transformContent ---
    // § Gemini адаптер → transpile → Поведение, шаг 2:
    // вызвать transformContent(file.content, "gemini", this.allowedAgentIds)
    it("применяет override из frontmatter через transformContent", () => {
      const adapter = new GeminiAdapter();

      const content = [
        "---",
        "title: Project",
        "override:",
        "  gemini:",
        "    title: Gemini Project",
        "---",
        "Body content.",
      ].join("\n");

      const files = adapter.transpile([
        makeCanonicalFile("AGLOOM.md", "root", content),
      ]);

      expect(files).toHaveLength(1);
      expect(files[0].content).toContain("title: Gemini Project");
      expect(files[0].content).not.toContain("override:");
    });

    // --- Трансформация: шаг 2 — адаптер фильтрует agent-specific секции ---
    it("фильтрует agent-specific секции через transformContent", () => {
      const adapter = new GeminiAdapter();

      const content = [
        "General instructions.",
        "",
        "<!-- agent:gemini -->",
        "Gemini-specific.",
        "<!-- /agent:gemini -->",
        "<!-- agent:claude -->",
        "Claude-specific.",
        "<!-- /agent:claude -->",
      ].join("\n");

      const files = adapter.transpile([
        makeCanonicalFile("AGLOOM.md", "root", content),
      ]);

      expect(files).toHaveLength(1);
      expect(files[0].content).toContain("Gemini-specific.");
      expect(files[0].content).not.toContain("Claude-specific.");
      expect(files[0].content).not.toContain("<!-- agent:");
    });

    // --- Расширение 2a: transformContent выбрасывает TransformError → пробросить ---
    it("пробрасывает TransformError от transformContent к вызывающему коду", () => {
      const adapter = new GeminiAdapter();

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
    // § Валидация допустимых agentId: "gemini" — допустим (GEMINI.md)
    it("принимает allowedAgentIds в конструкторе и использует при transpile", () => {
      const adapter = new GeminiAdapter(["claude", "agentsmd", "gemini"]);

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

    // --- Граничное условие: пустой входной массив ---
    it("возвращает пустой массив при пустом входном массиве", () => {
      const adapter = new GeminiAdapter();

      const files = adapter.transpile([]);

      expect(files).toEqual([]);
    });
  });
});
