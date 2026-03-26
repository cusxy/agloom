// transpile-command.spec.ts
// Спецификация: docs/specs/cli.md § Команда transpile, § TUI-отображение прогресса, § Exit codes
// Спецификация: docs/specs/provider-overlay.md § Расширение команды transpile, § Приоритет

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import React from "react";
import { render } from "ink-testing-library";
import { App } from "../app.js";

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

    // --- Happy path: шаги 1-13 ---
    // Шаг 1: распарсить --adapter
    // Шаг 2: найти в реестре
    // Шаг 3: projectRoot = cwd()
    // Шаг 4: отобразить заголовок со spinner
    // Шаги 5-10: выполнить и отобразить 3 шага транспиляции
    // Шаг 11: вычислить totalWritten
    // Шаг 12: отобразить итоговую строку
    // Шаг 13: exit code 0
    it("при успешной транспиляции всех трёх шагов отображает заголовок, ✓ для каждого шага, итоговую строку и завершается с exit code 0", async () => {
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

    // --- Расширение 1a: аргумент --adapter не указан ---
    // CLI-парсер отображает сообщение об обязательности аргумента --adapter;
    // процесс завершается с exit code 1.
    it("завершается с exit code 1 и сообщением об обязательности --adapter, если аргумент не указан", async () => {
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

      // Сообщение должно указывать на обязательность --adapter
      expect(output).toMatch(/--adapter/);
      expect(process.exitCode).toBe(1);

      unmount();
    });

    // --- Расширение 2a: адаптер не найден в реестре ---
    // "Unknown adapter: {value}. Run 'agloom adapters' to see available adapters."
    // Процесс завершается с exit code 1.
    it('отображает "Unknown adapter" и завершается с exit code 1 при неизвестном adapterId', async () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["transpile", "--adapter", "nonexistent"],
          projectRoot: tmpDir,
        }),
      );

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toContain("Unknown adapter");
        },
        { timeout: 5000 },
      );

      const output = lastFrame()!;
      expect(output).toContain("nonexistent");
      expect(output).toContain("agloom adapters");
      expect(process.exitCode).toBe(1);

      unmount();
    });

    // --- TUI § Неуспешный шаг + § Exit codes ---
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

    // --- Трансформация: шаг 11 — totalWritten = сумма writtenCount всех шагов ---
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

      // Instructions: 1 файл (AGLOOM.md → CLAUDE.md)
      // Skills: 1 файл (SKILL.md → .claude/skills/my-skill/SKILL.md)
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
    // Порядок отображения: Instructions → Skills → Agents → Overlay.
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
    // Если .agloom/overlays/<adapterId>/ не существует: ✓ Overlay 0 files
    it('отображает "Overlay 0 files" если директория overlays/<adapterId>/ не существует', async () => {
      // Не создаём overlays/claude/ — расширение 1a → writtenCount: 0
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

      // Шаг Overlay отображается даже если директория не существует
      expect(output).toContain("Overlay");
      expect(output).toMatch(/Overlay\s+0\s+files/);

      // 0 files — это успех (расширение 1a), отображается с ✓
      expect(output).toMatch(/✓.*Overlay/);

      unmount();
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

      // Instructions: 1 файл (AGLOOM.md → CLAUDE.md)
      // Skills: 1 файл (SKILL.md → .claude/skills/my-skill/SKILL.md)
      // Agents: 1 файл (reviewer.md → .claude/agents/reviewer.md)
      // Overlay: 1 файл (extra.txt → .claude/extra.txt)
      // totalWritten = 1 + 1 + 1 + 1 = 4
      expect(output).toMatch(/Done\.\s+4\s+files written\./);

      unmount();
    });

    // --- § Exit codes: overlay ошибка → exit code 1 ---
    // Exit code учитывает ошибки шага overlay наравне с остальными шагами.
    // Instructions/Skills/Agents успешны, overlay содержит ошибку → exit code 1.
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

      // Проверяем заголовок в любом из фреймов (spinner может уже завершиться)
      const output = lastFrame()!;
      expect(output).toContain("Transpiling for opencode");

      unmount();
    });
  });
});
