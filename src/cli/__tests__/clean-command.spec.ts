// clean-command.spec.ts
// Спецификация: docs/specs/clean-command.md § Команда clean, § Справка

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import React from "react";
import { render } from "ink-testing-library";
import { App } from "../app.js";

/**
 * Рекурсивно восстанавливает права записи для корректной очистки tmpDir в afterEach.
 */
function restorePermissions(dir: string): void {
  try {
    if (!fs.existsSync(dir)) return;
    const stat = fs.statSync(dir);
    if (stat.isDirectory()) {
      try {
        fs.chmodSync(dir, 0o755);
      } catch {
        /* ignore */
      }
      for (const entry of fs.readdirSync(dir)) {
        restorePermissions(path.join(dir, entry));
      }
    }
  } catch {
    /* ignore */
  }
}

describe("CLI", () => {
  describe("Команда clean", () => {
    let tmpDir: string;
    let originalExitCode: number | undefined;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-clean-cmd-"));
      originalExitCode = process.exitCode;
    });

    afterEach(() => {
      restorePermissions(tmpDir);
      fs.rmSync(tmpDir, { recursive: true, force: true });
      process.exitCode = originalExitCode;
    });

    // --- Happy path: шаги 1–8 ---
    // Шаг 1: Распарсить аргумент --adapter.
    // Шаги 2–3: Resolve Adapter (запись адаптера + projectRoot).
    // Шаги 4–6: Clean Files (удаление targetRoot и targetFiles).
    // Шаг 7: Отобразить результат в TUI (§ Вывод — успех).
    // Шаг 8: Завершить процесс с exit code 0.
    it("при успешной очистке отображает заголовок, ✓ с removedCount, Done и завершается с exit code 0", async () => {
      // Создаём файлы адаптера "claude": targetRoot=".claude", targetFiles=["CLAUDE.md"]
      const claudeDir = path.join(tmpDir, ".claude");
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, "settings.json"), "{}");
      fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "Generated content");

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["clean", "--adapter", "claude"],
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

      // § Вывод (успех): "Cleaning for {adapterId}..."
      expect(output).toContain("Cleaning for claude");
      // ✓ с количеством удалённых файлов
      expect(output).toContain("✓");
      expect(output).toMatch(/\d+\s+files removed/);
      // "Done."
      expect(output).toContain("Done.");
      // § Exit codes: 0 — успех
      expect(process.exitCode).toBeUndefined();

      // Побочный эффект: файлы удалены
      expect(fs.existsSync(claudeDir)).toBe(false);
      expect(fs.existsSync(path.join(tmpDir, "CLAUDE.md"))).toBe(false);

      unmount();
    });

    // --- Расширение 1a: аргумент --adapter не указан ---
    // Отобразить сообщение об обязательности аргумента --adapter;
    // процесс завершается с exit code 1.
    it("завершается с exit code 1 и сообщением об обязательности --adapter, если аргумент не указан", async () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["clean"],
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

      // Сообщение указывает на обязательность --adapter
      expect(output).toMatch(/--adapter/);
      // Exit code 1
      expect(process.exitCode).toBe(1);

      unmount();
    });

    // --- Resolve Adapter расширение 1a (через Команду clean): неизвестный адаптер ---
    // Шаги 2–3 ссылаются на § Процедура Resolve Adapter (adapter-registry-ext.md).
    // Расширение 1a: "Unknown agent: {value}. Run 'agloom adapters' to see available adapters."
    // Exit code 1.
    it('отображает "Unknown agent" и завершается с exit code 1 при неизвестном adapterId', async () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["clean", "--adapter", "nonexistent"],
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

    // --- § Вывод при ошибках + § Exit codes ---
    // При наличии ошибок: "✗ {errors[0]}", "Done. {removedCount} files removed."
    // Exit code 1.
    it("при ошибках очистки отображает ✗ с сообщением ошибки и завершается с exit code 1", async () => {
      // targetRoot с protected файлом — провоцирует EACCES при удалении
      const claudeDir = path.join(tmpDir, ".claude");
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, "file.txt"), "content");
      fs.chmodSync(claudeDir, 0o555);

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["clean", "--adapter", "claude"],
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

      // § Вывод (ошибки): "Cleaning for {adapterId}..."
      expect(output).toContain("Cleaning for claude");
      // ✗ с сообщением первой ошибки
      expect(output).toContain("✗");
      // "Done. {removedCount} files removed."
      expect(output).toMatch(/Done\.\s+\d+\s+files removed\./);
      // § Exit codes: 1 — ошибка удаления
      expect(process.exitCode).toBe(1);

      unmount();
    });

    // --- § Справка: clean --help ---
    // Команда ДОЛЖНА поддерживать agloom clean --help.
    it("отображает справку при вызове clean --help", async () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["clean", "--help"],
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

      // Справка содержит описание команды clean и её аргумент --adapter
      expect(output).toMatch(/clean/i);
      expect(output).toMatch(/--adapter/);

      unmount();
    });

    // --- Режим --all ---

    it("при --all очищает все адаптеры и показывает суммарное количество удалённых файлов", async () => {
      // Создаём файлы для claude
      const claudeDir = path.join(tmpDir, ".claude");
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, "settings.json"), "{}");
      fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "content");

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["clean", "--all"],
          projectRoot: tmpDir,
        }),
      );

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toBeDefined();
          expect(frame!).toContain("Done.");
        },
        { timeout: 5000 },
      );

      const output = lastFrame()!;

      expect(output).toContain("Cleaning for claude");
      expect(output).toMatch(/Done\.\s+\d+\s+files removed\./);

      // Файлы удалены
      expect(fs.existsSync(claudeDir)).toBe(false);
      expect(fs.existsSync(path.join(tmpDir, "CLAUDE.md"))).toBe(false);
      expect(process.exitCode).toBeUndefined();

      unmount();
    });

    it("при --all без файлов отображает 'Nothing to clean.'", async () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["clean", "--all"],
          projectRoot: tmpDir,
        }),
      );

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toBeDefined();
          expect(frame!).toContain("Done.");
        },
        { timeout: 5000 },
      );

      const output = lastFrame()!;

      expect(output).toContain("Nothing to clean.");
      expect(output).toMatch(/Done\.\s+0\s+files removed\./);

      unmount();
    });

    it("при одновременном --adapter и --all отображает сообщение о взаимоисключающих аргументах и exit code 1", async () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["clean", "--adapter", "claude", "--all"],
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

    it("при отсутствии --adapter и --all отображает сообщение об обязательности и exit code 1", async () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["clean"],
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

      expect(output).toMatch(/--adapter|--all/);
      expect(process.exitCode).toBe(1);

      unmount();
    });

    // --- § Справка: clean в agloom --help ---
    // Команда clean ДОЛЖНА быть добавлена в вывод agloom --help:
    // "  clean        Remove generated agent-specific files"
    it('содержит "clean" с описанием "Remove generated agent-specific files" в выводе --help', async () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["--help"],
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

      expect(output).toContain("clean");
      expect(output).toContain("Remove generated agent-specific files");

      unmount();
    });

    // =====================================================================
    // § clean-command.md § Вывод § Фильтрация по --verbose
    // =====================================================================

    // --- Без --verbose + --all: адаптеры с 0 удалённых файлов скрываются ---
    // § clean-command.md § Вывод:
    // "Без --verbose: строки с 0 удалённых файлов и без ошибок скрываются."
    // "Адаптеры, у которых removedCount === 0 и нет ошибок, скрываются при отсутствии --verbose."
    it("при --all без --verbose скрывает адаптеры с 0 удалённых файлов, показывая только адаптеры с файлами", async () => {
      // Создаём файлы только для claude (targetRoot=".claude", targetFiles=["CLAUDE.md"])
      const claudeDir = path.join(tmpDir, ".claude");
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, "file.txt"), "content");
      fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "Generated content");

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["clean", "--all"],
          projectRoot: tmpDir,
        }),
      );

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toBeDefined();
          expect(frame!).toContain("Done.");
        },
        { timeout: 5000 },
      );

      const output = lastFrame()!;

      // claude (> 0 удалённых) — отображается
      expect(output).toContain("Cleaning for claude");
      // opencode (0 удалённых, нет .opencode/) — скрыт без --verbose
      expect(output).not.toContain("Cleaning for opencode");
      // agentsmd (0 удалённых, нет .agents/ и нет AGENTS.md) — скрыт без --verbose
      expect(output).not.toContain("Cleaning for agentsmd");

      unmount();
    });

    // --- С --verbose + --all: все адаптеры отображаются ---
    // § clean-command.md § Вывод:
    // "С --verbose: все строки отображаются, включая 0 удалённых файлов."
    it("при --all с --verbose отображает все адаптеры, включая адаптеры с 0 удалённых файлов", async () => {
      // tmpDir пустой — все адаптеры покажут 0 удалённых файлов
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["clean", "--all", "--verbose"],
          projectRoot: tmpDir,
        }),
      );

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toBeDefined();
          expect(frame!).toContain("Done.");
        },
        { timeout: 5000 },
      );

      const output = lastFrame()!;

      // С --verbose все адаптеры отображаются, даже с 0 удалённых файлов
      expect(output).toContain("Cleaning for claude");
      expect(output).toContain("Cleaning for opencode");
      expect(output).toContain("Cleaning for agentsmd");
      expect(output).toMatch(/Done\.\s+0\s+files removed\./);

      unmount();
    });

    // --- С --verbose + --adapter: результат при 0 удалённых файлов отображается ---
    // § clean-command.md § Вывод:
    // "С --verbose: все строки отображаются, включая 0 удалённых файлов."
    it("при --adapter с --verbose отображает результат даже при 0 удалённых файлов", async () => {
      // tmpDir пустой — claude покажет 0 удалённых файлов
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["clean", "--adapter", "claude", "--verbose"],
          projectRoot: tmpDir,
        }),
      );

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toBeDefined();
          expect(frame!).toContain("Done.");
        },
        { timeout: 5000 },
      );

      const output = lastFrame()!;

      // С --verbose результат отображается даже при 0 удалённых файлов
      expect(output).toContain("Cleaning for claude");
      expect(output).toMatch(/0\s+files removed/);
      expect(output).toMatch(/Done\.\s+0\s+files removed\./);

      unmount();
    });
  });
});
