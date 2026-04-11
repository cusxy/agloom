// run-cli.spec.ts
// Spec: docs/specs/cli-global-flags.md § Процедура Run CLI
// Spec: docs/specs/cli-global-flags.md § Разрешение относительных путей внутри YAML-конфига
// Spec: docs/specs/cli-global-flags.md § Известные регрессии eager-загрузки
// Spec: docs/specs/plugin-loading.md § Процедура Resolve Plugins
// Spec: docs/specs/config.md § Процедура Read Config Source
//
// Red-phase TDD tests for the top-level `runCLI` entry point — a new
// function exported from `src/cli/run-cli.ts` that encapsulates the full
// Run CLI pipeline (Resolve Global Flags → Read Config Source →
// Load Config → dispatch command) with injectable cwd, stdin, and a
// test-only `readFile` hook used to verify the single-I/O invariant over
// the file branch.
//
// This test file targets the reviewer findings across two rounds:
//   Finding 1 — Group 4 end-to-end: relative paths inside YAML must resolve
//               against configSource.baseDir (not cwd) — proven by plugin
//               discovery with a stub plugin tree + positive exitCode
//               assertion (Round 2 Finding B).
//   Finding 2 — C6 workaround: `echo -n | init --config -` bypasses a
//               broken on-disk config.
//   Finding 3 — Single-I/O invariant: configSource is read exactly once,
//               regardless of branch:
//                 * stdin branch — counting Readable with destroy-on-
//                   re-subscribe guard + explicit counter assertion.
//                 * file branch — injectable `readFile` counter parameter
//                   to runCLI.
//               Round 2 Finding A addressed.
//   Finding 4 — end-to-end `--config -` with non-empty stdin: the stdin
//               payload actually reaches the command handler and influences
//               its behaviour.
//
// The `runCLI` entry point does not yet exist. Importing it forces the
// Implement phase to create a cohesive top-level function whose signature
// matches the procedure defined in cli-global-flags.md § Процедура Run CLI.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { Readable } from "node:stream";

// NOTE: module does not yet exist — red phase.
// Impl will create src/cli/run-cli.ts exporting `runCLI`.
import { runCLI } from "../run-cli.js";

/**
 * Expected shape of runCLI's return value. The impl may return more fields,
 * but these are the ones tests observe. Keeping the assertion surface small
 * gives impl flexibility while pinning the load-bearing contract.
 */
interface RunCLIResult {
  /** Final exit code (0 = success, 1 = failure). */
  exitCode: number;
  /** Aggregated stdout text captured from the command renderer. */
  stdout: string;
  /** Aggregated stderr text (errors printed via the error channel). */
  stderr: string;
}

function stdinFrom(content: string): Readable {
  return Readable.from([content]);
}

function emptyStdin(): Readable {
  return Readable.from([]);
}

/**
 * Creates a minimal but valid local plugin stub at `dir`. Used to prove that
 * plugin paths inside a `--config` YAML are resolved against
 * configSource.baseDir (dirname of the config file) rather than cwd.
 *
 * Spec: docs/specs/plugin-manifest.md § Формат plugin.yml — минимальные
 * required поля: name, version, description, author.{name,email}.
 */
function makePluginStub(dir: string, name: string): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "plugin.yml"),
    [
      `name: ${name}`,
      "version: 1.0.0",
      "description: test stub plugin",
      "author:",
      "  name: Test",
      "  email: test@example.com",
      "",
    ].join("\n"),
  );
}

