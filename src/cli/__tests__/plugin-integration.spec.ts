// plugin-integration.spec.ts
// Спецификация: docs/specs/integration-tests-plugins.md
// Интеграционные тесты plugin pipeline через runTranspileStep.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import matter from "gray-matter";
import { runTranspileStep } from "../transpile-step.js";
import type { TranspilerStepOutcome } from "../types.js";
import { createSkillsTranspiler, ClaudeSkillAdapter } from "../../skills-transpiler/index.js";
import { createAgentsTranspiler, ClaudeAgentAdapter } from "../../agents-transpiler/index.js";
import { createInstructionsTranspiler, ClaudeAdapter } from "../../instructions-transpiler/index.js";
import { createResourceTranspiler, type ResourceAdapter } from "../../docs-transpiler/index.js";

/**
 * Создаёт фабричную функцию для docs-транспилера с привязанным resourceType.
 * Аналог createResourceTranspilerFactory из app.tsx.
 */
function createDocsTranspilerFactory() {
  return (config: { projectRoot: string; adapters: unknown[]; agloomDir?: string }) =>
    createResourceTranspiler({
      projectRoot: config.projectRoot,
      adapters: config.adapters as ResourceAdapter[],
      resourceType: "docs",
      agloomDir: config.agloomDir,
    });
}

