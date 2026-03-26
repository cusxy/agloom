// claude-adapter.spec.ts
// Спецификация: docs/specs/agents-transpiler.md § Claude Code адаптер

import { describe, it, expect } from "vitest";
import { ClaudeAgentAdapter } from "../adapters/claude-adapter.js";
import { AgentTransformError } from "../errors.js";
import type { AgentDefinition } from "../types.js";

function makeDefinition(name: string, rawContent: string): AgentDefinition {
  return {
    name,
    relativePath: `.agents/agents/${name}.md`,
    rawContent,
  };
}

describe("ClaudeAgentAdapter", () => {
  describe("transpile", () => {
    // --- Свойство: agentId адаптера ---
    it('имеет agentId равный "claude"', () => {
      const adapter = new ClaudeAgentAdapter();
      expect(adapter.agentId).toBe("claude");
    });

    // --- Happy path: шаги 1–3 — трансформация и замена пути ---
    it("трансформирует содержимое для claude и заменяет .agents/agents/ на .claude/agents/", () => {
      const adapter = new ClaudeAgentAdapter();

      const rawContent = [
        "---",
        "name: code-reviewer",
        "model: sonnet",
        "override:",
        "  claude:",
        "    permissionMode: plan",
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

      const files = adapter.transpile([
        makeDefinition("code-reviewer", rawContent),
      ]);

      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe(".claude/agents/code-reviewer.md");

      // Содержимое трансформировано для claude
      expect(files[0].content).toContain("permissionMode: plan");
      expect(files[0].content).toContain("General instructions.");
      expect(files[0].content).toContain("Claude-specific.");
      expect(files[0].content).not.toContain("OpenCode-specific.");
      expect(files[0].content).not.toContain("override:");
    });

    // --- Трансформация: шаг 2 — замена префикса пути ---
    it("заменяет префикс .agents/agents/ на .claude/agents/ в relativePath", () => {
      const adapter = new ClaudeAgentAdapter();

      const files = adapter.transpile([
        makeDefinition("test-agent", "---\nname: test-agent\n---\nBody."),
      ]);

      expect(files[0].relativePath).toBe(".claude/agents/test-agent.md");
    });

    // --- Happy path: обработка нескольких определений ---
    it("обрабатывает несколько определений агентов", () => {
      const adapter = new ClaudeAgentAdapter();

      const files = adapter.transpile([
        makeDefinition("agent-a", "---\nname: agent-a\n---\nBody A."),
        makeDefinition("agent-b", "---\nname: agent-b\n---\nBody B."),
      ]);

      expect(files).toHaveLength(2);
      const paths = files.map((f) => f.relativePath);
      expect(paths).toContain(".claude/agents/agent-a.md");
      expect(paths).toContain(".claude/agents/agent-b.md");
    });

    // --- Расширение 1a: transformContent выбрасывает AgentTransformError → пробросить ---
    it("пробрасывает AgentTransformError от transformContent к вызывающему коду", () => {
      const adapter = new ClaudeAgentAdapter();

      // Невалидный frontmatter
      const rawContent = [
        "---",
        "name: agent",
        "override: not-an-object",
        "---",
        "Body.",
      ].join("\n");

      expect(() =>
        adapter.transpile([makeDefinition("agent", rawContent)]),
      ).toThrow(AgentTransformError);
    });

    // --- Happy path: контент без frontmatter ---
    it("обрабатывает определения без frontmatter", () => {
      const adapter = new ClaudeAgentAdapter();

      const files = adapter.transpile([
        makeDefinition("simple-agent", "Just plain markdown body."),
      ]);

      expect(files).toHaveLength(1);
      expect(files[0].content).toContain("Just plain markdown body.");
    });
  });
});
