// integration.spec.ts
// Спецификация: docs/specs/integration-tests.md § Agents Transpiler Integration

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import matter from "gray-matter";
import {
  createAgentsTranspiler,
  ClaudeAgentAdapter,
  OpenCodeAgentAdapter,
} from "../index.js";

const REVIEWER_CANONICAL = `---
name: reviewer
model: sonnet
override:
  claude:
    permissionMode: plan
  opencode:
    model: anthropic/claude-sonnet-4-5
---
General instructions.

<!-- agent:claude -->
Claude-specific instructions.
<!-- /agent:claude -->

<!-- agent:opencode -->
OpenCode-specific instructions.
<!-- /agent:opencode -->

Shared footer.`;

describe("AgentsTranspiler", () => {
  describe("Integration — полный pipeline", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "agl-agents-integration-"),
      );
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- IT-AGENT-01: Pipeline с Claude адаптером — override и agent-specific секции ---
    it("применяет override для Claude, удаляет ключ override, фильтрует agent-specific секции", () => {
      // Вход: создать каноническую структуру
      const agentsDir = path.join(tmpDir, ".agloom", "agents");
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.writeFileSync(path.join(agentsDir, "reviewer.md"), REVIEWER_CANONICAL);

      // Поведение: шаги 1–3
      const transpiler = createAgentsTranspiler({
        projectRoot: tmpDir,
        adapters: [new ClaudeAgentAdapter()],
      });
      const results = transpiler.transpile();
      const writeResult = transpiler.writeResults(results);

      // Шаг 4: writeResult.errors — пустой массив
      expect(writeResult.errors).toHaveLength(0);

      // Шаг 5: прочитать целевой файл
      const outputPath = path.join(tmpDir, ".claude", "agents", "reviewer.md");
      const outputContent = fs.readFileSync(outputPath, "utf-8");

      // Шаг 6: парсинг frontmatter
      const parsed = matter(outputContent);

      // Шаг 7: frontmatter содержит name: "reviewer"
      expect(parsed.data.name).toBe("reviewer");

      // Шаг 8: frontmatter содержит model: "sonnet"
      expect(parsed.data.model).toBe("sonnet");

      // Шаг 9: frontmatter содержит permissionMode: "plan" (из override.claude)
      expect(parsed.data.permissionMode).toBe("plan");

      // Шаг 10: frontmatter НЕ содержит ключ override
      expect(parsed.data).not.toHaveProperty("override");

      // Шаг 11: body содержит "General instructions."
      expect(parsed.content).toContain("General instructions.");

      // Шаг 12: body содержит "Claude-specific instructions."
      expect(parsed.content).toContain("Claude-specific instructions.");

      // Шаг 13: body НЕ содержит "OpenCode-specific instructions."
      expect(parsed.content).not.toContain("OpenCode-specific instructions.");

      // Шаг 14: body НЕ содержит "<!-- agent:"
      expect(parsed.content).not.toContain("<!-- agent:");

      // Шаг 15: body содержит "Shared footer."
      expect(parsed.content).toContain("Shared footer.");

      // Результат: writeResult.written содержит целевой путь
      expect(writeResult.written).toContain(".claude/agents/reviewer.md");
    });

    // --- IT-AGENT-02: Pipeline с OpenCode адаптером — override и agent-specific секции ---
    it("применяет override для OpenCode, удаляет ключ override, фильтрует agent-specific секции", () => {
      // Вход: тот же файл, что в IT-AGENT-01
      const agentsDir = path.join(tmpDir, ".agloom", "agents");
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.writeFileSync(path.join(agentsDir, "reviewer.md"), REVIEWER_CANONICAL);

      // Поведение: шаги 1–3
      const transpiler = createAgentsTranspiler({
        projectRoot: tmpDir,
        adapters: [new OpenCodeAgentAdapter()],
      });
      const results = transpiler.transpile();
      const writeResult = transpiler.writeResults(results);

      // Шаг 4: writeResult.errors — пустой массив
      expect(writeResult.errors).toHaveLength(0);

      // Шаг 5: прочитать целевой файл
      const outputPath = path.join(
        tmpDir,
        ".opencode",
        "agents",
        "reviewer.md",
      );
      const outputContent = fs.readFileSync(outputPath, "utf-8");

      // Шаг 6: парсинг frontmatter
      const parsed = matter(outputContent);

      // Шаг 7: frontmatter содержит name: "reviewer"
      expect(parsed.data.name).toBe("reviewer");

      // Шаг 8: frontmatter содержит model: "anthropic/claude-sonnet-4-5" (из override.opencode)
      expect(parsed.data.model).toBe("anthropic/claude-sonnet-4-5");

      // Шаг 9: frontmatter НЕ содержит ключ override
      expect(parsed.data).not.toHaveProperty("override");

      // Шаг 10: body содержит "General instructions."
      expect(parsed.content).toContain("General instructions.");

      // Шаг 11: body НЕ содержит "Claude-specific instructions."
      expect(parsed.content).not.toContain("Claude-specific instructions.");

      // Шаг 12: body содержит "OpenCode-specific instructions."
      expect(parsed.content).toContain("OpenCode-specific instructions.");

      // Шаг 13: body НЕ содержит "<!-- agent:"
      expect(parsed.content).not.toContain("<!-- agent:");

      // Шаг 14: body содержит "Shared footer."
      expect(parsed.content).toContain("Shared footer.");

      // Результат: writeResult.written содержит целевой путь
      expect(writeResult.written).toContain(".opencode/agents/reviewer.md");
    });

    // --- IT-AGENT-03: Pipeline с обоими адаптерами одновременно ---
    it("оба адаптера обрабатываются за один вызов, каждый создаёт свой целевой файл", () => {
      // Вход: тот же файл, что в IT-AGENT-01
      const agentsDir = path.join(tmpDir, ".agloom", "agents");
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.writeFileSync(path.join(agentsDir, "reviewer.md"), REVIEWER_CANONICAL);

      // Поведение: шаги 1–2
      const transpiler = createAgentsTranspiler({
        projectRoot: tmpDir,
        adapters: [new ClaudeAgentAdapter(), new OpenCodeAgentAdapter()],
      });
      const results = transpiler.transpile();

      // Шаг 3: results содержит два AgentTranspileResult
      expect(results).toHaveLength(2);
      const agentIds = results.map((r) => r.agentId);
      expect(agentIds).toContain("claude");
      expect(agentIds).toContain("opencode");

      // Шаги 4–5
      const writeResult = transpiler.writeResults(results);
      expect(writeResult.errors).toHaveLength(0);

      // Шаг 6: .claude/agents/reviewer.md существует
      expect(
        fs.existsSync(path.join(tmpDir, ".claude", "agents", "reviewer.md")),
      ).toBe(true);

      // Шаг 7: .opencode/agents/reviewer.md существует
      expect(
        fs.existsSync(path.join(tmpDir, ".opencode", "agents", "reviewer.md")),
      ).toBe(true);

      // Шаги 8–9: Claude файл содержит Claude-specific, не содержит OpenCode-specific
      const claudeContent = fs.readFileSync(
        path.join(tmpDir, ".claude", "agents", "reviewer.md"),
        "utf-8",
      );
      const claudeParsed = matter(claudeContent);
      expect(claudeParsed.content).toContain("Claude-specific instructions.");
      expect(claudeParsed.content).not.toContain(
        "OpenCode-specific instructions.",
      );

      // Шаги 10–13: OpenCode файл содержит OpenCode-specific, не содержит Claude-specific
      const opencodeContent = fs.readFileSync(
        path.join(tmpDir, ".opencode", "agents", "reviewer.md"),
        "utf-8",
      );
      const opencodeParsed = matter(opencodeContent);
      expect(opencodeParsed.content).not.toContain(
        "Claude-specific instructions.",
      );
      expect(opencodeParsed.content).toContain(
        "OpenCode-specific instructions.",
      );

      // Результат: writeResult.written содержит оба пути
      expect(writeResult.written).toContain(".claude/agents/reviewer.md");
      expect(writeResult.written).toContain(".opencode/agents/reviewer.md");
    });

    // --- IT-AGENT-04: Pipeline с несколькими определениями агентов ---
    it("несколько .md файлов из .agloom/agents/ обрабатываются за один вызов", () => {
      // Вход: создать два определения агентов
      const agentsDir = path.join(tmpDir, ".agloom", "agents");
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.writeFileSync(
        path.join(agentsDir, "reviewer.md"),
        "---\nname: reviewer\nmodel: sonnet\n---\nReviewer instructions.",
      );
      fs.writeFileSync(
        path.join(agentsDir, "coder.md"),
        "---\nname: coder\nmodel: opus\n---\nCoder instructions.",
      );

      // Поведение: шаги 1–3
      const transpiler = createAgentsTranspiler({
        projectRoot: tmpDir,
        adapters: [new ClaudeAgentAdapter()],
      });
      const results = transpiler.transpile();
      const writeResult = transpiler.writeResults(results);

      // Шаг 4: writeResult.errors — пустой массив
      expect(writeResult.errors).toHaveLength(0);

      // Шаги 5–6: reviewer.md
      const reviewerContent = fs.readFileSync(
        path.join(tmpDir, ".claude", "agents", "reviewer.md"),
        "utf-8",
      );
      const reviewerParsed = matter(reviewerContent);
      expect(reviewerParsed.content).toContain("Reviewer instructions.");

      // Шаги 7–8: coder.md
      const coderContent = fs.readFileSync(
        path.join(tmpDir, ".claude", "agents", "coder.md"),
        "utf-8",
      );
      const coderParsed = matter(coderContent);
      expect(coderParsed.content).toContain("Coder instructions.");

      // Результат: writeResult.written содержит оба файла
      expect(writeResult.written).toContain(".claude/agents/reviewer.md");
      expect(writeResult.written).toContain(".claude/agents/coder.md");
    });

    // --- IT-AGENT-05: Pipeline при отсутствии каталога .agloom/agents/ ---
    it("корректно завершается при отсутствии каталога .agloom/agents/", () => {
      // Вход: tmpDir — пустая директория

      // Поведение: шаги 1–2
      const transpiler = createAgentsTranspiler({
        projectRoot: tmpDir,
        adapters: [new ClaudeAgentAdapter()],
      });
      const results = transpiler.transpile();

      // Шаг 3: results — пустой массив
      expect(results).toHaveLength(0);

      // Шаги 4–6
      const writeResult = transpiler.writeResults(results);
      expect(writeResult.errors).toHaveLength(0);
      expect(writeResult.written).toHaveLength(0);
    });

    // --- IT-AGENT-06: Pipeline без override и без agent-specific секций ---
    it("файл без override и без agent-specific секций проходит pipeline без трансформации body", () => {
      // Вход: простой файл без override и без agent-specific секций
      const agentsDir = path.join(tmpDir, ".agloom", "agents");
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.writeFileSync(
        path.join(agentsDir, "simple.md"),
        "---\nname: simple\nmodel: sonnet\n---\nPlain instructions without any special sections.",
      );

      // Поведение: шаги 1–3
      const transpiler = createAgentsTranspiler({
        projectRoot: tmpDir,
        adapters: [new ClaudeAgentAdapter()],
      });
      const results = transpiler.transpile();
      const writeResult = transpiler.writeResults(results);

      // Шаг 4: writeResult.errors — пустой массив
      expect(writeResult.errors).toHaveLength(0);

      // Шаг 5: прочитать целевой файл
      const outputContent = fs.readFileSync(
        path.join(tmpDir, ".claude", "agents", "simple.md"),
        "utf-8",
      );

      // Шаг 6: парсинг frontmatter
      const parsed = matter(outputContent);

      // Шаг 7: frontmatter содержит name: "simple"
      expect(parsed.data.name).toBe("simple");

      // Шаг 8: frontmatter содержит model: "sonnet"
      expect(parsed.data.model).toBe("sonnet");

      // Шаг 9: body содержит оригинальный текст
      expect(parsed.content).toContain(
        "Plain instructions without any special sections.",
      );

      // Результат: writeResult.written содержит целевой путь
      expect(writeResult.written).toContain(".claude/agents/simple.md");
    });
    // --- IT-AGENT-07: Pipeline с agloomDir="." ---
    it('IT-AGENT-07: обнаруживает определения агентов в agents/ при agloomDir = "."', () => {
      // Вход: создать структуру плагина
      const agentsDir = path.join(tmpDir, "agents");
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.writeFileSync(
        path.join(agentsDir, "reviewer.md"),
        "---\nname: reviewer\nmodel: sonnet\n---\nPlugin agent instructions.",
      );

      // Поведение: шаги 1–3
      const transpiler = createAgentsTranspiler({
        projectRoot: tmpDir,
        adapters: [new ClaudeAgentAdapter()],
        agloomDir: ".",
      });
      const results = transpiler.transpile();
      const writeResult = transpiler.writeResults(results);

      // Шаг 4: writeResult.errors — пустой массив
      expect(writeResult.errors).toHaveLength(0);

      // Шаг 5: прочитать целевой файл
      const outputContent = fs.readFileSync(
        path.join(tmpDir, ".claude", "agents", "reviewer.md"),
        "utf-8",
      );

      // Шаг 6: парсинг frontmatter
      const parsed = matter(outputContent);

      // Шаг 7: frontmatter содержит name: "reviewer"
      expect(parsed.data.name).toBe("reviewer");

      // Шаг 8: frontmatter содержит model: "sonnet"
      expect(parsed.data.model).toBe("sonnet");

      // Шаг 9: body содержит "Plugin agent instructions."
      expect(parsed.content).toContain("Plugin agent instructions.");

      // Результат: writeResult.written содержит целевой путь
      expect(writeResult.written).toContain(".claude/agents/reviewer.md");
    });

    // --- IT-AGENT-08: Pipeline с writeResults targetRoot ---
    it("IT-AGENT-08: writeResults записывает файлы в targetRoot с override-трансформацией", () => {
      // Вход: создать sourceDir и targetDir
      const sourceDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "agl-agents-source-"),
      );
      const targetDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "agl-agents-target-"),
      );

      try {
        const agentsDir = path.join(sourceDir, "agents");
        fs.mkdirSync(agentsDir, { recursive: true });
        fs.writeFileSync(
          path.join(agentsDir, "coder.md"),
          "---\nname: coder\nmodel: opus\noverride:\n  claude:\n    permissionMode: plan\n---\nSource agent instructions.",
        );

        // Поведение: шаги 1–3
        const transpiler = createAgentsTranspiler({
          projectRoot: sourceDir,
          adapters: [new ClaudeAgentAdapter()],
          agloomDir: ".",
        });
        const results = transpiler.transpile();
        const writeResult = transpiler.writeResults(results, {
          targetRoot: targetDir,
        });

        // Шаг 4: writeResult.errors — пустой массив
        expect(writeResult.errors).toHaveLength(0);

        // Шаг 5: прочитать целевой файл из targetDir
        const outputContent = fs.readFileSync(
          path.join(targetDir, ".claude", "agents", "coder.md"),
          "utf-8",
        );

        // Шаг 6: парсинг frontmatter
        const parsed = matter(outputContent);

        // Шаг 7: frontmatter содержит name: "coder"
        expect(parsed.data.name).toBe("coder");

        // Шаг 8: frontmatter содержит permissionMode: "plan"
        expect(parsed.data.permissionMode).toBe("plan");

        // Шаг 9: frontmatter НЕ содержит ключ override
        expect(parsed.data).not.toHaveProperty("override");

        // Шаг 10: body содержит "Source agent instructions."
        expect(parsed.content).toContain("Source agent instructions.");

        // Шаг 11: файл НЕ существует в sourceDir
        expect(
          fs.existsSync(path.join(sourceDir, ".claude", "agents", "coder.md")),
        ).toBe(false);

        // Результат: writeResult.written содержит целевой путь
        expect(writeResult.written).toContain(".claude/agents/coder.md");
      } finally {
        fs.rmSync(sourceDir, { recursive: true, force: true });
        fs.rmSync(targetDir, { recursive: true, force: true });
      }
    });

    // --- IT-AGENT-09: Pipeline с agloomDir="." — ремаппинг relativePath ---
    it('IT-AGENT-09: ремаппинг relativePath из ./agents/ в .claude/agents/ при agloomDir = "."', () => {
      // Вход: создать структуру агента в плагине (agloomDir=".")
      // Спецификация: docs/specs/integration-tests.md § IT-AGENT-09
      // Тест проверяет ремаппинг префикса ./agents/ -> .claude/agents/
      // Discover читает только прямых потомков agents/, поэтому используем
      // плоскую структуру для проверки ремаппинга.
      const agentsDir = path.join(tmpDir, "agents");
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.writeFileSync(
        path.join(agentsDir, "nested-agent.md"),
        "---\nname: nested-agent\nmodel: sonnet\n---\nNested agent instructions.",
      );

      // Поведение: шаги 1–2
      const transpiler = createAgentsTranspiler({
        projectRoot: tmpDir,
        adapters: [new ClaudeAgentAdapter()],
        agloomDir: ".",
      });
      const results = transpiler.transpile();

      // Шаг 3: relativePath ремаппинг выполнен
      // Префикс ./agents/ заменён на .claude/agents/
      expect(results[0].files[0].relativePath).toBe(
        ".claude/agents/nested-agent.md",
      );

      // Шаги 4–5
      const writeResult = transpiler.writeResults(results);
      expect(writeResult.errors).toHaveLength(0);

      // Шаг 6: прочитать целевой файл
      const outputContent = fs.readFileSync(
        path.join(tmpDir, ".claude", "agents", "nested-agent.md"),
        "utf-8",
      );
      const parsed = matter(outputContent);

      // Шаг 7: body содержит "Nested agent instructions."
      expect(parsed.content).toContain("Nested agent instructions.");

      // Результат: writeResult.written содержит целевой путь
      expect(writeResult.written).toContain(".claude/agents/nested-agent.md");
    });
  });
});
