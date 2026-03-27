/**
 * Процедура Init Files — импорт существующих agent-специфичных файлов в overlays/.
 * Процедура Backup Project Files — бэкап project-файлов в .agloom/instructions/.
 * Spec: docs/specs/init-command.md § Процедура Init Overlay Files, § Процедура Backup Project Files
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { adapterRegistry } from "./adapter-registry.js";
import type { AdapterRegistryEntry, InitOutcome } from "./types.js";

/** Результат выполнения бэкапа project-файлов. */
export interface ProjectBackupOutcome {
  /** Количество скопированных файлов. */
  copiedCount: number;
  /** Сообщения об ошибках. */
  errors: string[];
}

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
 * Рекурсивно сканирует директорию на наличие файлов с указанными именами.
 * Исключает node_modules/, скрытые каталоги (имя начинается с .) и .agloom/.
 *
 * @param dir — абсолютный путь к текущей директории сканирования.
 * @param projectRoot — абсолютный путь к корню проекта (для вычисления относительного пути).
 * @param fileNames — набор имён файлов для поиска.
 * @returns Массив объектов { absolutePath, relativePath }.
 */
function scanProjectFiles(
  dir: string,
  projectRoot: string,
  fileNames: Set<string>,
): { absolutePath: string; relativePath: string }[] {
  const results: { absolutePath: string; relativePath: string }[] = [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Исключить node_modules и скрытые каталоги (включая .agloom)
      if (entry.name === "node_modules" || entry.name.startsWith(".")) {
        continue;
      }
      results.push(...scanProjectFiles(fullPath, projectRoot, fileNames));
    } else if (fileNames.has(entry.name)) {
      const relativePath = path.relative(projectRoot, fullPath);
      results.push({ absolutePath: fullPath, relativePath });
    }
  }

  return results;
}

/**
 * Процедура Backup Project Files — бэкап agent-специфичных project-файлов
 * из корня проекта в .agloom/instructions/.
 *
 * Spec: docs/specs/init-command.md § Процедура Backup Project Files
 *
 * @param projectRoot — абсолютный путь к корню проекта.
 * @param force — перезаписать существующие файлы.
 * @returns Результат бэкапа или строка-сообщение об ошибке.
 */
export function backupProjectFiles(
  projectRoot: string,
  force: boolean,
): ProjectBackupOutcome | string {
  const errors: string[] = [];
  let copiedCount = 0;

  // Шаг 1: прочитать реестр адаптеров целиком
  const registry = adapterRegistry;

  // Шаг 2-3: собрать объединённый набор имён файлов из projectFiles всех записей (без дубликатов)
  const fileNames = new Set<string>();
  for (const entry of registry) {
    for (const name of entry.projectFiles) {
      fileNames.add(name);
    }
  }

  // Шаг 4: рекурсивно просканировать projectRoot
  // Шаг 5: исключить node_modules/, скрытые каталоги и .agloom/
  const foundFiles = scanProjectFiles(projectRoot, projectRoot, fileNames);

  // Шаг 6: определить целевую директорию
  const targetDir = path.join(projectRoot, ".agloom", "instructions");

  // Шаг 7: проверить, что целевая директория не содержит файлов
  // Расширение 7a: целевая директория содержит файлы, force=false
  if (!force && hasFiles(targetDir)) {
    return ".agloom/instructions/ already exists. Use --force to overwrite.";
  }
  // Расширение 7b: force=true → пропустить проверку

  // Если файлов для бэкапа нет — не создаём пустую директорию
  if (foundFiles.length === 0) {
    return { copiedCount: 0, errors: [] };
  }

  // Шаг 8: создать целевую директорию и промежуточные каталоги
  try {
    fs.mkdirSync(targetDir, { recursive: true });
  } catch (err) {
    // Расширение 8a: ошибка создания директории
    const error = err instanceof Error ? err : new Error(String(err));
    return error.message;
  }

  // Шаги 9-10: для каждого найденного файла скопировать в .agloom/instructions/<relativePath>
  for (const file of foundFiles) {
    const destPath = path.join(targetDir, file.relativePath);
    const destDir = path.dirname(destPath);

    try {
      fs.mkdirSync(destDir, { recursive: true });
    } catch (err) {
      // Расширение 10a: ошибка — добавить в errors, продолжить
      const error = err instanceof Error ? err : new Error(String(err));
      errors.push(error.message);
      continue;
    }

    try {
      fs.copyFileSync(file.absolutePath, destPath);
      copiedCount++;
    } catch (err) {
      // Расширение 10a: ошибка копирования — добавить в errors, продолжить
      const error = err instanceof Error ? err : new Error(String(err));
      errors.push(error.message);
    }
  }

  // Шаг 11: сформировать ProjectBackupOutcome
  return { copiedCount, errors };
}

/**
 * Процедура Init Overlay Files — импортирует существующие agent-специфичные файлы в overlays/.
 *
 * Spec: docs/specs/init-command.md § Процедура Init Overlay Files
 *
 * @param entry — запись адаптера из реестра.
 * @param projectRoot — абсолютный путь к корню проекта.
 * @param force — перезаписать существующие файлы.
 * @returns Результат выполнения импорта или строка с сообщением об ошибке (расш. 2a, 3a).
 */
export function initFiles(
  entry: AdapterRegistryEntry,
  projectRoot: string,
  force: boolean,
): InitOutcome | string {
  const errors: string[] = [];
  let copiedCount = 0;

  // Шаг 1: определить целевую директорию
  const targetDir = path.join(projectRoot, ".agloom", "overlays", entry.id);

  // Шаг 2: проверить, что целевая директория не содержит файлов
  // Расширение 2a: целевая директория содержит файлы, --force не указан
  if (!force && hasFiles(targetDir)) {
    return `.agloom/overlays/${entry.id}/ already exists. Use --force to overwrite.`;
  }
  // Расширение 2b: --force указан → пропустить проверку

  // Шаг 4: рекурсивно скопировать файлы из targetRoot
  const sourceDir = path.join(projectRoot, entry.targetRoot);

  // Расширение 4a: targetRoot не существует → copiedCount: 0, не является ошибкой
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

  // Если файлов нет — не создаём пустую директорию
  if (files.length === 0) {
    return { copiedCount: 0, errors: [] };
  }

  // Шаг 3: создать целевую директорию и промежуточные каталоги
  try {
    fs.mkdirSync(targetDir, { recursive: true });
  } catch (err) {
    // Расширение 3a: ошибка создания директории
    const error = err instanceof Error ? err : new Error(String(err));
    return error.message;
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
      // Расширение 4b: ошибка — добавить в errors, продолжить
      const error = err instanceof Error ? err : new Error(String(err));
      errors.push(error.message);
      continue;
    }

    // Скопировать файл
    try {
      fs.copyFileSync(filePath, destPath);
      copiedCount++;
    } catch (err) {
      // Расширение 4b: ошибка копирования — добавить в errors, продолжить
      const error = err instanceof Error ? err : new Error(String(err));
      errors.push(error.message);
    }
  }

  // Шаг 5: сформировать InitOutcome
  return { copiedCount, errors };
}
