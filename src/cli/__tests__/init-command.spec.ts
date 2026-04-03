// init-command.spec.ts
// Спецификация: docs/specs/init-command.md § Команда init, § Процедура Init Overlay Files,
//               § Вывод, § Exit codes, § Справка
// Спецификация: docs/specs/adapter-registry-ext.md § Обновление реестра адаптеров

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
    // Happy path: Команда init --adapter
    // § init-command.md § Команда init § Поведение шаги 1-8
    // 1. Распарсить аргументы --adapter, --all, --force и --verbose.
    // 2. Определить projectRoot как process.cwd().
    // 3. Выполнить Resolve Adapters from CLI Args.
    // 4. Проверить наличие .agloom/.
    // 5. Создать .agloom/config.yml.
    // 6. Init Overlay Files для каждой записи.
    // 7. Отобразить результат (§ Вывод).
    // 8. Завершить процесс с exit code.
    // =====================================================================

    it("при успешной инициализации --adapter выполняет Init Overlay Files, отображает успех и завершается с exit code 0", async () => {
      // Создаём project-файлы (CLAUDE.md — в overlayImportPaths записи claude через glob **/CLAUDE.md)
      fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "Claude instructions");

      // Создаём файлы в .claude/ (в overlayImportPaths записи claude)
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

      // § Вывод: "Initializing..."
      expect(output).toContain("Initializing...");
      // § Вывод: НЕТ строки бэкапа project-файлов (процедура Backup Project Files удалена)
      expect(output).not.toContain("project files backed up");
      expect(output).not.toContain(".agloom/instructions/");
      // § Вывод (успех): результат overlay (2 files from .claude/ + 1 CLAUDE.md via glob = 3)
      expect(output).toContain("\u2713");
      expect(output).toMatch(
        /3\s+files copied to \.agloom\/overlays\/claude\//,
      );
      // "Done."
      expect(output).toContain("Done.");
      // § Exit codes: 0 — успех
      expect(process.exitCode).toBeUndefined();

      // Побочный эффект: .agloom/instructions/ НЕ создана (процедура удалена)
      const backedUp = path.join(tmpDir, ".agloom", "instructions");
      expect(fs.existsSync(backedUp)).toBe(false);

      // Побочный эффект: файлы скопированы в .agloom/overlays/claude/
      // с сохранением позиции относительно project root
      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      const overlaySettings = fs.readFileSync(
        path.join(overlayDir, ".claude", "settings.json"),
        "utf-8",
      );
      expect(overlaySettings).toBe('{"key": "value"}');
      const overlayConfig = fs.readFileSync(
        path.join(overlayDir, ".claude", "config.txt"),
        "utf-8",
      );
      expect(overlayConfig).toBe("config content");
      // CLAUDE.md скопирован в overlay через glob **/CLAUDE.md
      const overlayClaude = fs.readFileSync(
        path.join(overlayDir, "CLAUDE.md"),
        "utf-8",
      );
      expect(overlayClaude).toBe("Claude instructions");

      unmount();
    });

    // =====================================================================
    // § init-command.md § Процедура Init Overlay Files § Поведение шаг 4
    // Glob-паттерны в overlayImportPaths
    // § adapter-registry-ext.md § Расширение AdapterRegistryEntry
    // overlayImportPaths: glob-паттерны резолвятся через fast-glob
    // с параметрами cwd: projectRoot, dot: false, ignore: ["**/node_modules/**"]
    // =====================================================================

    it("при glob-паттерне **/CLAUDE.md в overlayImportPaths находит файлы рекурсивно и исключает node_modules и скрытые каталоги", async () => {
      // Создаём CLAUDE.md в корне
      fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "Root CLAUDE.md");
      // Создаём CLAUDE.md в подпапке
      const subDir = path.join(tmpDir, "packages", "core");
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(path.join(subDir, "CLAUDE.md"), "Sub CLAUDE.md");

      // Создаём CLAUDE.md в node_modules (должен быть исключён, ignore: ["**/node_modules/**"])
      const nmDir = path.join(tmpDir, "node_modules", "some-pkg");
      fs.mkdirSync(nmDir, { recursive: true });
      fs.writeFileSync(path.join(nmDir, "CLAUDE.md"), "Should be excluded");

      // Создаём CLAUDE.md в скрытом каталоге (должен быть исключён, dot: false)
      const hiddenDir = path.join(tmpDir, ".hidden");
      fs.mkdirSync(hiddenDir, { recursive: true });
      fs.writeFileSync(path.join(hiddenDir, "CLAUDE.md"), "Should be excluded");

      // Создаём .claude/ для директорийного overlayImportPath
      const claudeDir = path.join(tmpDir, ".claude");
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, "settings.json"), "{}");

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

      lastFrame()!;
      expect(process.exitCode).toBeUndefined();

      // Побочный эффект: корневой CLAUDE.md скопирован через glob **/CLAUDE.md
      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      expect(fs.existsSync(path.join(overlayDir, "CLAUDE.md"))).toBe(true);
      expect(fs.readFileSync(path.join(overlayDir, "CLAUDE.md"), "utf-8")).toBe(
        "Root CLAUDE.md",
      );

      // Побочный эффект: CLAUDE.md из подпапки скопирован с сохранением пути
      expect(
        fs.existsSync(path.join(overlayDir, "packages", "core", "CLAUDE.md")),
      ).toBe(true);
      expect(
        fs.readFileSync(
          path.join(overlayDir, "packages", "core", "CLAUDE.md"),
          "utf-8",
        ),
      ).toBe("Sub CLAUDE.md");

      // Побочный эффект: CLAUDE.md из node_modules НЕ скопирован
      expect(
        fs.existsSync(
          path.join(overlayDir, "node_modules", "some-pkg", "CLAUDE.md"),
        ),
      ).toBe(false);

      // Побочный эффект: CLAUDE.md из скрытого каталога НЕ скопирован (dot: false)
      expect(fs.existsSync(path.join(overlayDir, ".hidden", "CLAUDE.md"))).toBe(
        false,
      );

      unmount();
    });

    // =====================================================================
    // § adapter-registry-ext.md § Обновление реестра адаптеров
    // Расширение 4c Init Overlay Files: ошибка fast-glob
    // § init-command.md § Расширения 4c:
    // Ошибка выполнения fast-glob (I/O-ошибка) → добавить в errors,
    // продолжить с оставшимися путями из overlayImportPaths.
    // =====================================================================

    // Тест на расширение 4c: ошибку fast-glob сложно вызвать напрямую
    // в интеграционном тесте, проверяется на уровне unit-тестов initFiles.

    // =====================================================================
    // § adapter-registry-ext.md § Обновление реестра адаптеров
    // agentsmd.overlayImportPaths = [".agents", "**/AGENTS.md", "**/AGENTS.override.md"]
    // =====================================================================

    it("при --all для agentsmd резолвит glob-паттерны **/AGENTS.md и **/AGENTS.override.md", async () => {
      // Создаём AGENTS.md и AGENTS.override.md в корне
      fs.writeFileSync(path.join(tmpDir, "AGENTS.md"), "Root AGENTS.md");
      fs.writeFileSync(
        path.join(tmpDir, "AGENTS.override.md"),
        "Root AGENTS.override.md",
      );

      // Создаём AGENTS.md в подпапке
      const subDir = path.join(tmpDir, "packages", "core");
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(path.join(subDir, "AGENTS.md"), "Sub AGENTS.md");

      // Создаём .agents/ для директорийного overlayImportPath
      const agentsDir = path.join(tmpDir, ".agents");
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.writeFileSync(path.join(agentsDir, "config.json"), "{}");

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

      expect(process.exitCode).toBeUndefined();

      // Побочный эффект: agentsmd overlay содержит файлы из glob
      const agentsOverlay = path.join(
        tmpDir,
        ".agloom",
        "overlays",
        "agentsmd",
      );
      expect(fs.existsSync(path.join(agentsOverlay, "AGENTS.md"))).toBe(true);
      expect(
        fs.existsSync(path.join(agentsOverlay, "AGENTS.override.md")),
      ).toBe(true);
      expect(
        fs.existsSync(
          path.join(agentsOverlay, "packages", "core", "AGENTS.md"),
        ),
      ).toBe(true);
      // .agents/ директория тоже скопирована
      expect(
        fs.existsSync(path.join(agentsOverlay, ".agents", "config.json")),
      ).toBe(true);

      unmount();
    });

    // =====================================================================
    // § adapter-registry-ext.md § Обновление реестра адаптеров
    // claude.projectFiles = ["CLAUDE.md"] (CLAUDE.local.md убран)
    // =====================================================================

    it("запись claude в реестре НЕ содержит CLAUDE.local.md в projectFiles", async () => {
      // Импортируем реестр для прямой проверки
      const { adapterRegistry } = await import("../adapter-registry.js");
      const claudeEntry = adapterRegistry.find((e) => e.id === "claude");
      expect(claudeEntry).toBeDefined();
      expect(claudeEntry!.projectFiles).toEqual(["CLAUDE.md"]);
      expect(claudeEntry!.projectFiles).not.toContain("CLAUDE.local.md");
    });

    // =====================================================================
    // § adapter-registry-ext.md § Обновление реестра адаптеров
    // agentsmd.projectFiles = ["AGENTS.md", "AGENTS.override.md"]
    // =====================================================================

    it("запись agentsmd в реестре содержит AGENTS.override.md в projectFiles", async () => {
      const { adapterRegistry } = await import("../adapter-registry.js");
      const agentsmdEntry = adapterRegistry.find((e) => e.id === "agentsmd");
      expect(agentsmdEntry).toBeDefined();
      expect(agentsmdEntry!.projectFiles).toEqual([
        "AGENTS.md",
        "AGENTS.override.md",
      ]);
    });

    // =====================================================================
    // § adapter-registry-ext.md § Обновление реестра адаптеров
    // claude.overlayImportPaths = [".claude", "**/CLAUDE.md"]
    // =====================================================================

    it("запись claude в реестре содержит glob-паттерн **/CLAUDE.md в overlayImportPaths", async () => {
      const { adapterRegistry } = await import("../adapter-registry.js");
      const claudeEntry = adapterRegistry.find((e) => e.id === "claude");
      expect(claudeEntry).toBeDefined();
      expect(claudeEntry!.overlayImportPaths).toEqual([
        ".claude",
        "**/CLAUDE.md",
      ]);
    });

    // =====================================================================
    // § adapter-registry-ext.md § Обновление реестра адаптеров
    // agentsmd.overlayImportPaths = [".agents", "**/AGENTS.md", "**/AGENTS.override.md"]
    // =====================================================================

    it("запись agentsmd в реестре содержит glob-паттерны в overlayImportPaths", async () => {
      const { adapterRegistry } = await import("../adapter-registry.js");
      const agentsmdEntry = adapterRegistry.find((e) => e.id === "agentsmd");
      expect(agentsmdEntry).toBeDefined();
      expect(agentsmdEntry!.overlayImportPaths).toEqual([
        ".agents",
        "**/AGENTS.md",
        "**/AGENTS.override.md",
      ]);
    });

    // =====================================================================
    // Расширение 3a (Команда init): --adapter и --all указаны одновременно
    // § init-command.md § Расширения 3a (Resolve Adapters from CLI Args)
    // =====================================================================

    it('отображает "--adapter and --all are mutually exclusive." и exit code 1, если оба указаны одновременно', async () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["init", "--adapter", "claude", "--all"],
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

      expect(output).toContain("--adapter and --all are mutually exclusive");
      expect(process.exitCode).toBe(1);

      unmount();
    });

    // =====================================================================
    // Расширение 3a (Команда init): Resolve Adapters from CLI Args вернул ошибку
    // § init-command.md § Расширения 3a
    // =====================================================================

    it('при неизвестном --adapter отображает "Unknown agent" и завершается с exit code 1', async () => {
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

      expect(output).toContain("Unknown agent");
      expect(output).toContain("nonexistent");
      expect(output).toContain("agloom adapters");
      expect(process.exitCode).toBe(1);

      unmount();
    });

    // =====================================================================
    // Расширение 4a (Команда init): .agloom/ уже существует, --force не указан
    // § init-command.md § Расширения 4a
    // =====================================================================

    it('отображает ".agloom/ already exists" и exit code 1, если .agloom/ существует без --force', async () => {
      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      fs.mkdirSync(overlayDir, { recursive: true });
      fs.writeFileSync(path.join(overlayDir, "existing.txt"), "existing");

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

      expect(output).toContain(".agloom/ already exists");
      expect(output).toContain("--force");
      expect(process.exitCode).toBe(1);

      // Побочный эффект: существующие файлы не изменены
      const existing = fs.readFileSync(
        path.join(overlayDir, "existing.txt"),
        "utf-8",
      );
      expect(existing).toBe("existing");

      unmount();
    });

    // =====================================================================
    // Расширение 4b (Команда init): --force указан
    // § init-command.md § Расширения 4b
    // =====================================================================

    it("при --force пропускает проверку .agloom/ и продолжает с шага 5", async () => {
      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      const overlayClaudeDir = path.join(overlayDir, ".claude");
      fs.mkdirSync(overlayClaudeDir, { recursive: true });
      fs.writeFileSync(
        path.join(overlayClaudeDir, "settings.json"),
        '{"old": true}',
      );

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

      expect(output).toContain("Initializing...");
      expect(output).toContain("\u2713");
      expect(output).not.toContain("already exists");
      expect(process.exitCode).toBeUndefined();

      // Побочный эффект: файл перезаписан новым содержимым
      const settings = fs.readFileSync(
        path.join(overlayClaudeDir, "settings.json"),
        "utf-8",
      );
      expect(settings).toBe('{"new": true}');

      unmount();
    });

    // =====================================================================
    // Процедура Init Overlay Files
    // § init-command.md § Процедура Init Overlay Files
    // =====================================================================

    // --- Расширение 2a: целевая директория overlay содержит файлы, force=false ---
    // (Тестируется через расширение 4a Команды init — .agloom/ уже существует)

    // --- Расширение 3a Init Overlay Files: ошибка создания директории ---
    // § init-command.md § Процедура Init Overlay Files § Расширения 3a
    // Skip: chmod не работает на Windows и бесполезен под root
    it.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
      "при ошибке создания overlay-директории отображает сообщение об ошибке и завершается с exit code 1",
      async () => {
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

        expect(output.length).toBeGreaterThan(0);
        expect(process.exitCode).toBe(1);

        unmount();
      },
    );

    // --- Расширение 4a Init Overlay Files: все пути не существуют и glob не нашёл файлов ---
    // § init-command.md § Процедура Init Overlay Files § Расширения 4a
    it("при несуществующих overlayImportPaths и пустых glob-результатах отображает Nothing to import и exit code 0", async () => {
      // Не создаём ни .claude/, ни CLAUDE.md — все overlayImportPaths пустые

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

      // 0 files — "Nothing to import."
      expect(output).not.toContain("Initializing...");
      expect(output).toContain("Nothing to import.");
      expect(output).toMatch(/Done\.\s+0\s+files copied\./);
      expect(process.exitCode).toBeUndefined();

      unmount();
    });

    // --- Пустые overlay-директории не создаются при отсутствии файлов ---
    it("не создаёт пустую overlay-директорию если overlayImportPaths не содержат файлов", async () => {
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

      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      expect(fs.existsSync(overlayDir)).toBe(false);

      unmount();
    });

    // --- При --all пустые overlay-директории не создаются ---
    it("при --all не создаёт пустые overlay-директории для адаптеров без файлов", async () => {
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

    // --- Расширение 4b Init Overlay Files: ошибка копирования ---
    // § init-command.md § Процедура Init Overlay Files § Расширения 4b
    // Skip: chmod не работает на Windows и бесполезен под root
    it.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
      "при ошибке копирования overlay-файла добавляет сообщение в errors, продолжает с оставшимися файлами и завершается с exit code 1",
      async () => {
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

        expect(output).toContain("Initializing...");
        expect(output).toContain("\u2717");
        expect(output).toMatch(/Done\.\s+1\s+files? copied\./);
        expect(process.exitCode).toBe(1);

        // Побочный эффект: ok-file.txt скопирован
        const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
        expect(
          fs.existsSync(path.join(overlayDir, ".claude", "ok-file.txt")),
        ).toBe(true);

        unmount();
      },
    );

    // --- Трансформация: рекурсивное копирование из директорийного overlayImportPath ---
    // § init-command.md § Процедура Init Overlay Files § Поведение шаг 4
    it("рекурсивно копирует overlay-файлы из директорийного overlayImportPath с сохранением структуры каталогов", async () => {
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

      expect(output).toContain("\u2713");
      expect(output).toMatch(/3\s+files copied/);
      expect(process.exitCode).toBeUndefined();

      // Побочный эффект: структура каталогов сохранена
      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      expect(
        fs.readFileSync(
          path.join(overlayDir, ".claude", "root-file.txt"),
          "utf-8",
        ),
      ).toBe("root");
      expect(
        fs.readFileSync(
          path.join(overlayDir, ".claude", "commands", "cmd.md"),
          "utf-8",
        ),
      ).toBe("cmd");
      expect(
        fs.readFileSync(
          path.join(overlayDir, ".claude", "commands", "sub", "deep.md"),
          "utf-8",
        ),
      ).toBe("deep");

      unmount();
    });

    // --- .agloom/ существует (даже пустая) → блокирует init без --force ---
    it("при существующей пустой .agloom/ блокирует init без --force", async () => {
      fs.mkdirSync(path.join(tmpDir, ".agloom"), { recursive: true });

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
          expect(frame!.length).toBeGreaterThan(0);
        },
        { timeout: 5000 },
      );

      const output = lastFrame()!;

      expect(output).toContain(".agloom/ already exists");
      expect(process.exitCode).toBe(1);

      unmount();
    });

    // =====================================================================
    // --all флаг
    // § init-command.md § Команда init § Поведение шаг 6
    // =====================================================================

    it("при --all инициализирует все адаптеры из реестра", async () => {
      const claudeDir = path.join(tmpDir, ".claude");
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, "claude-file.txt"), "claude");

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

      expect(output).toContain(".agloom/overlays/claude/");
      expect(output).toContain(".agloom/overlays/opencode/");
      // § Вывод: НЕТ строки бэкапа project-файлов
      expect(output).not.toContain("project files backed up");
      expect(output).not.toContain(".agloom/instructions/");
      expect(output).toContain("Done.");
      expect(process.exitCode).toBeUndefined();

      // Побочный эффект: файлы скопированы
      expect(
        fs.existsSync(
          path.join(
            tmpDir,
            ".agloom",
            "overlays",
            "claude",
            ".claude",
            "claude-file.txt",
          ),
        ),
      ).toBe(true);
      expect(
        fs.existsSync(
          path.join(
            tmpDir,
            ".agloom",
            "overlays",
            "opencode",
            ".opencode",
            "opencode-file.txt",
          ),
        ),
      ).toBe(true);

      unmount();
    });

    // --- § Вывод: при --all адаптеры с 0 файлов не отображаются ---
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

      expect(output).not.toContain(".agloom/overlays/claude/");
      expect(output).not.toContain(".agloom/overlays/opencode/");
      expect(output).not.toContain(".agloom/overlays/agentsmd/");
      expect(output).toContain("Nothing to import.");
      expect(output).toContain("Done.");

      unmount();
    });

    // --- При --all, .agloom/ существует → ошибка ---
    it("при --all, если .agloom/ существует без --force, отображает ошибку и exit code 1", async () => {
      const claudeOverlay = path.join(tmpDir, ".agloom", "overlays", "claude");
      fs.mkdirSync(claudeOverlay, { recursive: true });
      fs.writeFileSync(path.join(claudeOverlay, "existing.txt"), "existing");

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

      expect(output).toContain(".agloom/ already exists");
      expect(process.exitCode).toBe(1);

      unmount();
    });

    // =====================================================================
    // § Вывод: TUI — нет строки backup, только per-adapter overlay строки
    // § init-command.md § Вывод
    // =====================================================================

    it("TUI не отображает строку backup project files", async () => {
      fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "Claude instructions");
      const claudeDir = path.join(tmpDir, ".claude");
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, "settings.json"), "{}");

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

      // Строка backup отсутствует в TUI
      expect(output).not.toContain("project files backed up");
      expect(output).not.toContain(".agloom/instructions/");
      // Только строки overlay
      expect(output).toContain("files copied to .agloom/overlays/claude/");

      unmount();
    });

    // =====================================================================
    // .agloom/ уже существует → ни overlay не выполняется
    // =====================================================================

    it("при наличии .agloom/ без --force не выполняет Init Overlay Files", async () => {
      fs.mkdirSync(path.join(tmpDir, ".agloom"), { recursive: true });

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
          expect(frame!.length).toBeGreaterThan(0);
        },
        { timeout: 5000 },
      );

      const output = lastFrame()!;

      expect(output).toContain(".agloom/ already exists");

      // Побочный эффект: overlay-файлы НЕ скопированы
      const overlayDir = path.join(tmpDir, ".agloom", "overlays", "claude");
      expect(fs.existsSync(path.join(overlayDir, ".claude", "file.txt"))).toBe(
        false,
      );

      expect(process.exitCode).toBe(1);

      unmount();
    });

    // =====================================================================
    // § init-command.md § Вывод: "Done. {copiedCount} files copied."
    // Skip: chmod не работает на Windows и бесполезен под root
    // =====================================================================

    it.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
      'при наличии errors отображает "Done. {copiedCount} files copied."',
      async () => {
        const claudeDir = path.join(tmpDir, ".claude");
        fs.mkdirSync(claudeDir, { recursive: true });
        fs.writeFileSync(path.join(claudeDir, "ok-file.txt"), "ok content");
        fs.writeFileSync(path.join(claudeDir, "fail-file.txt"), "fail");
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

        expect(output).toMatch(/Done\.\s+\d+\s+files? copied\./);

        unmount();
      },
    );

    // =====================================================================
    // § Вывод: формат начинается с "Initializing..."
    // =====================================================================

    it('вывод начинается со строки "Initializing..." при успешном выполнении', async () => {
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

      expect(output).toContain("Initializing...");

      unmount();
    });

    // =====================================================================
    // § Справка
    // § init-command.md § Справка
    // =====================================================================

    it("отображает обновлённую справку с --adapter и --all при вызове init --help", async () => {
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

      expect(output).toContain("--adapter");
      expect(output).toContain("--all");
      expect(output).toContain("--force");
      expect(output).toContain("--verbose");

      unmount();
    });

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

    // =====================================================================
    // § init-command.md § Вывод § Фильтрация по --verbose
    // =====================================================================

    it("при --all с --verbose отображает все адаптеры, включая строки с 0 скопированных файлов", async () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["init", "--all", "--verbose"],
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

      // С --verbose заголовок "Initializing..." отображается
      expect(output).toContain("Initializing...");
      // НЕТ строки бэкапа project-файлов (процедура удалена)
      expect(output).not.toContain("project files backed up");
      expect(output).not.toContain(".agloom/instructions/");
      // Все overlay-строки отображаются с 0 файлов
      expect(output).toContain(".agloom/overlays/claude/");
      expect(output).toContain(".agloom/overlays/opencode/");
      expect(output).toContain(".agloom/overlays/agentsmd/");
      expect(output).toMatch(/Done\.\s+0\s+files copied\./);

      unmount();
    });

    it("при --adapter с --verbose отображает результат даже при 0 скопированных файлов", async () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["init", "--adapter", "claude", "--verbose"],
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

      // С --verbose заголовок "Initializing..." отображается
      expect(output).toContain("Initializing...");
      // Строка overlay с 0 файлов отображается
      expect(output).toContain(".agloom/overlays/claude/");
      // НЕТ строки бэкапа project-файлов
      expect(output).not.toContain("project files backed up");
      expect(output).not.toContain(".agloom/instructions/");
      expect(output).toMatch(/Done\.\s+0\s+files copied\./);

      unmount();
    });

    // --- Точное сообщение об ошибке ---
    it('при наличии .agloom/ без --force отображает точное сообщение ".agloom/ already exists. Use --force to reinitialize."', async () => {
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

      expect(output).toContain(
        ".agloom/ already exists. Use --force to reinitialize.",
      );
      expect(process.exitCode).toBe(1);

      unmount();
    });

    // =====================================================================
    // § init-command.md § Создание конфигурационного файла
    // § config.md § Формат файла
    // =====================================================================

    it("при --adapter claude создаёт .agloom/config.yml с adapters: [claude]", async () => {
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

      const configPath = path.join(tmpDir, ".agloom", "config.yml");
      expect(fs.existsSync(configPath)).toBe(true);

      const content = fs.readFileSync(configPath, "utf-8");
      expect(content).toMatch(/adapters:/);
      expect(content).toMatch(/- claude/);
      expect(content).not.toMatch(/- opencode/);
      expect(content).not.toMatch(/- agentsmd/);

      unmount();
    });

    it("при --all создаёт .agloom/config.yml с adapters содержащими все нескрытые адаптеры", async () => {
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

      const configPath = path.join(tmpDir, ".agloom", "config.yml");
      expect(fs.existsSync(configPath)).toBe(true);

      const content = fs.readFileSync(configPath, "utf-8");
      expect(content).toMatch(/- claude/);
      expect(content).toMatch(/- opencode/);
      // НЕ содержит скрытый адаптер agentsmd
      expect(content).not.toMatch(/- agentsmd/);

      unmount();
    });

    it("при --force перезаписывает существующий .agloom/config.yml новым списком адаптеров", async () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(configDir, "config.yml"),
        "adapters:\n  - opencode\n",
      );

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

      const configPath = path.join(tmpDir, ".agloom", "config.yml");
      const content = fs.readFileSync(configPath, "utf-8");
      expect(content).toMatch(/- claude/);
      expect(content).not.toMatch(/- opencode/);

      unmount();
    });

    it("созданный config.yml содержит комментарии для onboarding", async () => {
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

      const configPath = path.join(tmpDir, ".agloom", "config.yml");
      const content = fs.readFileSync(configPath, "utf-8");

      expect(content).toContain("# Agloom configuration");

      unmount();
    });

    // =====================================================================
    // § config.md § Процедура Resolve Adapters from CLI Args
    // init без аргументов: fallback на конфигурационный файл
    // =====================================================================

    it("при отсутствии --adapter и --all с существующим конфигом использует конфиг и НЕ модифицирует config.yml", async () => {
      const configDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(configDir, "config.yml"),
        "adapters:\n  - claude\n",
      );

      const claudeDir = path.join(tmpDir, ".claude");
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, "file.txt"), "content");

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["init", "--force"],
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

      expect(output).toContain("Done.");
      expect(process.exitCode).toBeUndefined();

      // config.yml НЕ модифицирован
      const configContent = fs.readFileSync(
        path.join(configDir, "config.yml"),
        "utf-8",
      );
      expect(configContent).toBe("adapters:\n  - claude\n");

      unmount();
    });

    it('при отсутствии --adapter, --all и конфига отображает "No config found" без упоминания agloom init', async () => {
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

      expect(output).toContain("No config found");
      expect(output).not.toContain("run 'agloom init'");
      expect(process.exitCode).toBe(1);

      unmount();
    });

    // =====================================================================
    // Граничное условие: glob-паттерн без совпадений
    // § init-command.md § Процедура Init Overlay Files § Поведение шаг 4
    // § Расширения 4a: все пути не существуют и glob не нашёл файлов → copiedCount: 0
    // =====================================================================

    it("при glob-паттерне без совпадений и пустом директорийном пути возвращает copiedCount: 0", async () => {
      // .claude/ существует но пуста, **/CLAUDE.md не найдёт файлов
      const claudeDir = path.join(tmpDir, ".claude");
      fs.mkdirSync(claudeDir, { recursive: true });
      // Не создаём файлов ни в .claude/, ни CLAUDE.md в корне

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

      expect(output).toContain("Nothing to import.");
      expect(output).toMatch(/Done\.\s+0\s+files copied\./);
      expect(process.exitCode).toBeUndefined();

      unmount();
    });

    // =====================================================================
    // Граничное условие: overlayImportPaths — файл как литеральный путь
    // § init-command.md § Процедура Init Overlay Files § Поведение шаг 4:
    // "Если путь — файл: скопировать в <целевая директория>/<путь>."
    // "Если путь не существует (и не является glob-паттерном): пропустить без ошибки."
    // =====================================================================

    it("при несуществующем литеральном пути в overlayImportPaths пропускает без ошибки", async () => {
      // overlayImportPaths для opencode: [".opencode"]
      // .opencode/ не существует — должен быть пропущен без ошибки
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["init", "--adapter", "opencode"],
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

      expect(output).toContain("Nothing to import.");
      expect(output).toMatch(/Done\.\s+0\s+files copied\./);
      expect(process.exitCode).toBeUndefined();

      unmount();
    });
  });
});
