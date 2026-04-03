// @agloom/markdown-tools — programmatic API for prettier and markdownlint
// Spec: docs/specs/format.md § Пакет @agloom/markdown-tools

import * as prettier from "prettier";
import { lint as markdownlint } from "markdownlint-cli2/markdownlint/promise";
import { applyFixes } from "markdownlint-cli2/markdownlint";
import * as fs from "node:fs";
import * as path from "node:path";

// § format.md § Поддерживаемые форматы
const PRETTIER_EXTENSIONS = new Set([
  ".md",
  ".mdx",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
]);
const MARKDOWNLINT_EXTENSIONS = new Set([".md", ".mdx"]);

// § format.md § Встроенные дефолтные конфиги § Prettier
const DEFAULT_PRETTIER_CONFIG: Record<string, unknown> = {
  proseWrap: "preserve",
  tabWidth: 2,
};

// § format.md § Встроенные дефолтные конфиги § Markdownlint
const DEFAULT_MARKDOWNLINT_CONFIG: Record<string, unknown> = {
  MD007: { indent: 2 },
  MD013: { line_length: 120, tables: false },
  MD024: { siblings_only: true },
  MD049: { style: "underscore" },
  MD050: { style: "asterisk" },
};

// § format.md § Метод format § Результат
export interface FormatResult {
  formattedCount: number;
  errors: string[];
}

// § format.md § Метод check § Результат
export interface CheckResult {
  checkedCount: number;
  failures: string[];
  errors: string[];
}

export interface MarkdownToolsConfig {
  projectRoot: string;
  prettierOverrides?: Record<string, unknown>;
  markdownlintOverrides?: Record<string, unknown>;
}

export interface MarkdownTools {
  format(filePaths: string[]): Promise<FormatResult>;
  check(filePaths: string[]): Promise<CheckResult>;
}

function getExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

/**
 * Determine the prettier parser to use for a given file extension.
 * JSON files use json-stringify parser for canonical multi-line output.
 */
function getPrettierParser(ext: string): string | undefined {
  switch (ext) {
    case ".json":
      return "json-stringify";
    default:
      return undefined; // let prettier detect from filepath
  }
}

/**
 * Resolve prettier config for a file:
 * Level 1: built-in defaults
 * Level 2: native config files (prettier resolves itself)
 * Level 3: prettierOverrides (shallow merge on top)
 */
async function resolvePrettierConfig(
  filePath: string,
  prettierOverrides: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const nativeConfig = await prettier.resolveConfig(filePath);
  if (nativeConfig) {
    // Level 2 overrides level 1, level 3 overrides all
    return {
      ...DEFAULT_PRETTIER_CONFIG,
      ...nativeConfig,
      ...prettierOverrides,
    };
  }
  // No native config: level 1 + level 3
  return { ...DEFAULT_PRETTIER_CONFIG, ...prettierOverrides };
}

/**
 * Resolve markdownlint config:
 * Level 1: built-in defaults
 * Level 3: markdownlintOverrides (shallow merge on top)
 * Level 2 (native files) is handled by markdownlint itself.
 */
function resolveMarkdownlintConfig(
  markdownlintOverrides: Record<string, unknown>,
): Record<string, unknown> {
  return { ...DEFAULT_MARKDOWNLINT_CONFIG, ...markdownlintOverrides };
}

