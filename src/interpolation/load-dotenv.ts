/**
 * Загрузка .env файла.
 * Spec: docs/specs/interpolation.md § Загрузка .env файла
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as dotenv from "dotenv";

/**
 * Загружает переменные окружения из `.env` файла в корне проекта
 * и объединяет их с `process.env`.
 *
 * Шаги:
 * 1. Определить путь к файлу как <projectRoot>/.env.
 * 2. Прочитать и распарсить файл с использованием библиотеки dotenv.
 * 3. Для каждой переменной из распарсенного файла: если переменная
 *    НЕ определена в process.env — записать значение в process.env.
 *
 * Расширение 1a: файл .env не существует → тихо пропустить.
 * Расширение 2a: ошибка чтения/парсинга → тихо пропустить.
 */
export function loadDotenv(projectRoot: string): void {
  const envPath = path.join(projectRoot, ".env");

  let content: string;
  try {
    content = fs.readFileSync(envPath, "utf-8");
  } catch {
    // Расширение 1a/2a: файл не существует или ошибка чтения → тихо пропустить
    return;
  }

  let parsed: Record<string, string>;
  try {
    parsed = dotenv.parse(content);
  } catch {
    // Расширение 2a: ошибка парсинга → тихо пропустить
    return;
  }

  // Шаг 3: записать в process.env только если переменная ещё не определена
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
