/**
 * OpenCode MCP-адаптер.
 * Spec: docs/specs/mcp-transpiler.md § OpenCode MCP-адаптер
 *
 * agentId: "opencode"
 * Генерирует файл opencode.json с ключом "mcp".
 */

import { buildBaseServerConfig } from "./shared.js";
import type { McpAdapter, McpCanonicalFile, McpOutputFile } from "../types.js";

export class OpenCodeMcpAdapter implements McpAdapter {
  readonly agentId = "opencode";

  transpile(file: McpCanonicalFile): McpOutputFile[] {
    // Шаг 1: создать объект mcpSection
    const mcpSection: Record<string, unknown> = {};

    // Шаг 2: для каждого сервера — Build Base Server Config
    for (const [serverId, serverConfig] of Object.entries(file.content.mcpServers)) {
      mcpSection[serverId] = buildBaseServerConfig(serverConfig);
    }

    // Шаг 3: сформировать объект output с ключом "mcp"
    const output = { mcp: mcpSection };

    // Шаг 4: сериализовать JSON с отступом 2 пробела и завершающим переводом строки
    const content = JSON.stringify(output, null, 2) + "\n";

    // Шаг 5: сформировать McpOutputFile
    return [{ relativePath: "opencode.json", content }];
  }
}
