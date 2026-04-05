/**
 * Codex адаптер для commands.
 * Spec: docs/specs/commands-transpiler.md § Codex адаптер
 *
 * agentId: "codex"
 * targetDir: ".agents/skills"
 * Subdirectories: flatten (с hyphen-join для skill package name)
 *
 * Конвертирует команды в skill packages (.agents/skills/<name>/SKILL.md).
 */

import { AgentTransformError } from "../../agents-transpiler/errors.js";
import { transformContent } from "../../agents-transpiler/transform-content.js";
import { CommandTransformError } from "../errors.js";
import type { CommandAdapter, CommandDefinition, CommandOutputFile } from "../types.js";

export class CodexCommandAdapter implements CommandAdapter {
  readonly agentId = "codex";
  readonly targetDir = ".agents/skills";

  transpile(definitions: CommandDefinition[]): CommandOutputFile[] {
    const output: CommandOutputFile[] = [];
    const seenNames = new Map<string, string>();

    for (const def of definitions) {
      // Шаг 1: трансформация контента для agentId = "codex"
      let content: string;
      try {
        content = transformContent(def.rawContent, "codex");
      } catch (err) {
        // Расширение 1a: обернуть в CommandTransformError
        if (err instanceof AgentTransformError) {
          throw new CommandTransformError(err.message);
        }
        throw err;
      }

      // Шаг 2: заменить / на - в имени для skill package name
      const skillPackageName = def.name.replace(/\//g, "-");

      // Шаг 3: проверить конфликты имён
      if (seenNames.has(skillPackageName)) {
        throw new CommandTransformError(
          `Name conflict after flatten: '${skillPackageName}' appears in multiple subdirectories`,
        );
      }
      seenNames.set(skillPackageName, def.name);

      // Шаг 4: сформировать CommandOutputFile
      // Извлечь agloomDir prefix из relativePath
      const parts = def.relativePath.split("/");
      const commandsIdx = parts.indexOf("commands");
      const agloomPrefix = parts.slice(0, commandsIdx).join("/");
      const basePath = agloomPrefix ? `${agloomPrefix}/commands` : "commands";

      const relativePath = `${basePath}/${skillPackageName}/SKILL.md`;

      output.push({ relativePath, content });
    }

    return output;
  }
}
