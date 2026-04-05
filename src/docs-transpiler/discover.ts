/**
 * Обнаружение файлов ресурсов в проекте.
 * Spec: docs/specs/docs-transpiler.md § Обнаружение файлов ресурсов
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { ResourceDiscoverError } from "./errors.js";
import type { ResourceFile, ResourceType } from "./types.js";

/**
 * Обнаруживает все файлы ресурсов в проекте.
 */
export function discover(projectRoot: string, agloomDir: string, resourceType: ResourceType): ResourceFile[] {
  // Шаг 1: определить путь к каталогу ресурсов
  const resourceDir = path.join(projectRoot, agloomDir, resourceType);

  // Шаг 2: проверить наличие каталога ресурсов
  // Расширение 2a: каталог не существует → пустой массив
  if (!fs.existsSync(resourceDir)) {
    return [];
  }

  // Шаг 3: рекурсивно получить список всех файлов
  const relativeBase = path.join(agloomDir, resourceType);
  return collectFiles(resourceDir, relativeBase, projectRoot);
}

/**
 * Рекурсивно собирает все файлы в директории.
 */
function collectFiles(absoluteDir: string, relativeDir: string, projectRoot: string): ResourceFile[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
  } catch (err) {
    // Расширение 3a: ошибка доступа к каталогу
    const dirPath = path.relative(projectRoot, absoluteDir);
    throw new ResourceDiscoverError(`Failed to scan directory ${dirPath}: ${(err as Error).message}`);
  }

  const files: ResourceFile[] = [];

  for (const entry of entries) {
    const entryRelative = path.join(relativeDir, entry.name);

    if (entry.isFile()) {
      files.push({ relativePath: entryRelative });
    } else if (entry.isDirectory()) {
      const subFiles = collectFiles(path.join(absoluteDir, entry.name), entryRelative, projectRoot);
      files.push(...subFiles);
    }
  }

  return files;
}
