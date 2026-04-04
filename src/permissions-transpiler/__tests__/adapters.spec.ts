// adapters.spec.ts
// Спецификация: docs/specs/permissions-transpiler.md § Claude Code Permissions-адаптер,
//               § OpenCode Permissions-адаптер

import { describe, it, expect } from "vitest";
import { ClaudePermissionsAdapter } from "../adapters/claude-adapter.js";
import { OpenCodePermissionsAdapter } from "../adapters/opencode-adapter.js";
import type { PermissionsCanonicalFile } from "../types.js";

/**
 * Создаёт PermissionsCanonicalFile для тестирования адаптеров.
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
    // --- Happy path: шаги 1-8 -- генерация .claude/settings.json ---
    it("генерирует .claude/settings.json с полем permissions", () => {
      const adapter = new ClaudePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          shell: {
            allow: ["ls:*"],
            ask: [],
            deny: ["*:*"],
          },
        }),
      );

      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe(".claude/settings.json");

      const parsed = JSON.parse(files[0].content);
      expect(parsed.permissions).toBeDefined();
      expect(parsed.permissions.allow).toContain("Bash(ls:*)");
      expect(parsed.permissions.deny).toContain("Bash(*:*)");
    });

    // --- Трансформация: shell-правила -- Bash() обёртка ---
    it("трансформирует shell-правила в формат Bash(<command>:<args-glob>)", () => {
      const adapter = new ClaudePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          shell: {
            allow: ["ls:*", "./gradlew:*", "git status:*"],
            ask: [],
            deny: [],
          },
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed.permissions.allow).toEqual([
        "Bash(ls:*)",
        "Bash(./gradlew:*)",
        "Bash(git status:*)",
      ]);
    });

    // --- Трансформация: MCP-правила -- mcp__server__tool формат ---
    it("трансформирует MCP-правила: ':' заменяется на '__'", () => {
      const adapter = new ClaudePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          mcp: {
            allow: ["bitbucket:get_pull_request", "jenkins:get_build"],
            ask: [],
            deny: ["*:*"],
          },
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed.permissions.allow).toContain(
        "mcp__bitbucket__get_pull_request",
      );
      expect(parsed.permissions.allow).toContain("mcp__jenkins__get_build");
      expect(parsed.permissions.deny).toContain("mcp__*__*");
    });

    // --- Поведение: шаг 2.2 -- shell.ask пропускается с предупреждением ---
    it("пропускает shell.ask правила (не включает в allow или deny)", () => {
      const adapter = new ClaudePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          shell: {
            allow: ["ls:*"],
            ask: ["npm:*", "yarn:*"],
            deny: ["*:*"],
          },
        }),
      );

      const parsed = JSON.parse(files[0].content);
      // ask-правила не должны попасть ни в allow, ни в deny
      expect(parsed.permissions.allow).not.toContain("Bash(npm:*)");
      expect(parsed.permissions.allow).not.toContain("Bash(yarn:*)");
      expect(parsed.permissions.deny).not.toContain("Bash(npm:*)");
      expect(parsed.permissions.deny).not.toContain("Bash(yarn:*)");
    });

    // --- Поведение: шаг 3.2 -- mcp.ask пропускается с предупреждением ---
    it("пропускает mcp.ask правила (не включает в allow или deny)", () => {
      const adapter = new ClaudePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          mcp: {
            allow: ["bitbucket:get_pull_request"],
            ask: ["bitbucket:*", "jenkins:*"],
            deny: ["*:*"],
          },
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed.permissions.allow).not.toContain("mcp__bitbucket__*");
      expect(parsed.permissions.allow).not.toContain("mcp__jenkins__*");
      expect(parsed.permissions.deny).not.toContain("mcp__bitbucket__*");
      expect(parsed.permissions.deny).not.toContain("mcp__jenkins__*");
    });

    // --- Поведение: шаг 4 -- file-секция игнорируется ---
    it("игнорирует file-секцию (не включает в permissions)", () => {
      const adapter = new ClaudePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          file: {
            deny: ["**/.env"],
            read: ["src/**"],
            write: ["src/**/*.ts"],
          },
        }),
      );

      const parsed = JSON.parse(files[0].content);
      // file-правила не должны попасть в permissions
      expect(parsed.permissions.allow).toBeUndefined();
      expect(parsed.permissions.deny).toBeUndefined();
    });

    // --- Трансформация: шаг 5 -- удаление пустых массивов ---
    it("удаляет ключ allow, если массив permissions.allow пуст", () => {
      const adapter = new ClaudePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          shell: {
            allow: [],
            ask: [],
            deny: ["*:*"],
          },
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed.permissions.allow).toBeUndefined();
      expect(parsed.permissions.deny).toEqual(["Bash(*:*)"]);
    });

    it("удаляет ключ deny, если массив permissions.deny пуст", () => {
      const adapter = new ClaudePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          shell: {
            allow: ["ls:*"],
            ask: [],
            deny: [],
          },
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed.permissions.deny).toBeUndefined();
      expect(parsed.permissions.allow).toEqual(["Bash(ls:*)"]);
    });

    // --- Трансформация: шаг 7 -- JSON с отступом 2 пробела и завершающим переводом строки ---
    it("сериализует JSON с отступом 2 пробела и завершающим переводом строки", () => {
      const adapter = new ClaudePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          shell: {
            allow: ["ls:*"],
            ask: [],
            deny: [],
          },
        }),
      );

      expect(files[0].content).toMatch(/^\{\n {2}/);
      expect(files[0].content).toMatch(/\n$/);
    });

    // --- Happy path: shell и mcp вместе ---
    it("объединяет shell и mcp правила в общие массивы allow и deny", () => {
      const adapter = new ClaudePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          shell: {
            allow: ["./gradlew:*", "ls:*", "git status:*"],
            ask: ["npm:*"],
            deny: ["*:*"],
          },
          mcp: {
            allow: ["bitbucket:get_pull_request", "jenkins:get_build"],
            ask: ["bitbucket:*", "jenkins:*"],
            deny: ["*:*"],
          },
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed.permissions.allow).toEqual([
        "Bash(./gradlew:*)",
        "Bash(ls:*)",
        "Bash(git status:*)",
        "mcp__bitbucket__get_pull_request",
        "mcp__jenkins__get_build",
      ]);
      expect(parsed.permissions.deny).toEqual(["Bash(*:*)", "mcp__*__*"]);
    });

    // --- Пример из спецификации ---
    it("генерирует JSON, соответствующий примеру из спецификации", () => {
      const adapter = new ClaudePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          shell: {
            allow: ["./gradlew:*", "ls:*", "git status:*"],
            ask: ["npm:*"],
            deny: ["*:*"],
          },
          mcp: {
            allow: ["bitbucket:get_pull_request", "jenkins:get_build"],
            ask: ["bitbucket:*", "jenkins:*"],
            deny: ["*:*"],
          },
          file: {
            deny: ["**/.env"],
            read: ["src/**"],
            write: ["src/**/*.ts"],
          },
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed).toEqual({
        permissions: {
          allow: [
            "Bash(./gradlew:*)",
            "Bash(ls:*)",
            "Bash(git status:*)",
            "mcp__bitbucket__get_pull_request",
            "mcp__jenkins__get_build",
          ],
          deny: ["Bash(*:*)", "mcp__*__*"],
        },
      });
    });

    // --- Граничное условие: пустой канонический файл ---
    it("генерирует permissions без allow и deny при пустом каноническом файле", () => {
      const adapter = new ClaudePermissionsAdapter();

      const files = adapter.transpile(makeCanonicalFile({}));

      expect(files).toHaveLength(1);
      const parsed = JSON.parse(files[0].content);
      // Оба массива пусты -> оба ключа удалены
      expect(parsed.permissions).toEqual({});
    });

    // --- Граничное условие: только ask-правила (все пропускаются) ---
    it("генерирует пустой permissions, если все правила -- ask", () => {
      const adapter = new ClaudePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          shell: {
            allow: [],
            ask: ["npm:*"],
            deny: [],
          },
          mcp: {
            allow: [],
            ask: ["bitbucket:*"],
            deny: [],
          },
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed.permissions).toEqual({});
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
    // --- Happy path: шаги 1-7 -- генерация opencode.json ---
    it('генерирует opencode.json с ключом "permission"', () => {
      const adapter = new OpenCodePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          shell: {
            allow: ["ls:*"],
            ask: [],
            deny: ["*:*"],
          },
        }),
      );

      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe("opencode.json");

      const parsed = JSON.parse(files[0].content);
      expect(parsed.permission).toBeDefined();
      expect(parsed.permission.bash).toBeDefined();
    });

    // --- Трансформация: shell-правила -- ':' заменяется на пробел ---
    it("трансформирует shell-правила: ':' заменяется на пробел", () => {
      const adapter = new OpenCodePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          shell: {
            allow: ["ls:*", "./gradlew:*", "git status:*"],
            ask: [],
            deny: [],
          },
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed.permission.bash["ls *"]).toBe("allow");
      expect(parsed.permission.bash["./gradlew *"]).toBe("allow");
      expect(parsed.permission.bash["git status *"]).toBe("allow");
    });

    // --- Трансформация: специальный случай *:* -> * ---
    it("трансформирует shell-паттерн *:* в * (без пробела)", () => {
      const adapter = new OpenCodePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          shell: {
            allow: [],
            ask: [],
            deny: ["*:*"],
          },
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed.permission.bash["*"]).toBe("deny");
      expect(parsed.permission.bash["* *"]).toBeUndefined();
    });

    // --- Трансформация: MCP-правила -- ':' заменяется на '_' ---
    it("трансформирует MCP-правила: ':' заменяется на '_'", () => {
      const adapter = new OpenCodePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          mcp: {
            allow: ["bitbucket:get_pull_request"],
            ask: [],
            deny: [],
          },
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
          mcp: {
            allow: [],
            ask: [],
            deny: ["*:*"],
          },
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed.permission["*_*"]).toBe("deny");
    });

    // --- Трансформация: инверсия порядка правил ---
    it("инвертирует порядок правил для last-match-wins семантики", () => {
      const adapter = new OpenCodePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          shell: {
            allow: ["ls:*", "git status:*"],
            ask: ["npm:*"],
            deny: ["*:*"],
          },
        }),
      );

      const parsed = JSON.parse(files[0].content);
      const bashKeys = Object.keys(parsed.permission.bash);

      // После инверсии: deny первым, ask вторым, allow последним
      // Canonical order: allow(ls:*, git status:*), ask(npm:*), deny(*:*)
      // Reversed: deny(*:*), ask(npm:*), allow(git status:*), allow(ls:*)
      expect(bashKeys).toEqual(["*", "npm *", "git status *", "ls *"]);
    });

    // --- Трансформация: инверсия MCP-правил ---
    it("инвертирует порядок MCP-правил для last-match-wins семантики", () => {
      const adapter = new OpenCodePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          mcp: {
            allow: ["bitbucket:get_pull_request", "jenkins:get_build"],
            ask: ["bitbucket:*", "jenkins:*"],
            deny: ["*:*"],
          },
        }),
      );

      const parsed = JSON.parse(files[0].content);
      // MCP-правила -- плоские ключи в permission (не в bash)
      // Canonical: allow(bitbucket:get_pull_request, jenkins:get_build),
      //            ask(bitbucket:*, jenkins:*), deny(*:*)
      // Reversed: deny(*:*), ask(jenkins:*), ask(bitbucket:*),
      //           allow(jenkins:get_build), allow(bitbucket:get_pull_request)
      const mcpKeys = Object.keys(parsed.permission).filter(
        (k) => k !== "bash" && k !== "file",
      );
      expect(mcpKeys).toEqual([
        "*_*",
        "jenkins_*",
        "bitbucket_*",
        "jenkins_get_build",
        "bitbucket_get_pull_request",
      ]);
    });

    // --- Трансформация: ask поддерживается нативно ---
    it("маппит ask-правила нативно в OpenCode формат", () => {
      const adapter = new OpenCodePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          shell: {
            allow: [],
            ask: ["npm:*"],
            deny: [],
          },
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed.permission.bash["npm *"]).toBe("ask");
    });

    // --- Трансформация: file-секция ---
    it("трансформирует file-секцию с инверсией порядка", () => {
      const adapter = new OpenCodePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          file: {
            deny: ["**/.env"],
            read: ["src/**"],
            write: ["src/**/*.ts"],
          },
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed.permission.file).toBeDefined();

      // Canonical: deny(**/.env), read(src/**), write(src/**/*.ts)
      // Reversed: write(src/**/*.ts), read(src/**), deny(**/.env)
      const fileKeys = Object.keys(parsed.permission.file);
      expect(fileKeys).toEqual(["src/**/*.ts", "src/**", "**/.env"]);
      expect(parsed.permission.file["src/**/*.ts"]).toBe("write");
      expect(parsed.permission.file["src/**"]).toBe("read");
      expect(parsed.permission.file["**/.env"]).toBe("deny");
    });

    // --- Трансформация: шаг 6 -- JSON с отступом 2 пробела и переводом строки ---
    it("сериализует JSON с отступом 2 пробела и завершающим переводом строки", () => {
      const adapter = new OpenCodePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          shell: {
            allow: ["ls:*"],
            ask: [],
            deny: [],
          },
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
          shell: {
            allow: ["./gradlew:*", "ls:*", "git status:*"],
            ask: ["npm:*"],
            deny: ["*:*"],
          },
          mcp: {
            allow: ["bitbucket:get_pull_request", "jenkins:get_build"],
            ask: ["bitbucket:*", "jenkins:*"],
            deny: ["*:*"],
          },
          file: {
            deny: ["**/.env"],
            read: ["src/**"],
            write: ["src/**/*.ts"],
          },
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
          bash: {
            "*": "deny",
            "npm *": "ask",
            "git status *": "allow",
            "ls *": "allow",
            "./gradlew *": "allow",
          },
          file: {
            "src/**/*.ts": "write",
            "src/**": "read",
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
          shell: {
            allow: ["ls:*"],
            ask: [],
            deny: [],
          },
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed.permission.bash).toBeDefined();
      // Нет mcp-ключей и file
      const keys = Object.keys(parsed.permission);
      expect(keys).toEqual(["bash"]);
    });

    // --- Граничное условие: только mcp-секция ---
    it("генерирует permission с только MCP-ключами при наличии только mcp", () => {
      const adapter = new OpenCodePermissionsAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          mcp: {
            allow: ["bitbucket:get_pull_request"],
            ask: [],
            deny: [],
          },
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
          file: {
            deny: ["**/.env"],
            read: [],
            write: [],
          },
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
          shell: { allow: [], ask: [], deny: [] },
          mcp: { allow: [], ask: [], deny: [] },
          file: { deny: [], read: [], write: [] },
        }),
      );

      const parsed = JSON.parse(files[0].content);
      // Все секции присутствуют, но массивы пусты -- объекты не должны содержать ключей
      // или не создаваться вовсе (зависит от реализации, но permission должен быть пустым)
      expect(parsed.permission).toEqual({});
    });
  });
});
