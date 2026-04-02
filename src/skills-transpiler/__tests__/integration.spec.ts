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
    // --- IT-SKILL-05: Pipeline с agloomDir="." ---
    it('IT-SKILL-05: обнаруживает skill-пакеты в skills/ при agloomDir = "."', () => {
      // Вход: создать структуру плагина
      const skillDir = path.join(tmpDir, "skills", "my-skill");
      const docsDir = path.join(skillDir, "docs");
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, "SKILL.md"), "plugin skill body");
      fs.writeFileSync(path.join(docsDir, "readme.md"), "plugin readme");

      // Поведение: шаги 1–3
      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [new ClaudeSkillAdapter()],
        agloomDir: ".",
      });
      const results = transpiler.transpile();
      const writeResult = transpiler.writeResults(results);

      // Шаг 4: writeResult.errors — пустой массив
      expect(writeResult.errors).toHaveLength(0);

      // Шаги 5–6: SKILL.md побайтово совпадает
      const sourceSkill = fs.readFileSync(path.join(skillDir, "SKILL.md"));
      const targetSkill = fs.readFileSync(
        path.join(tmpDir, ".claude", "skills", "my-skill", "SKILL.md"),
      );
      expect(targetSkill.equals(sourceSkill)).toBe(true);

      // Шаги 7–8: docs/readme.md побайтово совпадает
      const sourceReadme = fs.readFileSync(path.join(docsDir, "readme.md"));
      const targetReadme = fs.readFileSync(
        path.join(tmpDir, ".claude", "skills", "my-skill", "docs", "readme.md"),
      );
      expect(targetReadme.equals(sourceReadme)).toBe(true);

      // Результат: writeResult.written содержит оба файла
      expect(writeResult.written).toContain(".claude/skills/my-skill/SKILL.md");
      expect(writeResult.written).toContain(
        ".claude/skills/my-skill/docs/readme.md",
      );
    });

    // --- IT-SKILL-06: Pipeline с writeResults targetRoot ---
    it("IT-SKILL-06: writeResults записывает файлы в targetRoot, а не в projectRoot", () => {
      // Вход: создать sourceDir и targetDir
      const sourceDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "agl-skills-source-"),
      );
      const targetDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "agl-skills-target-"),
      );

      try {
        const skillDir = path.join(sourceDir, "skills", "my-skill");
        fs.mkdirSync(skillDir, { recursive: true });
        fs.writeFileSync(path.join(skillDir, "SKILL.md"), "source skill body");

        // Поведение: шаги 1–3
        const transpiler = createSkillsTranspiler({
          projectRoot: sourceDir,
          adapters: [new ClaudeSkillAdapter()],
          agloomDir: ".",
        });
        const results = transpiler.transpile();
        const writeResult = transpiler.writeResults(results, {
          targetRoot: targetDir,
        });

        // Шаг 4: writeResult.errors — пустой массив
        expect(writeResult.errors).toHaveLength(0);

        // Шаги 5–6: файл в targetDir побайтово совпадает с исходным
        const sourceContent = fs.readFileSync(path.join(skillDir, "SKILL.md"));
        const targetContent = fs.readFileSync(
          path.join(targetDir, ".claude", "skills", "my-skill", "SKILL.md"),
        );
        expect(targetContent.equals(sourceContent)).toBe(true);

        // Шаг 7: файл НЕ существует в sourceDir
        expect(
          fs.existsSync(
            path.join(sourceDir, ".claude", "skills", "my-skill", "SKILL.md"),
          ),
        ).toBe(false);

        // Результат: writeResult.written содержит целевой файл
        expect(writeResult.written).toContain(
          ".claude/skills/my-skill/SKILL.md",
        );
      } finally {
        fs.rmSync(sourceDir, { recursive: true, force: true });
        fs.rmSync(targetDir, { recursive: true, force: true });
      }
    });

    // --- IT-SKILL-07: Pipeline с writeResults { targetRoot, variablesByAgentId } ---
    it("IT-SKILL-07: writeResults записывает в targetRoot и интерполирует .md файлы", () => {
      // Вход: создать sourceDir и targetDir
      const sourceDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "agl-skills-source-"),
      );
      const targetDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "agl-skills-target-"),
      );

      try {
        const skillDir = path.join(sourceDir, "skills", "my-skill");
        const helpersDir = path.join(skillDir, "helpers");
        fs.mkdirSync(helpersDir, { recursive: true });
        fs.writeFileSync(
          path.join(skillDir, "SKILL.md"),
          "Root: ${agloom:ROOT_DIR}",
        );
        fs.writeFileSync(
          path.join(helpersDir, "util.ts"),
          "export const x = 1;",
        );

        // Поведение: шаги 1–3
        const transpiler = createSkillsTranspiler({
          projectRoot: sourceDir,
          adapters: [new ClaudeSkillAdapter()],
          agloomDir: ".",
        });
        const results = transpiler.transpile();
        const writeResult = transpiler.writeResults(results, {
          targetRoot: targetDir,
          variablesByAgentId: { claude: { ROOT_DIR: ".claude" } },
        });

        // Шаг 4: writeResult.errors — пустой массив
        expect(writeResult.errors).toHaveLength(0);

        // Шаги 5–6: SKILL.md интерполирован
        const mdContent = fs.readFileSync(
          path.join(targetDir, ".claude", "skills", "my-skill", "SKILL.md"),
          "utf-8",
        );
        expect(mdContent).toBe("Root: .claude");

        // Шаги 7–8: util.ts скопирован побайтово
        const sourceTs = fs.readFileSync(path.join(helpersDir, "util.ts"));
        const targetTs = fs.readFileSync(
          path.join(
            targetDir,
            ".claude",
            "skills",
            "my-skill",
            "helpers",
            "util.ts",
          ),
        );
        expect(targetTs.equals(sourceTs)).toBe(true);

        // Результат: writeResult.written содержит оба файла
        expect(writeResult.written).toContain(
          ".claude/skills/my-skill/SKILL.md",
        );
        expect(writeResult.written).toContain(
          ".claude/skills/my-skill/helpers/util.ts",
        );
      } finally {
        fs.rmSync(sourceDir, { recursive: true, force: true });
        fs.rmSync(targetDir, { recursive: true, force: true });
      }
    });

    // --- IT-SKILL-08: Pipeline с variablesByAgentId — интерполяция .md и побайтовое копирование .ts ---
    it("IT-SKILL-08: .md файлы интерполируются, .ts файлы копируются побайтово", () => {
      // Вход: создать каноническую структуру
      const skillDir = path.join(tmpDir, ".agloom", "skills", "my-skill");
      const helpersDir = path.join(skillDir, "helpers");
      fs.mkdirSync(helpersDir, { recursive: true });
      fs.writeFileSync(
        path.join(skillDir, "SKILL.md"),
        "Agents: ${agloom:AGENTS_DIR}",
      );
      fs.writeFileSync(
        path.join(helpersDir, "util.ts"),
        "// ${agloom:AGENTS_DIR}",
      );

      // Поведение: шаги 1–3
      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [new ClaudeSkillAdapter()],
      });
      const results = transpiler.transpile();
      const writeResult = transpiler.writeResults(results, {
        variablesByAgentId: { claude: { AGENTS_DIR: ".claude/agents" } },
      });

      // Шаг 4: writeResult.errors — пустой массив
      expect(writeResult.errors).toHaveLength(0);

      // Шаги 5–6: SKILL.md интерполирован
      const mdContent = fs.readFileSync(
        path.join(tmpDir, ".claude", "skills", "my-skill", "SKILL.md"),
        "utf-8",
      );
      expect(mdContent).toBe("Agents: .claude/agents");

      // Шаги 7–8: util.ts скопирован побайтово (без интерполяции)
      const sourceTs = fs.readFileSync(path.join(helpersDir, "util.ts"));
      const targetTs = fs.readFileSync(
        path.join(
          tmpDir,
          ".claude",
          "skills",
          "my-skill",
          "helpers",
          "util.ts",
        ),
      );
      expect(targetTs.equals(sourceTs)).toBe(true);

      // Результат: writeResult.written содержит оба файла
      expect(writeResult.written).toContain(".claude/skills/my-skill/SKILL.md");
      expect(writeResult.written).toContain(
        ".claude/skills/my-skill/helpers/util.ts",
      );
    });
  });
});
