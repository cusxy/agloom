/**
 * AGENTS.md адаптер для agents.
 * Spec: docs/specs/agents-transpiler.md
 *
 * agentId: "agentsmd"
 *
 * Правила генерации:
 * - .agloom/agents/<name>.md → .agents/agents/<name>.md
 */

import { transformContent } from "../transform-content.js";
import type {
  AgentAdapter,
  AgentDefinition,
  AgentOutputFile,
} from "../types.js";

export class AgentsMdAgentAdapter implements AgentAdapter {
  readonly agentId = "agentsmd";
  /** Карта переменных интерполяции (устанавливается CLI перед transpile). */
  variables?: Record<string, string>;

  transpile(definitions: AgentDefinition[]): AgentOutputFile[] {
    const output: AgentOutputFile[] = [];

    for (const def of definitions) {
      // Шаг 1: трансформация контента для agentId = "agentsmd"
      const content = transformContent(
        def.rawContent,
        "agentsmd",
        this.variables,
      );

      // Шаг 2: замена префикса .agloom/agents/ на .agents/agents/
      const relativePath = def.relativePath.replace(
        ".agloom/agents/",
        ".agents/agents/",
      );

      // Шаг 3: формирование AgentOutputFile
      output.push({ relativePath, content });
    }

    return output;
  }
}
