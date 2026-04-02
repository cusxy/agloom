/**
 * Claude Code адаптер для skills.
 * Spec: docs/specs/skills-transpiler.md § Claude Code адаптер
 *
 * agentId: "claude"
 * targetDir: ".claude/skills"
 */

import type { SkillAdapter } from "../types.js";

export class ClaudeSkillAdapter implements SkillAdapter {
  readonly agentId = "claude";
  readonly targetDir = ".claude/skills";
}
