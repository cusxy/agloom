/**
 * Claude Code адаптер.
 * Spec: docs/specs/instructions-transpiler.md § Claude Code адаптер
 *
 * agentId: "claude"
 *
 * Правила генерации:
 * - AGLOOM.md (root)              → CLAUDE.md (root)
 * - AGLOOM.md (directory)         → CLAUDE.md (same directory)
 */

import { transformContent } from "../transform-content.js";
import type { Adapter, CanonicalFile, OutputFile } from "../types.js";

export class ClaudeAdapter implements Adapter {
  readonly agentId = "claude";
  private readonly allowedAgentIds?: string[];
  /** Карта переменных интерполяции (устанавливается CLI перед transpile). */
  variables?: Record<string, string>;
  /** Resolved values для интерполяции ${values:*}. */
  values?: Record<string, string>;

  constructor(allowedAgentIds?: string[]) {
    this.allowedAgentIds = allowedAgentIds;
  }

  transpile(files: CanonicalFile[]): OutputFile[] {
    const output: OutputFile[] = [];

    // Шаг 1: отфильтровать файлы типов root и directory
    const relevantFiles = files.filter((f) => f.type === "root" || f.type === "directory");

    for (const file of relevantFiles) {
      // Шаг 2: трансформация контента для agentId = "claude"
      const content = transformContent(file.content, "claude", this.allowedAgentIds, this.variables, this.values);

      // Шаг 3: AGLOOM.md → CLAUDE.md
      const relativePath = file.relativePath.replace("AGLOOM.md", "CLAUDE.md");

      // Шаг 4: сформировать OutputFile
      output.push({ relativePath, content });
    }

    return output;
  }
}
