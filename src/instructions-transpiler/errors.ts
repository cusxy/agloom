/**
 * Error classes for Instructions Transpiler.
 * Spec: docs/specs/instructions-transpiler.md
 */

/** Ошибка конфигурации транспилера. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/** Ошибка обнаружения канонических файлов. */
export class DiscoverError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscoverError";
  }
}

/** Ошибка записи файла. */
export class WriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WriteError";
  }
}
