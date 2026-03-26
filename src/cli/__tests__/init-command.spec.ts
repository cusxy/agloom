// init-command.spec.ts
// Спецификация: docs/specs/init-command.md § Команда init, § Вывод, § Exit codes, § Справка

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

    // --- Happy path: шаги 1–10 ---
    // 1. Распарсить аргументы --adapter и --force.
    // 2–3. Resolve Adapter (запись адаптера + projectRoot).
    // 4. Определить целевую директорию .agloom/overlays/<entry.id>/.
    // 5. Проверить, что целевая директория не содержит файлов.
    // 6. Создать целевую директорию и промежуточные каталоги.
    // 7. Рекурсивно скопировать файлы из <projectRoot>/<entry.targetRoot>/.
    // 8. Сформировать InitOutcome с copiedCount и errors.
    // 9. Отобразить результат (§ Вывод — успех).
    // 10. Завершить процесс с exit code 0.
    it("при успешной инициализации копирует файлы из targetRoot в overlays, отображает успех и завершается с exit code 0", async () => {
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
          args: ["init", "--adapter", "claude"],
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

      // § Вывод (успех): "Initializing for {adapterId}..."
      expect(output).toContain("Initializing for claude");
      // ✓ с количеством скопированных файлов и путём
      expect(output).toContain("✓");
      expect(output).toMatch(
        /2\s+files copied to \.agloom\/overlays\/claude\//,
      );
      // "Done."
      expect(output).toContain("Done.");
      // § Exit codes: 0 — успех
      expect(process.exitCode).toBeUndefined();

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

    // --- Расширение 1a: аргумент --adapter не указан ---
    // → отобразить сообщение об обязательности аргумента --adapter; exit code 1.
    it("завершается с exit code 1 и сообщением об обязательности --adapter, если аргумент не указан", async () => {
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

      // Сообщение указывает на обязательность --adapter
      expect(output).toMatch(/--adapter/);
      // Exit code 1
      expect(process.exitCode).toBe(1);

      unmount();
    });

    // --- Resolve Adapter расширение 1a (через Команду init): неизвестный адаптер ---
    // Шаги 2–3 ссылаются на § Процедура Resolve Adapter (adapter-registry-ext.md).
    // Расширение 1a: "Unknown adapter: {value}. Run 'agloom adapters' to see available adapters."
    // Exit code 1.
    it('отображает "Unknown adapter" и завершается с exit code 1 при неизвестном adapterId', async () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["init", "--adapter", "nonexistent"],
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

      expect(output).toContain("Unknown adapter");
      expect(output).toContain("nonexistent");
      expect(output).toContain("agloom adapters");
      expect(process.exitCode).toBe(1);

      unmount();
    });

    // --- Расширение 5a: целевая директория содержит файлы, --force не указан ---
    // → отобразить ".agloom/overlays/{entry.id}/ already exists. Use --force to overwrite.";
    // exit code 1.
    it('отображает "already exists. Use --force to overwrite." и exit code 1, если целевая директория содержит файлы без --force', async () => {
      // Создаём существующие файлы в целевой директории overlays/claude/
      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      fs.mkdirSync(overlayDir, { recursive: true });
      fs.writeFileSync(path.join(overlayDir, "existing.txt"), "existing");

      // Создаём файлы в targetRoot (.claude/)
      const claudeDir = path.join(tmpDir, ".claude");
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, "new-file.txt"), "new content");

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

      // Сообщение о необходимости --force
      expect(output).toContain(".agloom/overlays/claude/ already exists");
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

    // --- Расширение 5b: --force указан → перезаписать существующие файлы ---
    it("при --force перезаписывает существующие файлы в целевой директории", async () => {
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
          args: ["init", "--adapter", "claude", "--force"],
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
      expect(output).toContain("Initializing for claude");
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

    // --- Расширение 6a: ошибка создания директории ---
    // → отобразить сообщение об ошибке; exit code 1.
    // Skip: chmod не работает на Windows и бесполезен под root
    it.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
      "при ошибке создания целевой директории отображает сообщение об ошибке и завершается с exit code 1",
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

        // Сообщение об ошибке создания директории
        expect(output.length).toBeGreaterThan(0);
        // Exit code 1
        expect(process.exitCode).toBe(1);

        unmount();
      },
    );

    // --- Расширение 7a: targetRoot не существует ---
    // → copiedCount: 0, не является ошибкой.
    // § Вывод (отсутствие файлов): "No files found." + "Done."
    // § Exit codes: 0 — успех (включая 0 файлов).
    it('при несуществующем targetRoot отображает "No files found." и завершается с exit code 0', async () => {
      // Не создаём .claude/ — targetRoot отсутствует

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
          expect(frame!).toContain("Done.");
        },
        { timeout: 5000 },
      );

      const output = lastFrame()!;

      // § Вывод (отсутствие файлов)
      expect(output).toContain("Initializing for claude");
      expect(output).toContain("No files found.");
      expect(output).toContain("Done.");
      // § Exit codes: 0 — успех (включая 0 файлов)
      expect(process.exitCode).toBeUndefined();

      unmount();
    });

    // --- Расширение 7b: ошибка копирования ---
    // → добавить сообщение в errors, продолжить с оставшимися файлами.
    // § Вывод (ошибки): "✗ {errors[0]}" + "Done. {copiedCount} files copied."
    // § Exit codes: 1 — ошибка копирования.
    // Трансформация шага 8: copiedCount = количество успешно скопированных файлов.
    // Skip: chmod не работает на Windows и бесполезен под root
    it.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
      "при ошибке копирования добавляет сообщение в errors, продолжает с оставшимися файлами и завершается с exit code 1",
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
            args: ["init", "--adapter", "claude"],
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

        // § Вывод (ошибки): заголовок
        expect(output).toContain("Initializing for claude");
        // ✗ с сообщением ошибки
        expect(output).toContain("✗");
        // "Done. {copiedCount} files copied." — copiedCount = 1 (только ok-file.txt)
        expect(output).toMatch(/Done\.\s+1\s+files? copied\./);
        // § Exit codes: 1
        expect(process.exitCode).toBe(1);

        // Побочный эффект: ok-file.txt скопирован
        const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
        expect(fs.existsSync(path.join(overlayDir, "ok-file.txt"))).toBe(true);

        unmount();
      },
    );

    // --- Трансформация: шаг 7 — рекурсивное копирование с сохранением структуры ---
    // Файлы из вложенных подкаталогов targetRoot воспроизводятся в overlays
    // с сохранением структуры каталогов.
    it("рекурсивно копирует файлы из targetRoot с сохранением структуры каталогов", async () => {
      // Создаём вложенные файлы в targetRoot (.claude/)
      const claudeDir = path.join(tmpDir, ".claude");
      const subDir = path.join(claudeDir, "commands", "sub");
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, "root-file.txt"), "root");
      fs.writeFileSync(path.join(claudeDir, "commands", "cmd.md"), "cmd");
      fs.writeFileSync(path.join(subDir, "deep.md"), "deep");

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

    // --- Шаг 5: пустая целевая директория не блокирует инициализацию ---
    // Целевая директория существует, но не содержит файлов →
    // шаг 5 проходит, процесс продолжается к шагу 6 и далее.
    it("при существующей пустой целевой директории продолжает копирование без ошибки", async () => {
      // Создаём пустую целевую директорию
      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      fs.mkdirSync(overlayDir, { recursive: true });

      // Создаём файлы в targetRoot (.claude/)
      const claudeDir = path.join(tmpDir, ".claude");
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, "file.txt"), "content");

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
          expect(frame!).toContain("Done.");
        },
        { timeout: 5000 },
      );

      const output = lastFrame()!;

      // Успешный вывод — пустая директория не блокирует
      expect(output).toContain("Initializing for claude");
      expect(output).toContain("✓");
      expect(output).not.toContain("already exists");
      // Exit code 0
      expect(process.exitCode).toBeUndefined();

      // Побочный эффект: файл скопирован
      expect(fs.existsSync(path.join(overlayDir, "file.txt"))).toBe(true);

      unmount();
    });

    // --- § Справка: init --help ---
    // Команда ДОЛЖНА поддерживать agloom init --help.
    // Вывод содержит Usage, --adapter, --force, --help.
    it("отображает справку при вызове init --help", async () => {
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

      // § Справка init --help: Usage, --adapter, --force, --help
      expect(output).toContain("agloom init");
      expect(output).toContain("--adapter");
      expect(output).toContain("--force");
      expect(output).toContain("--help");

      unmount();
    });

    // --- § Справка: init в agloom --help ---
    // Команда init ДОЛЖНА быть добавлена в вывод agloom --help:
    // "  init         Import existing agent configs into .agloom/overlays/"
    it('содержит "init" с описанием "Import existing agent configs into .agloom/overlays/" в выводе --help', async () => {
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
      expect(output).toContain(
        "Import existing agent configs into .agloom/overlays/",
      );

      unmount();
    });
  });
});
