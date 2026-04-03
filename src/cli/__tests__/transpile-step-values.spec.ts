// transpile-step-values.spec.ts
// Спецификация: docs/specs/plugin-values.md § Расширение процедуры «Шаг транспиляции»
// Спецификация: docs/specs/plugin-values.md § Расширение writeResults Skills и Docs Transpiler

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { runTranspileStep } from "../transpile-step.js";
import type { TranspilerStepOutcome } from "../types.js";

/**
 * Создаёт spy-фабрику транспилера, которая записывает параметры writeResults
 * и возвращает минимальный рабочий транспилер.
 */
function createWriteOptionsSpy() {
  const writeResultsCalls: Array<{
    results: unknown[];
    options?: Record<string, unknown>;
  }> = [];

  const factory = (_config: {
    projectRoot: string;
    adapters: unknown[];
    agloomDir?: string;
  }) => {
    return {
      transpile: () => [{ agentId: "claude", content: "test" }],
      writeResults: (results: unknown[], options?: Record<string, unknown>) => {
        writeResultsCalls.push({ results, options });
        return {
          written: ["file.md"] as string[],
          errors: [] as { message: string }[],
        };
      },
    };
  };

  return { factory, writeResultsCalls };
}

function createStubAdapter(agentId = "claude") {
  return { agentId, targetDir: `.${agentId}/skills`, transpile: () => [] };
}

