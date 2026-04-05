// transpile-step.spec.ts
// Спецификация: docs/specs/cli.md § Шаг транспиляции

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { runTranspileStep } from "../transpile-step.js";
import type { TranspilerStepOutcome } from "../types.js";
import { createInstructionsTranspiler, ClaudeAdapter } from "../../instructions-transpiler/index.js";

describe("CLI", () => {
  describe("Шаг транспиляции", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-step-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Happy path: шаги 1-6 ---
    // Шаг 1: создать transpiler через transpilerFactory
    // Шаг 2: вызвать transpiler.transpile()
    // Шаг 3: вызвать transpiler.writeResults()
    // Шаг 4: writtenCount = writeResult.written.length
    // Шаг 5: errors = writeResult.errors.map(e => e.message)
    // Шаг 6: сформировать TranspilerStepOutcome
    it("выполняет transpile() и writeResults(), возвращает TranspilerStepOutcome с корректными writtenCount и пустыми errors", () => {
      fs.writeFileSync(path.join(tmpDir, "AGLOOM.md"), "General instructions.");

      const outcome: TranspilerStepOutcome = runTranspileStep({
        transpilerFactory: createInstructionsTranspiler,
        adapter: new ClaudeAdapter(),
        projectRoot: tmpDir,
        name: "Instructions",
      });

      expect(outcome.name).toBe("Instructions");
      expect(outcome.writtenCount).toBe(1); // AGLOOM.md → CLAUDE.md
      expect(outcome.errors).toEqual([]);

      // Проверяем, что файл действительно записан (побочный эффект writeResults)
      const written = fs.readFileSync(path.join(tmpDir, "CLAUDE.md"), "utf-8");
      expect(written).toBe("General instructions.");
    });

    // --- Расширение 2a: transpile() выбрасывает исключение ---
    // transpile() выбрасывает исключение → TranspilerStepOutcome с writtenCount: 0
    // и [exception.message] в errors; шаги 3-5 пропущены.
    it("возвращает outcome с writtenCount: 0 и errors при исключении transpiler.transpile()", () => {
      const throwingFactory = () => ({
        transpile: () => {
          throw new Error("Scan failed: EACCES");
        },
        writeResults: () => ({ written: [], errors: [] }),
      });

      const outcome: TranspilerStepOutcome = runTranspileStep({
        transpilerFactory: throwingFactory as typeof createInstructionsTranspiler,
        adapter: new ClaudeAdapter(),
        projectRoot: tmpDir,
        name: "Instructions",
      });

      expect(outcome.name).toBe("Instructions");
      expect(outcome.writtenCount).toBe(0);
      expect(outcome.errors).toHaveLength(1);
      expect(outcome.errors[0]).toContain("Scan failed: EACCES");
    });

    // --- Трансформация: шаг 5 — errors из writeResult.errors.map(e => e.message) ---
    // Когда адаптер выбрасывает исключение, transpiler.transpile() НЕ выбрасывает,
    // а возвращает TranspileResult с errors. Затем writeResults() пропускает запись
    // и возвращает WriteResult с errors. Шаг транспиляции формирует errors из
    // writeResult.errors.map(e => e.message).
    it("формирует errors из writeResult.errors.map(e => e.message) при ошибках адаптера", () => {
      fs.writeFileSync(path.join(tmpDir, "AGLOOM.md"), "Content.");

      const failingAdapter = {
        agentId: "broken",
        transpile: () => {
          throw new Error("Adapter internal failure");
        },
      };

      const outcome: TranspilerStepOutcome = runTranspileStep({
        transpilerFactory: createInstructionsTranspiler,
        adapter: failingAdapter,
        projectRoot: tmpDir,
        name: "Instructions",
      });

      // Адаптер упал → transpiler вернул TranspileResult с errors →
      // writeResults пропустил запись → WriteResult.errors содержит сообщения
      expect(outcome.name).toBe("Instructions");
      expect(outcome.writtenCount).toBe(0);
      expect(outcome.errors.length).toBeGreaterThan(0);
      // errors содержит извлечённые message из WriteError объектов —
      // верифицируем, что исходное сообщение ошибки адаптера присутствует в выводе
      expect(outcome.errors[0]).toContain("Adapter internal failure");
    });
  });
});
