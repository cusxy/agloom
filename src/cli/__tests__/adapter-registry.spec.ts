// adapter-registry.spec.ts
// Спецификация: docs/specs/cli.md § Реестр адаптеров
// Спецификация: docs/specs/adapter-registry-ext.md § Обновление реестра адаптеров

import { describe, it, expect } from "vitest";
import { adapterRegistry } from "../adapter-registry.js";
import { ClaudeAdapter } from "../../instructions-transpiler/index.js";
import { OpenCodeAdapter } from "../../instructions-transpiler/index.js";
import { ClaudeSkillAdapter } from "../../skills-transpiler/index.js";
import { OpenCodeSkillAdapter } from "../../skills-transpiler/index.js";
import { ClaudeAgentAdapter } from "../../agents-transpiler/index.js";
import { OpenCodeAgentAdapter } from "../../agents-transpiler/index.js";

describe("CLI", () => {
  describe("Реестр адаптеров", () => {
    // --- Happy path: реестр содержит запись claude ---
    // Шаг: Реестр содержит записи claude и opencode (таблица § Состав реестра)
    it('содержит запись для "claude" с корректными id, description и экземплярами адаптеров', () => {
      const claude = adapterRegistry.find((e) => e.id === "claude");
      expect(claude).toBeDefined();
      expect(claude!.id).toBe("claude");
      expect(claude!.description).toBe("Claude Code");
      expect(claude!.instructions).toBeInstanceOf(ClaudeAdapter);
      expect(claude!.skills).toBeInstanceOf(ClaudeSkillAdapter);
      expect(claude!.agents).toBeInstanceOf(ClaudeAgentAdapter);
    });

    // --- Happy path: реестр содержит запись opencode ---
    // Шаг: Реестр содержит записи claude и opencode (таблица § Состав реестра)
    it('содержит запись для "opencode" с корректными id, description и экземплярами адаптеров', () => {
      const opencode = adapterRegistry.find((e) => e.id === "opencode");
      expect(opencode).toBeDefined();
      expect(opencode!.id).toBe("opencode");
      expect(opencode!.description).toBe("OpenCode");
      expect(opencode!.instructions).toBeInstanceOf(OpenCodeAdapter);
      expect(opencode!.skills).toBeInstanceOf(OpenCodeSkillAdapter);
      expect(opencode!.agents).toBeInstanceOf(OpenCodeAgentAdapter);
    });

    // --- Happy path: реестр содержит ровно 2 записи ---
    // Шаг: Реестр является единственным местом определения (таблица содержит 2 записи)
    it("содержит ровно две записи (claude и opencode)", () => {
      expect(adapterRegistry).toHaveLength(2);
    });
  });

  // Спецификация: docs/specs/adapter-registry-ext.md § Обновление реестра адаптеров
  describe("Расширение реестра адаптеров", () => {
    // --- Happy path: запись claude содержит новые поля targetRoot и targetFiles ---
    // § Обновление реестра адаптеров, строка claude: targetRoot=".claude", targetFiles=["CLAUDE.md"]
    it('запись "claude" содержит targetRoot ".claude" и targetFiles ["CLAUDE.md"]', () => {
      const claude = adapterRegistry.find((e) => e.id === "claude");
      expect(claude).toBeDefined();
      expect(claude!.targetRoot).toBe(".claude");
      expect(claude!.targetFiles).toEqual(["CLAUDE.md"]);
    });

    // --- Happy path: запись opencode содержит новые поля targetRoot и targetFiles ---
    // § Обновление реестра адаптеров, строка opencode: targetRoot=".opencode", targetFiles=[]
    it('запись "opencode" содержит targetRoot ".opencode" и targetFiles []', () => {
      const opencode = adapterRegistry.find((e) => e.id === "opencode");
      expect(opencode).toBeDefined();
      expect(opencode!.targetRoot).toBe(".opencode");
      expect(opencode!.targetFiles).toEqual([]);
    });
  });
});
