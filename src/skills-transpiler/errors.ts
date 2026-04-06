/**
 * Error classes for Skills Transpiler.
 * Spec: docs/specs/skills-transpiler.md
 */

/** Ошибка конфигурации транспилера. */
export class SkillConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkillConfigError";
  }
}

/** Ошибка обнаружения skill-пакетов. */
export class SkillDiscoverError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkillDiscoverError";
  }
}

/**
 * Ошибка трансформации контента .md файла skill-пакета.
 * Spec: docs/specs/skills-transpiler.md § Классы ошибок
 */
export class SkillTransformError extends Error {
  public readonly cause?: Error;
  constructor(message: string, options?: { cause?: Error }) {
    super(message);
    this.name = "SkillTransformError";
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

/** Ошибка записи файла. */
export class SkillWriteError extends Error {
  public readonly cause?: Error;
  constructor(message: string, options?: { cause?: Error }) {
    super(message);
    this.name = "SkillWriteError";
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}
