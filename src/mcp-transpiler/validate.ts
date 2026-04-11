/**
 * Валидация канонического MCP-файла.
 * Spec: docs/specs/mcp-transpiler.md § Валидация канонического файла
 */

import { TransformError } from "./errors.js";
import type { McpCanonicalContent } from "./types.js";

/**
 * Проверяет, является ли значение массивом строк.
 */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/**
 * Проверяет, является ли значение plain object со string-значениями.
 */
function isStringRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value as Record<string, unknown>).every((v) => typeof v === "string");
}

const VALID_TRANSPORTS = new Set(["stdio", "http", "sse"]);

/**
 * Валидирует распарсенное содержимое канонического файла.
 */
export function validateCanonicalContent(content: unknown): McpCanonicalContent {
  // Шаг 1
  // Расширение 1a
  if (typeof content !== "object" || content === null || Array.isArray(content)) {
    throw new TransformError("MCP config must be an object");
  }

  const obj = content as Record<string, unknown>;

  // Шаг 2
  // Расширение 2a
  if (!("mcpServers" in obj)) {
    throw new TransformError("MCP config must contain 'mcpServers' field");
  }

  // Расширение 2b
  if (typeof obj.mcpServers !== "object" || obj.mcpServers === null || Array.isArray(obj.mcpServers)) {
    throw new TransformError("'mcpServers' must be an object");
  }

  const mcpServers = obj.mcpServers as Record<string, unknown>;

  // Шаг 3: валидация каждого сервера
  for (const [serverId, serverConfig] of Object.entries(mcpServers)) {
    if (typeof serverConfig !== "object" || serverConfig === null || Array.isArray(serverConfig)) {
      throw new TransformError(`Server '${serverId}': 'command' is required for stdio transport and must be a string`);
    }

    const server = serverConfig as Record<string, unknown>;

    // 3.1: определить транспорт
    let transport: "stdio" | "http" | "sse";
    if ("type" in server && server.type !== undefined) {
      if (typeof server.type !== "string" || !VALID_TRANSPORTS.has(server.type)) {
        // Расширение 3.1a
        throw new TransformError(`Server '${serverId}': 'type' must be one of 'stdio', 'http', 'sse'`);
      }
      transport = server.type as "stdio" | "http" | "sse";
    } else {
      transport = "stdio";
    }

    if (transport === "stdio") {
      // 3.2a: command обязательно
      if (!("command" in server) || typeof server.command !== "string") {
        throw new TransformError(
          `Server '${serverId}': 'command' is required for stdio transport and must be a string`,
        );
      }

      // 3.2b: args
      if ("args" in server && server.args !== undefined) {
        if (!isStringArray(server.args)) {
          throw new TransformError(`Server '${serverId}': 'args' must be an array of strings`);
        }
      }

      // 3.2c: env
      if ("env" in server && server.env !== undefined) {
        if (!isStringRecord(server.env)) {
          throw new TransformError(`Server '${serverId}': 'env' must be an object with string values`);
        }
      }

      // 3.2d: url / headers запрещены
      if (("url" in server && server.url !== undefined) || ("headers" in server && server.headers !== undefined)) {
        throw new TransformError(`Server '${serverId}': 'url' and 'headers' are not allowed for stdio transport`);
      }
    } else {
      // http | sse
      // 3.3a: url обязательно
      if (!("url" in server) || typeof server.url !== "string") {
        throw new TransformError(
          `Server '${serverId}': 'url' is required for ${transport} transport and must be a string`,
        );
      }

      // 3.3b: headers
      if ("headers" in server && server.headers !== undefined) {
        if (!isStringRecord(server.headers)) {
          throw new TransformError(`Server '${serverId}': 'headers' must be an object with string values`);
        }
      }

      // 3.3c: command / args / env запрещены
      if (
        ("command" in server && server.command !== undefined) ||
        ("args" in server && server.args !== undefined) ||
        ("env" in server && server.env !== undefined)
      ) {
        throw new TransformError(
          `Server '${serverId}': 'command', 'args', 'env' are not allowed for ${transport} transport`,
        );
      }
    }

    // 3.4: includeTools
    if ("includeTools" in server && server.includeTools !== undefined) {
      if (!isStringArray(server.includeTools)) {
        throw new TransformError(`Server '${serverId}': 'includeTools' must be an array of strings`);
      }
    }

    // 3.5: excludeTools
    if ("excludeTools" in server && server.excludeTools !== undefined) {
      if (!isStringArray(server.excludeTools)) {
        throw new TransformError(`Server '${serverId}': 'excludeTools' must be an array of strings`);
      }
    }

    // 3.6: mutually exclusive
    if (
      "includeTools" in server &&
      server.includeTools !== undefined &&
      "excludeTools" in server &&
      server.excludeTools !== undefined
    ) {
      throw new TransformError(`Server '${serverId}': 'includeTools' and 'excludeTools' are mutually exclusive`);
    }
  }

  return content as McpCanonicalContent;
}
