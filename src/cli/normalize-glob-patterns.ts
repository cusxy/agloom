/**
 * Нормализация glob-паттернов для совместимости с fast-glob.
 * Spec: docs/specs/format.md § Нормализация glob-паттернов
 *
 * fast-glob интерпретирует `**` как «одна или более директорий»,
 * а не «ноль или более». Нормализация добавляет дополнительные
 * паттерны, покрывающие случай «ноль директорий».
 */
export function normalizeGlobPatterns(patterns: string[]): string[] {
  const result: string[] = [];

  for (const pattern of patterns) {
    result.push(pattern);

    if (pattern.startsWith("**/")) {
      // Случай 1: удалить ведущий **/
      // Приоритет: если паттерн также содержит /**/ далее — только случай 1
      result.push(pattern.slice(3));
    } else if (pattern.includes("/**/")) {
      // Случай 2: заменить первое вхождение /**/ на /
      result.push(pattern.replace("/**/", "/"));
    }
  }

  return result;
}