describe("CLI", () => {
  describe("Расширение процедуры «Шаг транспиляции» — valuesByAgentId", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-step-values-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Spec: § Расширение процедуры «Шаг транспиляции» ---
    // "Шаг 3 (вызов writeResults) изменяется: если valuesByAgentId передан,
    //  объект options ДОЛЖЕН содержать поле valuesByAgentId."
    it("передаёт valuesByAgentId в options writeResults при наличии параметра", () => {
      const { factory, writeResultsCalls } = createWriteOptionsSpy();
      const valuesByAgentId = {
        claude: { team_name: "platform", api_url: "https://api.example.com" },
      };

      runTranspileStep({
        transpilerFactory: factory as Parameters<
          typeof runTranspileStep
        >[0]["transpilerFactory"],
        adapter: createStubAdapter(),
        projectRoot: tmpDir,
        name: "Skills",
        valuesByAgentId,
      });

      expect(writeResultsCalls).toHaveLength(1);
      expect(writeResultsCalls[0].options).toBeDefined();
      expect(writeResultsCalls[0].options!.valuesByAgentId).toEqual(
        valuesByAgentId,
      );
    });

    // --- Spec: § Расширение процедуры «Шаг транспиляции» ---
    // Без valuesByAgentId options НЕ ДОЛЖЕН содержать поле valuesByAgentId.
    it("не передаёт valuesByAgentId в options если параметр не указан", () => {
      const { factory, writeResultsCalls } = createWriteOptionsSpy();

      runTranspileStep({
        transpilerFactory: factory as Parameters<
          typeof runTranspileStep
        >[0]["transpilerFactory"],
        adapter: createStubAdapter(),
        projectRoot: tmpDir,
        name: "Skills",
      });

      expect(writeResultsCalls).toHaveLength(1);
      // options либо undefined, либо не содержит valuesByAgentId
      const opts = writeResultsCalls[0].options;
      if (opts) {
        expect(opts.valuesByAgentId).toBeUndefined();
      }
    });

    // --- Spec: § Расширение процедуры «Шаг транспиляции» ---
    // valuesByAgentId и variablesByAgentId могут передаваться одновременно
    it("передаёт valuesByAgentId вместе с variablesByAgentId в options", () => {
      const { factory, writeResultsCalls } = createWriteOptionsSpy();
      const valuesByAgentId = { claude: { key: "val" } };
      const variablesByAgentId = { claude: { ROOT_DIR: ".claude" } };

      runTranspileStep({
        transpilerFactory: factory as Parameters<
          typeof runTranspileStep
        >[0]["transpilerFactory"],
        adapter: createStubAdapter(),
        projectRoot: tmpDir,
        name: "Skills",
        valuesByAgentId,
        variablesByAgentId,
      });

      expect(writeResultsCalls).toHaveLength(1);
      expect(writeResultsCalls[0].options).toBeDefined();
      expect(writeResultsCalls[0].options!.valuesByAgentId).toEqual(
        valuesByAgentId,
      );
      expect(writeResultsCalls[0].options!.variablesByAgentId).toEqual(
        variablesByAgentId,
      );
    });

    // --- Spec: § Расширение процедуры «Шаг транспиляции» ---
    // valuesByAgentId с sourceRoot: оба передаются в options
    it("передаёт valuesByAgentId вместе с targetRoot при sourceRoot", () => {
      const { factory, writeResultsCalls } = createWriteOptionsSpy();
      const pluginDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "agl-plugin-vals-"),
      );
      const valuesByAgentId = { claude: { team: "backend" } };

      try {
        runTranspileStep({
          transpilerFactory: factory as Parameters<
            typeof runTranspileStep
          >[0]["transpilerFactory"],
          adapter: createStubAdapter(),
          projectRoot: tmpDir,
          name: "Docs",
          sourceRoot: pluginDir,
          valuesByAgentId,
        });

        expect(writeResultsCalls).toHaveLength(1);
        expect(writeResultsCalls[0].options).toBeDefined();
        expect(writeResultsCalls[0].options!.valuesByAgentId).toEqual(
          valuesByAgentId,
        );
        expect(writeResultsCalls[0].options!.targetRoot).toBe(tmpDir);
      } finally {
        fs.rmSync(pluginDir, { recursive: true, force: true });
      }
    });

    // --- Граничное условие: пустой valuesByAgentId ---
    // Пустая карта всё равно передаётся в options
    it("передаёт пустой valuesByAgentId в options", () => {
      const { factory, writeResultsCalls } = createWriteOptionsSpy();
      const valuesByAgentId: Record<string, Record<string, string>> = {};

      runTranspileStep({
        transpilerFactory: factory as Parameters<
          typeof runTranspileStep
        >[0]["transpilerFactory"],
        adapter: createStubAdapter(),
        projectRoot: tmpDir,
        name: "Skills",
        valuesByAgentId,
      });

      expect(writeResultsCalls).toHaveLength(1);
      // Пустой объект — falsy при Object.keys check, options может не содержать valuesByAgentId
      // Это зависит от реализации: пустой {} является truthy, но
      // текущая реализация проверяет `if (valuesByAgentId)` — {} is truthy
      expect(writeResultsCalls[0].options).toBeDefined();
      expect(writeResultsCalls[0].options!.valuesByAgentId).toEqual({});
    });

    // --- Spec: § Расширение writeResults Skills и Docs Transpiler ---
    // "При наличии options.valuesByAgentId вызов interpolate в шаге копирования файлов
    //  ДОЛЖЕН передавать valuesByAgentId[result.agentId] в качестве параметра values."
    // Интеграционный тест: реальный Skills transpiler с valuesByAgentId
    it("Skills transpiler интерполирует ${values:*} через valuesByAgentId", async () => {
      // Создаём skill с ${values:team_name}
      const skillDir = path.join(tmpDir, ".agloom", "skills", "my-skill");
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(
        path.join(skillDir, "SKILL.md"),
        "---\nname: my-skill\n---\nTeam: ${values:team_name}",
      );

      const { createSkillsTranspiler, ClaudeSkillAdapter } =
        await import("../../skills-transpiler/index.js");

      const valuesByAgentId = {
        claude: { team_name: "platform-team" },
      };

      const outcome: TranspilerStepOutcome = runTranspileStep({
        transpilerFactory: createSkillsTranspiler,
        adapter: new ClaudeSkillAdapter(),
        projectRoot: tmpDir,
        name: "Skills",
        valuesByAgentId,
      });

      expect(outcome.errors).toEqual([]);
      expect(outcome.writtenCount).toBeGreaterThan(0);

      // Проверяем, что значение интерполировано в выходном файле
      const outputPath = path.join(tmpDir, ".claude", "skills", "my-skill");
      const files = fs.readdirSync(outputPath);
      const skillFile = files.find((f) => f.endsWith(".md"));
      expect(skillFile).toBeDefined();

      const content = fs.readFileSync(
        path.join(outputPath, skillFile!),
        "utf-8",
      );
      expect(content).toContain("Team: platform-team");
    });
  });
});
