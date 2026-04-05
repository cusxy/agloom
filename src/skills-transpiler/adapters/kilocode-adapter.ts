/**
 * KiloCode адаптер для skills.
 * Spec: docs/specs/skills-transpiler.md § KiloCode адаптер
 *
 * agentId: "kilocode"
 * targetDir: ".kilo/skills"
 */

import type { SkillAdapter } from "../types.js";

export class KiloCodeSkillAdapter implements SkillAdapter {
  readonly agentId = "kilocode";
  readonly targetDir = ".kilo/skills";
}
