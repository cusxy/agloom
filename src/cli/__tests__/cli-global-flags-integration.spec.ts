// cli-global-flags-integration.spec.ts
// Spec: docs/specs/cli-global-flags.md § Процедура Run CLI
// Spec: docs/specs/cli-global-flags.md § Единообразие применения пайплайна
// Spec: docs/specs/cli-global-flags.md § Семантика команд
// Spec: docs/specs/cli-global-flags.md § Известные регрессии eager-загрузки
// Spec: docs/specs/init-command.md § Глобальные флаги, § Поведение шаг 4, расширения 4a–4d
// Spec: docs/specs/format.md § Команда format шаги 2, 5
// Spec: docs/specs/config.md § Процедура Resolve Adapters from CLI Args
//
// Red-phase TDD integration tests for new global CLI flags plumbed through
// the `Run CLI` front-end pipeline. Tests exercise end-to-end behaviour
// via the App component, using real tmpdir filesystems (consistent with
// existing transpile/init/clean command test patterns).

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { runApp } from "./run-app-test-helper.js";

/**
 * Runs the CLI via `runCLI` (through the `runApp` test helper) and returns
 * the captured stdout+stderr string. `runCLI` awaits command completion
 * fully before returning, so no polling is required — the `regex` and
 * `timeout` parameters are retained for signature compatibility with the
 * original ink-testing-library-backed helper but are no longer
 * load-bearing: the second regex argument is ignored beyond documenting
 * the final-state match that the caller plans to assert on.
 *
 * Spec: docs/specs/cli-global-flags.md § Процедура Run CLI
 */
async function renderUntilMatches(
  args: string[],
  _regex: RegExp,
  { projectRoot }: { projectRoot?: string; timeout?: number } = {},
): Promise<string> {
  const { lastFrame } = await runApp({ args, projectRoot });
  return lastFrame();
}

/**
 * Same migration as `renderUntilMatches`. Since `runApp` resolves only
 * after the command has finished (`runCLI` awaits render completion),
 * any filesystem side effects are already in place by the time this
 * helper returns — no polling needed.
 */
async function renderUntilFs(
  args: string[],
  _predicate: () => boolean,
  { projectRoot }: { projectRoot?: string; timeout?: number } = {},
): Promise<string> {
  const { lastFrame } = await runApp({ args, projectRoot });
  return lastFrame();
}

