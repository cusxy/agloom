/**
 * OpenCode адаптер для agents.
 * Spec: docs/specs/agents-transpiler.md § OpenCode адаптер
 *
 * agentId: "opencode"
 *
 * Правила генерации:
 * - .agloom/agents/<name>.md → .opencode/agents/<name>.md
 */

import { transformContent } from "../transform-content.js";
import type {
  AgentAdapter,
  AgentDefinition,
  AgentOutputFile,
} from "../types.js";

export class OpenCodeAgentAdapter implements AgentAdapter {
  readonly agentId = "opencode";

  transpile(definitions: AgentDefinition[]): AgentOutputFile[] {
    const output: AgentOutputFile[] = [];

    for (const def of definitions) {
      // Шаг 1: трансформация контента для agentId = "opencode"
      const content = transformContent(def.rawContent, "opencode");

      // Шаг 2: замена префикса .agloom/agents/ на .opencode/agents/
      const relativePath = def.relativePath.replace(
        ".agloom/agents/",
        ".opencode/agents/",
      );

      // Шаг 3: формирование AgentOutputFile
      output.push({ relativePath, content });
    }

    return output;
  }
}
