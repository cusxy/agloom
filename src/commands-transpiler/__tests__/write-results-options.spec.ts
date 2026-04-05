// write-results-options.spec.ts
// Спецификация: docs/specs/commands-transpiler.md § Запись результатов
//
// Тесты на options object: { targetRoot?, variablesByAgentId? }
// и расширения 3b, 3c

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createCommandsTranspiler } from "../index.js";
import { CommandWriteError } from "../errors.js";

function createStubAdapter(agentId: string, targetDir?: string) {
  return {
    agentId,
    targetDir: targetDir ?? `.${agentId}/commands`,
    transpile: () => [],
  };
}

describe("CommandsTranspiler", () => {
  describe("Запись результатов — options object", () => {
    let tmpDir: string;
    let targetDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-commands-write-opts-"));
      targetDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-commands-write-target-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(targetDir, { recursive: true, force: true });
    });

    // --- Спецификация: § Запись результатов, шаг 2 ---
    // "Определить effectiveRoot как options.targetRoot (если передан)
    //  или projectRoot из конфигурации транспилера"
    it("записывает файлы в options.targetRoot, если передан", () => {
      const transpiler = createCommandsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const writeResult = transpiler.writeResults(
        [
          {
            agentId: "claude",
            files: [
              {
                relativePath: ".claude/commands/deploy.md",
                content: "# Deploy content",
              },
            ],
            errors: [],
          },
        ],
        { targetRoot: targetDir },
      );

      expect(writeResult.written).toContain(".claude/commands/deploy.md");
      expect(writeResult.errors).toHaveLength(0);

      expect(fs.existsSync(path.join(targetDir, ".claude", "commands", "deploy.md"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, ".claude", "commands", "deploy.md"))).toBe(false);
    });

    // --- Спецификация: § Запись результатов, шаг 2 ---
    it("записывает файлы в projectRoot, если options.targetRoot не передан", () => {
      const transpiler = createCommandsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "claude",
          files: [
            {
              relativePath: ".claude/commands/deploy.md",
              content: "# Deploy",
            },
          ],
          errors: [],
        },
      ]);

      expect(writeResult.written).toContain(".claude/commands/deploy.md");
      expect(fs.existsSync(path.join(tmpDir, ".claude", "commands", "deploy.md"))).toBe(true);
    });

    // --- Спецификация: § Запись результатов, шаг 3 ---
    // variablesByAgentId: интерполяция для .md файлов
    it("выполняет интерполяцию для .md файлов при наличии variablesByAgentId", () => {
      const transpiler = createCommandsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const writeResult = transpiler.writeResults(
        [
          {
            agentId: "claude",
            files: [
              {
                relativePath: ".claude/commands/deploy.md",
                content: "Deploy to ${agloom:env}.",
              },
            ],
            errors: [],
          },
        ],
        {
          variablesByAgentId: {
            claude: { env: "production" },
          },
        },
      );

      expect(writeResult.written).toContain(".claude/commands/deploy.md");
      expect(writeResult.errors).toHaveLength(0);

      const writtenContent = fs.readFileSync(path.join(tmpDir, ".claude", "commands", "deploy.md"), "utf-8");
      expect(writtenContent).toBe("Deploy to production.");
    });

    // --- Спецификация: § Запись результатов, шаг 3 ---
    // variablesByAgentId: НЕ интерполировать .toml файлы
    it("не выполняет интерполяцию для .toml файлов", () => {
      const transpiler = createCommandsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("gemini", ".gemini/commands")],
      });

      const tomlContent = 'description = "Deploy to ${agloom:env}"';

      const writeResult = transpiler.writeResults(
        [
          {
            agentId: "gemini",
            files: [
              {
                relativePath: ".gemini/commands/deploy.toml",
                content: tomlContent,
              },
            ],
            errors: [],
          },
        ],
        {
          variablesByAgentId: {
            gemini: { env: "production" },
          },
        },
      );

      expect(writeResult.written).toContain(".gemini/commands/deploy.toml");

      const writtenContent = fs.readFileSync(path.join(tmpDir, ".gemini", "commands", "deploy.toml"), "utf-8");
      expect(writtenContent).toBe(tomlContent);
    });

    // --- Расширение 3b: variablesByAgentId передан, но ключ agentId отсутствует ---
    it("возвращает CommandWriteError, если variablesByAgentId не содержит ключ agentId", () => {
      const transpiler = createCommandsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const writeResult = transpiler.writeResults(
        [
          {
            agentId: "claude",
            files: [
              {
                relativePath: ".claude/commands/deploy.md",
                content: "Deploy content.",
              },
            ],
            errors: [],
          },
        ],
        {
          variablesByAgentId: {
            // claude отсутствует — только opencode
            opencode: { env: "production" },
          },
        },
      );

      expect(writeResult.errors.length).toBeGreaterThan(0);
      expect(writeResult.errors[0]).toBeInstanceOf(CommandWriteError);
      expect(writeResult.errors[0].message).toMatch(/No interpolation variables for adapter: claude/);
    });

    // --- Расширение 3c: interpolate выбрасывает InterpolationError → CommandWriteError ---
    // Спецификация interpolation.md § Интерполяция контента, расширение 4a:
    // "NAME не найден в variables → InterpolationError("Unknown agloom variable: {NAME}")"
    it("возвращает CommandWriteError при ошибке интерполяции", () => {
      const transpiler = createCommandsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const writeResult = transpiler.writeResults(
        [
          {
            agentId: "claude",
            files: [
              {
                relativePath: ".claude/commands/deploy.md",
                content: "Deploy to ${agloom:undefined_var}.",
              },
            ],
            errors: [],
          },
        ],
        {
          variablesByAgentId: {
            claude: {},
          },
        },
      );

      expect(writeResult.errors).toHaveLength(1);
      expect(writeResult.errors[0]).toBeInstanceOf(CommandWriteError);
      expect(writeResult.errors[0].message).toMatch(/Interpolation failed/);
    });

    // --- Расширение 1a: per-error CommandWriteError ---
    it("создаёт отдельный CommandWriteError для каждого элемента errors", () => {
      const transpiler = createCommandsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "claude",
          files: [
            {
              relativePath: ".claude/commands/cmd.md",
              content: "# Cmd",
            },
          ],
          errors: [
            {
              agentId: "claude",
              message: "Error one",
              cause: new Error("cause one"),
            },
            {
              agentId: "claude",
              message: "Error two",
              cause: new Error("cause two"),
            },
          ],
        },
      ]);

      expect(writeResult.errors).toHaveLength(2);
      expect(writeResult.errors[0]).toBeInstanceOf(CommandWriteError);
      expect(writeResult.errors[0].message).toBe("Error one");
      expect(writeResult.errors[1]).toBeInstanceOf(CommandWriteError);
      expect(writeResult.errors[1].message).toBe("Error two");
    });
  });
});
