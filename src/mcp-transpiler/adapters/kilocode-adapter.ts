/**
 * Kilocode MCP-адаптер.
 * Spec: docs/specs/mcp-transpiler.md § Kilocode MCP-адаптер
 *
 * agentId: "kilocode"
 * Генерирует файл kilo.jsonc в корне проекта.
 */

import { buildStdioServerConfig } from "./shared.js";
import type { McpAdapter, McpCanonicalFile, McpOutputFile } from "../types.js";

const KILOCODE_SCHEMA = "https://app.kilo.ai/config.json";

export class KilocodeMcpAdapter implements McpAdapter {
  readonly agentId = "kilocode";

  transpile(file: McpCanonicalFile): McpOutputFile[] {
    const mcpServers: Record<string, unknown> = {};

    for (const [serverId, serverConfig] of Object.entries(file.content.mcpServers)) {
      const transport = serverConfig.type ?? "stdio";
      let entry: Record<string, unknown>;

      if (transport === "stdio") {
        entry = buildStdioServerConfig(serverConfig, false);
      } else if (transport === "http") {
        // http → type: "streamable-http"
        entry = { type: "streamable-http", url: serverConfig.url };
        if (serverConfig.headers && Object.keys(serverConfig.headers).length > 0) {
          entry.headers = serverConfig.headers;
        }
      } else {
        // sse → type: "sse"
        entry = { type: "sse", url: serverConfig.url };
        if (serverConfig.headers && Object.keys(serverConfig.headers).length > 0) {
          entry.headers = serverConfig.headers;
        }
      }

      const hasInclude = serverConfig.includeTools && serverConfig.includeTools.length > 0;
      const hasExclude = serverConfig.excludeTools && serverConfig.excludeTools.length > 0;
      if (hasInclude || hasExclude) {
        process.stderr.write(
          `Warning: Kilocode does not support discovery-level tool filtering. Server '${serverId}': 'includeTools'/'excludeTools' ignored. Use .agloom/permissions.yml for postfactum permission gating (Kilocode alwaysAllow will be emitted by the permissions transpiler).\n`,
        );
      }

      mcpServers[serverId] = entry;
    }

    const output = {
      $schema: KILOCODE_SCHEMA,
      mcpServers,
    };
    const content = JSON.stringify(output, null, 2) + "\n";

    return [{ relativePath: "kilo.jsonc", content }];
  }
}
