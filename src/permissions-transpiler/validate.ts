/**
 * Валидация канонического permissions-файла.
 * Spec: docs/specs/permissions-transpiler.md § Валидация канонического файла
 */

import { TransformError } from "./errors.js";
import type { PermissionsCanonicalContent } from "./types.js";

/**
 * Проверяет, является ли значение массивом строк.
 */
function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

/**
 * Валидирует, что каждая строка в массиве содержит ровно один разделитель ':'.
 */
function validatePatterns(
  patterns: string[],
  sectionName: string,
  formatDescription: string,
): void {
  for (const pattern of patterns) {
    const colonCount = pattern.split(":").length - 1;
    if (colonCount !== 1) {
      throw new TransformError(
        `Invalid ${sectionName} pattern '${pattern}': must match format '${formatDescription}'`,
      );
    }
  }
}

/**
 * Валидирует секцию с ключами allow, ask, deny (shell / mcp).
 */
function validateAllowAskDenySection(
  section: unknown,
  sectionName: string,
  allowedKeys: string[],
  patternType: string,
  formatDescription: string,
): void {
  if (
    typeof section !== "object" ||
    section === null ||
    Array.isArray(section)
  ) {
    throw new TransformError(`'${sectionName}' must be an object`);
  }

  const obj = section as Record<string, unknown>;

  for (const key of Object.keys(obj)) {
    if (!allowedKeys.includes(key)) {
      throw new TransformError(
        `Unknown key '${key}' in '${sectionName}'. Allowed keys: ${allowedKeys.join(", ")}`,
      );
    }
  }

  for (const key of allowedKeys) {
    if (key in obj && obj[key] !== undefined) {
      if (!isStringArray(obj[key])) {
        throw new TransformError(
          `'${sectionName}.${key}' must be an array of strings`,
        );
      }
      if (patternType) {
        validatePatterns(obj[key] as string[], patternType, formatDescription);
      }
    }
  }
}

/**
 * Валидирует распарсенное содержимое канонического файла.
 *
 * Шаги:
 * 1. Проверить, что content является объектом.
 * 2. Проверить, что content содержит только допустимые ключи.
 * 3. Если поле shell присутствует — валидировать структуру.
 * 4. Если поле mcp присутствует — валидировать структуру.
 * 5. Если поле file присутствует — валидировать структуру.
 */
export function validatePermissionsContent(
  content: unknown,
): PermissionsCanonicalContent {
  // Шаг 1: content должен быть объектом
  if (
    typeof content !== "object" ||
    content === null ||
    Array.isArray(content)
  ) {
    throw new TransformError("Permissions config must be an object");
  }

  const obj = content as Record<string, unknown>;

  // Шаг 2: только допустимые ключи
  const allowedRootKeys = ["shell", "mcp", "file"];
  for (const key of Object.keys(obj)) {
    if (!allowedRootKeys.includes(key)) {
      throw new TransformError(
        `Unknown key '${key}' in permissions config. Allowed keys: shell, mcp, file`,
      );
    }
  }

  // Шаг 3: валидация shell
  if ("shell" in obj && obj.shell !== undefined) {
    validateAllowAskDenySection(
      obj.shell,
      "shell",
      ["allow", "ask", "deny"],
      "shell",
      "<command>:<args-glob>",
    );
  }

  // Шаг 4: валидация mcp
  if ("mcp" in obj && obj.mcp !== undefined) {
    validateAllowAskDenySection(
      obj.mcp,
      "mcp",
      ["allow", "ask", "deny"],
      "MCP",
      "<server>:<tool>",
    );
  }

  // Шаг 5: валидация file
  if ("file" in obj && obj.file !== undefined) {
    if (
      typeof obj.file !== "object" ||
      obj.file === null ||
      Array.isArray(obj.file)
    ) {
      throw new TransformError("'file' must be an object");
    }

    const fileObj = obj.file as Record<string, unknown>;
    const allowedFileKeys = ["deny", "read", "write"];

    for (const key of Object.keys(fileObj)) {
      if (!allowedFileKeys.includes(key)) {
        throw new TransformError(
          `Unknown key '${key}' in 'file'. Allowed keys: deny, read, write`,
        );
      }
    }

    for (const key of allowedFileKeys) {
      if (key in fileObj && fileObj[key] !== undefined) {
        if (!isStringArray(fileObj[key])) {
          throw new TransformError(`'file.${key}' must be an array of strings`);
        }
      }
    }
  }

  return content as PermissionsCanonicalContent;
}
