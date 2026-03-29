/**
 * Claude Code адаптер.
 * Spec: docs/specs/instructions-transpiler.md § Claude Code адаптер
 *
 * agentId: "claude"
 *
 * Правила генерации:
 * - AGLOOM.md (root)              → CLAUDE.md (root)
 * - AGLOOM.md (directory)         → CLAUDE.md (same directory)
 * - AGLOOM.local.md (root)        → CLAUDE.local.md (root)
 * - AGLOOM.local.md (directory)   → CLAUDE.local.md (same directory)
 */

import { transformContent } from "../transform-content.js";
import type { Adapter, CanonicalFile, OutputFile } from "../types.js";

export class ClaudeAdapter implements Adapter {
  readonly agentId = "claude";
  private readonly allowedAgentIds?: string[];
  /** Карта переменных интерполяции (устанавливается CLI перед transpile). */
  variables?: Record<string, string>;

  constructor(allowedAgentIds?: string[]) {
    this.allowedAgentIds = allowedAgentIds;
  }

  transpile(files: CanonicalFile[]): OutputFile[] {
    const output: OutputFile[] = [];

    // Шаг 1: отфиль��ровать файлы типов root, directory, local и directory-local
    const relevantFiles = files.filter(
      (f) =>
        f.type === "root" ||
        f.type === "directory" ||
        f.type === "local" ||
        f.type === "directory-local",
    );

    for (const file of relevantFiles) {
      // Шаг 2: трансформ��ция контента для agentId = "claude"
      const content = transformContent(
        file.content,
        "claude",
        this.allowedAgentIds,
        this.variables,
      );

      // Шаг 3-4: заменить имя файла
      let relativePath: string;
      if (file.type === "local" || file.type === "directory-local") {
        // Шаг 4: AGLOOM.local.md → CLAUDE.local.md
        relativePath = file.relativePath.replace(
          "AGLOOM.local.md",
          "CLAUDE.local.md",
        );
      } else {
        // Шаг 3: AGLOOM.md → CLAUDE.md (для root и directory)
        relativePath = file.relativePath.replace("AGLOOM.md", "CLAUDE.md");
      }

      // Шаг 5: сформировать OutputFile
      output.push({ relativePath, content });
    }

    return output;
  }
}
