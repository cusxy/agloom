/**
 * Codex Permissions-адаптер.
 * Spec: docs/specs/permissions-transpiler.md § Codex Permissions-адаптер
 *
 * agentId: "codex"
 * Генерирует файл .codex/rules/agloom.rules (Starlark-like prefix_rule calls).
 */

import type {
  PermissionsAdapter,
  PermissionsCanonicalFile,
  PermissionsOutputFile,
  ShellPermissionRule,
} from "../types.js";
import { dropShadowedRules, flattenWhitelistConflicts } from "../preprocessing.js";

/**
 * Маппинг действий канонического формата в значения decision Codex rules.
 */
function mapDecision(action: string): string {
  if (action === "allow") return "allow";
  if (action === "ask") return "prompt";
  if (action === "deny") return "forbidden";
  return action;
}

/**
 * Преобразует shell-паттерн в argv-массив либо возвращает null для skip.
 *
 * Правила:
 * 1. Трейлинг-wildcard (" *") — strip и split whitespace.
 * 2. Без "*" — split whitespace целиком.
 * 3. bare "*" — skip.
 * 4. leading "*" — skip.
 * 5. middle "*" — skip.
 */
function patternToArgv(pattern: string): string[] | null {
  // Правило 3: bare wildcard
  if (pattern === "*") {
    return null;
  }
  // Правило 4: leading wildcard
  if (pattern.startsWith("*")) {
    return null;
  }
  // Правило 1: трейлинг wildcard
  if (pattern.endsWith(" *")) {
    const stripped = pattern.slice(0, -2);
    // Если после strip остаётся "*" где-то — middle wildcard (skip)
    if (stripped.includes("*")) {
      return null;
    }
    return stripped.split(/\s+/).filter((s) => s.length > 0);
  }
  // Правило 5: middle wildcard (в любой другой позиции)
  if (pattern.includes("*")) {
    return null;
  }
  // Правило 2: без wildcard
  return pattern.split(/\s+/).filter((s) => s.length > 0);
}

/**
 * Извлекает паттерн и действие из одноключевого объекта правила.
 */
function extractRule(rule: Record<string, string>): [string, string] {
  const pattern = Object.keys(rule)[0];
  return [pattern, rule[pattern]];
}

/**
 * Форматирует prefix_rule вызов.
 */
function formatPrefixRule(argv: string[], decision: string): string {
  const patternLiteral = argv.map((t) => `"${t}"`).join(", ");
  return `prefix_rule(\n    pattern = [${patternLiteral}],\n    decision = "${decision}",\n)`;
}

export class CodexPermissionsAdapter implements PermissionsAdapter {
  readonly agentId = "codex";

  transpile(file: PermissionsCanonicalFile): PermissionsOutputFile[] {
    const lines: string[] = [];

    // Шаг 2: mcp секция игнорируется
    if (file.content.mcp && file.content.mcp.length > 0) {
      process.stderr.write(
        "Warning: Codex does not support per-tool MCP gating in rules file. 'mcp' section ignored. Use Codex config.toml (enabled_tools/disabled_tools) via MCP transpiler.\n",
      );
    }

    // Шаг 3: file секция игнорируется
    if (file.content.file && file.content.file.length > 0) {
      process.stderr.write("Warning: Codex does not support file permissions. 'file' section ignored.\n");
    }

    // Шаг 4: shell-правила (после препроцессинга)
    if (file.content.shell) {
      const preprocessed = flattenWhitelistConflicts(
        dropShadowedRules(file.content.shell as ShellPermissionRule[], "shell"),
        "shell",
      );
      for (const rule of preprocessed) {
        const [pattern, action] = extractRule(rule);
        const argv = patternToArgv(pattern);
        if (argv === null) {
          process.stderr.write(`Warning: Codex does not support shell pattern '${pattern}'. Rule skipped.\n`);
          continue;
        }
        lines.push(formatPrefixRule(argv, mapDecision(action)));
      }
    }

    // Шаг 5-6: объединить с пустой строкой и добавить завершающий \n
    // Расширение 4a: пустой/all-skipped => "\n"
    const content = lines.length === 0 ? "\n" : lines.join("\n\n") + "\n";

    return [{ relativePath: ".codex/rules/agloom.rules", content }];
  }
}
