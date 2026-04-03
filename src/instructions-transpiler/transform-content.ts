/**
 * Трансформация контента канонического файла инструкций.
 * Spec: docs/specs/instructions-transpiler.md § Трансформация контента
 */

import matter from "gray-matter";
import { TransformError } from "./errors.js";
import { filterBody } from "./filter-body.js";
import { interpolate, InterpolationError } from "../interpolation/index.js";

/**
 * Трансформирует содержимое канонического файла инструкций для конкретного
 * целевого агента.
 *
 * Шаги:
 * 1. Парсинг rawContent библиотекой gray-matter.
 * 2. Проверить наличие ключа override в data.
 * 3. Валидировать, что override — объект.
 * 4. Проверить наличие ключа agentId в override.
 * 5. Валидировать, что override[agentId] — объект.
 * 6. Shallow merge из override[agentId] в data.
 * 7. Удалить ключ override из data.
 * 8. Фильтрация body: filterBody(content, agentId, allowedAgentIds).
 * 9. Сериализовать data в YAML frontmatter.
 * 10. Присоединить отфильтрованный body к frontmatter.
 */
export function transformContent(
  rawContent: string,
  agentId: string,
  allowedAgentIds?: string[],
  variables?: Record<string, string>,
  values?: Record<string, string>,
): string {
  // Шаг 1: парсинг frontmatter
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(rawContent, {});
  } catch (err) {
    // Расширение 1a: ошибка парсинга
    throw new TransformError(
      `Failed to parse frontmatter: ${(err as Error).message}`,
    );
  }

  const data: Record<string, unknown> = { ...parsed.data };

  // Шаг 2: проверить наличие ключа override
  if ("override" in data) {
    // Шаг 3: валидировать, что override — объект
    // Расширение 3a: значение override не является объектом
    if (
      typeof data.override !== "object" ||
      data.override === null ||
      Array.isArray(data.override)
    ) {
      throw new TransformError("Override must be an object");
    }

    const overrideObj = data.override as Record<string, unknown>;

    // Шаг 4: проверить наличие ключа agentId в override
    if (agentId in overrideObj) {
      const agentOverride = overrideObj[agentId];

      // Шаг 5: валидировать, что override[agentId] — объект
      // Расширение 5a
      if (
        typeof agentOverride !== "object" ||
        agentOverride === null ||
        Array.isArray(agentOverride)
      ) {
        throw new TransformError(`Override for '${agentId}' must be an object`);
      }

      // Шаг 6: shallow merge
      const agentOverrideObj = agentOverride as Record<string, unknown>;
      for (const [key, value] of Object.entries(agentOverrideObj)) {
        data[key] = value;
      }
    }
    // Расширение 4a: ключ agentId отсутствует в override → пропустить merge

    // Шаг 7: удалить ключ override из data
    delete data.override;
  }
  // Расширение 2a: ключ override отсутствует → пропустить шаги 3–6,
  // перейти к шагу 7 (override уже отсутствует)

  // Шаг 8: фильтрация body
  // Расширение 8a: filterBody выбрасывает TransformError → пробросить
  const filteredBody = filterBody(parsed.content, agentId, allowedAgentIds);

  // Расширение 9a: data пуст → только body (без разделителей ---)
  let result: string;
  if (Object.keys(data).length === 0) {
    result = filteredBody;
  } else {
    // Шаг 9–10: сериализовать frontmatter и присоединить body
    result = matter.stringify(filteredBody, data);
  }

  // Шаг 11: интерполяция (если variables передан)
  // Spec: docs/specs/interpolation.md § Расширение transformContent Instructions Transpiler
  if (variables !== undefined) {
    try {
      result = interpolate(result, variables, undefined, values);
    } catch (err) {
      // Расширение 11a: InterpolationError → TransformError
      if (err instanceof InterpolationError) {
        throw new TransformError(`Interpolation failed: ${err.message}`);
      }
      throw err;
    }
  }

  return result;
}
