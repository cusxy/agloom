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
 * 1. Собрать значения всех определённых полей из entry.paths.
 * 2. Для каждого пути рекурсивно удалить директорию <projectRoot>/<path>/.
 * 3. Удалить каждый файл из entry.targetFiles.
 * 4. Сформировать CleanOutcome с removedCount и errors.
 *
 * @param entry — запись адаптера из реестра.
 * @param projectRoot — абсолютный путь к корню проекта.
 * @returns Результат выполнения очистки.
 */
export function cleanFiles(entry: AdapterRegistryEntry, projectRoot: string): CleanOutcome {
  let removedCount = 0;
  const errors: string[] = [];

  // Шаг 1: Собрать значения всех определённых полей из entry.paths
  const pathKeys: (keyof typeof entry.paths)[] = ["skills", "agents", "docs", "schemas", "commands"];
  const definedPaths: string[] = [];
  for (const key of pathKeys) {
    const value = entry.paths[key];
    if (value !== undefined) {
      definedPaths.push(value);
    }
  }

  // Расширение 1a: Если paths пустой — пропустить шаг 2

  // Шаг 2: Для каждого пути рекурсивно удалить директорию
  for (const dirPath of definedPaths) {
    const fullPath = path.join(projectRoot, dirPath);

    if (!fs.existsSync(fullPath)) {
      // Расширение 2a: директория не существует — пропустить
      continue;
    }

    try {
      // Подсчитать файлы перед удалением
      const fileCount = countFilesInDir(fullPath);
      fs.rmSync(fullPath, { recursive: true });
      removedCount += fileCount;
    } catch (err) {
      // Расширение 2b: EACCES и т.п.
      const error = err instanceof Error ? err : new Error(String(err));
      errors.push(error.message);
    }
  }

  // Шаг 3: Удалить каждый файл из targetFiles
  for (const targetFile of entry.targetFiles) {
    const filePath = path.join(projectRoot, targetFile);

    if (!fs.existsSync(filePath)) {
      // Расширение 3a: файл не существует — пропустить
      continue;
    }

    try {
      fs.unlinkSync(filePath);
      removedCount++;
    } catch (err) {
      // Расширение 3b: EACCES и т.п.
      const error = err instanceof Error ? err : new Error(String(err));
      errors.push(error.message);
    }
  }

  // Шаг 4: Сформировать CleanOutcome
  return { removedCount, errors };
}
