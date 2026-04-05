/**
 * Обнаружение skill-пакетов в проекте.
 * Spec: docs/specs/skills-transpiler.md § Обнаружение skill-пакетов
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { SkillDiscoverError } from "./errors.js";
import type { SkillPackage } from "./types.js";

/**
 * Обнаруживает все skill-пакеты в проекте.
 * @param projectRoot - абсолютный путь к корню проекта.
 * @param agloomDir - относительный путь к agloom-директории (default: ".agloom").
 */
export function discover(projectRoot: string, agloomDir: string = ".agloom"): SkillPackage[] {
  const skillsDir = path.join(projectRoot, agloomDir, "skills");

  // Шаг 1: проверить наличие каталога .agloom/skills/
  // Расширение 1a: каталог не существует → пустой массив
  if (!fs.existsSync(skillsDir)) {
    return [];
  }

  // Шаг 2: получить список прямых подкаталогов .agloom/skills/
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  } catch (err) {
    // Расширение 2a: ошибка доступа к каталогу .agloom/skills/
    throw new SkillDiscoverError(`Failed to scan directory .agloom/skills/: ${(err as Error).message}`);
  }

  const packages: SkillPackage[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const dirPath = path.join(skillsDir, entry.name);
    const skillMdPath = path.join(dirPath, "SKILL.md");

    // Шаг 3: проверить наличие файла SKILL.md
    // Расширение 3a: подкаталог не содержит SKILL.md → пропустить
    if (!fs.existsSync(skillMdPath)) {
      continue;
    }

    // Шаг 4: рекурсивно получить список всех файлов в подкаталоге
    const directoryPath = path.join(agloomDir, "skills", entry.name);
    const files = collectFiles(dirPath, directoryPath, projectRoot);

    // Шаг 5: сформировать SkillPackage
    packages.push({
      name: entry.name,
      directoryPath,
      files,
    });
  }

  return packages;
}

/**
 * Рекурсивно собирает все файлы в директории.
 */
function collectFiles(absoluteDir: string, relativeDir: string, projectRoot: string): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
  } catch (err) {
    // Расширение 4a: ошибка доступа при рекурсивном сканировании
    const relativeDirPath = path.relative(projectRoot, absoluteDir);
    throw new SkillDiscoverError(`Failed to scan skill directory ${relativeDirPath}: ${(err as Error).message}`);
  }

  const files: string[] = [];

  for (const entry of entries) {
    const entryRelative = path.join(relativeDir, entry.name);

    if (entry.isFile()) {
      files.push(entryRelative);
    } else if (entry.isDirectory()) {
      const subFiles = collectFiles(path.join(absoluteDir, entry.name), entryRelative, projectRoot);
      files.push(...subFiles);
    }
  }

  return files;
}
