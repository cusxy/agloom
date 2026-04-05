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
  PermissionRule,
} from "../types.js";

/**
 * Трансформирует MCP-паттерн для OpenCode: ':' заменяется на '_'.
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

export class OpenCodePermissionsAdapter implements PermissionsAdapter {
  readonly agentId = "opencode";

  transpile(file: PermissionsCanonicalFile): PermissionsOutputFile[] {
    // Шаг 1: создать пустой объект permission
    const permission: Record<string, unknown> = {};

    // Шаг 2: MCP-правила (плоские ключи в permission)
    if (file.content.mcp && file.content.mcp.length > 0) {
      // 2.1: развернуть массив MCP-правил (reverse)
      const reversed = [...file.content.mcp].reverse();
      // 2.2: для каждого правила -- трансформировать и добавить
      for (const rule of reversed) {
        const [pattern, action] = extractRule(rule);
        permission[transformMcpPattern(pattern)] = action;
      }
    }

    // Шаг 3: shell-правила (объект bash внутри permission)
    if (file.content.shell && file.content.shell.length > 0) {
      // 3.1: развернуть массив shell-правил (reverse)
      const reversed = [...file.content.shell].reverse();
      // 3.2: создать объект bash
      const bash: Record<string, string> = {};
      // 3.3: для каждого правила -- передать паттерн as-is
      for (const rule of reversed) {
        const [pattern, action] = extractRule(rule);
        bash[pattern] = action;
      }
      // 3.4: добавить bash в permission
      permission.bash = bash;
    }

    // Шаг 4: file-правила (объект file внутри permission)
    if (file.content.file && file.content.file.length > 0) {
      // 4.1: развернуть массив file-правил (reverse)
      const reversed = [...file.content.file].reverse();
      // 4.2: создать объект file
      const fileObj: Record<string, string> = {};
      // 4.3: для каждого правила -- добавить как ключ-значение
      for (const rule of reversed) {
        const [pattern, action] = extractRule(rule);
        fileObj[pattern] = action;
      }
      // 4.4: добавить file в permission
      permission.file = fileObj;
    }

    // Шаг 5-6: сформировать и сериализовать output
    const output = { permission };
    const content = JSON.stringify(output, null, 2) + "\n";

    // Шаг 7: сформировать PermissionsOutputFile
    return [{ relativePath: "opencode.json", content }];
  }
}
