/**
 * Error classes for Commands Transpiler.
 * Spec: docs/specs/commands-transpiler.md
 */

/** Ошибка конфигурации транспилера. */
export class CommandConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommandConfigError";
  }
}

/** Ошибка обнаружения определений команд. */
export class CommandDiscoverError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommandDiscoverError";
  }
}

/** Ошибка трансформации контента (парсинг frontmatter, фильтрация body). */
export class CommandTransformError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommandTransformError";
  }
}

/** Ошибка записи файла. */
export class CommandWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommandWriteError";
  }
}
