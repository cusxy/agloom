// global-options.spec.ts
// Спецификация: docs/specs/cli.md § Глобальные опции

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import React from "react";
import { render } from "ink-testing-library";
import { App } from "../app.js";

describe("CLI", () => {
  describe("Глобальные опции", () => {
    let originalExitCode: number | undefined;

    beforeEach(() => {
      originalExitCode = process.exitCode;
    });

    afterEach(() => {
      process.exitCode = originalExitCode;
    });

    // --- § --version: шаги 1-2 ---
    // Шаг 1: прочитать version из package.json
    // Шаг 2: отобразить прочитанное значение
    it("--version отображает версию из package.json", () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, { args: ["--version"] }),
      );

      // Прочитать ожидаемую версию из package.json
      const packageJsonPath = path.resolve(
        import.meta.dirname,
        "../../../package.json",
      );
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

      const output = lastFrame()!;
      expect(output).toContain(packageJson.version);

      // Exit code 0
      expect(process.exitCode).toBeUndefined();

      unmount();
    });

    // --- § --help: шаги 1-3 ---
    // Шаг 1: отобразить описание программы
    // Шаг 2: отобразить список доступных команд (transpile, adapters)
    // Шаг 3: отобразить список глобальных опций (--help, --version)
    it("--help отображает справку с описанием, командами и опциями", () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, { args: ["--help"] }),
      );

      const output = lastFrame()!;

      // Описание программы
      expect(output.length).toBeGreaterThan(0);

      // Список команд
      expect(output).toContain("transpile");
      expect(output).toContain("adapters");

      // Глобальные опции
      expect(output).toContain("--help");
      expect(output).toContain("--version");

      // Exit code 0
      expect(process.exitCode).toBeUndefined();

      unmount();
    });

    // --- § Вызов без команды ---
    // При вызове без команды ДОЛЖНА отображаться общая справка (аналогично --help).
    // Процесс завершается с exit code 0.
    it("при вызове без команды отображает справку (аналогично --help)", () => {
      const { lastFrame: helpFrame, unmount: unmountHelp } = render(
        React.createElement(App, { args: ["--help"] }),
      );
      const helpOutput = helpFrame()!;
      unmountHelp();

      const { lastFrame: emptyFrame, unmount: unmountEmpty } = render(
        React.createElement(App, { args: [] }),
      );
      const emptyOutput = emptyFrame()!;

      // Вывод без команды содержит те же ключевые элементы, что и --help
      expect(emptyOutput).toContain("transpile");
      expect(emptyOutput).toContain("adapters");

      // Exit code 0
      expect(process.exitCode).toBeUndefined();

      unmountEmpty();
    });

    // --- § --help на уровне команд ---
    // transpile --help: справка по команде transpile
    // adapters --help: справка по команде adapters
    it("transpile --help отображает справку по команде transpile", () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, { args: ["transpile", "--help"] }),
      );

      const output = lastFrame()!;

      // Справка содержит упоминание --adapter
      expect(output).toContain("--adapter");

      // Exit code 0
      expect(process.exitCode).toBeUndefined();

      unmount();
    });

    // --- Неизвестная команда ---
    // Неизвестная команда → "Unknown command: {value}"; exit code 1.
    it('при неизвестной команде отображает "Unknown command" и exit code 1', () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, { args: ["agents"] }),
      );

      const output = lastFrame()!;

      expect(output).toContain("Unknown command");
      expect(output).toContain("agents");
      expect(output).toContain("agloom --help");
      expect(process.exitCode).toBe(1);

      unmount();
    });

    // --- § --help на уровне команды adapters ---
    // adapters --help: справка по команде adapters
    it("adapters --help отображает справку по команде adapters", () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, { args: ["adapters", "--help"] }),
      );

      const output = lastFrame()!;

      // Справка содержит описание команды adapters
      expect(output).toContain("adapters");
      expect(output.length).toBeGreaterThan(0);

      // Exit code 0
      expect(process.exitCode).toBeUndefined();

      unmount();
    });

    // --- § Неизвестная команда: точный формат сообщения ---
    // § cli.md § Неизвестная команда:
    // "Unknown command: {cmd}. Run 'agloom --help' to see available commands."
    // exit code 1.
    it("при неизвестной команде отображает точный формат сообщения из спецификации", () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, { args: ["foobar"] }),
      );

      const output = lastFrame()!;

      // Точный формат сообщения из спецификации
      expect(output).toContain(
        "Unknown command: foobar. Run 'agloom --help' to see available commands.",
      );
      expect(process.exitCode).toBe(1);

      unmount();
    });
  });
});
