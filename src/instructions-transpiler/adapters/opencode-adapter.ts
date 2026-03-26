/**
 * OpenCode адаптер.
 * Spec: docs/specs/instructions-transpiler.md § OpenCode адаптер
 *
 * agentId: "opencode"
 *
 * Правила генерации:
 * - AGLOOM.md (root) → AGENTS.md (root)
 * - directory, local, directory-local — не поддерживаются.
 */

import type { Adapter, CanonicalFile, OutputFile } from "../types.js";

export class OpenCodeAdapter implements Adapter {
  readonly agentId = "opencode";

  transpile(files: CanonicalFile[]): OutputFile[] {
    const output: OutputFile[] = [];

    // Шаг 1: отфильтровать только root файлы
    const rootFiles = files.filter((f) => f.type === "root");

    for (const file of rootFiles) {
      // Шаг 2: заменить AGLOOM.md → AGENTS.md
      const relativePath = file.relativePath.replace("AGLOOM.md", "AGENTS.md");

      // Шаг 3: сформировать OutputFile с file.content
      output.push({ relativePath, content: file.content });
    }

    return output;
  }
}
