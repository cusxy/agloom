/**
 * Claude Code адаптер для agents.
 * Spec: docs/specs/agents-transpiler.md § Claude Code адаптер
 *
 * agentId: "claude"
 *
 * Правила генерации:
 * - .agloom/agents/<name>.md → .claude/agents/<name>.md
 */

import { transformContent } from "../transform-content.js";
import type {
  AgentAdapter,
  AgentDefinition,
  AgentOutputFile,
} from "../types.js";

export class ClaudeAgentAdapter implements AgentAdapter {
  readonly agentId = "claude";
  /** Карта переменных интерполяции (устанавливается CLI перед transpile). */
  variables?: Record<string, string>;

  transpile(definitions: AgentDefinition[]): AgentOutputFile[] {
    const output: AgentOutputFile[] = [];

    for (const def of definitions) {
      // Шаг 1: трансформация контента для agentId = "claude"
      const content = transformContent(
        def.rawContent,
        "claude",
        this.variables,
      );

      // Шаг 2: замена префикса .agloom/agents/ на .claude/agents/
      const relativePath = def.relativePath.replace(
        ".agloom/agents/",
        ".claude/agents/",
      );

      // Шаг 3: формирование AgentOutputFile
      output.push({ relativePath, content });
    }

    return output;
  }
}
