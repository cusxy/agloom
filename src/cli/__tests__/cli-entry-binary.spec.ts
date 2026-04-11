// cli-entry-binary.spec.ts
// Spec: docs/specs/cli.md § Entry point
// Spec: docs/specs/cli-global-flags.md § Процедура Run CLI
//
// Smoke test for the production CLI binary (`dist/cli/index.js`).
// Closes the gap between unit/integration tests that call runCLI directly
// (or render App via ink-testing-library) and the actual bundled bin that
// users invoke: both must route through runCLI so that `--config -` with
// non-empty stdin applies the piped YAML instead of silently normalizing
// stdin to an empty config.
//
// Requires `dist/cli/index.js` to exist — the test auto-skips if the
// bundle is missing (e.g., when running tests before `pnpm run build`).

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliPath = path.resolve(__dirname, "../../../dist/cli/index.js");
const cliExists = fs.existsSync(cliPath);

describe.skipIf(!cliExists)("CLI entry binary (dist/cli/index.js)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-cli-bin-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Critical regression: the original motivation for global CLI flags
  // was `cat try.yml | agloom transpile --config -`. Without this test,
  // a broken production bin (sync App fallback that normalizes stdin to
  // empty) passes every other test in the suite. This smoke test asserts
  // that the compiled bin actually reads from stdin.
  it("transpile --config - со stdin применяет конфиг и пишет файлы", async () => {
    const projDir = path.join(tmpDir, "proj");
    fs.mkdirSync(projDir, { recursive: true });
    fs.writeFileSync(
      path.join(projDir, "AGLOOM.md"),
      ["# Test", "<!-- agent:claude -->", "Stdin test content.", "<!-- /agent:claude -->", ""].join("\n"),
    );

    const child = spawn("node", [cliPath, "transpile", "--config", "-", "--project-dir", projDir], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    child.stdin.write("adapters:\n  - claude\n");
    child.stdin.end();

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    const exitCode = await new Promise<number>((resolve) => {
      child.on("close", (code) => resolve(code ?? 0));
    });

    const combined = stdout + stderr;

    // Production bin didn't short-circuit on "No adapters specified":
    // stdin config (adapters: [claude]) was actually consumed.
    expect(combined).not.toMatch(/No adapters specified/);
    // Transpile reached completion and wrote the claude-specific file.
    expect(combined).toMatch(/Done\.|files written/);
    expect(exitCode).toBe(0);
    expect(fs.existsSync(path.join(projDir, "CLAUDE.md"))).toBe(true);
    const claudeContent = fs.readFileSync(path.join(projDir, "CLAUDE.md"), "utf-8");
    expect(claudeContent).toContain("Stdin test content.");
  }, 20000);
});
