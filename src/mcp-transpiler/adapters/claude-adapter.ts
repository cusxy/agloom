/**
 * Claude Code MCP-адаптер.
 * Spec: docs/specs/mcp-transpiler.md § Claude Code MCP-адаптер
 *
 * agentId: "claude"
 * Генерирует файл .mcp.json в корне проекта.
 */

import { buildBaseServerConfig } from "./shared.js";
import type { McpAdapter, McpCanonicalFile, McpOutputFile } from "../types.js";

export class ClaudeMcpAdapter implements McpAdapter {
  readonly agentId = "claude";

  transpile(file: McpCanonicalFile): McpOutputFile[] {
    // Шаг 1: создать объект output с полем mcpServers
    const output: Record<string, unknown> = { mcpServers: {} };
    const mcpServers = output.mcpServers as Record<string, unknown>;

    // Шаг 2: для каждого сервера — Build Base Server Config
    for (const [serverId, serverConfig] of Object.entries(
      file.content.mcpServers,
    )) {
      mcpServers[serverId] = buildBaseServerConfig(serverConfig);
    }

    // Шаг 3: сериализовать JSON с отступом 2 пробела и завершающим переводом строки
    const content = JSON.stringify(output, null, 2) + "\n";

    // Шаг 4: сформировать McpOutputFile
    return [{ relativePath: ".mcp.json", content }];
  }
}
