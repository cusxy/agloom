/**
 * Claude Code адаптер для commands.
 * Spec: docs/specs/commands-transpiler.md § Claude Code адаптер
 *
 * agentId: "claude"
 * targetDir: ".claude/commands"
 * Subdirectories: preserve
 */

import { AgentTransformError } from "../../agents-transpiler/errors.js";
import { transformContent } from "../../agents-transpiler/transform-content.js";
import { CommandTransformError } from "../errors.js";
import type { CommandAdapter, CommandDefinition, CommandOutputFile } from "../types.js";

export class ClaudeCommandAdapter implements CommandAdapter {
  readonly agentId = "claude";
  readonly targetDir = ".claude/commands";

  transpile(definitions: CommandDefinition[]): CommandOutputFile[] {
    const output: CommandOutputFile[] = [];

    for (const def of definitions) {
      // Шаг 1: трансформация контента для agentId = "claude"
      let content: string;
      try {
        content = transformContent(def.rawContent, "claude");
      } catch (err) {
        // Расширение 1a: обернуть в CommandTransformError
        if (err instanceof AgentTransformError) {
          throw new CommandTransformError(err.message);
        }
        throw err;
      }

      // Шаг 2: сформировать CommandOutputFile с definition.relativePath
      output.push({ relativePath: def.relativePath, content });
    }

    return output;
  }
}
