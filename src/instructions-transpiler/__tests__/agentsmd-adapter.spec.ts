// agentsmd-adapter.spec.ts
// Спецификация: docs/specs/instructions-transpiler.md § AGENTS.md адаптер

import { describe, it, expect } from "vitest";
import { AgentsMdAdapter } from "../adapters/agentsmd-adapter.js";
import type { CanonicalFile } from "../types.js";

function makeCanonicalFile(
  relativePath: string,
  type: "root" | "directory" | "local" | "directory-local",
  content: string,
): CanonicalFile {
  return { relativePath, type, content };
}

describe("AgentsMdAdapter", () => {
  describe("transpile", () => {
    // --- Happy path: шаг 1 — фильтрация только root и directory файлов ---
    it('генерирует AGENTS.md из AGLOOM.md в корне (тип "root")', () => {
      const adapter = new AgentsMdAdapter();

      const files = adapter.transpile([makeCanonicalFile("AGLOOM.md", "root", "Root content.")]);

      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe("AGENTS.md");
      expect(files[0].content).toBe("Root content.");
    });

    // --- Шаг 1: генерация для directory типа ---
    it('генерирует AGENTS.md в подпапке из AGLOOM.md в подпапке (тип "directory")', () => {
      const adapter = new AgentsMdAdapter();

      const files = adapter.transpile([makeCanonicalFile("src/module/AGLOOM.md", "directory", "Directory content.")]);

      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe("src/module/AGENTS.md");
      expect(files[0].content).toBe("Directory content.");
    });

    // --- Шаг 1: local и directory-local не генерируются ---
    it("не генерирует файлы для local и directory-local типов", () => {
      const adapter = new AgentsMdAdapter();

      const files = adapter.transpile([
        makeCanonicalFile("AGLOOM.local.md", "local", "Local content."),
        makeCanonicalFile("src/AGLOOM.local.md", "directory-local", "Dir local content."),
      ]);

      expect(files).toEqual([]);
    });

    // --- Смешанный вход: все типы → только root и directory генерируются ---
    it("генерирует AGENTS.md из root и directory при наличии файлов всех типов", () => {
      const adapter = new AgentsMdAdapter();

      const files = adapter.transpile([
        makeCanonicalFile("AGLOOM.md", "root", "Root."),
        makeCanonicalFile("src/AGLOOM.md", "directory", "Dir."),
        makeCanonicalFile("AGLOOM.local.md", "local", "Local."),
        makeCanonicalFile("src/AGLOOM.local.md", "directory-local", "Dir local."),
      ]);

      expect(files).toHaveLength(2);
      const paths = files.map((f) => f.relativePath);
      expect(paths).toContain("AGENTS.md");
      expect(paths).toContain("src/AGENTS.md");
    });

    // --- Happy path: пустой входной массив ---
    it("возвращает пустой массив при пустом входном массиве", () => {
      const adapter = new AgentsMdAdapter();

      const files = adapter.transpile([]);

      expect(files).toEqual([]);
    });

    // --- Трансформация: шаг 2 — вызов transformContent ---
    it("применяет override из frontmatter через transformContent", () => {
      const adapter = new AgentsMdAdapter();

      const content = [
        "---",
        "title: Project",
        "override:",
        "  agentsmd:",
        "    title: AGENTS.md Project",
        "---",
        "Body content.",
      ].join("\n");

      const files = adapter.transpile([makeCanonicalFile("AGLOOM.md", "root", content)]);

      expect(files).toHaveLength(1);
      expect(files[0].content).toContain("title: AGENTS.md Project");
      expect(files[0].content).not.toContain("override:");
    });

    // --- Трансформация: шаг 2 — фильтрация agent-specific секций ---
    it("фильтрует agent-specific секции через transformContent для agentsmd", () => {
      const adapter = new AgentsMdAdapter();

      const content = [
        "General instructions.",
        "",
        "<!-- agent:agentsmd -->",
        "AGENTS.md-specific.",
        "<!-- /agent:agentsmd -->",
        "<!-- agent:claude -->",
        "Claude-specific.",
        "<!-- /agent:claude -->",
      ].join("\n");

      const files = adapter.transpile([makeCanonicalFile("AGLOOM.md", "root", content)]);

      expect(files).toHaveLength(1);
      expect(files[0].content).toContain("AGENTS.md-specific.");
      expect(files[0].content).not.toContain("Claude-specific.");
      expect(files[0].content).not.toContain("<!-- agent:");
    });

    // --- Шаг 3: замена AGLOOM.md → AGENTS.md в relativePath ---
    it("заменяет AGLOOM.md на AGENTS.md в relativePath", () => {
      const adapter = new AgentsMdAdapter();

      const files = adapter.transpile([
        makeCanonicalFile("AGLOOM.md", "root", "Root."),
        makeCanonicalFile("deep/nested/AGLOOM.md", "directory", "Nested."),
      ]);

      expect(files[0].relativePath).toBe("AGENTS.md");
      expect(files[1].relativePath).toBe("deep/nested/AGENTS.md");
    });

    // --- Расширение 2a: transformContent выбрасывает TransformError → пробросить ---
    it("пробрасывает TransformError от transformContent к вызывающему коду", () => {
      const adapter = new AgentsMdAdapter();

      const content = ["---", "title: Test", "override: not-an-object", "---", "Body."].join("\n");

      expect(() => adapter.transpile([makeCanonicalFile("AGLOOM.md", "root", content)])).toThrow(
        /Override must be an object/,
      );
    });

    // --- Свойство: agentId адаптера ---
    it('имеет agentId равный "agentsmd"', () => {
      const adapter = new AgentsMdAdapter();
      expect(adapter.agentId).toBe("agentsmd");
    });

    // --- Конструктор: allowedAgentIds передаётся и используется ---
    it("принимает allowedAgentIds в конструкторе и использует при transpile", () => {
      const adapter = new AgentsMdAdapter(["claude", "agentsmd"]);

      const content = [
        "General instructions.",
        "",
        "<!-- agent:opencode -->",
        "OpenCode content.",
        "<!-- /agent:opencode -->",
      ].join("\n");

      // "opencode" не входит в allowedAgentIds — должна быть ошибка
      expect(() => adapter.transpile([makeCanonicalFile("AGLOOM.md", "root", content)])).toThrow(
        /Invalid agent-id 'opencode'/,
      );
    });
  });
});
