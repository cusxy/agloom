/**
 * OpenCode адаптер для skills.
 * Spec: docs/specs/skills-transpiler.md § OpenCode адаптер
 *
 * agentId: "opencode"
 *
 * Правила генерации:
 * - OpenCode нативно читает .agents/skills/ — адаптер не генерирует файлов.
 */

import type { SkillAdapter, SkillOutputFile, SkillPackage } from "../types.js";

export class OpenCodeSkillAdapter implements SkillAdapter {
  readonly agentId = "opencode";

  transpile(_packages: SkillPackage[]): SkillOutputFile[] {
    // Шаг 1: вернуть пустой массив (OpenCode читает .agents/skills/ нативно)
    return [];
  }
}
