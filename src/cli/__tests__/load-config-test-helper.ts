/**
 * Test helper: `loadConfigFromFile(tmpDir)` — reads `.agloom/config.yml`
 * from a temp project directory, parses it as YAML, and runs `loadConfig`
 * on the parsed RawConfig.
 *
 * After the cleanup cycle removed the legacy `loadConfig(projectRoot)`
 * overload (spec: docs/specs/cli-global-flags.md § Процедура Load Config),
 * existing unit tests that used to call `loadConfig(tmpDir)` go through
 * this helper instead. The helper preserves the same inputs/outputs:
 *
 * - Missing config file → returns `null` (same as the old overload).
 * - Valid YAML → returns `LoadConfigResult`.
 * - Invalid YAML / non-object top-level → throws (same error messages).
 *
 * Read Config Source is intentionally NOT used here: those tests pre-date
 * the Run CLI pipeline and exercise Load Config in isolation. Using
 * `readConfigSource` would force them to construct a full `ConfigSource`
 * object for each assertion.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import yaml from "js-yaml";
import { loadConfig, type LoadConfigResult } from "../config.js";

export function loadConfigFromFile(tmpDir: string): LoadConfigResult | null {
  const configPath = path.join(tmpDir, ".agloom", "config.yml");
  if (!fs.existsSync(configPath)) {
    return null;
  }
  const content = fs.readFileSync(configPath, "utf-8");
  let parsed: unknown;
  try {
    parsed = yaml.load(content);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid config file: ${message}`);
  }
  if (parsed === null || parsed === undefined) {
    parsed = {};
  }
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid config: 'adapters' must be an array of strings.");
  }
  return loadConfig({ kind: "parsed", value: parsed as Record<string, unknown> });
}
