/**
 * Фильтрация agent-specific секций в теле документа.
 * Spec: docs/specs/agents-transpiler.md § Фильтрация body
 */

import { AgentTransformError } from "./errors.js";

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
 * 3. Валидировать, что каждый тег открытия имеет соответствующий тег закрытия.
 * 4. Валидировать, что секции не вложены друг в друга.
 * 5. Для секции с совпадающим agentId — раскрыть (удалить теги, сохранить контент).
 * 6. Для секции с несовпадающим agentId — удалить (теги и контент).
 * 7. Строки вне секций — сохранить без изменений.
 * 8. Собрать результирующие строки.
 */
export function filterBody(body: string, agentId: string): string {
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

      // Расширение 2a: невалидный agent-id
      if (!VALID_ID_RE.test(id)) {
        throw new AgentTransformError(
          `Invalid agent-id '${id}' in tag at line ${lineNum}`,
        );
      }

      // Расширение 4a: вложенная секция
      if (currentSection !== null) {
        throw new AgentTransformError(
          `Nested agent section detected: agent:${id} inside agent:${currentSection.id}`,
        );
      }

      currentSection = { id };
      continue; // Удалить строку тега
    }

    if (closeMatch) {
      const id = closeMatch[1];

      // Расширение 2a: невалидный agent-id
      if (!VALID_ID_RE.test(id)) {
        throw new AgentTransformError(
          `Invalid agent-id '${id}' in tag at line ${lineNum}`,
        );
      }

      // Расширение 3b: тег закрытия без открытия
      if (currentSection === null) {
        throw new AgentTransformError(`Unmatched closing tag for agent:${id}`);
      }

      // Расширение 3c: несовпадение идентификаторов
      if (currentSection.id !== id) {
        throw new AgentTransformError(
          `Mismatched closing tag: expected agent:${currentSection.id}, got agent:${id}`,
        );
      }

      currentSection = null;
      continue; // Удалить строку тега
    }

    // Обработка контента
    if (currentSection !== null) {
      // Шаг 5: совпадающий agentId — сохранить контент
      if (currentSection.id === agentId) {
        result.push(line);
      }
      // Шаг 6: несовпадающий agentId — удалить контент (пропустить строку)
    } else {
      // Шаг 7: строки вне секций — сохранить
      result.push(line);
    }
  }

  // Расширение 3a: тег открытия без соответствующего закрытия
  if (currentSection !== null) {
    throw new AgentTransformError(
      `Unmatched opening tag for agent:${currentSection.id}`,
    );
  }

  // Шаг 8: собрать результирующие строки
  return result.join("\n");
}
