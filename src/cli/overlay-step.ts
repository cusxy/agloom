/**
 * Шаг provider overlay — копирование agent-специфичных файлов из overlays/.
 * Spec: docs/specs/provider-overlay.md § Операция overlay
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { AdapterRegistryEntry, TranspilerStepOutcome } from "./types.js";

/** Параметры шага overlay. */
interface OverlayStepParams {
  /** Запись адаптера из реестра. */
  entry: AdapterRegistryEntry;
  /** Абсолютный путь к корню проекта. */
  projectRoot: string;
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
 * Выполняет шаг provider overlay.
 *
 * Шаги:
 * 1. Определить директорию-источник как <projectRoot>/.agloom/overlays/<entry.id>/.
 * 2. Рекурсивно обнаружить все файлы в директории-источнике.
 * 3. Для каждого обнаруженного файла определить относительный путь
 *    файла внутри директории-источника.
 * 4. Для каждого обнаруженного файла определить целевой путь как
 *    <projectRoot>/<относительный путь>.
 * 5. Для каждого обнаруженного файла создать промежуточные каталоги
 *    при необходимости.
 * 6. Для каждого обнаруженного файла скопировать файл побайтово.
 * 7. Сформировать TranspilerStepOutcome с name: "Overlay",
 *    writtenCount и errors.
 *
 * Расширение 1a: директория-источник не существует →
 * TranspilerStepOutcome с writtenCount: 0 и пустым errors.
 *
 * Расширение 2a: ошибка обхода директории (I/O-ошибка) →
 * TranspilerStepOutcome с writtenCount: 0 и [errorMessage] в errors.
 *
 * Расширение 5a: ошибка создания промежуточного каталога →
 * добавить сообщение в errors, продолжить с оставшимися файлами.
 *
 * Расширение 6a: ошибка копирования →
 * добавить сообщение в errors, продолжить с оставшимися файлами.
 */
export function runOverlayStep(
  params: OverlayStepParams,
): TranspilerStepOutcome {
  const { entry, projectRoot } = params;
  const errors: string[] = [];
  let writtenCount = 0;

  // Шаг 1: определить директорию-источник
  const sourceDir = path.join(projectRoot, ".agloom", "overlays", entry.id);

  // Расширение 1a: директория-источник не существует
  if (!fs.existsSync(sourceDir)) {
    return { name: "Overlay", writtenCount: 0, errors: [] };
  }

  // Шаг 2: рекурсивно обнаружить все файлы
  let files: string[];
  try {
    files = discoverFiles(sourceDir);
  } catch (err) {
    // Расширение 2a: ошибка обхода директории
    const error = err instanceof Error ? err : new Error(String(err));
    return { name: "Overlay", writtenCount: 0, errors: [error.message] };
  }

  for (const filePath of files) {
    // Шаг 3: определить относительный путь внутри директории-источника
    const relativePath = path.relative(sourceDir, filePath);

    // Шаг 4: определить целевой путь
    const targetPath = path.join(projectRoot, relativePath);

    // Шаг 5: создать промежуточные каталоги при необходимости
    const targetDir = path.dirname(targetPath);
    try {
      fs.mkdirSync(targetDir, { recursive: true });
    } catch (err) {
      // Расширение 5a: ошибка создания промежуточного каталога
      const error = err instanceof Error ? err : new Error(String(err));
      errors.push(error.message);
      continue;
    }

    // Шаг 6: скопировать файл побайтово
    try {
      fs.copyFileSync(filePath, targetPath);
      writtenCount++;
    } catch (err) {
      // Расширение 6a: ошибка копирования
      const error = err instanceof Error ? err : new Error(String(err));
      errors.push(error.message);
    }
  }

  // Шаг 7: сформировать TranspilerStepOutcome
  return { name: "Overlay", writtenCount, errors };
}
