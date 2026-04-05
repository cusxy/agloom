/**
 * Gemini адаптер для skills.
 * Spec: docs/specs/skills-transpiler.md § Gemini адаптер
 *
 * agentId: "gemini"
 * targetDir: ".gemini/skills"
 */

import type { SkillAdapter } from "../types.js";

export class GeminiSkillAdapter implements SkillAdapter {
  readonly agentId = "gemini";
  readonly targetDir = ".gemini/skills";
}
