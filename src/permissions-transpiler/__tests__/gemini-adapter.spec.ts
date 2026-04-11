// gemini-adapter.spec.ts
// Спецификация: docs/specs/permissions-transpiler.md § Gemini Permissions-адаптер

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as TOML from "smol-toml";
import { GeminiPermissionsAdapter } from "../adapters/gemini-adapter.js";
import { TransformError } from "../errors.js";
import type { PermissionsCanonicalFile } from "../types.js";

function makeCanonicalFile(content: PermissionsCanonicalFile["content"]): PermissionsCanonicalFile {
  return {
    relativePath: ".agloom/permissions.yml",
    format: "yaml",
    content,
  };
}

interface GeminiRule {
  toolName?: string;
  commandPrefix?: string;
  commandRegex?: string;
  mcpName?: string;
  decision: string;
  priority: number;
}

function parseRules(content: string): GeminiRule[] {
  const parsed = TOML.parse(content) as { rule?: GeminiRule[] };
  return parsed.rule ?? [];
}

describe("GeminiPermissionsAdapter", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- Свойство: agentId ---
  it('имеет agentId равный "gemini"', () => {
    const adapter = new GeminiPermissionsAdapter();
    expect(adapter.agentId).toBe("gemini");
  });

  describe("transpile", () => {
    // --- Happy path: шаг 9 -- relativePath ---
    it("генерирует файл .gemini/policies/agloom.toml", () => {
      const adapter = new GeminiPermissionsAdapter();
      const files = adapter.transpile(makeCanonicalFile({ shell: [{ "git push *": "deny" }] }));
      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe(".gemini/policies/agloom.toml");
    });

    // --- Трансформация shell: трейлинг wildcard -> commandPrefix ---
    it('преобразует "git push *" в commandPrefix = "git push"', () => {
      const adapter = new GeminiPermissionsAdapter();
      const files = adapter.transpile(makeCanonicalFile({ shell: [{ "git push *": "allow" }] }));
      const rules = parseRules(files[0].content);
      expect(rules).toHaveLength(1);
      expect(rules[0].toolName).toBe("run_shell_command");
      expect(rules[0].commandPrefix).toBe("git push");
      expect(rules[0].commandRegex).toBeUndefined();
    });

    // --- Трансформация shell: без wildcard -> commandPrefix ---
    it('преобразует "git status" (без wildcard) в commandPrefix = "git status"', () => {
      const adapter = new GeminiPermissionsAdapter();
      const files = adapter.transpile(makeCanonicalFile({ shell: [{ "git status": "allow" }] }));
      const rules = parseRules(files[0].content);
      expect(rules[0].commandPrefix).toBe("git status");
    });

    // --- Трансформация shell: bare wildcard -> без commandPrefix/commandRegex ---
    it("преобразует bare wildcard '*' в правило без commandPrefix и commandRegex", () => {
      const adapter = new GeminiPermissionsAdapter();
      const files = adapter.transpile(makeCanonicalFile({ shell: [{ "*": "deny" }] }));
      const rules = parseRules(files[0].content);
      expect(rules).toHaveLength(1);
      expect(rules[0].toolName).toBe("run_shell_command");
      expect(rules[0].commandPrefix).toBeUndefined();
      expect(rules[0].commandRegex).toBeUndefined();
    });

    // --- Трансформация shell: leading wildcard -> commandRegex ---
    it('преобразует "* --version" в commandRegex = "^.+ --version$"', () => {
      const adapter = new GeminiPermissionsAdapter();
      const files = adapter.transpile(makeCanonicalFile({ shell: [{ "* --version": "allow" }] }));
      const rules = parseRules(files[0].content);
      expect(rules[0].commandRegex).toBe("^.+ --version$");
      expect(rules[0].commandPrefix).toBeUndefined();
    });

    // --- Трансформация shell: middle wildcard -> commandRegex ---
    it('преобразует "git * --version" в commandRegex = "^git .+ --version$"', () => {
      const adapter = new GeminiPermissionsAdapter();
      const files = adapter.transpile(makeCanonicalFile({ shell: [{ "git * --version": "allow" }] }));
      const rules = parseRules(files[0].content);
      expect(rules[0].commandRegex).toBe("^git .+ --version$");
    });

    // --- Маппинг действий: allow -> "allow" ---
    it('маппит allow в decision = "allow"', () => {
      const adapter = new GeminiPermissionsAdapter();
      const files = adapter.transpile(makeCanonicalFile({ shell: [{ "ls *": "allow" }] }));
      const rules = parseRules(files[0].content);
      expect(rules[0].decision).toBe("allow");
    });

    // --- Маппинг действий: ask -> "ask_user" ---
    it('маппит ask в decision = "ask_user"', () => {
      const adapter = new GeminiPermissionsAdapter();
      const files = adapter.transpile(makeCanonicalFile({ shell: [{ "npm *": "ask" }] }));
      const rules = parseRules(files[0].content);
      expect(rules[0].decision).toBe("ask_user");
    });

    // --- Маппинг действий: deny -> "deny" ---
    it('маппит deny в decision = "deny"', () => {
      const adapter = new GeminiPermissionsAdapter();
      const files = adapter.transpile(makeCanonicalFile({ shell: [{ "rm *": "deny" }] }));
      const rules = parseRules(files[0].content);
      expect(rules[0].decision).toBe("deny");
    });

    // --- Priority: шаг 6 -- первое правило получает priority = 999 ---
    it("первое правило получает priority = 999", () => {
      const adapter = new GeminiPermissionsAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          shell: [{ "git push *": "deny" }, { "./gradlew *": "allow" }, { "ls *": "allow" }],
        }),
      );
      const rules = parseRules(files[0].content);
      expect(rules[0].priority).toBe(999);
      expect(rules[1].priority).toBe(998);
      expect(rules[2].priority).toBe(997);
    });

    // --- Priority: граничное N -- последнее правило получает 999 - N + 1 ---
    it("последнее правило получает priority = 999 - N + 1", () => {
      const adapter = new GeminiPermissionsAdapter();
      const shell = Array.from({ length: 5 }, (_, i) => ({ [`cmd${i} *`]: "allow" }));
      const files = adapter.transpile(makeCanonicalFile({ shell }));
      const rules = parseRules(files[0].content);
      expect(rules).toHaveLength(5);
      expect(rules[4].priority).toBe(995); // 999 - 5 + 1
    });

    // --- Priority overflow: N > 1000 -- TransformError, расширение 5a ---
    it("выбрасывает TransformError при более чем 1000 правил", () => {
      const adapter = new GeminiPermissionsAdapter();
      const shell = Array.from({ length: 1001 }, (_, i) => ({ [`cmd${i} *`]: "allow" }));
      expect(() => adapter.transpile(makeCanonicalFile({ shell }))).toThrow(TransformError);
      expect(() => adapter.transpile(makeCanonicalFile({ shell }))).toThrow(
        /Gemini policy engine supports at most 1000 rules/,
      );
    });

    // --- Priority boundary: ровно 1000 правил -- не ошибка ---
    it("не выбрасывает ошибку при ровно 1000 правил (priorities 999..0)", () => {
      const adapter = new GeminiPermissionsAdapter();
      const shell = Array.from({ length: 1000 }, (_, i) => ({ [`cmd${i} *`]: "allow" }));
      expect(() => adapter.transpile(makeCanonicalFile({ shell }))).not.toThrow();
    });

    // --- MCP: exact pattern -> mcpName + toolName ---
    it('преобразует "bitbucket:get_pull_request" в mcpName + toolName', () => {
      const adapter = new GeminiPermissionsAdapter();
      const files = adapter.transpile(makeCanonicalFile({ mcp: [{ "bitbucket:get_pull_request": "allow" }] }));
      const rules = parseRules(files[0].content);
      expect(rules).toHaveLength(1);
      expect(rules[0].mcpName).toBe("bitbucket");
      expect(rules[0].toolName).toBe("get_pull_request");
    });

    // --- MCP: server wildcard -> только mcpName ---
    it('преобразует "bitbucket:*" в только mcpName (без toolName)', () => {
      const adapter = new GeminiPermissionsAdapter();
      const files = adapter.transpile(makeCanonicalFile({ mcp: [{ "bitbucket:*": "ask" }] }));
      const rules = parseRules(files[0].content);
      expect(rules).toHaveLength(1);
      expect(rules[0].mcpName).toBe("bitbucket");
      expect(rules[0].toolName).toBeUndefined();
    });

    // --- MCP: catch-all *:* -> skip с предупреждением ---
    it("пропускает паттерн '*:*' с предупреждением и не эмитирует правило", () => {
      const adapter = new GeminiPermissionsAdapter();
      const files = adapter.transpile(makeCanonicalFile({ mcp: [{ "*:*": "deny" }] }));
      const rules = parseRules(files[0].content);
      expect(rules).toHaveLength(0);
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining("Warning: Gemini does not support catch-all MCP pattern '*:*'"),
      );
    });

    // --- File: секция игнорируется с предупреждением ---
    it("игнорирует file секцию с предупреждением", () => {
      const adapter = new GeminiPermissionsAdapter();
      const files = adapter.transpile(makeCanonicalFile({ file: [{ "**/.env": "deny" }] }));
      const rules = parseRules(files[0].content);
      expect(rules).toHaveLength(0);
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining("Warning: Gemini policy engine does not support file permissions"),
      );
    });

    // --- Формат: валидный TOML, завершающий перевод строки ---
    it("генерирует валидный TOML с завершающим переводом строки", () => {
      const adapter = new GeminiPermissionsAdapter();
      const files = adapter.transpile(makeCanonicalFile({ shell: [{ "ls *": "allow" }] }));
      expect(files[0].content).toMatch(/\n$/);
      // Парсится без ошибок
      expect(() => TOML.parse(files[0].content)).not.toThrow();
    });

    // --- Порядок эмиссии: shell раньше mcp, оба в каноническом порядке ---
    it("эмитирует shell-правила раньше mcp-правил в каноническом порядке", () => {
      const adapter = new GeminiPermissionsAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          shell: [{ "git push *": "deny" }, { "./gradlew *": "allow" }],
          mcp: [{ "bitbucket:get_pull_request": "allow" }],
        }),
      );
      const rules = parseRules(files[0].content);
      expect(rules).toHaveLength(3);
      expect(rules[0].commandPrefix).toBe("git push");
      expect(rules[0].priority).toBe(999);
      expect(rules[1].commandPrefix).toBe("./gradlew");
      expect(rules[1].priority).toBe(998);
      expect(rules[2].mcpName).toBe("bitbucket");
      expect(rules[2].priority).toBe(997);
    });

    // --- Граничное: пустой input -- валидный пустой TOML ---
    it("генерирует валидный пустой TOML при пустом каноническом файле", () => {
      const adapter = new GeminiPermissionsAdapter();
      const files = adapter.transpile(makeCanonicalFile({}));
      expect(files).toHaveLength(1);
      expect(() => TOML.parse(files[0].content)).not.toThrow();
      const rules = parseRules(files[0].content);
      expect(rules).toHaveLength(0);
    });
  });
});
