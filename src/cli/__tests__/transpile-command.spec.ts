// transpile-command.spec.ts
// Спецификация: docs/specs/cli.md § Команда transpile, § TUI-отображение прогресса, § Exit codes
// Спецификация: docs/specs/provider-overlay.md § Расширение команды transpile, § Приоритет

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import React from "react";
import { render } from "ink-testing-library";
import { App, resolveDeps } from "../app.js";
import type { AdapterRegistryEntry } from "../types.js";

describe("CLI", () => {
  describe("Команда transpile", () => {
    let tmpDir: string;
    let originalExitCode: number | undefined;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-transpile-cmd-"));
      originalExitCode = process.exitCode;

      // Создаём канонические файлы для всех трёх транспилеров
      // Instructions: AGLOOM.md
      fs.writeFileSync(path.join(tmpDir, "AGLOOM.md"), "General instructions.");

      // Skills: .agloom/skills/my-skill/SKILL.md
      const skillDir = path.join(tmpDir, ".agloom", "skills", "my-skill");
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(
        path.join(skillDir, "SKILL.md"),
        "---\nname: my-skill\n---\nSkill content.",
      );

      // Agents: .agloom/agents/reviewer.md
      const agentDir = path.join(tmpDir, ".agloom", "agents");
      fs.mkdirSync(agentDir, { recursive: true });
      fs.writeFileSync(
        path.join(agentDir, "reviewer.md"),
        "---\nname: reviewer\n---\nReviewer body.",
      );
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      process.exitCode = originalExitCode;
    });

    // =====================================================================
    // Happy path: Режим --adapter
    // § cli.md § Режим --adapter § Поведение шаги 1-11
    // =====================================================================

    // --- Happy path: шаги 1-11 ---
    // Шаг 1: распарсить --adapter и --all
    // Шаг 2: найти в реестре
    // Шаг 3: projectRoot = cwd()
    // Шаг 4: отобразить заголовок со spinner
    // Шаги 5-7: выполнить 3 шага транспиляции (Instructions, Skills, Agents)
    // Шаг 8: отобразить результаты в TUI
    // Шаг 9: вычислить totalWritten
    // Шаг 10: отобразить итоговую строку
    // Шаг 11: exit code 0
    it("при успешной транспиляции всех трёх шагов отображает заголовок, результаты для каждого шага, итоговую строку и завершается с exit code 0", async () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["transpile", "--adapter", "claude"],
          projectRoot: tmpDir,
        }),
      );

      // Ждём завершения всех шагов транспиляции
      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toContain("Done.");
        },
        { timeout: 10000 },
      );

      const output = lastFrame()!;

      // TUI § Заголовок: содержит имя адаптера
      expect(output).toContain("Transpiling for claude");

      // TUI § Результат шага (успешный): ✓ для каждого из трёх шагов
      expect(output).toContain("✓");
      expect(output).toMatch(/Instructions/);
      expect(output).toMatch(/Skills/);
      expect(output).toMatch(/Agents/);

      // TUI § Итоговая строка: суммарное количество файлов
      expect(output).toMatch(/Done\.\s+\d+\s+files written\./);

      // § Exit codes: 0 при успехе всех шагов
      expect(process.exitCode).toBeUndefined();

      unmount();
    });

    // =====================================================================
    // Расширение 1a: ни --adapter, ни --all не указаны
    // § cli.md § Режим --adapter § Расширения 1a
    // =====================================================================

    it("при отсутствии --adapter и --all отображает сообщение об обязательности и exit code 1", async () => {
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

      // Сообщение должно указывать на --adapter или --all
      expect(output).toMatch(/--adapter|--all/);
      expect(process.exitCode).toBe(1);

      unmount();
    });

    // =====================================================================
    // Расширение 1b: --adapter и --all указаны одновременно
    // § cli.md § Режим --adapter § Расширения 1b
    // =====================================================================

    it("при одновременном --adapter и --all отображает сообщение о взаимоисключающих аргументах и exit code 1", async () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["transpile", "--adapter", "claude", "--all"],
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

      expect(output).toMatch(/mutually exclusive/i);
      expect(process.exitCode).toBe(1);

      unmount();
    });

    // =====================================================================
    // Расширение 2a: адаптер не найден в реестре
    // § cli.md § Режим --adapter § Расширения 2a:
    // "Unknown agent: {value}. Run 'agloom adapters' to see available adapters."
    // exit code 1.
    // =====================================================================

    it('при неизвестном --adapter отображает "Unknown agent" и завершается с exit code 1', async () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["transpile", "--adapter", "nonexistent"],
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

      expect(output).toContain("Unknown agent");
      expect(output).toContain("nonexistent");
      expect(output).toContain("agloom adapters");
      expect(process.exitCode).toBe(1);

      unmount();
    });

    // =====================================================================
    // TUI § Неуспешный шаг + § Exit codes
    // § cli.md § TUI-отображение прогресса § Неуспешный шаг
    // =====================================================================

    // --- TUI § Неуспешный шаг ---
    // Шаг с ошибками отображает ✗ и сообщение первой ошибки.
    // Exit code 1 при ошибках хотя бы одного шага.
    it("отображает ✗ и сообщение ошибки для неуспешного шага и завершается с exit code 1", async () => {
      // Удаляем .agloom/agents/ чтобы вызвать ошибку в agents transpiler
      // Создаём файл вместо каталога для провоцирования ошибки
      fs.rmSync(path.join(tmpDir, ".agloom", "agents"), {
        recursive: true,
        force: true,
      });
      // Создаём файл вместо каталога — agents transpiler discover() выбросит ошибку
      fs.writeFileSync(path.join(tmpDir, ".agloom", "agents"), "not a dir");

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

      // Успешные шаги показывают ✓
      expect(output).toContain("✓");

      // Неуспешный шаг показывает ✗ и сообщение первой ошибки
      expect(output).toContain("✗");
      // TUI § Результат шага (неуспешный): "✗ {name}        {errors[0]}"
      // Строка с ✗ должна содержать имя шага и текст ошибки
      expect(output).toMatch(/✗.*Agents/);
      // Текст ошибки отображается в выводе (сообщение из transpiler)
      expect(output).toMatch(/✗.*\S+/); // ✗ с непустым сообщением после имени

      // Exit code 1 при наличии ошибок
      expect(process.exitCode).toBe(1);

      unmount();
    });

    // --- Трансформация: шаг 9 — totalWritten = сумма writtenCount всех шагов ---
    // § cli.md § Режим --adapter § Поведение шаг 9:
    // totalWritten включает writtenCount из шагов с ошибками
    // (частично записанные файлы учитываются).
    it("вычисляет totalWritten как сумму writtenCount всех шагов, включая шаги с частичными ошибками", async () => {
      // Instructions и Skills успешны, Agents вызовет ошибку
      fs.rmSync(path.join(tmpDir, ".agloom", "agents"), {
        recursive: true,
        force: true,
      });
      fs.writeFileSync(path.join(tmpDir, ".agloom", "agents"), "not a dir");

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

      // Instructions: 1 файл (AGLOOM.md -> CLAUDE.md)
      // Skills: 1 файл (SKILL.md -> .claude/skills/my-skill/SKILL.md)
      // Agents: 0 файлов (ошибка)
      // totalWritten = 1 + 1 + 0 = 2
      expect(output).toMatch(/Done\.\s+2\s+files written\./);

      unmount();
    });

    // =====================================================================
    // Спецификация: docs/specs/provider-overlay.md § Расширение команды transpile
    // =====================================================================

    // --- § Расширение команды transpile, шаг 8-9: Overlay отображается в TUI ---
    // После шага 7 (Agents) выполняется шаг 8 (Overlay).
    // Порядок отображения: Instructions -> Skills -> Agents -> Overlay.
    it("отображает шаг Overlay в TUI после Instructions, Skills и Agents", async () => {
      // Создаём overlay-файлы для адаптера claude
      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      fs.mkdirSync(overlayDir, { recursive: true });
      fs.writeFileSync(
        path.join(overlayDir, "overlay-file.txt"),
        "overlay data",
      );

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

      // TUI должен содержать шаг Overlay с количеством файлов
      expect(output).toContain("Overlay");
      expect(output).toMatch(/Overlay\s+\d+\s+files/);

      // Порядок отображения: Overlay ПОСЛЕ Agents
      expect(output.indexOf("Overlay")).toBeGreaterThan(
        output.indexOf("Agents"),
      );

      unmount();
    });

    // --- § Расширение команды transpile, вывод ---
    // Без --verbose: шаги с 0 файлов скрываются
    it("без --verbose скрывает шаги с 0 файлов", async () => {
      // Не создаём overlays/claude/
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

      // Overlay с 0 файлов не должен отображаться без --verbose
      expect(output).not.toContain("Overlay");

      unmount();
    });

    // С --verbose: шаги с 0 файлов отображаются
    it('с --verbose отображает "Overlay 0 files" если директория overlays/<adapterId>/ не существует', async () => {
      // Не создаём overlays/claude/
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

      // Шаг Overlay отображается с --verbose даже если 0 файлов
      expect(output).toContain("Overlay");
      expect(output).toMatch(/Overlay\s+0\s+files/);
      expect(output).toMatch(/✓.*Overlay/);

      unmount();
    });

    // --- "Nothing to transpile." при 0 файлов без ошибок ---
    it('отображает "Nothing to transpile." при 0 записанных файлов', async () => {
      // Пустой проект: нет AGLOOM.md, skills, agents, overlays
      const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-empty-"));

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["transpile", "--adapter", "opencode"],
          projectRoot: emptyDir,
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

      expect(output).toContain("Nothing to transpile.");
      expect(output).toMatch(/Done\.\s+0\s+files written\./);

      unmount();
      fs.rmSync(emptyDir, { recursive: true, force: true });
    });

    // --- § Расширение команды transpile, шаг 10: totalWritten всех четырёх шагов ---
    // totalWritten вычисляется как сумма writtenCount всех четырёх шагов
    // (Instructions, Skills, Agents, Overlay).
    it("вычисляет totalWritten как сумму writtenCount всех четырёх шагов включая Overlay", async () => {
      // Создаём overlay-файл
      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      fs.mkdirSync(overlayDir, { recursive: true });
      fs.writeFileSync(path.join(overlayDir, "extra.txt"), "overlay data");

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

      // Instructions: 1 файл (AGLOOM.md -> CLAUDE.md)
      // Skills: 1 файл (SKILL.md -> .claude/skills/my-skill/SKILL.md)
      // Agents: 1 файл (reviewer.md -> .claude/agents/reviewer.md)
      // Overlay: 1 файл (extra.txt -> .claude/extra.txt)
      // totalWritten = 1 + 1 + 1 + 1 = 4
      expect(output).toMatch(/Done\.\s+4\s+files written\./);

      unmount();
    });

    // --- § Exit codes: overlay ошибка -> exit code 1 ---
    // Exit code учитывает ошибки шага overlay наравне с остальными шагами.
    it("завершается с exit code 1 при ошибке только в шаге overlay (остальные шаги успешны)", async () => {
      // Создаём overlay-файл, который невозможно скопировать:
      // целевой путь заблокирован каталогом
      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      fs.mkdirSync(overlayDir, { recursive: true });
      fs.writeFileSync(path.join(overlayDir, "blocked.txt"), "data");

      // Создаём каталог на пути целевого файла — copyFile провалится
      fs.mkdirSync(path.join(tmpDir, ".claude", "blocked.txt"), {
        recursive: true,
      });

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

      // Instructions, Skills, Agents — успешны (✓)
      expect(output).toMatch(/✓.*Instructions/);
      expect(output).toMatch(/✓.*Skills/);
      expect(output).toMatch(/✓.*Agents/);

      // Overlay — ошибка (✗)
      expect(output).toMatch(/✗.*Overlay/);

      // Exit code 1: ошибка overlay учитывается наравне с остальными шагами
      expect(process.exitCode).toBe(1);

      unmount();
    });

    // --- § Приоритет: overlay перезаписывает каноническую генерацию ---
    // Overlay копируется ПОСЛЕ всех транспилерных шагов.
    // Если overlay-файл и каноническая транспиляция создают файл с одинаковым путём,
    // overlay-файл ДОЛЖЕН перезаписать каноническое значение.
    it("overlay-файл перезаписывает файл, созданный каноническим транспилером", async () => {
      // Skills transpiler создаёт .claude/skills/my-skill/SKILL.md
      // Overlay содержит файл с тем же относительным путём и другим содержимым
      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      const overlaySkillDir = path.join(overlayDir, "skills", "my-skill");
      fs.mkdirSync(overlaySkillDir, { recursive: true });
      fs.writeFileSync(
        path.join(overlaySkillDir, "SKILL.md"),
        "Overlay skill content overrides canonical.",
      );

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

      // Файл в целевой директории должен содержать overlay-контент,
      // а не каноническое значение от skills transpiler
      const skillFile = fs.readFileSync(
        path.join(tmpDir, ".claude", "skills", "my-skill", "SKILL.md"),
        "utf-8",
      );
      expect(skillFile).toBe("Overlay skill content overrides canonical.");

      unmount();
    });

    // --- TUI § Заголовок: отображается с adapterId ---
    // § cli.md § TUI-отображение прогресса § Заголовок
    it('отображает заголовок "Transpiling for {adapterId}..."', async () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["transpile", "--adapter", "opencode"],
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

      // Проверяем заголовок
      const output = lastFrame()!;
      expect(output).toContain("Transpiling for opencode");

      unmount();
    });

    // =====================================================================
    // Режим --all
    // § cli.md § Режим --all
    // =====================================================================

    // --- § Режим --all: для каждой записи реестра выполнить транспиляцию ---
    // § cli.md § Режим --all § Поведение шаг 3: Для каждой записи реестра
    // выполнить шаги транспиляции.
    it("при --all выполняет транспиляцию для всех адаптеров из реестра", async () => {
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

      // Вывод должен содержать заголовки для нескольких адаптеров
      expect(output).toContain("claude");
      expect(output).toContain("opencode");
      expect(output).toContain("agentsmd");
      expect(output).toContain("Done.");

      unmount();
    });

    // --- § Режим --all § totalWritten: суммарный writtenCount всех записей ---
    // § cli.md § Режим --all § Поведение шаг 4: Вычислить totalWritten как
    // суммарный writtenCount всех шагов всех записей.
    it("при --all вычисляет totalWritten как суммарный writtenCount всех адаптеров", async () => {
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

      // totalWritten > 0 и показывает суммарное количество файлов
      expect(output).toMatch(/Done\.\s+\d+\s+files written\./);

      // Число файлов должно быть больше, чем при одном адаптере
      const match = output.match(/Done\.\s+(\d+)\s+files written\./);
      expect(match).not.toBeNull();
      const totalWritten = parseInt(match![1], 10);
      expect(totalWritten).toBeGreaterThan(0);

      unmount();
    });

    // =====================================================================
    // OpenCode no-op для instructions
    // § cli.md § Реестр адаптеров
    // =====================================================================

    // § cli.md: OpenCodeAdapter является no-op для instructions: метод transpile()
    // возвращает пустой массив OutputFile[].
    it("при транспиляции opencode с --verbose шаг Instructions показывает 0 files (no-op)", async () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["transpile", "--adapter", "opencode", "--verbose"],
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

      // Instructions для opencode — no-op, 0 files
      expect(output).toMatch(/Instructions\s+0\s+files/);

      unmount();
    });

    // =====================================================================
    // § cli.md § Разрешение зависимостей
    // opencode.dependsOn = ["agentsmd"] → AGENTS.md создаётся при transpile --adapter opencode
    // =====================================================================

    it("при transpile --adapter opencode создаёт AGENTS.md через зависимость agentsmd", async () => {
      // Создаём канонический файл
      fs.writeFileSync(
        path.join(tmpDir, "AGLOOM.md"),
        "OpenCode project instructions",
      );

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["transpile", "--adapter", "opencode"],
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

      // Побочный эффект: AGENTS.md создан (через зависимость agentsmd)
      const agentsMdPath = path.join(tmpDir, "AGENTS.md");
      expect(fs.existsSync(agentsMdPath)).toBe(true);
      expect(fs.readFileSync(agentsMdPath, "utf-8")).toBe(
        "OpenCode project instructions",
      );

      unmount();
    });

    // =====================================================================
    // § cli.md § Разрешение зависимостей § Расширение 1a
    // circular dependency → Error("Circular dependency detected")
    // =====================================================================

    it("выбрасывает ошибку при циклической зависимости в реестре", () => {
      // Тестовый реестр с циклом: a -> b -> a
      const circularRegistry = [
        {
          id: "a",
          description: "A",
          dependsOn: ["b"],
        },
        {
          id: "b",
          description: "B",
          dependsOn: ["a"],
        },
      ] as AdapterRegistryEntry[];

      expect(() => resolveDeps("a", circularRegistry)).toThrow(
        "Circular dependency detected",
      );
    });

    // =====================================================================
    // § cli.md § Разрешение зависимостей § Расширение 1b
    // unknown dependency → Error("Unknown dependency: {id}")
    // =====================================================================

    it('выбрасывает ошибку "Unknown dependency: {id}" при отсутствии зависимости в реестре', () => {
      // Тестовый реестр: a зависит от несуществующего "missing"
      const missingDepRegistry = [
        {
          id: "a",
          description: "A",
          dependsOn: ["missing"],
        },
      ] as AdapterRegistryEntry[];

      expect(() => resolveDeps("a", missingDepRegistry)).toThrow(
        "Unknown dependency: missing",
      );
    });

    // =====================================================================
    // Регрессия: spinner заменяется на ✓ при завершении (process exit)
    // Постмортем: docs/postmortems/003-transpile-hang.md
    // =====================================================================

    it("при --adapter заменяет spinner на ✓ в заголовке после завершения транспиляции", async () => {
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

      // Заголовок должен содержать ✓ вместо spinner
      expect(output).toMatch(/✓ Transpiling for claude/);

      unmount();
    });

    it("при --all заменяет spinner на ✓ в заголовках после завершения транспиляции", async () => {
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

      // Все заголовки должны содержать ✓ вместо spinner
      expect(output).toMatch(/✓ Transpiling for claude/);
      expect(output).toMatch(/✓ Transpiling for opencode/);
      expect(output).toMatch(/✓ Transpiling for agentsmd/);

      unmount();
    });

    // =====================================================================
    // § Справка transpile --help
    // § cli.md § --help
    // =====================================================================

    // § cli.md § --help: Вывод agloom transpile --help ДОЛЖЕН содержать
    // Usage: agloom transpile (--adapter <agentId> | --all) [--clean]
    it("справка transpile --help содержит --adapter и --all", async () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["transpile", "--help"],
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

      // Обновлённая справка содержит --adapter и --all
      expect(output).toContain("--adapter");
      expect(output).toContain("--all");

      unmount();
    });

    // =====================================================================
    // § cli.md § TUI-отображение прогресса § Фильтрация шагов (--verbose)
    // Тесты для поведения фильтрации по --verbose
    // =====================================================================

    // --- Без --verbose: шаги с writtenCount === 0 и пустым errors скрываются ---
    // § cli.md § Фильтрация шагов:
    // "Без --verbose: шаги с writtenCount === 0 и пустым errors скрываются."
    // Проект без AGLOOM.md → Instructions = 0 файлов (скрыт).
    // Skills и Agents имеют канонические файлы → > 0 файлов (отображаются).
    it("без --verbose скрывает шаг с 0 файлов (Instructions), показывая остальные шаги", async () => {
      // Создаём Skills и Agents но НЕ AGLOOM.md → Instructions = 0 файлов
      const sparseDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-sparse-"));

      const skillDir = path.join(sparseDir, ".agloom", "skills", "my-skill");
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(
        path.join(skillDir, "SKILL.md"),
        "---\nname: my-skill\n---\nSkill content.",
      );

      const agentDir = path.join(sparseDir, ".agloom", "agents");
      fs.mkdirSync(agentDir, { recursive: true });
      fs.writeFileSync(
        path.join(agentDir, "reviewer.md"),
        "---\nname: reviewer\n---\nReviewer body.",
      );

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["transpile", "--adapter", "claude"],
          projectRoot: sparseDir,
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

      // Instructions (0 файлов, нет AGLOOM.md) — скрыт без --verbose
      expect(output).not.toContain("Instructions");
      // Skills и Agents — отображаются (> 0 файлов)
      expect(output).toContain("Skills");
      expect(output).toContain("Agents");
      // Заголовок адаптера отображается (есть видимые шаги)
      expect(output).toContain("Transpiling for claude");

      unmount();
      fs.rmSync(sparseDir, { recursive: true, force: true });
    });

    // --- Без --verbose: заголовок адаптера скрыт при всех шагах 0 ---
    // § cli.md § Фильтрация шагов:
    // "Если для записи все шаги скрыты — заголовок записи также не отображается."
    it("без --verbose скрывает заголовок адаптера, если все шаги имеют 0 файлов", async () => {
      const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-no-hdr-"));

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["transpile", "--adapter", "claude"],
          projectRoot: emptyDir,
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

      // Все шаги = 0, без --verbose → заголовок адаптера не отображается
      expect(output).not.toContain("Transpiling for claude");
      // "Nothing to transpile." отображается
      expect(output).toContain("Nothing to transpile.");

      unmount();
      fs.rmSync(emptyDir, { recursive: true, force: true });
    });

    // --- С --verbose: все шаги отображаются, включая 0 файлов ---
    // § cli.md § Фильтрация шагов:
    // "С --verbose: все шаги отображаются, включая шаги с 0 файлов."
    // Заголовок адаптера также отображается.
    it("с --verbose при всех шагах 0 отображает заголовок адаптера и все шаги", async () => {
      const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-verb-all-"));

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["transpile", "--adapter", "claude", "--verbose"],
          projectRoot: emptyDir,
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

      // С --verbose заголовок адаптера отображается даже при 0 файлах
      expect(output).toContain("Transpiling for claude");
      // Все 4 шага отображаются с 0 файлов
      expect(output).toMatch(/Instructions\s+0\s+files/);
      expect(output).toMatch(/Skills\s+0\s+files/);
      expect(output).toMatch(/Agents\s+0\s+files/);
      expect(output).toMatch(/Overlay\s+0\s+files/);

      unmount();
      fs.rmSync(emptyDir, { recursive: true, force: true });
    });
  });
});
