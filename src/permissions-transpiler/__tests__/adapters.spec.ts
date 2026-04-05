// adapters.spec.ts
// Спецификация: docs/specs/permissions-transpiler.md § Claude Code Permissions-адаптер,
//               § OpenCode Permissions-адаптер

import { describe, it, expect } from "vitest";
import { ClaudePermissionsAdapter } from "../adapters/claude-adapter.js";
import { OpenCodePermissionsAdapter } from "../adapters/opencode-adapter.js";
import type { PermissionsCanonicalFile } from "../types.js";

/**
 * Создаёт PermissionsCanonicalFile для тестирования адаптеров.
 * Новый формат: секции -- упорядоченные массивы пар { pattern: action }.
 */
function makeCanonicalFile(
  content: PermissionsCanonicalFile["content"],
): PermissionsCanonicalFile {
  return {
    relativePath: ".agloom/permissions.yml",
    format: "yaml",
    content,
  };
}

// =============================================================================
// Claude Code Permissions-адаптер
// Спецификация: docs/specs/permissions-transpiler.md § Claude Code Permissions-адаптер
// =============================================================================

describe("ClaudePermissionsAdapter", () => {
  // --- Свойство: agentId адаптера ---
  it('имеет agentId равный "claude"', () => {
    const adapter = new ClaudePermissionsAdapter();
    expect(adapter.agentId).toBe("claude");
  });

  describe("transpile", () => {
    // --- Happy path: шаги 1-9 -- генерация .claude/settings.json (новый формат ordered list) ---
    it("генерирует .claude/settings.json с полем permissions из ordered list", () => {
      const adapter = new ClaudePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          shell: [{ "ls *": "allow" }, { "*": "deny" }],
        }),
      );

      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe(".claude/settings.json");

      const parsed = JSON.parse(files[0].content);
      expect(parsed.permissions).toBeDefined();
      expect(parsed.permissions.allow).toContain("Bash(ls *)");
      expect(parsed.permissions.deny).toContain("Bash(*)");
    });

    // --- Трансформация: shell-правила -- Bash() обёртка (нативные глобы без двоеточия) ---
    it("трансформирует shell-правила в формат Bash(<pattern>) с нативными глобами", () => {
      const adapter = new ClaudePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          shell: [
            { "./gradlew *": "allow" },
            { "ls *": "allow" },
            { "git status *": "allow" },
            { "* --version": "allow" },
            { "*": "allow" },
          ],
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed.permissions.allow).toEqual([
        "Bash(./gradlew *)",
        "Bash(ls *)",
        "Bash(git status *)",
        "Bash(* --version)",
        "Bash(*)",
      ]);
    });

    // --- Трансформация: MCP-правила -- mcp__server__tool формат ---
    it("трансформирует MCP-правила: ':' заменяется на '__'", () => {
      const adapter = new ClaudePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          mcp: [
            { "bitbucket:get_pull_request": "allow" },
            { "jenkins:get_build": "allow" },
            { "*:*": "deny" },
          ],
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed.permissions.allow).toContain(
        "mcp__bitbucket__get_pull_request",
      );
      expect(parsed.permissions.allow).toContain("mcp__jenkins__get_build");
      expect(parsed.permissions.deny).toContain("mcp__*__*");
    });

    // --- Поведение: шаг 2.3 -- ask shell-правила пропускаются с предупреждением ---
    it("пропускает shell-правила с действием ask (не включает в allow или deny)", () => {
      const adapter = new ClaudePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          shell: [
            { "ls *": "allow" },
            { "npm *": "ask" },
            { "yarn *": "ask" },
            { "*": "deny" },
          ],
        }),
      );

      const parsed = JSON.parse(files[0].content);
      // ask-правила не должны попасть ни в allow, ни в deny
      expect(parsed.permissions.allow).not.toContain("Bash(npm *)");
      expect(parsed.permissions.allow).not.toContain("Bash(yarn *)");
      expect(parsed.permissions.deny).not.toContain("Bash(npm *)");
      expect(parsed.permissions.deny).not.toContain("Bash(yarn *)");
      // allow и deny содержат только соответствующие правила
      expect(parsed.permissions.allow).toEqual(["Bash(ls *)"]);
      expect(parsed.permissions.deny).toEqual(["Bash(*)"]);
    });

    // --- Поведение: шаг 3.3 -- ask MCP-правила пропускаются с предупреждением ---
    it("пропускает mcp-правила с действием ask (не включает в allow или deny)", () => {
      const adapter = new ClaudePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          mcp: [
            { "bitbucket:get_pull_request": "allow" },
            { "bitbucket:*": "ask" },
            { "jenkins:*": "ask" },
            { "*:*": "deny" },
          ],
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed.permissions.allow).not.toContain("mcp__bitbucket__*");
      expect(parsed.permissions.allow).not.toContain("mcp__jenkins__*");
      expect(parsed.permissions.deny).not.toContain("mcp__bitbucket__*");
      expect(parsed.permissions.deny).not.toContain("mcp__jenkins__*");
    });

    // --- Поведение: шаг 4 -- file-секция игнорируется с предупреждением ---
    it("игнорирует file-секцию (не включает в permissions)", () => {
      const adapter = new ClaudePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          file: [
            { "**/.env": "deny" },
            { "src/**": "read" },
            { "src/**/*.ts": "write" },
          ],
        }),
      );

      const parsed = JSON.parse(files[0].content);
      // file-правила не должны попасть в permissions
      // При только file-секции -- permissions пуст -> расширение 6a: пустой объект {}
      expect(parsed.permissions).toBeUndefined();
      expect(parsed).toEqual({});
    });

    // --- Трансформация: шаг 5 -- удаление пустых массивов ---
    it("удаляет ключ allow, если массив permissions.allow пуст", () => {
      const adapter = new ClaudePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          shell: [{ "*": "deny" }],
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed.permissions.allow).toBeUndefined();
      expect(parsed.permissions.deny).toEqual(["Bash(*)"]);
    });

    it("удаляет ключ deny, если массив permissions.deny пуст", () => {
      const adapter = new ClaudePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          shell: [{ "ls *": "allow" }],
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed.permissions.deny).toBeUndefined();
      expect(parsed.permissions.allow).toEqual(["Bash(ls *)"]);
    });

    // --- Расширение 6a: пустой permissions -> пустой объект {} без ключа "permissions" ---
    it("генерирует пустой объект {} без ключа permissions при пустом каноническом файле", () => {
      const adapter = new ClaudePermissionsAdapter();

      const files = adapter.transpile(makeCanonicalFile({}));

      expect(files).toHaveLength(1);
      const parsed = JSON.parse(files[0].content);
      expect(parsed).toEqual({});
      expect(parsed.permissions).toBeUndefined();
    });

    // --- Расширение 6a: только ask-правила (все пропускаются) -> пустой объект {} ---
    it("генерирует пустой объект {}, если все правила -- ask", () => {
      const adapter = new ClaudePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          shell: [{ "npm *": "ask" }],
          mcp: [{ "bitbucket:*": "ask" }],
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed).toEqual({});
      expect(parsed.permissions).toBeUndefined();
    });

    // --- Трансформация: шаг 8 -- JSON с отступом 2 пробела и завершающим переводом строки ---
    it("сериализует JSON с отступом 2 пробела и завершающим переводом строки", () => {
      const adapter = new ClaudePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          shell: [{ "ls *": "allow" }],
        }),
      );

      expect(files[0].content).toMatch(/^\{\n {2}/);
      expect(files[0].content).toMatch(/\n$/);
    });

    // --- Happy path: shell и mcp вместе -- итерация ordered list, split в allow/deny ---
    it("объединяет shell и mcp allow/deny-правила в общие массивы", () => {
      const adapter = new ClaudePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          shell: [
            { "git push *": "deny" },
            { "./gradlew *": "allow" },
            { "ls *": "allow" },
            { "git status *": "allow" },
            { "npm *": "ask" },
            { "*": "deny" },
          ],
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
      expect(parsed.permissions.allow).toEqual([
        "Bash(./gradlew *)",
        "Bash(ls *)",
        "Bash(git status *)",
        "mcp__bitbucket__get_pull_request",
        "mcp__jenkins__get_build",
      ]);
      expect(parsed.permissions.deny).toEqual([
        "Bash(git push *)",
        "Bash(*)",
        "mcp__untrusted-server__*",
        "mcp__*__*",
      ]);
    });

    // --- Пример из спецификации ---
    it("генерирует JSON, соответствующий примеру из спецификации", () => {
      const adapter = new ClaudePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          shell: [
            { "git push *": "deny" },
            { "./gradlew *": "allow" },
            { "ls *": "allow" },
            { "git status *": "allow" },
            { "npm *": "ask" },
            { "*": "deny" },
          ],
          mcp: [
            { "untrusted-server:*": "deny" },
            { "bitbucket:get_pull_request": "allow" },
            { "jenkins:get_build": "allow" },
            { "bitbucket:*": "ask" },
            { "jenkins:*": "ask" },
            { "*:*": "deny" },
          ],
          file: [
            { "**/.env": "deny" },
            { "src/**/*.ts": "write" },
            { "src/**": "read" },
          ],
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed).toEqual({
        permissions: {
          allow: [
            "Bash(./gradlew *)",
            "Bash(ls *)",
            "Bash(git status *)",
            "mcp__bitbucket__get_pull_request",
            "mcp__jenkins__get_build",
          ],
          deny: [
            "Bash(git push *)",
            "Bash(*)",
            "mcp__untrusted-server__*",
            "mcp__*__*",
          ],
        },
      });
    });

    // --- Граничное условие: единственное правило allow ---
    it("генерирует permissions с только allow при единственном allow-правиле", () => {
      const adapter = new ClaudePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          shell: [{ "ls *": "allow" }],
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed.permissions.allow).toEqual(["Bash(ls *)"]);
      expect(parsed.permissions.deny).toBeUndefined();
    });

    // --- Граничное условие: пустые массивы в секциях ---
    it("генерирует пустой объект {} при пустых массивах в секциях", () => {
      const adapter = new ClaudePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          shell: [],
          mcp: [],
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed).toEqual({});
      expect(parsed.permissions).toBeUndefined();
    });
  });
});

