/**
 * OpenCode адаптер.
 * Spec: docs/specs/instructions-transpiler.md § OpenCode адаптер
 *
 * agentId: "opencode"
 *
 * OpenCode не имеет собственного формата файла инструкций.
 * Файл AGENTS.md генерируется адаптером "agentsmd".
 * Адаптер "opencode" для instructions-transpiler является no-op.
 */

import type { Adapter, CanonicalFile, OutputFile } from "../types.js";

export class OpenCodeAdapter implements Adapter {
  readonly agentId = "opencode";

  transpile(_files: CanonicalFile[]): OutputFile[] {
    // Шаг 1: вернуть пустой массив OutputFile[]
    return [];
  }
}
