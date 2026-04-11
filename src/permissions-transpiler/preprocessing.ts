/**
 * Общий препроцессинг правил permissions.
 *
 * Spec: docs/specs/permissions-transpiler.md § Общий препроцессинг правил,
 * § Препроцессинг для decision-severity-wins движков.
 *
 * Экспортирует два хелпера:
 *  - dropShadowedRules        — удаляет later-правила, shadowed earlier
 *                               не-строгим префиксом (first-match-wins).
 *  - flattenWhitelistConflicts — удаляет broader-later правила, перекрывающие
 *                                narrower-earlier с более высокой severity
 *                                (most-restrictive-wins движки).
 */

import type { PermissionRule } from "./types.js";

export type PreprocessingSection = "shell" | "mcp" | "file";

/**
 * Возвращает argv-представление паттерна для сравнения префиксов.
 *
 * Возвращает `undefined`, если правило не должно участвовать в prefix-сравнениях
 * (например, bare/leading/middle wildcard в shell-секции или `*:*` в mcp).
 */
function argvOf(pattern: string, section: PreprocessingSection): string[] | undefined {
  if (section === "shell") {
    // Bare wildcard
    if (pattern === "*") return undefined;
    // Leading wildcard
    if (pattern.startsWith("*")) return undefined;
    // Trailing " *" → strip, затем убедиться что middle wildcard нет
    if (pattern.endsWith(" *")) {
      const stripped = pattern.slice(0, -2);
      if (stripped.includes("*")) return undefined;
      return stripped.split(/\s+/).filter((s) => s.length > 0);
    }
    // Без wildcard
    if (pattern.includes("*")) return undefined;
    return pattern.split(/\s+/).filter((s) => s.length > 0);
  }

  if (section === "mcp") {
    const colonIdx = pattern.indexOf(":");
    if (colonIdx === -1) {
      // malformed — treat as opaque single token
      return [pattern];
    }
    const server = pattern.slice(0, colonIdx);
    const tool = pattern.slice(colonIdx + 1);
    // Server wildcard — исключить из сравнений
    if (server === "*") return undefined;
    // Tool wildcard — argv длиной 1 (только server)
    if (tool === "*") return [server];
    return [server, tool];
  }

  // file section — split по "/", glob-токены сохраняются как литералы
  return pattern.split("/").filter((s) => s.length > 0);
}

/**
 * Проверяет, является ли `prefix` не-строгим префиксом `target`.
 * Не-строгий префикс: все токены prefix равны соответствующим токенам target,
 * и `prefix.length <= target.length`.
 */
function isPrefix(prefix: string[], target: string[]): boolean {
  if (prefix.length > target.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (prefix[i] !== target[i]) return false;
  }
  return true;
}

/**
 * Проверяет строгий префикс: не-строгий префикс И prefix.length < target.length.
 */
function isStrictPrefix(prefix: string[], target: string[]): boolean {
  return prefix.length < target.length && isPrefix(prefix, target);
}

function extractRule(rule: PermissionRule): [string, string] {
  const pattern = Object.keys(rule)[0];
  return [pattern, rule[pattern]];
}

function severityOf(decision: string, section: PreprocessingSection): number {
  if (section === "file") {
    if (decision === "write") return 0;
    if (decision === "read") return 1;
    if (decision === "deny") return 2;
    return -1;
  }
  // shell / mcp
  if (decision === "allow") return 0;
  if (decision === "ask") return 1;
  if (decision === "deny") return 2;
  return -1;
}

/**
 * Удаляет later-правила, shadowed earlier не-строгим префиксом.
 * First-match-wins semantics: earlier более общее правило перекрывает later более узкое.
 */
export function dropShadowedRules(rules: PermissionRule[], section: PreprocessingSection): PermissionRule[] {
  const result: PermissionRule[] = [];
  // Кэш argv параллельно с result, чтобы не пересчитывать
  const resultArgvs: Array<string[] | undefined> = [];

  for (let i = 0; i < rules.length; i++) {
    const [patternI] = extractRule(rules[i]);
    const argvI = argvOf(patternI, section);

    let shadowed = false;
    if (argvI !== undefined) {
      for (let j = 0; j < result.length; j++) {
        const argvJ = resultArgvs[j];
        if (argvJ === undefined) continue;
        if (isPrefix(argvJ, argvI)) {
          shadowed = true;
          const [patternJ] = extractRule(result[j]);
          process.stderr.write(
            `Warning: ${section} rule '${patternI}' is shadowed by earlier rule '${patternJ}' and never matches under first-match-wins semantics. Rule skipped.\n`,
          );
          break;
        }
      }
    }

    if (!shadowed) {
      result.push(rules[i]);
      resultArgvs.push(argvI);
    }
  }

  return result;
}

/**
 * Удаляет broader-later правила, перекрывающие narrower-earlier с более высокой severity.
 * Для движков most-restrictive-wins (Claude, Codex, Gemini), чтобы сохранить канонический
 * first-match-wins intent.
 *
 * Условие удаления R[j] (j > i):
 *   argv(R[j]) — строгий префикс argv(R[i]) И severity(R[j]) > severity(R[i]).
 */
export function flattenWhitelistConflicts(rules: PermissionRule[], section: PreprocessingSection): PermissionRule[] {
  // Предвычислить argv для каждого правила
  const argvs: Array<string[] | undefined> = rules.map((r) => {
    const [p] = extractRule(r);
    return argvOf(p, section);
  });

  const removed = new Set<number>();

  for (let i = 0; i < rules.length; i++) {
    if (removed.has(i)) continue;
    const argvI = argvs[i];
    if (argvI === undefined) continue;
    const [patternI, decisionI] = extractRule(rules[i]);
    const sevI = severityOf(decisionI, section);

    for (let j = i + 1; j < rules.length; j++) {
      if (removed.has(j)) continue;
      const argvJ = argvs[j];
      if (argvJ === undefined) continue;
      const [patternJ, decisionJ] = extractRule(rules[j]);
      const sevJ = severityOf(decisionJ, section);

      if (isStrictPrefix(argvJ, argvI) && sevJ > sevI) {
        removed.add(j);
        process.stderr.write(
          `Warning: ${section} rule '${patternJ}' → '${decisionJ}' would override narrower '${patternI}' → '${decisionI}' under most-restrictive-wins semantics. Broader rule skipped to preserve canonical first-match intent.\n`,
        );
      }
    }
  }

  return rules.filter((_, idx) => !removed.has(idx));
}
