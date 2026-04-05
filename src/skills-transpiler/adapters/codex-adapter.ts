/**
 * Codex адаптер для skills.
 * Spec: docs/specs/skills-transpiler.md § Codex адаптер
 *
 * agentId: "codex"
 * targetDir: ".agents/skills"
 *
 * Codex использует каталог .agents/skills/ (НЕ .codex/skills/)
 * для хранения skill-пакетов.
 */

import type { SkillAdapter } from "../types.js";

export class CodexSkillAdapter implements SkillAdapter {
  readonly agentId = "codex";
  readonly targetDir = ".agents/skills";
}
