// format-command.spec.ts
// Спецификация: docs/specs/format.md § Команда format, § Расширение --help

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
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
