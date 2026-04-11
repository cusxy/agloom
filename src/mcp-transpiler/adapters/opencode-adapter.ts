/**
 * OpenCode MCP-адаптер.
 * Spec: docs/specs/mcp-transpiler.md § OpenCode MCP-адаптер
 *
 * agentId: "opencode"
 * Генерирует файл opencode.json с ключами $schema и mcp.
 */

import { buildStdioServerConfig } from "./shared.js";
import type { McpAdapter, McpCanonicalFile, McpOutputFile } from "../types.js";

const OPENCODE_SCHEMA = "https://opencode.ai/config.json";

export class OpenCodeMcpAdapter implements McpAdapter {
  readonly agentId = "opencode";

  transpile(file: McpCanonicalFile): McpOutputFile[] {
    const mcpSection: Record<string, unknown> = {};

    for (const [serverId, serverConfig] of Object.entries(file.content.mcpServers)) {
      const transport = serverConfig.type ?? "stdio";

      if (transport === "sse") {
        process.stderr.write(`Warning: OpenCode does not support SSE transport. Server '${serverId}' skipped.\n`);
        continue;
      }

      if (transport === "stdio") {
        const stdio = buildStdioServerConfig(serverConfig, false);
        mcpSection[serverId] = { type: "stdio", ...stdio };
      } else {
        // http → remote
        const entry: Record<string, unknown> = {
          type: "remote",
          url: serverConfig.url,
        };
        if (serverConfig.headers && Object.keys(serverConfig.headers).length > 0) {
          entry.headers = serverConfig.headers;
        }
        mcpSection[serverId] = entry;
      }

      const hasInclude = serverConfig.includeTools && serverConfig.includeTools.length > 0;
      const hasExclude = serverConfig.excludeTools && serverConfig.excludeTools.length > 0;
      if (hasInclude || hasExclude) {
        process.stderr.write(
          `Warning: OpenCode does not support discovery-level tool filtering. Server '${serverId}': 'includeTools'/'excludeTools' ignored. Use .agloom/permissions.yml for postfactum permission gating.\n`,
        );
      }
    }

    const output: Record<string, unknown> = {
      $schema: OPENCODE_SCHEMA,
      mcp: mcpSection,
    };

    const content = JSON.stringify(output, null, 2) + "\n";

    return [{ relativePath: "opencode.json", content }];
  }
}