// =============================================================================
// OpenCode Permissions-адаптер
// Спецификация: docs/specs/permissions-transpiler.md § OpenCode Permissions-адаптер
// =============================================================================

describe("OpenCodePermissionsAdapter", () => {
  // --- Свойство: agentId адаптера ---
  it('имеет agentId равный "opencode"', () => {
    const adapter = new OpenCodePermissionsAdapter();
    expect(adapter.agentId).toBe("opencode");
  });

  describe("transpile", () => {
    // --- Happy path: шаги 1-7 -- генерация opencode.json (новый формат ordered list) ---
    it('генерирует opencode.json с ключом "permission" из ordered list', () => {
      const adapter = new OpenCodePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          shell: [{ "ls *": "allow" }, { "*": "deny" }],
        }),
      );

      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe("opencode.json");

      const parsed = JSON.parse(files[0].content);
      expect(parsed.permission).toBeDefined();
      expect(parsed.permission.bash).toBeDefined();
    });

    // --- Трансформация: shell-правила передаются as-is (нативные глобы) ---
    it("передаёт shell-паттерны as-is без трансформации", () => {
      const adapter = new OpenCodePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          shell: [
            { "ls *": "allow" },
            { "./gradlew *": "allow" },
            { "git status *": "allow" },
            { "* --version": "allow" },
            { "*": "allow" },
          ],
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed.permission.bash["ls *"]).toBe("allow");
      expect(parsed.permission.bash["./gradlew *"]).toBe("allow");
      expect(parsed.permission.bash["git status *"]).toBe("allow");
      expect(parsed.permission.bash["* --version"]).toBe("allow");
      expect(parsed.permission.bash["*"]).toBe("allow");
    });

    // --- Трансформация: MCP-правила -- ':' заменяется на '_' ---
    it("трансформирует MCP-правила: ':' заменяется на '_'", () => {
      const adapter = new OpenCodePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          mcp: [{ "bitbucket:get_pull_request": "allow" }],
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed.permission["bitbucket_get_pull_request"]).toBe("allow");
    });

    // --- Трансформация: MCP-правила -- wildcard ---
    it("трансформирует MCP-паттерн *:* в *_*", () => {
      const adapter = new OpenCodePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          mcp: [{ "*:*": "deny" }],
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed.permission["*_*"]).toBe("deny");
    });

    // --- Трансформация: инверсия порядка shell-правил для last-match-wins ---
    it("инвертирует порядок shell-правил для last-match-wins семантики", () => {
      const adapter = new OpenCodePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          shell: [
            { "git push *": "deny" },
            { "./gradlew *": "allow" },
            { "ls *": "allow" },
            { "git status *": "allow" },
            { "npm *": "ask" },
            { "*": "deny" },
          ],
        }),
      );

      const parsed = JSON.parse(files[0].content);
      const bashKeys = Object.keys(parsed.permission.bash);

      // Canonical first-match-wins: git push* deny, ./gradlew* allow, ls* allow, git status* allow, npm* ask, * deny
      // Reversed for last-match-wins: * deny, npm* ask, git status* allow, ls* allow, ./gradlew* allow, git push* deny
      expect(bashKeys).toEqual([
        "*",
        "npm *",
        "git status *",
        "ls *",
        "./gradlew *",
        "git push *",
      ]);
      expect(parsed.permission.bash["*"]).toBe("deny");
      expect(parsed.permission.bash["npm *"]).toBe("ask");
      expect(parsed.permission.bash["git push *"]).toBe("deny");
    });

    // --- Трансформация: инверсия MCP-правил ---
    it("инвертирует порядок MCP-правил для last-match-wins семантики", () => {
      const adapter = new OpenCodePermissionsAdapter();

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
      const mcpKeys = Object.keys(parsed.permission).filter(
        (k) => k !== "bash" && k !== "file",
      );
      // Reversed: *:* deny, jenkins:* ask, bitbucket:* ask, jenkins:get_build allow,
      //           bitbucket:get_pull_request allow, untrusted-server:* deny
      expect(mcpKeys).toEqual([
        "*_*",
        "jenkins_*",
        "bitbucket_*",
        "jenkins_get_build",
        "bitbucket_get_pull_request",
        "untrusted-server_*",
      ]);
    });

    // --- Трансформация: ask поддерживается нативно ---
    it("маппит ask-правила нативно в OpenCode формат", () => {
      const adapter = new OpenCodePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          shell: [{ "npm *": "ask" }],
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed.permission.bash["npm *"]).toBe("ask");
    });

    // --- Трансформация: file-секция с инверсией порядка ---
    it("трансформирует file-секцию с инверсией порядка", () => {
      const adapter = new OpenCodePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          file: [
            { "**/.env": "deny" },
            { "src/**/*.ts": "write" },
            { "src/**": "read" },
          ],
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed.permission.file).toBeDefined();

      // Canonical: **/.env deny, src/**/*.ts write, src/** read
      // Reversed: src/** read, src/**/*.ts write, **/.env deny
      const fileKeys = Object.keys(parsed.permission.file);
      expect(fileKeys).toEqual(["src/**", "src/**/*.ts", "**/.env"]);
      expect(parsed.permission.file["src/**"]).toBe("read");
      expect(parsed.permission.file["src/**/*.ts"]).toBe("write");
      expect(parsed.permission.file["**/.env"]).toBe("deny");
    });

    // --- Трансформация: шаг 6 -- JSON с отступом 2 пробела и переводом строки ---
    it("сериализует JSON с отступом 2 пробела и завершающим переводом строки", () => {
      const adapter = new OpenCodePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          shell: [{ "ls *": "allow" }],
        }),
      );

      expect(files[0].content).toMatch(/^\{\n {2}/);
      expect(files[0].content).toMatch(/\n$/);
    });

    // --- Пример из спецификации ---
    it("генерирует JSON, соответствующий примеру из спецификации", () => {
      const adapter = new OpenCodePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          shell: [
            { "git push *": "deny" },
            { "./gradlew *": "allow" },
            { "ls *": "allow" },
            { "git status *": "allow" },
            { "npm *": "ask" },
            { "*": "deny" },
          ],
          mcp: [
            { "untrusted-server:*": "deny" },
            { "bitbucket:get_pull_request": "allow" },
            { "jenkins:get_build": "allow" },
            { "bitbucket:*": "ask" },
            { "jenkins:*": "ask" },
            { "*:*": "deny" },
          ],
          file: [
            { "**/.env": "deny" },
            { "src/**/*.ts": "write" },
            { "src/**": "read" },
          ],
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed).toEqual({
        permission: {
          "*_*": "deny",
          "jenkins_*": "ask",
          "bitbucket_*": "ask",
          jenkins_get_build: "allow",
          bitbucket_get_pull_request: "allow",
          "untrusted-server_*": "deny",
          bash: {
            "*": "deny",
            "npm *": "ask",
            "git status *": "allow",
            "ls *": "allow",
            "./gradlew *": "allow",
            "git push *": "deny",
          },
          file: {
            "src/**": "read",
            "src/**/*.ts": "write",
            "**/.env": "deny",
          },
        },
      });
    });

    // --- Граничное условие: пустой канонический файл ---
    it("генерирует пустой permission при пустом каноническом файле", () => {
      const adapter = new OpenCodePermissionsAdapter();

      const files = adapter.transpile(makeCanonicalFile({}));

      expect(files).toHaveLength(1);
      const parsed = JSON.parse(files[0].content);
      expect(parsed.permission).toEqual({});
    });

    // --- Граничное условие: только shell-секция ---
    it("генерирует permission с только bash при наличии только shell", () => {
      const adapter = new OpenCodePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          shell: [{ "ls *": "allow" }],
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed.permission.bash).toBeDefined();
      const keys = Object.keys(parsed.permission);
      expect(keys).toEqual(["bash"]);
    });

    // --- Граничное условие: только mcp-секция ---
    it("генерирует permission с только MCP-ключами при наличии только mcp", () => {
      const adapter = new OpenCodePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          mcp: [{ "bitbucket:get_pull_request": "allow" }],
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed.permission["bitbucket_get_pull_request"]).toBe("allow");
      expect(parsed.permission.bash).toBeUndefined();
      expect(parsed.permission.file).toBeUndefined();
    });

    // --- Граничное условие: только file-секция ---
    it("генерирует permission с только file при наличии только file", () => {
      const adapter = new OpenCodePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          file: [{ "**/.env": "deny" }],
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed.permission.file).toBeDefined();
      expect(parsed.permission.file["**/.env"]).toBe("deny");
      const keys = Object.keys(parsed.permission);
      expect(keys).toEqual(["file"]);
    });

    // --- Граничное условие: пустые массивы в секциях ---
    it("не создаёт bash/file объекты при пустых массивах", () => {
      const adapter = new OpenCodePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          shell: [],
          mcp: [],
          file: [],
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed.permission).toEqual({});
    });

    // --- Граничное условие: единственное правило ---
    it("корректно обрабатывает единственное MCP-правило с инверсией", () => {
      const adapter = new OpenCodePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          mcp: [{ "bitbucket:*": "allow" }],
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed.permission["bitbucket_*"]).toBe("allow");
    });
  });
});
