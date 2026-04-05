/**
 * Обнаружение определений команд в проекте (рекурсивное сканирование).
 * Spec: docs/specs/commands-transpiler.md § Обнаружение определений команд
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { CommandDiscoverError } from "./errors.js";
import type { CommandDefinition } from "./types.js";

/**
 * Рекурсивно сканирует каталог и возвращает все файлы.
 */
function scanDirectory(dirPath: string, basePath: string, agloomDir: string): CommandDefinition[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (err) {
    // Расширение 3a: ошибка доступа к каталогу (EACCES)
    throw new CommandDiscoverError(`Failed to scan directory ${agloomDir}/commands/: ${(err as Error).message}`);
  }

  const definitions: CommandDefinition[] = [];

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // Рекурсивно сканировать подкаталоги
      definitions.push(...scanDirectory(entryPath, basePath, agloomDir));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    // Шаг 4: отфильтровать файлы, оставив только .md
    if (!entry.name.endsWith(".md")) {
      continue;
    }

    // Шаг 5: прочитать содержимое каждого .md файла
    const relativeFromCommands = path.relative(basePath, entryPath);
    const relativePath = path.join(agloomDir, "commands", relativeFromCommands);

    let content: string;
    try {
      content = fs.readFileSync(entryPath, "utf-8");
    } catch (err) {
      // Расширение 5a: ошибка чтения файла
      throw new CommandDiscoverError(`Failed to read ${relativePath}: ${(err as Error).message}`);
    }

    // Шаг 6: сформировать CommandDefinition
    const name = relativeFromCommands.replace(/\.md$/, "");
    definitions.push({
      name,
      relativePath,
      rawContent: content,
    });
  }

  return definitions;
}

/**
 * Обнаруживает все определения команд в проекте.
 * @param projectRoot - абсолютный путь к корню проекта.
 * @param agloomDir - относительный путь к agloom-директории (default: ".agloom").
 */
export function discover(projectRoot: string, agloomDir: string = ".agloom"): CommandDefinition[] {
  const commandsDir = path.join(projectRoot, agloomDir, "commands");

  // Шаг 2: проверить наличие каталога commands
  // Расширение 2a: каталог не существует → пустой массив
  if (!fs.existsSync(commandsDir)) {
    return [];
  }

  return scanDirectory(commandsDir, commandsDir, agloomDir);
}
