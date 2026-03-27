// integration.spec.ts
// Спецификация: docs/specs/integration-tests.md § Skills Transpiler Integration

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  createSkillsTranspiler,
  ClaudeSkillAdapter,
  OpenCodeSkillAdapter,
} from "../index.js";

describe("SkillsTranspiler", () => {
  describe("Integration — полный pipeline", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "agl-skills-integration-"),
      );
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- IT-SKILL-01: Pipeline с Claude адаптером ---
    it("skill-пакеты обнаруживаются, транспилируются и копируются в целевой каталог Claude", () => {
      // Вход: создать каноническую структуру
      const skillDir = path.join(tmpDir, ".agloom", "skills", "my-skill");
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(
        path.join(skillDir, "SKILL.md"),
        "---\nname: my-skill\n---\nSkill body",
      );
      fs.mkdirSync(path.join(skillDir, "helpers"), { recursive: true });
      fs.writeFileSync(
        path.join(skillDir, "helpers", "util.ts"),
        "export const x = 1;",
      );

      // Поведение: шаги 1–3
      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [new ClaudeSkillAdapter()],
      });
      const results = transpiler.transpile();
      const writeResult = transpiler.writeResults(results);

      // Шаг 4: writeResult.errors — пустой массив
      expect(writeResult.errors).toHaveLength(0);

      // Шаги 5–6: SKILL.md побайтово совпадает
      const sourceSkillContent = fs.readFileSync(
        path.join(skillDir, "SKILL.md"),
      );
      const targetSkillContent = fs.readFileSync(
        path.join(tmpDir, ".claude", "skills", "my-skill", "SKILL.md"),
      );
      expect(targetSkillContent.equals(sourceSkillContent)).toBe(true);

      // Шаги 7–8: helpers/util.ts побайтово совпадает
      const sourceHelperContent = fs.readFileSync(
        path.join(skillDir, "helpers", "util.ts"),
      );
      const targetHelperContent = fs.readFileSync(
        path.join(
          tmpDir,
          ".claude",
          "skills",
          "my-skill",
          "helpers",
          "util.ts",
        ),
      );
      expect(targetHelperContent.equals(sourceHelperContent)).toBe(true);

      // Результат: writeResult.written содержит оба файла
      expect(writeResult.written).toContain(".claude/skills/my-skill/SKILL.md");
      expect(writeResult.written).toContain(
        ".claude/skills/my-skill/helpers/util.ts",
      );
    });

    // --- IT-SKILL-02: Pipeline с несколькими skill-пакетами ---
    it("несколько skill-пакетов обрабатываются за один вызов", () => {
      // Вход: создать два skill-пакета
      const alphaDir = path.join(tmpDir, ".agloom", "skills", "alpha");
      const betaDir = path.join(tmpDir, ".agloom", "skills", "beta");
      fs.mkdirSync(alphaDir, { recursive: true });
      fs.mkdirSync(betaDir, { recursive: true });
      fs.writeFileSync(path.join(alphaDir, "SKILL.md"), "alpha skill");
      fs.writeFileSync(path.join(betaDir, "SKILL.md"), "beta skill");

      // Поведение: шаги 1–3
      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [new ClaudeSkillAdapter()],
      });
      const results = transpiler.transpile();
      const writeResult = transpiler.writeResults(results);

      // Шаг 4: writeResult.errors — пустой массив
      expect(writeResult.errors).toHaveLength(0);

      // Шаги 5–6: alpha/SKILL.md побайтово совпадает
      const sourceAlpha = fs.readFileSync(path.join(alphaDir, "SKILL.md"));
      const targetAlpha = fs.readFileSync(
        path.join(tmpDir, ".claude", "skills", "alpha", "SKILL.md"),
      );
      expect(targetAlpha.equals(sourceAlpha)).toBe(true);

      // Шаги 7–8: beta/SKILL.md побайтово совпадает
      const sourceBeta = fs.readFileSync(path.join(betaDir, "SKILL.md"));
      const targetBeta = fs.readFileSync(
        path.join(tmpDir, ".claude", "skills", "beta", "SKILL.md"),
      );
      expect(targetBeta.equals(sourceBeta)).toBe(true);

      // Результат: writeResult.written содержит оба файла
      expect(writeResult.written).toContain(".claude/skills/alpha/SKILL.md");
      expect(writeResult.written).toContain(".claude/skills/beta/SKILL.md");
    });

    // --- IT-SKILL-03: Pipeline с OpenCode адаптером ---
    it("OpenCode адаптер генерирует файлы в .opencode/skills/ из канонического .agloom/skills/", () => {
      // Вход: создать skill-пакет
      const skillDir = path.join(tmpDir, ".agloom", "skills", "my-skill");
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, "SKILL.md"), "skill content");

      // Поведение: шаги 1–3
      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [new OpenCodeSkillAdapter()],
      });
      const results = transpiler.transpile();
      const writeResult = transpiler.writeResults(results);

      // Шаг 4: writeResult.errors — пустой массив
      expect(writeResult.errors).toHaveLength(0);

      // Шаг 5: .opencode/skills/my-skill/SKILL.md побайтово совпадает
      const sourceContent = fs.readFileSync(path.join(skillDir, "SKILL.md"));
      const targetContent = fs.readFileSync(
        path.join(tmpDir, ".opencode", "skills", "my-skill", "SKILL.md"),
      );
      expect(targetContent.equals(sourceContent)).toBe(true);

      // Результат: writeResult.written содержит целевой файл
      expect(writeResult.written).toContain(
        ".opencode/skills/my-skill/SKILL.md",
      );
    });

    // --- IT-SKILL-04: Pipeline при отсутствии каталога .agloom/skills/ ---
    it("корректно завершается при отсутствии каталога .agloom/skills/", () => {
      // Вход: tmpDir — пустая директория

      // Поведение: шаги 1–2
      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [new ClaudeSkillAdapter()],
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
