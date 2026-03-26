/**
 * Types for Agents Transpiler.
 * Spec: docs/specs/agents-transpiler.md
 */

/** Обнаруженное определение агента. */
export interface AgentDefinition {
  /** Имя агента (имя файла без расширения .md). */
  name: string;
  /** Путь к файлу относительно projectRoot. */
  relativePath: string;
  /** Содержимое файла (raw Markdown с frontmatter). */
  rawContent: string;
}

/** Файл для записи в целевой каталог. */
export interface AgentOutputFile {
  /** Путь назначения относительно projectRoot. */
  relativePath: string;
  /** Трансформированное содержимое файла. */
  content: string;
}

/** Ошибка транспиляции адаптера. */
export interface AgentTranspileError {
  /** Идентификатор адаптера. */
  agentId: string;
  /** Описание ошибки. */
  message: string;
  /** Исходное исключение адаптера. */
  cause: Error;
}

/** Результат транспиляции для одного адаптера. */
export interface AgentTranspileResult {
  /** Идентификатор агента. */
  agentId: string;
  /** Список файлов для записи. */
  files: AgentOutputFile[];
  /** Ошибки, возникшие при транспиляции данного адаптера. */
  errors: AgentTranspileError[];
}

/** Результат записи файлов. */
export interface AgentWriteResult {
  /** Относительные пути успешно записанных файлов. */
  written: string[];
  /** Ошибки записи. */
  errors: import("./errors.js").AgentWriteError[];
}

/** Интерфейс адаптера. */
export interface AgentAdapter {
  /** Уникальный идентификатор агента. */
  readonly agentId: string;
  /** Генерирует agent-specific файлы из определений агентов. */
  transpile(definitions: AgentDefinition[]): AgentOutputFile[];
}

/** Конфигурация транспилера. */
export interface AgentsTranspilerConfig {
  /** Абсолютный путь к корню проекта. */
  projectRoot: string;
  /** Массив адаптеров для целевых агентов. */
  adapters: AgentAdapter[];
}
