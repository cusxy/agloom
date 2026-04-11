// codex-adapter.spec.ts
// Спецификация: docs/specs/permissions-transpiler.md § Codex Permissions-адаптер

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CodexPermissionsAdapter } from "../adapters/codex-adapter.js";
import type { PermissionsCanonicalFile } from "../types.js";

function makeCanonicalFile(content: PermissionsCanonicalFile["content"]): PermissionsCanonicalFile {
  return {
    relativePath: ".agloom/permissions.yml",
    format: "yaml",
    content,
  };
}

describe("CodexPermissionsAdapter", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- Свойство: agentId ---
  it('имеет agentId равный "codex"', () => {
    const adapter = new CodexPermissionsAdapter();
    expect(adapter.agentId).toBe("codex");
  });

  describe("transpile", () => {
    // --- Happy path: шаг 7 -- relativePath = .codex/rules/agloom.rules ---
    it("генерирует файл .codex/rules/agloom.rules", () => {
      const adapter = new CodexPermissionsAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          shell: [{ "git push *": "deny" }],
        }),
      );
      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe(".codex/rules/agloom.rules");
    });

    // --- Трансформация: шаг 4.1, правило 1 -- trailing wildcard с несколькими токенами ---
    it('преобразует паттерн с трейлинг-wildcard и несколькими токенами в pattern = ["git", "push"]', () => {
      const adapter = new CodexPermissionsAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          shell: [{ "git push *": "allow" }],
        }),
      );
      expect(files[0].content).toContain('pattern = ["git", "push"]');
      expect(files[0].content).toContain('decision = "allow"');
    });

    // --- Трансформация: шаг 4.1, правило 1 -- trailing wildcard с одним токеном ---
    it('преобразует "./gradlew *" в pattern = ["./gradlew"]', () => {
      const adapter = new CodexPermissionsAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          shell: [{ "./gradlew *": "allow" }],
        }),
      );
      expect(files[0].content).toContain('pattern = ["./gradlew"]');
    });

    // --- Трансформация: шаг 4.1, правило 2 -- команда без wildcard ---
    it('преобразует "git status" (без wildcard) в pattern = ["git", "status"]', () => {
      const adapter = new CodexPermissionsAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          shell: [{ "git status": "allow" }],
        }),
      );
      expect(files[0].content).toContain('pattern = ["git", "status"]');
    });

    // --- Маппинг действий: allow -> "allow" ---
    it('маппит allow в decision = "allow"', () => {
      const adapter = new CodexPermissionsAdapter();
      const files = adapter.transpile(makeCanonicalFile({ shell: [{ "ls *": "allow" }] }));
      expect(files[0].content).toContain('decision = "allow"');
    });

    // --- Маппинг действий: ask -> "prompt" ---
    it('маппит ask в decision = "prompt"', () => {
      const adapter = new CodexPermissionsAdapter();
      const files = adapter.transpile(makeCanonicalFile({ shell: [{ "npm *": "ask" }] }));
      expect(files[0].content).toContain('decision = "prompt"');
    });

    // --- Маппинг действий: deny -> "forbidden" ---
    it('маппит deny в decision = "forbidden"', () => {
      const adapter = new CodexPermissionsAdapter();
      const files = adapter.transpile(makeCanonicalFile({ shell: [{ "rm *": "deny" }] }));
      expect(files[0].content).toContain('decision = "forbidden"');
    });

    // --- Трансформация: шаг 4.1, правило 3 -- bare wildcard skip ---
    it("пропускает bare wildcard '*' с предупреждением в stderr", () => {
      const adapter = new CodexPermissionsAdapter();
      const files = adapter.transpile(makeCanonicalFile({ shell: [{ "*": "deny" }] }));
      expect(files[0].content).not.toContain("prefix_rule");
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining("Warning: Codex does not support shell pattern '*'"),
      );
    });

    // --- Трансформация: шаг 4.1, правило 4 -- leading wildcard skip ---
    it("пропускает leading wildcard '* --version' с предупреждением", () => {
      const adapter = new CodexPermissionsAdapter();
      const files = adapter.transpile(makeCanonicalFile({ shell: [{ "* --version": "allow" }] }));
      expect(files[0].content).not.toContain("prefix_rule");
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining("Warning: Codex does not support shell pattern '* --version'"),
      );
    });

    // --- Трансформация: шаг 4.1, правило 5 -- middle wildcard skip ---
    it("пропускает middle wildcard 'git * --version' с предупреждением", () => {
      const adapter = new CodexPermissionsAdapter();
      const files = adapter.transpile(makeCanonicalFile({ shell: [{ "git * --version": "allow" }] }));
      expect(files[0].content).not.toContain("prefix_rule");
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining("Warning: Codex does not support shell pattern 'git * --version'"),
      );
    });

    // --- Поведение: шаг 2 -- mcp секция игнорируется с предупреждением ---
    it("игнорирует mcp секцию целиком с предупреждением (ссылка на config.toml)", () => {
      const adapter = new CodexPermissionsAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          mcp: [{ "bitbucket:get_pull_request": "allow" }],
        }),
      );
      expect(files[0].content).not.toContain("bitbucket");
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Warning: Codex does not support per-tool MCP gating in rules file. 'mcp' section ignored.",
        ),
      );
    });

    // --- Поведение: шаг 3 -- file секция игнорируется с предупреждением ---
    it("игнорирует file секцию целиком с предупреждением", () => {
      const adapter = new CodexPermissionsAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          file: [{ "**/.env": "deny" }],
        }),
      );
      expect(files[0].content).not.toContain(".env");
      expect(stderrSpy).toHaveBeenCalledWith(
        expect.stringContaining("Warning: Codex does not support file permissions. 'file' section ignored."),
      );
    });

    // --- Формат: шаг 5 -- пустая строка между правилами ---
    it("вставляет пустую строку между соседними prefix_rule вызовами", () => {
      const adapter = new CodexPermissionsAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          shell: [{ "git push *": "deny" }, { "./gradlew *": "allow" }],
        }),
      );
      // Два prefix_rule вызова + пустая строка между ними
      const matches = files[0].content.match(/prefix_rule/g) ?? [];
      expect(matches).toHaveLength(2);
      // Между ), и prefix_rule должна быть пустая строка (\n\n)
      expect(files[0].content).toMatch(/\)\n\nprefix_rule/);
    });

    // --- Порядок: шаг 4 -- правила сохраняют канонический порядок ---
    it("сохраняет порядок правил из канонического массива", () => {
      const adapter = new CodexPermissionsAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          shell: [{ "git push *": "deny" }, { "./gradlew *": "allow" }, { "ls *": "allow" }],
        }),
      );
      const idxGit = files[0].content.indexOf('["git", "push"]');
      const idxGradle = files[0].content.indexOf('["./gradlew"]');
      const idxLs = files[0].content.indexOf('["ls"]');
      expect(idxGit).toBeGreaterThanOrEqual(0);
      expect(idxGradle).toBeGreaterThan(idxGit);
      expect(idxLs).toBeGreaterThan(idxGradle);
    });

    // --- Формат: файл заканчивается переводом строки ---
    it("завершает файл переводом строки", () => {
      const adapter = new CodexPermissionsAdapter();
      const files = adapter.transpile(makeCanonicalFile({ shell: [{ "ls *": "allow" }] }));
      expect(files[0].content).toMatch(/\n$/);
    });

    // --- Формат: структура prefix_rule вызова ---
    it("генерирует prefix_rule в многострочном формате с отступом", () => {
      const adapter = new CodexPermissionsAdapter();
      const files = adapter.transpile(makeCanonicalFile({ shell: [{ "git push *": "deny" }] }));
      // Ожидаемый формат из спеки:
      // prefix_rule(
      //     pattern = ["git", "push"],
      //     decision = "forbidden",
      // )
      expect(files[0].content).toContain("prefix_rule(\n");
      expect(files[0].content).toMatch(/ {4}pattern = \["git", "push"\],/);
      expect(files[0].content).toMatch(/ {4}decision = "forbidden",/);
      expect(files[0].content).toContain("\n)");
    });

    // --- Граничное условие: пустой input -- расширение 4a ---
    it("генерирует минимальный валидный файл (одинокий \\n) при пустом каноническом файле", () => {
      const adapter = new CodexPermissionsAdapter();
      const files = adapter.transpile(makeCanonicalFile({}));
      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe(".codex/rules/agloom.rules");
      expect(files[0].content).toBe("\n");
    });

    // --- Граничное условие: все shell-правила пропущены (все wildcards) ---
    it("генерирует минимальный файл при всех пропущенных shell-правилах", () => {
      const adapter = new CodexPermissionsAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          shell: [{ "*": "deny" }, { "* --version": "allow" }],
        }),
      );
      expect(files[0].content).not.toContain("prefix_rule");
      expect(files[0].content).toBe("\n");
    });
  });
});
