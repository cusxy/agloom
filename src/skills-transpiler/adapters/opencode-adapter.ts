/**
 * OpenCode адаптер для skills.
 * Spec: docs/specs/skills-transpiler.md § OpenCode адаптер
 *
 * agentId: "opencode"
 *
 * Правила генерации:
 * - .agloom/skills/<name>/<любой файл> → .opencode/skills/<name>/<тот же файл>
 */

import type { SkillAdapter, SkillOutputFile, SkillPackage } from "../types.js";

export class OpenCodeSkillAdapter implements SkillAdapter {
  readonly agentId = "opencode";

  transpile(packages: SkillPackage[]): SkillOutputFile[] {
    const output: SkillOutputFile[] = [];

    // Шаг 1: для каждого пакета получить список файлов
    for (const pkg of packages) {
      for (const filePath of pkg.files) {
        // Шаг 2: заменить префикс .agloom/skills/ на .opencode/skills/
        const relativePath = filePath.replace(
          ".agloom/skills/",
          ".opencode/skills/",
        );

        // Шаг 3: сформировать SkillOutputFile
        output.push({ relativePath, sourcePath: filePath });
      }
    }

    return output;
  }
}
