/**
 * AGENTS.md адаптер для skills.
 * Spec: docs/specs/skills-transpiler.md
 *
 * agentId: "agentsmd"
 *
 * Правила генерации:
 * - .agloom/skills/<name>/<любой файл> → .agents/skills/<name>/<тот же файл>
 */

import type { SkillAdapter, SkillOutputFile, SkillPackage } from "../types.js";

export class AgentsMdSkillAdapter implements SkillAdapter {
  readonly agentId = "agentsmd";

  transpile(packages: SkillPackage[]): SkillOutputFile[] {
    const output: SkillOutputFile[] = [];

    // Шаг 1: для каждого пакета получить список файлов
    for (const pkg of packages) {
      for (const filePath of pkg.files) {
        // Шаг 2: заменить префикс .agloom/skills/ на .agents/skills/
        const relativePath = filePath.replace(
          ".agloom/skills/",
          ".agents/skills/",
        );

        // Шаг 3: сформировать SkillOutputFile
        output.push({ relativePath, sourcePath: filePath });
      }
    }

    return output;
  }
}
