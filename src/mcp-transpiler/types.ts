/**
 * Types for MCP Transpiler.
 * Spec: docs/specs/mcp-transpiler.md
 */

/** Транспорт MCP-сервера. */
export type McpTransportType = "stdio" | "http" | "sse";

/** Конфигурация MCP-сервера в каноническом файле. */
export interface McpServerConfig {
  /** Транспорт (default: "stdio"). */
  type?: McpTransportType;
  /** Команда запуска MCP-сервера (для stdio). */
  command?: string;
  /** Аргументы команды (для stdio). */
  args?: string[];
  /** Переменные окружения для процесса MCP-сервера (для stdio). */
  env?: Record<string, string>;
  /** URL удалённого MCP-сервера (для http / sse). */
  url?: string;
  /** HTTP-заголовки при подключении (для http / sse). */
  headers?: Record<string, string>;
  /** Whitelist инструментов. */
  includeTools?: string[];
  /** Blacklist инструментов. */
  excludeTools?: string[];
}

/** Распарсенное содержимое канонического файла. */
export interface McpCanonicalContent {
  /** Конфигурация MCP-серверов. */
  mcpServers: Record<string, McpServerConfig>;
}

/** Результат обнаружения канонического файла. */
export interface McpCanonicalFile {
  /** Путь файла относительно projectRoot. */
  relativePath: string;
  /** Формат файла. */
  format: "yaml" | "json";
  /** Распарсенное содержимое. */
  content: McpCanonicalContent;
}

/** Сгенерированный выходной файл. */
export interface McpOutputFile {
  /** Путь файла относительно projectRoot. */
  relativePath: string;
  /** Сериализованное содержимое файла. */
  content: string;
}

/** Ошибка транспиляции адаптера. */
export interface TranspileError {
  /** Идентификатор адаптера. */
  agentId: string;
  /** Описание ошибки. */
  message: string;
  /** Исходное исключение адаптера. */
  cause: Error;
}

/** Результат транспиляции для одного адаптера. */
export interface TranspileResult {
  /** Идентификатор агента. */
  agentId: string;
  /** Список сгенерированных файлов. */
  files: McpOutputFile[];
  /** Ошибки, возникшие при транспиляции данного адаптера. */
  errors: TranspileError[];
}

/** Результат записи файлов. */
export interface WriteResult {
  /** Относительные пути успешно записанных файлов. */
  written: string[];
  /** Ошибки записи. */
  errors: import("./errors.js").WriteError[];
}

/** Интерфейс MCP-адаптера. */
export interface McpAdapter {
  /** Уникальный идентификатор агента. */
  readonly agentId: string;
  /** Генерирует agent-specific MCP-файл из канонического файла. */
  transpile(file: McpCanonicalFile): McpOutputFile[];
}

/** Конфигурация MCP-транспилера. */
export interface McpTranspilerConfig {
  /** Абсолютный путь к корню проекта. */
  projectRoot: string;
  /** Массив адаптеров для целевых агентов. */
  adapters: McpAdapter[];
  /** Относительный путь к agloom-директории (default: ".agloom"). */
  agloomDir?: string;
}
