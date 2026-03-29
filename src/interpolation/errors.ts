/**
 * Error classes for Interpolation.
 * Spec: docs/specs/interpolation.md § Классы ошибок
 */

/** Ошибка интерполяции (неизвестная agloom-переменная, неопределённая переменная окружения). */
export class InterpolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InterpolationError";
  }
}
