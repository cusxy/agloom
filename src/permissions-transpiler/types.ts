/**
 * Types for Permissions Transpiler.
 * Spec: docs/specs/permissions-transpiler.md § Типы данных
 */

/**
 * Единичное правило разрешений -- объект с ровно одним ключом.
 * Ключ -- паттерн, значение -- действие.
 */
export type PermissionRule = Record<string, string>;

/** Правило для shell-команд: { "<pattern>": "allow" | "ask" | "deny" }. */
export type ShellPermissionRule = PermissionRule;

/** Правило для MCP-инструментов: { "<server>:<tool>": "allow" | "ask" | "deny" }. */
export type McpPermissionRule = PermissionRule;

/** Правило доступа к файлам: { "<pattern>": "deny" | "read" | "write" }. */
export type FilePermissionRule = PermissionRule;

/** Распарсенное содержимое канонического файла. */
export interface PermissionsCanonicalContent {
  /** Правила для shell-команд. */
  shell?: ShellPermissionRule[];
  /** Правила для MCP-инструментов. */
  mcp?: McpPermissionRule[];
  /** Правила доступа к файлам. */
  file?: FilePermissionRule[];
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
