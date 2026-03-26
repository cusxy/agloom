/**
 * Claude Code адаптер для skills.
 * Spec: docs/specs/skills-transpiler.md § Claude Code адаптер
 *
 * agentId: "claude"
 *
 * Правила генерации:
 * - .agloom/skills/<name>/<любой файл> → .claude/skills/<name>/<тот же файл>
 */

import type { SkillAdapter, SkillOutputFile, SkillPackage } from "../types.js";

export class ClaudeSkillAdapter implements SkillAdapter {
  readonly agentId = "claude";

  transpile(packages: SkillPackage[]): SkillOutputFile[] {
    const output: SkillOutputFile[] = [];

    // Шаг 1: для каждого пакета получить список файлов
    for (const pkg of packages) {
      for (const filePath of pkg.files) {
        // Шаг 2: заменить префикс .agloom/skills/ на .claude/skills/
        const relativePath = filePath.replace(
          ".agloom/skills/",
          ".claude/skills/",
        );

        // Шаг 3: сформировать SkillOutputFile
        output.push({ relativePath, sourcePath: filePath });
      }
    }

    return output;
  }
}
