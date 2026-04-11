// adapter-preprocessing.spec.ts
// Интеграционные тесты применения препроцессинга (dropShadowedRules,
// flattenWhitelistConflicts) в адаптерах Claude, OpenCode, Codex, Gemini,
// Kilocode. А также тесты новой ownership alwaysAllow в Kilocode adapter.
//
// Спецификация: docs/specs/permissions-transpiler.md § Общий препроцессинг
// правил, § Препроцессинг для decision-severity-wins движков, § Claude/
// OpenCode/Codex/Gemini/Kilocode Permissions-адаптер.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ClaudePermissionsAdapter } from "../adapters/claude-adapter.js";
import { CodexPermissionsAdapter } from "../adapters/codex-adapter.js";
import { OpenCodePermissionsAdapter } from "../adapters/opencode-adapter.js";
import { GeminiPermissionsAdapter } from "../adapters/gemini-adapter.js";
import { KilocodePermissionsAdapter } from "../adapters/kilocode-adapter.js";
import type { PermissionsCanonicalFile } from "../types.js";

function makeCanonicalFile(content: PermissionsCanonicalFile["content"]): PermissionsCanonicalFile {
  return { relativePath: ".agloom/permissions.yml", format: "yaml", content };
}

describe("Claude adapter preprocessing", () => {
  beforeEach(() => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Cl1: whitelist canonical → flattenWhitelistConflicts удаляет broader deny
  it("удаляет broader-later deny через flattenWhitelistConflicts (whitelist)", () => {
    const adapter = new ClaudePermissionsAdapter();
    const files = adapter.transpile(makeCanonicalFile({ shell: [{ "git status *": "allow" }, { "git *": "deny" }] }));
    const parsed = JSON.parse(files[0].content);
    expect(parsed.permissions.allow).toContain("Bash(git status *)");
    expect(parsed.permissions.deny ?? []).not.toContain("Bash(git *)");
  });

  // Cl2: shadowed canonical → dropShadowedRules удаляет more-specific later
  it("удаляет shadowed more-specific later rule через dropShadowedRules", () => {
    const adapter = new ClaudePermissionsAdapter();
    const files = adapter.transpile(makeCanonicalFile({ shell: [{ "git *": "allow" }, { "git status *": "deny" }] }));
    const parsed = JSON.parse(files[0].content);
    expect(parsed.permissions.allow).toContain("Bash(git *)");
    expect(parsed.permissions.deny ?? []).not.toContain("Bash(git status *)");
  });

  // Cl3: disjoint rules preservation (regression)
  it("сохраняет disjoint правила без изменений", () => {
    const adapter = new ClaudePermissionsAdapter();
    const files = adapter.transpile(
      makeCanonicalFile({
        shell: [{ "git status *": "allow" }, { "npm install *": "deny" }],
      }),
    );
    const parsed = JSON.parse(files[0].content);
    expect(parsed.permissions.allow).toContain("Bash(git status *)");
    expect(parsed.permissions.deny).toContain("Bash(npm install *)");
  });

  // Cl4: non-trailing wildcard передаётся as-is (не фильтруется)
  it("передаёт non-trailing wildcard паттерны as-is без фильтрации", () => {
    const adapter = new ClaudePermissionsAdapter();
    const files = adapter.transpile(makeCanonicalFile({ shell: [{ "* --version": "allow" }] }));
    const parsed = JSON.parse(files[0].content);
    expect(parsed.permissions.allow).toContain("Bash(* --version)");
  });

  // Cl5: препроцессинг применяется к mcp независимо от shell
  it("удаляет broader-later deny в mcp через flattenWhitelistConflicts", () => {
    const adapter = new ClaudePermissionsAdapter();
    const files = adapter.transpile(
      makeCanonicalFile({
        mcp: [{ "bitbucket:get_pull_request": "allow" }, { "bitbucket:*": "deny" }],
      }),
    );
    const parsed = JSON.parse(files[0].content);
    expect(parsed.permissions.allow).toContain("mcp__bitbucket__get_pull_request");
    expect(parsed.permissions.deny ?? []).not.toContain("mcp__bitbucket__*");
  });
});

describe("Codex adapter preprocessing", () => {
  beforeEach(() => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // C1: whitelist canonical → broader-later deny удалено препроцессингом
  it("удаляет broader-later deny через flattenWhitelistConflicts (whitelist)", () => {
    const adapter = new CodexPermissionsAdapter();
    const files = adapter.transpile(makeCanonicalFile({ shell: [{ "git status *": "allow" }, { "git *": "deny" }] }));
    const content = files[0].content;
    expect(content).toContain('pattern = ["git", "status"]');
    expect(content).toContain('decision = "allow"');
    // Broader deny rule must NOT be in output
    expect(content).not.toMatch(/pattern = \["git"\][^,]/);
  });

  // C2: shadowed canonical → more-specific later удалено
  it("удаляет shadowed more-specific later через dropShadowedRules", () => {
    const adapter = new CodexPermissionsAdapter();
    const files = adapter.transpile(makeCanonicalFile({ shell: [{ "git *": "allow" }, { "git status *": "deny" }] }));
    const content = files[0].content;
    expect(content).toContain('pattern = ["git"]');
    expect(content).not.toContain('pattern = ["git", "status"]');
  });

  // C3: disjoint preserved
  it("сохраняет disjoint правила", () => {
    const adapter = new CodexPermissionsAdapter();
    const files = adapter.transpile(
      makeCanonicalFile({
        shell: [{ "git status *": "allow" }, { "npm install *": "deny" }],
      }),
    );
    const content = files[0].content;
    expect(content).toContain('pattern = ["git", "status"]');
    expect(content).toContain('pattern = ["npm", "install"]');
  });
});

describe("OpenCode adapter preprocessing", () => {
  beforeEach(() => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // O1: shadowed → more-specific later removed, broader-earlier preserved
  it("удаляет shadowed more-specific later через dropShadowedRules", () => {
    const adapter = new OpenCodePermissionsAdapter();
    const files = adapter.transpile(makeCanonicalFile({ shell: [{ "git *": "allow" }, { "git status *": "deny" }] }));
    const parsed = JSON.parse(files[0].content);
    const bash = parsed.permission.bash ?? {};
    expect(bash["git *"]).toBe("allow");
    expect(bash["git status *"]).toBeUndefined();
  });

  // O2: whitelist canonical → flattenWhitelistConflicts НЕ применяется
  // Оба правила присутствуют (после reverse) — last-match-wins эквивалент
  it("НЕ применяет flattenWhitelistConflicts (оба правила в output, whitelist)", () => {
    const adapter = new OpenCodePermissionsAdapter();
    const files = adapter.transpile(makeCanonicalFile({ shell: [{ "git status *": "allow" }, { "git *": "deny" }] }));
    const parsed = JSON.parse(files[0].content);
    const bash = parsed.permission.bash ?? {};
    expect(bash["git status *"]).toBe("allow");
    expect(bash["git *"]).toBe("deny");
  });
});

describe("Kilocode adapter preprocessing + alwaysAllow", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // K1: target file
  it("генерирует kilo.jsonc", () => {
    const adapter = new KilocodePermissionsAdapter();
    const files = adapter.transpile(makeCanonicalFile({ shell: [{ "ls *": "allow" }] }));
    expect(files[0].relativePath).toBe("kilo.jsonc");
  });

  // K2: dropShadowedRules применяется
  it("удаляет shadowed more-specific later правило через dropShadowedRules", () => {
    const adapter = new KilocodePermissionsAdapter();
    const files = adapter.transpile(makeCanonicalFile({ shell: [{ "git *": "allow" }, { "git status *": "deny" }] }));
    const parsed = JSON.parse(files[0].content);
    expect(parsed.permission.bash["git *"]).toBe("allow");
    expect(parsed.permission.bash["git status *"]).toBeUndefined();
  });

  // K3: canonical allow с concrete tool → mcpServers.<server>.alwaysAllow
  it("эмитирует mcpServers.<server>.alwaysAllow для canonical allow с concrete tool", () => {
    const adapter = new KilocodePermissionsAdapter();
    const files = adapter.transpile(makeCanonicalFile({ mcp: [{ "bitbucket:get_pull_request": "allow" }] }));
    const parsed = JSON.parse(files[0].content);
    expect(parsed.mcpServers).toBeDefined();
    expect(parsed.mcpServers.bitbucket).toBeDefined();
    expect(parsed.mcpServers.bitbucket.alwaysAllow).toEqual(["get_pull_request"]);
  });

  // K4: bulk-allow <server>:* → warning + skip (alwaysAllow not populated)
  it("эмитирует warning для <server>:* allow и НЕ добавляет в alwaysAllow", () => {
    const adapter = new KilocodePermissionsAdapter();
    const files = adapter.transpile(makeCanonicalFile({ mcp: [{ "bitbucket:*": "allow" }] }));
    const parsed = JSON.parse(files[0].content);
    // mcpServers либо отсутствует, либо bitbucket.alwaysAllow не создан
    if (parsed.mcpServers?.bitbucket?.alwaysAllow) {
      expect(parsed.mcpServers.bitbucket.alwaysAllow).not.toContain("*");
    }
    const calls = stderrSpy.mock.calls.map((c) => String(c[0])).join("");
    expect(calls).toMatch(/Kilocode .*alwaysAllow.*concrete tool/i);
    expect(calls).toContain("bitbucket:*");
    // Flat-ключ "bitbucket_*" всё ещё эмитируется
    expect(parsed.permission["bitbucket_*"]).toBe("allow");
  });

  // K5: deny-правило → flat-ключ "deny", НЕ в alwaysAllow
  it("эмитирует deny mcp-правило как flat-ключ permission.<server>_<tool>=deny", () => {
    const adapter = new KilocodePermissionsAdapter();
    const files = adapter.transpile(makeCanonicalFile({ mcp: [{ "bitbucket:get_pull_request": "deny" }] }));
    const parsed = JSON.parse(files[0].content);
    expect(parsed.permission["bitbucket_get_pull_request"]).toBe("deny");
    // alwaysAllow не содержит этот tool
    expect(parsed.mcpServers?.bitbucket?.alwaysAllow ?? []).not.toContain("get_pull_request");
  });

  // K6: ask-правило → flat-ключ "ask"
  it("эмитирует ask mcp-правило как flat-ключ permission.<server>_<tool>=ask", () => {
    const adapter = new KilocodePermissionsAdapter();
    const files = adapter.transpile(makeCanonicalFile({ mcp: [{ "bitbucket:create_pr": "ask" }] }));
    const parsed = JSON.parse(files[0].content);
    expect(parsed.permission["bitbucket_create_pr"]).toBe("ask");
    expect(parsed.mcpServers?.bitbucket?.alwaysAllow ?? []).not.toContain("create_pr");
  });

  // K7: несколько allow-правил для одного сервера → массив с несколькими tools
  it("собирает несколько concrete-tool allow-правил одного сервера в один alwaysAllow массив", () => {
    const adapter = new KilocodePermissionsAdapter();
    const files = adapter.transpile(
      makeCanonicalFile({
        mcp: [{ "bitbucket:get_pull_request": "allow" }, { "bitbucket:list_branches": "allow" }],
      }),
    );
    const parsed = JSON.parse(files[0].content);
    expect(parsed.mcpServers.bitbucket.alwaysAllow).toEqual(
      expect.arrayContaining(["get_pull_request", "list_branches"]),
    );
    expect(parsed.mcpServers.bitbucket.alwaysAllow).toHaveLength(2);
  });

  // K8: unit-тест shape, совместимого с deep-merge MCP-транспилера.
  // Проверяет, что Permissions-адаптер эмитирует mcpServers.<server>.alwaysAllow
  // в форме, которая после deep-merge layer model корректно объединяется
  // с mcpServers.<server> блоком, записанным MCP-транспилером (command/args/url/...).
  // End-to-end проверка deep-merge координации делегируется cli-level
  // integration test и не входит в scope данного юнит-теста адаптера
  // (см. docs/specs/permissions-transpiler.md § Координация с MCP-
  // транспилером Kilocode).
  it("эмитирует mcpServers shape, совместимый с deep-merge MCP-транспилера (пример из спеки)", () => {
    const adapter = new KilocodePermissionsAdapter();
    const files = adapter.transpile(
      makeCanonicalFile({
        mcp: [
          { "untrusted-server:*": "deny" },
          { "bitbucket:get_pull_request": "allow" },
          { "jenkins:get_build": "allow" },
          { "bitbucket:*": "ask" },
          { "jenkins:*": "ask" },
          { "*:*": "deny" },
        ],
      }),
    );
    const parsed = JSON.parse(files[0].content);
    expect(parsed.mcpServers.bitbucket.alwaysAllow).toEqual(["get_pull_request"]);
    expect(parsed.mcpServers.jenkins.alwaysAllow).toEqual(["get_build"]);
  });
});

describe("Gemini adapter preprocessing", () => {
  beforeEach(() => {
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // G2: dropShadowedRules применяется; priority нумерация сдвигается
  it("удаляет shadowed more-specific later rule и приоритет 999 назначается первому", () => {
    const adapter = new GeminiPermissionsAdapter();
    const files = adapter.transpile(makeCanonicalFile({ shell: [{ "git *": "allow" }, { "git status *": "deny" }] }));
    const content = files[0].content;
    expect(content).toContain('commandPrefix = "git"');
    expect(content).toContain("priority = 999");
    // git status rule should not be in output
    expect(content).not.toContain('commandPrefix = "git status"');
  });
});