// § format.md § Инициализация — createMarkdownTools(config)
export function createMarkdownTools(
  config: MarkdownToolsConfig,
): MarkdownTools {
  const { projectRoot } = config;
  const prettierOverrides = config.prettierOverrides ?? {};
  const markdownlintOverrides = config.markdownlintOverrides ?? {};

  // Suppress projectRoot unused lint — it's used for context
  void projectRoot;

  return {
    // § format.md § Метод format
    async format(filePaths: string[]): Promise<FormatResult> {
      let formattedCount = 0;
      const errors: string[] = [];

      for (const filePath of filePaths) {
        const ext = getExtension(filePath);

        // Extension 1a: unsupported extension → skip
        if (!PRETTIER_EXTENSIONS.has(ext)) {
          continue;
        }

        let prettierSuccess = false;

        // Step 2: prettier --write
        try {
          const content = fs.readFileSync(filePath, "utf-8");
          const prettierConfig = await resolvePrettierConfig(
            filePath,
            prettierOverrides,
          );
          const parser = getPrettierParser(ext);
          const plugins = ext === ".toml" ? ["prettier-plugin-toml"] : [];
          const formatted = await prettier.format(content, {
            ...prettierConfig,
            filepath: filePath,
            ...(parser ? { parser } : {}),
            ...(plugins.length > 0 ? { plugins } : {}),
          });
          fs.writeFileSync(filePath, formatted);
          prettierSuccess = true;
        } catch (err: unknown) {
          // Extension 2a: prettier error → add to errors, continue
          const message = err instanceof Error ? err.message : String(err);
          errors.push(`prettier: ${filePath}: ${message}`);
        }

        let markdownlintSuccess = false;

        // Step 3: markdownlint --fix for .md/.mdx
        if (MARKDOWNLINT_EXTENSIONS.has(ext)) {
          try {
            const content = fs.readFileSync(filePath, "utf-8");
            const mlConfig = resolveMarkdownlintConfig(markdownlintOverrides);
            const results = await markdownlint({
              strings: { [filePath]: content },
              config: mlConfig,
            });
            const fileResults = results[filePath] || [];
            if (fileResults.length > 0) {
              const fixed = applyFixes(content, fileResults);
              fs.writeFileSync(filePath, fixed);
            }
            markdownlintSuccess = true;
          } catch (err: unknown) {
            // Extension 3a: markdownlint error → add to errors, continue
            const message = err instanceof Error ? err.message : String(err);
            errors.push(`markdownlint: ${filePath}: ${message}`);
          }
        }

        // formattedCount: files successfully processed by at least one tool
        if (prettierSuccess || markdownlintSuccess) {
          formattedCount++;
        }
      }

      return { formattedCount, errors };
    },

    // § format.md § Метод check
    async check(filePaths: string[]): Promise<CheckResult> {
      let checkedCount = 0;
      const failures: string[] = [];
      const errors: string[] = [];

      for (const filePath of filePaths) {
        const ext = getExtension(filePath);

        // Extension 1a: unsupported extension → skip
        if (!PRETTIER_EXTENSIONS.has(ext)) {
          continue;
        }

        let prettierChecked = false;
        let prettierReadError = false;

        // Step 2: prettier --check
        try {
          const content = fs.readFileSync(filePath, "utf-8");
          const prettierConfig = await resolvePrettierConfig(
            filePath,
            prettierOverrides,
          );
          const parser = getPrettierParser(ext);
          const plugins = ext === ".toml" ? ["prettier-plugin-toml"] : [];
          const isFormatted = await prettier.check(content, {
            ...prettierConfig,
            filepath: filePath,
            ...(parser ? { parser } : {}),
            ...(plugins.length > 0 ? { plugins } : {}),
          });
          prettierChecked = true;
          if (!isFormatted) {
            // Extension 2a: file needs formatting → add to failures
            failures.push(`${filePath}: prettier: needs formatting`);
          }
        } catch (err: unknown) {
          // Extension 2b: prettier runtime error → add to errors
          const message = err instanceof Error ? err.message : String(err);
          const isReadError =
            err instanceof Error &&
            "code" in err &&
            (err as NodeJS.ErrnoException).code === "EACCES";
          if (isReadError) {
            prettierReadError = true;
          }
          errors.push(`prettier: ${filePath}: ${message}`);
        }

        let markdownlintChecked = false;

        // Step 3: markdownlint (no --fix) for .md/.mdx
        if (MARKDOWNLINT_EXTENSIONS.has(ext)) {
          try {
            const content = fs.readFileSync(filePath, "utf-8");
            const mlConfig = resolveMarkdownlintConfig(markdownlintOverrides);
            const results = await markdownlint({
              strings: { [filePath]: content },
              config: mlConfig,
            });
            markdownlintChecked = true;
            const fileResults = results[filePath] || [];
            if (fileResults.length > 0) {
              // Extension 3a: violations → add path + descriptions to failures
              for (const violation of fileResults) {
                const ruleName = violation.ruleNames[0] || "unknown";
                const desc = violation.ruleDescription || "";
                const detail = violation.errorDetail
                  ? `: ${violation.errorDetail}`
                  : "";
                failures.push(
                  `${filePath}:${violation.lineNumber}: ${ruleName} ${desc}${detail}`,
                );
              }
            }
          } catch (err: unknown) {
            // Extension 3b: markdownlint runtime error → add to errors
            const message = err instanceof Error ? err.message : String(err);
            errors.push(`markdownlint: ${filePath}: ${message}`);
          }
        }

        // checkedCount: files checked by at least one tool
        if (prettierChecked || markdownlintChecked) {
          checkedCount++;
        }
        // If both failed due to read error, file is still not counted
        // but errors are recorded
        void prettierReadError;
      }

      return { checkedCount, failures, errors };
    },
  };
}
