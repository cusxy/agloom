// discover.spec.ts
// Спецификация: docs/specs/commands-transpiler.md § Обнаружение определений команд

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createCommandsTranspiler } from "../index.js";
import { CommandDiscoverError } from "../errors.js";

/**
 * Стаб-адаптер для тестов discover(). Транспиляция здесь не тестируется.
 */
function createStubAdapter(agentId: string) {
  return {
    agentId,
    targetDir: `.${agentId}/commands`,
    transpile: () => [],
  };
}

describe("CommandsTranspiler", () => {
  describe("Обнаружение определений команд", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-commands-discover-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Happy path: шаги 1–6 ---
    it("обнаруживает .md файлы в .agloom/commands/ и формирует CommandDefinition[]", () => {
      const commandsDir = path.join(tmpDir, ".agloom", "commands");
      fs.mkdirSync(commandsDir, { recursive: true });
      fs.writeFileSync(path.join(commandsDir, "deploy.md"), "---\ndescription: Deploy\n---\nDeploy body.");
      fs.writeFileSync(path.join(commandsDir, "test.md"), "---\ndescription: Test\n---\nTest body.");

      const transpiler = createCommandsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const definitions = transpiler.discover();

      expect(definitions).toHaveLength(2);

      const deploy = definitions.find((d) => d.name === "deploy");
      expect(deploy).toBeDefined();
      expect(deploy!.relativePath).toBe(".agloom/commands/deploy.md");
      expect(deploy!.rawContent).toBe("---\ndescription: Deploy\n---\nDeploy body.");

      const test = definitions.find((d) => d.name === "test");
      expect(test).toBeDefined();
      expect(test!.relativePath).toBe(".agloom/commands/test.md");
      expect(test!.rawContent).toBe("---\ndescription: Test\n---\nTest body.");
    });

    // --- Трансформация: шаг 4 — фильтрация только .md файлов ---
    it("отфильтровывает файлы без расширения .md", () => {
      const commandsDir = path.join(tmpDir, ".agloom", "commands");
      fs.mkdirSync(commandsDir, { recursive: true });
      fs.writeFileSync(path.join(commandsDir, "command.md"), "md content");
      fs.writeFileSync(path.join(commandsDir, "readme.txt"), "txt content");
      fs.writeFileSync(path.join(commandsDir, "config.yaml"), "yaml content");

      const transpiler = createCommandsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const definitions = transpiler.discover();

      expect(definitions).toHaveLength(1);
      expect(definitions[0].name).toBe("command");
    });

    // --- Трансформация: шаг 3 — рекурсивное сканирование подкаталогов ---
    it("рекурсивно обнаруживает .md файлы в подкаталогах", () => {
      const commandsDir = path.join(tmpDir, ".agloom", "commands");
      fs.mkdirSync(commandsDir, { recursive: true });
      fs.writeFileSync(path.join(commandsDir, "deploy.md"), "deploy content");

      const gitDir = path.join(commandsDir, "git");
      fs.mkdirSync(gitDir);
      fs.writeFileSync(path.join(gitDir, "commit.md"), "commit content");
      fs.writeFileSync(path.join(gitDir, "push.md"), "push content");

      const transpiler = createCommandsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const definitions = transpiler.discover();

      expect(definitions).toHaveLength(3);

      const deploy = definitions.find((d) => d.name === "deploy");
      expect(deploy).toBeDefined();
      expect(deploy!.relativePath).toBe(".agloom/commands/deploy.md");

      const commit = definitions.find((d) => d.name === "git/commit");
      expect(commit).toBeDefined();
      expect(commit!.relativePath).toBe(".agloom/commands/git/commit.md");

      const push = definitions.find((d) => d.name === "git/push");
      expect(push).toBeDefined();
      expect(push!.relativePath).toBe(".agloom/commands/git/push.md");
    });

    // --- Трансформация: шаг 6 — name формируется из пути файла ---
    it("формирует name как путь файла относительно каталога commands без .md", () => {
      const commandsDir = path.join(tmpDir, ".agloom", "commands");
      const deepDir = path.join(commandsDir, "a", "b");
      fs.mkdirSync(deepDir, { recursive: true });
      fs.writeFileSync(path.join(deepDir, "deep-command.md"), "content");

      const transpiler = createCommandsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const definitions = transpiler.discover();

      expect(definitions).toHaveLength(1);
      expect(definitions[0].name).toBe("a/b/deep-command");
      expect(definitions[0].relativePath).toBe(".agloom/commands/a/b/deep-command.md");
    });

    // --- Расширение 2a: каталог commands не существует → пустой массив ---
    it("возвращает пустой массив, если каталог .agloom/commands/ не существует", () => {
      const transpiler = createCommandsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const definitions = transpiler.discover();

      expect(definitions).toEqual([]);
    });

    // --- Расширение 3a: ошибка доступа к каталогу (EACCES) ---
    it("выбрасывает CommandDiscoverError при ошибке доступа к каталогу .agloom/commands/", () => {
      const commandsDir = path.join(tmpDir, ".agloom", "commands");
      fs.mkdirSync(commandsDir, { recursive: true });
      fs.chmodSync(commandsDir, 0o000);

      const transpiler = createCommandsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      try {
        expect(() => transpiler.discover()).toThrow(CommandDiscoverError);
        expect(() => transpiler.discover()).toThrow(/Failed to scan directory \.agloom\/commands\//);
      } finally {
        fs.chmodSync(commandsDir, 0o755);
      }
    });

    // --- Расширение 5a: ошибка чтения файла ---
    it("выбрасывает CommandDiscoverError при ошибке чтения файла", () => {
      const commandsDir = path.join(tmpDir, ".agloom", "commands");
      fs.mkdirSync(commandsDir, { recursive: true });
      const filePath = path.join(commandsDir, "broken.md");
      fs.writeFileSync(filePath, "content");
      fs.chmodSync(filePath, 0o000);

      const transpiler = createCommandsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      try {
        expect(() => transpiler.discover()).toThrow(CommandDiscoverError);
        expect(() => transpiler.discover()).toThrow(/Failed to read .agloom\/commands\/broken\.md/);
      } finally {
        fs.chmodSync(filePath, 0o644);
      }
    });

    // --- Граничное условие: пустой каталог ---
    it("возвращает пустой массив, если каталог .agloom/commands/ пуст", () => {
      const commandsDir = path.join(tmpDir, ".agloom", "commands");
      fs.mkdirSync(commandsDir, { recursive: true });

      const transpiler = createCommandsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const definitions = transpiler.discover();

      expect(definitions).toEqual([]);
    });

    // --- Граничное условие: подкаталоги без .md файлов ---
    it("возвращает пустой массив, если подкаталоги не содержат .md файлов", () => {
      const commandsDir = path.join(tmpDir, ".agloom", "commands");
      const subDir = path.join(commandsDir, "git");
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(path.join(subDir, "readme.txt"), "not a command");

      const transpiler = createCommandsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const definitions = transpiler.discover();

      expect(definitions).toEqual([]);
    });
  });
});
