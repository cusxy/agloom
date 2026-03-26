// opencode-adapter.spec.ts
// Спецификация: docs/specs/instructions-transpiler.md § OpenCode адаптер

import { describe, it, expect } from "vitest";
import { OpenCodeAdapter } from "../adapters/opencode-adapter.js";
import type { CanonicalFile } from "../types.js";

function makeCanonicalFile(
  relativePath: string,
  type: "root" | "directory" | "local" | "directory-local",
  content: string,
): CanonicalFile {
  return { relativePath, type, content };
}

describe("OpenCodeAdapter", () => {
  describe("transpile", () => {
    // --- Happy path: шаг 1 — фильтрация только root файлов ---
    it('генерирует AGENTS.md из AGLOOM.md в корне (тип "root")', () => {
      const adapter = new OpenCodeAdapter();

      const files = adapter.transpile([
        makeCanonicalFile("AGLOOM.md", "root", "Root content."),
      ]);

      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe("AGENTS.md");
      expect(files[0].content).toBe("Root content.");
    });

    // --- Шаг 1: directory, local, directory-local не генерируются ---
    it("не генерирует файлы для directory, local и directory-local типов", () => {
      const adapter = new OpenCodeAdapter();

      const files = adapter.transpile([
        makeCanonicalFile("src/AGLOOM.md", "directory", "Dir content."),
        makeCanonicalFile("AGLOOM.local.md", "local", "Local content."),
        makeCanonicalFile(
          "src/AGLOOM.local.md",
          "directory-local",
          "Dir local content.",
        ),
      ]);

      expect(files).toEqual([]);
    });

    // --- Смешанный вход: все типы → только root генерируется ---
    it("генерирует AGENTS.md только из root при наличии файлов всех типов", () => {
      const adapter = new OpenCodeAdapter();

      const files = adapter.transpile([
        makeCanonicalFile("AGLOOM.md", "root", "Root content."),
        makeCanonicalFile("src/AGLOOM.md", "directory", "Dir content."),
        makeCanonicalFile("AGLOOM.local.md", "local", "Local content."),
        makeCanonicalFile(
          "src/AGLOOM.local.md",
          "directory-local",
          "Dir local content.",
        ),
      ]);

      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe("AGENTS.md");
      expect(files[0].content).toBe("Root content.");
    });

    // --- Happy path: пустой входной массив ---
    it("возвращает пустой массив при пустом входном массиве", () => {
      const adapter = new OpenCodeAdapter();

      const files = adapter.transpile([]);

      expect(files).toEqual([]);
    });

    // --- Контент берётся напрямую ---
    it("использует file.content напрямую как содержимое выходного файла", () => {
      const adapter = new OpenCodeAdapter();
      const originalContent =
        "# Instructions\n\nMultiline content with **markdown**.";

      const files = adapter.transpile([
        makeCanonicalFile("AGLOOM.md", "root", originalContent),
      ]);

      expect(files[0].content).toBe(originalContent);
    });

    // --- Свойство: agentId адаптера ---
    it('имеет agentId равный "opencode"', () => {
      const adapter = new OpenCodeAdapter();
      expect(adapter.agentId).toBe("opencode");
    });
  });
});
