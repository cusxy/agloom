/**
 * Kilocode Permissions-адаптер.
 * Spec: docs/specs/permissions-transpiler.md § Kilocode Permissions-адаптер
 *
 * agentId: "kilocode"
 * Генерирует файл kilo.jsonc в корне проекта с ключом "permission".
 * Блок mcpServers / $schema пишется MCP-транспилером и сохраняется через deep merge.
 */

import type {
  FilePermissionRule,
  McpPermissionRule,
  PermissionRule,
  PermissionsAdapter,
  PermissionsCanonicalFile,
  PermissionsOutputFile,
  ShellPermissionRule,
} from "../types.js";

/**
 * Трансформирует MCP-паттерн для Kilocode: ':' заменяется на '_'.
 */
function transformMcpPattern(pattern: string): string {
  return pattern.replace(":", "_");
}

/**
 * Извлекает паттерн и действие из одноключевого объекта правила.
 */
function extractRule(rule: PermissionRule): [string, string] {
  const pattern = Object.keys(rule)[0];
  return [pattern, rule[pattern]];
}

/**
 * Раскрывает canonical file-действие в три категории Kilocode (read/edit/write).
 */
function expandFileAction(action: string): { read: string; edit: string; write: string } {
  if (action === "deny") {
    return { read: "deny", edit: "deny", write: "deny" };
  }
  if (action === "read") {
    return { read: "allow", edit: "deny", write: "deny" };
  }
  if (action === "write") {
    return { read: "allow", edit: "allow", write: "allow" };
  }
  return { read: action, edit: action, write: action };
}

export class KilocodePermissionsAdapter implements PermissionsAdapter {
  readonly agentId = "kilocode";

  transpile(file: PermissionsCanonicalFile): PermissionsOutputFile[] {
    // Шаг 1: создать пустой объект permission
    const permission: Record<string, unknown> = {};

    // Шаг 2: MCP-правила (flat-ключи)
    if (file.content.mcp && file.content.mcp.length > 0) {
      const reversed = [...(file.content.mcp as McpPermissionRule[])].reverse();
      for (const rule of reversed) {
        const [pattern, action] = extractRule(rule);
        permission[transformMcpPattern(pattern)] = action;
      }
    }

    // Шаг 3: shell-правила
    if (file.content.shell && file.content.shell.length > 0) {
      const reversed = [...(file.content.shell as ShellPermissionRule[])].reverse();
      const bash: Record<string, string> = {};
      for (const rule of reversed) {
        const [pattern, action] = extractRule(rule);
        bash[pattern] = action;
      }
      permission.bash = bash;
    }

    // Шаг 4: file-правила (раскрытие в read/edit/write)
    if (file.content.file && file.content.file.length > 0) {
      const reversed = [...(file.content.file as FilePermissionRule[])].reverse();
      const read: Record<string, string> = {};
      const edit: Record<string, string> = {};
      const write: Record<string, string> = {};
      for (const rule of reversed) {
        const [pattern, action] = extractRule(rule);
        const expanded = expandFileAction(action);
        read[pattern] = expanded.read;
        edit[pattern] = expanded.edit;
        write[pattern] = expanded.write;
      }
      permission.read = read;
      permission.edit = edit;
      permission.write = write;
    }

    // Шаг 5-6: сериализовать output
    const output = { permission };
    const content = JSON.stringify(output, null, 2) + "\n";

    // Шаг 7
    return [{ relativePath: "kilo.jsonc", content }];
  }
}
