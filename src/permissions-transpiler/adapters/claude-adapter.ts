/**
 * Claude Code Permissions-адаптер.
 * Spec: docs/specs/permissions-transpiler.md § Claude Code Permissions-адаптер
 *
 * agentId: "claude"
 * Генерирует файл .claude/settings.json с ключом "permissions".
 */

import type {
  PermissionsAdapter,
  PermissionsCanonicalFile,
  PermissionsOutputFile,
  ShellPermissionRule,
  McpPermissionRule,
} from "../types.js";
import { dropShadowedRules, flattenWhitelistConflicts } from "../preprocessing.js";

/**
 * Трансформирует shell-паттерн в формат Claude Code: Bash(<pattern>).
 */
function transformShellPattern(pattern: string): string {
  return `Bash(${pattern})`;
}

/**
 * Трансформирует MCP-паттерн в формат Claude Code: mcp__<server>__<tool>.
 */
function transformMcpPattern(pattern: string): string {
  return `mcp__${pattern.replace(":", "__")}`;
}

/**
 * Извлекает паттерн и действие из одноключевого объекта правила.
 */
function extractRule(rule: Record<string, string>): [string, string] {
  const pattern = Object.keys(rule)[0];
  return [pattern, rule[pattern]];
}

export class ClaudePermissionsAdapter implements PermissionsAdapter {
  readonly agentId = "claude";

  transpile(file: PermissionsCanonicalFile): PermissionsOutputFile[] {
    // Шаг 1: создать пустой объект permissions
    const allow: string[] = [];
    const deny: string[] = [];

    // Шаг 2: shell-правила -- итерировать ordered list (после препроцессинга)
    if (file.content.shell) {
      const preprocessed = flattenWhitelistConflicts(
        dropShadowedRules(file.content.shell as ShellPermissionRule[], "shell"),
        "shell",
      );
      let askCount = 0;
      for (const rule of preprocessed) {
        const [pattern, action] = extractRule(rule);
        if (action === "allow") {
          allow.push(transformShellPattern(pattern));
        } else if (action === "deny") {
          deny.push(transformShellPattern(pattern));
        } else if (action === "ask") {
          askCount++;
        }
      }
      // 2.3: предупреждение о пропущенных ask-правилах
      if (askCount > 0) {
        process.stderr.write(
          `Warning: Claude Code does not support 'ask' action. ${askCount} shell rule(s) skipped.\n`,
        );
      }
    }

    // Шаг 3: MCP-правила -- итерировать ordered list (после препроцессинга)
    if (file.content.mcp) {
      const preprocessed = flattenWhitelistConflicts(
        dropShadowedRules(file.content.mcp as McpPermissionRule[], "mcp"),
        "mcp",
      );
      let askCount = 0;
      for (const rule of preprocessed) {
        const [pattern, action] = extractRule(rule);
        if (action === "allow") {
          allow.push(transformMcpPattern(pattern));
        } else if (action === "deny") {
          deny.push(transformMcpPattern(pattern));
        } else if (action === "ask") {
          askCount++;
        }
      }
      // 3.3: предупреждение о пропущенных ask-правилах
      if (askCount > 0) {
        process.stderr.write(`Warning: Claude Code does not support 'ask' action. ${askCount} mcp rule(s) skipped.\n`);
      }
    }

    // Шаг 4: file-секция — предупреждение
    if (file.content.file) {
      process.stderr.write("Warning: Claude Code does not support file permissions. 'file' section ignored.\n");
    }

    // Шаг 5: удалить пустые массивы
    const permissions: Record<string, string[]> = {};
    if (allow.length > 0) {
      permissions.allow = allow;
    }
    if (deny.length > 0) {
      permissions.deny = deny;
    }

    // Шаг 6: проверить, что permissions непуст
    // Расширение 6a: пустой permissions -> пустой объект {} без ключа "permissions"
    const hasPermissions = Object.keys(permissions).length > 0;
    const output = hasPermissions ? { permissions } : {};

    // Шаг 7-8: сериализовать
    const content = JSON.stringify(output, null, 2) + "\n";

    // Шаг 9: сформировать PermissionsOutputFile
    return [{ relativePath: ".claude/settings.json", content }];
  }
}
