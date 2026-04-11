// transpile-mcp.spec.ts
// Спецификация: docs/specs/mcp-transpiler.md § Расширение AdapterRegistryEntry
// Спецификация: docs/specs/mcp-transpiler.md § Обновление реестра адаптеров
// Спецификация: docs/specs/mcp-transpiler.md § Расширение команды transpile
// Спецификация: docs/specs/mcp-transpiler.md § Изменения в TranspilerStepOutcome

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { runApp } from "./run-app-test-helper.js";
import { adapterRegistry } from "../adapter-registry.js";
import { runTranspileStep } from "../transpile-step.js";
import { ClaudeMcpAdapter, OpenCodeMcpAdapter, createMcpTranspiler } from "../../mcp-transpiler/index.js";

describe("CLI", () => {
  // =====================================================================
  // § mcp-transpiler.md § Расширение AdapterRegistryEntry — поле mcp
  // § mcp-transpiler.md § Обновление реестра адаптеров
  // =====================================================================
  describe("Расширение AdapterRegistryEntry — поле mcp", () => {
    // --- Happy path: запись claude содержит MCP-адаптер ---
    // § Обновление реестра адаптеров, строка claude: mcp = ClaudeMcpAdapter
    it('запись "claude" содержит поле mcp с экземпляром ClaudeMcpAdapter', () => {
      const claude = adapterRegistry.find((e) => e.id === "claude");
      expect(claude).toBeDefined();
      expect(claude!.mcp).toBeInstanceOf(ClaudeMcpAdapter);
    });

    // --- Happy path: запись opencode содержит MCP-адаптер ---
    // § Обновление реестра адаптеров, строка opencode: mcp = OpenCodeMcpAdapter
    it('запись "opencode" содержит поле mcp с экземпляром OpenCodeMcpAdapter', () => {
      const opencode = adapterRegistry.find((e) => e.id === "opencode");
      expect(opencode).toBeDefined();
      expect(opencode!.mcp).toBeInstanceOf(OpenCodeMcpAdapter);
    });

    // --- Happy path: запись agentsmd имеет mcp === null ---
    // § Обновление реестра адаптеров, строка agentsmd: mcp = null
    // § mcp-transpiler.md: Адаптер "agentsmd" НЕ имеет MCP-адаптера,
    // поскольку формат AGENTS.md не определяет MCP-конфигурацию.
    it('запись "agentsmd" содержит поле mcp равное null', () => {
      const agentsmd = adapterRegistry.find((e) => e.id === "agentsmd");
      expect(agentsmd).toBeDefined();
      expect(agentsmd!.mcp).toBeNull();
    });
  });

  // =====================================================================
  // § mcp-transpiler.md § Расширение команды transpile — шаг MCP
  // § mcp-transpiler.md § Изменения в TranspilerStepOutcome
  // =====================================================================
  describe("Расширение команды transpile — шаг MCP", () => {
    let tmpDir: string;
    let originalExitCode: number | undefined;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-mcp-"));
      originalExitCode = process.exitCode;

      // Канонические файлы для всех транспилеров
      // Instructions: AGLOOM.md
      fs.writeFileSync(path.join(tmpDir, "AGLOOM.md"), "General instructions.");

      // Skills: .agloom/skills/my-skill/SKILL.md
      const skillDir = path.join(tmpDir, ".agloom", "skills", "my-skill");
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, "SKILL.md"), "---\nname: my-skill\n---\nSkill content.");

      // Agents: .agloom/agents/reviewer.md
      const agentDir = path.join(tmpDir, ".agloom", "agents");
      fs.mkdirSync(agentDir, { recursive: true });
      fs.writeFileSync(path.join(agentDir, "reviewer.md"), "---\nname: reviewer\n---\nReviewer body.");

      // MCP: .agloom/mcp.yml
      fs.writeFileSync(
        path.join(tmpDir, ".agloom", "mcp.yml"),
        "mcpServers:\n  context7:\n    command: npx\n    args:\n      - '-y'\n      - '@upstash/context7-mcp@latest'\n",
      );
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      process.exitCode = originalExitCode;
    });

    // --- Happy path: шаг MCP выполняется после Agents при транспиляции для claude ---
    // § Расширение команды transpile шаг 4.5:
    // Если entry.mcp не равен null — выполнить шаг транспиляции "MCP"
    // с адаптером entry.mcp.
    // § Изменения в выводе: Шаг MCP отображается после шага Agents.
    it("при транспиляции для claude отображает шаг MCP с количеством файлов после Agents", async () => {
      const { lastFrame, unmount } = await runApp({
        args: ["transpile", "--adapter", "claude"],
        projectRoot: tmpDir,
      });

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toContain("Done.");
        },
        { timeout: 10000 },
      );

      const output = lastFrame()!;

      // Шаг MCP отображается
      expect(output).toContain("MCP");
      expect(output).toMatch(/MCP\s+\d+\s+files/);

      // Порядок отображения: MCP ПОСЛЕ Agents
      const agentsIdx = output.indexOf("Agents");
      const mcpIdx = output.indexOf("MCP");
      expect(agentsIdx).toBeGreaterThan(-1);
      expect(mcpIdx).toBeGreaterThan(agentsIdx);

      // MCP ПЕРЕД Overlay (overlay может быть скрыт без --verbose)
      // Проверяем порядок только если Overlay виден
      const overlayIdx = output.indexOf("Overlay");
      if (overlayIdx > -1) {
        expect(mcpIdx).toBeLessThan(overlayIdx);
      }

      unmount();
    });

    // --- Happy path: шаг MCP генерирует .mcp.json для claude ---
    // § Claude Code MCP-адаптер: Генерирует файл .mcp.json в корне проекта.
    it("при транспиляции для claude генерирует файл .mcp.json в корне проекта", async () => {
      const { lastFrame, unmount } = await runApp({
        args: ["transpile", "--adapter", "claude"],
        projectRoot: tmpDir,
      });

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toContain("Done.");
        },
        { timeout: 10000 },
      );

      // Проверяем побочный эффект: файл .mcp.json создан
      const mcpJsonPath = path.join(tmpDir, ".mcp.json");
      expect(fs.existsSync(mcpJsonPath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(mcpJsonPath, "utf-8"));
      expect(content.mcpServers).toBeDefined();
      expect(content.mcpServers.context7).toBeDefined();
      expect(content.mcpServers.context7.command).toBe("npx");

      unmount();
    });

    // --- Happy path: шаг MCP генерирует opencode.json для opencode ---
    // § OpenCode MCP-адаптер: Генерирует файл opencode.json с ключом "mcp".
    it("при транспиляции для opencode генерирует файл opencode.json с ключом mcp", async () => {
      const { lastFrame, unmount } = await runApp({
        args: ["transpile", "--adapter", "opencode"],
        projectRoot: tmpDir,
      });

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toContain("Done.");
        },
        { timeout: 10000 },
      );

      // Проверяем побочный эффект: opencode.json создан с ключом mcp
      const opencodePath = path.join(tmpDir, "opencode.json");
      expect(fs.existsSync(opencodePath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(opencodePath, "utf-8"));
      expect(content.mcp).toBeDefined();
      expect(content.mcp.context7).toBeDefined();

      unmount();
    });

    // --- Условное выполнение: entry.mcp === null → шаг не выполняется ---
    // § Расширение команды transpile:
    // Если entry.mcp равен null — шаг MCP не выполняется и не отображается.
    it("при транспиляции для agentsmd (mcp === null) шаг MCP не отображается даже с --verbose", async () => {
      // agentsmd не скрытый для транспиляции напрямую, но используем --all для его включения
      const { lastFrame, unmount } = await runApp({
        args: ["transpile", "--all", "--verbose"],
        projectRoot: tmpDir,
      });

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toContain("Done.");
        },
        { timeout: 15000 },
      );

      const output = lastFrame()!;

      // Для agentsmd секция не должна содержать MCP
      // agentsmd заголовок есть
      expect(output).toContain("Transpiling for agentsmd");

      // Найдём секцию agentsmd и проверим, что MCP не упоминается
      // между "Transpiling for agentsmd" и следующим "Transpiling for" или "Done."
      const agentsmdIdx = output.indexOf("Transpiling for agentsmd");
      const afterAgentsmd = output.slice(agentsmdIdx);
      const nextTranspileIdx = afterAgentsmd.indexOf("Transpiling for", "Transpiling for agentsmd".length);
      const doneIdx = afterAgentsmd.indexOf("Done.", "Transpiling for agentsmd".length);
      const candidates = [nextTranspileIdx, doneIdx].filter((i) => i > -1);
      const nextSectionIdx = candidates.length > 0 ? Math.min(...candidates) : afterAgentsmd.length;
      const agentsmdSection = afterAgentsmd.slice(0, nextSectionIdx);

      // MCP не должен быть в секции agentsmd
      expect(agentsmdSection).not.toContain("MCP");

      unmount();
    });

    // --- Шаг MCP отображается с --verbose даже при 0 MCP-файлов ---
    // § TUI-отображение прогресса § Фильтрация шагов:
    // С --verbose: все шаги отображаются, включая шаги с 0 файлов.
    it("с --verbose отображает шаг MCP с 0 files когда .agloom/mcp.yml отсутствует", async () => {
      // Удаляем mcp.yml чтобы шаг MCP дал 0 файлов
      fs.unlinkSync(path.join(tmpDir, ".agloom", "mcp.yml"));

      const { lastFrame, unmount } = await runApp({
        args: ["transpile", "--adapter", "claude", "--verbose"],
        projectRoot: tmpDir,
      });

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toContain("Done.");
        },
        { timeout: 10000 },
      );

      const output = lastFrame()!;

      // С --verbose шаг MCP отображается даже при 0 файлов
      expect(output).toContain("MCP");
      expect(output).toMatch(/MCP\s+0\s+files/);

      unmount();
    });

    // --- Без --verbose: шаг MCP с 0 файлов скрывается ---
    // § TUI-отображение прогресса § Фильтрация шагов:
    // Без --verbose: шаги с writtenCount === 0 и пустым errors скрываются.
    it("без --verbose скрывает шаг MCP когда .agloom/mcp.yml отсутствует", async () => {
      // Удаляем mcp.yml
      fs.unlinkSync(path.join(tmpDir, ".agloom", "mcp.yml"));

      const { lastFrame, unmount } = await runApp({
        args: ["transpile", "--adapter", "claude"],
        projectRoot: tmpDir,
      });

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toContain("Done.");
        },
        { timeout: 10000 },
      );

      const output = lastFrame()!;

      // MCP с 0 файлов не отображается без --verbose
      // Но другие шаги (Instructions, Skills, Agents) отображаются
      expect(output).toContain("Instructions");
      expect(output).not.toMatch(/\bMCP\b/);

      unmount();
    });

    // --- totalWritten включает файлы шага MCP ---
    // § cli.md § Команда transpile § Поведение шаг 5:
    // totalWritten = сумма writtenCount всех шагов.
    it("totalWritten включает файлы, записанные шагом MCP", async () => {
      const { lastFrame, unmount } = await runApp({
        args: ["transpile", "--adapter", "claude"],
        projectRoot: tmpDir,
      });

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toContain("Done.");
        },
        { timeout: 10000 },
      );

      const output = lastFrame()!;

      // Instructions: 1, Skills: 1, Agents: 1, MCP: 1 = 4 файла
      // (Overlay может добавить 0 без overlay-файлов)
      const match = output.match(/Done\.\s+(\d+)\s+files written\./);
      expect(match).not.toBeNull();
      const totalWritten = parseInt(match![1], 10);
      // Минимум 4 файла (Instructions + Skills + Agents + MCP)
      expect(totalWritten).toBeGreaterThanOrEqual(4);

      unmount();
    });

    // --- Exit code 1 при ошибке шага MCP ---
    // § Изменения в exit codes:
    // Exit code учитывает ошибки шага MCP наравне с остальными шагами.
    it("завершается с exit code 1 при ошибке шага MCP", async () => {
      // Создаём невалидный mcp.yml (отсутствует обязательное поле mcpServers)
      // чтобы вызвать TransformError при валидации
      fs.writeFileSync(path.join(tmpDir, ".agloom", "mcp.yml"), "not_valid_mcp: true");

      const { lastFrame, unmount } = await runApp({
        args: ["transpile", "--adapter", "claude"],
        projectRoot: tmpDir,
      });

      // Ожидаем завершения транспиляции (Done. или Failed.)
      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toMatch(/Done\.|Failed\./);
        },
        { timeout: 10000 },
      );

      const output = lastFrame()!;

      // Шаг MCP с ошибкой: итог "Failed." и ✗ у шага MCP
      expect(output).toContain("Failed.");
      expect(output).toMatch(/✗.*MCP/);

      // Exit code 1
      expect(process.exitCode).toBe(1);

      unmount();
    });

    // --- Порядок шагов: Instructions → Skills → Agents → MCP → Overlay ---
    // § Расширение команды transpile шаг 4.5:
    // После шага 4.4 (Agents): шаг MCP.
    // § provider-overlay.md: Overlay выполняется последним.
    it("при --verbose отображает все шаги в правильном порядке: Instructions, Skills, Agents, MCP, Overlay", async () => {
      // Создаём overlay для claude чтобы Overlay был виден
      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      fs.mkdirSync(overlayDir, { recursive: true });
      fs.writeFileSync(path.join(overlayDir, "extra.txt"), "overlay data");

      const { lastFrame, unmount } = await runApp({
        args: ["transpile", "--adapter", "claude", "--verbose"],
        projectRoot: tmpDir,
      });

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toContain("Done.");
        },
        { timeout: 10000 },
      );

      const output = lastFrame()!;

      // Проверяем порядок шагов
      const instructionsIdx = output.indexOf("Instructions");
      const skillsIdx = output.indexOf("Skills");
      const agentsIdx = output.indexOf("Agents");
      const mcpIdx = output.indexOf("MCP");
      const overlayIdx = output.indexOf("Overlay");

      expect(instructionsIdx).toBeGreaterThan(-1);
      expect(skillsIdx).toBeGreaterThan(instructionsIdx);
      expect(agentsIdx).toBeGreaterThan(skillsIdx);
      expect(mcpIdx).toBeGreaterThan(agentsIdx);
      expect(overlayIdx).toBeGreaterThan(mcpIdx);

      unmount();
    });

    // --- Шаг MCP при --all: выполняется для claude и opencode, не для agentsmd ---
    // § Обновление реестра адаптеров:
    // claude → ClaudeMcpAdapter, opencode → OpenCodeMcpAdapter, agentsmd → null
    it("при --all шаг MCP выполняется для claude и opencode, но не для agentsmd", async () => {
      const { lastFrame, unmount } = await runApp({
        args: ["transpile", "--all", "--verbose"],
        projectRoot: tmpDir,
      });

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toContain("Done.");
        },
        { timeout: 15000 },
      );

      const output = lastFrame()!;

      // claude секция содержит MCP
      const claudeIdx = output.indexOf("Transpiling for claude");
      const afterClaude = output.slice(claudeIdx);
      // Находим конец секции claude
      const nextTranspileAfterClaude = afterClaude.indexOf("Transpiling for", "Transpiling for claude".length);
      const claudeSection =
        nextTranspileAfterClaude > -1 ? afterClaude.slice(0, nextTranspileAfterClaude) : afterClaude;
      expect(claudeSection).toContain("MCP");

      // opencode секция содержит MCP
      const opencodeIdx = output.indexOf("Transpiling for opencode");
      const afterOpencode = output.slice(opencodeIdx);
      const nextTranspileAfterOpencode = afterOpencode.indexOf("Transpiling for", "Transpiling for opencode".length);
      const opencodeSection =
        nextTranspileAfterOpencode > -1 ? afterOpencode.slice(0, nextTranspileAfterOpencode) : afterOpencode;
      expect(opencodeSection).toContain("MCP");

      unmount();
    });
  });

  // =====================================================================
  // § mcp-transpiler.md § Изменения в TranspilerStepOutcome
  // =====================================================================
  describe("Изменения в TranspilerStepOutcome — name включает MCP", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-mcp-step-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Happy path: runTranspileStep с name "MCP" ---
    // § Изменения в TranspilerStepOutcome:
    // name (string: "Instructions" | "Skills" | "Agents" | "Overlay" | "MCP")
    it('runTranspileStep принимает name "MCP" и возвращает outcome с name "MCP"', () => {
      // Создаём mcp.yml
      const agloomDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(agloomDir, { recursive: true });
      fs.writeFileSync(path.join(agloomDir, "mcp.yml"), "mcpServers:\n  test:\n    command: echo\n");

      const outcome = runTranspileStep({
        transpilerFactory: createMcpTranspiler as Parameters<typeof runTranspileStep>[0]["transpilerFactory"],
        adapter: new ClaudeMcpAdapter(),
        projectRoot: tmpDir,
        name: "MCP",
      });

      expect(outcome.name).toBe("MCP");
      expect(outcome.writtenCount).toBe(1);
      expect(outcome.errors).toEqual([]);
    });
  });
});
