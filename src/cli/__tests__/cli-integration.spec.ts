// cli-integration.spec.ts
// Spec: docs/specs/integration-tests-cli.md
// Integration tests for CLI commands: transpile, clean, init, adapters, help, version, error flows.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import React from "react";
import { render } from "ink-testing-library";
import { App } from "../app.js";

describe("CLI Integration", () => {
  let tmpDir: string;
  let originalExitCode: number | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-cli-integration-"));
    originalExitCode = process.exitCode;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    process.exitCode = originalExitCode;
  });

  // =====================================================================
  // Transpile Command
  // =====================================================================

  describe("Transpile Command", () => {
    // IT-CLI-01: transpile --adapter claude
    it("IT-CLI-01: transpile --adapter claude создаёт файлы и отображает корректный TUI-вывод", async () => {
      // Вход: AGLOOM.md, skills, agents
      fs.writeFileSync(path.join(tmpDir, "AGLOOM.md"), "General instructions.");

      const skillDir = path.join(tmpDir, ".agloom", "skills", "my-skill");
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, "SKILL.md"), "---\nname: my-skill\n---\nSkill content.");

      const agentDir = path.join(tmpDir, ".agloom", "agents");
      fs.mkdirSync(agentDir, { recursive: true });
      fs.writeFileSync(path.join(agentDir, "reviewer.md"), "---\nname: reviewer\n---\nReviewer body.");

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["transpile", "--adapter", "claude"],
          projectRoot: tmpDir,
        }),
      );

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toContain("Done.");
        },
        { timeout: 10000 },
      );

      const output = lastFrame()!;

      // Шаг 3: TUI содержит заголовок адаптера
      expect(output).toContain("Transpiling for claude");

      // Шаг 4: содержит названия шагов
      expect(output).toContain("Instructions");
      expect(output).toContain("Skills");
      expect(output).toContain("Agents");

      // Шаг 5: итоговая строка с количеством файлов
      expect(output).toMatch(/Done\.\s+\d+\s+files written\./);

      // Шаг 6: CLAUDE.md создан на диске
      expect(fs.existsSync(path.join(tmpDir, "CLAUDE.md"))).toBe(true);

      // Шаг 7: exit code не установлен
      expect(process.exitCode).toBeUndefined();

      unmount();
    });

    // IT-CLI-02: transpile --all
    it("IT-CLI-02: transpile --all выполняет транспиляцию для всех адаптеров", async () => {
      fs.writeFileSync(path.join(tmpDir, "AGLOOM.md"), "General instructions.");

      const skillDir = path.join(tmpDir, ".agloom", "skills", "my-skill");
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, "SKILL.md"), "---\nname: my-skill\n---\nSkill content.");

      const agentDir = path.join(tmpDir, ".agloom", "agents");
      fs.mkdirSync(agentDir, { recursive: true });
      fs.writeFileSync(path.join(agentDir, "reviewer.md"), "---\nname: reviewer\n---\nReviewer body.");

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["transpile", "--all"],
          projectRoot: tmpDir,
        }),
      );

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toContain("Done.");
        },
        { timeout: 15000 },
      );

      const output = lastFrame()!;

      // Шаги 3-5: содержит все адаптеры
      expect(output).toContain("claude");
      expect(output).toContain("opencode");
      expect(output).toContain("agentsmd");

      // Шаг 6: итоговая строка
      expect(output).toMatch(/Done\.\s+\d+\s+files written\./);

      // Шаг 7: exit code не установлен
      expect(process.exitCode).toBeUndefined();

      unmount();
    });

    // IT-CLI-03: transpile из конфига (без --adapter)
    it("IT-CLI-03: transpile из конфига использует адаптеры из config.yml", async () => {
      fs.writeFileSync(path.join(tmpDir, "AGLOOM.md"), "General instructions.");

      const agloomDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(agloomDir, { recursive: true });
      fs.writeFileSync(path.join(agloomDir, "config.yml"), "adapters:\n  - claude\n");

      const skillDir = path.join(agloomDir, "skills", "my-skill");
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, "SKILL.md"), "---\nname: my-skill\n---\nSkill content.");

      const agentDir = path.join(agloomDir, "agents");
      fs.mkdirSync(agentDir, { recursive: true });
      fs.writeFileSync(path.join(agentDir, "reviewer.md"), "---\nname: reviewer\n---\nReviewer body.");

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["transpile"],
          projectRoot: tmpDir,
        }),
      );

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toContain("Done.");
        },
        { timeout: 10000 },
      );

      const output = lastFrame()!;

      // Шаг 3: заголовок адаптера из конфига
      expect(output).toContain("Transpiling for claude");

      // Шаг 4: итоговая строка
      expect(output).toMatch(/Done\.\s+\d+\s+files written\./);

      // Шаг 5: CLAUDE.md создан
      expect(fs.existsSync(path.join(tmpDir, "CLAUDE.md"))).toBe(true);

      // Шаг 6: exit code не установлен
      expect(process.exitCode).toBeUndefined();

      unmount();
    });

    // IT-CLI-04: transpile --clean
    it("IT-CLI-04: transpile --clean удаляет предыдущие файлы перед транспиляцией", async () => {
      // Старый CLAUDE.md
      fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "Old instructions.");
      fs.writeFileSync(path.join(tmpDir, "AGLOOM.md"), "New instructions.");

      const skillDir = path.join(tmpDir, ".agloom", "skills", "my-skill");
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, "SKILL.md"), "---\nname: my-skill\n---\nSkill content.");

      const agentDir = path.join(tmpDir, ".agloom", "agents");
      fs.mkdirSync(agentDir, { recursive: true });
      fs.writeFileSync(path.join(agentDir, "reviewer.md"), "---\nname: reviewer\n---\nReviewer body.");

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["transpile", "--adapter", "claude", "--clean"],
          projectRoot: tmpDir,
        }),
      );

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toContain("Done.");
        },
        { timeout: 10000 },
      );

      // Шаги 3-4: CLAUDE.md содержит новое содержимое
      const claudeMd = fs.readFileSync(path.join(tmpDir, "CLAUDE.md"), "utf-8");
      expect(claudeMd).toBe("New instructions.");

      // Шаг 5: exit code не установлен
      expect(process.exitCode).toBeUndefined();

      unmount();
    });

    // IT-CLI-05: transpile --verbose
    it("IT-CLI-05: transpile --verbose отображает все шаги включая 0 файлов", async () => {
      // Пустая директория — без канонических файлов

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["transpile", "--adapter", "claude", "--verbose"],
          projectRoot: tmpDir,
        }),
      );

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toContain("Done.");
        },
        { timeout: 10000 },
      );

      const output = lastFrame()!;

      // Шаг 3: заголовок адаптера
      expect(output).toContain("Transpiling for claude");

      // Шаги 4-7: все шаги отображаются с 0 files
      expect(output).toMatch(/Instructions\s+0\s+files/);
      expect(output).toMatch(/Skills\s+0\s+files/);
      expect(output).toMatch(/Agents\s+0\s+files/);
      expect(output).toMatch(/Overlay\s+0\s+files/);

      unmount();
    });
  });

  // =====================================================================
  // Clean Command
  // =====================================================================

  describe("Clean Command", () => {
    // IT-CLI-06: clean --adapter claude
    it("IT-CLI-06: clean --adapter claude удаляет сгенерированные файлы адаптера", async () => {
      // Создаём target files в paths-поддиректориях
      fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "Generated content.");
      const claudeSkillDir = path.join(tmpDir, ".claude", "skills", "my-skill");
      fs.mkdirSync(claudeSkillDir, { recursive: true });
      fs.writeFileSync(path.join(claudeSkillDir, "SKILL.md"), "Generated skill.");

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["clean", "--adapter", "claude"],
          projectRoot: tmpDir,
        }),
      );

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toContain("Done.");
        },
        { timeout: 10000 },
      );

      const output = lastFrame()!;

      // Шаг 3: заголовок очистки
      expect(output).toContain("Cleaning for claude");

      // Шаг 4: количество удалённых файлов
      expect(output).toContain("files removed");

      // Шаг 5: CLAUDE.md удалён
      expect(fs.existsSync(path.join(tmpDir, "CLAUDE.md"))).toBe(false);

      // Шаг 6: paths-поддиректории удалены
      expect(fs.existsSync(path.join(tmpDir, ".claude", "skills"))).toBe(false);

      unmount();
    });

    // IT-CLI-07: clean --all
    it("IT-CLI-07: clean --all выполняет очистку для всех адаптеров", async () => {
      fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "Generated.");
      fs.writeFileSync(path.join(tmpDir, "AGENTS.md"), "Generated.");

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["clean", "--all"],
          projectRoot: tmpDir,
        }),
      );

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toContain("Done.");
        },
        { timeout: 10000 },
      );

      const output = lastFrame()!;

      // Шаг 3: количество удалённых файлов
      expect(output).toContain("files removed");

      // Шаги 4-5: файлы удалены
      expect(fs.existsSync(path.join(tmpDir, "CLAUDE.md"))).toBe(false);
      expect(fs.existsSync(path.join(tmpDir, "AGENTS.md"))).toBe(false);

      unmount();
    });
  });

  // =====================================================================
  // Init Command
  // =====================================================================

  describe("Init Command", () => {
    // IT-CLI-08: init --adapter claude
    it("IT-CLI-08: init --adapter claude создаёт .agloom/ и копирует overlay файлы", async () => {
      // Создаём CLAUDE.md для импорта
      fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "Existing instructions.");

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["init", "--adapter", "claude"],
          projectRoot: tmpDir,
        }),
      );

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toContain("Done.");
        },
        { timeout: 10000 },
      );

      const output = lastFrame()!;

      // Шаг 3: .agloom/ существует
      expect(fs.existsSync(path.join(tmpDir, ".agloom"))).toBe(true);

      // Шаг 4: config.yml существует
      expect(fs.existsSync(path.join(tmpDir, ".agloom", "config.yml"))).toBe(true);

      // Шаг 5: TUI содержит "files copied"
      expect(output).toContain("files copied");

      // Шаг 6: exit code не установлен
      expect(process.exitCode).toBeUndefined();

      unmount();
    });

    // IT-CLI-09: init без --force при существующем .agloom/
    it("IT-CLI-09: init без --force при существующем .agloom/ завершается ошибкой", async () => {
      // Создаём .agloom/
      fs.mkdirSync(path.join(tmpDir, ".agloom"), { recursive: true });

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["init", "--adapter", "claude"],
          projectRoot: tmpDir,
        }),
      );

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toBeDefined();
          expect(frame!.length).toBeGreaterThan(0);
        },
        { timeout: 5000 },
      );

      const output = lastFrame()!;

      // Шаг 3: сообщение об ошибке
      expect(output).toContain(".agloom/ already exists");

      // Шаг 4: подсказка о --force
      expect(output).toContain("--force");

      // Шаг 5: exit code 1
      expect(process.exitCode).toBe(1);

      unmount();
    });
  });

  // =====================================================================
  // Adapters Command
  // =====================================================================

  describe("Adapters Command", () => {
    // IT-CLI-10: adapters
    it("IT-CLI-10: adapters отображает список адаптеров", async () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["adapters"],
          projectRoot: tmpDir,
        }),
      );

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toBeDefined();
          expect(frame!.length).toBeGreaterThan(0);
        },
        { timeout: 5000 },
      );

      const output = lastFrame()!;

      // Шаги 3-4: содержит адаптеры
      expect(output).toContain("claude");
      expect(output).toContain("opencode");

      unmount();
    });

    // IT-CLI-11: adapters --all
    it("IT-CLI-11: adapters --all отображает все адаптеры включая нескрытые", async () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["adapters", "--all"],
          projectRoot: tmpDir,
        }),
      );

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toBeDefined();
          expect(frame!.length).toBeGreaterThan(0);
        },
        { timeout: 5000 },
      );

      const output = lastFrame()!;

      // Шаги 3-4: содержит адаптеры
      expect(output).toContain("claude");
      expect(output).toContain("opencode");

      unmount();
    });
  });

  // =====================================================================
  // Help Command
  // =====================================================================

  describe("Help Command", () => {
    // IT-CLI-12: help
    it("IT-CLI-12: help отображает список help topics", async () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["help"],
          projectRoot: tmpDir,
        }),
      );

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toBeDefined();
          expect(frame!.length).toBeGreaterThan(0);
        },
        { timeout: 5000 },
      );

      const output = lastFrame()!;

      // Шаг 3: содержит заголовок списка topics
      expect(output).toContain("Available help topics");

      unmount();
    });

    // IT-CLI-13: --version
    it("IT-CLI-13: --version отображает версию в формате semver", async () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["--version"],
          projectRoot: tmpDir,
        }),
      );

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toBeDefined();
          expect(frame!.length).toBeGreaterThan(0);
        },
        { timeout: 5000 },
      );

      const output = lastFrame()!;

      // Шаг 3: версия в формате semver
      expect(output).toMatch(/\d+\.\d+\.\d+/);

      unmount();
    });
  });

  // =====================================================================
  // Error Flows
  // =====================================================================

  describe("Error Flows", () => {
    // IT-CLI-14: неизвестная команда
    it("IT-CLI-14: неизвестная команда завершается с exit code 1", async () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["foobar"],
          projectRoot: tmpDir,
        }),
      );

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toBeDefined();
          expect(frame!.length).toBeGreaterThan(0);
        },
        { timeout: 5000 },
      );

      const output = lastFrame()!;

      // Шаги 3-4: сообщение об ошибке с именем команды
      expect(output).toContain("Unknown command");
      expect(output).toContain("foobar");

      // Шаг 5: exit code 1
      expect(process.exitCode).toBe(1);

      unmount();
    });

    // IT-CLI-15: неизвестный --flag
    it("IT-CLI-15: неизвестный флаг завершается с exit code 1", async () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["--unknown-flag"],
          projectRoot: tmpDir,
        }),
      );

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toBeDefined();
          expect(frame!.length).toBeGreaterThan(0);
        },
        { timeout: 5000 },
      );

      const output = lastFrame()!;

      // Шаги 3-4: сообщение об ошибке с именем флага
      expect(output).toContain("Unknown option");
      expect(output).toContain("--unknown-flag");

      // Шаг 5: exit code 1
      expect(process.exitCode).toBe(1);

      unmount();
    });

    // IT-CLI-16: transpile без config
    it("IT-CLI-16: transpile без config завершается с ошибкой", async () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["transpile"],
          projectRoot: tmpDir,
        }),
      );

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toBeDefined();
          expect(frame!.length).toBeGreaterThan(0);
        },
        { timeout: 5000 },
      );

      const output = lastFrame()!;

      // Шаг 3: сообщение об отсутствии адаптеров
      // § config.md § Процедура Resolve Adapters from CLI Args § Расширения 5a
      expect(output).toContain("No adapters specified");

      // Шаг 4: exit code 1
      expect(process.exitCode).toBe(1);

      unmount();
    });
  });
});
