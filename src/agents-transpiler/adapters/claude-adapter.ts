/**
 * Claude Code адаптер для agents.
 * Spec: docs/specs/agents-transpiler.md § Claude Code адаптер
 *
 * agentId: "claude"
 * targetDir: ".claude/agents"
 *
 * Правила генерации:
 * - Адаптер возвращает relativePath = definition.relativePath (без ремаппинга).
 * - Ремаппинг выполняется транспилером (см. § Транспиляция, шаг 3).
 */

import { transformContent } from "../transform-content.js";
import type {
  AgentAdapter,
  AgentDefinition,
  AgentOutputFile,
} from "../types.js";

export class ClaudeAgentAdapter implements AgentAdapter {
  readonly agentId = "claude";
  readonly targetDir = ".claude/agents";
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

      // Шаг 2: сформировать AgentOutputFile с definition.relativePath
      // Ремаппинг relativePath выполняется транспилером (§ Транспиляция, шаг 3)
      output.push({ relativePath: def.relativePath, content });
    }

    return output;
  }
}
