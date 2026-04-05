/**
 * KiloCode адаптер для commands.
 * Spec: docs/specs/commands-transpiler.md § KiloCode адаптер
 *
 * agentId: "kilocode"
 * targetDir: ".kilo/commands"
 * Subdirectories: flatten
 */

import * as path from "node:path";
import { AgentTransformError } from "../../agents-transpiler/errors.js";
import { transformContent } from "../../agents-transpiler/transform-content.js";
import { CommandTransformError } from "../errors.js";
import type { CommandAdapter, CommandDefinition, CommandOutputFile } from "../types.js";

export class KiloCodeCommandAdapter implements CommandAdapter {
  readonly agentId = "kilocode";
  readonly targetDir = ".kilo/commands";

  transpile(definitions: CommandDefinition[]): CommandOutputFile[] {
    const output: CommandOutputFile[] = [];
    const seenNames = new Map<string, string>();

    for (const def of definitions) {
      // Шаг 1: трансформация контента для agentId = "kilocode"
      let content: string;
      try {
        content = transformContent(def.rawContent, "kilocode");
      } catch (err) {
        // Расширение 1a: обернуть в CommandTransformError
        if (err instanceof AgentTransformError) {
          throw new CommandTransformError(err.message);
        }
        throw err;
      }

      // Шаг 2: flatten relativePath
      const filename = path.basename(def.relativePath);
      const agloomDir = def.relativePath.split("/").slice(0, -1);
      const commandsIdx = agloomDir.indexOf("commands");
      const prefix = agloomDir.slice(0, commandsIdx + 1).join("/");
      const flatRelativePath = `${prefix}/${filename}`;

      // Шаг 3: проверить конфликты имён
      const nameWithoutExt = filename.replace(/\.md$/, "");
      if (seenNames.has(nameWithoutExt)) {
        throw new CommandTransformError(
          `Name conflict after flatten: '${nameWithoutExt}' appears in multiple subdirectories`,
        );
      }
      seenNames.set(nameWithoutExt, def.name);

      // Шаг 4: сформировать CommandOutputFile
      output.push({ relativePath: flatRelativePath, content });
    }

    return output;
  }
}
