/**
 * Gemini адаптер для agents.
 * Spec: docs/specs/agents-transpiler.md § Gemini адаптер
 *
 * agentId: "gemini"
 * targetDir: ".gemini/agents"
 *
 * Правила генерации:
 * - Адаптер возвращает relativePath = definition.relativePath (без ремаппинга).
 * - Ремаппинг выполняется транспилером (см. § Транспиляция, шаг 3).
 */

import { transformContent } from "../transform-content.js";
import type { AgentAdapter, AgentDefinition, AgentOutputFile } from "../types.js";

export class GeminiAgentAdapter implements AgentAdapter {
  readonly agentId = "gemini";
  readonly targetDir = ".gemini/agents";
  /** Карта переменных интерполяции (устанавливается CLI перед transpile). */
  variables?: Record<string, string>;
  values?: Record<string, string>;

  transpile(definitions: AgentDefinition[]): AgentOutputFile[] {
    const output: AgentOutputFile[] = [];

    for (const def of definitions) {
      // Шаг 1: трансформация контента для agentId = "gemini"
      const content = transformContent(def.rawContent, "gemini", this.variables, this.values);

      // Шаг 2: сформировать AgentOutputFile с definition.relativePath
      // Ремаппинг relativePath выполняется транспилером (§ Транспиляция, шаг 3)
      output.push({ relativePath: def.relativePath, content });
    }

    return output;
  }
}
