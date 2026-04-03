/**
 * Resolve Plugin Values и Resolve Local Values.
 * Spec: docs/specs/plugin-values.md § Процедура Resolve Plugin Values
 * Spec: docs/specs/plugin-values.md § Процедура Resolve Local Values
 */

import type { VariableDeclaration } from "./plugin-manifest.js";

const ENV_PATTERN = /\$\{env:([^}]+)\}/g;

/**
 * Интерполирует ${env:*} в строке, используя переданный env.
 * Выбрасывает ошибку при undefined переменной окружения.
 */
function interpolateEnv(
  value: string,
  env: Record<string, string | undefined>,
  variableKey: string,
): string {
  return value.replace(ENV_PATTERN, (_match, name: string) => {
    const envValue = env[name];
    if (envValue === undefined) {
      throw new Error(
        `Undefined environment variable: '${name}' in value for variable '${variableKey}'.`,
      );
    }
    return envValue;
  });
}

/**
 * Процедура Resolve Plugin Values — резолвинг и валидация значений
 * переменных для одного плагина.
 */
export function resolvePluginValues(
  declarations: Record<string, VariableDeclaration> | null,
  providedValues: Record<string, string> | null,
  env: Record<string, string | undefined>,
): Record<string, string> {
  // Шаг 1: оба null → пустая карта
  if (declarations === null && providedValues === null) {
    return {};
  }

  // Шаг 2/расширение 2a: declarations null, providedValues не null
  if (declarations === null && providedValues !== null) {
    const keys = Object.keys(providedValues).join(", ");
    throw new Error(
      `Unknown plugin values: '${keys}'. Plugin does not declare any variables.`,
    );
  }

  // Шаг 3: проверить unknown variables
  if (providedValues !== null) {
    for (const key of Object.keys(providedValues)) {
      if (!(key in declarations!)) {
        const declaredKeys = Object.keys(declarations!).join(", ");
        throw new Error(
          `Unknown plugin value: '${key}'. Declared variables: ${declaredKeys}.`,
        );
      }
    }
  }

  // Шаг 4: валидация sensitive
  if (providedValues !== null) {
    for (const [key, value] of Object.entries(providedValues)) {
      const decl = declarations![key];
      if (decl && decl.sensitive) {
        if (!value.includes("${env:")) {
          throw new Error(
            `Sensitive variable '${key}' must not be set inline. Use \${env:VAR_NAME} to reference an environment variable.`,
          );
        }
      }
    }
  }

  // Шаги 5-7: создать resolved карту
  const resolved: Record<string, string> = {};

  for (const [key, decl] of Object.entries(declarations!)) {
    let value: string | undefined;

    // Шаг 6.1: providedValues приоритет
    if (providedValues !== null && key in providedValues) {
      value = providedValues[key];
    }
    // Шаг 6.2: default
    else if (decl.default !== null) {
      value = decl.default;
    }
    // Шаг 6.3: значение отсутствует
    else {
      continue;
    }

    // Шаг 7: интерполяция ${env:*}
    resolved[key] = interpolateEnv(value, env, key);
  }

  // Шаг 8: проверить required
  for (const [key, decl] of Object.entries(declarations!)) {
    if (decl.required && !(key in resolved)) {
      throw new Error(
        `Required plugin variable '${key}' is not set and has no default.`,
      );
    }
  }

  // Шаг 9
  return resolved;
}

/**
 * Процедура Resolve Local Values — резолвинг значений переменных
 * локального проекта из config.yml.
 */
export function resolveLocalValues(
  declarations: Record<string, VariableDeclaration> | null,
  env: Record<string, string | undefined>,
): Record<string, string> {
  // Шаг 1: null → пустая карта
  if (declarations === null) {
    return {};
  }

  // Шаги 2-4: создать resolved карту
  const resolved: Record<string, string> = {};

  for (const [key, decl] of Object.entries(declarations)) {
    // Шаг 3.1: default
    if (decl.default !== null) {
      // Шаг 4: интерполяция ${env:*}
      resolved[key] = interpolateEnv(decl.default, env, key);
    }
    // Шаг 3.2: значение отсутствует → пропустить
  }

  // Шаг 5: проверить required
  for (const [key, decl] of Object.entries(declarations)) {
    if (decl.required && !(key in resolved)) {
      throw new Error(
        `Required config variable '${key}' is not set and has no default.`,
      );
    }
  }

  // Шаг 6
  return resolved;
}
