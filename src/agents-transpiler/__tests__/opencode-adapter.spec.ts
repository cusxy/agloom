// opencode-adapter.spec.ts
// Спецификация: docs/specs/agents-transpiler.md § OpenCode адаптер

import { describe, it, expect } from "vitest";
import { OpenCodeAgentAdapter } from "../adapters/opencode-adapter.js";
import { AgentTransformError } from "../errors.js";
import type { AgentDefinition } from "../types.js";

function makeDefinition(name: string, rawContent: string): AgentDefinition {
  return {
    name,
    relativePath: `.agloom/agents/${name}.md`,
    rawContent,
  };
}

describe("OpenCodeAgentAdapter", () => {
  describe("transpile", () => {
    // --- Свойство: agentId адаптера ---
    it('имеет agentId равный "opencode"', () => {
      const adapter = new OpenCodeAgentAdapter();
      expect(adapter.agentId).toBe("opencode");
    });

    // --- Спецификация: § OpenCode адаптер, шаг 2 ---
    // "Сформировать AgentOutputFile с definition.relativePath в качестве relativePath"
    // Ремаппинг выполняется транспилером, НЕ адаптером.
    it("трансформирует содержимое для opencode и возвращает definition.relativePath без ремаппинга", () => {
      const adapter = new OpenCodeAgentAdapter();

      const rawContent = [
        "---",
        "name: code-reviewer",
        "model: sonnet",
        "override:",
        "  opencode:",
        "    model: anthropic/claude-sonnet-4-5",
        "    temperature: 0.1",
        "---",
        "General instructions.",
        "",
        "<!-- agent:claude -->",
        "Claude-specific.",
        "<!-- /agent:claude -->",
        "",
        "<!-- agent:opencode -->",
        "OpenCode-specific.",
        "<!-- /agent:opencode -->",
      ].join("\n");

      const files = adapter.transpile([makeDefinition("code-reviewer", rawContent)]);

      expect(files).toHaveLength(1);
      // Адаптер возвращает definition.relativePath (без ремаппинга)
      expect(files[0].relativePath).toBe(".agloom/agents/code-reviewer.md");

      // Содержимое трансформировано для opencode
      expect(files[0].content).toContain("model: anthropic/claude-sonnet-4-5");
      expect(files[0].content).toContain("temperature: 0.1");
      expect(files[0].content).toContain("General instructions.");
      expect(files[0].content).toContain("OpenCode-specific.");
      expect(files[0].content).not.toContain("Claude-specific.");
      expect(files[0].content).not.toContain("override:");
    });

    // --- Спецификация: § OpenCode адаптер, шаг 2 ---
    // Адаптер возвращает definition.relativePath as-is
    it("возвращает definition.relativePath в качестве relativePath (ремаппинг делает транспилер)", () => {
      const adapter = new OpenCodeAgentAdapter();

      const files = adapter.transpile([makeDefinition("test-agent", "---\nname: test-agent\n---\nBody.")]);

      expect(files[0].relativePath).toBe(".agloom/agents/test-agent.md");
    });

    // --- Happy path: обработка нескольких определений ---
    it("обрабатывает несколько определений агентов", () => {
      const adapter = new OpenCodeAgentAdapter();

      const files = adapter.transpile([
        makeDefinition("agent-a", "---\nname: agent-a\n---\nBody A."),
        makeDefinition("agent-b", "---\nname: agent-b\n---\nBody B."),
      ]);

      expect(files).toHaveLength(2);
      const paths = files.map((f) => f.relativePath);
      expect(paths).toContain(".agloom/agents/agent-a.md");
      expect(paths).toContain(".agloom/agents/agent-b.md");
    });

    // --- Расширение 1a: transformContent выбрасывает AgentTransformError → пробросить ---
    it("пробрасывает AgentTransformError от transformContent к вызывающему коду", () => {
      const adapter = new OpenCodeAgentAdapter();

      // Невалидный frontmatter
      const rawContent = ["---", "name: agent", "override: not-an-object", "---", "Body."].join("\n");

      expect(() => adapter.transpile([makeDefinition("agent", rawContent)])).toThrow(AgentTransformError);
    });

    // --- Happy path: контент без frontmatter ---
    it("обрабатывает определения без frontmatter", () => {
      const adapter = new OpenCodeAgentAdapter();

      const files = adapter.transpile([makeDefinition("simple-agent", "Just plain markdown body.")]);

      expect(files).toHaveLength(1);
      expect(files[0].content).toContain("Just plain markdown body.");
    });
  });
});
