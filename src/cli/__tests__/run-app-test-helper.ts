/**
 * Test helper: runApp — adapter between legacy render(<App .../>) test
 * patterns and the new runCLI({argv, cwd, stdin}) entry point.
 *
 * Spec: docs/specs/cli-global-flags.md § Процедура Run CLI
 *
 * After the migration cleanup cycle, App no longer supports a sync fallback
 * pipeline and requires `runCLI` to inject `paths`, `rawConfig`, and
 * `loadedConfig`. Legacy tests that previously rendered App directly via
 * ink-testing-library now go through this helper which:
 *
 * - Runs the full Run CLI pipeline (Resolve Global Flags → Read Config
 *   Source → Load Config → dispatch command) via `runCLI`.
 * - Captures stdout/stderr into a single `output` string.
 * - Exposes a minimal `lastFrame()` / `unmount()` shape so most existing
 *   test bodies (including `vi.waitFor(() => expect(lastFrame())...)`)
 *   keep working unchanged. `lastFrame()` returns the final captured
 *   output — the helper resolves only after runCLI has fully completed,
 *   so polling becomes trivially synchronous.
 */

import { Readable } from "node:stream";
import { runCLI } from "../run-cli.js";

export interface RunAppOptions {
  args: string[];
  projectRoot?: string;
  stdin?: string;
}

export interface RunAppHandle {
  /** Final captured stdout+stderr joined as a single string. */
  lastFrame: () => string;
  /** Stdout as captured from runCLI. */
  stdout: string;
  /** Stderr as captured from runCLI. */
  stderr: string;
  /** Exit code reported by runCLI. */
  exitCode: number;
  /** No-op — present only to match the legacy ink-testing-library API. */
  unmount: () => void;
}

/**
 * Run CLI via the production front-end pipeline and return a legacy-shaped
 * test handle.
 *
 * The returned Promise resolves only after runCLI fully completes, so any
 * subsequent `vi.waitFor(() => lastFrame()...)` in the test body passes
 * immediately. This preserves the existing invariant that tests wait until
 * the terminal state is reached before asserting on the frame.
 */
export async function runApp(opts: RunAppOptions): Promise<RunAppHandle> {
  const cwd = opts.projectRoot ?? process.cwd();
  const stdin: Readable = opts.stdin !== undefined ? Readable.from([opts.stdin]) : Readable.from([]);

  const result = await runCLI({
    argv: opts.args,
    cwd,
    stdin,
  });

  // Legacy tests assert on `process.exitCode` (set directly by the old
  // sync App render path). runCLI intentionally restores exitCode after
  // it runs so that multiple runCLI invocations inside one test process
  // don't bleed into each other. For legacy assertions to keep working,
  // propagate the captured exit code back to `process.exitCode` here.
  // Tests that expected `exit code 0` use `toBeUndefined()`, so only
  // non-zero results are written.
  if (result.exitCode !== 0) {
    process.exitCode = result.exitCode;
  }

  // Combine stdout+stderr into a single "frame" so that existing assertions
  // that previously scanned `lastFrame()` for substrings keep finding both
  // normal command output (stdout) and error text (stderr).
  const frame = result.stdout + result.stderr;

  return {
    lastFrame: () => frame,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    unmount: () => {},
  };
}
