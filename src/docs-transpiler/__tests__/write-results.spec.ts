// write-results.spec.ts
// Спецификация: docs/specs/docs-transpiler.md § Запись результатов

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createResourceTranspiler } from "../index.js";
import { ResourceWriteError } from "../errors.js";

function createStubAdapter(agentId: string, targetDir: string) {
  return { agentId, targetDir };
}

describe("ResourceTranspiler", () => {
  describe("Запись результатов", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-resource-write-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Happy path: шаги 1–4 — побайтовое копирование файлов без variablesByAgentId ---
    it("побайтово копирует файлы из sourcePath в relativePath и возвращает пути записанных файлов", () => {
      // Arrange: создаём исходный файл
      const sourceDir = path.join(tmpDir, ".agloom", "docs");
      fs.mkdirSync(sourceDir, { recursive: true });
      const sourceContent = "# Overview\n\nDescription with Unicode: Привет";
      fs.writeFileSync(path.join(sourceDir, "overview.md"), sourceContent);

      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude", ".claude/docs")],
        resourceType: "docs",
      });

      // Act
      const writeResult = transpiler.writeResults([
        {
          agentId: "claude",
          files: [
            {
              relativePath: ".claude/docs/overview.md",
              sourcePath: ".agloom/docs/overview.md",
            },
          ],
          errors: [],
        },
      ]);

      // Assert
      expect(writeResult.written).toContain(".claude/docs/overview.md");
      expect(writeResult.errors).toHaveLength(0);

      const writtenContent = fs.readFileSync(path.join(tmpDir, ".claude", "docs", "overview.md"), "utf-8");
      expect(writtenContent).toBe(sourceContent);
    });

    // --- Трансформация: шаг 3 — побайтовое копирование бинарных файлов (не-.md) ---
    it("побайтово копирует бинарные файлы (не повреждает данные)", () => {
      const sourceDir = path.join(tmpDir, ".agloom", "docs");
      fs.mkdirSync(sourceDir, { recursive: true });
      const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd, 0x89, 0x50, 0x4e, 0x47]);
      fs.writeFileSync(path.join(sourceDir, "image.png"), binaryContent);

      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude", ".claude/docs")],
        resourceType: "docs",
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "claude",
          files: [
            {
              relativePath: ".claude/docs/image.png",
              sourcePath: ".agloom/docs/image.png",
            },
          ],
          errors: [],
        },
      ]);

      expect(writeResult.written).toContain(".claude/docs/image.png");

      const writtenContent = fs.readFileSync(path.join(tmpDir, ".claude", "docs", "image.png"));
      expect(Buffer.compare(writtenContent, binaryContent)).toBe(0);
    });

    // --- Трансформация: шаг 3 — создание промежуточных каталогов ---
    it("создаёт промежуточные каталоги при записи файла", () => {
      const sourceDir = path.join(tmpDir, ".agloom", "docs", "deep", "nested");
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(path.join(sourceDir, "file.md"), "# Deep");

      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude", ".claude/docs")],
        resourceType: "docs",
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "claude",
          files: [
            {
              relativePath: ".claude/docs/deep/nested/file.md",
              sourcePath: ".agloom/docs/deep/nested/file.md",
            },
          ],
          errors: [],
        },
      ]);

      expect(writeResult.written).toContain(".claude/docs/deep/nested/file.md");

      const writtenContent = fs.readFileSync(
        path.join(tmpDir, ".claude", "docs", "deep", "nested", "file.md"),
        "utf-8",
      );
      expect(writtenContent).toBe("# Deep");
    });

    // --- Трансформация: шаг 3 — интерполяция .md файлов при наличии variablesByAgentId ---
    it("интерполирует .md файлы при наличии variablesByAgentId", () => {
      const sourceDir = path.join(tmpDir, ".agloom", "docs");
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(path.join(sourceDir, "guide.md"), "Path: ${agloom:ROOT_DIR}/docs");

      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude", ".claude/docs")],
        resourceType: "docs",
      });

      const variablesByAgentId: Record<string, Record<string, string>> = {
        claude: { ROOT_DIR: ".claude" },
      };

      const writeResult = transpiler.writeResults(
        [
          {
            agentId: "claude",
            files: [
              {
                relativePath: ".claude/docs/guide.md",
                sourcePath: ".agloom/docs/guide.md",
              },
            ],
            errors: [],
          },
        ],
        { variablesByAgentId },
      );

      expect(writeResult.written).toContain(".claude/docs/guide.md");
      expect(writeResult.errors).toHaveLength(0);

      const writtenContent = fs.readFileSync(path.join(tmpDir, ".claude", "docs", "guide.md"), "utf-8");
      expect(writtenContent).toBe("Path: .claude/docs");
    });

    // --- Трансформация: шаг 4 — интерполяция .json файлов (INTERPOLATABLE_EXTENSIONS) при variablesByAgentId ---
    it("интерполирует .json файлы при наличии variablesByAgentId", () => {
      const sourceDir = path.join(tmpDir, ".agloom", "docs");
      fs.mkdirSync(sourceDir, { recursive: true });
      const jsonContent = '{"path": "${agloom:ROOT_DIR}"}';
      fs.writeFileSync(path.join(sourceDir, "config.json"), jsonContent);

      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude", ".claude/docs")],
        resourceType: "docs",
      });

      const variablesByAgentId: Record<string, Record<string, string>> = {
        claude: { ROOT_DIR: ".claude" },
      };

      const writeResult = transpiler.writeResults(
        [
          {
            agentId: "claude",
            files: [
              {
                relativePath: ".claude/docs/config.json",
                sourcePath: ".agloom/docs/config.json",
              },
            ],
            errors: [],
          },
        ],
        { variablesByAgentId },
      );

      expect(writeResult.written).toContain(".claude/docs/config.json");
      expect(writeResult.errors).toHaveLength(0);
      const writtenContent = fs.readFileSync(path.join(tmpDir, ".claude", "docs", "config.json"), "utf-8");
      expect(writtenContent).toBe('{"path": ".claude"}');
    });

    // --- Трансформация: шаг 4 — интерполяция .json файлов с valuesByAgentId ---
    it("интерполирует .json файлы при наличии valuesByAgentId (namespace ${values:*})", () => {
      const sourceDir = path.join(tmpDir, ".agloom", "docs");
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(path.join(sourceDir, "manifest.json"), '{"name": "${values:project_name}"}');

      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude", ".claude/docs")],
        resourceType: "docs",
      });

      const valuesByAgentId: Record<string, Record<string, string>> = {
        claude: { project_name: "agloom" },
      };

      const writeResult = transpiler.writeResults(
        [
          {
            agentId: "claude",
            files: [
              {
                relativePath: ".claude/docs/manifest.json",
                sourcePath: ".agloom/docs/manifest.json",
              },
            ],
            errors: [],
          },
        ],
        { valuesByAgentId },
      );

      expect(writeResult.written).toContain(".claude/docs/manifest.json");
      expect(writeResult.errors).toHaveLength(0);
      const writtenContent = fs.readFileSync(path.join(tmpDir, ".claude", "docs", "manifest.json"), "utf-8");
      expect(writtenContent).toBe('{"name": "agloom"}');
    });

    // --- Трансформация: шаг 4 — интерполяция .yaml файлов (INTERPOLATABLE_EXTENSIONS) ---
    it("интерполирует .yaml файлы при наличии variablesByAgentId", () => {
      const sourceDir = path.join(tmpDir, ".agloom", "docs");
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(path.join(sourceDir, "config.yaml"), "docs_dir: ${agloom:DOCS_DIR}");

      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude", ".claude/docs")],
        resourceType: "docs",
      });

      const variablesByAgentId: Record<string, Record<string, string>> = {
        claude: { DOCS_DIR: ".claude/docs" },
      };

      const writeResult = transpiler.writeResults(
        [
          {
            agentId: "claude",
            files: [
              {
                relativePath: ".claude/docs/config.yaml",
                sourcePath: ".agloom/docs/config.yaml",
              },
            ],
            errors: [],
          },
        ],
        { variablesByAgentId },
      );

      expect(writeResult.written).toContain(".claude/docs/config.yaml");
      expect(writeResult.errors).toHaveLength(0);
      const writtenContent = fs.readFileSync(path.join(tmpDir, ".claude", "docs", "config.yaml"), "utf-8");
      expect(writtenContent).toBe("docs_dir: .claude/docs");
    });

    // --- Трансформация: шаг 4 — интерполяция .toml файлов с ${env:*} ---
    it("интерполирует .toml файлы при наличии variablesByAgentId (namespace ${env:*})", () => {
      const sourceDir = path.join(tmpDir, ".agloom", "docs");
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(path.join(sourceDir, "settings.toml"), 'var = "${env:AGLOOM_TEST_VAR}"');

      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude", ".claude/docs")],
        resourceType: "docs",
      });

      const variablesByAgentId: Record<string, Record<string, string>> = {
        claude: {},
      };

      const originalEnv = process.env["AGLOOM_TEST_VAR"];
      process.env["AGLOOM_TEST_VAR"] = "hello_from_env";

      try {
        const writeResult = transpiler.writeResults(
          [
            {
              agentId: "claude",
              files: [
                {
                  relativePath: ".claude/docs/settings.toml",
                  sourcePath: ".agloom/docs/settings.toml",
                },
              ],
              errors: [],
            },
          ],
          { variablesByAgentId },
        );

        expect(writeResult.written).toContain(".claude/docs/settings.toml");
        expect(writeResult.errors).toHaveLength(0);
        const writtenContent = fs.readFileSync(path.join(tmpDir, ".claude", "docs", "settings.toml"), "utf-8");
        expect(writtenContent).toBe('var = "hello_from_env"');
      } finally {
        if (originalEnv === undefined) {
          delete process.env["AGLOOM_TEST_VAR"];
        } else {
          process.env["AGLOOM_TEST_VAR"] = originalEnv;
        }
      }
    });

    // --- Трансформация: шаг 4 — бинарный файл (.png) побайтово копируется даже при variablesByAgentId ---
    it("побайтово копирует бинарные файлы (.png), даже если variablesByAgentId передан", () => {
      const sourceDir = path.join(tmpDir, ".agloom", "docs");
      fs.mkdirSync(sourceDir, { recursive: true });
      const binaryContent = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff]);
      fs.writeFileSync(path.join(sourceDir, "diagram.png"), binaryContent);

      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude", ".claude/docs")],
        resourceType: "docs",
      });

      const variablesByAgentId: Record<string, Record<string, string>> = {
        claude: { ROOT_DIR: ".claude" },
      };

      const writeResult = transpiler.writeResults(
        [
          {
            agentId: "claude",
            files: [
              {
                relativePath: ".claude/docs/diagram.png",
                sourcePath: ".agloom/docs/diagram.png",
              },
            ],
            errors: [],
          },
        ],
        { variablesByAgentId },
      );

      expect(writeResult.written).toContain(".claude/docs/diagram.png");
      expect(writeResult.errors).toHaveLength(0);
      const writtenContent = fs.readFileSync(path.join(tmpDir, ".claude", "docs", "diagram.png"));
      expect(Buffer.compare(writtenContent, binaryContent)).toBe(0);
    });

    // --- Расширение 4c: InterpolationError в .json файле → ResourceWriteError ---
    it("возвращает ResourceWriteError при ошибке интерполяции .json файла", () => {
      const sourceDir = path.join(tmpDir, ".agloom", "docs");
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(path.join(sourceDir, "config.json"), '{"val": "${agloom:NONEXISTENT}"}');

      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude", ".claude/docs")],
        resourceType: "docs",
      });

      const variablesByAgentId: Record<string, Record<string, string>> = {
        claude: { ROOT_DIR: ".claude" },
      };

      const writeResult = transpiler.writeResults(
        [
          {
            agentId: "claude",
            files: [
              {
                relativePath: ".claude/docs/config.json",
                sourcePath: ".agloom/docs/config.json",
              },
            ],
            errors: [],
          },
        ],
        { variablesByAgentId },
      );

      expect(writeResult.errors.length).toBeGreaterThan(0);
      expect(writeResult.errors[0]).toBeInstanceOf(ResourceWriteError);
      expect(writeResult.errors[0].message).toMatch(/Interpolation failed for \.agloom\/docs\/config\.json/);
    });

    // --- Обратная совместимость: побайтовое копирование всех файлов без variablesByAgentId ---
    it("побайтово копирует все файлы, если variablesByAgentId не передан (обратная совместимость)", () => {
      const sourceDir = path.join(tmpDir, ".agloom", "docs");
      fs.mkdirSync(sourceDir, { recursive: true });
      const mdContent = "Path: ${agloom:ROOT_DIR}/docs";
      fs.writeFileSync(path.join(sourceDir, "guide.md"), mdContent);

      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude", ".claude/docs")],
        resourceType: "docs",
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "claude",
          files: [
            {
              relativePath: ".claude/docs/guide.md",
              sourcePath: ".agloom/docs/guide.md",
            },
          ],
          errors: [],
        },
      ]);

      expect(writeResult.written).toContain(".claude/docs/guide.md");
      const writtenContent = fs.readFileSync(path.join(tmpDir, ".claude", "docs", "guide.md"), "utf-8");
      expect(writtenContent).toBe(mdContent);
    });

    // --- Трансформация: шаг 3 — case-insensitive проверка расширения .md ---
    it("интерполирует файлы с расширением .MD (case-insensitive)", () => {
      const sourceDir = path.join(tmpDir, ".agloom", "docs");
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(path.join(sourceDir, "README.MD"), "Path: ${agloom:ROOT_DIR}");

      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude", ".claude/docs")],
        resourceType: "docs",
      });

      const variablesByAgentId: Record<string, Record<string, string>> = {
        claude: { ROOT_DIR: ".claude" },
      };

      const writeResult = transpiler.writeResults(
        [
          {
            agentId: "claude",
            files: [
              {
                relativePath: ".claude/docs/README.MD",
                sourcePath: ".agloom/docs/README.MD",
              },
            ],
            errors: [],
          },
        ],
        { variablesByAgentId },
      );

      expect(writeResult.written).toContain(".claude/docs/README.MD");
      const writtenContent = fs.readFileSync(path.join(tmpDir, ".claude", "docs", "README.MD"), "utf-8");
      expect(writtenContent).toBe("Path: .claude");
    });

    // --- Трансформация: шаг 2 — targetRoot переопределяет запись ---
    it("записывает файлы в targetRoot вместо projectRoot, если targetRoot передан", () => {
      const sourceDir = path.join(tmpDir, ".agloom", "docs");
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(path.join(sourceDir, "file.md"), "# Content");

      const targetRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agl-resource-target-"));

      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude", ".claude/docs")],
        resourceType: "docs",
      });

      try {
        const writeResult = transpiler.writeResults(
          [
            {
              agentId: "claude",
              files: [
                {
                  relativePath: ".claude/docs/file.md",
                  sourcePath: ".agloom/docs/file.md",
                },
              ],
              errors: [],
            },
          ],
          { targetRoot },
        );

        expect(writeResult.written).toContain(".claude/docs/file.md");
        expect(writeResult.errors).toHaveLength(0);

        // Файл записан в targetRoot, а не в projectRoot
        expect(fs.existsSync(path.join(targetRoot, ".claude", "docs", "file.md"))).toBe(true);

        // Файл НЕ записан в projectRoot
        expect(fs.existsSync(path.join(tmpDir, ".claude", "docs", "file.md"))).toBe(false);
      } finally {
        fs.rmSync(targetRoot, { recursive: true, force: true });
      }
    });

    // --- Расширение 1a: SkillTranspileResult содержит ошибки → пропуск ---
    it("пропускает запись файлов адаптера с ошибками транспиляции", () => {
      const sourceDir = path.join(tmpDir, ".agloom", "docs");
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(path.join(sourceDir, "file.md"), "# Content");

      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("failing", ".failing/docs")],
        resourceType: "docs",
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "failing",
          files: [
            {
              relativePath: ".failing/docs/file.md",
              sourcePath: ".agloom/docs/file.md",
            },
          ],
          errors: [
            {
              agentId: "failing",
              message: "Some transpile error",
              cause: new Error("original"),
            },
          ],
        },
      ]);

      // Файл НЕ записан
      expect(fs.existsSync(path.join(tmpDir, ".failing", "docs", "file.md"))).toBe(false);
      expect(writeResult.written).not.toContain(".failing/docs/file.md");

      // Ошибка с правильным сообщением
      expect(writeResult.errors).toHaveLength(1);
      expect(writeResult.errors[0]).toBeInstanceOf(ResourceWriteError);
      expect(writeResult.errors[0].message).toMatch(/Skipped failing: transpile errors present/);
    });

    // --- Расширение 1a: смешанный сценарий — один адаптер с ошибками, другой без ---
    it("пропускает файлы адаптера с ошибками, но записывает файлы успешного адаптера", () => {
      const sourceDir = path.join(tmpDir, ".agloom", "docs");
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(path.join(sourceDir, "file.md"), "# Content");

      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("failing", ".failing/docs"), createStubAdapter("claude", ".claude/docs")],
        resourceType: "docs",
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "failing",
          files: [
            {
              relativePath: ".failing/docs/file.md",
              sourcePath: ".agloom/docs/file.md",
            },
          ],
          errors: [
            {
              agentId: "failing",
              message: "Error",
              cause: new Error("original"),
            },
          ],
        },
        {
          agentId: "claude",
          files: [
            {
              relativePath: ".claude/docs/file.md",
              sourcePath: ".agloom/docs/file.md",
            },
          ],
          errors: [],
        },
      ]);

      // failing НЕ записан
      expect(fs.existsSync(path.join(tmpDir, ".failing", "docs", "file.md"))).toBe(false);

      // claude записан
      expect(fs.existsSync(path.join(tmpDir, ".claude", "docs", "file.md"))).toBe(true);
      expect(writeResult.written).toContain(".claude/docs/file.md");

      expect(writeResult.errors.length).toBeGreaterThan(0);
    });

    // --- Расширение 3a: variablesByAgentId передан, но agentId отсутствует ---
    it("возвращает ResourceWriteError при отсутствии ключа agentId в variablesByAgentId", () => {
      const sourceDir = path.join(tmpDir, ".agloom", "docs");
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(path.join(sourceDir, "file.md"), "Path: ${agloom:ROOT_DIR}");

      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude", ".claude/docs")],
        resourceType: "docs",
      });

      const variablesByAgentId: Record<string, Record<string, string>> = {
        opencode: { ROOT_DIR: ".opencode" },
      };

      const writeResult = transpiler.writeResults(
        [
          {
            agentId: "claude",
            files: [
              {
                relativePath: ".claude/docs/file.md",
                sourcePath: ".agloom/docs/file.md",
              },
            ],
            errors: [],
          },
        ],
        { variablesByAgentId },
      );

      expect(writeResult.errors.length).toBeGreaterThan(0);
      expect(writeResult.errors[0]).toBeInstanceOf(ResourceWriteError);
      expect(writeResult.errors[0].message).toBe("No interpolation variables for adapter: claude");
    });

    // --- Расширение 3b: InterpolationError → ResourceWriteError ---
    it("возвращает ResourceWriteError при ошибке интерполяции .md файла", () => {
      const sourceDir = path.join(tmpDir, ".agloom", "docs");
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(path.join(sourceDir, "file.md"), "Path: ${agloom:NONEXISTENT}");

      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude", ".claude/docs")],
        resourceType: "docs",
      });

      const variablesByAgentId: Record<string, Record<string, string>> = {
        claude: { ROOT_DIR: ".claude" },
      };

      const writeResult = transpiler.writeResults(
        [
          {
            agentId: "claude",
            files: [
              {
                relativePath: ".claude/docs/file.md",
                sourcePath: ".agloom/docs/file.md",
              },
            ],
            errors: [],
          },
        ],
        { variablesByAgentId },
      );

      expect(writeResult.errors.length).toBeGreaterThan(0);
      expect(writeResult.errors[0]).toBeInstanceOf(ResourceWriteError);
      expect(writeResult.errors[0].message).toMatch(/Interpolation failed for \.agloom\/docs\/file\.md/);
    });

    // --- Расширение 3c: sourcePath не существует → ResourceWriteError ---
    it("возвращает ResourceWriteError, если sourcePath не существует", () => {
      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude", ".claude/docs")],
        resourceType: "docs",
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "claude",
          files: [
            {
              relativePath: ".claude/docs/missing.md",
              sourcePath: ".agloom/docs/missing.md",
            },
          ],
          errors: [],
        },
      ]);

      expect(writeResult.errors.length).toBeGreaterThan(0);
      expect(writeResult.errors[0]).toBeInstanceOf(ResourceWriteError);
      expect(writeResult.errors[0].message).toMatch(/Failed to read source \.agloom\/docs\/missing\.md/);
    });

    // --- Расширение 3d: ошибка записи целевого файла → ResourceWriteError ---
    it("возвращает ResourceWriteError при ошибке записи целевого файла", () => {
      const sourceDir = path.join(tmpDir, ".agloom", "docs");
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(path.join(sourceDir, "file.md"), "# Content");

      // Создаём файл-блокер вместо каталога — запись невозможна
      fs.writeFileSync(path.join(tmpDir, ".claude"), "blocker");

      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude", ".claude/docs")],
        resourceType: "docs",
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "claude",
          files: [
            {
              relativePath: ".claude/docs/file.md",
              sourcePath: ".agloom/docs/file.md",
            },
          ],
          errors: [],
        },
      ]);

      expect(writeResult.errors.length).toBeGreaterThan(0);
      expect(writeResult.errors[0]).toBeInstanceOf(ResourceWriteError);
      expect(writeResult.errors[0].message).toMatch(/Failed to write \.claude\/docs\/file\.md/);
    });

    // --- Happy path: запись результатов нескольких адаптеров ---
    it("записывает файлы от нескольких адаптеров", () => {
      const sourceDir = path.join(tmpDir, ".agloom", "docs");
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(path.join(sourceDir, "file.md"), "# Content");

      const transpiler = createResourceTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude", ".claude/docs"), createStubAdapter("opencode", ".opencode/docs")],
        resourceType: "docs",
      });

      const writeResult = transpiler.writeResults([
        {
          agentId: "claude",
          files: [
            {
              relativePath: ".claude/docs/file.md",
              sourcePath: ".agloom/docs/file.md",
            },
          ],
          errors: [],
        },
        {
          agentId: "opencode",
          files: [
            {
              relativePath: ".opencode/docs/file.md",
              sourcePath: ".agloom/docs/file.md",
            },
          ],
          errors: [],
        },
      ]);

      expect(writeResult.written).toContain(".claude/docs/file.md");
      expect(writeResult.written).toContain(".opencode/docs/file.md");
      expect(writeResult.errors).toHaveLength(0);
    });
  });
});
