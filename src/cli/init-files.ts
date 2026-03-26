/**
 * Процедура Init Files — импорт существующих agent-специфичных файлов в overlays/.
 * Spec: docs/specs/init-command.md § Команда init
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { AdapterRegistryEntry, InitOutcome } from "./types.js";

/**
 * Рекурсивно обнаруживает все файлы в директории.
 * Возвращает массив абсолютных путей к файлам.
 */
function discoverFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...discoverFiles(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Проверяет, содержит ли директория хотя бы один файл (рекурсивно).
 */
function hasFiles(dir: string): boolean {
  if (!fs.existsSync(dir)) return false;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (hasFiles(fullPath)) return true;
      } else {
        return true;
      }
    }
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Импортирует существующие agent-специфичные файлы в overlays/.
 *
 * Шаги:
 * 4. Определить целевую директорию как <projectRoot>/.agloom/overlays/<entry.id>/.
 * 5. Проверить, что целевая директория не содержит файлов.
 * 6. Создать целевую директорию и промежуточные каталоги при необходимости.
 * 7. Рекурсивно скопировать все файлы из <projectRoot>/<entry.targetRoot>/ в целевую директорию.
 * 8. Сформировать InitOutcome с copiedCount и errors.
 *
 * @param entry — запись адаптера из реестра.
 * @param projectRoot — абсолютный путь к корню проекта.
 * @param force — перезаписать существующие файлы.
 * @returns Результат выполнения импорта или строка с сообщением об ошибке (расш. 5a, 6a).
 */
export function initFiles(
  entry: AdapterRegistryEntry,
  projectRoot: string,
  force: boolean,
): InitOutcome | string {
  const errors: string[] = [];
  let copiedCount = 0;

  // Шаг 4: определить целевую директорию
  const targetDir = path.join(projectRoot, ".agloom", "overlays", entry.id);

  // Шаг 5: проверить, что целевая директория не содержит файлов
  // Расширение 5a: целевая директория содержит файлы, --force не указан
  if (!force && hasFiles(targetDir)) {
    return `.agloom/overlays/${entry.id}/ already exists. Use --force to overwrite.`;
  }
  // Расширение 5b: --force указан → пропустить проверку

  // Шаг 6: создать целевую директорию и промежуточные каталоги
  try {
    fs.mkdirSync(targetDir, { recursive: true });
  } catch (err) {
    // Расширение 6a: ошибка создания директории
    const error = err instanceof Error ? err : new Error(String(err));
    return error.message;
  }

  // Шаг 7: рекурсивно скопировать файлы из targetRoot
  const sourceDir = path.join(projectRoot, entry.targetRoot);

  // Расширение 7a: targetRoot не существует → copiedCount: 0, не является ошибкой
  if (!fs.existsSync(sourceDir)) {
    return { copiedCount: 0, errors: [] };
  }

  let files: string[];
  try {
    files = discoverFiles(sourceDir);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { copiedCount: 0, errors: [error.message] };
  }

  for (const filePath of files) {
    // Определить относительный путь внутри sourceDir
    const relativePath = path.relative(sourceDir, filePath);

    // Определить целевой путь
    const destPath = path.join(targetDir, relativePath);

    // Создать промежуточные каталоги при необходимости
    const destDir = path.dirname(destPath);
    try {
      fs.mkdirSync(destDir, { recursive: true });
    } catch (err) {
      // Расширение 7b: ошибка — добавить в errors, продолжить
      const error = err instanceof Error ? err : new Error(String(err));
      errors.push(error.message);
      continue;
    }

    // Скопировать файл
    try {
      fs.copyFileSync(filePath, destPath);
      copiedCount++;
    } catch (err) {
      // Расширение 7b: ошибка копирования — добавить в errors, продолжить
      const error = err instanceof Error ? err : new Error(String(err));
      errors.push(error.message);
    }
  }

  // Шаг 8: сформировать InitOutcome
  return { copiedCount, errors };
}