describe("runCLI — top-level Run CLI pipeline", () => {
  let tmpDir: string;
  let originalExitCode: number | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-run-cli-"));
    originalExitCode = process.exitCode;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    process.exitCode = originalExitCode;
  });

  // =====================================================================
  // Finding 1 — Group 4 end-to-end: relative plugin paths inside YAML
  // resolve against configSource.baseDir (= dirname of --config file).
  //
  // § cli-global-flags.md § Разрешение относительных путей внутри YAML-конфига:
  //   «Пути, записанные **внутри** YAML-содержимого конфига
  //    (например, поле `plugins: path: ./foo`, относительные пути в
  //    `overlay:`, ...), ТРЕБУЕТСЯ резолвить относительно значения
  //    `configSource.baseDir`».
  //
  // Round 2 Finding B: both tests now carry positive assertions
  // (exitCode === 0 + plugin manifest readability) in addition to the
  // negative "Plugin manifest not found" guards. A stub runCLI returning
  // empty stdout/stderr would fail these positive checks.
  // =====================================================================
  describe("relative paths inside YAML resolve against configSource.baseDir", () => {
    it("plugins: ./stub внутри --config /tmp/proj/try.yml резолвится в /tmp/proj/stub (baseDir = dirname)", async () => {
      // Layout:
      //   <tmpDir>/proj/try.yml            — config file
      //   <tmpDir>/proj/stub/plugin.yml    — plugin sits next to config
      //   <tmpDir>/proj/AGLOOM.md          — minimal canonical input
      //                                      so transpile can succeed
      //   <tmpDir>/cwd/                    — process cwd, intentionally
      //                                      unrelated to config location
      const projDir = path.join(tmpDir, "proj");
      const cwdDir = path.join(tmpDir, "cwd");
      fs.mkdirSync(projDir, { recursive: true });
      fs.mkdirSync(cwdDir, { recursive: true });
      fs.writeFileSync(path.join(projDir, "AGLOOM.md"), "# stub instructions\n");

      makePluginStub(path.join(projDir, "stub"), "stub");

      const cfgFile = path.join(projDir, "try.yml");
      fs.writeFileSync(cfgFile, ["adapters:", "  - claude", "plugins:", "  - ./stub", ""].join("\n"));

      // If baseDir is WRONG (= cwd) — runCLI will fail to find plugin at
      // <cwdDir>/stub/plugin.yml and emit "Plugin manifest not found".
      // If baseDir is CORRECT (= dirname(cfgFile) = projDir) — plugin is
      // resolved successfully and transpile completes with exitCode 0.
      const result = (await runCLI({
        argv: ["transpile", "--adapter", "claude", "--config", cfgFile, "--project-dir", projDir],
        cwd: cwdDir,
        stdin: emptyStdin(),
      })) as RunCLIResult;

      const combined = result.stdout + result.stderr;

      // NEGATIVE: no plugin-not-found error, and no reference to cwdDir
      // in any plugin-related diagnostic.
      expect(combined).not.toMatch(/Plugin manifest not found/);
      expect(combined).not.toMatch(new RegExp(cwdDir.replace(/\//g, "\\/") + "[^\\s]*stub"));

      // POSITIVE (Round 2 Finding B): transpile succeeded, which is only
      // possible if plugin discovery resolved ./stub relative to projDir.
      // exitCode === 0 distinguishes real success from a stub runCLI that
      // returns empty output.
      expect(result.exitCode).toBe(0);
      // Extra positive signal: stdout mentions transpile completion
      // ("Done." / "files written" / "Nothing to transpile.") — a stub
      // returning empty strings would fail this.
      expect(result.stdout).toMatch(/Done\.|Nothing to transpile|files written/);
    });

    it("stdin --config - с plugins: ./stub — baseDir = cwd (асимметрия), НЕ --project-dir", async () => {
      // Setup: plugin stub lives in `cwdDir/stub/`. --project-dir points
      // elsewhere. If impl mistakenly uses writeRoot as baseDir, plugin
      // won't be found under cwdDir/stub. Canonical AGLOOM.md lives in
      // projDir (writeRoot), so transpile has something to process.
      const cwdDir = path.join(tmpDir, "base");
      const projDir = path.join(tmpDir, "elsewhere");
      fs.mkdirSync(cwdDir, { recursive: true });
      fs.mkdirSync(projDir, { recursive: true });
      fs.writeFileSync(path.join(projDir, "AGLOOM.md"), "# stdin stub\n");

      makePluginStub(path.join(cwdDir, "stub"), "stub");

      const yamlBody = ["adapters:", "  - claude", "plugins:", "  - ./stub", ""].join("\n");

      const result = (await runCLI({
        argv: ["transpile", "--adapter", "claude", "--config", "-", "--project-dir", projDir],
        cwd: cwdDir,
        stdin: stdinFrom(yamlBody),
      })) as RunCLIResult;

      const combined = result.stdout + result.stderr;

      // NEGATIVE: must not complain that the plugin is missing under projDir
      expect(combined).not.toMatch(/Plugin manifest not found/);
      expect(combined).not.toMatch(new RegExp("Plugin manifest not found.*" + projDir.replace(/\//g, "\\/")));

      // POSITIVE (Round 2 Finding B): exitCode === 0 proves the pipeline
      // resolved the plugin from cwdDir (stdin asymmetry contract), not
      // from projDir. A stub runCLI with zero exitCode and empty output
      // would still fail the next assertion.
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/Done\.|Nothing to transpile|files written/);
    });
  });

  // =====================================================================
  // Finding 2 — C6 workaround end-to-end.
  //
  // § cli-global-flags.md § Известные регрессии eager-загрузки:
  //   «Обход для типичного workflow "чинить сломанный проект" —
  //    использовать `--config -` с пустым stdin:
  //      echo -n | agloom init --adapter claude --config -
  //    Это даёт Run CLI валидный пустой loadedConfig, не затрагивая
  //    сломанный файл на диске.»
  // =====================================================================
  describe("C6 workaround — empty stdin bypasses broken on-disk config", () => {
    it("echo -n | init --adapter claude --config - завершается успешно при сломанном <cwd>/.agloom/config.yml", async () => {
      // Setup: <tmpDir>/.agloom/config.yml содержит невалидный YAML
      const agloomDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(agloomDir, { recursive: true });
      fs.writeFileSync(path.join(agloomDir, "config.yml"), ":\n  - [broken yaml\n  :: bad");

      // Сначала докажем регрессию: без workaround init падает
      const regressionResult = (await runCLI({
        argv: ["init", "--adapter", "claude"],
        cwd: tmpDir,
        stdin: emptyStdin(),
      })) as RunCLIResult;

      expect(regressionResult.exitCode).toBe(1);
      expect(regressionResult.stdout + regressionResult.stderr).toMatch(/Invalid config/);

      // Теперь — workaround: пустой stdin через --config -.
      // Init должен пройти мимо сломанного on-disk config, но у init
      // нет --force, а .agloom/config.yml уже существует → ожидаем
      // already initialized. Это доказывает, что Run CLI НЕ упал
      // на парсинге сломанного файла (ошибка пошла бы из Load Config),
      // а успешно добрался до семантической проверки init.
      const workaroundResult = (await runCLI({
        argv: ["init", "--adapter", "claude", "--config", "-"],
        cwd: tmpDir,
        stdin: emptyStdin(),
      })) as RunCLIResult;

      const combined = workaroundResult.stdout + workaroundResult.stderr;
      // Критично: Run CLI НЕ упал на `Invalid config` из сломанного файла
      expect(combined).not.toMatch(/Invalid config/);
      // init добрался до своей логики и увидел already-initialized
      // (потому что config.yml существует)
      expect(combined).toMatch(/already initialized/);
      expect(workaroundResult.exitCode).toBe(1); // already-initialized → exit 1
    });

    it("echo -n | init --adapter claude --config - --agloom-dir <fresh> при сломанном default config — успешный init в новую директорию", async () => {
      // Setup: дефолтный <tmpDir>/.agloom/config.yml сломан
      const brokenAgloom = path.join(tmpDir, ".agloom");
      fs.mkdirSync(brokenAgloom, { recursive: true });
      fs.writeFileSync(path.join(brokenAgloom, "config.yml"), "this is: [not valid yaml\n");

      // Target: свежая директория, в которой init должен создать config.yml
      const freshAgloom = path.join(tmpDir, "fresh", ".agloom");
      fs.mkdirSync(freshAgloom, { recursive: true });

      const result = (await runCLI({
        argv: ["init", "--adapter", "claude", "--config", "-", "--agloom-dir", freshAgloom, "--project-dir", tmpDir],
        cwd: tmpDir,
        stdin: emptyStdin(),
      })) as RunCLIResult;

      expect(result.exitCode).toBe(0);
      expect(result.stdout + result.stderr).not.toMatch(/Invalid config/);
      expect(fs.existsSync(path.join(freshAgloom, "config.yml"))).toBe(true);
    });
  });

  // =====================================================================
  // Finding 3 / Round 2 Finding A — Single-I/O invariant.
  //
  // § cli-global-flags.md § Процедура Run CLI шаг 2:
  //   «rawConfig и loadedConfig — единственные результаты чтения и парсинга
  //    конфига за весь жизненный цикл CLI; команды НЕ ДОЛЖНЫ повторно
  //    вызывать Read Config Source или Load Config и НЕ ДОЛЖНЫ повторно
  //    читать configSource».
  //
  // Strategy: both branches of configSource must be covered.
  //   1. stdin branch — counting Readable whose `read()` call counter is
  //      directly asserted AND which destroys itself on re-subscription
  //      attempt (observable as a stream error in stderr).
  //   2. file branch — injectable `readFile` parameter to runCLI: tests
  //      wrap fs.promises.readFile with a counter keyed on the configSource
  //      path and assert the counter == 1.
  // =====================================================================
  describe("single I/O invariant — stdin branch", () => {
    it("counting Readable: стрим получает read() один раз для payload, повторная подписка destroy'ит стрим", async () => {
      // Minimal transpile-capable project
      fs.writeFileSync(path.join(tmpDir, "AGLOOM.md"), "# Instructions\n");

      // `dataReads` counts how many times read() produced payload data
      // (i.e. before EOF). `subscribeAttempts` counts re-subscriptions —
      // any value > 1 indicates a downstream double-read.
      let dataReads = 0;
      let postEofReads = 0;
      const yamlBody = "adapters:\n  - claude\n";

      const countingStdin = new Readable({
        read() {
          if (dataReads === 0) {
            dataReads += 1;
            this.push(yamlBody);
            this.push(null); // signal EOF
            return;
          }
          // Any read() after EOF means someone re-subscribed. Destroy the
          // stream with an error — the error surfaces as a stream 'error'
          // event observable in runCLI's stderr capture.
          postEofReads += 1;
          this.destroy(new Error("runCLI attempted to read stdin after EOF (single-I/O violation)"));
        },
      });

      const result = (await runCLI({
        argv: ["transpile", "--adapter", "claude", "--config", "-", "--project-dir", tmpDir],
        cwd: tmpDir,
        stdin: countingStdin,
      })) as RunCLIResult;

      const combined = result.stdout + result.stderr;

      // LOAD-BEARING ASSERTIONS on the counter (Round 2 Finding A):
      expect(dataReads).toBe(1); // payload consumed exactly once
      expect(postEofReads).toBe(0); // no re-subscription attempts

      // Defence-in-depth: a destroy-triggered error would bubble through
      // stderr if the counter guard above is ever silenced.
      expect(combined).not.toMatch(/single-I\/O violation/);
      expect(combined).not.toMatch(/stdin.*already|cannot read.*stdin|EOF/i);

      // POSITIVE: stdin data actually reached Load Config — transpile
      // ran with the claude adapter from stdin.
      expect(combined).toMatch(/claude|Done\.|Nothing to transpile|files written/);
    });
  });

  describe("single I/O invariant — file branch (injectable readFile counter)", () => {
    it("runCLI читает configSource.path через инжектируемый readFile ровно один раз", async () => {
      // Setup: valid config file + minimal transpile-capable project
      fs.writeFileSync(path.join(tmpDir, "AGLOOM.md"), "# Instructions\n");
      const cfgFile = path.join(tmpDir, "try.yml");
      fs.writeFileSync(cfgFile, "adapters:\n  - claude\n");

      // Counting hook. Keyed by resolved absolute path so only reads of
      // the configSource.path are counted (reads of AGLOOM.md, skills,
      // etc. are not load-bearing for the single-I/O invariant on
      // configSource).
      const reads: Record<string, number> = {};
      const countingReadFile = async (filePath: string, encoding?: BufferEncoding): Promise<string> => {
        reads[filePath] = (reads[filePath] ?? 0) + 1;
        return fs.promises.readFile(filePath, encoding ?? "utf-8") as Promise<string>;
      };

      const result = (await runCLI({
        argv: ["transpile", "--adapter", "claude", "--config", cfgFile, "--project-dir", tmpDir],
        cwd: tmpDir,
        stdin: emptyStdin(),
        // NEW PARAMETER (Round 2 Finding A): runCLI must accept an
        // optional `readFile` override. Implementation wires it through
        // Read Config Source so the counter observes every attempt at
        // reading configSource.path.
        readFile: countingReadFile,
      } as Parameters<typeof runCLI>[0])) as RunCLIResult;

      // LOAD-BEARING: config file read exactly once.
      expect(reads[cfgFile]).toBe(1);

      // POSITIVE sanity: pipeline actually consumed the config and ran
      // transpile — exitCode 0 and some transpile output.
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/Done\.|Nothing to transpile|files written/);
    });

    it("runCLI читает дефолтный configSource.path (<cwd>/.agloom/config.yml) через инжектируемый readFile ровно один раз", async () => {
      // Default-path variant: no explicit --config, pipeline resolves to
      // <cwd>/.agloom/config.yml and must still read it exactly once.
      fs.writeFileSync(path.join(tmpDir, "AGLOOM.md"), "# Instructions\n");
      const agloomDir = path.join(tmpDir, ".agloom");
      fs.mkdirSync(agloomDir, { recursive: true });
      const defaultCfg = path.join(agloomDir, "config.yml");
      fs.writeFileSync(defaultCfg, "adapters:\n  - claude\n");

      const reads: Record<string, number> = {};
      const countingReadFile = async (filePath: string, encoding?: BufferEncoding): Promise<string> => {
        reads[filePath] = (reads[filePath] ?? 0) + 1;
        return fs.promises.readFile(filePath, encoding ?? "utf-8") as Promise<string>;
      };

      const result = (await runCLI({
        argv: ["transpile", "--project-dir", tmpDir],
        cwd: tmpDir,
        stdin: emptyStdin(),
        readFile: countingReadFile,
      } as Parameters<typeof runCLI>[0])) as RunCLIResult;

      expect(reads[defaultCfg]).toBe(1);
      expect(result.exitCode).toBe(0);
    });
  });

  // =====================================================================
  // Finding 4 — end-to-end `--config -` with NON-empty stdin.
  //
  // Proves that the stdin YAML payload reaches the command handler and
  // influences its behaviour (not just that --config - is accepted).
  // =====================================================================
  describe("non-empty stdin reaches command handlers end-to-end", () => {
    it("adapters без флагов c --config - и stdin adapters:[claude] печатает ТОЛЬКО claude", async () => {
      const yamlBody = "adapters:\n  - claude\n";

      const result = (await runCLI({
        argv: ["adapters", "--config", "-", "--project-dir", tmpDir],
        cwd: tmpDir,
        stdin: stdinFrom(yamlBody),
      })) as RunCLIResult;

      expect(result.exitCode).toBe(0);
      // POSITIVE: stdin реально применился — активный адаптер == claude
      expect(result.stdout).toMatch(/claude/);
      // Active mode: прочие адаптеры НЕ должны появляться как активные
      expect(result.stdout).toContain("Active adapters");
      expect(result.stdout).not.toMatch(/opencode/);
      expect(result.stdout).not.toMatch(/agentsmd/);
    });
  });
});
