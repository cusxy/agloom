/**
 * Codex MCP-адаптер.
 * Spec: docs/specs/mcp-transpiler.md § Codex MCP-адаптер
 * Spec: docs/specs/mcp-transpiler.md § Процедура TOML-сериализации MCP-конфигурации
 *
 * agentId: "codex"
 * Генерирует файл .codex/config.toml.
 */

import * as TOML from "smol-toml";
import type { McpAdapter, McpCanonicalFile, McpOutputFile, McpServerConfig } from "../types.js";

const CODEX_SCHEMA_LINE = "#:schema https://developers.openai.com/codex/config-schema.json";

/**
 * Строит entry одного сервера с детерминированным порядком ключей:
 * command → args → url → http_headers → enabled_tools → disabled_tools → env.
 *
 * Ключи nested-таблиц (env, http_headers) smol-toml автоматически
 * перемещает в конец после scalar/array ключей, что совпадает с требуемым
 * порядком из § Процедура TOML-сериализации.
 */
function buildCodexEntry(serverConfig: McpServerConfig): Record<string, unknown> {
  const entry: Record<string, unknown> = {};
  const transport = serverConfig.type ?? "stdio";

  if (transport === "stdio") {
    if (serverConfig.command !== undefined) {
      entry.command = serverConfig.command;
    }
    if (serverConfig.args && serverConfig.args.length > 0) {
      entry.args = serverConfig.args;
    }
  } else {
    // http
    entry.url = serverConfig.url;
    if (serverConfig.headers && Object.keys(serverConfig.headers).length > 0) {
      entry.http_headers = serverConfig.headers;
    }
  }

  if (serverConfig.includeTools) {
    entry.enabled_tools = serverConfig.includeTools;
  }
  if (serverConfig.excludeTools) {
    entry.disabled_tools = serverConfig.excludeTools;
  }

  if (transport === "stdio" && serverConfig.env && Object.keys(serverConfig.env).length > 0) {
    entry.env = serverConfig.env;
  }

  return entry;
}

export class CodexMcpAdapter implements McpAdapter {
  readonly agentId = "codex";

  transpile(file: McpCanonicalFile): McpOutputFile[] {
    const mcpServers: Record<string, unknown> = {};

    for (const [serverId, serverConfig] of Object.entries(file.content.mcpServers)) {
      const transport = serverConfig.type ?? "stdio";

      if (transport === "sse") {
        process.stderr.write(`Warning: Codex does not support SSE transport. Server '${serverId}' skipped.\n`);
        continue;
      }

      mcpServers[serverId] = buildCodexEntry(serverConfig);
    }

    // Сериализация TOML
    let tomlBody: string;
    if (Object.keys(mcpServers).length === 0) {
      tomlBody = "";
    } else {
      tomlBody = TOML.stringify({ mcp_servers: mcpServers } as unknown as TOML.TomlPrimitive);
      if (!tomlBody.endsWith("\n")) tomlBody += "\n";
    }

    const content = tomlBody.length > 0 ? `${CODEX_SCHEMA_LINE}\n\n${tomlBody}` : `${CODEX_SCHEMA_LINE}\n`;

    return [{ relativePath: ".codex/config.toml", content }];
  }
}
