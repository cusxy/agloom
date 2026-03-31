// adapter-registry.spec.ts
// Спецификация: docs/specs/cli.md § Реестр адаптеров
// Спецификация: docs/specs/adapter-registry-ext.md § Обновление реестра адаптеров

import { describe, it, expect } from "vitest";
import { adapterRegistry } from "../adapter-registry.js";
import {
  ClaudeAdapter,
  OpenCodeAdapter,
  AgentsMdAdapter,
} from "../../instructions-transpiler/index.js";
import {
  ClaudeSkillAdapter,
  OpenCodeSkillAdapter,
} from "../../skills-transpiler/index.js";
import {
  ClaudeAgentAdapter,
  OpenCodeAgentAdapter,
} from "../../agents-transpiler/index.js";

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

    // --- Happy path: реестр содержит ровно 3 записи ---
    // § cli.md § Состав реестра: таблица содержит 3 записи (claude, opencode, agentsmd)
    it("содержит ровно три записи (claude, opencode и agentsmd)", () => {
      expect(adapterRegistry).toHaveLength(3);
    });

    // --- Happy path: реестр содержит запись agentsmd ---
    // § cli.md § Состав реестра: agentsmd — "AGENTS.md (Codex, OpenCode, KiloCode, ...)"
    it('содержит запись для "agentsmd" с корректными id, description и экземплярами адаптеров', () => {
      const agentsmd = adapterRegistry.find((e) => e.id === "agentsmd");
      expect(agentsmd).toBeDefined();
      expect(agentsmd!.id).toBe("agentsmd");
      expect(agentsmd!.description).toBe(
        "AGENTS.md (Codex, OpenCode, KiloCode, ...)",
      );
      // § agentsmd транспилирует только instructions (AGLOOM.md → AGENTS.md)
      expect(agentsmd!.instructions).toBeInstanceOf(AgentsMdAdapter);
      expect(agentsmd!.skills).toBeNull();
      expect(agentsmd!.agents).toBeNull();
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

    // --- Happy path: запись opencode содержит обновлённые поля ---
    // § adapter-registry-ext.md § Запись opencode: targetFiles=[], instructionsFile=null
    // § Обновление реестра адаптеров, строка opencode: targetFiles=[]
    it('запись "opencode" содержит targetRoot ".opencode" и targetFiles [] (пустой массив)', () => {
      const opencode = adapterRegistry.find((e) => e.id === "opencode");
      expect(opencode).toBeDefined();
      expect(opencode!.targetRoot).toBe(".opencode");
      expect(opencode!.targetFiles).toEqual([]);
    });

    // --- Happy path: запись claude содержит поле projectFiles ---
    // § Обновление реестра адаптеров, строка claude: projectFiles=["CLAUDE.md", "CLAUDE.local.md"]
    it('запись "claude" содержит projectFiles ["CLAUDE.md", "CLAUDE.local.md"]', () => {
      const claude = adapterRegistry.find((e) => e.id === "claude");
      expect(claude).toBeDefined();
      expect(claude!.projectFiles).toEqual(["CLAUDE.md", "CLAUDE.local.md"]);
    });

    // --- Happy path: запись opencode содержит поле projectFiles ---
    // § Обновление реестра адаптеров, строка opencode: projectFiles=[]
    // § Запись opencode: projectFiles пуст, т.к. OpenCode не имеет уникальных файлов
    it('запись "opencode" содержит projectFiles [] (пустой массив)', () => {
      const opencode = adapterRegistry.find((e) => e.id === "opencode");
      expect(opencode).toBeDefined();
      expect(opencode!.projectFiles).toEqual([]);
    });

    // --- Happy path: запись agentsmd содержит поля targetRoot, targetFiles, projectFiles ---
    // § Обновление реестра адаптеров, строка agentsmd:
    //   targetRoot=".agents", targetFiles=["AGENTS.md"], projectFiles=["AGENTS.md"]
    it('запись "agentsmd" содержит targetRoot ".agents", targetFiles ["AGENTS.md"], projectFiles ["AGENTS.md"]', () => {
      const agentsmd = adapterRegistry.find((e) => e.id === "agentsmd");
      expect(agentsmd).toBeDefined();
      expect(agentsmd!.targetRoot).toBe(".agents");
      expect(agentsmd!.targetFiles).toEqual(["AGENTS.md"]);
      expect(agentsmd!.projectFiles).toEqual(["AGENTS.md"]);
    });

    // --- Happy path: запись claude содержит поле instructionsFile ---
    // § Обновление реестра адаптеров, строка claude: instructionsFile="CLAUDE.md"
    it('запись "claude" содержит instructionsFile "CLAUDE.md"', () => {
      const claude = adapterRegistry.find((e) => e.id === "claude");
      expect(claude).toBeDefined();
      expect(claude!.instructionsFile).toBe("CLAUDE.md");
    });

    // --- Happy path: запись opencode содержит поле instructionsFile ---
    // § Обновление реестра адаптеров, строка opencode: instructionsFile=null
    // § Запись opencode: instructionsFile null, т.к. OpenCode не имеет собственного формата
    it('запись "opencode" содержит instructionsFile null', () => {
      const opencode = adapterRegistry.find((e) => e.id === "opencode");
      expect(opencode).toBeDefined();
      expect(opencode!.instructionsFile).toBeNull();
    });

    // --- Happy path: запись agentsmd содержит поле instructionsFile ---
    // § Обновление реестра адаптеров, строка agentsmd: instructionsFile="AGENTS.md"
    it('запись "agentsmd" содержит instructionsFile "AGENTS.md"', () => {
      const agentsmd = adapterRegistry.find((e) => e.id === "agentsmd");
      expect(agentsmd).toBeDefined();
      expect(agentsmd!.instructionsFile).toBe("AGENTS.md");
    });

    // --- Happy path: запись claude содержит поле dependsOn ---
    // § Обновление реестра адаптеров, строка claude: dependsOn=[]
    it('запись "claude" содержит dependsOn [] (пустой массив)', () => {
      const claude = adapterRegistry.find((e) => e.id === "claude");
      expect(claude).toBeDefined();
      expect(claude!.dependsOn).toEqual([]);
    });

    // --- Happy path: запись opencode содержит поле dependsOn ---
    // § Обновление реестра адаптеров, строка opencode: dependsOn=["agentsmd"]
    it('запись "opencode" содержит dependsOn ["agentsmd"]', () => {
      const opencode = adapterRegistry.find((e) => e.id === "opencode");
      expect(opencode).toBeDefined();
      expect(opencode!.dependsOn).toEqual(["agentsmd"]);
    });

    // --- Happy path: запись agentsmd содержит поле dependsOn ---
    // § Обновление реестра адаптеров, строка agentsmd: dependsOn=[]
    it('запись "agentsmd" содержит dependsOn [] (пустой массив)', () => {
      const agentsmd = adapterRegistry.find((e) => e.id === "agentsmd");
      expect(agentsmd).toBeDefined();
      expect(agentsmd!.dependsOn).toEqual([]);
    });

    // =====================================================================
    // § adapter-registry-ext.md § Обновление реестра адаптеров — поле hidden
    // =====================================================================

    // --- Happy path: запись claude содержит поле hidden ---
    // § Обновление реестра адаптеров, строка claude: hidden=false
    it('запись "claude" содержит hidden false', () => {
      const claude = adapterRegistry.find((e) => e.id === "claude");
      expect(claude).toBeDefined();
      expect(claude).toHaveProperty("hidden", false);
    });

    // --- Happy path: запись opencode содержит поле hidden ---
    // § Обновление реестра адаптеров, строка opencode: hidden=false
    it('запись "opencode" содержит hidden false', () => {
      const opencode = adapterRegistry.find((e) => e.id === "opencode");
      expect(opencode).toBeDefined();
      expect(opencode).toHaveProperty("hidden", false);
    });

    // --- Happy path: запись agentsmd содержит поле hidden ---
    // § Обновление реестра адаптеров, строка agentsmd: hidden=true
    it('запись "agentsmd" содержит hidden true', () => {
      const agentsmd = adapterRegistry.find((e) => e.id === "agentsmd");
      expect(agentsmd).toBeDefined();
      expect(agentsmd).toHaveProperty("hidden", true);
    });
  });

  // =====================================================================
  // Спецификация: docs/specs/interpolation.md § Расширение AdapterRegistryEntry
  // § Обновление реестра адаптеров — поле paths
  // =====================================================================

  describe("Расширение реестра адаптеров — поле paths", () => {
    // --- Happy path: запись claude содержит поле paths с корректными значениями ---
    // § Обновление реестра адаптеров, строка claude: paths.skills=".claude/skills", paths.agents=".claude/agents", paths.docs=".claude/docs", paths.schemas=".claude/schemas"
    it('запись "claude" содержит paths с корректными значениями для skills, agents, docs, schemas', () => {
      const claude = adapterRegistry.find((e) => e.id === "claude");
      expect(claude).toBeDefined();
      expect(claude!.paths).toBeDefined();
      expect(claude!.paths.skills).toBe(".claude/skills");
      expect(claude!.paths.agents).toBe(".claude/agents");
      expect(claude!.paths.docs).toBe(".claude/docs");
      expect(claude!.paths.schemas).toBe(".claude/schemas");
    });

    // --- Happy path: запись opencode содержит поле paths с корректными значениями ---
    // § Обновление реестра адаптеров, строка opencode: paths.skills=".opencode/skills", paths.agents=".opencode/agents", paths.docs=".opencode/docs", paths.schemas=".opencode/schemas"
    it('запись "opencode" содержит paths с корректными значениями для skills, agents, docs, schemas', () => {
      const opencode = adapterRegistry.find((e) => e.id === "opencode");
      expect(opencode).toBeDefined();
      expect(opencode!.paths).toBeDefined();
      expect(opencode!.paths.skills).toBe(".opencode/skills");
      expect(opencode!.paths.agents).toBe(".opencode/agents");
      expect(opencode!.paths.docs).toBe(".opencode/docs");
      expect(opencode!.paths.schemas).toBe(".opencode/schemas");
    });

    // --- Happy path: запись agentsmd содержит пустой объект paths ---
    // § Обновление реестра адаптеров: agentsmd ДОЛЖНА иметь пустой объект paths: {}
    it('запись "agentsmd" содержит пустой объект paths', () => {
      const agentsmd = adapterRegistry.find((e) => e.id === "agentsmd");
      expect(agentsmd).toBeDefined();
      expect(agentsmd!.paths).toBeDefined();
      expect(Object.keys(agentsmd!.paths)).toHaveLength(0);
    });
  });
});
