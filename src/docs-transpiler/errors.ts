/**
 * Error classes for Docs & Schemas Transpiler.
 * Spec: docs/specs/docs-transpiler.md
 */

/** Ошибка конфигурации транспилера. */
export class ResourceConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResourceConfigError";
  }
}

/** Ошибка обнаружения файлов ресурсов. */
export class ResourceDiscoverError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResourceDiscoverError";
  }
}

/** Ошибка записи файла. */
export class ResourceWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResourceWriteError";
  }
}
