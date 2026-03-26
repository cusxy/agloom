/**
 * Процедура Clean Files — удаление сгенерированных файлов адаптера.
 * Spec: docs/specs/clean-command.md § Процедура Clean Files
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { AdapterRegistryEntry, CleanOutcome } from "./types.js";

/**
 * Рекурсивно подсчитывает количество файлов (не директорий) в директории.
 */
function countFilesInDir(dir: string): number {
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      count += countFilesInDir(fullPath);
    } else {
      count++;
    }
  }
  return count;
}

/**
 * Удаляет сгенерированные файлы адаптера.
 *
 * Шаги:
 * 1. Рекурсивно удалить директорию <projectRoot>/<entry.targetRoot>/.
 * 2. Удалить каждый файл из entry.targetFiles.
 * 3. Сформировать CleanOutcome с removedCount и errors.
 *
 * @param entry — запись адаптера из реестра.
 * @param projectRoot — абсолютный путь к корню проекта.
 * @returns Результат выполнения очистки.
 */
export function cleanFiles(
  entry: AdapterRegistryEntry,
  projectRoot: string,
): CleanOutcome {
  let removedCount = 0;
  const errors: string[] = [];

  // Шаг 1: Рекурсивно удалить директорию targetRoot
  const targetRootPath = path.join(projectRoot, entry.targetRoot);

  if (fs.existsSync(targetRootPath)) {
    try {
      // Подсчитать файлы перед удалением
      const fileCount = countFilesInDir(targetRootPath);
      fs.rmSync(targetRootPath, { recursive: true });
      removedCount += fileCount;
    } catch (err) {
      // Расширение 1b: EACCES и т.п.
      const error = err instanceof Error ? err : new Error(String(err));
      errors.push(error.message);
    }
  }
  // Расширение 1a: targetRoot не существует — removedCount: 0, не ошибка

  // Шаг 2: Удалить каждый файл из targetFiles
  for (const targetFile of entry.targetFiles) {
    const filePath = path.join(projectRoot, targetFile);

    if (!fs.existsSync(filePath)) {
      // Расширение 2a: файл не существует — пропустить
      continue;
    }

    try {
      fs.unlinkSync(filePath);
      removedCount++;
    } catch (err) {
      // Расширение 2b: EACCES и т.п.
      const error = err instanceof Error ? err : new Error(String(err));
      errors.push(error.message);
    }
  }

  // Шаг 3: Сформировать CleanOutcome
  return { removedCount, errors };
}
