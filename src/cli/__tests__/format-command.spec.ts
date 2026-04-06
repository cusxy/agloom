// format-command.spec.ts
// Спецификация: docs/specs/format.md § Команда format, § Расширение --help

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { App } from "../app.js";

describe("CLI", () => {
  describe("Команда format", () => {
    let originalExitCode: number | undefined;

    beforeEach(() => {
      originalExitCode = process.exitCode;
    });

    afterEach(() => {
      process.exitCode = originalExitCode;
    });

    // --- § Аргументы: <file|glob>... (variadic) ---
    // Spec: format.md § Команда format, аргумент <file|glob>...:
    // "Все позиционные аргументы после format собираются в массив."
    // Текущая реализация parseArgs сохраняет только один glob (string | null).
    // Тест проверяет, что FormatView получает массив из нескольких аргументов.

    // --- § Расширение --help ---
    // Spec: format.md § Расширение --help:
    // Usage: agloom format [--check] [--all] [<file|glob>...]
    // Options должны включать --all
    it("format --help отображает usage с --all и <file|glob>...", () => {
      const { lastFrame, unmount } = render(React.createElement(App, { args: ["format", "--help"] }));

      const output = lastFrame()!;

      // Spec: "Usage: agloom format [--check] [--all] [<file|glob>...]"
      expect(output).toContain("--all");
      expect(output).toContain("--check");

      // Spec: Options должны содержать описание --all
      expect(output).toContain("Format all supported files in the project");

      // Exit code 0
      expect(process.exitCode).toBeUndefined();

      unmount();
    });

    // --- § Расширение 1a: --all и <file|glob>... взаимоисключающие ---
    // Spec: format.md § Расширения, 1a:
    // "Указаны одновременно --all и <file|glob>... -> отобразить
    // "Cannot use --all with file arguments."; exit code 1."
    it("при указании --all и файловых аргументов одновременно отображает ошибку и exit code 1", () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["format", "--all", "src/**/*.md"],
        }),
      );

      const output = lastFrame()!;

      expect(output).toContain("Cannot use --all with file arguments.");
      expect(process.exitCode).toBe(1);

      unmount();
    });

    // --- § Аргументы: --all ---
    // Spec: format.md § Команда format, шаг 3:
    // "Если указан --all — массив ["**/*.{md,mdx,json,yaml,yml,toml}"]"
    // Тест проверяет, что FormatView принимает и обрабатывает флаг --all.
    // Без реальной файловой системы ожидаем "No files found." (расширение 4a).
    it("format --all без файлов отображает 'No files found.'", async () => {
      // projectRoot указывает на несуществующую директорию —
      // glob не найдёт файлы.
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["format", "--all"],
          projectRoot: "/tmp/agloom-test-nonexistent-dir",
        }),
      );

      // FormatView асинхронный — ждём завершения
      await new Promise((resolve) => setTimeout(resolve, 500));

      const output = lastFrame()!;
      expect(output).toContain("No files found.");

      unmount();
    });

    // --- § Аргументы: множественные позиционные аргументы ---
    // Spec: format.md § Команда format, аргумент <file|glob>...:
    // "один или несколько glob-паттернов или путей к файлам.
    //  Все позиционные аргументы после format собираются в массив."
    // Текущая реализация parseArgs сохраняет только последний glob.
    // Этот тест проверяет, что ВСЕ позиционные аргументы корректно
    // обрабатываются: не вызывают ошибок "Unknown command" и не игнорируются.
    it("format с несколькими позиционными аргументами не отображает ошибку неизвестной команды", async () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["format", "*.md", "*.yaml", "*.json"],
          projectRoot: "/tmp/agloom-test-nonexistent-dir",
        }),
      );

      // FormatView асинхронный — ждём завершения
      await new Promise((resolve) => setTimeout(resolve, 500));

      const output = lastFrame()!;
      // Все позиционные аргументы должны быть собраны как glob-паттерны,
      // а не отклонены как неизвестные команды
      expect(output).not.toContain("Unknown command");
      expect(output).toContain("No files found.");

      unmount();
    });

    // =====================================================================
    // § format.md § TUI-отображение § Режим format — non-fixable failures
    // § format.md § Exit codes (C4, C5)
    // =====================================================================
    describe("режим format — отображение non-fixable failures", () => {
      let tmpDir: string;

      beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-format-cli-"));
        process.exitCode = undefined;
      });

      afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      });

      // § TUI-отображение § Режим format:
      // При наличии non-fixable failures:
      // "✗ Formatted {N} files, but {M} files still need attention:"
      // § Exit codes: exit code 1 при непустом failures.
      it("при файле с non-fixable violations показывает 'files still need attention' и exit code 1", async () => {
        // Создаём .agloom/ структуру и файл с двумя H1 (MD025 — non-fixable).
        const agloomDir = path.join(tmpDir, ".agloom");
        fs.mkdirSync(agloomDir, { recursive: true });
        const mdFile = path.join(agloomDir, "doc.md");
        fs.writeFileSync(mdFile, "# First Title\n\nContent here.\n\n# Second Title\n\nMore content here.\n");

        const { lastFrame, unmount } = render(
          React.createElement(App, {
            args: ["format"],
            projectRoot: tmpDir,
          }),
        );

        // Ждём завершения асинхронного FormatView
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const output = lastFrame()!;
        // TUI должен сообщить о необходимости внимания
        expect(output).toContain("files still need attention");
        // В списке должно присутствовать описание нарушения MD025
        expect(output).toContain("MD025");
        // exit code 1 — есть failures
        expect(process.exitCode).toBe(1);

        unmount();
      });

      // § TUI-отображение § Режим format:
      // Полный успех (failures и errors пусты): "✓ Formatted N files."
      // § Exit codes: exit code 0.
      it("при чистых файлах показывает 'Formatted N files' без блока failures и exit code 0", async () => {
        const agloomDir = path.join(tmpDir, ".agloom");
        fs.mkdirSync(agloomDir, { recursive: true });
        const mdFile = path.join(agloomDir, "clean.md");
        fs.writeFileSync(mdFile, "# Only Title\n\nJust text.\n");

        const { lastFrame, unmount } = render(
          React.createElement(App, {
            args: ["format"],
            projectRoot: tmpDir,
          }),
        );

        await new Promise((resolve) => setTimeout(resolve, 2000));

        const output = lastFrame()!;
        expect(output).toContain("Formatted");
        // Не должно быть блока про failures
        expect(output).not.toContain("files still need attention");
        expect(output).not.toContain("Errors:");
        // exit code должен быть 0 (undefined в ink-testing-library)
        expect(process.exitCode).toBeUndefined();

        unmount();
      });

      // § TUI-отображение § Режим format:
      // При наличии failures + errors:
      // "✗ Formatted N files, but M files still need attention:"
      // <failures>
      // (пустая строка)
      // "Errors:"
      // <errors>
      // § Exit codes: exit code 1.
      it("при наличии failures и errors показывает оба блока и exit code 1", async () => {
        const agloomDir = path.join(tmpDir, ".agloom");
        fs.mkdirSync(agloomDir, { recursive: true });
        // Файл с non-fixable MD025 → failures
        const mdFile = path.join(agloomDir, "doc.md");
        fs.writeFileSync(mdFile, "# First Title\n\nContent.\n\n# Second Title\n\nMore.\n");
        // Невалидный JSON → errors (runtime prettier error)
        const badJson = path.join(agloomDir, "bad.json");
        fs.writeFileSync(badJson, "{{{invalid json!!!}}}");

        const { lastFrame, unmount } = render(
          React.createElement(App, {
            args: ["format"],
            projectRoot: tmpDir,
          }),
        );

        await new Promise((resolve) => setTimeout(resolve, 2000));

        const output = lastFrame()!;
        // Блок failures
        expect(output).toContain("files still need attention");
        expect(output).toContain("MD025");
        // Секция Errors
        expect(output).toContain("Errors:");
        // exit code 1
        expect(process.exitCode).toBe(1);

        unmount();
      });

      // § TUI-отображение § Режим format:
      // При наличии только errors (failures пуст):
      // "✗ Formatted N files with K errors." + список.
      // Блока "files still need attention" быть НЕ должно.
      // § Exit codes: exit code 1.
      it("при наличии только errors показывает блок errors без блока failures и exit code 1", async () => {
        const agloomDir = path.join(tmpDir, ".agloom");
        fs.mkdirSync(agloomDir, { recursive: true });
        // Только невалидный JSON — runtime error, без markdown файлов.
        const badJson = path.join(agloomDir, "bad.json");
        fs.writeFileSync(badJson, "{{{invalid json!!!}}}");

        const { lastFrame, unmount } = render(
          React.createElement(App, {
            args: ["format"],
            projectRoot: tmpDir,
          }),
        );

        await new Promise((resolve) => setTimeout(resolve, 2000));

        const output = lastFrame()!;
        // Блок failures не отображается
        expect(output).not.toContain("files still need attention");
        // Блок с ошибками должен присутствовать ("with K errors" или "Errors:")
        expect(output).toMatch(/errors/i);
        // exit code 1
        expect(process.exitCode).toBe(1);

        unmount();
      });
    });

    // --- § Расширение 1a: --all и несколько файловых аргументов ---
    // Граничное условие: --all с несколькими позиционными аргументами
    it("при указании --all и нескольких файловых аргументов отображает ошибку", () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["format", "--all", "file1.md", "file2.yaml"],
        }),
      );

      const output = lastFrame()!;

      expect(output).toContain("Cannot use --all with file arguments.");
      expect(process.exitCode).toBe(1);

      unmount();
    });
  });
});
