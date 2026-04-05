/**
 * Обнаружение определений агентов в проекте.
 * Spec: docs/specs/agents-transpiler.md § Обнаружение определений агентов
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { AgentDiscoverError } from "./errors.js";
import type { AgentDefinition } from "./types.js";

/**
 * Обнаруживает все определения агентов в проекте.
 * @param projectRoot - абсолютный путь к корню проекта.
 * @param agloomDir - относительный путь к agloom-директории (default: ".agloom").
 */
export function discover(projectRoot: string, agloomDir: string = ".agloom"): AgentDefinition[] {
  const agentsDir = path.join(projectRoot, agloomDir, "agents");

  // Шаг 1: проверить наличие каталога .agloom/agents/
  // Расширение 1a: каталог не существует → пустой массив
  if (!fs.existsSync(agentsDir)) {
    return [];
  }

  // Шаг 2: получить список прямых дочерних файлов каталога .agloom/agents/
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(agentsDir, { withFileTypes: true });
  } catch (err) {
    // Расширение 2a: ошибка доступа к каталогу (EACCES)
    throw new AgentDiscoverError(`Failed to scan directory .agloom/agents/: ${(err as Error).message}`);
  }

  const definitions: AgentDefinition[] = [];

  for (const entry of entries) {
    // Только файлы (не каталоги и не символические ссылки)
    if (!entry.isFile()) {
      continue;
    }

    // Шаг 3: отфильтровать файлы, оставив только .md
    if (!entry.name.endsWith(".md")) {
      continue;
    }

    // Шаг 4: прочитать содержимое каждого .md файла
    const relativePath = path.join(agloomDir, "agents", entry.name);
    const absolutePath = path.join(agentsDir, entry.name);

    let content: string;
    try {
      content = fs.readFileSync(absolutePath, "utf-8");
    } catch (err) {
      // Расширение 4a: ошибка чтения файла
      throw new AgentDiscoverError(`Failed to read ${relativePath}: ${(err as Error).message}`);
    }

    // Шаг 5: сформировать AgentDefinition
    const name = entry.name.replace(/\.md$/, "");
    definitions.push({
      name,
      relativePath,
      rawContent: content,
    });
  }

  return definitions;
}
