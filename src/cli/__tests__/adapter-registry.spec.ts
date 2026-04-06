// adapter-registry.spec.ts
// Спецификация: docs/specs/cli.md § Реестр адаптеров
// Спецификация: docs/specs/adapter-registry-ext.md § Обновление реестра адаптеров

import { describe, it, expect } from "vitest";
import { adapterRegistry } from "../adapter-registry.js";
import { ClaudeAdapter, OpenCodeAdapter, AgentsMdAdapter } from "../../instructions-transpiler/index.js";
import { GeminiAdapter } from "../../instructions-transpiler/adapters/gemini-adapter.js";
import { KiloCodeAdapter } from "../../instructions-transpiler/adapters/kilocode-adapter.js";
import { CodexAdapter } from "../../instructions-transpiler/adapters/codex-adapter.js";
import { ClaudeSkillAdapter, OpenCodeSkillAdapter } from "../../skills-transpiler/index.js";
import { KiloCodeSkillAdapter } from "../../skills-transpiler/adapters/kilocode-adapter.js";
import { CodexSkillAdapter } from "../../skills-transpiler/adapters/codex-adapter.js";
import { GeminiSkillAdapter } from "../../skills-transpiler/adapters/gemini-adapter.js";
import { ClaudeAgentAdapter, OpenCodeAgentAdapter } from "../../agents-transpiler/index.js";
import { KiloCodeAgentAdapter } from "../../agents-transpiler/adapters/kilocode-adapter.js";
import { GeminiAgentAdapter } from "../../agents-transpiler/adapters/gemini-adapter.js";
import { CodexAgentAdapter } from "../../agents-transpiler/adapters/codex-adapter.js";

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

    // --- Happy path: реестр содержит ровно 6 записей ---
    // § adapter-registry-ext.md § Обновление реестра адаптеров:
    // 6 записей: claude, opencode, agentsmd, kilocode, codex, gemini
    it("содержит ровно шесть записей (claude, opencode, agentsmd, kilocode, codex, gemini)", () => {
      expect(adapterRegistry).toHaveLength(6);
      const ids = adapterRegistry.map((e) => e.id);
      expect(ids).toContain("claude");
      expect(ids).toContain("opencode");
      expect(ids).toContain("agentsmd");
      expect(ids).toContain("kilocode");
      expect(ids).toContain("codex");
      expect(ids).toContain("gemini");
    });

    // --- Happy path: реестр содержит запись agentsmd ---
    // § cli.md § Состав реестра: agentsmd — "AGENTS.md (Codex, OpenCode, KiloCode, ...)"
    it('содержит запись для "agentsmd" с корректными id, description и экземплярами адаптеров', () => {
      const agentsmd = adapterRegistry.find((e) => e.id === "agentsmd");
      expect(agentsmd).toBeDefined();
      expect(agentsmd!.id).toBe("agentsmd");
      expect(agentsmd!.description).toBe("AGENTS.md (Codex, OpenCode, KiloCode, ...)");
      // § agentsmd транспилирует только instructions (AGLOOM.md → AGENTS.md)
      expect(agentsmd!.instructions).toBeInstanceOf(AgentsMdAdapter);
      expect(agentsmd!.skills).toBeNull();
      expect(agentsmd!.agents).toBeNull();
    });
  });

  // Спецификация: docs/specs/adapter-registry-ext.md § Обновление реестра адаптеров
  describe("Расширение реестра адаптеров", () => {
    // --- Удаление targetRoot: записи реестра НЕ содержат поле targetRoot ---
    // § adapter-registry-ext.md § Расширение AdapterRegistryEntry: поле targetRoot отсутствует
    it('запись "claude" НЕ содержит поле targetRoot', () => {
      const claude = adapterRegistry.find((e) => e.id === "claude");
      expect(claude).toBeDefined();
      expect(claude).not.toHaveProperty("targetRoot");
    });

    it('запись "opencode" НЕ содержит поле targetRoot', () => {
      const opencode = adapterRegistry.find((e) => e.id === "opencode");
      expect(opencode).toBeDefined();
      expect(opencode).not.toHaveProperty("targetRoot");
    });

    it('запись "agentsmd" НЕ содержит поле targetRoot', () => {
      const agentsmd = adapterRegistry.find((e) => e.id === "agentsmd");
      expect(agentsmd).toBeDefined();
      expect(agentsmd).not.toHaveProperty("targetRoot");
    });

    // --- Happy path: запись claude содержит targetFiles ---
    // § Обновление реестра адаптеров, строка claude: targetFiles=["CLAUDE.md", ".mcp.json"]
    it('запись "claude" содержит targetFiles ["CLAUDE.md", ".mcp.json"]', () => {
      const claude = adapterRegistry.find((e) => e.id === "claude");
      expect(claude).toBeDefined();
      expect(claude!.targetFiles).toEqual(["CLAUDE.md", ".mcp.json"]);
    });

    // --- Happy path: запись opencode содержит targetFiles ---
    // § adapter-registry-ext.md § Запись opencode: targetFiles=["opencode.json"]
    it('запись "opencode" содержит targetFiles ["opencode.json"]', () => {
      const opencode = adapterRegistry.find((e) => e.id === "opencode");
      expect(opencode).toBeDefined();
      expect(opencode!.targetFiles).toEqual(["opencode.json"]);
    });

    // --- Happy path: запись agentsmd содержит targetFiles ---
    // § Обновление реестра адаптеров, строка agentsmd: targetFiles=["AGENTS.md", "AGENTS.override.md"]
    it('запись "agentsmd" содержит targetFiles ["AGENTS.md", "AGENTS.override.md"]', () => {
      const agentsmd = adapterRegistry.find((e) => e.id === "agentsmd");
      expect(agentsmd).toBeDefined();
      expect(agentsmd!.targetFiles).toEqual(["AGENTS.md", "AGENTS.override.md"]);
    });

    // --- Happy path: запись claude содержит поле projectFiles ---
    // § Обновление реестра адаптеров, строка claude: projectFiles=["CLAUDE.md"]
    it('запись "claude" содержит projectFiles ["CLAUDE.md"]', () => {
      const claude = adapterRegistry.find((e) => e.id === "claude");
      expect(claude).toBeDefined();
      expect(claude!.projectFiles).toEqual(["CLAUDE.md"]);
    });

    // --- Happy path: запись opencode содержит поле projectFiles ---
    // § Обновление реестра адаптеров, строка opencode: projectFiles=[]
    it('запись "opencode" содержит projectFiles [] (пустой массив)', () => {
      const opencode = adapterRegistry.find((e) => e.id === "opencode");
      expect(opencode).toBeDefined();
      expect(opencode!.projectFiles).toEqual([]);
    });

    // --- Happy path: запись agentsmd содержит поле projectFiles ---
    // § Обновление реестра адаптеров, строка agentsmd: projectFiles=["AGENTS.md", "AGENTS.override.md"]
    it('запись "agentsmd" содержит projectFiles ["AGENTS.md", "AGENTS.override.md"]', () => {
      const agentsmd = adapterRegistry.find((e) => e.id === "agentsmd");
      expect(agentsmd).toBeDefined();
      expect(agentsmd!.projectFiles).toEqual(["AGENTS.md", "AGENTS.override.md"]);
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
    // § adapter-registry-ext.md § Обновление реестра адаптеров — поле overlayImportPaths
    // =====================================================================

    // --- Happy path: запись claude содержит поле overlayImportPaths ---
    // § Обновление реестра адаптеров, строка claude: overlayImportPaths=[".claude", "**/CLAUDE.md", ".mcp.json"]
    it('запись "claude" содержит overlayImportPaths [".claude", "**/CLAUDE.md", ".mcp.json"]', () => {
      const claude = adapterRegistry.find((e) => e.id === "claude");
      expect(claude).toBeDefined();
      expect(claude!.overlayImportPaths).toEqual([".claude", "**/CLAUDE.md", ".mcp.json"]);
    });

    // --- Happy path: запись opencode содержит поле overlayImportPaths ---
    // § Обновление реестра адаптеров, строка opencode: overlayImportPaths=[".opencode", "opencode.json"]
    it('запись "opencode" содержит overlayImportPaths [".opencode", "opencode.json"]', () => {
      const opencode = adapterRegistry.find((e) => e.id === "opencode");
      expect(opencode).toBeDefined();
      expect(opencode!.overlayImportPaths).toEqual([".opencode", "opencode.json"]);
    });

    // --- Happy path: запись agentsmd содержит поле overlayImportPaths ---
    // § Обновление реестра адаптеров, строка agentsmd: overlayImportPaths=[".agents", "**/AGENTS.md", "**/AGENTS.override.md"]
    it('запись "agentsmd" содержит overlayImportPaths [".agents", "**/AGENTS.md", "**/AGENTS.override.md"]', () => {
      const agentsmd = adapterRegistry.find((e) => e.id === "agentsmd");
      expect(agentsmd).toBeDefined();
      expect(agentsmd!.overlayImportPaths).toEqual([".agents", "**/AGENTS.md", "**/AGENTS.override.md"]);
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
  // Спецификация: docs/specs/adapter-registry-ext.md § Расширение AdapterRegistryEntry — поле paths
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

    // --- Happy path: запись kilocode содержит поле paths ---
    // § Обновление реестра адаптеров, строка kilocode: paths.skills=".kilo/skills", paths.agents=".kilo/agents", paths.docs=".kilo/docs", paths.schemas=".kilo/schemas"
    it('запись "kilocode" содержит paths с корректными значениями', () => {
      const kilocode = adapterRegistry.find((e) => e.id === "kilocode");
      expect(kilocode).toBeDefined();
      expect(kilocode!.paths).toBeDefined();
      expect(kilocode!.paths.skills).toBe(".kilo/skills");
      expect(kilocode!.paths.agents).toBe(".kilo/agents");
      expect(kilocode!.paths.docs).toBe(".kilo/docs");
      expect(kilocode!.paths.schemas).toBe(".kilo/schemas");
    });

    // --- Happy path: запись codex содержит поле paths ---
    // § Обновление реестра адаптеров, строка codex: paths.skills=".agents/skills", paths.agents=".codex/agents"
    // § Запись codex: skills размещаются в .agents/skills/ (НЕ .codex/skills/)
    it('запись "codex" содержит paths с skills=".agents/skills", agents=".codex/agents", docs=".codex/docs", schemas=".codex/schemas"', () => {
      const codex = adapterRegistry.find((e) => e.id === "codex");
      expect(codex).toBeDefined();
      expect(codex!.paths).toBeDefined();
      expect(codex!.paths.skills).toBe(".agents/skills");
      expect(codex!.paths.agents).toBe(".codex/agents");
      // § Запись codex (обновлено): paths.docs=".codex/docs", paths.schemas=".codex/schemas"
      expect(codex!.paths.docs).toBe(".codex/docs");
      expect(codex!.paths.schemas).toBe(".codex/schemas");
    });

    // =====================================================================
    // § adapter-registry-ext.md § Расширение AdapterRegistryEntry — paths.commands
    // =====================================================================

    // --- claude.paths.commands ---
    // § Обновление реестра адаптеров: claude.paths.commands = ".claude/commands"
    it('запись "claude" содержит paths.commands ".claude/commands"', () => {
      const claude = adapterRegistry.find((e) => e.id === "claude");
      expect(claude).toBeDefined();
      expect(claude!.paths.commands).toBe(".claude/commands");
    });

    // --- opencode.paths.commands ---
    // § Обновление реестра адаптеров: opencode.paths.commands = ".opencode/commands"
    it('запись "opencode" содержит paths.commands ".opencode/commands"', () => {
      const opencode = adapterRegistry.find((e) => e.id === "opencode");
      expect(opencode).toBeDefined();
      expect(opencode!.paths.commands).toBe(".opencode/commands");
    });

    // --- kilocode.paths.commands ---
    // § Обновление реестра адаптеров: kilocode.paths.commands = ".kilo/commands"
    it('запись "kilocode" содержит paths.commands ".kilo/commands"', () => {
      const kilocode = adapterRegistry.find((e) => e.id === "kilocode");
      expect(kilocode).toBeDefined();
      expect(kilocode!.paths.commands).toBe(".kilo/commands");
    });

    // --- gemini.paths.commands ---
    // § Обновление реестра адаптеров: gemini.paths.commands = ".gemini/commands"
    it('запись "gemini" содержит paths.commands ".gemini/commands"', () => {
      const gemini = adapterRegistry.find((e) => e.id === "gemini");
      expect(gemini).toBeDefined();
      expect(gemini!.paths.commands).toBe(".gemini/commands");
    });

    // --- codex.paths.commands ОТСУТСТВУЕТ ---
    // § Запись codex: «Подполе paths.commands ОТСУТСТВУЕТ»
    it('запись "codex" НЕ содержит paths.commands', () => {
      const codex = adapterRegistry.find((e) => e.id === "codex");
      expect(codex).toBeDefined();
      expect(codex!.paths.commands).toBeUndefined();
    });

    // --- codex.paths.docs = ".codex/docs" ---
    // § Запись codex: paths.docs = ".codex/docs"
    it('запись "codex" содержит paths.docs ".codex/docs"', () => {
      const codex = adapterRegistry.find((e) => e.id === "codex");
      expect(codex).toBeDefined();
      expect(codex!.paths.docs).toBe(".codex/docs");
    });

    // --- codex.paths.schemas = ".codex/schemas" ---
    // § Запись codex: paths.schemas = ".codex/schemas"
    it('запись "codex" содержит paths.schemas ".codex/schemas"', () => {
      const codex = adapterRegistry.find((e) => e.id === "codex");
      expect(codex).toBeDefined();
      expect(codex!.paths.schemas).toBe(".codex/schemas");
    });

    // --- agentsmd.paths без commands ---
    // § Обновление реестра адаптеров: agentsmd.paths = {} (пустой)
    it('запись "agentsmd" не содержит paths.commands (пустой объект paths)', () => {
      const agentsmd = adapterRegistry.find((e) => e.id === "agentsmd");
      expect(agentsmd).toBeDefined();
      expect(agentsmd!.paths.commands).toBeUndefined();
    });

    // --- Happy path: запись gemini содержит поле paths ---
    // § Обновление реестра адаптеров, строка gemini: paths.skills=".gemini/skills", paths.agents=".gemini/agents", paths.docs=".gemini/docs", paths.schemas=".gemini/schemas"
    it('запись "gemini" содержит paths с корректными значениями', () => {
      const gemini = adapterRegistry.find((e) => e.id === "gemini");
      expect(gemini).toBeDefined();
      expect(gemini!.paths).toBeDefined();
      expect(gemini!.paths.skills).toBe(".gemini/skills");
      expect(gemini!.paths.agents).toBe(".gemini/agents");
      expect(gemini!.paths.docs).toBe(".gemini/docs");
      expect(gemini!.paths.schemas).toBe(".gemini/schemas");
    });
  });

  // =====================================================================
  // Спецификация: docs/specs/adapter-registry-ext.md § Записи kilocode, codex, gemini
  // =====================================================================

  describe("Новые записи реестра (kilocode, codex, gemini)", () => {
    // --- Happy path: запись kilocode ---
    // § Запись kilocode: id="kilocode", dependsOn=["agentsmd"], instructionsFile=null, hidden=false
    it('содержит запись для "kilocode" с корректными id и description', () => {
      const kilocode = adapterRegistry.find((e) => e.id === "kilocode");
      expect(kilocode).toBeDefined();
      expect(kilocode!.id).toBe("kilocode");
      expect(kilocode!.description).toBe("KiloCode");
    });

    it('запись "kilocode" содержит экземпляры адаптеров для instructions, skills и agents', () => {
      const kilocode = adapterRegistry.find((e) => e.id === "kilocode");
      expect(kilocode).toBeDefined();
      expect(kilocode!.instructions).toBeInstanceOf(KiloCodeAdapter);
      expect(kilocode!.skills).toBeInstanceOf(KiloCodeSkillAdapter);
      expect(kilocode!.agents).toBeInstanceOf(KiloCodeAgentAdapter);
    });

    it('запись "kilocode" содержит instructionsFile null', () => {
      const kilocode = adapterRegistry.find((e) => e.id === "kilocode");
      expect(kilocode).toBeDefined();
      expect(kilocode!.instructionsFile).toBeNull();
    });

    it('запись "kilocode" содержит dependsOn ["agentsmd"]', () => {
      const kilocode = adapterRegistry.find((e) => e.id === "kilocode");
      expect(kilocode).toBeDefined();
      expect(kilocode!.dependsOn).toEqual(["agentsmd"]);
    });

    it('запись "kilocode" содержит hidden false', () => {
      const kilocode = adapterRegistry.find((e) => e.id === "kilocode");
      expect(kilocode).toBeDefined();
      expect(kilocode).toHaveProperty("hidden", false);
    });

    it('запись "kilocode" содержит targetFiles [] (пустой массив)', () => {
      const kilocode = adapterRegistry.find((e) => e.id === "kilocode");
      expect(kilocode).toBeDefined();
      expect(kilocode!.targetFiles).toEqual([]);
    });

    it('запись "kilocode" содержит overlayImportPaths [".kilo"]', () => {
      const kilocode = adapterRegistry.find((e) => e.id === "kilocode");
      expect(kilocode).toBeDefined();
      expect(kilocode!.overlayImportPaths).toEqual([".kilo"]);
    });

    // --- Happy path: запись kilocode содержит поле projectFiles ---
    // § Обновление реестра адаптеров, строка kilocode: projectFiles=[]
    it('запись "kilocode" содержит projectFiles [] (пустой массив)', () => {
      const kilocode = adapterRegistry.find((e) => e.id === "kilocode");
      expect(kilocode).toBeDefined();
      expect(kilocode!.projectFiles).toEqual([]);
    });

    // --- Happy path: запись codex ---
    // § Запись codex: id="codex", dependsOn=["agentsmd"], instructionsFile=null, hidden=false
    it('содержит запись для "codex" с корректными id и description', () => {
      const codex = adapterRegistry.find((e) => e.id === "codex");
      expect(codex).toBeDefined();
      expect(codex!.id).toBe("codex");
      expect(codex!.description).toBe("Codex");
    });

    it('запись "codex" содержит экземпляры адаптеров для instructions, skills и agents', () => {
      const codex = adapterRegistry.find((e) => e.id === "codex");
      expect(codex).toBeDefined();
      expect(codex!.instructions).toBeInstanceOf(CodexAdapter);
      expect(codex!.skills).toBeInstanceOf(CodexSkillAdapter);
      expect(codex!.agents).toBeInstanceOf(CodexAgentAdapter);
    });

    it('запись "codex" содержит instructionsFile null', () => {
      const codex = adapterRegistry.find((e) => e.id === "codex");
      expect(codex).toBeDefined();
      expect(codex!.instructionsFile).toBeNull();
    });

    it('запись "codex" содержит dependsOn ["agentsmd"]', () => {
      const codex = adapterRegistry.find((e) => e.id === "codex");
      expect(codex).toBeDefined();
      expect(codex!.dependsOn).toEqual(["agentsmd"]);
    });

    it('запись "codex" содержит hidden false', () => {
      const codex = adapterRegistry.find((e) => e.id === "codex");
      expect(codex).toBeDefined();
      expect(codex).toHaveProperty("hidden", false);
    });

    it('запись "codex" содержит targetFiles [] (пустой массив)', () => {
      const codex = adapterRegistry.find((e) => e.id === "codex");
      expect(codex).toBeDefined();
      expect(codex!.targetFiles).toEqual([]);
    });

    it('запись "codex" содержит overlayImportPaths [".codex", ".agents"]', () => {
      const codex = adapterRegistry.find((e) => e.id === "codex");
      expect(codex).toBeDefined();
      expect(codex!.overlayImportPaths).toEqual([".codex", ".agents"]);
    });

    // --- Happy path: запись codex содержит поле projectFiles ---
    // § Обновление реестра адаптеров, строка codex: projectFiles=[]
    it('запись "codex" содержит projectFiles [] (пустой массив)', () => {
      const codex = adapterRegistry.find((e) => e.id === "codex");
      expect(codex).toBeDefined();
      expect(codex!.projectFiles).toEqual([]);
    });

    // --- Happy path: запись gemini ---
    // § Запись gemini: id="gemini", dependsOn=[], instructionsFile="GEMINI.md", hidden=false
    it('содержит запись для "gemini" с корректными id и description', () => {
      const gemini = adapterRegistry.find((e) => e.id === "gemini");
      expect(gemini).toBeDefined();
      expect(gemini!.id).toBe("gemini");
      expect(gemini!.description).toBe("Gemini");
    });

    it('запись "gemini" содержит экземпляры адаптеров для instructions, skills и agents', () => {
      const gemini = adapterRegistry.find((e) => e.id === "gemini");
      expect(gemini).toBeDefined();
      expect(gemini!.instructions).toBeInstanceOf(GeminiAdapter);
      expect(gemini!.skills).toBeInstanceOf(GeminiSkillAdapter);
      expect(gemini!.agents).toBeInstanceOf(GeminiAgentAdapter);
    });

    it('запись "gemini" содержит instructionsFile "GEMINI.md"', () => {
      const gemini = adapterRegistry.find((e) => e.id === "gemini");
      expect(gemini).toBeDefined();
      expect(gemini!.instructionsFile).toBe("GEMINI.md");
    });

    it('запись "gemini" содержит dependsOn [] (пустой массив)', () => {
      const gemini = adapterRegistry.find((e) => e.id === "gemini");
      expect(gemini).toBeDefined();
      expect(gemini!.dependsOn).toEqual([]);
    });

    it('запись "gemini" содержит hidden false', () => {
      const gemini = adapterRegistry.find((e) => e.id === "gemini");
      expect(gemini).toBeDefined();
      expect(gemini).toHaveProperty("hidden", false);
    });

    it('запись "gemini" содержит targetFiles ["GEMINI.md"]', () => {
      const gemini = adapterRegistry.find((e) => e.id === "gemini");
      expect(gemini).toBeDefined();
      expect(gemini!.targetFiles).toEqual(["GEMINI.md"]);
    });

    it('запись "gemini" содержит overlayImportPaths [".gemini", "**/GEMINI.md"]', () => {
      const gemini = adapterRegistry.find((e) => e.id === "gemini");
      expect(gemini).toBeDefined();
      expect(gemini!.overlayImportPaths).toEqual([".gemini", "**/GEMINI.md"]);
    });

    // --- Happy path: запись gemini содержит поле projectFiles ---
    // § Обновление реестра адаптеров, строка gemini: projectFiles=["GEMINI.md"]
    it('запись "gemini" содержит projectFiles ["GEMINI.md"]', () => {
      const gemini = adapterRegistry.find((e) => e.id === "gemini");
      expect(gemini).toBeDefined();
      expect(gemini!.projectFiles).toEqual(["GEMINI.md"]);
    });

    // --- allowedAgentIds: "gemini" включён ---
    // § instructions-transpiler.md § Валидация допустимых agentId:
    // "gemini" — допустим (GEMINI.md)
    it('allowedAgentIds включает "gemini" (instructionsFile не null)', () => {
      // Проверяем через экземпляры адаптеров: gemini имеет instructionsFile,
      // значит он должен быть в allowedAgentIds
      const entriesWithInstructionsFile = adapterRegistry.filter((e) => e.instructionsFile !== null).map((e) => e.id);
      expect(entriesWithInstructionsFile).toContain("claude");
      expect(entriesWithInstructionsFile).toContain("agentsmd");
      expect(entriesWithInstructionsFile).toContain("gemini");
      // kilocode и codex НЕ имеют instructionsFile
      expect(entriesWithInstructionsFile).not.toContain("kilocode");
      expect(entriesWithInstructionsFile).not.toContain("codex");
    });
  });
});
