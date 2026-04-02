// transpile-path-mapping.spec.ts
// Спецификация: docs/specs/skills-transpiler.md § Транспиляция, шаг 2
// Транспилер маппит пути: <agloomDir>/skills/ → <adapter.targetDir>/

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createSkillsTranspiler } from "../index.js";

/**
 * Стаб-адаптер с targetDir (новый интерфейс без transpile).
 */
function createTargetDirAdapter(agentId: string, targetDir: string) {
  return { agentId, targetDir };
}

describe("SkillsTranspiler", () => {
  describe("Транспиляция — маппинг путей транспилером", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "agl-skills-path-mapping-"),
      );
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Спецификация: § Транспиляция, шаг 2 ---
    // "для каждого файла из package.files — заменить префикс <agloomDir>/skills/
    //  на <adapter.targetDir>/, сформировав SkillOutputFile"
    it("заменяет префикс <agloomDir>/skills/ на <adapter.targetDir>/ в relativePath", () => {
      const skillDir = path.join(tmpDir, ".agloom", "skills", "my-skill");
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, "SKILL.md"), "# My Skill");

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createTargetDirAdapter("claude", ".claude/skills")],
      });

      const results = transpiler.transpile();

      expect(results).toHaveLength(1);
      expect(results[0].files[0].relativePath).toBe(
        ".claude/skills/my-skill/SKILL.md",
      );
      expect(results[0].files[0].sourcePath).toBe(
        ".agloom/skills/my-skill/SKILL.md",
      );
    });

    // --- Спецификация: § Транспиляция, шаг 2 ---
    // "Структура вложенных каталогов внутри skill-пакета сохраняется"
    it("сохраняет структуру вложенных каталогов при замене префикса", () => {
      const skillDir = path.join(tmpDir, ".agloom", "skills", "complex");
      fs.mkdirSync(path.join(skillDir, "src", "helpers"), { recursive: true });
      fs.writeFileSync(path.join(skillDir, "SKILL.md"), "# Skill");
      fs.writeFileSync(path.join(skillDir, "src", "index.ts"), "export {};");
      fs.writeFileSync(
        path.join(skillDir, "src", "helpers", "format.ts"),
        "export {};",
      );

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createTargetDirAdapter("claude", ".claude/skills")],
      });

      const results = transpiler.transpile();
      const paths = results[0].files.map((f) => f.relativePath);

      expect(paths).toContain(".claude/skills/complex/SKILL.md");
      expect(paths).toContain(".claude/skills/complex/src/index.ts");
      expect(paths).toContain(".claude/skills/complex/src/helpers/format.ts");
    });

    // --- Спецификация: § Транспиляция, шаг 2 ---
    // Граничное условие: agloomDir="." (plugin scenario)
    // "заменить префикс <agloomDir>/skills/ на <adapter.targetDir>/"
    // Когда agloomDir=".", префикс становится "skills/" (нормализованный),
    // и результат должен быть "<adapter.targetDir>/<остаток>"
    it('маппит пути корректно при agloomDir="." (plugin scenario)', () => {
      // Создаём структуру skills/ в корне tmpDir (не в .agloom/)
      const skillDir = path.join(tmpDir, "skills", "demo-skill");
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, "SKILL.md"), "# Demo");

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createTargetDirAdapter("claude", ".claude/skills")],
        agloomDir: ".",
      });

      const results = transpiler.transpile();

      expect(results).toHaveLength(1);
      expect(results[0].files[0].relativePath).toBe(
        ".claude/skills/demo-skill/SKILL.md",
      );
      expect(results[0].files[0].sourcePath).toBe("skills/demo-skill/SKILL.md");
    });

    // --- Спецификация: § Транспиляция, шаг 2 ---
    // Маппинг путей для нескольких адаптеров с разными targetDir
    it("маппит пути для нескольких адаптеров с разными targetDir", () => {
      const skillDir = path.join(tmpDir, ".agloom", "skills", "my-skill");
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, "SKILL.md"), "# Skill");

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [
          createTargetDirAdapter("claude", ".claude/skills"),
          createTargetDirAdapter("opencode", ".opencode/skills"),
        ],
      });

      const results = transpiler.transpile();

      expect(results).toHaveLength(2);

      const claudeResult = results.find((r) => r.agentId === "claude");
      expect(claudeResult!.files[0].relativePath).toBe(
        ".claude/skills/my-skill/SKILL.md",
      );

      const opencodeResult = results.find((r) => r.agentId === "opencode");
      expect(opencodeResult!.files[0].relativePath).toBe(
        ".opencode/skills/my-skill/SKILL.md",
      );
    });

    // --- Спецификация: § Транспиляция, шаг 2 ---
    // Маппинг путей при кастомном agloomDir
    it("маппит пути при кастомном agloomDir", () => {
      const skillDir = path.join(tmpDir, "custom-dir", "skills", "my-skill");
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, "SKILL.md"), "# Skill");

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createTargetDirAdapter("claude", ".claude/skills")],
        agloomDir: "custom-dir",
      });

      const results = transpiler.transpile();

      expect(results).toHaveLength(1);
      expect(results[0].files[0].relativePath).toBe(
        ".claude/skills/my-skill/SKILL.md",
      );
      expect(results[0].files[0].sourcePath).toBe(
        "custom-dir/skills/my-skill/SKILL.md",
      );
    });
  });
});
