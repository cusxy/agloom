// dotenv-plugin-values-integration.spec.ts
// Регрессионный тест: loadDotenv должен вызываться ДО resolvePluginValues,
// чтобы ${env:*} ссылки в plugin values разрешались из .env файла.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import React from "react";
import { render } from "ink-testing-library";
import { App } from "../app.js";

describe("CLI Integration", () => {
  describe("dotenv загружается до разрешения plugin values", () => {
    let tmpDir: string;
    let pluginDir: string;
    let originalExitCode: number | undefined;
    /** Ключи, установленные в process.env — для cleanup. */
    const envKeysToClean: string[] = [];

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "agl-dotenv-plugin-values-"),
      );
      pluginDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-dotenv-plugin-"));
      originalExitCode = process.exitCode;
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(pluginDir, { recursive: true, force: true });
      process.exitCode = originalExitCode;
      for (const key of envKeysToClean) {
        delete process.env[key];
      }
      envKeysToClean.length = 0;
    });

    it("transpile разрешает ${env:*} в plugin values из .env файла проекта", async () => {
      // Уникальный ключ, гарантированно отсутствующий в process.env
      const envKey = `AGLOOM_TEST_TOKEN_${Date.now()}`;
      const envValue = "secret-from-dotenv";
      envKeysToClean.push(envKey);

      // Убедимся, что переменная НЕ определена в process.env
      delete process.env[envKey];

      // --- Plugin setup ---
      // plugin.yml с sensitive-переменной
      fs.writeFileSync(
        path.join(pluginDir, "plugin.yml"),
        [
          "name: test-dotenv-plugin",
          "version: 1.0.0",
          "description: Test plugin for dotenv integration",
          "author:",
          "  name: Test",
          "  email: test@test.com",
          "variables:",
          "  api_token:",
          '    description: "API token"',
          "    required: true",
          "    sensitive: true",
        ].join("\n"),
      );

      // Overlay с ${values:api_token}
      const overlayDir = path.join(pluginDir, "overlays", "claude");
      fs.mkdirSync(overlayDir, { recursive: true });
      fs.writeFileSync(
        path.join(overlayDir, "token-check.md"),
        "Token: ${values:api_token}",
      );

      // --- Project setup ---
      fs.writeFileSync(path.join(tmpDir, "AGLOOM.md"), "Test instructions.");

      // config.yml с плагином и ${env:*} в values
      const agloomDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(agloomDir, { recursive: true });
      fs.writeFileSync(
        path.join(agloomDir, "config.yml"),
        [
          "adapters:",
          "  - claude",
          "plugins:",
          `  - path: ${pluginDir}`,
          "    values:",
          `      api_token: "\${env:${envKey}}"`,
        ].join("\n"),
      );

      // .env файл с переменной
      fs.writeFileSync(
        path.join(tmpDir, ".env"),
        `${envKey}=${envValue}\n`,
      );

      // --- Act ---
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

      // --- Assert ---
      // Transpile завершился без ошибок
      expect(process.exitCode).toBeUndefined();

      // Overlay-файл создан с подставленным значением из .env
      const outputPath = path.join(tmpDir, "token-check.md");
      expect(fs.existsSync(outputPath)).toBe(true);
      const content = fs.readFileSync(outputPath, "utf-8");
      expect(content).toBe(`Token: ${envValue}`);

      unmount();
    });

    it("transpile падает если ${env:*} в plugin values ссылается на отсутствующую переменную без .env", async () => {
      const envKey = `AGLOOM_MISSING_TOKEN_${Date.now()}`;
      envKeysToClean.push(envKey);

      // Убедимся, что переменная НЕ определена
      delete process.env[envKey];

      // --- Plugin setup ---
      fs.writeFileSync(
        path.join(pluginDir, "plugin.yml"),
        [
          "name: test-missing-env-plugin",
          "version: 1.0.0",
          "description: Test plugin for missing env",
          "author:",
          "  name: Test",
          "  email: test@test.com",
          "variables:",
          "  missing_var:",
          '    description: "Missing variable"',
          "    required: true",
          "    sensitive: true",
        ].join("\n"),
      );

      // --- Project setup ---
      fs.writeFileSync(path.join(tmpDir, "AGLOOM.md"), "Test instructions.");

      const agloomDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(agloomDir, { recursive: true });
      fs.writeFileSync(
        path.join(agloomDir, "config.yml"),
        [
          "adapters:",
          "  - claude",
          "plugins:",
          `  - path: ${pluginDir}`,
          "    values:",
          `      missing_var: "\${env:${envKey}}"`,
        ].join("\n"),
      );

      // НЕ создаём .env файл

      // --- Act ---
      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["transpile", "--adapter", "claude"],
          projectRoot: tmpDir,
        }),
      );

      await vi.waitFor(
        () => {
          const frame = lastFrame();
          expect(frame).toContain("Undefined environment variable");
        },
        { timeout: 10000 },
      );

      // --- Assert ---
      expect(process.exitCode).toBe(1);
      const output = lastFrame()!;
      expect(output).toContain(envKey);

      unmount();
    });
  });
});
