// discover.spec.ts
// Спецификация: docs/specs/skills-transpiler.md § Обнаружение skill-пакетов

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createSkillsTranspiler } from "../index.js";
import { SkillDiscoverError } from "../errors.js";

/**
 * Стаб-адаптер для тестов discover(). Транспиляция здесь не тестируется.
 */
function createStubAdapter(agentId: string) {
  return {
    agentId,
    targetDir: `.${agentId}/skills`,
  };
}

describe("SkillsTranspiler", () => {
  describe("Обнаружение skill-пакетов", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-skills-discover-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Happy path: шаги 1–5 — обнаружение skill-пакетов ---
    it("обнаруживает skill-пакеты: директории с SKILL.md в .agloom/skills/", () => {
      // Arrange: создаём два skill-пакета
      const skill1Dir = path.join(tmpDir, ".agloom", "skills", "my-skill");
      fs.mkdirSync(skill1Dir, { recursive: true });
      fs.writeFileSync(path.join(skill1Dir, "SKILL.md"), "# My Skill");

      const skill2Dir = path.join(tmpDir, ".agloom", "skills", "another-skill");
      fs.mkdirSync(skill2Dir, { recursive: true });
      fs.writeFileSync(path.join(skill2Dir, "SKILL.md"), "# Another Skill");

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      // Act
      const packages = transpiler.discover();

      // Assert
      expect(packages).toHaveLength(2);

      const names = packages.map((p) => p.name);
      expect(names).toContain("my-skill");
      expect(names).toContain("another-skill");
    });

    // --- Трансформация: шаг 2 — имя skill = имя директории ---
    it("использует имя директории как name skill-пакета", () => {
      const skillDir = path.join(tmpDir, ".agloom", "skills", "code-formatter");
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, "SKILL.md"), "# Formatter");

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const packages = transpiler.discover();

      expect(packages).toHaveLength(1);
      expect(packages[0].name).toBe("code-formatter");
    });

    // --- Трансформация: шаг 2 — directoryPath относительно projectRoot ---
    it("формирует directoryPath относительно projectRoot", () => {
      const skillDir = path.join(tmpDir, ".agloom", "skills", "my-skill");
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, "SKILL.md"), "# My Skill");

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const packages = transpiler.discover();

      expect(packages).toHaveLength(1);
      expect(packages[0].directoryPath).toBe(".agloom/skills/my-skill");
    });

    // --- Трансформация: шаг 4 — рекурсивный сбор всех файлов пакета ---
    it("рекурсивно собирает все файлы skill-пакета в массив files", () => {
      const skillDir = path.join(tmpDir, ".agloom", "skills", "my-skill");
      const helpersDir = path.join(skillDir, "helpers");
      fs.mkdirSync(helpersDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, "SKILL.md"), "# My Skill");
      fs.writeFileSync(path.join(skillDir, "config.json"), '{"key": "value"}');
      fs.writeFileSync(path.join(helpersDir, "util.ts"), "export const x = 1;");

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const packages = transpiler.discover();

      expect(packages).toHaveLength(1);
      expect(packages[0].files).toHaveLength(3);

      const filePaths = packages[0].files.sort();
      expect(filePaths).toContain(".agloom/skills/my-skill/SKILL.md");
      expect(filePaths).toContain(".agloom/skills/my-skill/config.json");
      expect(filePaths).toContain(".agloom/skills/my-skill/helpers/util.ts");
    });

    // --- Расширение 1a: каталог .agloom/skills/ не существует → пустой массив ---
    it("возвращает пустой массив, если каталог .agloom/skills/ не существует", () => {
      // tmpDir пуст — нет .agloom/skills/

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const packages = transpiler.discover();

      expect(packages).toEqual([]);
    });

    // --- Расширение 2a: ошибка доступа к .agloom/skills/ (EACCES) ---
    it("выбрасывает SkillDiscoverError при ошибке доступа к каталогу .agloom/skills/", () => {
      const skillsDir = path.join(tmpDir, ".agloom", "skills");
      fs.mkdirSync(skillsDir, { recursive: true });
      fs.chmodSync(skillsDir, 0o000);

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      try {
        expect(() => transpiler.discover()).toThrow(SkillDiscoverError);
        expect(() => transpiler.discover()).toThrow(/Failed to scan directory \.agloom\/skills\//);
      } finally {
        fs.chmodSync(skillsDir, 0o755);
      }
    });

    // --- Расширение 3a: подкаталог не содержит SKILL.md → пропустить ---
    it("пропускает подкаталоги без SKILL.md", () => {
      const skillsDir = path.join(tmpDir, ".agloom", "skills");

      // Skill-пакет с SKILL.md
      const validSkill = path.join(skillsDir, "valid-skill");
      fs.mkdirSync(validSkill, { recursive: true });
      fs.writeFileSync(path.join(validSkill, "SKILL.md"), "# Valid");

      // Каталог без SKILL.md — не является skill-пакетом
      const invalidSkill = path.join(skillsDir, "not-a-skill");
      fs.mkdirSync(invalidSkill, { recursive: true });
      fs.writeFileSync(path.join(invalidSkill, "README.md"), "# Readme");

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const packages = transpiler.discover();

      expect(packages).toHaveLength(1);
      expect(packages[0].name).toBe("valid-skill");
    });

    // --- Расширение 4a: ошибка доступа при рекурсивном сканировании файлов ---
    it("выбрасывает SkillDiscoverError при ошибке доступа при рекурсивном сканировании подкаталога", () => {
      const skillDir = path.join(tmpDir, ".agloom", "skills", "my-skill");
      const restrictedSubDir = path.join(skillDir, "restricted");
      fs.mkdirSync(restrictedSubDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, "SKILL.md"), "# My Skill");
      fs.chmodSync(restrictedSubDir, 0o000);

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      try {
        expect(() => transpiler.discover()).toThrow(SkillDiscoverError);
        expect(() => transpiler.discover()).toThrow(/Failed to scan skill directory/);
      } finally {
        fs.chmodSync(restrictedSubDir, 0o755);
      }
    });

    // --- Happy path: пакет только с SKILL.md (без вспомогательных файлов) ---
    it("обнаруживает skill-пакет, содержащий только SKILL.md", () => {
      const skillDir = path.join(tmpDir, ".agloom", "skills", "minimal");
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, "SKILL.md"), "# Minimal");

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const packages = transpiler.discover();

      expect(packages).toHaveLength(1);
      expect(packages[0].name).toBe("minimal");
      expect(packages[0].files).toEqual([".agloom/skills/minimal/SKILL.md"]);
    });
  });
});
