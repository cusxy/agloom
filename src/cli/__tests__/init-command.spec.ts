// init-command.spec.ts
// Спецификация: docs/specs/init-command.md § Команда init, § Процедура Backup Project Files,
//               § Процедура Init Overlay Files, § Вывод, § Exit codes, § Справка

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import React from "react";
import { render } from "ink-testing-library";
import { App } from "../app.js";

/**
 * Рекурсивно восстанавливает права для корректной очистки tmpDir в afterEach.
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
    } else {
      try {
        fs.chmodSync(dir, 0o644);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}

describe("CLI", () => {
  describe("Команда init", () => {
    let tmpDir: string;
    let originalExitCode: number | undefined;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-init-cmd-"));
      originalExitCode = process.exitCode;
    });

    afterEach(() => {
      restorePermissions(tmpDir);
      fs.rmSync(tmpDir, { recursive: true, force: true });
      process.exitCode = originalExitCode;
    });

    // =====================================================================
    // Happy path: Команда init --agent
    // § init-command.md § Команда init § Поведение шаги 1-10
    // 1. Распарсить аргументы --agent, --all и --force.
    // 2. Проверить, что указан хотя бы один из --agent или --all.
    // 3. Проверить, что --agent и --all не указаны одновременно.
    // 4. Определить projectRoot как process.cwd().
    // 5. Выполнить процедуру Backup Project Files.
    // 6. Resolve Adapter.
    // 7. Init Overlay Files.
    // 8. (--all вариант)
    // 9. Отобразить результат (§ Вывод).
    // 10. Завершить процесс с exit code.
    // =====================================================================

    it("при успешной инициализации --agent выполняет Backup Project Files и Init Overlay Files, отображает успех и завершается с exit code 0", async () => {
      // Создаём project-файлы (CLAUDE.md — в projectFiles записи claude)
      fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "Claude instructions");

      // Создаём файлы в targetRoot адаптера "claude" (.claude/)
      const claudeDir = path.join(tmpDir, ".claude");
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(
        path.join(claudeDir, "settings.json"),
        '{"key": "value"}',
      );
      fs.writeFileSync(path.join(claudeDir, "config.txt"), "config content");

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["init", "--agent", "claude"],
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

      // § Вывод: "Initializing..." (не "Initializing for claude...")
      expect(output).toContain("Initializing...");
      // § Вывод (успех): результат бэкапа project-файлов
      expect(output).toMatch(/project files backed up to \.agloom\/instructions\//);
      // § Вывод (успех): результат overlay
      expect(output).toContain("✓");
      expect(output).toMatch(
        /2\s+files copied to \.agloom\/overlays\/claude\//,
      );
      // "Done."
      expect(output).toContain("Done.");
      // § Exit codes: 0 — успех
      expect(process.exitCode).toBeUndefined();

      // Побочный эффект: project-файлы скопированы в .agloom/instructions/
      const backedUp = path.join(tmpDir, ".agloom", "instructions", "CLAUDE.md");
      expect(fs.existsSync(backedUp)).toBe(true);
      expect(fs.readFileSync(backedUp, "utf-8")).toBe("Claude instructions");

      // Побочный эффект: файлы скопированы в .agloom/overlays/claude/
      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      const overlaySettings = fs.readFileSync(
        path.join(overlayDir, "settings.json"),
        "utf-8",
      );
      expect(overlaySettings).toBe('{"key": "value"}');
      const overlayConfig = fs.readFileSync(
        path.join(overlayDir, "config.txt"),
        "utf-8",
      );
      expect(overlayConfig).toBe("config content");

      unmount();
    });

    // =====================================================================
    // Расширение 2a: ни --agent, ни --all не указан
    // § init-command.md § Расширения 2a: Ни --agent, ни --all не указан →
    // отобразить сообщение об обязательности одного из аргументов; exit code 1.
    // =====================================================================

    it("завершается с exit code 1 и сообщением об обязательности --agent или --all, если ни один не указан", async () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["init"],
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

      // Сообщение должно указывать на обязательность --agent или --all
      expect(output).toMatch(/--agent|--all/);
      expect(process.exitCode).toBe(1);

      unmount();
    });

    // =====================================================================
    // Расширение 3a: --agent и --all указаны одновременно
    // § init-command.md § Расширения 3a: --agent и --all указаны одновременно →
    // отобразить "--agent and --all are mutually exclusive."; exit code 1.
    // =====================================================================

    it('отображает "--agent and --all are mutually exclusive." и exit code 1, если оба указаны одновременно', async () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["init", "--agent", "claude", "--all"],
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

      expect(output).toContain("--agent and --all are mutually exclusive");
      expect(process.exitCode).toBe(1);

      unmount();
    });

    // =====================================================================
    // Расширение 6a (Команда init): Resolve Adapter вернул ошибку
    // § init-command.md § Расширения 6a:
    // "Unknown agent: {value}. Run 'agloom adapters' to see available adapters."
    // exit code 1.
    // =====================================================================

    it('при неизвестном --agent отображает "Unknown agent" и завершается с exit code 1', async () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["init", "--agent", "nonexistent"],
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

      // Сообщение должно содержать "Unknown agent" (не "Unknown adapter")
      expect(output).toContain("Unknown agent");
      expect(output).toContain("nonexistent");
      expect(output).toContain("agloom adapters");
      expect(process.exitCode).toBe(1);

      unmount();
    });

    // =====================================================================
    // Процедура Init Overlay Files
    // § init-command.md § Процедура Init Overlay Files
    // =====================================================================

    // --- .agloom/ уже существует, --force не указан ---
    // Pre-check: наличие .agloom/ без --force → блокирующая ошибка до любых операций.
    it('отображает ".agloom/ already exists" и exit code 1, если .agloom/ существует без --force', async () => {
      // Создаём существующие файлы в .agloom/ (любая структура)
      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      fs.mkdirSync(overlayDir, { recursive: true });
      fs.writeFileSync(path.join(overlayDir, "existing.txt"), "existing");

      // Создаём файлы в targetRoot (.claude/)
      const claudeDir = path.join(tmpDir, ".claude");
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, "new-file.txt"), "new content");

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["init", "--agent", "claude"],
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

      // Единое сообщение об ошибке на уровне .agloom/
      expect(output).toContain(".agloom/ already exists");
      expect(output).toContain("--force");
      // Exit code 1
      expect(process.exitCode).toBe(1);

      // Побочный эффект: существующие файлы не изменены
      const existing = fs.readFileSync(
        path.join(overlayDir, "existing.txt"),
        "utf-8",
      );
      expect(existing).toBe("existing");

      unmount();
    });

    // --- Расширение 2b Init Overlay Files: --force указан → перезаписать существующие файлы ---
    // § init-command.md § Процедура Init Overlay Files § Расширения 2b
    it("при --force перезаписывает существующие overlay-файлы в целевой директории", async () => {
      // Существующие файлы в overlays/claude/
      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      fs.mkdirSync(overlayDir, { recursive: true });
      fs.writeFileSync(path.join(overlayDir, "settings.json"), '{"old": true}');

      // Новые файлы в targetRoot (.claude/)
      const claudeDir = path.join(tmpDir, ".claude");
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, "settings.json"), '{"new": true}');

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["init", "--agent", "claude", "--force"],
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

      // Успешный вывод, не содержит ошибки "already exists"
      expect(output).toContain("Initializing...");
      expect(output).toContain("✓");
      expect(output).not.toContain("already exists");
      // Exit code 0
      expect(process.exitCode).toBeUndefined();

      // Побочный эффект: файл перезаписан новым содержимым
      const settings = fs.readFileSync(
        path.join(overlayDir, "settings.json"),
        "utf-8",
      );
      expect(settings).toBe('{"new": true}');

      unmount();
    });

    // --- Расширение 3a Init Overlay Files: ошибка создания директории ---
    // § init-command.md § Процедура Init Overlay Files § Расширения 3a:
    // ошибка создания директории → вернуть строку-сообщение с текстом ошибки.
    // Skip: chmod не работает на Windows и бесполезен под root
    it.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
      "при ошибке создания overlay-директории отображает сообщение об ошибке и завершается с exit code 1",
      async () => {
        // Создаём файлы в targetRoot (.claude/)
        const claudeDir = path.join(tmpDir, ".claude");
        fs.mkdirSync(claudeDir, { recursive: true });
        fs.writeFileSync(path.join(claudeDir, "file.txt"), "content");

        // Создаём .agloom/overlays/ read-only — init не сможет создать claude/ внутри
        const overlaysDir = path.join(tmpDir, ".agloom", "overlays");
        fs.mkdirSync(overlaysDir, { recursive: true });
        fs.chmodSync(overlaysDir, 0o555);

        const { lastFrame, unmount } = render(
          React.createElement(App, {
            args: ["init", "--agent", "claude"],
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

        // Сообщение об ошибке создания директории
        expect(output.length).toBeGreaterThan(0);
        // Exit code 1
        expect(process.exitCode).toBe(1);

        unmount();
      },
    );

    // --- Расширение 4a Init Overlay Files: targetRoot не существует ---
    // § init-command.md § Процедура Init Overlay Files § Расширения 4a:
    // targetRoot не существует → copiedCount: 0, не является ошибкой.
    it("при несуществующем targetRoot overlay не отображает строку для 0 файлов и завершается с exit code 0", async () => {
      // Не создаём .claude/ — targetRoot отсутствует

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["init", "--agent", "claude"],
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

      // 0 files → "Initializing..." не отображается, вместо него "Nothing to import."
      expect(output).not.toContain("Initializing...");
      expect(output).toContain("Nothing to import.");
      expect(output).toMatch(/Done\.\s+0\s+files copied\./);
      // § Exit codes: 0 — успех (включая 0 файлов)
      expect(process.exitCode).toBeUndefined();

      unmount();
    });

    // --- Bug fix: пустые overlay-директории не создаются при отсутствии файлов ---
    // Регрессия: initFiles создавал .agloom/overlays/{id}/ даже когда targetRoot не содержит файлов.
    it("не создаёт пустую overlay-директорию если targetRoot не существует", async () => {
      // Не создаём .claude/ — targetRoot отсутствует
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["init", "--agent", "claude"],
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

      // Побочный эффект: overlay-директория НЕ создана
      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      expect(fs.existsSync(overlayDir)).toBe(false);

      unmount();
    });

    // --- Bug fix: при --all пустые overlay-директории не создаются ---
    // Регрессия: initFiles создавал .agloom/overlays/{id}/ для каждого адаптера,
    // даже если targetRoot не существует (agentsmd, opencode).
    it("при --all не создаёт пустые overlay-директории для адаптеров без файлов", async () => {
      // Не создаём ни .claude/, ни .opencode/, ни .agents/
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["init", "--all"],
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

      // Побочный эффект: пустые overlay-директории НЕ созданы
      expect(
        fs.existsSync(path.join(tmpDir, ".agloom", "overlays", "claude")),
      ).toBe(false);
      expect(
        fs.existsSync(path.join(tmpDir, ".agloom", "overlays", "opencode")),
      ).toBe(false);
      expect(
        fs.existsSync(path.join(tmpDir, ".agloom", "overlays", "agentsmd")),
      ).toBe(false);

      unmount();
    });

    // --- Bug fix: пустая .agloom/instructions/ не создаётся при отсутствии project-файлов ---
    // Регрессия: backupProjectFiles создавал .agloom/instructions/ даже когда нет файлов для бэкапа.
    it("не создаёт пустую .agloom/instructions/ если project-файлов нет", async () => {
      // Создаём targetRoot для claude чтобы overlay работал
      const claudeDir = path.join(tmpDir, ".claude");
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, "file.txt"), "content");

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["init", "--agent", "claude"],
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

      // Побочный эффект: .agloom/instructions/ НЕ создана (нет project-файлов)
      const projectDir = path.join(tmpDir, ".agloom", "instructions");
      expect(fs.existsSync(projectDir)).toBe(false);

      unmount();
    });

    // --- Расширение 4b Init Overlay Files: ошибка копирования ---
    // § init-command.md § Процедура Init Overlay Files § Расширения 4b:
    // ошибка копирования → добавить сообщение в errors, продолжить.
    // Skip: chmod не работает на Windows и бесполезен под root
    it.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
      "при ошибке копирования overlay-файла добавляет сообщение в errors, продолжает с оставшимися файлами и завершается с exit code 1",
      async () => {
        // Создаём файлы в targetRoot (.claude/)
        const claudeDir = path.join(tmpDir, ".claude");
        fs.mkdirSync(claudeDir, { recursive: true });
        fs.writeFileSync(path.join(claudeDir, "ok-file.txt"), "ok content");
        fs.writeFileSync(path.join(claudeDir, "fail-file.txt"), "fail content");
        // Делаем файл нечитаемым — копирование провалится
        fs.chmodSync(path.join(claudeDir, "fail-file.txt"), 0o000);

        const { lastFrame, unmount } = render(
          React.createElement(App, {
            args: ["init", "--agent", "claude"],
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

        // § Вывод: "Initializing..."
        expect(output).toContain("Initializing...");
        // ✗ с сообщением ошибки
        expect(output).toContain("✗");
        // § Вывод (ошибки): "Done. {copiedCount} files copied."
        expect(output).toMatch(/Done\.\s+1\s+files? copied\./);
        // § Exit codes: 1
        expect(process.exitCode).toBe(1);

        // Побочный эффект: ok-file.txt скопирован
        const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
        expect(fs.existsSync(path.join(overlayDir, "ok-file.txt"))).toBe(true);

        unmount();
      },
    );

    // --- Трансформация: Процедура Init Overlay Files шаг 4 — рекурсивное копирование ---
    // § init-command.md § Процедура Init Overlay Files § Поведение шаг 4:
    // Рекурсивно скопировать все файлы, сохраняя структуру каталогов.
    it("рекурсивно копирует overlay-файлы из targetRoot с сохранением структуры каталогов", async () => {
      // Создаём вложенные файлы в targetRoot (.claude/)
      const claudeDir = path.join(tmpDir, ".claude");
      const subDir = path.join(claudeDir, "commands", "sub");
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, "root-file.txt"), "root");
      fs.writeFileSync(path.join(claudeDir, "commands", "cmd.md"), "cmd");
      fs.writeFileSync(path.join(subDir, "deep.md"), "deep");

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["init", "--agent", "claude"],
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

      // 3 файла скопированы
      expect(output).toContain("✓");
      expect(output).toMatch(/3\s+files copied/);
      // Exit code 0
      expect(process.exitCode).toBeUndefined();

      // Побочный эффект: структура каталогов сохранена в overlays/claude/
      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      expect(
        fs.readFileSync(path.join(overlayDir, "root-file.txt"), "utf-8"),
      ).toBe("root");
      expect(
        fs.readFileSync(path.join(overlayDir, "commands", "cmd.md"), "utf-8"),
      ).toBe("cmd");
      expect(
        fs.readFileSync(
          path.join(overlayDir, "commands", "sub", "deep.md"),
          "utf-8",
        ),
      ).toBe("deep");

      unmount();
    });

    // --- .agloom/ существует (даже пустая) → блокирует init без --force ---
    // Top-level check: наличие .agloom/ блокирует init без --force.
    it("при существующей пустой .agloom/ блокирует init без --force", async () => {
      // Создаём пустую .agloom/ директорию
      fs.mkdirSync(path.join(tmpDir, ".agloom"), { recursive: true });

      // Создаём файлы в targetRoot (.claude/)
      const claudeDir = path.join(tmpDir, ".claude");
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, "file.txt"), "content");

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["init", "--agent", "claude"],
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

      // .agloom/ существует → блокируется
      expect(output).toContain(".agloom/ already exists");
      expect(process.exitCode).toBe(1);

      unmount();
    });

    // =====================================================================
    // --all флаг
    // § init-command.md § Команда init § Поведение шаг 8
    // =====================================================================

    // --- Шаг 8: --all — для каждой записи реестра выполнить Init Overlay Files ---
    it("при --all инициализирует все адаптеры из реестра", async () => {
      // Создаём файлы для адаптера claude
      const claudeDir = path.join(tmpDir, ".claude");
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, "claude-file.txt"), "claude");

      // Создаём файлы для адаптера opencode
      const opencodeDir = path.join(tmpDir, ".opencode");
      fs.mkdirSync(opencodeDir, { recursive: true });
      fs.writeFileSync(path.join(opencodeDir, "opencode-file.txt"), "opencode");

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["init", "--all"],
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

      // Вывод должен содержать результаты для нескольких адаптеров
      expect(output).toContain(".agloom/overlays/claude/");
      expect(output).toContain(".agloom/overlays/opencode/");
      expect(output).toContain("Done.");
      expect(process.exitCode).toBeUndefined();

      // Побочный эффект: файлы скопированы для каждого адаптера
      expect(
        fs.existsSync(
          path.join(tmpDir, ".agloom", "overlays", "claude", "claude-file.txt"),
        ),
      ).toBe(true);
      expect(
        fs.existsSync(
          path.join(
            tmpDir,
            ".agloom",
            "overlays",
            "opencode",
            "opencode-file.txt",
          ),
        ),
      ).toBe(true);

      unmount();
    });

    // --- § Вывод: при --all адаптеры с 0 файлов не отображаются ---
    // Адаптеры без файлов для копирования не показываются в выводе.
    it("при --all не отображает строки для адаптеров с 0 скопированных файлов", async () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["init", "--all"],
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

      // Нет targetRoot → 0 файлов → строки адаптеров не отображаются, есть "Nothing to import."
      expect(output).not.toContain(".agloom/overlays/claude/");
      expect(output).not.toContain(".agloom/overlays/opencode/");
      expect(output).not.toContain(".agloom/overlays/agentsmd/");
      expect(output).toContain("Nothing to import.");
      expect(output).toContain("Done.");

      unmount();
    });

    // --- Расширение 8a (Команда init): при --all, Init Overlay Files для одной записи вернула ошибку ---
    // § init-command.md § Расширения 8a: Процедура Init Overlay Files для одной из записей
    // реестра вернула строку-сообщение → отобразить сообщение; exit code 1.
    it("при --all, если .agloom/ существует, отображает ошибку и exit code 1", async () => {
      // Создаём overlay-директорию с файлами для claude → .agloom/ существует
      const claudeOverlay = path.join(tmpDir, ".agloom", "overlays", "claude");
      fs.mkdirSync(claudeOverlay, { recursive: true });
      fs.writeFileSync(path.join(claudeOverlay, "existing.txt"), "existing");

      // Создаём файлы в targetRoot для claude
      const claudeDir = path.join(tmpDir, ".claude");
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, "file.txt"), "content");

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["init", "--all"],
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

      // Top-level check: .agloom/ already exists
      expect(output).toContain(".agloom/ already exists");
      // Exit code 1
      expect(process.exitCode).toBe(1);

      unmount();
    });

    // =====================================================================
    // Процедура Backup Project Files
    // § init-command.md § Процедура Backup Project Files
    // =====================================================================

    // --- Happy path: Backup Project Files ---
    // § init-command.md § Процедура Backup Project Files § Поведение шаги 1-11
    it("при --agent выполняет бэкап project-файлов в .agloom/instructions/ перед Init Overlay Files", async () => {
      // Создаём project-файлы в корне проекта (CLAUDE.md — в projectFiles записи claude)
      fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "Claude instructions");

      // Создаём файлы в targetRoot адаптера claude
      const claudeDir = path.join(tmpDir, ".claude");
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, "settings.json"), "{}");

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["init", "--agent", "claude"],
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

      // § Вывод: результат бэкапа project-файлов
      expect(output).toMatch(/project files backed up to \.agloom\/instructions\//);
      expect(output).toContain("Done.");
      expect(process.exitCode).toBeUndefined();

      // Побочный эффект: CLAUDE.md скопирован в .agloom/instructions/
      const backedUp = path.join(tmpDir, ".agloom", "instructions", "CLAUDE.md");
      expect(fs.existsSync(backedUp)).toBe(true);
      expect(fs.readFileSync(backedUp, "utf-8")).toBe("Claude instructions");

      unmount();
    });

    // --- Расширение 7a Backup Project Files: .agloom/instructions/ already exists ---
    // § init-command.md § Процедура Backup Project Files § Расширения 7a:
    // Целевая директория уже существует и содержит файлы, force=false →
    // ".agloom/instructions/ already exists. Use --force to overwrite."
    it('при наличии .agloom/instructions/ без --force отображает ".agloom/ already exists" и exit code 1', async () => {
      // Создаём существующие файлы в .agloom/instructions/
      const projectBackupDir = path.join(tmpDir, ".agloom", "instructions");
      fs.mkdirSync(projectBackupDir, { recursive: true });
      fs.writeFileSync(path.join(projectBackupDir, "existing.md"), "existing");

      // Создаём project-файлы
      fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "New content");

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["init", "--agent", "claude"],
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

      // Top-level check: .agloom/ существует
      expect(output).toContain(".agloom/ already exists");
      expect(process.exitCode).toBe(1);

      unmount();
    });

    // --- Расширение 7b Backup Project Files: --force перезаписывает .agloom/instructions/ ---
    // § init-command.md § Процедура Backup Project Files § Расширения 7b:
    // force=true → пропустить проверку, перезаписать существующие файлы.
    it("при --force перезаписывает существующие файлы в .agloom/instructions/", async () => {
      // Создаём существующие файлы в .agloom/instructions/
      const projectBackupDir = path.join(tmpDir, ".agloom", "instructions");
      fs.mkdirSync(projectBackupDir, { recursive: true });
      fs.writeFileSync(path.join(projectBackupDir, "CLAUDE.md"), "old backup");

      // Создаём project-файлы
      fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "New content");

      // Создаём файлы в targetRoot для overlay
      const claudeDir = path.join(tmpDir, ".claude");
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, "settings.json"), "{}");

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["init", "--agent", "claude", "--force"],
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

      // Успешный вывод, не содержит ошибку "already exists"
      expect(output).toContain("Initializing...");
      expect(output).not.toContain("already exists");
      expect(process.exitCode).toBeUndefined();

      // Побочный эффект: файл перезаписан новым содержимым
      const backedUp = fs.readFileSync(
        path.join(projectBackupDir, "CLAUDE.md"),
        "utf-8",
      );
      expect(backedUp).toBe("New content");

      unmount();
    });

    // --- .agloom/ существует → ни backup, ни overlay не выполняются ---
    // Pre-check блокирует все операции до начала работы.
    it("при наличии .agloom/ без --force не выполняет ни Backup, ни Init Overlay Files", async () => {
      // Создаём .agloom/instructions/ с файлами
      const projectBackupDir = path.join(tmpDir, ".agloom", "instructions");
      fs.mkdirSync(projectBackupDir, { recursive: true });
      fs.writeFileSync(path.join(projectBackupDir, "existing.md"), "existing");

      // Создаём файлы в targetRoot
      const claudeDir = path.join(tmpDir, ".claude");
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, "file.txt"), "content");

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["init", "--agent", "claude"],
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

      // Top-level check: .agloom/ already exists
      expect(output).toContain(".agloom/ already exists");

      // Побочный эффект: overlay-файлы НЕ скопированы
      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      expect(fs.existsSync(path.join(overlayDir, "file.txt"))).toBe(false);

      expect(process.exitCode).toBe(1);

      unmount();
    });

    // --- Расширение 10a Backup Project Files: ошибка копирования файла ---
    // § init-command.md § Процедура Backup Project Files § Расширения 10a:
    // Ошибка копирования файла → добавить в errors, продолжить с оставшимися файлами.
    // Skip: chmod не работает на Windows и бесполезен под root
    it.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
      "при ошибке копирования project-файла добавляет в errors и продолжает с оставшимися файлами",
      async () => {
        // Создаём два project-файла
        fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "Claude content");
        fs.writeFileSync(path.join(tmpDir, "CLAUDE.local.md"), "Local content");
        // Делаем один файл нечитаемым
        fs.chmodSync(path.join(tmpDir, "CLAUDE.local.md"), 0o000);

        // Создаём файлы в targetRoot для overlay
        const claudeDir = path.join(tmpDir, ".claude");
        fs.mkdirSync(claudeDir, { recursive: true });
        fs.writeFileSync(path.join(claudeDir, "settings.json"), "{}");

        const { lastFrame, unmount } = render(
          React.createElement(App, {
            args: ["init", "--agent", "claude"],
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

        // Ошибка отображается
        expect(output).toContain("✗");
        // CLAUDE.md (успешный) всё равно скопирован
        const backedUp = path.join(tmpDir, ".agloom", "instructions", "CLAUDE.md");
        expect(fs.existsSync(backedUp)).toBe(true);
        // Exit code 1 из-за errors
        expect(process.exitCode).toBe(1);

        unmount();
      },
    );

    // --- § Вывод (ошибки): "Done. {copiedCount} files copied." ---
    // § init-command.md § Вывод, вариант «ошибки»:
    // При наличии ошибок в errors: "Done. {copiedCount} files copied."
    // Skip: chmod не работает на Windows и бесполезен под root
    it.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
      'при наличии errors отображает "Done. {copiedCount} files copied."',
      async () => {
        // Создаём файлы в targetRoot (.claude/)
        const claudeDir = path.join(tmpDir, ".claude");
        fs.mkdirSync(claudeDir, { recursive: true });
        fs.writeFileSync(path.join(claudeDir, "ok-file.txt"), "ok content");
        fs.writeFileSync(path.join(claudeDir, "fail-file.txt"), "fail");
        // Делаем файл нечитаемым — копирование провалится
        fs.chmodSync(path.join(claudeDir, "fail-file.txt"), 0o000);

        const { lastFrame, unmount } = render(
          React.createElement(App, {
            args: ["init", "--agent", "claude"],
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

        // § Вывод (ошибки): "Done. {copiedCount} files copied."
        expect(output).toMatch(/Done\.\s+\d+\s+files? copied\./);

        unmount();
      },
    );

    // =====================================================================
    // § Вывод: формат начинается с "Initializing..."
    // § init-command.md § Вывод: Вывод начинается со строки "Initializing...".
    // =====================================================================

    it('вывод начинается со строки "Initializing..." при успешном выполнении', async () => {
      const claudeDir = path.join(tmpDir, ".claude");
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, "file.txt"), "content");

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["init", "--agent", "claude"],
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

      // § Вывод: "Initializing..." (не "Initializing for claude...")
      expect(output).toContain("Initializing...");

      unmount();
    });

    // =====================================================================
    // Backup Project Files: рекурсивный поиск и исключение каталогов
    // § init-command.md § Процедура Backup Project Files шаги 3-5
    // =====================================================================

    it("при бэкапе проектных файлов находит файлы рекурсивно и исключает node_modules и скрытые каталоги", async () => {
      // Создаём project-файлы: в корне и в подпапке
      fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "Root CLAUDE.md");
      const subDir = path.join(tmpDir, "packages", "core");
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(path.join(subDir, "CLAUDE.md"), "Sub CLAUDE.md");

      // Создаём CLAUDE.md в node_modules (должен быть исключён)
      const nmDir = path.join(tmpDir, "node_modules", "some-pkg");
      fs.mkdirSync(nmDir, { recursive: true });
      fs.writeFileSync(path.join(nmDir, "CLAUDE.md"), "Should be excluded");

      // Создаём CLAUDE.md в скрытом каталоге (должен быть исключён)
      const hiddenDir = path.join(tmpDir, ".hidden");
      fs.mkdirSync(hiddenDir, { recursive: true });
      fs.writeFileSync(path.join(hiddenDir, "CLAUDE.md"), "Should be excluded");

      // Создаём файлы в targetRoot для overlay
      const claudeDir = path.join(tmpDir, ".claude");
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, "settings.json"), "{}");

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["init", "--agent", "claude"],
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

      // Побочный эффект: корневой CLAUDE.md скопирован
      expect(
        fs.existsSync(path.join(tmpDir, ".agloom", "instructions", "CLAUDE.md")),
      ).toBe(true);
      // Побочный эффект: CLAUDE.md из подпапки скопирован с сохранением пути
      expect(
        fs.existsSync(
          path.join(
            tmpDir,
            ".agloom",
            "instructions",
            "packages",
            "core",
            "CLAUDE.md",
          ),
        ),
      ).toBe(true);
      // Побочный эффект: CLAUDE.md из node_modules НЕ скопирован
      expect(
        fs.existsSync(
          path.join(
            tmpDir,
            ".agloom",
            "instructions",
            "node_modules",
            "some-pkg",
            "CLAUDE.md",
          ),
        ),
      ).toBe(false);
      // Побочный эффект: CLAUDE.md из скрытого каталога НЕ скопирован
      expect(
        fs.existsSync(
          path.join(tmpDir, ".agloom", "instructions", ".hidden", "CLAUDE.md"),
        ),
      ).toBe(false);

      unmount();
    });

    // =====================================================================
    // § Справка
    // § init-command.md § Справка
    // =====================================================================

    // --- § Справка: init --help обновлена ---
    // § init-command.md § Справка: Вывод agloom init --help
    // Usage: agloom init (--agent <agentId> | --all) [--force]
    // Содержит --agent, --all, --force, --help
    it("отображает обновлённую справку с --agent и --all при вызове init --help", async () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["init", "--help"],
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

      // Обновлённая справка содержит --agent (не --adapter) и --all
      expect(output).toContain("--agent");
      expect(output).toContain("--all");
      expect(output).toContain("--force");
      expect(output).toContain("--help");

      unmount();
    });

    // --- § Справка: init в agloom --help ---
    // § init-command.md § Справка:
    // Команда init ДОЛЖНА быть добавлена в вывод agloom --help:
    // "  init         Import existing agent configs into .agloom/"
    // § cli.md § --help: описание init = "Import existing agent configs into .agloom/"
    it('содержит "init" с описанием "Import existing agent configs into .agloom/" в выводе --help', async () => {
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

      expect(output).toContain("init");
      expect(output).toContain("Import existing agent configs into .agloom/");

      unmount();
    });
  });
});
