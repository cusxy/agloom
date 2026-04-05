// transpile-path-remapping.spec.ts
// Спецификация: docs/specs/agents-transpiler.md § Транспиляция, шаг 3
// Транспилер ремаппит relativePath: <agloomDir>/agents/ → <adapter.targetDir>/

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createAgentsTranspiler } from "../index.js";
import type { AgentDefinition, AgentOutputFile } from "../types.js";

/**
 * Стаб-адаптер с targetDir (новый интерфейс).
 * transpile() возвращает файлы с исходным relativePath (definition.relativePath),
 * как описано в спецификации § Claude Code адаптер, шаг 2.
 * Ремаппинг выполняется транспилером.
 */
function createAdapterWithTargetDir(
  agentId: string,
  targetDir: string,
  transpileFn?: (definitions: AgentDefinition[]) => AgentOutputFile[],
) {
  return {
    agentId,
    targetDir,
    transpile:
      transpileFn ??
      ((defs: AgentDefinition[]) =>
        defs.map((d) => ({
          // Адаптер возвращает relativePath = definition.relativePath
          // (без ремаппинга — ремаппинг делает транспилер)
          relativePath: d.relativePath,
          content: `Transformed: ${d.rawContent}`,
        }))),
  };
}

describe("AgentsTranspiler", () => {
  describe("Транспиляция — ремаппинг relativePath транспилером", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-agents-path-remap-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Спецификация: § Транспиляция, шаг 3 ---
    // "Для каждого AgentOutputFile из результата adapter.transpile
    //  выполнить ремаппинг relativePath: заменить префикс
    //  <agloomDir>/agents/ на <adapter.targetDir>/"
    it("заменяет префикс <agloomDir>/agents/ на <adapter.targetDir>/ в relativePath", () => {
      const agentsDir = path.join(tmpDir, ".agloom", "agents");
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.writeFileSync(path.join(agentsDir, "my-agent.md"), "---\nname: my-agent\n---\nBody.");

      const transpiler = createAgentsTranspiler({
        projectRoot: tmpDir,
        adapters: [createAdapterWithTargetDir("claude", ".claude/agents")],
      });

      const results = transpiler.transpile();

      expect(results).toHaveLength(1);
      expect(results[0].files[0].relativePath).toBe(".claude/agents/my-agent.md");
    });

    // --- Спецификация: § Транспиляция, шаг 3 ---
    // Граничное условие: agloomDir="." (plugin scenario)
    it('ремаппит relativePath корректно при agloomDir="." (plugin scenario)', () => {
      // Создаём agents/ в корне tmpDir (не в .agloom/)
      const agentsDir = path.join(tmpDir, "agents");
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.writeFileSync(path.join(agentsDir, "my-agent.md"), "---\nname: my-agent\n---\nBody.");

      const transpiler = createAgentsTranspiler({
        projectRoot: tmpDir,
        adapters: [createAdapterWithTargetDir("claude", ".claude/agents")],
        agloomDir: ".",
      });

      const results = transpiler.transpile();

      expect(results).toHaveLength(1);
      // Адаптер вернул relativePath = "agents/my-agent.md" (от discover при agloomDir=".")
      // Транспилер должен заменить "agents/" (то есть "./agents/") на ".claude/agents/"
      expect(results[0].files[0].relativePath).toBe(".claude/agents/my-agent.md");
    });

    // --- Спецификация: § Транспиляция, шаг 3 ---
    // Ремаппинг для нескольких адаптеров с разными targetDir
    it("ремаппит relativePath для нескольких адаптеров с разными targetDir", () => {
      const agentsDir = path.join(tmpDir, ".agloom", "agents");
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.writeFileSync(path.join(agentsDir, "agent.md"), "---\nname: agent\n---\nBody.");

      const transpiler = createAgentsTranspiler({
        projectRoot: tmpDir,
        adapters: [
          createAdapterWithTargetDir("claude", ".claude/agents"),
          createAdapterWithTargetDir("opencode", ".opencode/agents"),
        ],
      });

      const results = transpiler.transpile();

      expect(results).toHaveLength(2);

      const claudeResult = results.find((r) => r.agentId === "claude");
      expect(claudeResult!.files[0].relativePath).toBe(".claude/agents/agent.md");

      const opencodeResult = results.find((r) => r.agentId === "opencode");
      expect(opencodeResult!.files[0].relativePath).toBe(".opencode/agents/agent.md");
    });

    // --- Спецификация: § Транспиляция, шаг 3 ---
    // Ремаппинг при кастомном agloomDir
    it("ремаппит relativePath при кастомном agloomDir", () => {
      const agentsDir = path.join(tmpDir, "custom-dir", "agents");
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.writeFileSync(path.join(agentsDir, "agent.md"), "---\nname: agent\n---\nBody.");

      const transpiler = createAgentsTranspiler({
        projectRoot: tmpDir,
        adapters: [createAdapterWithTargetDir("claude", ".claude/agents")],
        agloomDir: "custom-dir",
      });

      const results = transpiler.transpile();

      expect(results).toHaveLength(1);
      expect(results[0].files[0].relativePath).toBe(".claude/agents/agent.md");
    });

    // --- Спецификация: § Claude Code адаптер, шаг 2 ---
    // "Сформировать AgentOutputFile с definition.relativePath
    //  в качестве relativePath"
    // Адаптер НЕ делает ремаппинг — возвращает definition.relativePath
    it("адаптер возвращает definition.relativePath без ремаппинга", () => {
      const agentsDir = path.join(tmpDir, ".agloom", "agents");
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.writeFileSync(path.join(agentsDir, "reviewer.md"), "---\nname: reviewer\n---\nBody.");

      // Адаптер, который проверяет что definition.relativePath
      // начинается с agloomDir/agents/ (не targetDir)
      const adapterCalls: AgentDefinition[][] = [];
      const adapter = createAdapterWithTargetDir("claude", ".claude/agents", (defs) => {
        adapterCalls.push(defs);
        return defs.map((d) => ({
          relativePath: d.relativePath,
          content: d.rawContent,
        }));
      });

      const transpiler = createAgentsTranspiler({
        projectRoot: tmpDir,
        adapters: [adapter],
      });

      const results = transpiler.transpile();

      // Адаптер получил definition с relativePath = ".agloom/agents/reviewer.md"
      expect(adapterCalls).toHaveLength(1);
      expect(adapterCalls[0][0].relativePath).toBe(".agloom/agents/reviewer.md");

      // Транспилер ремаппил в ".claude/agents/reviewer.md"
      expect(results[0].files[0].relativePath).toBe(".claude/agents/reviewer.md");
    });
  });
});
