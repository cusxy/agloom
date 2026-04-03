/**
 * Процедура Build Base Server Config.
 * Spec: docs/specs/mcp-transpiler.md § Процедура Build Base Server Config
 *
 * Общая процедура построения базовой конфигурации MCP-сервера
 * из канонического формата. Переиспользуется адаптерами Claude и OpenCode.
 */

import type { McpServerConfig } from "../types.js";

/**
 * Строит базовую конфигурацию сервера, отбрасывая includeTools/excludeTools.
 *
 * Шаги:
 * 1. Создать объект с полем command.
 * 2. Если args присутствует и непуст — добавить поле args.
 * 3. Если env присутствует и непуст — добавить поле env.
 * 4. includeTools и excludeTools отбрасываются.
 */
export function buildBaseServerConfig(
  serverConfig: McpServerConfig,
): Record<string, unknown> {
  const base: Record<string, unknown> = { command: serverConfig.command };

  // Шаг 2: args — только если присутствует и непуст
  if (serverConfig.args && serverConfig.args.length > 0) {
    base.args = serverConfig.args;
  }

  // Шаг 3: env — только если присутствует и непуст
  if (serverConfig.env && Object.keys(serverConfig.env).length > 0) {
    base.env = serverConfig.env;
  }

  // Шаг 4: includeTools и excludeTools отбрасываются (не добавляются)

  return base;
}
