/**
 * OpenCode MCP-адаптер.
 * Spec: docs/specs/mcp-transpiler.md § OpenCode MCP-адаптер
 *
 * agentId: "opencode"
 * Генерирует файл opencode.json с ключами $schema, mcp и (опц.) permission.
 */

import { buildStdioServerConfig } from "./shared.js";
import type { McpAdapter, McpCanonicalFile, McpOutputFile } from "../types.js";

const OPENCODE_SCHEMA = "https://opencode.ai/config.json";

export class OpenCodeMcpAdapter implements McpAdapter {
  readonly agentId = "opencode";

  transpile(file: McpCanonicalFile): McpOutputFile[] {
    const mcpSection: Record<string, unknown> = {};
    const permissionSection: Record<string, string> = {};

    for (const [serverId, serverConfig] of Object.entries(file.content.mcpServers)) {
      const transport = serverConfig.type ?? "stdio";

      if (transport === "stdio") {
        const stdio = buildStdioServerConfig(serverConfig, false);
        mcpSection[serverId] = { type: "stdio", ...stdio };
      } else {
        // http | sse → remote. Headers не поддерживаются OpenCode.
        if (serverConfig.headers && Object.keys(serverConfig.headers).length > 0) {
          process.stderr.write(
            `Warning: OpenCode does not support MCP 'headers' field. Server '${serverId}': headers ignored.\n`,
          );
        }
        mcpSection[serverId] = { type: "remote", url: serverConfig.url };
      }

      if (serverConfig.includeTools) {
        for (const tool of serverConfig.includeTools) {
          permissionSection[`${serverId}_${tool}`] = "allow";
        }
      }
      if (serverConfig.excludeTools) {
        for (const tool of serverConfig.excludeTools) {
          permissionSection[`${serverId}_${tool}`] = "deny";
        }
      }
    }

    const output: Record<string, unknown> = {
      $schema: OPENCODE_SCHEMA,
      mcp: mcpSection,
    };
    if (Object.keys(permissionSection).length > 0) {
      output.permission = permissionSection;
    }

    const content = JSON.stringify(output, null, 2) + "\n";

    return [{ relativePath: "opencode.json", content }];
  }
}
