/**
 * Валидация канонического permissions-файла.
 * Spec: docs/specs/permissions-transpiler.md § Валидация канонического файла
 */

import { TransformError } from "./errors.js";
import type { PermissionsCanonicalContent } from "./types.js";

/**
 * Извлекает паттерн и действие из одноключевого объекта правила.
 * Возвращает [pattern, action] или null если объект невалиден.
 */
function extractRule(rule: unknown): [string, string] | null {
  if (typeof rule !== "object" || rule === null || Array.isArray(rule)) {
    return null;
  }
  const keys = Object.keys(rule);
  if (keys.length !== 1) {
    return null;
  }
  const pattern = keys[0];
  const action = (rule as Record<string, unknown>)[pattern];
  if (typeof action !== "string") {
    return null;
  }
  return [pattern, action];
}

/**
 * Валидирует секцию как упорядоченный массив правил (одноключевых объектов).
 */
function validateRuleArray(
  section: unknown,
  sectionName: string,
  allowedActions: string[],
  validatePattern?: (pattern: string) => void,
): void {
  // Секция должна быть массивом
  if (!Array.isArray(section)) {
    throw new TransformError(
      `'${sectionName}' must be an array of permission rules`,
    );
  }

  for (const rule of section) {
    // Каждый элемент -- объект с ровно одним ключом
    const extracted = extractRule(rule);
    if (extracted === null) {
      throw new TransformError(
        `Each rule in '${sectionName}' must be an object with exactly one key (pattern) and one value (action)`,
      );
    }

    const [pattern, action] = extracted;

    // Действие должно входить в допустимое множество
    if (!allowedActions.includes(action)) {
      throw new TransformError(
        `Invalid action '${action}' in '${sectionName}' rule '${pattern}'. Allowed actions: ${allowedActions.join(", ")}`,
      );
    }

    // Валидация паттерна (если задана)
    if (validatePattern) {
      validatePattern(pattern);
    }
  }
}

/**
 * Валидирует распарсенное содержимое канонического файла.
 *
 * Шаги:
 * 1. Проверить, что content является объектом.
 * 2. Проверить, что content содержит только допустимые ключи.
 * 3. Если поле shell присутствует — валидировать как упорядоченный массив правил.
 * 4. Если поле mcp присутствует — валидировать как упорядоченный массив правил.
 * 5. Если поле file присутствует — валидировать как упорядоченный массив правил.
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
    validateRuleArray(obj.shell, "shell", ["allow", "ask", "deny"]);
  }

  // Шаг 4: валидация mcp
  if ("mcp" in obj && obj.mcp !== undefined) {
    validateRuleArray(obj.mcp, "mcp", ["allow", "ask", "deny"], (pattern) => {
      const colonCount = pattern.split(":").length - 1;
      if (colonCount !== 1) {
        throw new TransformError(
          `Invalid MCP pattern '${pattern}': must match format '<server>:<tool>'`,
        );
      }
    });
  }

  // Шаг 5: валидация file
  if ("file" in obj && obj.file !== undefined) {
    validateRuleArray(obj.file, "file", ["deny", "read", "write"]);
  }

  return content as PermissionsCanonicalContent;
}
