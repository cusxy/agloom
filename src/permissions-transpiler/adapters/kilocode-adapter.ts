/**
 * Kilocode Permissions-адаптер.
 * Spec: docs/specs/permissions-transpiler.md § Kilocode Permissions-адаптер
 *
 * agentId: "kilocode"
 * Генерирует файл kilo.jsonc в корне проекта с ключом "permission" и
 * (опционально) "mcpServers.<server>.alwaysAllow" для concrete-tool allow
 * MCP-правил. Остальная часть mcpServers (command/args/url/$schema) пишется
 * MCP-транспилером и объединяется через deep-merge layer model.
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
import { dropShadowedRules } from "../preprocessing.js";

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

interface McpServerEntry {
  alwaysAllow: string[];
}

export class KilocodePermissionsAdapter implements PermissionsAdapter {
  readonly agentId = "kilocode";

  transpile(file: PermissionsCanonicalFile): PermissionsOutputFile[] {
    // Шаг 1: создать пустой объект permission
    const permission: Record<string, unknown> = {};
    const mcpServers: Record<string, McpServerEntry> = {};

    // Шаг 2: MCP-правила (flat-ключи + alwaysAllow ownership)
    if (file.content.mcp && file.content.mcp.length > 0) {
      const preprocessed = dropShadowedRules(file.content.mcp as McpPermissionRule[], "mcp");

      // 2a: собрать alwaysAllow из concrete-tool allow-правил (canonical order)
      for (const rule of preprocessed) {
        const [pattern, action] = extractRule(rule);
        if (action !== "allow") continue;
        const colonIdx = pattern.indexOf(":");
        if (colonIdx === -1) continue;
        const server = pattern.slice(0, colonIdx);
        const tool = pattern.slice(colonIdx + 1);
        // Wildcard server — пропустить
        if (server === "*") continue;
        // Bulk allow — warning и skip
        if (tool === "*") {
          process.stderr.write(
            `Warning: Kilocode 'alwaysAllow' requires concrete tool names; bulk allow pattern '${pattern}' cannot be expanded (tool set of the server is not known at transpile time). Flat permission key '${pattern.replace(":", "_")}' emitted; per-tool alwaysAllow not populated.\n`,
          );
          continue;
        }
        if (!mcpServers[server]) {
          mcpServers[server] = { alwaysAllow: [] };
        }
        if (!mcpServers[server].alwaysAllow.includes(tool)) {
          mcpServers[server].alwaysAllow.push(tool);
        }
      }

      // 2b: flat-ключи <server>_<tool> с reverse (last-match-wins)
      const reversed = [...preprocessed].reverse();
      for (const rule of reversed) {
        const [pattern, action] = extractRule(rule);
        permission[transformMcpPattern(pattern)] = action;
      }
    }

    // Шаг 3: shell-правила
    if (file.content.shell && file.content.shell.length > 0) {
      const preprocessed = dropShadowedRules(file.content.shell as ShellPermissionRule[], "shell");
      const reversed = [...preprocessed].reverse();
      const bash: Record<string, string> = {};
      for (const rule of reversed) {
        const [pattern, action] = extractRule(rule);
        bash[pattern] = action;
      }
      permission.bash = bash;
    }

    // Шаг 4: file-правила (раскрытие в read/edit/write)
    if (file.content.file && file.content.file.length > 0) {
      const preprocessed = dropShadowedRules(file.content.file as FilePermissionRule[], "file");
      const reversed = [...preprocessed].reverse();
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
    const output: Record<string, unknown> = { permission };
    if (Object.keys(mcpServers).length > 0) {
      output.mcpServers = mcpServers;
    }
    const content = JSON.stringify(output, null, 2) + "\n";

    // Шаг 7
    return [{ relativePath: "kilo.jsonc", content }];
  }
}
