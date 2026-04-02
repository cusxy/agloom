/**
 * OpenCode адаптер для skills.
 * Spec: docs/specs/skills-transpiler.md § OpenCode адаптер
 *
 * agentId: "opencode"
 * targetDir: ".opencode/skills"
 */

import type { SkillAdapter } from "../types.js";

export class OpenCodeSkillAdapter implements SkillAdapter {
  readonly agentId = "opencode";
  readonly targetDir = ".opencode/skills";
}
