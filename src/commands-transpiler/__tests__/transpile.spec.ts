// transpile.spec.ts
// Спецификация: docs/specs/commands-transpiler.md § Транспиляция

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createCommandsTranspiler } from "../index.js";
import { CommandDiscoverError } from "../errors.js";

/**
 * Стаб-адаптер, возвращающий предсказуемые файлы.
 * Адаптер возвращает definition.relativePath (без ремаппинга).
 */
function createStubAdapter(agentId: string, targetDir: string, transpileFn?: (definitions: any[]) => any[]) {
  return {
    agentId,
    targetDir,
    transpile:
      transpileFn ??
      ((defs: any[]) =>
        defs.map((d: any) => ({
          relativePath: d.relativePath,
          content: `Transformed: ${d.rawContent}`,
        }))),
  };
}

describe("CommandsTranspiler", () => {
  describe("Транспиляция", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-commands-transpile-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Happy path: шаги 1–4 — полный цикл транспиляции ---
    it("выполняет полный цикл: discover → adapter.transpile(definitions) → ремаппинг → собрать результаты", () => {
      const commandsDir = path.join(tmpDir, ".agloom", "commands");
      fs.mkdirSync(commandsDir, { recursive: true });
      fs.writeFileSync(path.join(commandsDir, "deploy.md"), "---\ndescription: Deploy\n---\nBody.");

      const adapter1 = createStubAdapter("adapter-a", ".adapter-a/commands");
      const adapter2 = createStubAdapter("adapter-b", ".adapter-b/commands");

      const transpiler = createCommandsTranspiler({
        projectRoot: tmpDir,
        adapters: [adapter1, adapter2],
      });

      const results = transpiler.transpile();

      expect(results).toHaveLength(2);

      const resultA = results.find((r) => r.agentId === "adapter-a");
      expect(resultA).toBeDefined();
      expect(resultA!.files).toHaveLength(1);
      // Транспилер ремаппит relativePath: .agloom/commands/ → .adapter-a/commands/
      expect(resultA!.files[0].relativePath).toBe(".adapter-a/commands/deploy.md");
      expect(resultA!.errors).toHaveLength(0);

      const resultB = results.find((r) => r.agentId === "adapter-b");
      expect(resultB).toBeDefined();
      expect(resultB!.files).toHaveLength(1);
      expect(resultB!.files[0].relativePath).toBe(".adapter-b/commands/deploy.md");
      expect(resultB!.errors).toHaveLength(0);
    });

    // --- Расширение 1a: нет определений команд → пустой массив ---
    it("возвращает пустой массив CommandTranspileResult[], если определений команд не обнаружено", () => {
      const transpiler = createCommandsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude", ".claude/commands")],
      });

      const results = transpiler.transpile();

      expect(results).toEqual([]);
    });

    // --- Расширение 1b: discover() выбрасывает CommandDiscoverError → пробросить ---
    it("пробрасывает CommandDiscoverError к вызывающему коду, если discover() выбросил ошибку", () => {
      const commandsDir = path.join(tmpDir, ".agloom", "commands");
      fs.mkdirSync(commandsDir, { recursive: true });
      fs.chmodSync(commandsDir, 0o000);

      const transpiler = createCommandsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude", ".claude/commands")],
      });

      try {
        expect(() => transpiler.transpile()).toThrow(CommandDiscoverError);
      } finally {
        fs.chmodSync(commandsDir, 0o755);
      }
    });

    // --- Расширение 2a: адаптер выбрасывает исключение → CommandTranspileResult с ошибкой ---
    it("создаёт CommandTranspileResult с ошибкой при исключении адаптера и продолжает остальные", () => {
      const commandsDir = path.join(tmpDir, ".agloom", "commands");
      fs.mkdirSync(commandsDir, { recursive: true });
      fs.writeFileSync(path.join(commandsDir, "command.md"), "---\ndescription: Cmd\n---\nContent.");

      const failingAdapter = {
        agentId: "failing",
        targetDir: ".failing/commands",
        transpile: () => {
          throw new Error("Adapter internal failure");
        },
      };

      const successAdapter = createStubAdapter("success", ".success/commands");

      const transpiler = createCommandsTranspiler({
        projectRoot: tmpDir,
        adapters: [failingAdapter, successAdapter],
      });

      const results = transpiler.transpile();

      expect(results).toHaveLength(2);

      const failingResult = results.find((r) => r.agentId === "failing");
      expect(failingResult).toBeDefined();
      expect(failingResult!.files).toHaveLength(0);
      expect(failingResult!.errors).toHaveLength(1);
      expect(failingResult!.errors[0].message).toContain("Adapter internal failure");
      expect(failingResult!.errors[0].agentId).toBe("failing");
      expect(failingResult!.errors[0].cause).toBeInstanceOf(Error);

      const successResult = results.find((r) => r.agentId === "success");
      expect(successResult).toBeDefined();
      expect(successResult!.errors).toHaveLength(0);
      expect(successResult!.files).toHaveLength(1);
    });

    // --- Трансформация: шаг 3 — ремаппинг с подкаталогами ---
    it("ремаппит relativePath с сохранением subdirectory structure", () => {
      const commandsDir = path.join(tmpDir, ".agloom", "commands");
      const gitDir = path.join(commandsDir, "git");
      fs.mkdirSync(gitDir, { recursive: true });
      fs.writeFileSync(path.join(gitDir, "commit.md"), "---\ndescription: Commit\n---\nBody.");

      const transpiler = createCommandsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude", ".claude/commands")],
      });

      const results = transpiler.transpile();

      expect(results).toHaveLength(1);
      expect(results[0].files[0].relativePath).toBe(".claude/commands/git/commit.md");
    });
  });
});
