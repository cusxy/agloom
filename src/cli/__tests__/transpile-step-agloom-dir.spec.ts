// transpile-step-agloom-dir.spec.ts
// Спецификация: docs/specs/plugin-loading.md § Расширение процедуры «Шаг транспиляции» (параметр agloomDir)
// Спецификация: docs/specs/plugin-loading.md § Интеграция с транспилерами

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { runTranspileStep } from "../transpile-step.js";
import type { TranspilerStepOutcome } from "../types.js";

/**
 * Создаёт spy-фабрику транспилера, которая записывает параметры создания
 * и возвращает минимальный рабочий транспилер.
 */
function createSpyFactory() {
  const calls: Array<{
    projectRoot: string;
    adapters: unknown[];
    agloomDir?: string;
  }> = [];

  const factory = (config: {
    projectRoot: string;
    adapters: unknown[];
    agloomDir?: string;
  }) => {
    calls.push({ ...config });
    return {
      transpile: () => [],
      writeResults: (
        _results: unknown[],
        _opts?: Record<string, unknown> | { targetRoot: string },
      ) => ({
        written: [] as string[],
        errors: [] as { message: string }[],
      }),
    };
  };

  return { factory, calls };
}

function createStubAdapter(agentId = "claude") {
  return { agentId, targetDir: `.${agentId}/skills`, transpile: () => [] };
}

