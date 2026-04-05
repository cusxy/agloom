/**
 * KiloCode адаптер.
 * Spec: docs/specs/instructions-transpiler.md § KiloCode адаптер
 *
 * agentId: "kilocode"
 *
 * KiloCode не имеет собственного формата файла инструкций.
 * Файл AGENTS.md генерируется адаптером "agentsmd".
 * Адаптер "kilocode" для instructions-transpiler является no-op.
 */

import type { Adapter, CanonicalFile, OutputFile } from "../types.js";

export class KiloCodeAdapter implements Adapter {
  readonly agentId = "kilocode";

  transpile(_files: CanonicalFile[]): OutputFile[] {
    // Шаг 1: вернуть пустой массив OutputFile[]
    return [];
  }
}
