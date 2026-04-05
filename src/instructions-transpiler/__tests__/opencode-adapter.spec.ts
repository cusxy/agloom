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
    // --- Свойство: agentId адаптера ---
    // Спецификация: § OpenCode адаптер — agentId: "opencode"
    it('имеет agentId равный "opencode"', () => {
      const adapter = new OpenCodeAdapter();
      expect(adapter.agentId).toBe("opencode");
    });

    // --- Happy path: шаг 1 — вернуть пустой массив OutputFile[] ---
    // Спецификация: § OpenCode адаптер → transpile → Поведение, шаг 1
    it("возвращает пустой массив для root файлов (no-op)", () => {
      const adapter = new OpenCodeAdapter();

      const files = adapter.transpile([makeCanonicalFile("AGLOOM.md", "root", "Root content.")]);

      expect(files).toEqual([]);
    });

    // --- No-op: все типы файлов → пустой массив ---
    // Спецификация: § OpenCode адаптер → transpile → Поведение, шаг 1
    it("возвращает пустой массив при наличии файлов всех типов (no-op)", () => {
      const adapter = new OpenCodeAdapter();

      const files = adapter.transpile([
        makeCanonicalFile("AGLOOM.md", "root", "Root."),
        makeCanonicalFile("src/AGLOOM.md", "directory", "Dir."),
        makeCanonicalFile("AGLOOM.local.md", "local", "Local."),
        makeCanonicalFile("src/AGLOOM.local.md", "directory-local", "Dir local."),
      ]);

      expect(files).toEqual([]);
    });

    // --- No-op: пустой входной массив → пустой массив ---
    // Спецификация: § OpenCode адаптер → transpile → Поведение, шаг 1
    it("возвращает пустой массив при пустом входном массиве", () => {
      const adapter = new OpenCodeAdapter();

      const files = adapter.transpile([]);

      expect(files).toEqual([]);
    });
  });
});
