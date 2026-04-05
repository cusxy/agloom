// integration.spec.ts
// Спецификация: docs/specs/integration-tests.md § Instructions Transpiler Integration

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  createInstructionsTranspiler,
  ClaudeAdapter,
  AgentsMdAdapter,
} from "../index.js";

describe("InstructionsTranspiler", () => {
  describe("Integration — полный pipeline", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-instr-integration-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- IT-INSTR-01: Pipeline с Claude адаптером ---
    // § integration-tests.md § IT-INSTR-01: Pipeline с Claude адаптером
    // Канонические файлы: root и directory (local и directory-local удалены из спецификации)
    it("транспилирует root и directory канонические файлы для Claude адаптера", () => {
      // Вход: создать каноническую структуру (только root и directory)
      fs.writeFileSync(path.join(tmpDir, "AGLOOM.md"), "root instructions");
      fs.mkdirSync(path.join(tmpDir, "src", "module"), { recursive: true });
      fs.writeFileSync(
        path.join(tmpDir, "src", "module", "AGLOOM.md"),
        "directory instructions",
      );

      // Поведение: шаги 1–3
      const transpiler = createInstructionsTranspiler({
        projectRoot: tmpDir,
        adapters: [new ClaudeAdapter()],
      });
      const results = transpiler.transpile();
      const writeResult = transpiler.writeResults(results);

      // Шаг 4: writeResult.errors — пустой массив
      expect(writeResult.errors).toHaveLength(0);

      // Шаги 5–6: CLAUDE.md в корне
      const rootContent = fs.readFileSync(
        path.join(tmpDir, "CLAUDE.md"),
        "utf-8",
      );
      expect(rootContent).toBe("root instructions");

      // Шаги 7–8: src/module/CLAUDE.md
      const dirContent = fs.readFileSync(
        path.join(tmpDir, "src", "module", "CLAUDE.md"),
        "utf-8",
      );
      expect(dirContent).toBe("directory instructions");

      // Результат: writeResult.written содержит два пути
      expect(writeResult.written).toContain("CLAUDE.md");
      expect(writeResult.written).toContain("src/module/CLAUDE.md");
      // CLAUDE.local.md НЕ ДОЛЖЕН генерироваться (удалён из спецификации)
      expect(writeResult.written).not.toContain("CLAUDE.local.md");
      expect(writeResult.written).not.toContain("src/module/CLAUDE.local.md");
    });

    // --- IT-INSTR-02: Pipeline с AgentsMd адаптером ---
    // § integration-tests.md § IT-INSTR-02: Pipeline с OpenCode адаптером
    // AgentsMd адаптер генерирует AGENTS.md из root файлов.
    // AGLOOM.local.md удалён из входных данных.
    it("AgentsMd адаптер генерирует AGENTS.md из канонического AGLOOM.md (без AGLOOM.local.md)", () => {
      // Вход: создать канонические файлы (только AGLOOM.md, без AGLOOM.local.md)
      fs.writeFileSync(path.join(tmpDir, "AGLOOM.md"), "root instructions");

      // Поведение: шаги 1–3
      const transpiler = createInstructionsTranspiler({
        projectRoot: tmpDir,
        adapters: [new AgentsMdAdapter()],
      });
      const results = transpiler.transpile();
      const writeResult = transpiler.writeResults(results);

      // Шаг 4: writeResult.errors — пустой массив
      expect(writeResult.errors).toHaveLength(0);

      // Шаг 5–6: AGENTS.md создан из AGLOOM.md
      const agentsContent = fs.readFileSync(
        path.join(tmpDir, "AGENTS.md"),
        "utf-8",
      );
      expect(agentsContent).toBe("root instructions");

      // CLAUDE.md НЕ существует
      expect(fs.existsSync(path.join(tmpDir, "CLAUDE.md"))).toBe(false);

      // Результат: writeResult.written содержит AGENTS.md
      expect(writeResult.written).toContain("AGENTS.md");
    });

    // --- IT-INSTR-03: Pipeline с Claude и AgentsMd адаптерами одновременно ---
    // § instructions-transpiler.md § Транспиляция: для каждого адаптера вызвать transpile(files).
    // OpenCode — no-op, поэтому используем AgentsMd для генерации AGENTS.md.
    it("Claude и AgentsMd адаптеры обрабатываются за один вызов transpile() и writeResults()", () => {
      // Вход: создать канонический файл
      fs.writeFileSync(path.join(tmpDir, "AGLOOM.md"), "shared instructions");

      // Поведение: шаги 1–2
      const transpiler = createInstructionsTranspiler({
        projectRoot: tmpDir,
        adapters: [new ClaudeAdapter(), new AgentsMdAdapter()],
      });
      const results = transpiler.transpile();

      // Шаг 3: results содержит два TranspileResult
      expect(results).toHaveLength(2);
      const agentIds = results.map((r) => r.agentId);
      expect(agentIds).toContain("claude");
      expect(agentIds).toContain("agentsmd");

      // Шаги 4–5
      const writeResult = transpiler.writeResults(results);
      expect(writeResult.errors).toHaveLength(0);

      // CLAUDE.md создан с правильным содержимым
      const claudeContent = fs.readFileSync(
        path.join(tmpDir, "CLAUDE.md"),
        "utf-8",
      );
      expect(claudeContent).toBe("shared instructions");

      // AGENTS.md создан с правильным содержимым
      const agentsContent = fs.readFileSync(
        path.join(tmpDir, "AGENTS.md"),
        "utf-8",
      );
      expect(agentsContent).toBe("shared instructions");

      // Результат: writeResult.written содержит CLAUDE.md и AGENTS.md
      expect(writeResult.written).toContain("CLAUDE.md");
      expect(writeResult.written).toContain("AGENTS.md");
    });

    // --- IT-INSTR-04: Pipeline при отсутствии канонических файлов ---
    it("корректно завершается при пустом tmpDir без канонических файлов", () => {
      // Вход: tmpDir — пустая директория

      // Поведение: шаги 1–2
      const transpiler = createInstructionsTranspiler({
        projectRoot: tmpDir,
        adapters: [new ClaudeAdapter()],
      });
      const results = transpiler.transpile();

      // Шаг 3: results — пустой массив
      expect(results).toHaveLength(0);

      // Шаги 4–6
      const writeResult = transpiler.writeResults(results);
      expect(writeResult.errors).toHaveLength(0);
      expect(writeResult.written).toHaveLength(0);
    });
  });
});
