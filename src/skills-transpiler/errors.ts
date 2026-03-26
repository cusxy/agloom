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

/** Ошибка записи файла. */
export class SkillWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkillWriteError";
  }
}
