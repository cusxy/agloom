// transpile.spec.ts
// Спецификация: docs/specs/instructions-transpiler.md § Транспиляция

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createInstructionsTranspiler } from "../index.js";
import { ClaudeAdapter } from "../adapters/claude-adapter.js";
import { OpenCodeAdapter } from "../adapters/opencode-adapter.js";
import { DiscoverError } from "../errors.js";

describe("InstructionsTranspiler", () => {
  describe("Транспиляция", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sds-transpile-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Happy path: шаги 1–3 — полный цикл транспиляции ---
    it("выполняет полный цикл транспиляции: discover → adapter.transpile(CanonicalFile[]) → собрать результаты", () => {
      fs.writeFileSync(
        path.join(tmpDir, "AGENTS.md"),
        "General instructions for all agents.",
      );

      const transpiler = createInstructionsTranspiler({
        projectRoot: tmpDir,
        adapters: [new ClaudeAdapter(), new OpenCodeAdapter()],
      });

      const results = transpiler.transpile();

      expect(results).toHaveLength(2);

      const claudeResult = results.find((r) => r.agentId === "claude");
      expect(claudeResult).toBeDefined();
      expect(claudeResult!.files).toHaveLength(1);
      expect(claudeResult!.files[0].relativePath).toBe("CLAUDE.md");
      expect(claudeResult!.files[0].content).toBe(
        "General instructions for all agents.",
      );
      expect(claudeResult!.errors).toHaveLength(0);

      const opencodeResult = results.find((r) => r.agentId === "opencode");
      expect(opencodeResult).toBeDefined();
      expect(opencodeResult!.files).toHaveLength(0);
      expect(opencodeResult!.errors).toHaveLength(0);
    });

    // --- Расширение 1a: нет канонических файлов → пустой массив ---
    it("возвращает пустой массив TranspileResult, если канонических файлов не обнаружено", () => {
      // tmpDir пуст

      const transpiler = createInstructionsTranspiler({
        projectRoot: tmpDir,
        adapters: [new ClaudeAdapter()],
      });

      const results = transpiler.transpile();

      expect(results).toEqual([]);
    });

    // --- Расширение 1b: discover() выбрасывает DiscoverError → пробросить ---
    it("пробрасывает DiscoverError к вызывающему коду, если discover() выбросил ошибку", () => {
      // Создаём каталог без прав на чтение — discover() выбросит DiscoverError
      const restrictedDir = path.join(tmpDir, "restricted");
      fs.mkdirSync(restrictedDir);
      fs.writeFileSync(path.join(tmpDir, "AGENTS.md"), "root");
      fs.chmodSync(restrictedDir, 0o000);

      const transpiler = createInstructionsTranspiler({
        projectRoot: tmpDir,
        adapters: [new ClaudeAdapter()],
      });

      try {
        expect(() => transpiler.transpile()).toThrow(DiscoverError);
      } finally {
        fs.chmodSync(restrictedDir, 0o755);
      }
    });

    // --- Расширение 2a: адаптер выбрасывает исключение ---
    it("создаёт TranspileResult с ошибкой при исключении адаптера и продолжает остальные", () => {
      fs.writeFileSync(path.join(tmpDir, "AGENTS.md"), "General content.");

      const failingAdapter = {
        agentId: "failing",
        transpile: () => {
          throw new Error("Adapter internal failure");
        },
      };

      const transpiler = createInstructionsTranspiler({
        projectRoot: tmpDir,
        adapters: [failingAdapter, new ClaudeAdapter()],
      });

      const results = transpiler.transpile();

      // Должны быть результаты для обоих адаптеров
      expect(results).toHaveLength(2);

      // Failing adapter — с ошибкой
      const failingResult = results.find((r) => r.agentId === "failing");
      expect(failingResult).toBeDefined();
      expect(failingResult!.files).toHaveLength(0);
      expect(failingResult!.errors).toHaveLength(1);
      expect(failingResult!.errors[0].message).toContain(
        "Adapter internal failure",
      );
      expect(failingResult!.errors[0].agentId).toBe("failing");
      expect(failingResult!.errors[0].cause).toBeInstanceOf(Error);

      // Claude adapter — успешно
      const claudeResult = results.find((r) => r.agentId === "claude");
      expect(claudeResult).toBeDefined();
      expect(claudeResult!.errors).toHaveLength(0);
    });

    // --- Трансформация: шаг 2 — адаптеры получают CanonicalFile[] напрямую (без парсинга) ---
    it("передаёт CanonicalFile[] адаптерам напрямую без промежуточного парсинга", () => {
      const originalContent = "# My Instructions\n\nContent here.";
      fs.writeFileSync(path.join(tmpDir, "AGENTS.md"), originalContent);

      const transpiler = createInstructionsTranspiler({
        projectRoot: tmpDir,
        adapters: [new ClaudeAdapter()],
      });

      const results = transpiler.transpile();

      // Контент в результате должен совпадать с исходным файлом
      // (без промежуточной трансформации через parse/assemble)
      expect(results[0].files[0].content).toBe(originalContent);
    });
  });
});
