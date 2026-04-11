/**
 * Gemini MCP-адаптер.
 * Spec: docs/specs/mcp-transpiler.md § Gemini MCP-адаптер
 *
 * agentId: "gemini"
 * Генерирует файл .gemini/settings.json.
 */

import { buildStdioServerConfig } from "./shared.js";
import type { McpAdapter, McpCanonicalFile, McpOutputFile } from "../types.js";

const GEMINI_SCHEMA = "https://raw.githubusercontent.com/google-gemini/gemini-cli/main/schemas/settings.schema.json";

export class GeminiMcpAdapter implements McpAdapter {
  readonly agentId = "gemini";

  transpile(file: McpCanonicalFile): McpOutputFile[] {
    const mcpServers: Record<string, unknown> = {};

    for (const [serverId, serverConfig] of Object.entries(file.content.mcpServers)) {
      const transport = serverConfig.type ?? "stdio";
      let entry: Record<string, unknown>;

      if (transport === "stdio") {
        entry = buildStdioServerConfig(serverConfig, true);
      } else if (transport === "http") {
        // http → ключ httpUrl (не url)
        entry = { httpUrl: serverConfig.url };
        if (serverConfig.headers && Object.keys(serverConfig.headers).length > 0) {
          entry.headers = serverConfig.headers;
        }
      } else {
        // sse → ключ url (не httpUrl)
        entry = { url: serverConfig.url };
        if (serverConfig.headers && Object.keys(serverConfig.headers).length > 0) {
          entry.headers = serverConfig.headers;
        }
      }

      if (serverConfig.includeTools) {
        entry.includeTools = serverConfig.includeTools;
      }
      if (serverConfig.excludeTools) {
        entry.excludeTools = serverConfig.excludeTools;
      }

      mcpServers[serverId] = entry;
    }

    const output = {
      $schema: GEMINI_SCHEMA,
      mcpServers,
    };
    const content = JSON.stringify(output, null, 2) + "\n";

    return [{ relativePath: ".gemini/settings.json", content }];
  }
}
