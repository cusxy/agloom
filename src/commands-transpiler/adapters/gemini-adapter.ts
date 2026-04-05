/**
 * Gemini адаптер для commands.
 * Spec: docs/specs/commands-transpiler.md § Gemini адаптер
 *
 * agentId: "gemini"
 * targetDir: ".gemini/commands"
 * Subdirectories: preserve
 *
 * Gemini CLI использует TOML для определений команд.
 */

import matter from "gray-matter";
import * as TOML from "smol-toml";
import { AgentTransformError } from "../../agents-transpiler/errors.js";
import { transformContent } from "../../agents-transpiler/transform-content.js";
import { CommandTransformError } from "../errors.js";
import type { CommandAdapter, CommandDefinition, CommandOutputFile } from "../types.js";

export class GeminiCommandAdapter implements CommandAdapter {
  readonly agentId = "gemini";
  readonly targetDir = ".gemini/commands";

  transpile(definitions: CommandDefinition[]): CommandOutputFile[] {
    const output: CommandOutputFile[] = [];

    for (const def of definitions) {
      // Шаг 1: трансформация контента для agentId = "gemini"
      let transformed: string;
      try {
        transformed = transformContent(def.rawContent, "gemini");
      } catch (err) {
        // Расширение 1a: обернуть в CommandTransformError
        if (err instanceof AgentTransformError) {
          throw new CommandTransformError(err.message);
        }
        const reason = err instanceof Error ? err.message : String(err);
        throw new CommandTransformError(`Failed to parse transformed content for '${def.name}': ${reason}`);
      }

      // Шаг 2: парсинг результата через gray-matter
      let data: Record<string, unknown>;
      let body: string;
      try {
        const parsed = matter(transformed);
        data = parsed.data;
        body = parsed.content;
      } catch (err) {
        // Расширение 2a: ошибка парсинга gray-matter
        const reason = err instanceof Error ? err.message : String(err);
        throw new CommandTransformError(`Failed to parse transformed content for '${def.name}': ${reason}`);
      }

      // Шаг 3: если body (после trim) не пустой — добавить prompt
      const trimmedBody = body.trim();
      if (trimmedBody.length > 0) {
        data.prompt = trimmedBody;
      }

      // Шаг 4: сериализация в TOML
      let tomlContent: string;
      try {
        tomlContent = TOML.stringify(data as Record<string, unknown>);
      } catch (err) {
        // Расширение 4a: ошибка сериализации TOML
        const reason = err instanceof Error ? err.message : String(err);
        throw new CommandTransformError(`Failed to serialize TOML for '${def.name}': ${reason}`);
      }

      // Шаг 5: заменить расширение .md → .toml
      const relativePath = def.relativePath.replace(/\.md$/, ".toml");

      output.push({ relativePath, content: tomlContent });
    }

    return output;
  }
}
