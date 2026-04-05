/**
 * Фильтрация agent-specific секций в теле документа.
 * Spec: docs/specs/instructions-transpiler.md § Фильтрация body
 */

import { TransformError } from "./errors.js";

/** Regex для тега открытия: <!-- agent:<id> --> */
const OPEN_TAG_RE = /^\s*<!--\s*agent:\s*(\S+)\s*-->\s*$/;

/** Regex для тега закрытия: <!-- /agent:<id> --> */
const CLOSE_TAG_RE = /^\s*<!--\s*\/agent:\s*(\S+)\s*-->\s*$/;

/** Regex для валидации agent-id: [a-z][a-z0-9-]* */
const VALID_ID_RE = /^[a-z][a-z0-9-]*$/;

/**
 * Фильтрует agent-specific секции в теле документа.
 *
 * Шаги:
 * 1. Разбить body на строки.
 * 2. Выделить agent-specific секции по паттернам тегов.
 * 3. Валидировать, что agent-id соответствует паттерну [a-z][a-z0-9-]*.
 * 4. Если allowedAgentIds передан — валидировать, что agent-id входит в allowedAgentIds.
 * 5. Валидировать, что каждый тег открытия имеет соответствующий тег закрытия.
 * 6. Валидировать, что секции не вложены друг в друга.
 * 7. Для секции с совпадающим agentId — раскрыть (удалить теги, сохранить контент).
 * 8. Для секции с несовпадающим agentId — удалить (теги и контент).
 * 9. Строки вне секций — сохранить без изменений.
 * 10. Собрать результирующие строки.
 */
export function filterBody(body: string, agentId: string, allowedAgentIds?: string[]): string {
  const lines = body.split("\n");
  const result: string[] = [];
  let currentSection: { id: string } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1; // 1-based line numbers

    const openMatch = OPEN_TAG_RE.exec(line);
    const closeMatch = CLOSE_TAG_RE.exec(line);

    if (openMatch) {
      const id = openMatch[1];

      // Расширение 3a: невалидный agent-id
      if (!VALID_ID_RE.test(id)) {
        throw new TransformError(`Invalid agent-id '${id}' in tag at line ${lineNum}`);
      }

      // Расширение 4a: agent-id не входит в allowedAgentIds
      if (allowedAgentIds !== undefined && !allowedAgentIds.includes(id)) {
        throw new TransformError(
          `Invalid agent-id '${id}' in instruction file: '${id}' does not have its own instruction format. Use the corresponding format-specific agent-id instead.`,
        );
      }

      // Расширение 6a: вложенная секция
      if (currentSection !== null) {
        throw new TransformError(`Nested agent section detected: agent:${id} inside agent:${currentSection.id}`);
      }

      currentSection = { id };
      continue; // Удалить строку тега
    }

    if (closeMatch) {
      const id = closeMatch[1];

      // Расширение 3a: невалидный agent-id
      if (!VALID_ID_RE.test(id)) {
        throw new TransformError(`Invalid agent-id '${id}' in tag at line ${lineNum}`);
      }

      // Расширение 5b: тег закрытия без открытия
      if (currentSection === null) {
        throw new TransformError(`Unmatched closing tag for agent:${id}`);
      }

      // Расширение 5c: несовпадение идентификаторов
      if (currentSection.id !== id) {
        throw new TransformError(`Mismatched closing tag: expected agent:${currentSection.id}, got agent:${id}`);
      }

      currentSection = null;
      continue; // Удалить строку тега
    }

    // Обработка контента
    if (currentSection !== null) {
      // Шаг 7: совпадающий agentId — сохранить контент
      if (currentSection.id === agentId) {
        result.push(line);
      }
      // Шаг 8: несовпадающий agentId — удалить контент (пропустить строку)
    } else {
      // Шаг 9: строки вне секций — сохранить
      result.push(line);
    }
  }

  // Расширение 5a: тег открытия без соответствующего закрытия
  if (currentSection !== null) {
    throw new TransformError(`Unmatched opening tag for agent:${currentSection.id}`);
  }

  // Шаг 10: собрать результирующие строки
  return result.join("\n");
}
