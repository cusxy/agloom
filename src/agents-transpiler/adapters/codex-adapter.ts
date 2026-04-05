/**
 * Codex адаптер для agents.
 * Spec: docs/specs/agents-transpiler.md § Codex адаптер
 *
 * agentId: "codex"
 * targetDir: ".codex/agents"
 *
 * Codex использует формат TOML для определений агентов. Адаптер
 * выполняет стандартную трансформацию через transformContent,
 * затем конвертирует результат из Markdown в TOML.
 */

import matter from "gray-matter";
import * as TOML from "smol-toml";
import { AgentTransformError } from "../errors.js";
import { transformContent } from "../transform-content.js";
import type { AgentAdapter, AgentDefinition, AgentOutputFile } from "../types.js";

export class CodexAgentAdapter implements AgentAdapter {
  readonly agentId = "codex";
  readonly targetDir = ".codex/agents";
  /** Карта переменных интерполяции (устанавливается CLI перед transpile). */
  variables?: Record<string, string>;
  values?: Record<string, string>;

  transpile(definitions: AgentDefinition[]): AgentOutputFile[] {
    const output: AgentOutputFile[] = [];

    for (const def of definitions) {
      // Шаг 1: трансформация контента для agentId = "codex"
      // Расширение 1a: transformContent выбрасывает AgentTransformError → пробросить
      let transformed: string;
      try {
        transformed = transformContent(def.rawContent, "codex", this.variables, this.values);
      } catch (err) {
        if (err instanceof AgentTransformError) {
          throw err;
        }
        const reason = err instanceof Error ? err.message : String(err);
        throw new AgentTransformError(`Failed to parse transformed content for '${def.name}': ${reason}`);
      }

      // Шаг 2: парсинг результата через gray-matter
      let data: Record<string, unknown>;
      let body: string;
      try {
        const parsed = matter(transformed);
        data = parsed.data;
        body = parsed.content;
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        throw new AgentTransformError(`Failed to parse transformed content for '${def.name}': ${reason}`);
      }

      // Шаг 3: если body (после trim) не пустой — добавить developer_instructions
      const trimmedBody = body.trim();
      if (trimmedBody.length > 0) {
        data.developer_instructions = trimmedBody;
      }

      // Шаг 4: сериализация в TOML
      let tomlContent: string;
      try {
        tomlContent = TOML.stringify(data as Record<string, unknown>);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        throw new AgentTransformError(`Failed to serialize TOML for '${def.name}': ${reason}`);
      }

      // Шаг 5: заменить расширение .md → .toml
      const relativePath = def.relativePath.replace(/\.md$/, ".toml");

      output.push({ relativePath, content: tomlContent });
    }

    return output;
  }
}
