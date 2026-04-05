/**
 * Types for Instructions Transpiler.
 * Spec: docs/specs/instructions-transpiler.md
 */

/** Тип канонического файла. */
export type CanonicalFileType = "root" | "directory" | "local" | "directory-local";

/** Канонический файл, обнаруженный в проекте. */
export interface CanonicalFile {
  /** Путь файла относительно projectRoot. */
  relativePath: string;
  /** Тип файла. */
  type: CanonicalFileType;
  /** Содержимое файла (raw Markdown). */
  content: string;
}

/** Сгенерированный выходной файл. */
export interface OutputFile {
  /** Путь файла относительно projectRoot. */
  relativePath: string;
  /** Содержимое файла. */
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
  files: OutputFile[];
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

/** Интерфейс адаптера. */
export interface Adapter {
  /** Уникальный идентификатор агента. */
  readonly agentId: string;
  /** Генерирует agent-specific файлы из канонических файлов. */
  transpile(files: CanonicalFile[]): OutputFile[];
}

/** Конфигурация транспилера. */
export interface TranspilerConfig {
  /** Абсолютный путь к корню проекта. */
  projectRoot: string;
  /** Массив адаптеров для целевых агентов. */
  adapters: Adapter[];
}
