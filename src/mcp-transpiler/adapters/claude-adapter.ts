/**
 * Claude Code MCP-адаптер.
 * Spec: docs/specs/mcp-transpiler.md § Claude Code MCP-адаптер
 *
 * agentId: "claude"
 * Генерирует файлы .mcp.json и .claude/settings.json в корне проекта.
 */

import { buildStdioServerConfig, buildRemoteServerConfig } from "./shared.js";
import type { McpAdapter, McpCanonicalFile, McpOutputFile } from "../types.js";

const CLAUDE_SETTINGS_SCHEMA = "https://json.schemastore.org/claude-code-settings.json";

export class ClaudeMcpAdapter implements McpAdapter {
  readonly agentId = "claude";

  transpile(file: McpCanonicalFile): McpOutputFile[] {
    const mcpServers: Record<string, unknown> = {};
    const allow: string[] = [];
    const deny: string[] = [];

    for (const [serverId, serverConfig] of Object.entries(file.content.mcpServers)) {
      const transport = serverConfig.type ?? "stdio";

      if (transport === "stdio") {
        mcpServers[serverId] = buildStdioServerConfig(serverConfig, false);
      } else if (transport === "http") {
        const remote = buildRemoteServerConfig(serverConfig);
        mcpServers[serverId] = { type: "http", ...remote };
      } else {
        // sse
        const remote = buildRemoteServerConfig(serverConfig);
        mcpServers[serverId] = { type: "sse", ...remote };
      }

      if (serverConfig.includeTools) {
        for (const tool of serverConfig.includeTools) {
          allow.push(`mcp__${serverId}__${tool}`);
        }
      }
      if (serverConfig.excludeTools) {
        for (const tool of serverConfig.excludeTools) {
          deny.push(`mcp__${serverId}__${tool}`);
        }
      }
    }

    // .mcp.json
    const mcpOutput = { mcpServers };
    const mcpContent = JSON.stringify(mcpOutput, null, 2) + "\n";

    // .claude/settings.json
    const settingsOutput: Record<string, unknown> = {
      $schema: CLAUDE_SETTINGS_SCHEMA,
    };
    if (allow.length > 0 || deny.length > 0) {
      const permissions: Record<string, unknown> = {};
      if (allow.length > 0) permissions.allow = allow;
      if (deny.length > 0) permissions.deny = deny;
      settingsOutput.permissions = permissions;
    }
    const settingsContent = JSON.stringify(settingsOutput, null, 2) + "\n";

    return [
      { relativePath: ".mcp.json", content: mcpContent },
      { relativePath: ".claude/settings.json", content: settingsContent },
    ];
  }
}
