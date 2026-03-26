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
    // --- Happy path: шаг 1 — вернуть пустой массив ---
    it("возвращает пустой массив при наличии канонических файлов любых типов", () => {
      const adapter = new OpenCodeAdapter();

      const files = adapter.transpile([
        makeCanonicalFile("AGENTS.md", "root", "Root content."),
        makeCanonicalFile("src/AGENTS.md", "directory", "Dir content."),
        makeCanonicalFile("AGENTS.local.md", "local", "Local content."),
        makeCanonicalFile(
          "src/AGENTS.local.md",
          "directory-local",
          "Dir local content.",
        ),
      ]);

      expect(files).toEqual([]);
    });

    // --- Happy path: пустой входной массив ---
    it("возвращает пустой массив при пустом входном массиве", () => {
      const adapter = new OpenCodeAdapter();

      const files = adapter.transpile([]);

      expect(files).toEqual([]);
    });

    // --- Happy path: только root файл ---
    it("возвращает пустой массив даже при наличии только root файла", () => {
      const adapter = new OpenCodeAdapter();

      const files = adapter.transpile([
        makeCanonicalFile("AGENTS.md", "root", "Root content."),
      ]);

      expect(files).toEqual([]);
    });

    // --- Свойство: agentId адаптера ---
    it('имеет agentId равный "opencode"', () => {
      const adapter = new OpenCodeAdapter();
      expect(adapter.agentId).toBe("opencode");
    });
  });
});
