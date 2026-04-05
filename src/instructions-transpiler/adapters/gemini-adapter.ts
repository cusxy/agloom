/**
 * Gemini адаптер.
 * Spec: docs/specs/instructions-transpiler.md § Gemini адаптер
 *
 * agentId: "gemini"
 *
 * Правила генерации:
 * - AGLOOM.md (root)              → GEMINI.md (root)
 * - AGLOOM.md (directory)         → GEMINI.md (same directory)
 */

import { transformContent } from "../transform-content.js";
import type { Adapter, CanonicalFile, OutputFile } from "../types.js";

export class GeminiAdapter implements Adapter {
  readonly agentId = "gemini";
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
      // Шаг 2: трансформация контента для agentId = "gemini"
      const content = transformContent(file.content, "gemini", this.allowedAgentIds, this.variables, this.values);

      // Шаг 3: AGLOOM.md → GEMINI.md
      const relativePath = file.relativePath.replace("AGLOOM.md", "GEMINI.md");

      // Шаг 4: сформировать OutputFile
      output.push({ relativePath, content });
    }

    return output;
  }
}
