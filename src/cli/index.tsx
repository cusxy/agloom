#!/usr/bin/env node

/**
 * CLI entry point.
 *
 * Spec: docs/specs/cli.md § Entry point
 * Spec: docs/specs/cli-global-flags.md § Процедура Run CLI
 *
 * Production bin делегирует в `runCLI`, передавая реальные process-streams.
 * Это единственный entry-point, который проходит через полный front-end
 * пайплайн (Resolve Global Flags → Read Config Source → Load Config →
 * диспатч команды), гарантируя, что `--config -` со stdin и все остальные
 * глобальные флаги работают в production-бинаре одинаково с тестами.
 */

import { runCLI } from "./run-cli.js";

const result = await runCLI({
  argv: process.argv.slice(2),
  cwd: process.cwd(),
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr,
});
process.exitCode = result.exitCode;
