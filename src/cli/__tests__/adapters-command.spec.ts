// adapters-command.spec.ts
// Спецификация: docs/specs/cli.md § Команда adapters

import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { App } from "../app.js";

describe("CLI", () => {
  describe("Команда adapters", () => {
    // --- Happy path: шаги 1-3 ---
    // Шаг 1: прочитать все записи из реестра адаптеров
    // Шаг 2: отобразить заголовок "Available adapters:"
    // Шаг 3: для каждой записи отобразить id и description
    it('выводит "Available adapters:" и список адаптеров с id и description', () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, { args: ["adapters"] }),
      );

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
      const { unmount } = render(
        React.createElement(App, { args: ["adapters"] }),
      );

      // exit code 0 — process.exitCode не установлен
      expect(process.exitCode).toBeUndefined();

      unmount();
    });
  });
});
