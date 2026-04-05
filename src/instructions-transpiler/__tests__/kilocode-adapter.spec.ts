// kilocode-adapter.spec.ts
// Спецификация: docs/specs/instructions-transpiler.md § KiloCode адаптер

import { describe, it, expect } from "vitest";
import { KiloCodeAdapter } from "../adapters/kilocode-adapter.js";
import type { CanonicalFile } from "../types.js";

function makeCanonicalFile(
  relativePath: string,
  type: "root" | "directory" | "local" | "directory-local",
  content: string,
): CanonicalFile {
  return { relativePath, type, content };
}

describe("KiloCodeAdapter", () => {
  describe("transpile", () => {
    // --- Свойство: agentId адаптера ---
    // § KiloCode адаптер — agentId: "kilocode"
    it('имеет agentId равный "kilocode"', () => {
      const adapter = new KiloCodeAdapter();
      expect(adapter.agentId).toBe("kilocode");
    });

    // --- Happy path: шаг 1 — вернуть пустой массив OutputFile[] ---
    // § KiloCode адаптер → transpile → Поведение, шаг 1
    it("возвращает пустой массив для root файлов (no-op)", () => {
      const adapter = new KiloCodeAdapter();

      const files = adapter.transpile([makeCanonicalFile("AGLOOM.md", "root", "Root content.")]);

      expect(files).toEqual([]);
    });

    // --- No-op: все типы файлов → пустой массив ---
    // § KiloCode адаптер → transpile → Поведение, шаг 1
    it("возвращает пустой массив при наличии файлов всех типов (no-op)", () => {
      const adapter = new KiloCodeAdapter();

      const files = adapter.transpile([
        makeCanonicalFile("AGLOOM.md", "root", "Root."),
        makeCanonicalFile("src/AGLOOM.md", "directory", "Dir."),
        makeCanonicalFile("AGLOOM.local.md", "local", "Local."),
        makeCanonicalFile("src/AGLOOM.local.md", "directory-local", "Dir local."),
      ]);

      expect(files).toEqual([]);
    });

    // --- No-op: пустой входной массив → пустой массив ---
    // § KiloCode адаптер → transpile → Поведение, шаг 1
    it("возвращает пустой массив при пустом входном массиве", () => {
      const adapter = new KiloCodeAdapter();

      const files = adapter.transpile([]);

      expect(files).toEqual([]);
    });
  });
});
