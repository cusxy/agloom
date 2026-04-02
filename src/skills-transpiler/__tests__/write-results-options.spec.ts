// write-results-options.spec.ts
// Спецификация: docs/specs/skills-transpiler.md § Запись результатов
// Спецификация: docs/specs/interpolation.md § Расширение writeResults Skills Transpiler
//
// Тесты на новый options object: { targetRoot?, variablesByAgentId? }

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createSkillsTranspiler } from "../index.js";
import { SkillWriteError } from "../errors.js";

/**
 * Стаб-адаптер с targetDir (новый интерфейс без transpile).
 */
function createTargetDirAdapter(agentId: string, targetDir: string) {
  return { agentId, targetDir };
}

describe("SkillsTranspiler", () => {
  describe("Запись результатов — options object", () => {
    let tmpDir: string;
    let targetDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-skills-write-opts-"));
      targetDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "agl-skills-write-target-"),
      );
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(targetDir, { recursive: true, force: true });
    });

    // --- Спецификация: § Запись результатов, шаг 2 ---
    // "Определить effectiveRoot как options.targetRoot (если передан)
    //  или projectRoot из конфигурации транспилера"
    it("записывает файлы в options.targetRoot, если передан", () => {
      // Arrange: создаём исходный файл
      const sourceDir = path.join(tmpDir, ".agloom", "skills", "my-skill");
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(path.join(sourceDir, "SKILL.md"), "# My Skill");

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createTargetDirAdapter("claude", ".claude/skills")],
      });

      // Act: writeResults с options.targetRoot
      const writeResult = transpiler.writeResults(
        [
          {
            agentId: "claude",
            files: [
              {
                relativePath: ".claude/skills/my-skill/SKILL.md",
                sourcePath: ".agloom/skills/my-skill/SKILL.md",
              },
            ],
            errors: [],
          },
        ],
        { targetRoot: targetDir },
      );

      // Assert: файл записан в targetDir, не в tmpDir
      expect(writeResult.written).toContain(".claude/skills/my-skill/SKILL.md");
      expect(writeResult.errors).toHaveLength(0);

      expect(
        fs.existsSync(
          path.join(targetDir, ".claude", "skills", "my-skill", "SKILL.md"),
        ),
      ).toBe(true);
      expect(
        fs.existsSync(
          path.join(tmpDir, ".claude", "skills", "my-skill", "SKILL.md"),
        ),
      ).toBe(false);
    });

    // --- Спецификация: § Запись результатов, шаг 3 ---
    // "Если variablesByAgentId передан И расширение файла sourcePath равно .md
    //  — прочитать содержимое projectRoot / sourcePath"
    // --- Спецификация: docs/specs/interpolation.md § Расширение writeResults Skills Transpiler ---
    // "variablesByAgentId передаётся как часть объекта options"
    it("интерполирует .md файлы при наличии options.variablesByAgentId", () => {
      // Arrange
      const sourceDir = path.join(tmpDir, ".agloom", "skills", "my-skill");
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(
        path.join(sourceDir, "SKILL.md"),
        "Path: ${agloom:ROOT_DIR}/skills",
      );

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createTargetDirAdapter("claude", ".claude/skills")],
      });

      // Act: writeResults с options.variablesByAgentId
      const writeResult = transpiler.writeResults(
        [
          {
            agentId: "claude",
            files: [
              {
                relativePath: ".claude/skills/my-skill/SKILL.md",
                sourcePath: ".agloom/skills/my-skill/SKILL.md",
              },
            ],
            errors: [],
          },
        ],
        { variablesByAgentId: { claude: { ROOT_DIR: ".claude" } } },
      );

      // Assert
      expect(writeResult.written).toContain(".claude/skills/my-skill/SKILL.md");
      expect(writeResult.errors).toHaveLength(0);

      const writtenContent = fs.readFileSync(
        path.join(tmpDir, ".claude", "skills", "my-skill", "SKILL.md"),
        "utf-8",
      );
      expect(writtenContent).toBe("Path: .claude/skills");
    });

    // --- Спецификация: § Запись результатов, шаг 2, 3 ---
    // "targetRoot и variablesByAgentId работают одновременно"
    it("использует targetRoot и variablesByAgentId одновременно", () => {
      // Arrange
      const sourceDir = path.join(tmpDir, ".agloom", "skills", "my-skill");
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(
        path.join(sourceDir, "SKILL.md"),
        "Path: ${agloom:ROOT_DIR}",
      );

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createTargetDirAdapter("claude", ".claude/skills")],
      });

      // Act: writeResults с обоими параметрами
      const writeResult = transpiler.writeResults(
        [
          {
            agentId: "claude",
            files: [
              {
                relativePath: ".claude/skills/my-skill/SKILL.md",
                sourcePath: ".agloom/skills/my-skill/SKILL.md",
              },
            ],
            errors: [],
          },
        ],
        {
          targetRoot: targetDir,
          variablesByAgentId: { claude: { ROOT_DIR: ".claude" } },
        },
      );

      // Assert: файл записан в targetDir с интерполяцией
      expect(writeResult.written).toContain(".claude/skills/my-skill/SKILL.md");
      expect(writeResult.errors).toHaveLength(0);

      const writtenContent = fs.readFileSync(
        path.join(targetDir, ".claude", "skills", "my-skill", "SKILL.md"),
        "utf-8",
      );
      expect(writtenContent).toBe("Path: .claude");

      // Файл НЕ записан в projectRoot
      expect(
        fs.existsSync(
          path.join(tmpDir, ".claude", "skills", "my-skill", "SKILL.md"),
        ),
      ).toBe(false);
    });

    // --- Спецификация: § Запись результатов, расширение 3c ---
    // "variablesByAgentId передан, но ключ agentId отсутствует"
    it("возвращает SkillWriteError при отсутствии ключа agentId в options.variablesByAgentId", () => {
      const sourceDir = path.join(tmpDir, ".agloom", "skills", "my-skill");
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(
        path.join(sourceDir, "SKILL.md"),
        "Path: ${agloom:ROOT_DIR}",
      );

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createTargetDirAdapter("claude", ".claude/skills")],
      });

      const writeResult = transpiler.writeResults(
        [
          {
            agentId: "claude",
            files: [
              {
                relativePath: ".claude/skills/my-skill/SKILL.md",
                sourcePath: ".agloom/skills/my-skill/SKILL.md",
              },
            ],
            errors: [],
          },
        ],
        {
          variablesByAgentId: { opencode: { ROOT_DIR: ".opencode" } },
        },
      );

      expect(writeResult.errors.length).toBeGreaterThan(0);
      expect(writeResult.errors[0]).toBeInstanceOf(SkillWriteError);
      expect(writeResult.errors[0].message).toBe(
        "No interpolation variables for adapter: claude",
      );
    });

    // --- Спецификация: § Запись результатов, расширение 3d ---
    // "interpolate выбрасывает InterpolationError"
    it("возвращает SkillWriteError при InterpolationError в .md файле через options.variablesByAgentId", () => {
      const sourceDir = path.join(tmpDir, ".agloom", "skills", "my-skill");
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(
        path.join(sourceDir, "SKILL.md"),
        "Path: ${agloom:NONEXISTENT}",
      );

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createTargetDirAdapter("claude", ".claude/skills")],
      });

      const writeResult = transpiler.writeResults(
        [
          {
            agentId: "claude",
            files: [
              {
                relativePath: ".claude/skills/my-skill/SKILL.md",
                sourcePath: ".agloom/skills/my-skill/SKILL.md",
              },
            ],
            errors: [],
          },
        ],
        {
          variablesByAgentId: { claude: { ROOT_DIR: ".claude" } },
        },
      );

      expect(writeResult.errors.length).toBeGreaterThan(0);
      expect(writeResult.errors[0]).toBeInstanceOf(SkillWriteError);
      expect(writeResult.errors[0].message).toMatch(
        /Interpolation failed for \.agloom\/skills\/my-skill\/SKILL\.md/,
      );
    });

    // --- Спецификация: § Запись результатов, расширение 1a ---
    // "для каждого элемента массива errors создать SkillWriteError"
    it("создаёт отдельный SkillWriteError для каждого элемента errors в SkillTranspileResult", () => {
      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createTargetDirAdapter("claude", ".claude/skills")],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "claude",
          files: [
            {
              relativePath: ".claude/skills/my-skill/SKILL.md",
              sourcePath: ".agloom/skills/my-skill/SKILL.md",
            },
          ],
          errors: [
            {
              agentId: "claude",
              message: "Error one",
              cause: new Error("cause one"),
            },
            {
              agentId: "claude",
              message: "Error two",
              cause: new Error("cause two"),
            },
            {
              agentId: "claude",
              message: "Error three",
              cause: new Error("cause three"),
            },
          ],
        },
      ]);

      // Должно быть 3 SkillWriteError — по одному на каждый элемент errors
      expect(writeResult.errors).toHaveLength(3);
      expect(writeResult.errors[0]).toBeInstanceOf(SkillWriteError);
      expect(writeResult.errors[0].message).toBe("Error one");
      expect(writeResult.errors[1]).toBeInstanceOf(SkillWriteError);
      expect(writeResult.errors[1].message).toBe("Error two");
      expect(writeResult.errors[2]).toBeInstanceOf(SkillWriteError);
      expect(writeResult.errors[2].message).toBe("Error three");
    });

    // --- Спецификация: § Запись результатов ---
    // Граничное условие: побайтовое копирование не-.md файлов при options.variablesByAgentId
    it("побайтово копирует не-.md файлы, даже если options.variablesByAgentId передан", () => {
      const sourceDir = path.join(tmpDir, ".agloom", "skills", "my-skill");
      fs.mkdirSync(sourceDir, { recursive: true });
      const tsContent = 'const dir = "${agloom:ROOT_DIR}";';
      fs.writeFileSync(path.join(sourceDir, "helper.ts"), tsContent);

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createTargetDirAdapter("claude", ".claude/skills")],
      });

      const writeResult = transpiler.writeResults(
        [
          {
            agentId: "claude",
            files: [
              {
                relativePath: ".claude/skills/my-skill/helper.ts",
                sourcePath: ".agloom/skills/my-skill/helper.ts",
              },
            ],
            errors: [],
          },
        ],
        { variablesByAgentId: { claude: { ROOT_DIR: ".claude" } } },
      );

      expect(writeResult.written).toContain(
        ".claude/skills/my-skill/helper.ts",
      );
      const writtenContent = fs.readFileSync(
        path.join(tmpDir, ".claude", "skills", "my-skill", "helper.ts"),
        "utf-8",
      );
      expect(writtenContent).toBe(tsContent);
    });

    // --- Спецификация: § Запись результатов ---
    // Обратная совместимость: без options — побайтовое копирование
    it("побайтово копирует все файлы, если options не передан (обратная совместимость)", () => {
      const sourceDir = path.join(tmpDir, ".agloom", "skills", "my-skill");
      fs.mkdirSync(sourceDir, { recursive: true });
      const mdContent = "Path: ${agloom:ROOT_DIR}/skills";
      fs.writeFileSync(path.join(sourceDir, "SKILL.md"), mdContent);

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createTargetDirAdapter("claude", ".claude/skills")],
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "claude",
          files: [
            {
              relativePath: ".claude/skills/my-skill/SKILL.md",
              sourcePath: ".agloom/skills/my-skill/SKILL.md",
            },
          ],
          errors: [],
        },
      ]);

      expect(writeResult.written).toContain(".claude/skills/my-skill/SKILL.md");
      const writtenContent = fs.readFileSync(
        path.join(tmpDir, ".claude", "skills", "my-skill", "SKILL.md"),
        "utf-8",
      );
      expect(writtenContent).toBe(mdContent);
    });
  });
});
