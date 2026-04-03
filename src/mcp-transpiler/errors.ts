/**
 * Error classes for MCP Transpiler.
 * Spec: docs/specs/mcp-transpiler.md § Классы ошибок
 */

/** Ошибка конфигурации транспилера. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/** Ошибка обнаружения канонического файла. */
export class DiscoverError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscoverError";
  }
}

/** Ошибка валидации или трансформации. */
export class TransformError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransformError";
  }
}

/** Ошибка транспиляции адаптера. */
export class TranspileError extends Error {
  readonly agentId: string;
  override readonly cause: Error;

  constructor(agentId: string, message: string, cause: Error) {
    super(message);
    this.name = "TranspileError";
    this.agentId = agentId;
    this.cause = cause;
  }
}

/** Ошибка записи файла. */
export class WriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WriteError";
  }
}
