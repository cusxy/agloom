/**
 * Процедура Init Files — импорт существующих agent-специфичных файлов в overlays/.
 * Spec: docs/specs/init-command.md § Процедура Init Overlay Files
 */

import * as fs from "node:fs";
import * as path from "node:path";
import fg from "fast-glob";
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
 * Проверяет, содержит ли путь glob-метасимволы.
 */
function isGlobPattern(p: string): boolean {
  return /[*?{}]/.test(p);
}

/**
 * Создаёт файл .agloom/config.yml с указанным списком адаптеров.
 *
 * Spec: docs/specs/init-command.md § Создание конфигурационного файла
 *
 * @param projectRoot — абсолютный путь к корню проекта.
 * @param adapterIds — список идентификаторов адаптеров для записи в конфиг.
 */
export function createConfigFile(projectRoot: string, adapterIds: string[]): void {
  const configDir = path.join(projectRoot, ".agloom");
  const configPath = path.join(configDir, "config.yml");

  fs.mkdirSync(configDir, { recursive: true });

  const adapterLines = adapterIds.map((id) => `  - ${id}`).join("\n");
  const content = `# Agloom configuration
# List of adapters to use by default when no --adapter or --all flag is provided.
# Run 'agloom adapters --all' to see all available adapters.
adapters:
${adapterLines}
`;

  fs.writeFileSync(configPath, content);
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
export function initFiles(entry: AdapterRegistryEntry, projectRoot: string, force: boolean): InitOutcome | string {
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

  // Шаг 4: для каждого пути из entry.overlayImportPaths, собрать файлы для копирования
  const filesToCopy: { absolutePath: string; relativePath: string }[] = [];

  for (const importPath of entry.overlayImportPaths) {
    // Определить тип пути: glob или литеральный
    if (isGlobPattern(importPath)) {
      // Glob-паттерн: резолвить через fast-glob
      // Spec: docs/specs/adapter-registry-ext.md § Расширение AdapterRegistryEntry
      // cwd: projectRoot, dot: false, ignore: ["**/node_modules/**"]
      let matched: string[];
      try {
        matched = fg.sync(importPath, {
          cwd: projectRoot,
          dot: false,
          ignore: ["**/node_modules/**"],
        });
      } catch (err) {
        // Расширение 4c: ошибка fast-glob → добавить в errors, продолжить
        const error = err instanceof Error ? err : new Error(String(err));
        errors.push(error.message);
        continue;
      }
      for (const relativePath of matched) {
        const absolutePath = path.join(projectRoot, relativePath);
        filesToCopy.push({ absolutePath, relativePath });
      }
    } else {
      // Литеральный путь: файл или директория
      const sourcePath = path.join(projectRoot, importPath);

      if (!fs.existsSync(sourcePath)) {
        // Путь не существует (и не является glob-паттерном): пропустить без ошибки
        continue;
      }

      const stat = fs.statSync(sourcePath);
      if (stat.isDirectory()) {
        // Рекурсивно собрать все файлы из директории
        let files: string[];
        try {
          files = discoverFiles(sourcePath);
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          errors.push(error.message);
          continue;
        }
        for (const filePath of files) {
          const relativePath = path.join(importPath, path.relative(sourcePath, filePath));
          filesToCopy.push({ absolutePath: filePath, relativePath });
        }
      } else {
        // Это файл — копировать как есть
        filesToCopy.push({
          absolutePath: sourcePath,
          relativePath: importPath,
        });
      }
    }
  }

  // Если файлов нет — не создаём пустую директорию
  if (filesToCopy.length === 0) {
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

  for (const file of filesToCopy) {
    // Определить целевой путь
    const destPath = path.join(targetDir, file.relativePath);

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
      fs.copyFileSync(file.absolutePath, destPath);
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
