// transpile.spec.ts
// Спецификация: docs/specs/skills-transpiler.md § Транспиляция

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createSkillsTranspiler } from "../index.js";
import { ClaudeSkillAdapter } from "../adapters/claude-adapter.js";
import { OpenCodeSkillAdapter } from "../adapters/opencode-adapter.js";
import { SkillDiscoverError } from "../errors.js";

describe("SkillsTranspiler", () => {
  describe("Транспиляция", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sds-skills-transpile-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Happy path: шаги 1–3 — полный цикл транспиляции ---
    it("выполняет полный цикл: discover → adapter.transpile(SkillPackage[]) → собрать результаты", () => {
      // Arrange: создаём skill-пакет
      const skillDir = path.join(tmpDir, ".agents", "skills", "my-skill");
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, "SKILL.md"), "# My Skill");

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [new ClaudeSkillAdapter(), new OpenCodeSkillAdapter()],
      });

      // Act
      const results = transpiler.transpile();

      // Assert
      expect(results).toHaveLength(2);

      const claudeResult = results.find((r) => r.agentId === "claude");
      expect(claudeResult).toBeDefined();
      expect(claudeResult!.files).toHaveLength(1);
      expect(claudeResult!.files[0].relativePath).toBe(
        ".claude/skills/my-skill/SKILL.md",
      );
      expect(claudeResult!.files[0].sourcePath).toBe(
        ".agents/skills/my-skill/SKILL.md",
      );
      expect(claudeResult!.errors).toHaveLength(0);

      const opencodeResult = results.find((r) => r.agentId === "opencode");
      expect(opencodeResult).toBeDefined();
      expect(opencodeResult!.files).toHaveLength(0);
      expect(opencodeResult!.errors).toHaveLength(0);
    });

    // --- Расширение 1a: нет skill-пакетов → пустой массив ---
    it("возвращает пустой массив SkillTranspileResult, если skill-пакетов не обнаружено", () => {
      // tmpDir пуст — нет .agents/skills/

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [new ClaudeSkillAdapter()],
      });

      const results = transpiler.transpile();

      expect(results).toEqual([]);
    });

    // --- Расширение 1b: discover() выбрасывает SkillDiscoverError → пробросить ---
    it("пробрасывает SkillDiscoverError к вызывающему коду, если discover() выбросил ошибку", () => {
      // Создаём каталог .agents/skills/ без прав на чтение
      const skillsDir = path.join(tmpDir, ".agents", "skills");
      fs.mkdirSync(skillsDir, { recursive: true });
      // Создаём skill-пакет чтобы discover начал обработку
      const skillDir = path.join(skillsDir, "my-skill");
      fs.mkdirSync(skillDir);
      fs.writeFileSync(path.join(skillDir, "SKILL.md"), "# Skill");
      fs.chmodSync(skillsDir, 0o000);

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [new ClaudeSkillAdapter()],
      });

      try {
        expect(() => transpiler.transpile()).toThrow(SkillDiscoverError);
      } finally {
        fs.chmodSync(skillsDir, 0o755);
      }
    });

    // --- Расширение 2a: адаптер выбрасывает исключение ---
    it("создаёт SkillTranspileResult с ошибкой при исключении адаптера и продолжает остальные", () => {
      // Arrange: создаём skill-пакет
      const skillDir = path.join(tmpDir, ".agents", "skills", "my-skill");
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, "SKILL.md"), "# My Skill");

      const failingAdapter = {
        agentId: "failing",
        transpile: () => {
          throw new Error("Adapter internal failure");
        },
      };

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [failingAdapter, new ClaudeSkillAdapter()],
      });

      // Act
      const results = transpiler.transpile();

      // Assert: результаты для обоих адаптеров
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
      expect(claudeResult!.files.length).toBeGreaterThan(0);
    });
  });
});
