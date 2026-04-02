/**
 * Types for Skills Transpiler.
 * Spec: docs/specs/skills-transpiler.md
 */

/** Обнаруженный skill-пакет. */
export interface SkillPackage {
  /** Имя skill (имя директории). */
  name: string;
  /** Путь к директории skill относительно projectRoot. */
  directoryPath: string;
  /** Пути файлов пакета относительно projectRoot. */
  files: string[];
}

/** Файл для записи в целевой каталог. */
export interface SkillOutputFile {
  /** Путь назначения относительно projectRoot. */
  relativePath: string;
  /** Путь исходного файла относительно projectRoot. */
  sourcePath: string;
}

/** Ошибка транспиляции адаптера. */
export interface SkillTranspileError {
  /** Идентификатор адаптера. */
  agentId: string;
  /** Описание ошибки. */
  message: string;
  /** Исходное исключение адаптера. */
  cause: Error;
}

/** Результат транспиляции для одного адаптера. */
export interface SkillTranspileResult {
  /** Идентификатор агента. */
  agentId: string;
  /** Список файлов для записи. */
  files: SkillOutputFile[];
  /** Ошибки, возникшие при транспиляции данного адаптера. */
  errors: SkillTranspileError[];
}

/** Результат записи файлов. */
export interface SkillWriteResult {
  /** Относительные пути успешно записанных файлов. */
  written: string[];
  /** Ошибки записи. */
  errors: import("./errors.js").SkillWriteError[];
}

/** Интерфейс адаптера. */
export interface SkillAdapter {
  /** Уникальный идентификатор агента. */
  readonly agentId: string;
  /** Путь к целевому каталогу относительно projectRoot. */
  readonly targetDir: string;
}

/** Конфигурация транспилера. */
export interface SkillsTranspilerConfig {
  /** Абсолютный путь к корню проекта. */
  projectRoot: string;
  /** Массив адаптеров для целевых агентов. */
  adapters: SkillAdapter[];
  /** Относительный путь к agloom-директории внутри projectRoot. Default: ".agloom". */
  agloomDir?: string;
}