describe("CLI global flags — integration", () => {
  let tmpDir: string;
  let originalExitCode: number | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-gf-int-"));
    originalExitCode = process.exitCode;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    process.exitCode = originalExitCode;
  });

  // =====================================================================
  // Group 3 — Universal pipeline for ALL commands.
  // § cli-global-flags.md § Единообразие применения пайплайна:
  //   «Процедура Run CLI ТРЕБУЕТСЯ применять ко ВСЕМ вызовам CLI»,
  //   валидация существования путей ДО --help и --version.
  // =====================================================================
  describe("path existence validation is enforced for all commands", () => {
    it("agloom version --project-dir /nonexistent → exit 1, версия НЕ печатается", async () => {
      const missing = path.join(tmpDir, "does-not-exist");
      const output = await renderUntilMatches(["version", "--project-dir", missing], /Directory does not exist/);

      expect(output).toMatch(/Directory does not exist/);
      expect(process.exitCode).toBe(1);
    });

    it("agloom --help --config /nonexistent.yml → exit 1, справка НЕ отображается", async () => {
      const missing = path.join(tmpDir, "nope.yml");
      const output = await renderUntilMatches(["--help", "--config", missing], /File does not exist/);

      expect(output).toMatch(/File does not exist/);
      // Справка НЕ должна быть выведена
      expect(output).not.toContain("Commands:");
      expect(process.exitCode).toBe(1);
    });

    it("agloom clean --agloom-dir /nonexistent → exit 1", async () => {
      const missing = path.join(tmpDir, "no-such", ".agloom");
      const output = await renderUntilMatches(["clean", "--agloom-dir", missing], /Directory does not exist/);

      expect(output).toMatch(/Directory does not exist/);
      expect(process.exitCode).toBe(1);
    });

    it("agloom adapters --project-dir /nonexistent → exit 1", async () => {
      const missing = path.join(tmpDir, "no-such-proj");
      const output = await renderUntilMatches(["adapters", "--project-dir", missing], /Directory does not exist/);

      expect(output).toMatch(/Directory does not exist/);
      expect(process.exitCode).toBe(1);
    });

    it("agloom format --config /nonexistent → exit 1", async () => {
      const missing = path.join(tmpDir, "nope.yml");
      const output = await renderUntilMatches(["format", "--config", missing], /File does not exist/);

      expect(output).toMatch(/File does not exist/);
      expect(process.exitCode).toBe(1);
    });

    it("валидные пути на всех командах — пайплайн не блокирует выполнение version", async () => {
      const output = await renderUntilMatches(["version", "--project-dir", tmpDir], /\d+\.\d+\.\d+/);

      // Должна печататься версия (semver-подобная строка), без ошибки пути
      expect(output).not.toMatch(/Directory does not exist/);
      expect(output).toMatch(/\d+\.\d+\.\d+/);
      expect(process.exitCode).toBeUndefined();
    });
  });

  // =====================================================================
  // Group 5 — init specifics.
  // § init-command.md § Поведение шаг 4, расширения 4a–4d.
  // § cli-global-flags.md § C5, C6.
  // =====================================================================
  describe("init command — agloom-dir workflow", () => {
    it("regression: agloom init без флагов в пустом проекте создаёт <cwd>/.agloom/config.yml", async () => {
      const cfgPath = path.join(tmpDir, ".agloom", "config.yml");
      await renderUntilFs(["init", "--adapter", "claude"], () => fs.existsSync(cfgPath), {
        projectRoot: tmpDir,
      });

      expect(fs.existsSync(cfgPath)).toBe(true);
    });

    it("mkdir -p /new/.agloom && init --agloom-dir /new/.agloom → создаёт <newAgloom>/config.yml (C5)", async () => {
      const newAgloom = path.join(tmpDir, "new", ".agloom");
      fs.mkdirSync(newAgloom, { recursive: true });
      const cfgPath = path.join(newAgloom, "config.yml");

      const output = await renderUntilFs(
        ["init", "--adapter", "claude", "--agloom-dir", newAgloom, "--project-dir", tmpDir],
        () => fs.existsSync(cfgPath),
      );

      expect(fs.existsSync(cfgPath)).toBe(true);
      expect(output).not.toMatch(/Error/);
      expect(process.exitCode).toBeUndefined();
    });

    it("init --agloom-dir на уже инициализированную директорию без --force → already initialized (4a)", async () => {
      const existing = path.join(tmpDir, "proj", ".agloom");
      fs.mkdirSync(existing, { recursive: true });
      fs.writeFileSync(path.join(existing, "config.yml"), "adapters: [claude]\n");

      const output = await renderUntilMatches(
        ["init", "--adapter", "claude", "--agloom-dir", existing, "--project-dir", tmpDir],
        /already initialized/,
      );

      expect(output).toMatch(/already initialized/);
      expect(process.exitCode).toBe(1);
    });

    it("init --agloom-dir на инициализированную директорию с --force → reinit, config перезаписывается (4b)", async () => {
      const existing = path.join(tmpDir, "proj", ".agloom");
      fs.mkdirSync(existing, { recursive: true });
      fs.writeFileSync(path.join(existing, "config.yml"), "adapters: [claude]\n");
      const cfgPath = path.join(existing, "config.yml");

      await renderUntilFs(
        ["init", "--adapter", "opencode", "--agloom-dir", existing, "--project-dir", tmpDir, "--force"],
        () => {
          try {
            return fs.readFileSync(cfgPath, "utf-8").includes("opencode");
          } catch {
            return false;
          }
        },
      );

      const content = fs.readFileSync(cfgPath, "utf-8");
      expect(content).toContain("opencode");
    });

    it("init --agloom-dir на существующую, но ПУСТУЮ директорию — продолжает инициализацию (4c, C5 smart check)", async () => {
      // /empty-dir/ существует, но нет config.yml и нет overlays/
      const emptyDir = path.join(tmpDir, "empty");
      fs.mkdirSync(emptyDir, { recursive: true });
      const cfgPath = path.join(emptyDir, "config.yml");

      await renderUntilFs(["init", "--adapter", "claude", "--agloom-dir", emptyDir, "--project-dir", tmpDir], () =>
        fs.existsSync(cfgPath),
      );

      expect(fs.existsSync(cfgPath)).toBe(true);
      expect(process.exitCode).toBeUndefined();
    });

    // § C6 — documented regression: eager load of broken config blocks init
    it("init --adapter claude --config /broken.yml → exit 1 (C6 eager-load регрессия)", async () => {
      const broken = path.join(tmpDir, "broken.yml");
      fs.writeFileSync(broken, ":\n  - [this is not valid\n  :: bad");

      const output = await renderUntilMatches(
        ["init", "--adapter", "claude", "--config", broken, "--project-dir", tmpDir],
        /Invalid config/,
      );

      expect(output).toMatch(/Invalid config/);
      expect(process.exitCode).toBe(1);
    });

    // § C3 — init ignores loadedConfig content semantically
    it("init --config /valid.yml c --adapter claude игнорирует содержимое valid.yml, создаёт собственный config.yml с claude", async () => {
      const validCfg = path.join(tmpDir, "valid.yml");
      fs.writeFileSync(validCfg, "adapters:\n  - opencode\n");

      const newAgloom = path.join(tmpDir, "target", ".agloom");
      fs.mkdirSync(newAgloom, { recursive: true });
      const cfgPath = path.join(newAgloom, "config.yml");

      await renderUntilFs(
        ["init", "--adapter", "claude", "--config", validCfg, "--agloom-dir", newAgloom, "--project-dir", tmpDir],
        () => fs.existsSync(cfgPath),
      );

      const created = fs.readFileSync(cfgPath, "utf-8");
      expect(created).toContain("claude");
      expect(created).not.toContain("opencode");
    });
  });

  // =====================================================================
  // Group 6 — format specifics.
  // § format.md § Команда format шаги 2, 5: format reads prettier/
  // markdownlint from rawConfig.value (provided by Run CLI).
  // =====================================================================
  describe("format command — prettier/markdownlint from configSource", () => {
    it("format --config /custom.yml — пайплайн принимает путь, ошибки существования нет, файлы форматируются", async () => {
      const mdFile = path.join(tmpDir, "doc.md");
      fs.writeFileSync(mdFile, "# Title\n\nsome text\n");

      const customCfg = path.join(tmpDir, "custom.yml");
      fs.writeFileSync(customCfg, "prettier:\n  tabWidth: 8\n");

      const output = await renderUntilMatches(
        ["format", "--check", "--config", customCfg, mdFile],
        /formatted|need formatting|All \d+ files|No files/,
        { projectRoot: tmpDir },
      );

      expect(output).not.toMatch(/File does not exist/);
      expect(output).not.toMatch(/Unknown option/);
      // Positive assertion: пайплайн реально добрался до format phase
      expect(output).toMatch(/formatted|need formatting|All \d+ files|No files/);
    });

    it("format --config - — пайплайн принимает stdin, не выдаёт ошибку существования", async () => {
      const mdFile = path.join(tmpDir, "doc.md");
      fs.writeFileSync(mdFile, "# Title\n");

      const output = await renderUntilMatches(
        ["format", "--check", "--config", "-", mdFile],
        /formatted|need formatting|All \d+ files|No files/,
        { projectRoot: tmpDir },
      );

      expect(output).not.toMatch(/File does not exist/);
      expect(output).not.toMatch(/Unknown option/);
      expect(output).toMatch(/formatted|need formatting|All \d+ files|No files/);
    });
  });

  // =====================================================================
  // Group 8 — combined explicit + default cascade.
  // § cli-global-flags.md § Правила каскада — mixed explicit/default.
  // =====================================================================
  describe("combined explicit + default cascade", () => {
    it("--project-dir + --config - — команда adapters --all реально печатает список адаптеров", async () => {
      const projectDir = path.join(tmpDir, "proj");
      fs.mkdirSync(projectDir, { recursive: true });

      const output = await renderUntilMatches(
        ["adapters", "--all", "--project-dir", projectDir, "--config", "-"],
        /claude|opencode|agentsmd/,
      );

      expect(output).not.toMatch(/File does not exist/);
      expect(output).not.toMatch(/Directory does not exist/);
      expect(output).not.toMatch(/Unknown option/);
      // Finding 6: positive assertion — команда реально отработала,
      // а не просто отрендерила пустой фрейм
      expect(output).toMatch(/claude|opencode|agentsmd/);
      expect(process.exitCode).toBeUndefined();
    });
  });
});
