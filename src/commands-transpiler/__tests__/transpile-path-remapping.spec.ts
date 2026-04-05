// transpile-path-remapping.spec.ts
// Спецификация: docs/specs/commands-transpiler.md § Транспиляция, шаг 3
// Транспилер ремаппит relativePath: <agloomDir>/commands/ → <adapter.targetDir>/

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createCommandsTranspiler } from "../index.js";
import type { CommandDefinition, CommandOutputFile } from "../types.js";

function createAdapterWithTargetDir(
  agentId: string,
  targetDir: string,
  transpileFn?: (definitions: CommandDefinition[]) => CommandOutputFile[],
) {
  return {
    agentId,
    targetDir,
    transpile:
      transpileFn ??
      ((defs: CommandDefinition[]) =>
        defs.map((d) => ({
          relativePath: d.relativePath,
          content: `Transformed: ${d.rawContent}`,
        }))),
  };
}

describe("CommandsTranspiler", () => {
  describe("Транспиляция — ремаппинг relativePath транспилером", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-commands-path-remap-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Спецификация: § Транспиляция, шаг 3 ---
    it("заменяет префикс <agloomDir>/commands/ на <adapter.targetDir>/ в relativePath", () => {
      const commandsDir = path.join(tmpDir, ".agloom", "commands");
      fs.mkdirSync(commandsDir, { recursive: true });
      fs.writeFileSync(path.join(commandsDir, "deploy.md"), "---\ndescription: Deploy\n---\nBody.");

      const transpiler = createCommandsTranspiler({
        projectRoot: tmpDir,
        adapters: [createAdapterWithTargetDir("claude", ".claude/commands")],
      });

      const results = transpiler.transpile();

      expect(results).toHaveLength(1);
      expect(results[0].files[0].relativePath).toBe(".claude/commands/deploy.md");
    });

    // --- Граничное условие: agloomDir="." (plugin scenario) ---
    it('ремаппит relativePath корректно при agloomDir="." (plugin scenario)', () => {
      const commandsDir = path.join(tmpDir, "commands");
      fs.mkdirSync(commandsDir, { recursive: true });
      fs.writeFileSync(path.join(commandsDir, "deploy.md"), "---\ndescription: Deploy\n---\nBody.");

      const transpiler = createCommandsTranspiler({
        projectRoot: tmpDir,
        adapters: [createAdapterWithTargetDir("claude", ".claude/commands")],
        agloomDir: ".",
      });

      const results = transpiler.transpile();

      expect(results).toHaveLength(1);
      expect(results[0].files[0].relativePath).toBe(".claude/commands/deploy.md");
    });

    // --- Ремаппинг для нескольких адаптеров ---
    it("ремаппит relativePath для нескольких адаптеров с разными targetDir", () => {
      const commandsDir = path.join(tmpDir, ".agloom", "commands");
      fs.mkdirSync(commandsDir, { recursive: true });
      fs.writeFileSync(path.join(commandsDir, "cmd.md"), "---\ndescription: Cmd\n---\nBody.");

      const transpiler = createCommandsTranspiler({
        projectRoot: tmpDir,
        adapters: [
          createAdapterWithTargetDir("claude", ".claude/commands"),
          createAdapterWithTargetDir("opencode", ".opencode/commands"),
        ],
      });

      const results = transpiler.transpile();

      expect(results).toHaveLength(2);

      const claudeResult = results.find((r) => r.agentId === "claude");
      expect(claudeResult!.files[0].relativePath).toBe(".claude/commands/cmd.md");

      const opencodeResult = results.find((r) => r.agentId === "opencode");
      expect(opencodeResult!.files[0].relativePath).toBe(".opencode/commands/cmd.md");
    });

    // --- Ремаппинг при кастомном agloomDir ---
    it("ремаппит relativePath при кастомном agloomDir", () => {
      const commandsDir = path.join(tmpDir, "custom-dir", "commands");
      fs.mkdirSync(commandsDir, { recursive: true });
      fs.writeFileSync(path.join(commandsDir, "cmd.md"), "---\ndescription: Cmd\n---\nBody.");

      const transpiler = createCommandsTranspiler({
        projectRoot: tmpDir,
        adapters: [createAdapterWithTargetDir("claude", ".claude/commands")],
        agloomDir: "custom-dir",
      });

      const results = transpiler.transpile();

      expect(results).toHaveLength(1);
      expect(results[0].files[0].relativePath).toBe(".claude/commands/cmd.md");
    });

    // --- Ремаппинг с подкаталогами (preserve mode) ---
    it("сохраняет subdirectory structure при ремаппинге", () => {
      const commandsDir = path.join(tmpDir, ".agloom", "commands");
      const gitDir = path.join(commandsDir, "git");
      fs.mkdirSync(gitDir, { recursive: true });
      fs.writeFileSync(path.join(gitDir, "commit.md"), "---\ndescription: Commit\n---\nBody.");

      const transpiler = createCommandsTranspiler({
        projectRoot: tmpDir,
        adapters: [createAdapterWithTargetDir("claude", ".claude/commands")],
      });

      const results = transpiler.transpile();

      expect(results).toHaveLength(1);
      expect(results[0].files[0].relativePath).toBe(".claude/commands/git/commit.md");
    });
  });
});
