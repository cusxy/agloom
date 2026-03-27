// integration.spec.ts
// Спецификация: docs/specs/integration-tests.md § Instructions Transpiler Integration

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  createInstructionsTranspiler,
  ClaudeAdapter,
  OpenCodeAdapter,
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
    it("транспилирует все четыре типа канонических файлов для Claude адаптера", () => {
      // Вход: создать каноническую структуру
      fs.writeFileSync(path.join(tmpDir, "AGLOOM.md"), "root instructions");
      fs.writeFileSync(
        path.join(tmpDir, "AGLOOM.local.md"),
        "local instructions",
      );
      fs.mkdirSync(path.join(tmpDir, "src", "module"), { recursive: true });
      fs.writeFileSync(
        path.join(tmpDir, "src", "module", "AGLOOM.md"),
        "directory instructions",
      );
      fs.writeFileSync(
        path.join(tmpDir, "src", "module", "AGLOOM.local.md"),
        "directory-local instructions",
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

      // Шаги 7–8: CLAUDE.local.md в корне
      const localContent = fs.readFileSync(
        path.join(tmpDir, "CLAUDE.local.md"),
        "utf-8",
      );
      expect(localContent).toBe("local instructions");

      // Шаги 9–10: src/module/CLAUDE.md
      const dirContent = fs.readFileSync(
        path.join(tmpDir, "src", "module", "CLAUDE.md"),
        "utf-8",
      );
      expect(dirContent).toBe("directory instructions");

      // Шаги 11–12: src/module/CLAUDE.local.md
      const dirLocalContent = fs.readFileSync(
        path.join(tmpDir, "src", "module", "CLAUDE.local.md"),
        "utf-8",
      );
      expect(dirLocalContent).toBe("directory-local instructions");

      // Результат: writeResult.written содержит четыре пути
      expect(writeResult.written).toContain("CLAUDE.md");
      expect(writeResult.written).toContain("CLAUDE.local.md");
      expect(writeResult.written).toContain("src/module/CLAUDE.md");
      expect(writeResult.written).toContain("src/module/CLAUDE.local.md");
    });

    // --- IT-INSTR-02: Pipeline с AgentsMd адаптером ---
    // § instructions-transpiler.md § AGENTS.md адаптер: agentId "agentsmd",
    // генерирует AGENTS.md из root и directory файлов.
    // OpenCode адаптер — no-op (возвращает пустой массив).
    it("AgentsMd адаптер генерирует AGENTS.md из канонического AGLOOM.md", () => {
      // Вход: создать канонические файлы
      fs.writeFileSync(path.join(tmpDir, "AGLOOM.md"), "root instructions");
      fs.writeFileSync(
        path.join(tmpDir, "AGLOOM.local.md"),
        "local instructions",
      );

      // Поведение: шаги 1–3
      const transpiler = createInstructionsTranspiler({
        projectRoot: tmpDir,
        adapters: [new AgentsMdAdapter()],
      });
      const results = transpiler.transpile();
      const writeResult = transpiler.writeResults(results);

      // Шаг 4: writeResult.errors — пустой массив
      expect(writeResult.errors).toHaveLength(0);

      // Шаг 5: AGENTS.md создан из AGLOOM.md
      const agentsContent = fs.readFileSync(
        path.join(tmpDir, "AGENTS.md"),
        "utf-8",
      );
      expect(agentsContent).toBe("root instructions");

      // CLAUDE.md и CLAUDE.local.md НЕ существуют
      expect(fs.existsSync(path.join(tmpDir, "CLAUDE.md"))).toBe(false);
      expect(fs.existsSync(path.join(tmpDir, "CLAUDE.local.md"))).toBe(false);

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
