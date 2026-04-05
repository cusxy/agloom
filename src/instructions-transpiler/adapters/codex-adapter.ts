/**
 * Codex адаптер.
 * Spec: docs/specs/instructions-transpiler.md § Codex адаптер
 *
 * agentId: "codex"
 *
 * Codex не имеет собственного формата файла инструкций.
 * Файл AGENTS.md генерируется адаптером "agentsmd".
 * Адаптер "codex" для instructions-transpiler является no-op.
 */

import type { Adapter, CanonicalFile, OutputFile } from "../types.js";

export class CodexAdapter implements Adapter {
  readonly agentId = "codex";

  transpile(_files: CanonicalFile[]): OutputFile[] {
    // Шаг 1: вернуть пустой массив OutputFile[]
    return [];
  }
}
