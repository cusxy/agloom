/**
 * Общие процедуры построения конфигурации MCP-сервера.
 * Spec: docs/specs/mcp-transpiler.md § Процедура Build Stdio Server Config
 * Spec: docs/specs/mcp-transpiler.md § Процедура Build Remote Server Config
 */

import type { McpServerConfig } from "../types.js";

/**
 * Строит базовую stdio-конфигурацию сервера.
 *
 * Поведение:
 * 1. Создать объект с полем command.
 * 2. Если args присутствует и непуст — добавить поле args.
 * 3. Если env присутствует и непуст — добавить поле env.
 * 4. Если supportsToolFiltering === false — includeTools/excludeTools
 *    отбрасываются (адаптер оборачивает их отдельно).
 * 5. Если supportsToolFiltering === true — адаптер сам добавит native поля.
 */
export function buildStdioServerConfig(
  serverConfig: McpServerConfig,
  _supportsToolFiltering: boolean,
): Record<string, unknown> {
  const base: Record<string, unknown> = { command: serverConfig.command };

  if (serverConfig.args && serverConfig.args.length > 0) {
    base.args = serverConfig.args;
  }

  if (serverConfig.env && Object.keys(serverConfig.env).length > 0) {
    base.env = serverConfig.env;
  }

  // includeTools / excludeTools никогда не записываются этой процедурой.
  // Адаптер отвечает за их native-обёртку (или транспиляцию в permissions).
  void _supportsToolFiltering;

  return base;
}

/**
 * Строит базовую remote-конфигурацию сервера (http / sse).
 *
 * Поведение:
 * 1. Создать объект с полем url.
 * 2. Если headers присутствует и непусто — добавить поле headers.
 */
export function buildRemoteServerConfig(serverConfig: McpServerConfig): Record<string, unknown> {
  const base: Record<string, unknown> = { url: serverConfig.url };

  if (serverConfig.headers && Object.keys(serverConfig.headers).length > 0) {
    base.headers = serverConfig.headers;
  }

  return base;
}
