/**
 * Интерполяция контента.
 * Spec: docs/specs/interpolation.md § Интерполяция контента
 */

import { InterpolationError } from "./errors.js";

/**
 * Выполняет подстановку переменных в текстовом содержимом за один проход.
 *
 * Шаги:
 * 1. Обработать content в один проход.
 * 2. Для каждого вхождения \${agloom:NAME} — заменить на литерал ${agloom:NAME}.
 * 3. Для каждого вхождения \${env:NAME} — заменить на литерал ${env:NAME}.
 * 4. Для каждого вхождения ${agloom:NAME} — найти NAME в variables, подставить.
 * 5. Для каждого вхождения ${env:NAME} — найти NAME в env, подставить.
 * 6. Текст, не соответствующий паттернам, — сохранить без изменений.
 * 7. Вернуть результат.
 */
export function interpolate(
  content: string,
  variables: Record<string, string>,
  env?: Record<string, string | undefined>,
  values?: Record<string, string>,
): string {
  const resolvedEnv = env ?? (process.env as Record<string, string | undefined>);
  const resolvedValues = values ?? {};

  // Один проход: обрабатываем escaped и non-escaped паттерны для agloom, env и values
  // Regex: match \${agloom:NAME}, \${env:NAME}, \${values:NAME} (escaped),
  // or ${agloom:NAME}, ${env:NAME}, ${values:NAME}
  // NAME = one or more chars not containing }
  return content.replace(
    /\\(\$\{(?:agloom|env|values):[^}]+\})|\$\{(agloom|env|values):([^}]+)\}/g,
    (match, escaped: string | undefined, namespace: string | undefined, name: string | undefined) => {
      // Шаги 2-3, 6: escaped — потребить backslash, вернуть литерал
      if (escaped !== undefined) {
        return escaped;
      }

      // Шаг 4: ${agloom:NAME}
      if (namespace === "agloom") {
        if (!(name! in variables)) {
          // Расширение 4a
          throw new InterpolationError(`Unknown agloom variable: ${name}`);
        }
        return variables[name!];
      }

      // Шаг 5: ${env:NAME}
      if (namespace === "env") {
        const value = resolvedEnv[name!];
        if (value === undefined) {
          // Расширение 5a
          throw new InterpolationError(`Undefined environment variable: ${name}`);
        }
        return value;
      }

      // Шаг 7: ${values:NAME}
      if (namespace === "values") {
        if (!(name! in resolvedValues)) {
          // Расширение 7a
          throw new InterpolationError(`Unknown values variable: ${name}`);
        }
        return resolvedValues[name!];
      }

      // Шаг 8: не соответствует — сохранить
      return match;
    },
  );
}
