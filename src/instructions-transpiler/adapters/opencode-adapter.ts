/**
 * OpenCode адаптер.
 * Spec: docs/specs/instructions-transpiler.md § OpenCode адаптер
 *
 * agentId: "opencode"
 *
 * Правила генерации:
 * - OpenCode нативно читает AGENTS.md — адаптер не генерирует файлов.
 */

import type { Adapter, CanonicalFile, OutputFile } from "../types.js";

export class OpenCodeAdapter implements Adapter {
  readonly agentId = "opencode";

  transpile(_files: CanonicalFile[]): OutputFile[] {
    // Шаг 1: вернуть пустой массив (OpenCode читает AGENTS.md нативно)
    return [];
  }
}
