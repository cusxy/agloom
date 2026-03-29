/**
 * AGENTS.md адаптер.
 * Spec: docs/specs/instructions-transpiler.md § AGENTS.md адаптер
 *
 * agentId: "agentsmd"
 *
 * Правила генерации:
 * - AGLOOM.md (root)              → AGENTS.md (root)
 * - AGLOOM.md (directory)         → AGENTS.md (same directory)
 * - local, directory-local        — не генерируются
 */

import { transformContent } from "../transform-content.js";
import type { Adapter, CanonicalFile, OutputFile } from "../types.js";

export class AgentsMdAdapter implements Adapter {
  readonly agentId = "agentsmd";
  private readonly allowedAgentIds?: string[];
  /** Карта переменных интерполяции (устанавливается CLI перед transpile). */
  variables?: Record<string, string>;

  constructor(allowedAgentIds?: string[]) {
    this.allowedAgentIds = allowedAgentIds;
  }

  transpile(files: CanonicalFile[]): OutputFile[] {
    const output: OutputFile[] = [];

    // Шаг 1: отфильтровать файлы типов root и directory
    const relevantFiles = files.filter(
      (f) => f.type === "root" || f.type === "directory",
    );

    for (const file of relevantFiles) {
      // Шаг 2: трансформация контента для agentId = "agentsmd"
      const content = transformContent(
        file.content,
        "agentsmd",
        this.allowedAgentIds,
        this.variables,
      );

      // Шаг 3: заменить AGLOOM.md → AGENTS.md
      const relativePath = file.relativePath.replace("AGLOOM.md", "AGENTS.md");

      // Шаг 4: сформировать OutputFile
      output.push({ relativePath, content });
    }

    return output;
  }
}
