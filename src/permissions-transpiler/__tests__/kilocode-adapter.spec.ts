// kilocode-adapter.spec.ts
// Спецификация: docs/specs/permissions-transpiler.md § Kilocode Permissions-адаптер

import { describe, it, expect } from "vitest";
import { KilocodePermissionsAdapter } from "../adapters/kilocode-adapter.js";
import type { PermissionsCanonicalFile } from "../types.js";

function makeCanonicalFile(content: PermissionsCanonicalFile["content"]): PermissionsCanonicalFile {
  return {
    relativePath: ".agloom/permissions.yml",
    format: "yaml",
    content,
  };
}

describe("KilocodePermissionsAdapter", () => {
  // --- Свойство: agentId ---
  it('имеет agentId равный "kilocode"', () => {
    const adapter = new KilocodePermissionsAdapter();
    expect(adapter.agentId).toBe("kilocode");
  });

  describe("transpile", () => {
    // --- Happy path: шаг 7 -- relativePath = kilo.jsonc (корень) ---
    it("генерирует файл kilo.jsonc в корне проекта", () => {
      const adapter = new KilocodePermissionsAdapter();
      const files = adapter.transpile(makeCanonicalFile({ shell: [{ "ls *": "allow" }] }));
      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe("kilo.jsonc");
    });

    // --- Regression guard: output не в подпапке .kilocode ---
    it("не помещает output файл в подпапку (.kilocode/... не допускается)", () => {
      const adapter = new KilocodePermissionsAdapter();
      const files = adapter.transpile(makeCanonicalFile({ shell: [{ "ls *": "allow" }] }));
      expect(files[0].relativePath).not.toContain(".kilocode");
      expect(files[0].relativePath).not.toContain("/");
    });

    // --- Формат: content является чистым JSON (parseable через JSON.parse) ---
    it("генерирует content как валидный JSON (parseable)", () => {
      const adapter = new KilocodePermissionsAdapter();
      const files = adapter.transpile(makeCanonicalFile({ shell: [{ "ls *": "allow" }] }));
      expect(() => JSON.parse(files[0].content)).not.toThrow();
    });

    // --- Трансформация shell: as-is в permission.bash с маппингом действий 1:1 ---
    it("эмитирует shell правила в permission.bash как pattern -> decision", () => {
      const adapter = new KilocodePermissionsAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          shell: [{ "ls *": "allow" }, { "npm *": "ask" }, { "rm *": "deny" }],
        }),
      );
      const parsed = JSON.parse(files[0].content);
      expect(parsed.permission.bash["ls *"]).toBe("allow");
      expect(parsed.permission.bash["npm *"]).toBe("ask");
      expect(parsed.permission.bash["rm *"]).toBe("deny");
    });

    // --- Инверсия: shell массив reverse для last-match-wins ---
    it("инвертирует порядок shell-правил (reverse) для last-match-wins", () => {
      const adapter = new KilocodePermissionsAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          shell: [{ "git push *": "deny" }, { "./gradlew *": "allow" }, { "ls *": "allow" }, { "*": "deny" }],
        }),
      );
      const parsed = JSON.parse(files[0].content);
      const keys = Object.keys(parsed.permission.bash);
      // Canonical: git push*, ./gradlew*, ls*, *
      // Reversed:  *, ls*, ./gradlew*, git push*
      expect(keys).toEqual(["*", "ls *", "./gradlew *", "git push *"]);
    });

    // --- Трансформация MCP: flat-ключи <server>_<tool> с reverse ---
    it("эмитирует mcp правила как flat-ключи <server>_<tool> с inverted порядком", () => {
      const adapter = new KilocodePermissionsAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          mcp: [{ "untrusted-server:*": "deny" }, { "bitbucket:get_pull_request": "allow" }, { "*:*": "deny" }],
        }),
      );
      const parsed = JSON.parse(files[0].content);
      expect(parsed.permission["*_*"]).toBe("deny");
      expect(parsed.permission["bitbucket_get_pull_request"]).toBe("allow");
      expect(parsed.permission["untrusted-server_*"]).toBe("deny");

      const mcpKeys = Object.keys(parsed.permission).filter(
        (k) => k !== "bash" && k !== "read" && k !== "edit" && k !== "write",
      );
      // Reversed order
      expect(mcpKeys).toEqual(["*_*", "bitbucket_get_pull_request", "untrusted-server_*"]);
    });

    // --- File deny -> read=deny, edit=deny, write=deny ---
    it("раскрывает canonical deny в read=deny, edit=deny, write=deny", () => {
      const adapter = new KilocodePermissionsAdapter();
      const files = adapter.transpile(makeCanonicalFile({ file: [{ "**/.env": "deny" }] }));
      const parsed = JSON.parse(files[0].content);
      expect(parsed.permission.read["**/.env"]).toBe("deny");
      expect(parsed.permission.edit["**/.env"]).toBe("deny");
      expect(parsed.permission.write["**/.env"]).toBe("deny");
    });

    // --- File read -> read=allow, edit=deny, write=deny ---
    it("раскрывает canonical read в read=allow, edit=deny, write=deny", () => {
      const adapter = new KilocodePermissionsAdapter();
      const files = adapter.transpile(makeCanonicalFile({ file: [{ "src/**": "read" }] }));
      const parsed = JSON.parse(files[0].content);
      expect(parsed.permission.read["src/**"]).toBe("allow");
      expect(parsed.permission.edit["src/**"]).toBe("deny");
      expect(parsed.permission.write["src/**"]).toBe("deny");
    });

    // --- File write -> read=allow, edit=allow, write=allow ---
    it("раскрывает canonical write в read=allow, edit=allow, write=allow", () => {
      const adapter = new KilocodePermissionsAdapter();
      const files = adapter.transpile(makeCanonicalFile({ file: [{ "src/**/*.ts": "write" }] }));
      const parsed = JSON.parse(files[0].content);
      expect(parsed.permission.read["src/**/*.ts"]).toBe("allow");
      expect(parsed.permission.edit["src/**/*.ts"]).toBe("allow");
      expect(parsed.permission.write["src/**/*.ts"]).toBe("allow");
    });

    // --- File: инверсия порядка во всех трёх категориях ---
    it("инвертирует порядок file-правил во всех трёх категориях", () => {
      const adapter = new KilocodePermissionsAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          file: [{ "**/.env": "deny" }, { "src/**/*.ts": "write" }, { "src/**": "read" }],
        }),
      );
      const parsed = JSON.parse(files[0].content);
      // Canonical: **/.env deny, src/**/*.ts write, src/** read
      // Reversed:  src/** read, src/**/*.ts write, **/.env deny
      const readKeys = Object.keys(parsed.permission.read);
      expect(readKeys).toEqual(["src/**", "src/**/*.ts", "**/.env"]);
    });

    // --- Инвариант: output содержит ТОЛЬКО ключ "permission" ---
    it("output содержит только top-level ключ 'permission' (без mcpServers/$schema)", () => {
      const adapter = new KilocodePermissionsAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          shell: [{ "ls *": "allow" }],
          mcp: [{ "bitbucket:get_pull_request": "allow" }],
          file: [{ "src/**": "read" }],
        }),
      );
      const parsed = JSON.parse(files[0].content);
      expect(Object.keys(parsed)).toEqual(["permission"]);
      expect(parsed.mcpServers).toBeUndefined();
      expect(parsed.$schema).toBeUndefined();
    });

    // --- Пример из спецификации ---
    it("генерирует JSON, соответствующий примеру из спецификации", () => {
      const adapter = new KilocodePermissionsAdapter();
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
          file: [{ "**/.env": "deny" }, { "src/**/*.ts": "write" }, { "src/**": "read" }],
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
          read: {
            "src/**": "allow",
            "src/**/*.ts": "allow",
            "**/.env": "deny",
          },
          edit: {
            "src/**": "deny",
            "src/**/*.ts": "allow",
            "**/.env": "deny",
          },
          write: {
            "src/**": "deny",
            "src/**/*.ts": "allow",
            "**/.env": "deny",
          },
        },
      });
    });

    // --- Формат: JSON с отступом 2 пробела и завершающим \n ---
    it("сериализует JSON с отступом 2 пробела и завершающим переводом строки", () => {
      const adapter = new KilocodePermissionsAdapter();
      const files = adapter.transpile(makeCanonicalFile({ shell: [{ "ls *": "allow" }] }));
      expect(files[0].content).toMatch(/^\{\n {2}/);
      expect(files[0].content).toMatch(/\n$/);
    });

    // --- Граничное: пустой input -> { "permission": {} } ---
    it("генерирует минимальный output при пустом каноническом файле", () => {
      const adapter = new KilocodePermissionsAdapter();
      const files = adapter.transpile(makeCanonicalFile({}));
      expect(files).toHaveLength(1);
      const parsed = JSON.parse(files[0].content);
      expect(parsed).toEqual({ permission: {} });
    });
  });
});