describe("Plugin Integration", () => {
  // --- IT-PLUGIN-01: Skills pipeline через sourceRoot ---
  describe("Plugin Skills Pipeline", () => {
    let tmpDir: string;
    let pluginDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-pi-skills-"));
      pluginDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-pi-plugin-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(pluginDir, { recursive: true, force: true });
    });

    // Спецификация: § IT-PLUGIN-01, шаги 1–5
    it("skill-пакет из plugin directory обнаруживается, транспилируется и записывается в projectRoot", () => {
      // Arrange
      const skillDir = path.join(pluginDir, "skills", "my-skill");
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, "SKILL.md"), "---\nname: my-skill\n---\nPlugin skill body.");

      // Act
      const outcome: TranspilerStepOutcome = runTranspileStep({
        transpilerFactory: createSkillsTranspiler,
        adapter: new ClaudeSkillAdapter(),
        projectRoot: tmpDir,
        sourceRoot: pluginDir,
        name: "Skills",
      });

      // Assert
      expect(outcome.errors).toEqual([]);
      expect(outcome.writtenCount).toBe(1);

      const outputPath = path.join(tmpDir, ".claude", "skills", "my-skill", "SKILL.md");
      expect(fs.existsSync(outputPath)).toBe(true);
      const content = fs.readFileSync(outputPath, "utf-8");
      expect(content).toContain("Plugin skill body.");

      // Результат: файл НЕ ДОЛЖЕН существовать в pluginDir
      const pluginOutputPath = path.join(pluginDir, ".claude", "skills", "my-skill", "SKILL.md");
      expect(fs.existsSync(pluginOutputPath)).toBe(false);
    });
  });

  // --- IT-PLUGIN-02: Agents pipeline через sourceRoot ---
  describe("Plugin Agents Pipeline", () => {
    let tmpDir: string;
    let pluginDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-pi-agents-"));
      pluginDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-pi-plugin-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(pluginDir, { recursive: true, force: true });
    });

    // Спецификация: § IT-PLUGIN-02, шаги 1–7
    it("agent definition из plugin directory обнаруживается, транспилируется и записывается в projectRoot", () => {
      // Arrange
      const agentsDir = path.join(pluginDir, "agents");
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.writeFileSync(
        path.join(agentsDir, "my-agent.md"),
        "---\nname: my-agent\nmodel: sonnet\n---\nAgent instructions.",
      );

      // Act
      const outcome: TranspilerStepOutcome = runTranspileStep({
        transpilerFactory: createAgentsTranspiler,
        adapter: new ClaudeAgentAdapter(),
        projectRoot: tmpDir,
        sourceRoot: pluginDir,
        name: "Agents",
      });

      // Assert
      expect(outcome.errors).toEqual([]);
      expect(outcome.writtenCount).toBe(1);

      const outputPath = path.join(tmpDir, ".claude", "agents", "my-agent.md");
      expect(fs.existsSync(outputPath)).toBe(true);

      const raw = fs.readFileSync(outputPath, "utf-8");
      const parsed = matter(raw);
      expect(parsed.data.name).toBe("my-agent");
      expect(parsed.content).toContain("Agent instructions.");

      // Результат: файл НЕ ДОЛЖЕН существовать в pluginDir
      const pluginOutputPath = path.join(pluginDir, ".claude", "agents", "my-agent.md");
      expect(fs.existsSync(pluginOutputPath)).toBe(false);
    });
  });

  // --- IT-PLUGIN-03: Instructions pipeline через sourceRoot ---
  describe("Plugin Instructions Pipeline", () => {
    let tmpDir: string;
    let pluginDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-pi-instructions-"));
      pluginDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-pi-plugin-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(pluginDir, { recursive: true, force: true });
    });

    // Спецификация: § IT-PLUGIN-03, шаги 1–5
    it("AGLOOM.md из plugin directory обнаруживается, транспилируется и записывается в projectRoot", () => {
      // Arrange
      fs.writeFileSync(path.join(pluginDir, "AGLOOM.md"), "Plugin instructions.");

      // Act
      const outcome: TranspilerStepOutcome = runTranspileStep({
        transpilerFactory: createInstructionsTranspiler,
        adapter: new ClaudeAdapter(),
        projectRoot: tmpDir,
        sourceRoot: pluginDir,
        name: "Instructions",
      });

      // Assert
      expect(outcome.errors).toEqual([]);
      expect(outcome.writtenCount).toBe(1);

      const outputPath = path.join(tmpDir, "CLAUDE.md");
      expect(fs.existsSync(outputPath)).toBe(true);
      const content = fs.readFileSync(outputPath, "utf-8");
      expect(content).toBe("Plugin instructions.");

      // Результат: файл НЕ ДОЛЖЕН существовать в pluginDir
      expect(fs.existsSync(path.join(pluginDir, "CLAUDE.md"))).toBe(false);
    });
  });

  // --- IT-PLUGIN-04: Docs pipeline через sourceRoot ---
  describe("Plugin Docs Pipeline", () => {
    let tmpDir: string;
    let pluginDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-pi-docs-"));
      pluginDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-pi-plugin-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(pluginDir, { recursive: true, force: true });
    });

    // Спецификация: § IT-PLUGIN-04, шаги 1–5
    it("документ из plugin directory обнаруживается, транспилируется и записывается в projectRoot", () => {
      // Arrange
      const docsDir = path.join(pluginDir, "docs");
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(path.join(docsDir, "guide.md"), "# Plugin Guide\n\nGuide content.");

      const docsAdapter: ResourceAdapter = {
        agentId: "claude",
        targetDir: ".claude/docs",
      };

      // Act
      const outcome: TranspilerStepOutcome = runTranspileStep({
        transpilerFactory: createDocsTranspilerFactory(),
        adapter: docsAdapter,
        projectRoot: tmpDir,
        sourceRoot: pluginDir,
        name: "Docs",
      });

      // Assert
      expect(outcome.errors).toEqual([]);
      expect(outcome.writtenCount).toBe(1);

      const outputPath = path.join(tmpDir, ".claude", "docs", "guide.md");
      expect(fs.existsSync(outputPath)).toBe(true);
      const content = fs.readFileSync(outputPath, "utf-8");
      expect(content).toContain("Guide content.");

      // Результат: файл НЕ ДОЛЖЕН существовать в pluginDir
      const pluginOutputPath = path.join(pluginDir, ".claude", "docs", "guide.md");
      expect(fs.existsSync(pluginOutputPath)).toBe(false);
    });
  });

  // --- IT-PLUGIN-05: Plugin + local project — local overrides plugin ---
  describe("Plugin Override — Local Project Priority", () => {
    let tmpDir: string;
    let pluginDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-pi-override-"));
      pluginDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-pi-plugin-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(pluginDir, { recursive: true, force: true });
    });

    // Спецификация: § IT-PLUGIN-05, шаги 1–7
    it("при последовательной транспиляции plugin и local project — local перезаписывает plugin", () => {
      // Arrange: plugin skill
      const pluginSkillDir = path.join(pluginDir, "skills", "shared");
      fs.mkdirSync(pluginSkillDir, { recursive: true });
      fs.writeFileSync(path.join(pluginSkillDir, "SKILL.md"), "---\nname: shared\n---\nplugin content");

      // Arrange: local skill
      const localSkillDir = path.join(tmpDir, ".agloom", "skills", "shared");
      fs.mkdirSync(localSkillDir, { recursive: true });
      fs.writeFileSync(path.join(localSkillDir, "SKILL.md"), "---\nname: shared\n---\nlocal content");

      const adapter = new ClaudeSkillAdapter();

      // Act: transpile plugin first
      const outcome1: TranspilerStepOutcome = runTranspileStep({
        transpilerFactory: createSkillsTranspiler,
        adapter,
        projectRoot: tmpDir,
        sourceRoot: pluginDir,
        name: "Skills",
      });
      expect(outcome1.errors).toEqual([]);

      // Act: transpile local project (without sourceRoot)
      const outcome2: TranspilerStepOutcome = runTranspileStep({
        transpilerFactory: createSkillsTranspiler,
        adapter,
        projectRoot: tmpDir,
        name: "Skills",
      });
      expect(outcome2.errors).toEqual([]);

      // Assert: local content wins
      const outputPath = path.join(tmpDir, ".claude", "skills", "shared", "SKILL.md");
      const content = fs.readFileSync(outputPath, "utf-8");
      expect(content).toContain("local content");
      expect(content).not.toContain("plugin content");
    });
  });

  // --- IT-PLUGIN-06: Multiple plugins — order preserved ---
  describe("Multiple Plugins — Order Preserved", () => {
    let tmpDir: string;
    let plugin1Dir: string;
    let plugin2Dir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-pi-multi-"));
      plugin1Dir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-pi-p1-"));
      plugin2Dir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-pi-p2-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(plugin1Dir, { recursive: true, force: true });
      fs.rmSync(plugin2Dir, { recursive: true, force: true });
    });

    // Спецификация: § IT-PLUGIN-06, шаги 1–7
    it("последний плагин в порядке объявления перезаписывает результат предыдущего", () => {
      // Arrange: plugin1
      const p1SkillDir = path.join(plugin1Dir, "skills", "shared");
      fs.mkdirSync(p1SkillDir, { recursive: true });
      fs.writeFileSync(path.join(p1SkillDir, "SKILL.md"), "---\nname: shared\n---\nplugin1 content");

      // Arrange: plugin2
      const p2SkillDir = path.join(plugin2Dir, "skills", "shared");
      fs.mkdirSync(p2SkillDir, { recursive: true });
      fs.writeFileSync(path.join(p2SkillDir, "SKILL.md"), "---\nname: shared\n---\nplugin2 content");

      const adapter = new ClaudeSkillAdapter();

      // Act: transpile plugin1 first
      const outcome1: TranspilerStepOutcome = runTranspileStep({
        transpilerFactory: createSkillsTranspiler,
        adapter,
        projectRoot: tmpDir,
        sourceRoot: plugin1Dir,
        name: "Skills",
      });
      expect(outcome1.errors).toEqual([]);

      // Act: transpile plugin2 second
      const outcome2: TranspilerStepOutcome = runTranspileStep({
        transpilerFactory: createSkillsTranspiler,
        adapter,
        projectRoot: tmpDir,
        sourceRoot: plugin2Dir,
        name: "Skills",
      });
      expect(outcome2.errors).toEqual([]);

      // Assert: plugin2 content wins
      const outputPath = path.join(tmpDir, ".claude", "skills", "shared", "SKILL.md");
      const content = fs.readFileSync(outputPath, "utf-8");
      expect(content).toContain("plugin2 content");
      expect(content).not.toContain("plugin1 content");
    });
  });

  // --- IT-PLUGIN-07: Plugin skills с interpolation ---
  describe("Plugin Skills с Interpolation", () => {
    let tmpDir: string;
    let pluginDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-pi-interp-"));
      pluginDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-pi-plugin-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(pluginDir, { recursive: true, force: true });
    });

    // Спецификация: § IT-PLUGIN-07, шаги 1–6
    it("переменные интерполяции в skill-файлах плагина подставляются через variablesByAgentId", () => {
      // Arrange
      const skillDir = path.join(pluginDir, "skills", "my-skill");
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, "SKILL.md"), "---\nname: my-skill\n---\nAgents dir: ${agloom:AGENTS_DIR}");

      // Act
      const outcome: TranspilerStepOutcome = runTranspileStep({
        transpilerFactory: createSkillsTranspiler,
        adapter: new ClaudeSkillAdapter(),
        projectRoot: tmpDir,
        sourceRoot: pluginDir,
        name: "Skills",
        variablesByAgentId: { claude: { AGENTS_DIR: ".claude/agents" } },
      });

      // Assert
      expect(outcome.errors).toEqual([]);
      expect(outcome.writtenCount).toBe(1);

      const outputPath = path.join(tmpDir, ".claude", "skills", "my-skill", "SKILL.md");
      const content = fs.readFileSync(outputPath, "utf-8");
      expect(content).toContain("Agents dir: .claude/agents");
      expect(content).not.toContain("${agloom:AGENTS_DIR}");
    });
  });

  // --- IT-PLUGIN-08: Plugin agents с content transformation и path remapping ---
  describe("Plugin Agents с Content Transformation", () => {
    let tmpDir: string;
    let pluginDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-pi-transform-"));
      pluginDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-pi-plugin-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(pluginDir, { recursive: true, force: true });
    });

    // Спецификация: § IT-PLUGIN-08, шаги 1–14
    it("agent definition проходит полную трансформацию: override, фильтрация секций, path remapping", () => {
      // Arrange
      const agentsDir = path.join(pluginDir, "agents");
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.writeFileSync(
        path.join(agentsDir, "reviewer.md"),
        [
          "---",
          "name: reviewer",
          "model: sonnet",
          "override:",
          "  claude:",
          "    permissionMode: plan",
          "---",
          "General instructions.",
          "",
          "<!-- agent:claude -->",
          "Claude-specific instructions.",
          "<!-- /agent:claude -->",
          "",
          "<!-- agent:opencode -->",
          "OpenCode-specific instructions.",
          "<!-- /agent:opencode -->",
          "",
          "Shared footer.",
        ].join("\n"),
      );

      // Act
      const outcome: TranspilerStepOutcome = runTranspileStep({
        transpilerFactory: createAgentsTranspiler,
        adapter: new ClaudeAgentAdapter(),
        projectRoot: tmpDir,
        sourceRoot: pluginDir,
        name: "Agents",
      });

      // Assert
      expect(outcome.errors).toEqual([]);
      expect(outcome.writtenCount).toBe(1);

      const outputPath = path.join(tmpDir, ".claude", "agents", "reviewer.md");
      expect(fs.existsSync(outputPath)).toBe(true);

      const raw = fs.readFileSync(outputPath, "utf-8");
      const parsed = matter(raw);

      // Шаги 6–9: frontmatter проверки
      expect(parsed.data.name).toBe("reviewer");
      expect(parsed.data.model).toBe("sonnet");
      expect(parsed.data.permissionMode).toBe("plan");
      expect(parsed.data).not.toHaveProperty("override");

      // Шаги 10–14: body проверки
      const body = parsed.content;
      expect(body).toContain("General instructions.");
      expect(body).toContain("Claude-specific instructions.");
      expect(body).not.toContain("OpenCode-specific instructions.");
      expect(body).not.toContain("<!-- agent:");
      expect(body).toContain("Shared footer.");
    });
  });
});
