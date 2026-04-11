/**
 * Claude Code MCP-адаптер.
 * Spec: docs/specs/mcp-transpiler.md § Claude Code MCP-адаптер
 *
 * agentId: "claude"
 * Генерирует единственный файл .mcp.json в корне проекта.
 */

import { buildStdioServerConfig, buildRemoteServerConfig } from "./shared.js";
import type { McpAdapter, McpCanonicalFile, McpOutputFile } from "../types.js";

export class ClaudeMcpAdapter implements McpAdapter {
  readonly agentId = "claude";

  transpile(file: McpCanonicalFile): McpOutputFile[] {
    const mcpServers: Record<string, unknown> = {};

    for (const [serverId, serverConfig] of Object.entries(file.content.mcpServers)) {
      const transport = serverConfig.type ?? "stdio";

      if (transport === "stdio") {
        const stdio = buildStdioServerConfig(serverConfig, false);
        mcpServers[serverId] = { type: "stdio", ...stdio };
      } else if (transport === "http") {
        const remote = buildRemoteServerConfig(serverConfig);
        mcpServers[serverId] = { type: "http", ...remote };
      } else {
        // sse
        const remote = buildRemoteServerConfig(serverConfig);
        mcpServers[serverId] = { type: "sse", ...remote };
      }

      const hasInclude = serverConfig.includeTools && serverConfig.includeTools.length > 0;
      const hasExclude = serverConfig.excludeTools && serverConfig.excludeTools.length > 0;
      if (hasInclude || hasExclude) {
        process.stderr.write(
          `Warning: Claude Code does not support discovery-level tool filtering. Server '${serverId}': 'includeTools'/'excludeTools' ignored. Use .agloom/permissions.yml for postfactum permission gating.\n`,
        );
      }
    }

    const mcpOutput = { mcpServers };
    const mcpContent = JSON.stringify(mcpOutput, null, 2) + "\n";

    return [{ relativePath: ".mcp.json", content: mcpContent }];
  }
}
