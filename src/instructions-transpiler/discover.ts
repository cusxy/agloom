/**
 * Обнаружение канонических файлов в проекте.
 * Spec: docs/specs/instructions-transpiler.md § Обнаружение канонических файлов
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { DiscoverError } from "./errors.js";
import type { CanonicalFile } from "./types.js";

/**
 * Обнаруживает все канонические файлы в проекте.
 */
export function discover(projectRoot: string): CanonicalFile[] {
  const files: CanonicalFile[] = [];

  // Загружаем .gitignore паттерны (если файл существует)
  const gitignorePatterns = loadGitignorePatterns(projectRoot);

  // Шаг 1: проверить наличие AGENTS.md в projectRoot
  const rootAgents = path.join(projectRoot, "AGENTS.md");
  if (fs.existsSync(rootAgents)) {
    files.push({
      relativePath: "AGENTS.md",
      type: "root",
      content: readFileSafe(rootAgents, "AGENTS.md"),
    });
  }

  // Шаг 2: проверить наличие AGENTS.local.md в projectRoot
  const localAgents = path.join(projectRoot, "AGENTS.local.md");
  if (fs.existsSync(localAgents)) {
    files.push({
      relativePath: "AGENTS.local.md",
      type: "local",
      content: readFileSafe(localAgents, "AGENTS.local.md"),
    });
  }

  // Шаг 3: рекурсивно найти все AGENTS.md в подпапках
  const subdirFiles = scanDirectory(
    projectRoot,
    projectRoot,
    gitignorePatterns,
  );
  files.push(...subdirFiles);

  return files;
}

/**
 * Загружает паттерны из .gitignore. Возвращает пустой массив, если файл не существует.
 */
function loadGitignorePatterns(projectRoot: string): string[] {
  const gitignorePath = path.join(projectRoot, ".gitignore");
  if (!fs.existsSync(gitignorePath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(gitignorePath, "utf-8");
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));
  } catch {
    return [];
  }
}

/**
 * Проверяет, должен ли каталог быть исключён.
 */
function isExcludedDir(
  dirName: string,
  relativeDirPath: string,
  gitignorePatterns: string[],
): boolean {
  // Шаг 5: исключить node_modules
  if (dirName === "node_modules") {
    return true;
  }

  // Шаг 6: исключить скрытые каталоги (начинающиеся с '.')
  if (dirName.startsWith(".")) {
    return true;
  }

  // Шаг 4: исключить каталоги из .gitignore
  for (const pattern of gitignorePatterns) {
    // Простое сравнение: имя каталога совпадает с паттерном
    // или относительный путь начинается с паттерна
    const cleanPattern = pattern.replace(/\/$/, "");
    if (dirName === cleanPattern || relativeDirPath === cleanPattern) {
      return true;
    }
  }

  return false;
}

/**
 * Рекурсивно сканирует каталог на наличие AGENTS.md файлов в подпапках.
 */
function scanDirectory(
  currentDir: string,
  projectRoot: string,
  gitignorePatterns: string[],
): CanonicalFile[] {
  const files: CanonicalFile[] = [];
  let entries: fs.Dirent[];

  try {
    entries = fs.readdirSync(currentDir, { withFileTypes: true });
  } catch (err) {
    const relativePath = path.relative(projectRoot, currentDir);
    throw new DiscoverError(
      `Failed to scan directory ${relativePath || "."}: ${(err as Error).message}`,
    );
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const dirPath = path.join(currentDir, entry.name);
    const relativeDirPath = path.relative(projectRoot, dirPath);

    if (isExcludedDir(entry.name, relativeDirPath, gitignorePatterns)) {
      continue;
    }

    // Check for AGENTS.md in this subdirectory
    const agentsFile = path.join(dirPath, "AGENTS.md");
    if (fs.existsSync(agentsFile)) {
      const relativePath = path.join(relativeDirPath, "AGENTS.md");
      files.push({
        relativePath,
        type: "directory",
        content: readFileSafe(agentsFile, relativePath),
      });
    }

    // Check for AGENTS.local.md in this subdirectory
    const agentsLocalFile = path.join(dirPath, "AGENTS.local.md");
    if (fs.existsSync(agentsLocalFile)) {
      const relativePath = path.join(relativeDirPath, "AGENTS.local.md");
      files.push({
        relativePath,
        type: "directory-local",
        content: readFileSafe(agentsLocalFile, relativePath),
      });
    }

    // Recurse into subdirectories
    const subFiles = scanDirectory(dirPath, projectRoot, gitignorePatterns);
    files.push(...subFiles);
  }

  return files;
}

/**
 * Безопасно читает файл, выбрасывая DiscoverError при ошибке.
 */
function readFileSafe(absolutePath: string, relativePath: string): string {
  try {
    return fs.readFileSync(absolutePath, "utf-8");
  } catch (err) {
    throw new DiscoverError(
      `Failed to read ${relativePath}: ${(err as Error).message}`,
    );
  }
}
