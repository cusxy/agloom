/**
 * Gemini Permissions-адаптер.
 * Spec: docs/specs/permissions-transpiler.md § Gemini Permissions-адаптер
 *
 * agentId: "gemini"
 * Генерирует файл .gemini/policies/agloom.toml с массивом [[rule]].
 */

import * as TOML from "smol-toml";
import { TransformError } from "../errors.js";
import { dropShadowedRules } from "../preprocessing.js";
import type {
  McpPermissionRule,
  PermissionsAdapter,
  PermissionsCanonicalFile,
  PermissionsOutputFile,
  ShellPermissionRule,
} from "../types.js";

interface GeminiRule {
  toolName?: string;
  commandPrefix?: string;
  commandRegex?: string;
  mcpName?: string;
  decision: string;
  priority: number;
}

/**
 * Маппинг действий канонического формата в значения decision Gemini policy engine.
 */
function mapDecision(action: string): string {
  if (action === "allow") return "allow";
  if (action === "ask") return "ask_user";
  if (action === "deny") return "deny";
  return action;
}

/**
 * Экранирует regex-метасимволы (кроме "*", который обрабатывается отдельно).
 */
function escapeRegexLiteral(ch: string): string {
  // Список метасимволов, требующих экранирования в regex.
  if (/[.^$+?()[\]{}|\\]/.test(ch)) {
    return "\\" + ch;
  }
  return ch;
}

/**
 * Преобразует glob-паттерн в regex (для shell-команд с middle/leading wildcards).
 * Каждое "*" → ".+", остальные метасимволы экранируются.
 */
function globToRegex(pattern: string): string {
  let out = "";
  for (const ch of pattern) {
    if (ch === "*") {
      out += ".+";
    } else {
      out += escapeRegexLiteral(ch);
    }
  }
  return `^${out}$`;
}

/**
 * Извлекает паттерн и действие из одноключевого объекта правила.
 */
function extractRule(rule: Record<string, string>): [string, string] {
  const pattern = Object.keys(rule)[0];
  return [pattern, rule[pattern]];
}

/**
 * Трансформирует shell-паттерн в поля Gemini rule (toolName + commandPrefix или commandRegex).
 */
function transformShellRule(pattern: string, decision: string): GeminiRule {
  const rule: GeminiRule = { toolName: "run_shell_command", decision, priority: 0 };

  // Bare wildcard: без commandPrefix и commandRegex
  if (pattern === "*") {
    return rule;
  }

  // Трейлинг wildcard (" *"): commandPrefix
  if (pattern.endsWith(" *") && !pattern.slice(0, -2).includes("*")) {
    rule.commandPrefix = pattern.slice(0, -2);
    return rule;
  }

  // Без wildcard: commandPrefix
  if (!pattern.includes("*")) {
    rule.commandPrefix = pattern;
    return rule;
  }

  // Leading/middle wildcard: commandRegex
  rule.commandRegex = globToRegex(pattern);
  return rule;
}

export class GeminiPermissionsAdapter implements PermissionsAdapter {
  readonly agentId = "gemini";

  transpile(file: PermissionsCanonicalFile): PermissionsOutputFile[] {
    const rules: GeminiRule[] = [];

    // Шаг 2: file секция игнорируется
    if (file.content.file && file.content.file.length > 0) {
      process.stderr.write(
        "Warning: Gemini policy engine does not support file permissions. 'file' section ignored.\n",
      );
    }

    // Шаг 3: shell-правила (после препроцессинга)
    if (file.content.shell) {
      const preprocessed = dropShadowedRules(file.content.shell as ShellPermissionRule[], "shell");
      for (const rule of preprocessed) {
        const [pattern, action] = extractRule(rule);
        const geminiRule = transformShellRule(pattern, mapDecision(action));
        rules.push(geminiRule);
      }
    }

    // Шаг 4: mcp-правила (после препроцессинга)
    if (file.content.mcp) {
      const preprocessed = dropShadowedRules(file.content.mcp as McpPermissionRule[], "mcp");
      for (const rule of preprocessed) {
        const [pattern, action] = extractRule(rule);
        const colonIdx = pattern.indexOf(":");
        const server = pattern.slice(0, colonIdx);
        const tool = pattern.slice(colonIdx + 1);

        // *:* — пропустить с предупреждением
        if (server === "*" && tool === "*") {
          process.stderr.write(`Warning: Gemini does not support catch-all MCP pattern '*:*'. Rule skipped.\n`);
          continue;
        }

        const geminiRule: GeminiRule = { decision: mapDecision(action), priority: 0 };
        if (tool === "*") {
          // Только mcpName
          geminiRule.mcpName = server;
        } else {
          geminiRule.toolName = tool;
          geminiRule.mcpName = server;
        }
        rules.push(geminiRule);
      }
    }

    // Шаг 5: проверка priority overflow
    if (rules.length > 1000) {
      throw new TransformError(
        `Gemini policy engine supports at most 1000 rules per file (priority overflow). Got ${rules.length} rules.`,
      );
    }

    // Шаг 6: присвоить priority = 999 - i
    for (let i = 0; i < rules.length; i++) {
      rules[i].priority = 999 - i;
    }

    // Шаг 7-8: сериализовать в TOML array of tables
    const content = rules.length === 0 ? "\n" : TOML.stringify({ rule: rules }) + "\n";

    // Шаг 9
    return [{ relativePath: ".gemini/policies/agloom.toml", content }];
  }
}
