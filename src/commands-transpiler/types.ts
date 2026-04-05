/**
 * Types for Commands Transpiler.
 * Spec: docs/specs/commands-transpiler.md
 */

/** Обнаруженное определение команды. */
export interface CommandDefinition {
  /** Имя команды (путь файла относительно каталога commands без расширения .md). */
  name: string;
  /** Путь к файлу относительно projectRoot. */
  relativePath: string;
  /** Содержимое файла (raw Markdown с frontmatter). */
  rawContent: string;
}

/** Файл для записи в целевой каталог. */
export interface CommandOutputFile {
  /** Путь назначения относительно projectRoot. */
  relativePath: string;
  /** Трансформированное содержимое файла. */
  content: string;
}

/** Ошибка транспиляции адаптера. */
export interface CommandTranspileError {
  /** Идентификатор адаптера. */
  agentId: string;
  /** Описание ошибки. */
  message: string;
  /** Исходное исключение адаптера. */
  cause: Error;
}

/** Результат транспиляции для одного адаптера. */
export interface CommandTranspileResult {
  /** Идентификатор агента. */
  agentId: string;
  /** Список файлов для записи. */
  files: CommandOutputFile[];
  /** Ошибки, возникшие при транспиляции данного адаптера. */
  errors: CommandTranspileError[];
}

/** Результат записи файлов. */
export interface CommandWriteResult {
  /** Относительные пути успешно записанных файлов. */
  written: string[];
  /** Ошибки записи. */
  errors: import("./errors.js").CommandWriteError[];
}

/** Интерфейс адаптера. */
export interface CommandAdapter {
  /** Уникальный идентификатор агента. */
  readonly agentId: string;
  /** Путь к целевому каталогу относительно projectRoot. */
  readonly targetDir: string;
  /** Генерирует agent-specific файлы из определений команд. */
  transpile(definitions: CommandDefinition[]): CommandOutputFile[];
}

/** Конфигурация транспилера. */
export interface CommandsTranspilerConfig {
  /** Абсолютный путь к корню проекта. */
  projectRoot: string;
  /** Массив адаптеров для целевых агентов. */
  adapters: CommandAdapter[];
  /** Относительный путь к agloom-директории внутри projectRoot. Default: ".agloom". */
  agloomDir?: string;
}
