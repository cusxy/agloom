/**
 * Types for Permissions Transpiler.
 * Spec: docs/specs/permissions-transpiler.md § Типы данных
 */

/** Правила для shell-команд. */
export interface ShellPermissions {
  /** Паттерны разрешённых shell-команд. */
  allow: string[];
  /** Паттерны shell-команд, требующих подтверждения. */
  ask: string[];
  /** Паттерны запрещённых shell-команд. */
  deny: string[];
}

/** Правила для MCP-инструментов. */
export interface McpPermissions {
  /** Паттерны разрешённых MCP-инструментов. */
  allow: string[];
  /** Паттерны MCP-инструментов, требующих подтверждения. */
  ask: string[];
  /** Паттерны запрещённых MCP-инструментов. */
  deny: string[];
}

/** Правила доступа к файлам. */
export interface FilePermissions {
  /** Паттерны запрещённых путей. */
  deny: string[];
  /** Паттерны путей с доступом на чтение. */
  read: string[];
  /** Паттерны путей с доступом на чтение и запись. */
  write: string[];
}

/** Распарсенное содержимое канонического файла. */
export interface PermissionsCanonicalContent {
  /** Правила для shell-команд. */
  shell?: ShellPermissions;
  /** Правила для MCP-инструментов. */
  mcp?: McpPermissions;
  /** Правила доступа к файлам. */
  file?: FilePermissions;
}

/** Результат обнаружения канонического файла. */
export interface PermissionsCanonicalFile {
  /** Путь файла относительно projectRoot. */
  relativePath: string;
  /** Формат файла. */
  format: "yaml" | "json";
  /** Распарсенное содержимое. */
  content: PermissionsCanonicalContent;
}

/** Сгенерированный выходной файл. */
export interface PermissionsOutputFile {
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
  files: PermissionsOutputFile[];
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

/** Интерфейс Permissions-адаптера. */
export interface PermissionsAdapter {
  /** Уникальный идентификатор агента. */
  readonly agentId: string;
  /** Генерирует agent-specific permissions-файл из канонического файла. */
  transpile(file: PermissionsCanonicalFile): PermissionsOutputFile[];
}

/** Конфигурация Permissions-транспилера. */
export interface PermissionsTranspilerConfig {
  /** Абсолютный путь к корню проекта. */
  projectRoot: string;
  /** Массив адаптеров для целевых агентов. */
  adapters: PermissionsAdapter[];
  /** Относительный путь к agloom-директории (default: ".agloom"). */
  agloomDir?: string;
}
