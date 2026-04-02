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
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-skills-transpile-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Happy path: шаги 1–3 — полный цикл транспиляции ---
    it("выполняет полный цикл: discover → маппинг путей через targetDir → собрать результаты", () => {
      // Arrange: создаём skill-пакет
      const skillDir = path.join(tmpDir, ".agloom", "skills", "my-skill");
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
        ".agloom/skills/my-skill/SKILL.md",
      );
      expect(claudeResult!.errors).toHaveLength(0);

      const opencodeResult = results.find((r) => r.agentId === "opencode");
      expect(opencodeResult).toBeDefined();
      expect(opencodeResult!.files).toHaveLength(1);
      expect(opencodeResult!.files[0].relativePath).toBe(
        ".opencode/skills/my-skill/SKILL.md",
      );
      expect(opencodeResult!.files[0].sourcePath).toBe(
        ".agloom/skills/my-skill/SKILL.md",
      );
      expect(opencodeResult!.errors).toHaveLength(0);
    });

    // --- Расширение 1a: нет skill-пакетов → пустой массив ---
    it("возвращает пустой массив SkillTranspileResult, если skill-пакетов не обнаружено", () => {
      // tmpDir пуст — нет .agloom/skills/

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [new ClaudeSkillAdapter()],
      });

      const results = transpiler.transpile();

      expect(results).toEqual([]);
    });

    // --- Расширение 1b: discover() выбрасывает SkillDiscoverError → пробросить ---
    it("пробрасывает SkillDiscoverError к вызывающему коду, если discover() выбросил ошибку", () => {
      // Создаём каталог .agloom/skills/ без прав на чтение
      const skillsDir = path.join(tmpDir, ".agloom", "skills");
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
  });
});
