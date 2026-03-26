/**
 * Error classes for Agents Transpiler.
 * Spec: docs/specs/agents-transpiler.md
 */

/** Ошибка конфигурации транспилера. */
export class AgentConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentConfigError";
  }
}

/** Ошибка обнаружения определений агентов. */
export class AgentDiscoverError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentDiscoverError";
  }
}

/** Ошибка трансформации контента (парсинг frontmatter, фильтрация body). */
export class AgentTransformError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentTransformError";
  }
}

/** Ошибка записи файла. */
export class AgentWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentWriteError";
  }
}
