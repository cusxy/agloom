/**
 * Types for Docs & Schemas Transpiler.
 * Spec: docs/specs/docs-transpiler.md
 */

/** Литеральный тип, определяющий вид ресурса. */
export type ResourceType = "docs" | "schemas";

/** Обнаруженный файл ресурса. */
export interface ResourceFile {
  /** Путь файла относительно projectRoot. */
  relativePath: string;
}

/** Файл для записи в целевой каталог. */
export interface ResourceOutputFile {
  /** Путь назначения относительно projectRoot. */
  relativePath: string;
  /** Путь исходного файла относительно projectRoot. */
  sourcePath: string;
}

/** Ошибка транспиляции адаптера. */
export interface ResourceTranspileError {
  /** Идентификатор адаптера. */
  agentId: string;
  /** Описание ошибки. */
  message: string;
  /** Исходное исключение адаптера. */
  cause: Error;
}

/** Результат транспиляции для одного адаптера. */
export interface ResourceTranspileResult {
  /** Идентификатор агента. */
  agentId: string;
  /** Список файлов для записи. */
  files: ResourceOutputFile[];
  /** Ошибки, возникшие при транспиляции данного адаптера. */
  errors: ResourceTranspileError[];
}

/** Результат записи файлов. */
export interface ResourceWriteResult {
  /** Относительные пути успешно записанных файлов. */
  written: string[];
  /** Ошибки записи. */
  errors: import("./errors.js").ResourceWriteError[];
}

/** Интерфейс адаптера. */
export interface ResourceAdapter {
  /** Уникальный идентификатор агента. */
  readonly agentId: string;
  /** Путь к целевому каталогу относительно projectRoot. */
  readonly targetDir: string;
}

/** Конфигурация транспилера. */
export interface ResourceTranspilerConfig {
  /** Абсолютный путь к корню проекта. */
  projectRoot: string;
  /** Массив адаптеров для целевых агентов. */
  adapters: ResourceAdapter[];
  /** Тип ресурса. */
  resourceType: ResourceType;
  /** Относительный путь к agloom-директории внутри projectRoot. Default: ".agloom". */
  agloomDir?: string;
}
