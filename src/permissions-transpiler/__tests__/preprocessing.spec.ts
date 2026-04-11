// preprocessing.spec.ts
// Спецификация: docs/specs/permissions-transpiler.md § Общий препроцессинг правил
// и § Препроцессинг для decision-severity-wins движков
//
// Failing-тесты для процедур dropShadowedRules и flattenWhitelistConflicts.
// На момент написания этих тестов модуль preprocessing.ts ещё не существует —
// implementer должен создать его в src/permissions-transpiler/preprocessing.ts
// (или в другом общем модуле и экспортировать оба helper'а).

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
// @ts-expect-error — module will be created by implementer
import { dropShadowedRules, flattenWhitelistConflicts } from "../preprocessing.js";
import type { PermissionRule } from "../types.js";

describe("dropShadowedRules", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // D1
  it("возвращает пустой массив при пустом входе", () => {
    expect(dropShadowedRules([], "shell")).toEqual([]);
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  // D2
  it("оставляет одно shell-правило нетронутым", () => {
    const rules: PermissionRule[] = [{ "git status *": "allow" }];
    expect(dropShadowedRules(rules, "shell")).toEqual(rules);
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  // D3
  it("не удаляет disjoint shell-правила", () => {
    const rules: PermissionRule[] = [{ "git status *": "allow" }, { "npm install *": "allow" }];
    expect(dropShadowedRules(rules, "shell")).toEqual(rules);
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  // D4 — earlier is prefix of later
  it("удаляет later-правило, когда earlier является префиксом (git → allow shadowes git status → deny)", () => {
    const rules: PermissionRule[] = [{ "git *": "allow" }, { "git status *": "deny" }];
    const result = dropShadowedRules(rules, "shell");
    expect(result).toEqual([{ "git *": "allow" }]);
    // D10 warning format
    const calls = stderrSpy.mock.calls.map((c) => String(c[0])).join("");
    expect(calls).toContain("git status *");
    expect(calls).toContain("git *");
    expect(calls).toContain("shadowed");
    expect(calls).toContain("skipped");
  });

  // D5 — equal patterns, later shadowed
  it("удаляет later-правило при равенстве паттернов (нестрогий префикс)", () => {
    const rules: PermissionRule[] = [{ "git status *": "allow" }, { "git status *": "deny" }];
    const result = dropShadowedRules(rules, "shell");
    expect(result).toEqual([{ "git status *": "allow" }]);
    expect(stderrSpy).toHaveBeenCalled();
  });

  // D6 — later is strict prefix of earlier, neither shadowed
  it("НЕ удаляет later-правило, когда earlier более специфично", () => {
    const rules: PermissionRule[] = [{ "git status *": "allow" }, { "git *": "deny" }];
    const result = dropShadowedRules(rules, "shell");
    expect(result).toEqual(rules);
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  // D7 — chain shadowing
  it("удаляет все правила, shadowed цепочкой (git → git status → git status --version)", () => {
    const rules: PermissionRule[] = [
      { "git *": "allow" },
      { "git status *": "deny" },
      { "git status --version": "ask" },
    ];
    const result = dropShadowedRules(rules, "shell");
    expect(result).toEqual([{ "git *": "allow" }]);
    // Оба shadowed — два warning
    expect(stderrSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  // D8 — non-trailing wildcard не участвует в сравнении
  it("не анализирует non-trailing wildcard паттерны (bare/leading/middle)", () => {
    const rules: PermissionRule[] = [{ "* --version": "allow" }, { "git status --version": "deny" }, { "*": "ask" }];
    // Ни один из argv не определён для wildcards → не сравнивается.
    // git status --version тоже не префикс никого предыдущего → остаётся.
    const result = dropShadowedRules(rules, "shell");
    expect(result).toEqual(rules);
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  // D9 — mcp shadowing
  it("удаляет mcp-правило, shadowed wildcard <server>:*", () => {
    const rules: PermissionRule[] = [{ "bitbucket:*": "deny" }, { "bitbucket:get_pull_request": "allow" }];
    const result = dropShadowedRules(rules, "mcp");
    expect(result).toEqual([{ "bitbucket:*": "deny" }]);
    const calls = stderrSpy.mock.calls.map((c) => String(c[0])).join("");
    expect(calls).toContain("mcp");
    expect(calls).toContain("bitbucket:get_pull_request");
  });

  // D10 — warning format matches spec verbatim
  it("эмитирует warning со spec-форматом сообщения", () => {
    const rules: PermissionRule[] = [{ "git *": "allow" }, { "git status *": "deny" }];
    dropShadowedRules(rules, "shell");
    const calls = stderrSpy.mock.calls.map((c) => String(c[0])).join("");
    expect(calls).toContain(
      "Warning: shell rule 'git status *' is shadowed by earlier rule 'git *' and never matches under first-match-wins semantics. Rule skipped.",
    );
  });

  // D11 — file section: disjoint file-правила → оба остаются.
  // Spec: § Argv-представление паттернов — file argv = split(pattern, "/").
  it("не удаляет disjoint file-правила (file section)", () => {
    const rules: PermissionRule[] = [{ "src/**": "read" }, { "test/**": "read" }];
    expect(dropShadowedRules(rules, "file")).toEqual(rules);
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  // D12 — file section: broader-earlier shadowes narrower-later.
  // argv("src/**") = ["src", "**"] — нестрогий префикс для
  // argv("src/**/*.ts") = ["src", "**", "*.ts"] → второе shadowed.
  it("удаляет narrower-later file-правило, когда earlier является префиксом по '/' (file section)", () => {
    const rules: PermissionRule[] = [{ "src/**": "read" }, { "src/**/*.ts": "write" }];
    const result = dropShadowedRules(rules, "file");
    expect(result).toEqual([{ "src/**": "read" }]);
    const calls = stderrSpy.mock.calls.map((c) => String(c[0])).join("");
    expect(calls).toContain("file");
    expect(calls).toContain("src/**/*.ts");
    expect(calls).toContain("src/**");
    expect(calls).toContain("shadowed");
  });

  // D13 — file section: later более широкий префикс → ни одно НЕ shadowed.
  it("НЕ удаляет later file-правило, когда earlier более специфично (file section)", () => {
    const rules: PermissionRule[] = [{ "src/**/*.ts": "read" }, { "src/**": "deny" }];
    const result = dropShadowedRules(rules, "file");
    expect(result).toEqual(rules);
    expect(stderrSpy).not.toHaveBeenCalled();
  });
});

describe("flattenWhitelistConflicts", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // F1
  it("возвращает пустой массив при пустом входе", () => {
    expect(flattenWhitelistConflicts([], "shell")).toEqual([]);
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  // F2
  it("не удаляет disjoint правила", () => {
    const rules: PermissionRule[] = [{ "git status *": "allow" }, { "npm install *": "deny" }];
    expect(flattenWhitelistConflicts(rules, "shell")).toEqual(rules);
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  // F3 — narrower-earlier allow + broader-later deny → broader удалено
  it("удаляет broader-later deny, перекрывающее narrower-earlier allow", () => {
    const rules: PermissionRule[] = [{ "git status *": "allow" }, { "git *": "deny" }];
    const result = flattenWhitelistConflicts(rules, "shell");
    expect(result).toEqual([{ "git status *": "allow" }]);
    const calls = stderrSpy.mock.calls.map((c) => String(c[0])).join("");
    expect(calls).toContain("git *");
    expect(calls).toContain("git status *");
    expect(calls).toContain("deny");
    expect(calls).toContain("allow");
  });

  // F4 — narrower-earlier deny + broader-later allow → ничего не удаляется
  it("НЕ удаляет broader-later allow при narrower-earlier deny (severity ниже)", () => {
    const rules: PermissionRule[] = [{ "git status *": "deny" }, { "git *": "allow" }];
    const result = flattenWhitelistConflicts(rules, "shell");
    expect(result).toEqual(rules);
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  // F5 — equal severity: ничего не удаляется
  it("НЕ удаляет broader-later с равной severity (allow+allow)", () => {
    const rules: PermissionRule[] = [{ "git status *": "allow" }, { "git *": "allow" }];
    const result = flattenWhitelistConflicts(rules, "shell");
    expect(result).toEqual(rules);
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  // F6 — ask + deny: deny строже
  it("удаляет broader-later deny, перекрывающее narrower-earlier ask", () => {
    const rules: PermissionRule[] = [{ "git status *": "ask" }, { "git *": "deny" }];
    const result = flattenWhitelistConflicts(rules, "shell");
    expect(result).toEqual([{ "git status *": "ask" }]);
    expect(stderrSpy).toHaveBeenCalled();
  });

  // F7 — deny + deny: ничего не удаляется
  it("НЕ удаляет broader-later deny при narrower-earlier deny (равная severity)", () => {
    const rules: PermissionRule[] = [{ "git status *": "deny" }, { "git *": "deny" }];
    const result = flattenWhitelistConflicts(rules, "shell");
    expect(result).toEqual(rules);
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  // F8 — chain conflict
  it("удаляет самое широкое правило, перекрывающее оба более узких", () => {
    const rules: PermissionRule[] = [{ "git status *": "allow" }, { "git add *": "ask" }, { "git *": "deny" }];
    const result = flattenWhitelistConflicts(rules, "shell");
    expect(result).toEqual([{ "git status *": "allow" }, { "git add *": "ask" }]);
    expect(stderrSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  // F9 — mcp conflict
  it("удаляет broader-later mcp deny, перекрывающее narrower allow", () => {
    const rules: PermissionRule[] = [{ "bitbucket:get_pull_request": "allow" }, { "bitbucket:*": "deny" }];
    const result = flattenWhitelistConflicts(rules, "mcp");
    expect(result).toEqual([{ "bitbucket:get_pull_request": "allow" }]);
    expect(stderrSpy).toHaveBeenCalled();
  });

  // F10 — warning format verbatim
  it("эмитирует warning со spec-форматом сообщения", () => {
    const rules: PermissionRule[] = [{ "git status *": "allow" }, { "git *": "deny" }];
    flattenWhitelistConflicts(rules, "shell");
    const calls = stderrSpy.mock.calls.map((c) => String(c[0])).join("");
    expect(calls).toContain(
      "Warning: shell rule 'git *' → 'deny' would override narrower 'git status *' → 'allow' under most-restrictive-wins semantics. Broader rule skipped to preserve canonical first-match intent.",
    );
  });

  // F11 — file section: narrower-earlier read + broader-later deny.
  // file severity map: write=0, read=1, deny=2.
  // argv("src/**/*.ts") = ["src", "**", "*.ts"],
  // argv("src/**") = ["src", "**"] — строгий префикс, deny > read → удалить broader.
  it("удаляет broader-later deny, перекрывающее narrower-earlier read (file section)", () => {
    const rules: PermissionRule[] = [{ "src/**/*.ts": "read" }, { "src/**": "deny" }];
    const result = flattenWhitelistConflicts(rules, "file");
    expect(result).toEqual([{ "src/**/*.ts": "read" }]);
    expect(stderrSpy).toHaveBeenCalled();
  });

  // F12 — file section: narrower-earlier deny + broader-later read.
  // later (read=1) имеет меньшую severity, чем earlier (deny=2) →
  // не override. Ни одно не удаляется.
  it("НЕ удаляет broader-later read при narrower-earlier deny (file section)", () => {
    const rules: PermissionRule[] = [{ "src/**/*.ts": "deny" }, { "src/**": "read" }];
    const result = flattenWhitelistConflicts(rules, "file");
    expect(result).toEqual(rules);
    expect(stderrSpy).not.toHaveBeenCalled();
  });
});
