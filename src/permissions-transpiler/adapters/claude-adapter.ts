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
} from "../types.js";

/**
 * Трансформирует shell-паттерн в формат Claude Code: Bash(<command>:<args-glob>).
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

export class ClaudePermissionsAdapter implements PermissionsAdapter {
  readonly agentId = "claude";

  transpile(file: PermissionsCanonicalFile): PermissionsOutputFile[] {
    // Шаг 1: создать пустой объект permissions
    const allow: string[] = [];
    const deny: string[] = [];

    // Шаг 2: shell-правила
    if (file.content.shell) {
      // 2.1: allow
      for (const pattern of file.content.shell.allow ?? []) {
        allow.push(transformShellPattern(pattern));
      }

      // 2.2: ask — пропускаем с предупреждением
      const askCount = (file.content.shell.ask ?? []).length;
      if (askCount > 0) {
        process.stderr.write(
          `Warning: Claude Code does not support 'ask' action. ${askCount} shell rule(s) skipped.\n`,
        );
      }

      // 2.3: deny
      for (const pattern of file.content.shell.deny ?? []) {
        deny.push(transformShellPattern(pattern));
      }
    }

    // Шаг 3: MCP-правила
    if (file.content.mcp) {
      // 3.1: allow
      for (const pattern of file.content.mcp.allow ?? []) {
        allow.push(transformMcpPattern(pattern));
      }

      // 3.2: ask — пропускаем с предупреждением
      const askCount = (file.content.mcp.ask ?? []).length;
      if (askCount > 0) {
        process.stderr.write(
          `Warning: Claude Code does not support 'ask' action. ${askCount} mcp rule(s) skipped.\n`,
        );
      }

      // 3.3: deny
      for (const pattern of file.content.mcp.deny ?? []) {
        deny.push(transformMcpPattern(pattern));
      }
    }

    // Шаг 4: file-секция — предупреждение
    if (file.content.file) {
      process.stderr.write(
        "Warning: Claude Code does not support file permissions. 'file' section ignored.\n",
      );
    }

    // Шаг 5: удалить пустые массивы
    const permissions: Record<string, string[]> = {};
    if (allow.length > 0) {
      permissions.allow = allow;
    }
    if (deny.length > 0) {
      permissions.deny = deny;
    }

    // Шаг 6-7: сформировать и сериализовать output
    const output = { permissions };
    const content = JSON.stringify(output, null, 2) + "\n";

    // Шаг 8: сформировать PermissionsOutputFile
    return [{ relativePath: ".claude/settings.json", content }];
  }
}