describe("CLI", () => {
  describe("Расширение процедуры «Шаг транспиляции» — параметр agloomDir", () => {
    let tmpDir: string;
    let pluginDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-step-agloom-"));
      pluginDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-plugin-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(pluginDir, { recursive: true, force: true });
    });

    // --- Спецификация: § Расширение процедуры «Шаг транспиляции», шаг 1 ---
    // "Если sourceRoot передан, agloomDir ДОЛЖЕН быть «.»."
    // transpilerFactory вызывается с { projectRoot: sourceRoot, adapters: [adapter], agloomDir: "." }
    it('при наличии sourceRoot передаёт agloomDir: "." в transpilerFactory', () => {
      const { factory, calls } = createSpyFactory();

      runTranspileStep({
        transpilerFactory: factory as Parameters<
          typeof runTranspileStep
        >[0]["transpilerFactory"],
        adapter: createStubAdapter(),
        projectRoot: tmpDir,
        name: "Skills",
        sourceRoot: pluginDir,
      });

      expect(calls).toHaveLength(1);
      expect(calls[0].projectRoot).toBe(pluginDir);
      expect(calls[0].agloomDir).toBe(".");
    });

    // --- Спецификация: § Расширение процедуры «Шаг транспиляции», шаг 1 ---
    // "Если sourceRoot не передан, agloomDir не передаётся
    //  (транспилер использует значение по умолчанию «.agloom»)."
    it("без sourceRoot не передаёт agloomDir в transpilerFactory", () => {
      const { factory, calls } = createSpyFactory();

      runTranspileStep({
        transpilerFactory: factory as Parameters<
          typeof runTranspileStep
        >[0]["transpilerFactory"],
        adapter: createStubAdapter(),
        projectRoot: tmpDir,
        name: "Skills",
      });

      expect(calls).toHaveLength(1);
      expect(calls[0].projectRoot).toBe(tmpDir);
      expect(calls[0].agloomDir).toBeUndefined();
    });
  });

  describe("Интеграция с транспилерами — agloomDir", () => {
    let tmpDir: string;
    let pluginDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-integ-"));
      pluginDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-plugin-integ-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(pluginDir, { recursive: true, force: true });
    });

    // --- Спецификация: § Интеграция с транспилерами ---
    // "Skills-транспилер обнаруживает навыки в <plugin.path>/skills/ (через agloomDir: «.»)."
    // Тест: реальный skills transpiler с agloomDir: "." обнаруживает skills/ в корне sourceRoot.
    it('Skills-транспилер обнаруживает навыки в <sourceRoot>/skills/ при agloomDir: "."', async () => {
      // Arrange: создаём skill в pluginDir/skills/demo-skill/SKILL.md
      const skillDir = path.join(pluginDir, "skills", "demo-skill");
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(
        path.join(skillDir, "SKILL.md"),
        "---\nname: demo-skill\n---\nDemo skill content.",
      );

      // Целевая директория для записи
      const targetSkillDir = path.join(tmpDir, ".claude", "skills");
      fs.mkdirSync(targetSkillDir, { recursive: true });

      const { createSkillsTranspiler, ClaudeSkillAdapter } =
        await import("../../skills-transpiler/index.js");

      const outcome: TranspilerStepOutcome = runTranspileStep({
        transpilerFactory: createSkillsTranspiler,
        adapter: new ClaudeSkillAdapter(),
        projectRoot: tmpDir,
        name: "Skills",
        sourceRoot: pluginDir,
      });

      // Ожидаем: навык обнаружен и записан без ошибок
      expect(outcome.errors).toEqual([]);
      expect(outcome.writtenCount).toBeGreaterThan(0);
    });

    // --- Спецификация: § Интеграция с транспилерами ---
    // "Agents-транспилер обнаруживает агентов в <plugin.path>/agents/ (через agloomDir: «.»)."
    it('Agents-транспилер обнаруживает агентов в <sourceRoot>/agents/ при agloomDir: "."', async () => {
      // Arrange: создаём агента в pluginDir/agents/my-agent.md
      const agentsDir = path.join(pluginDir, "agents");
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.writeFileSync(
        path.join(agentsDir, "my-agent.md"),
        "---\nname: my-agent\n---\nAgent body.",
      );

      const targetAgentsDir = path.join(tmpDir, ".claude", "agents");
      fs.mkdirSync(targetAgentsDir, { recursive: true });

      const { createAgentsTranspiler, ClaudeAgentAdapter } =
        await import("../../agents-transpiler/index.js");

      const outcome: TranspilerStepOutcome = runTranspileStep({
        transpilerFactory: createAgentsTranspiler,
        adapter: new ClaudeAgentAdapter(),
        projectRoot: tmpDir,
        name: "Agents",
        sourceRoot: pluginDir,
      });

      expect(outcome.errors).toEqual([]);
      expect(outcome.writtenCount).toBeGreaterThan(0);
    });

    // --- Спецификация: § Интеграция с транспилерами ---
    // "При обработке локального проекта sourceRoot не передаётся,
    //  agloomDir не передаётся (default «.agloom»). Транспилер использует
    //  projectRoot для discover, transform и write — поведение идентично текущему."
    it("без sourceRoot Skills-транспилер обнаруживает навыки в <projectRoot>/.agloom/skills/", async () => {
      // Arrange: стандартная структура .agloom/skills/
      const skillDir = path.join(tmpDir, ".agloom", "skills", "local-skill");
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(
        path.join(skillDir, "SKILL.md"),
        "---\nname: local-skill\n---\nLocal skill.",
      );

      const { createSkillsTranspiler, ClaudeSkillAdapter } =
        await import("../../skills-transpiler/index.js");

      const outcome: TranspilerStepOutcome = runTranspileStep({
        transpilerFactory: createSkillsTranspiler,
        adapter: new ClaudeSkillAdapter(),
        projectRoot: tmpDir,
        name: "Skills",
      });

      expect(outcome.errors).toEqual([]);
      expect(outcome.writtenCount).toBeGreaterThan(0);
    });

    // --- Спецификация: § Расширение процедуры «Шаг транспиляции», шаг 3 ---
    // "Запись результатов (writeResults) ДОЛЖНА выполняться в projectRoot (не в sourceRoot)."
    // При sourceRoot записи попадают в projectRoot, не в sourceRoot.
    it("при sourceRoot записывает результаты в projectRoot, а не в sourceRoot", async () => {
      // Arrange: Instructions-транспилер — проще всего для проверки write target
      fs.writeFileSync(
        path.join(pluginDir, "AGLOOM.md"),
        "Plugin instructions.",
      );

      const { createInstructionsTranspiler, ClaudeAdapter } =
        await import("../../instructions-transpiler/index.js");

      const outcome: TranspilerStepOutcome = runTranspileStep({
        transpilerFactory: createInstructionsTranspiler,
        adapter: new ClaudeAdapter(),
        projectRoot: tmpDir,
        name: "Instructions",
        sourceRoot: pluginDir,
      });

      expect(outcome.errors).toEqual([]);
      expect(outcome.writtenCount).toBe(1);

      // Файл записан в projectRoot (tmpDir), не в sourceRoot (pluginDir)
      const writtenInProject = fs.existsSync(path.join(tmpDir, "CLAUDE.md"));
      expect(writtenInProject).toBe(true);

      // В sourceRoot файл НЕ записан
      const writtenInPlugin = fs.existsSync(path.join(pluginDir, "CLAUDE.md"));
      expect(writtenInPlugin).toBe(false);
    });

    // --- Спецификация: § Расширение процедуры «Шаг транспиляции» ---
    // Граничное условие: symlink НЕ создаётся (withPluginSymlink удалён).
    // Проверяем, что .agloom symlink не появляется в sourceRoot после вызова.
    it("не создаёт .agloom symlink в sourceRoot при обработке плагина", async () => {
      fs.writeFileSync(path.join(pluginDir, "AGLOOM.md"), "Plugin.");

      const { createInstructionsTranspiler, ClaudeAdapter } =
        await import("../../instructions-transpiler/index.js");

      runTranspileStep({
        transpilerFactory: createInstructionsTranspiler,
        adapter: new ClaudeAdapter(),
        projectRoot: tmpDir,
        name: "Instructions",
        sourceRoot: pluginDir,
      });

      // .agloom symlink НЕ ДОЛЖЕН существовать в sourceRoot
      const symlinkPath = path.join(pluginDir, ".agloom");
      expect(fs.existsSync(symlinkPath)).toBe(false);
    });
  });
});
