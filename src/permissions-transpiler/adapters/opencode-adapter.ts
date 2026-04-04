/**
 * OpenCode Permissions-адаптер.
 * Spec: docs/specs/permissions-transpiler.md § OpenCode Permissions-адаптер
 *
 * agentId: "opencode"
 * Генерирует файл opencode.json с ключом "permission".
 */

import type {
  PermissionsAdapter,
  PermissionsCanonicalFile,
  PermissionsOutputFile,
} from "../types.js";

/**
 * Трансформирует shell-паттерн для OpenCode: ':' заменяется на пробел.
 * Специальный случай: "*:*" -> "*" (без пробела).
 */
function transformShellPattern(pattern: string): string {
  if (pattern === "*:*") {
    return "*";
  }
  return pattern.replace(":", " ");
}

/**
 * Трансформирует MCP-паттерн для OpenCode: ':' заменяется на '_'.
 */
function transformMcpPattern(pattern: string): string {
  return pattern.replace(":", "_");
}

/**
 * Инвертирует порядок правил для last-match-wins семантики.
 * Формирует массив пар (pattern, action) из массивов по действиям,
 * затем разворачивает.
 */
function invertRules(
  groups: Array<{ patterns: string[]; action: string }>,
): Array<{ pattern: string; action: string }> {
  const pairs: Array<{ pattern: string; action: string }> = [];
  for (const group of groups) {
    for (const pattern of group.patterns) {
      pairs.push({ pattern, action: group.action });
    }
  }
  pairs.reverse();
  return pairs;
}

export class OpenCodePermissionsAdapter implements PermissionsAdapter {
  readonly agentId = "opencode";

  transpile(file: PermissionsCanonicalFile): PermissionsOutputFile[] {
    // Шаг 1: создать пустой объект permission
    const permission: Record<string, unknown> = {};

    // Шаг 2: MCP-правила (плоские ключи в permission)
    if (file.content.mcp) {
      const pairs = invertRules([
        { patterns: file.content.mcp.allow ?? [], action: "allow" },
        { patterns: file.content.mcp.ask ?? [], action: "ask" },
        { patterns: file.content.mcp.deny ?? [], action: "deny" },
      ]);

      if (pairs.length > 0) {
        for (const { pattern, action } of pairs) {
          permission[transformMcpPattern(pattern)] = action;
        }
      }
    }

    // Шаг 3: shell-правила (объект bash внутри permission)
    if (file.content.shell) {
      const pairs = invertRules([
        { patterns: file.content.shell.allow ?? [], action: "allow" },
        { patterns: file.content.shell.ask ?? [], action: "ask" },
        { patterns: file.content.shell.deny ?? [], action: "deny" },
      ]);

      if (pairs.length > 0) {
        const bash: Record<string, string> = {};
        for (const { pattern, action } of pairs) {
          bash[transformShellPattern(pattern)] = action;
        }
        permission.bash = bash;
      }
    }

    // Шаг 4: file-правила (объект file внутри permission)
    if (file.content.file) {
      const pairs = invertRules([
        { patterns: file.content.file.deny ?? [], action: "deny" },
        { patterns: file.content.file.read ?? [], action: "read" },
        { patterns: file.content.file.write ?? [], action: "write" },
      ]);

      if (pairs.length > 0) {
        const fileObj: Record<string, string> = {};
        for (const { pattern, action } of pairs) {
          fileObj[pattern] = action;
        }
        permission.file = fileObj;
      }
    }

    // Шаг 5-6: сформировать и сериализовать output
    const output = { permission };
    const content = JSON.stringify(output, null, 2) + "\n";

    // Шаг 7: сформировать PermissionsOutputFile
    return [{ relativePath: "opencode.json", content }];
  }
}
