// write-results.spec.ts
// Спецификация: docs/specs/skills-transpiler.md § Запись результатов

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createSkillsTranspiler } from "../index.js";
import { SkillWriteError } from "../errors.js";

function createStubAdapter(agentId: string) {
  return {
    agentId,
    transpile: () => [],
  };
}

describe("SkillsTranspiler", () => {
  describe("Запись результатов", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-skills-write-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Happy path: шаги 1–3 — побайтовое копирование файлов ---
    it("побайтово копирует файлы из sourcePath в relativePath и возвращает пути записанных файлов", () => {
      // Arrange: создаём исходный файл
      const sourceDir = path.join(tmpDir, ".agloom", "skills", "my-skill");
      fs.mkdirSync(sourceDir, { recursive: true });
      const sourceContent = "# My Skill\n\nDescription with Unicode: Привет 🚀";
      fs.writeFileSync(path.join(sourceDir, "SKILL.md"), sourceContent);

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      // Act
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

      // Assert
      expect(writeResult.written).toContain(".claude/skills/my-skill/SKILL.md");
      expect(writeResult.errors).toHaveLength(0);

      // Проверяем, что файл действительно записан с тем же содержимым
      const writtenContent = fs.readFileSync(
        path.join(tmpDir, ".claude", "skills", "my-skill", "SKILL.md"),
        "utf-8",
      );
      expect(writtenContent).toBe(sourceContent);
    });

    // --- Трансформация: шаг 2 — побайтовое копирование бинарных файлов ---
    it("побайтово копирует бинарные файлы (не повреждает данные)", () => {
      // Arrange: создаём бинарный файл
      const sourceDir = path.join(tmpDir, ".agloom", "skills", "my-skill");
      fs.mkdirSync(sourceDir, { recursive: true });
      // Создаём буфер с произвольными байтами (включая null bytes)
      const binaryContent = Buffer.from([
        0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd, 0x89, 0x50, 0x4e, 0x47,
      ]);
      fs.writeFileSync(path.join(sourceDir, "image.png"), binaryContent);

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      // Act
      const writeResult = transpiler.writeResults([
        {
          agentId: "claude",
          files: [
            {
              relativePath: ".claude/skills/my-skill/image.png",
              sourcePath: ".agloom/skills/my-skill/image.png",
            },
          ],
          errors: [],
        },
      ]);

      // Assert
      expect(writeResult.written).toContain(
        ".claude/skills/my-skill/image.png",
      );

      const writtenContent = fs.readFileSync(
        path.join(tmpDir, ".claude", "skills", "my-skill", "image.png"),
      );
      expect(Buffer.compare(writtenContent, binaryContent)).toBe(0);
    });

    // --- Трансформация: шаг 2 — создание промежуточных каталогов ---
    it("создаёт промежуточные каталоги при записи файла", () => {
      // Arrange
      const sourceDir = path.join(
        tmpDir,
        ".agloom",
        "skills",
        "my-skill",
        "deep",
        "nested",
      );
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(path.join(sourceDir, "file.ts"), "export const x = 1;");

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      // Act
      const writeResult = transpiler.writeResults([
        {
          agentId: "claude",
          files: [
            {
              relativePath: ".claude/skills/my-skill/deep/nested/file.ts",
              sourcePath: ".agloom/skills/my-skill/deep/nested/file.ts",
            },
          ],
          errors: [],
        },
      ]);

      // Assert
      expect(writeResult.written).toContain(
        ".claude/skills/my-skill/deep/nested/file.ts",
      );

      const writtenContent = fs.readFileSync(
        path.join(
          tmpDir,
          ".claude",
          "skills",
          "my-skill",
          "deep",
          "nested",
          "file.ts",
        ),
        "utf-8",
      );
      expect(writtenContent).toBe("export const x = 1;");
    });

    // --- Расширение 1a: SkillTranspileResult содержит ошибки → пропуск с сообщением ---
    it('пропускает запись файлов адаптера с ошибками и создаёт SkillWriteError "Skipped {agentId}: transpile errors present"', () => {
      // Arrange: создаём исходный файл (не должен быть записан)
      const sourceDir = path.join(tmpDir, ".agloom", "skills", "my-skill");
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(path.join(sourceDir, "SKILL.md"), "# My Skill");

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("failing")],
      });

      // Act
      const writeResult = transpiler.writeResults([
        {
          agentId: "failing",
          files: [
            {
              relativePath: ".claude/skills/my-skill/SKILL.md",
              sourcePath: ".agloom/skills/my-skill/SKILL.md",
            },
          ],
          errors: [
            {
              agentId: "failing",
              message: "Adapter failed",
              cause: new Error("original"),
            },
          ],
        },
      ]);

      // Assert: файл НЕ записан
      expect(
        fs.existsSync(
          path.join(tmpDir, ".claude", "skills", "my-skill", "SKILL.md"),
        ),
      ).toBe(false);
      expect(writeResult.written).not.toContain(
        ".claude/skills/my-skill/SKILL.md",
      );

      // Assert: ошибка с правильным сообщением
      expect(writeResult.errors).toHaveLength(1);
      expect(writeResult.errors[0]).toBeInstanceOf(SkillWriteError);
      expect(writeResult.errors[0].message).toBe("Adapter failed");
    });

    // --- Расширение 1a: смешанный сценарий — один адаптер с ошибками, другой без ---
    it("пропускает файлы адаптера с ошибками, но записывает файлы успешного адаптера", () => {
      // Arrange
      const sourceDir = path.join(tmpDir, ".agloom", "skills", "my-skill");
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(path.join(sourceDir, "SKILL.md"), "# My Skill");

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("failing"), createStubAdapter("claude")],
      });

      // Act
      const writeResult = transpiler.writeResults([
        {
          agentId: "failing",
          files: [
            {
              relativePath: ".failing/skills/my-skill/SKILL.md",
              sourcePath: ".agloom/skills/my-skill/SKILL.md",
            },
          ],
          errors: [
            {
              agentId: "failing",
              message: "Adapter failed",
              cause: new Error("original"),
            },
          ],
        },
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

      // Assert: failing адаптер НЕ записан
      expect(
        fs.existsSync(
          path.join(tmpDir, ".failing", "skills", "my-skill", "SKILL.md"),
        ),
      ).toBe(false);

      // Assert: claude адаптер записан
      expect(
        fs.existsSync(
          path.join(tmpDir, ".claude", "skills", "my-skill", "SKILL.md"),
        ),
      ).toBe(true);
      expect(writeResult.written).toContain(".claude/skills/my-skill/SKILL.md");

      // Assert: ошибки failing адаптера в результате
      expect(writeResult.errors.length).toBeGreaterThan(0);
    });

    // --- Расширение 2a: sourcePath не существует → SkillWriteError ---
    it("возвращает SkillWriteError, если sourcePath не существует", () => {
      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      // Act: sourcePath не существует
      const writeResult = transpiler.writeResults([
        {
          agentId: "claude",
          files: [
            {
              relativePath: ".claude/skills/missing/SKILL.md",
              sourcePath: ".agloom/skills/missing/SKILL.md",
            },
          ],
          errors: [],
        },
      ]);

      // Assert
      expect(writeResult.errors.length).toBeGreaterThan(0);
      expect(writeResult.errors[0]).toBeInstanceOf(SkillWriteError);
      expect(writeResult.errors[0].message).toMatch(
        /Failed to read source \.agloom\/skills\/missing\/SKILL\.md/,
      );
    });

    // --- Расширение 2b: ошибка записи целевого файла → SkillWriteError ---
    it("возвращает SkillWriteError при ошибке записи целевого файла", () => {
      // Arrange: создаём исходный файл
      const sourceDir = path.join(tmpDir, ".agloom", "skills", "my-skill");
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(path.join(sourceDir, "SKILL.md"), "# My Skill");

      // Создаём файл-блокер вместо каталога — запись невозможна
      fs.writeFileSync(path.join(tmpDir, ".claude"), "blocker");

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      // Act
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

      // Assert
      expect(writeResult.errors.length).toBeGreaterThan(0);
      expect(writeResult.errors[0]).toBeInstanceOf(SkillWriteError);
      expect(writeResult.errors[0].message).toMatch(
        /Failed to write \.claude\/skills\/my-skill\/SKILL\.md/,
      );
    });

    // --- Happy path: запись результатов нескольких адаптеров ---
    it("записывает файлы от нескольких адаптеров", () => {
      // Arrange
      const sourceDir = path.join(tmpDir, ".agloom", "skills", "my-skill");
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(path.join(sourceDir, "SKILL.md"), "# My Skill");

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude"), createStubAdapter("other")],
      });

      // Act
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
        {
          agentId: "other",
          files: [
            {
              relativePath: ".other/skills/my-skill/SKILL.md",
              sourcePath: ".agloom/skills/my-skill/SKILL.md",
            },
          ],
          errors: [],
        },
      ]);

      // Assert
      expect(writeResult.written).toContain(".claude/skills/my-skill/SKILL.md");
      expect(writeResult.written).toContain(".other/skills/my-skill/SKILL.md");
      expect(writeResult.errors).toHaveLength(0);
    });

    // =====================================================================
    // Спецификация: docs/specs/interpolation.md § Расширение writeResults Skills Transpiler
    // =====================================================================

    // --- Изменения в поведении: шаг 2 — интерполяция .md файлов при наличии variablesByAgentId ---
    it("интерполирует .md файлы при наличии variablesByAgentId", () => {
      // Arrange: создаём .md файл с agloom-переменной
      const sourceDir = path.join(tmpDir, ".agloom", "skills", "my-skill");
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(
        path.join(sourceDir, "SKILL.md"),
        "Path: ${agloom:ROOT_DIR}/skills",
      );

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const variablesByAgentId: Record<string, Record<string, string>> = {
        claude: { ROOT_DIR: ".claude" },
      };

      // Act
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
        variablesByAgentId,
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

    // --- Изменения в поведении: шаг 2 — побайтовое копирование не-.md файлов при variablesByAgentId ---
    it("побайтово копирует не-.md файлы, даже если variablesByAgentId передан", () => {
      // Arrange: создаём .ts файл с agloom-переменной (не должен интерполироваться)
      const sourceDir = path.join(tmpDir, ".agloom", "skills", "my-skill");
      fs.mkdirSync(sourceDir, { recursive: true });
      const tsContent = 'const dir = "${agloom:ROOT_DIR}";';
      fs.writeFileSync(path.join(sourceDir, "helper.ts"), tsContent);

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const variablesByAgentId: Record<string, Record<string, string>> = {
        claude: { ROOT_DIR: ".claude" },
      };

      // Act
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
        variablesByAgentId,
      );

      // Assert: файл скопирован побайтово, без интерполяции
      expect(writeResult.written).toContain(
        ".claude/skills/my-skill/helper.ts",
      );
      const writtenContent = fs.readFileSync(
        path.join(tmpDir, ".claude", "skills", "my-skill", "helper.ts"),
        "utf-8",
      );
      expect(writtenContent).toBe(tsContent);
    });

    // --- Обратная совместимость: побайтовое копирование всех файлов, если variablesByAgentId не передан ---
    it("побайтово копирует все файлы, если variablesByAgentId не передан (обратная совместимость)", () => {
      // Arrange: создаём .md файл с agloom-переменной (не должен интерполироваться)
      const sourceDir = path.join(tmpDir, ".agloom", "skills", "my-skill");
      fs.mkdirSync(sourceDir, { recursive: true });
      const mdContent = "Path: ${agloom:ROOT_DIR}/skills";
      fs.writeFileSync(path.join(sourceDir, "SKILL.md"), mdContent);

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      // Act: без variablesByAgentId
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

      // Assert: файл скопирован побайтово, без интерполяции
      expect(writeResult.written).toContain(".claude/skills/my-skill/SKILL.md");
      const writtenContent = fs.readFileSync(
        path.join(tmpDir, ".claude", "skills", "my-skill", "SKILL.md"),
        "utf-8",
      );
      expect(writtenContent).toBe(mdContent);
    });

    // --- Расширение 2c: SkillWriteError при отсутствии agentId в variablesByAgentId ---
    it('возвращает SkillWriteError "No interpolation variables for adapter: {agentId}" при отсутствии ключа agentId', () => {
      // Arrange: создаём .md файл
      const sourceDir = path.join(tmpDir, ".agloom", "skills", "my-skill");
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(
        path.join(sourceDir, "SKILL.md"),
        "Path: ${agloom:ROOT_DIR}",
      );

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      // variablesByAgentId передан, но ключ "claude" отсутствует
      const variablesByAgentId: Record<string, Record<string, string>> = {
        opencode: { ROOT_DIR: ".opencode" },
      };

      // Act
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
        variablesByAgentId,
      );

      // Assert
      expect(writeResult.errors.length).toBeGreaterThan(0);
      expect(writeResult.errors[0]).toBeInstanceOf(SkillWriteError);
      expect(writeResult.errors[0].message).toBe(
        "No interpolation variables for adapter: claude",
      );
    });

    // --- Расширение 2d: SkillWriteError при InterpolationError в .md файле ---
    it('возвращает SkillWriteError "Interpolation failed for {sourcePath}: ..." при ошибке интерполяции .md файла', () => {
      // Arrange: создаём .md файл с несуществующей agloom-переменной
      const sourceDir = path.join(tmpDir, ".agloom", "skills", "my-skill");
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(
        path.join(sourceDir, "SKILL.md"),
        "Path: ${agloom:NONEXISTENT}",
      );

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const variablesByAgentId: Record<string, Record<string, string>> = {
        claude: { ROOT_DIR: ".claude" },
      };

      // Act
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
        variablesByAgentId,
      );

      // Assert
      expect(writeResult.errors.length).toBeGreaterThan(0);
      expect(writeResult.errors[0]).toBeInstanceOf(SkillWriteError);
      expect(writeResult.errors[0].message).toMatch(
        /Interpolation failed for \.agloom\/skills\/my-skill\/SKILL\.md/,
      );
    });

    // --- Изменения в поведении: шаг 2 — case-insensitive проверка расширения .md ---
    it("интерполирует файлы с расширением .MD (case-insensitive)", () => {
      // Arrange
      const sourceDir = path.join(tmpDir, ".agloom", "skills", "my-skill");
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(
        path.join(sourceDir, "README.MD"),
        "Path: ${agloom:ROOT_DIR}",
      );

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const variablesByAgentId: Record<string, Record<string, string>> = {
        claude: { ROOT_DIR: ".claude" },
      };

      // Act
      const writeResult = transpiler.writeResults(
        [
          {
            agentId: "claude",
            files: [
              {
                relativePath: ".claude/skills/my-skill/README.MD",
                sourcePath: ".agloom/skills/my-skill/README.MD",
              },
            ],
            errors: [],
          },
        ],
        variablesByAgentId,
      );

      // Assert
      expect(writeResult.written).toContain(
        ".claude/skills/my-skill/README.MD",
      );
      const writtenContent = fs.readFileSync(
        path.join(tmpDir, ".claude", "skills", "my-skill", "README.MD"),
        "utf-8",
      );
      expect(writtenContent).toBe("Path: .claude");
    });
  });
});
