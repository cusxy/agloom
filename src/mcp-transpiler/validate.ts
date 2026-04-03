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
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

/**
 * Валидирует распарсенное содержимое канонического файла.
 *
 * Шаги:
 * 1. Проверить, что content является объектом.
 * 2. Проверить наличие поля mcpServers и что его значение является объектом.
 * 3. Для каждого MCP-сервера в mcpServers валидировать конфигурацию.
 */
export function validateCanonicalContent(
  content: unknown,
): McpCanonicalContent {
  // Шаг 1: content должен быть объектом
  // Расширение 1a
  if (
    typeof content !== "object" ||
    content === null ||
    Array.isArray(content)
  ) {
    throw new TransformError("MCP config must be an object");
  }

  const obj = content as Record<string, unknown>;

  // Шаг 2: поле mcpServers
  // Расширение 2a
  if (!("mcpServers" in obj)) {
    throw new TransformError("MCP config must contain 'mcpServers' field");
  }

  // Расширение 2b
  if (
    typeof obj.mcpServers !== "object" ||
    obj.mcpServers === null ||
    Array.isArray(obj.mcpServers)
  ) {
    throw new TransformError("'mcpServers' must be an object");
  }

  const mcpServers = obj.mcpServers as Record<string, unknown>;

  // Шаг 3: валидация каждого сервера
  for (const [serverId, serverConfig] of Object.entries(mcpServers)) {
    if (
      typeof serverConfig !== "object" ||
      serverConfig === null ||
      Array.isArray(serverConfig)
    ) {
      throw new TransformError(
        `Server '${serverId}': 'command' is required and must be a string`,
      );
    }

    const server = serverConfig as Record<string, unknown>;

    // 3.1: command обязательно и является строкой
    // Расширение 3b
    if (!("command" in server) || typeof server.command !== "string") {
      throw new TransformError(
        `Server '${serverId}': 'command' is required and must be a string`,
      );
    }

    // 3.2: args — массив строк
    // Расширение 3c
    if ("args" in server && server.args !== undefined) {
      if (!isStringArray(server.args)) {
        throw new TransformError(
          `Server '${serverId}': 'args' must be an array of strings`,
        );
      }
    }

    // 3.3: env — объект с string-значениями
    // Расширение 3d
    if ("env" in server && server.env !== undefined) {
      if (
        typeof server.env !== "object" ||
        server.env === null ||
        Array.isArray(server.env)
      ) {
        throw new TransformError(
          `Server '${serverId}': 'env' must be an object with string values`,
        );
      }
      const envObj = server.env as Record<string, unknown>;
      for (const val of Object.values(envObj)) {
        if (typeof val !== "string") {
          throw new TransformError(
            `Server '${serverId}': 'env' must be an object with string values`,
          );
        }
      }
    }

    // 3.4: includeTools — массив строк
    // Расширение 3e
    if ("includeTools" in server && server.includeTools !== undefined) {
      if (!isStringArray(server.includeTools)) {
        throw new TransformError(
          `Server '${serverId}': 'includeTools' must be an array of strings`,
        );
      }
    }

    // 3.5: excludeTools — массив строк
    // Расширение 3f
    if ("excludeTools" in server && server.excludeTools !== undefined) {
      if (!isStringArray(server.excludeTools)) {
        throw new TransformError(
          `Server '${serverId}': 'excludeTools' must be an array of strings`,
        );
      }
    }

    // 3.6: includeTools и excludeTools взаимоисключающие
    // Расширение 3a
    if (
      "includeTools" in server &&
      server.includeTools !== undefined &&
      "excludeTools" in server &&
      server.excludeTools !== undefined
    ) {
      throw new TransformError(
        `Server '${serverId}': 'includeTools' and 'excludeTools' are mutually exclusive`,
      );
    }
  }

  return content as McpCanonicalContent;
}
