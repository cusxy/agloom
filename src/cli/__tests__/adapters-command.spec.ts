// adapters-command.spec.ts
// Спецификация: docs/specs/cli.md § Команда adapters
// Спецификация: docs/specs/adapter-registry-ext.md § hidden
// Спецификация: docs/specs/config.md § Процедура Load Config

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import React from "react";
import { render } from "ink-testing-library";
import { App } from "../app.js";

describe("CLI", () => {
  let tmpDir: string;
  let originalExitCode: number | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agloom-adapters-"));
    originalExitCode = process.exitCode;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    process.exitCode = originalExitCode;
  });

  describe("Команда adapters", () => {
    // --- Happy path: шаги 1-3 ---
    // Шаг 1: прочитать все записи из реестра адаптеров
    // Шаг 2: отобразить заголовок "Available adapters:"
    // Шаг 3: для каждой записи отобразить id и description
    it('выводит "Available adapters:" и список адаптеров с id и description', () => {
      const { lastFrame, unmount } = render(React.createElement(App, { args: ["adapters"], projectRoot: tmpDir }));

      const output = lastFrame()!;

      // Заголовок
      expect(output).toContain("Available adapters:");

      // Записи реестра: id и description
      expect(output).toContain("claude");
      expect(output).toContain("Claude Code");
      expect(output).toContain("opencode");
      expect(output).toContain("OpenCode");

      unmount();
    });

    // --- Happy path: формат вывода ---
    // Результат: exit code 0
    it("завершается с exit code 0", () => {
      const { unmount } = render(React.createElement(App, { args: ["adapters"], projectRoot: tmpDir }));

      // exit code 0 — process.exitCode не установлен
      expect(process.exitCode).toBeUndefined();

      unmount();
    });

    // =====================================================================
    // Спецификация: docs/specs/adapter-registry-ext.md § hidden
    // Спецификация: docs/specs/cli.md § Команда adapters (обновлённая)
    // =====================================================================

    // --- § adapter-registry-ext.md § hidden: скрытые адаптеры не отображаются ---
    // § cli.md § Команда adapters:
    // "Скрытые адаптеры (hidden === true) не отображаются."
    it("не отображает скрытый адаптер agentsmd", () => {
      const { lastFrame, unmount } = render(React.createElement(App, { args: ["adapters"], projectRoot: tmpDir }));

      const output = lastFrame()!;

      // agentsmd — скрытый адаптер, не должен отображаться
      expect(output).not.toContain("agentsmd");

      unmount();
    });

    // =====================================================================
    // Спецификация: docs/specs/cli.md § Команда adapters (конфиг-зависимые)
    // =====================================================================

    describe("с конфигурационным файлом", () => {
      // --- § cli.md § Команда adapters § Поведение шаги 3-4 ---
      // Без --all: Load Config → если config вернул adapterIds →
      // заголовок "Active adapters:", список: записи из конфига.
      it('с конфигом adapters: [claude] показывает "Active adapters:" и только claude', () => {
        const configDir = path.join(tmpDir, ".agloom");
        fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(path.join(configDir, "config.yml"), "adapters:\n  - claude\n");

        const { lastFrame, unmount } = render(
          React.createElement(App, {
            args: ["adapters"],
            projectRoot: tmpDir,
          }),
        );

        const output = lastFrame()!;

        // § Команда adapters § Поведение шаг 4:
        // Заголовок "Active adapters:"
        expect(output).toContain("Active adapters:");
        // claude отображается
        expect(output).toContain("claude");
        expect(output).toContain("Claude Code");
        // opencode НЕ отображается (не в конфиге)
        expect(output).not.toContain("opencode");

        unmount();
      });

      // --- § cli.md § Команда adapters --all ---
      // С --all: заголовок "Available adapters:",
      // список: все записи реестра с hidden !== true.
      it('при --all показывает "Available adapters:" и все нескрытые адаптеры', () => {
        const { lastFrame, unmount } = render(
          React.createElement(App, {
            args: ["adapters", "--all"],
            projectRoot: tmpDir,
          }),
        );

        const output = lastFrame()!;

        expect(output).toContain("Available adapters:");
        expect(output).toContain("claude");
        expect(output).toContain("opencode");
        // agentsmd скрыт — НЕ отображается
        expect(output).not.toContain("agentsmd");

        unmount();
      });

      // --- § cli.md § Команда adapters: без конфига и без --all ---
      // Load Config вернул null → заголовок "Available adapters:",
      // список: все записи реестра с hidden !== true.
      it('без конфига и без --all показывает "Available adapters:" и все нескрытые адаптеры', () => {
        // tmpDir без .agloom/config.yml

        const { lastFrame, unmount } = render(
          React.createElement(App, {
            args: ["adapters"],
            projectRoot: tmpDir,
          }),
        );

        const output = lastFrame()!;

        expect(output).toContain("Available adapters:");
        expect(output).toContain("claude");
        expect(output).toContain("opencode");
        // agentsmd скрыт — НЕ отображается
        expect(output).not.toContain("agentsmd");

        unmount();
      });

      // --- § cli.md § Команда adapters § Расширения 3a ---
      // Load Config вернул ошибку → отобразить сообщение ошибки; exit code 1.
      it("при невалидном config.yml отображает ошибку и завершается с exit code 1", () => {
        const configDir = path.join(tmpDir, ".agloom");
        fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(path.join(configDir, "config.yml"), "adapters: [invalid yaml\n  : : :\n");

        const { lastFrame, unmount } = render(
          React.createElement(App, {
            args: ["adapters"],
            projectRoot: tmpDir,
          }),
        );

        const output = lastFrame()!;

        expect(output).toContain("Invalid config file:");
        expect(process.exitCode).toBe(1);

        unmount();
      });
    });

    // =====================================================================
    // § cli.md § Глобальные опции § --help: adapters --help (обновлённая)
    // =====================================================================

    // --- § cli.md § adapters --help: обновлённая справка ---
    // Вывод agloom adapters --help:
    // "Usage: agloom adapters [--all]"
    // "Show active adapters from config, or all available adapters."
    it("adapters --help содержит [--all] и описание конфиг-зависимого поведения", () => {
      const { lastFrame, unmount } = render(React.createElement(App, { args: ["adapters", "--help"] }));

      const output = lastFrame()!;

      expect(output).toContain("[--all]");
      expect(output).toMatch(/active adapters from config/i);

      unmount();
    });
  });
});
