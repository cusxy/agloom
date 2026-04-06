// transform-content.spec.ts
// Спецификация: docs/specs/skills-transpiler.md § Трансформация контента
// Спецификация: docs/specs/skills-transpiler.md § Запись результатов (расширения 3c, 3d)

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createSkillsTranspiler, SkillWriteError } from "../index.js";
// SkillTransformError ещё не существует — импорт намеренно failing
// до реализации (см. § Классы ошибок).
import { SkillTransformError } from "../errors.js";

function createStubAdapter(agentId: string) {
  return {
    agentId,
    targetDir: `.${agentId}/skills`,
  };
}

describe("SkillsTranspiler", () => {
  describe("Трансформация контента", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-skills-transform-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function writeSkillFile(skillName: string, fileName: string, content: string | Buffer): void {
      const skillDir = path.join(tmpDir, ".agloom", "skills", skillName);
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, fileName), content);
    }

    function readWritten(agentId: string, skillName: string, fileName: string): string {
      return fs.readFileSync(path.join(tmpDir, `.${agentId}`, "skills", skillName, fileName), "utf-8");
    }

    // -----------------------------------------------------------------
    // § skills-transpiler.md § Трансформация контента (frontmatter override)
    // -----------------------------------------------------------------

    // --- Frontmatter override: per-adapter подполе применяется к frontmatter ---
    // § Frontmatter override: применение override и удаление блока override
    it("применяет override.<agentId> к frontmatter и удаляет блок override из результата", () => {
      const skillContent = [
        "---",
        "name: my-skill",
        "description: Generic description",
        "override:",
        "  claude:",
        "    description: Claude-specific description",
        "  opencode:",
        "    description: OpenCode-specific description",
        "---",
        "Body content.",
      ].join("\n");

      writeSkillFile("my-skill", "SKILL.md", skillContent);

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const result = transpiler.writeResults(
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
          variablesByAgentId: {
            claude: {},
          },
        },
      );

      expect(result.errors).toHaveLength(0);
      const written = readWritten("claude", "my-skill", "SKILL.md");

      // Claude override применён
      expect(written).toContain("description: Claude-specific description");
      // Блок override удалён
      expect(written).not.toContain("override:");
      expect(written).not.toContain("OpenCode-specific");
    });

    // -----------------------------------------------------------------
    // § skills-transpiler.md § Agent-specific секции в body
    // -----------------------------------------------------------------

    // --- Agent-specific блоки: для claude остаётся claude-секция, opencode-секция удаляется ---
    // § Agent-specific секции в body: фильтрация идентична agents-transpiler
    it("фильтрует agent-specific секции в body — claude видит только claude-блок", () => {
      const skillContent = [
        "---",
        "name: my-skill",
        "---",
        "Common.",
        "<!-- agent:claude -->",
        "Claude block.",
        "<!-- /agent:claude -->",
        "<!-- agent:opencode -->",
        "OpenCode block.",
        "<!-- /agent:opencode -->",
      ].join("\n");

      writeSkillFile("my-skill", "SKILL.md", skillContent);

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const result = transpiler.writeResults(
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
          variablesByAgentId: {
            claude: {},
          },
        },
      );

      expect(result.errors).toHaveLength(0);
      const written = readWritten("claude", "my-skill", "SKILL.md");
      expect(written).toContain("Common.");
      expect(written).toContain("Claude block.");
      expect(written).not.toContain("OpenCode block.");
      expect(written).not.toContain("<!-- agent:");
    });

    // --- Agent-specific блоки: для opencode видна только opencode-секция ---
    it("фильтрует agent-specific секции в body — opencode видит только opencode-блок", () => {
      const skillContent = [
        "---",
        "name: my-skill",
        "---",
        "Common.",
        "<!-- agent:claude -->",
        "Claude block.",
        "<!-- /agent:claude -->",
        "<!-- agent:opencode -->",
        "OpenCode block.",
        "<!-- /agent:opencode -->",
      ].join("\n");

      writeSkillFile("my-skill", "SKILL.md", skillContent);

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("opencode")],
      });

      const result = transpiler.writeResults(
        [
          {
            agentId: "opencode",
            files: [
              {
                relativePath: ".opencode/skills/my-skill/SKILL.md",
                sourcePath: ".agloom/skills/my-skill/SKILL.md",
              },
            ],
            errors: [],
          },
        ],
        {
          variablesByAgentId: {
            opencode: {},
          },
        },
      );

      expect(result.errors).toHaveLength(0);
      const written = readWritten("opencode", "my-skill", "SKILL.md");
      expect(written).toContain("OpenCode block.");
      expect(written).not.toContain("Claude block.");
    });

    // -----------------------------------------------------------------
    // § skills-transpiler.md § Трансформация контента (interpolation)
    // -----------------------------------------------------------------

    // --- Интерполяция через transformContent: ${agloom:SKILLS_DIR} → ".claude/skills" ---
    // § Трансформация контента: вызов transformContent(content, agentId, variables)
    it("интерполирует ${agloom:SKILLS_DIR} в body через transformContent (новый namespace agloom:)", () => {
      const skillContent = ["---", "name: my-skill", "---", "Skills path: ${agloom:SKILLS_DIR}"].join("\n");

      writeSkillFile("my-skill", "SKILL.md", skillContent);

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const result = transpiler.writeResults(
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
          variablesByAgentId: {
            claude: { SKILLS_DIR: ".claude/skills" },
          },
        },
      );

      expect(result.errors).toHaveLength(0);
      const written = readWritten("claude", "my-skill", "SKILL.md");
      expect(written).toContain("Skills path: .claude/skills");
      expect(written).not.toContain("${agloom:SKILLS_DIR}");
    });

    // --- Комбинация: override + agent-specific blocks + interpolation ---
    // § Трансформация контента: «применение override блока ... фильтрация agent-specific секций ... интерполяция переменных»
    it("применяет override, фильтрует agent-specific блоки и интерполирует переменные одновременно", () => {
      const skillContent = [
        "---",
        "name: my-skill",
        "description: Generic",
        "override:",
        "  claude:",
        "    description: Claude desc",
        "---",
        "Path: ${agloom:SKILLS_DIR}",
        "<!-- agent:claude -->",
        "Claude only ${agloom:AGENTS_DIR}",
        "<!-- /agent:claude -->",
        "<!-- agent:opencode -->",
        "OpenCode only.",
        "<!-- /agent:opencode -->",
      ].join("\n");

      writeSkillFile("my-skill", "SKILL.md", skillContent);

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const result = transpiler.writeResults(
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
          variablesByAgentId: {
            claude: { SKILLS_DIR: ".claude/skills", AGENTS_DIR: ".claude/agents" },
          },
        },
      );

      expect(result.errors).toHaveLength(0);
      const written = readWritten("claude", "my-skill", "SKILL.md");

      // override применён
      expect(written).toContain("description: Claude desc");
      expect(written).not.toContain("override:");
      // body отфильтрован
      expect(written).toContain("Claude only");
      expect(written).not.toContain("OpenCode only");
      // интерполяция выполнена
      expect(written).toContain("Path: .claude/skills");
      expect(written).toContain("Claude only .claude/agents");
    });

    // -----------------------------------------------------------------
    // § skills-transpiler.md § Запись результатов, расширение 3d — обёртка ошибок
    // -----------------------------------------------------------------

    // --- Расширение 3d: невалидный YAML frontmatter → SkillWriteError с cause SkillTransformError ---
    // § Запись результатов 3d: AgentTransformError → SkillTransformError → SkillWriteError (cause chain)
    it("оборачивает ошибку трансформации в SkillWriteError с cause instanceof SkillTransformError", () => {
      // Невалидный YAML — гарантированно приводит к ошибке парсинга frontmatter
      const skillContent = ["---", "name: my-skill", "  invalid: : :", "---", "Body."].join("\n");
      writeSkillFile("my-skill", "SKILL.md", skillContent);

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const result = transpiler.writeResults(
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
          variablesByAgentId: {
            claude: {},
          },
        },
      );

      expect(result.errors.length).toBeGreaterThan(0);
      const writeErr = result.errors[0];
      expect(writeErr).toBeInstanceOf(SkillWriteError);
      // cause chain: SkillWriteError.cause === SkillTransformError
      const cause = (writeErr as unknown as { cause?: unknown }).cause;
      expect(cause).toBeInstanceOf(SkillTransformError);
      expect(writeErr.message).toMatch(/Failed to transform \.agloom\/skills\/my-skill\/SKILL\.md/);
    });

    // -----------------------------------------------------------------
    // § skills-transpiler.md § Запись результатов: не-.md файлы — побайтовое копирование
    // -----------------------------------------------------------------

    // --- Не-.md файлы НЕ интерполируются ---
    // § Трансформация контента: «Не-.md файлы skill-пакета ... копируются побайтово без парсинга и без интерполяции»
    it("не интерполирует ${agloom:*} в не-.md файлах (побайтовое копирование)", () => {
      const helperContent = '#!/bin/sh\necho "${agloom:SKILLS_DIR}"\n';
      writeSkillFile("my-skill", "helper.sh", helperContent);

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const result = transpiler.writeResults(
        [
          {
            agentId: "claude",
            files: [
              {
                relativePath: ".claude/skills/my-skill/helper.sh",
                sourcePath: ".agloom/skills/my-skill/helper.sh",
              },
            ],
            errors: [],
          },
        ],
        {
          variablesByAgentId: {
            claude: { SKILLS_DIR: ".claude/skills" },
          },
        },
      );

      expect(result.errors).toHaveLength(0);
      const written = readWritten("claude", "my-skill", "helper.sh");
      // Содержимое не изменилось — интерполяция не применилась
      expect(written).toBe(helperContent);
      expect(written).toContain("${agloom:SKILLS_DIR}");
    });

    // -----------------------------------------------------------------
    // § skills-transpiler.md § Трансформация контента: применяется ко ВСЕМ .md файлам
    // -----------------------------------------------------------------

    // --- Трансформация применяется к вспомогательным .md файлам (не только SKILL.md) ---
    // § Трансформация контента: «включая SKILL.md и любые другие .md файлы внутри пакета»
    it("трансформирует вспомогательные .md файлы skill-пакета (не только SKILL.md)", () => {
      const docsContent = [
        "---",
        "title: Helper docs",
        "---",
        "See: ${agloom:SKILLS_DIR}",
        "<!-- agent:claude -->",
        "Claude doc.",
        "<!-- /agent:claude -->",
        "<!-- agent:opencode -->",
        "OpenCode doc.",
        "<!-- /agent:opencode -->",
      ].join("\n");
      // SKILL.md обязателен в пакете, чтобы discover не отбросил
      writeSkillFile("my-skill", "SKILL.md", "---\nname: my-skill\n---\nbody");
      writeSkillFile("my-skill", "docs.md", docsContent);

      const transpiler = createSkillsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const result = transpiler.writeResults(
        [
          {
            agentId: "claude",
            files: [
              {
                relativePath: ".claude/skills/my-skill/docs.md",
                sourcePath: ".agloom/skills/my-skill/docs.md",
              },
            ],
            errors: [],
          },
        ],
        {
          variablesByAgentId: {
            claude: { SKILLS_DIR: ".claude/skills" },
          },
        },
      );

      expect(result.errors).toHaveLength(0);
      const written = readWritten("claude", "my-skill", "docs.md");
      expect(written).toContain("See: .claude/skills");
      expect(written).toContain("Claude doc.");
      expect(written).not.toContain("OpenCode doc.");
      expect(written).not.toContain("<!-- agent:");
    });
  });
});
