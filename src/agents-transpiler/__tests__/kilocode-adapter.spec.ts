// kilocode-adapter.spec.ts
// Спецификация: docs/specs/agents-transpiler.md § KiloCode адаптер

import { describe, it, expect } from "vitest";
import { KiloCodeAgentAdapter } from "../adapters/kilocode-adapter.js";
import { AgentTransformError } from "../errors.js";
import type { AgentDefinition } from "../types.js";

function makeDefinition(name: string, rawContent: string): AgentDefinition {
  return {
    name,
    relativePath: `.agloom/agents/${name}.md`,
    rawContent,
  };
}

describe("KiloCodeAgentAdapter", () => {
  describe("transpile", () => {
    // --- Свойство: agentId адаптера ---
    // § KiloCode адаптер — agentId: "kilocode"
    it('имеет agentId равный "kilocode"', () => {
      const adapter = new KiloCodeAgentAdapter();
      expect(adapter.agentId).toBe("kilocode");
    });

    // --- Свойство: targetDir адаптера ---
    // § KiloCode адаптер — targetDir: ".kilo/agents"
    it('имеет targetDir равный ".kilo/agents"', () => {
      const adapter = new KiloCodeAgentAdapter();
      expect(adapter.targetDir).toBe(".kilo/agents");
    });

    // --- Happy path: шаги 1–2 — трансформация и формирование AgentOutputFile ---
    // § KiloCode адаптер → transpile → Поведение, шаги 1–2
    it("трансформирует содержимое для kilocode и возвращает definition.relativePath без ремаппинга", () => {
      const adapter = new KiloCodeAgentAdapter();

      const rawContent = [
        "---",
        "name: code-reviewer",
        "model: sonnet",
        "override:",
        "  kilocode:",
        "    model: claude-sonnet-kilo",
        "---",
        "General instructions.",
        "",
        "<!-- agent:kilocode -->",
        "KiloCode-specific.",
        "<!-- /agent:kilocode -->",
        "",
        "<!-- agent:claude -->",
        "Claude-specific.",
        "<!-- /agent:claude -->",
      ].join("\n");

      const files = adapter.transpile([makeDefinition("code-reviewer", rawContent)]);

      expect(files).toHaveLength(1);
      // Адаптер возвращает definition.relativePath (без ремаппинга)
      expect(files[0].relativePath).toBe(".agloom/agents/code-reviewer.md");

      // Содержимое трансформировано для kilocode
      expect(files[0].content).toContain("model: claude-sonnet-kilo");
      expect(files[0].content).toContain("General instructions.");
      expect(files[0].content).toContain("KiloCode-specific.");
      expect(files[0].content).not.toContain("Claude-specific.");
      expect(files[0].content).not.toContain("override:");
    });

    // --- Happy path: адаптер возвращает definition.relativePath as-is ---
    // § KiloCode адаптер → transpile → Поведение, шаг 2
    it("возвращает definition.relativePath в качестве relativePath (ремаппинг делает транспилер)", () => {
      const adapter = new KiloCodeAgentAdapter();

      const files = adapter.transpile([makeDefinition("test-agent", "---\nname: test-agent\n---\nBody.")]);

      expect(files[0].relativePath).toBe(".agloom/agents/test-agent.md");
    });

    // --- Happy path: обработка нескольких определений ---
    it("обрабатывает несколько определений агентов", () => {
      const adapter = new KiloCodeAgentAdapter();

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
      const adapter = new KiloCodeAgentAdapter();

      const rawContent = ["---", "name: agent", "override: not-an-object", "---", "Body."].join("\n");

      expect(() => adapter.transpile([makeDefinition("agent", rawContent)])).toThrow(AgentTransformError);
    });

    // --- Happy path: контент без frontmatter ---
    it("обрабатывает определения без frontmatter", () => {
      const adapter = new KiloCodeAgentAdapter();

      const files = adapter.transpile([makeDefinition("simple-agent", "Just plain markdown body.")]);

      expect(files).toHaveLength(1);
      expect(files[0].content).toContain("Just plain markdown body.");
    });
  });
});
