// claude-adapter-transport.spec.ts
// Спецификация: docs/specs/mcp-transpiler.md § Claude Code MCP-адаптер
//               (маппинг транспортов, трансформация includeTools/excludeTools в permissions)

import { describe, it, expect } from "vitest";
import { ClaudeMcpAdapter } from "../adapters/claude-adapter.js";
import type { McpCanonicalFile } from "../types.js";

function makeCanonicalFile(mcpServers: Record<string, any>): McpCanonicalFile {
  return {
    relativePath: ".agloom/mcp.yml",
    format: "yaml",
    content: { mcpServers },
  };
}

const CLAUDE_SCHEMA = "https://json.schemastore.org/claude-code-settings.json";

function findFile(files: { relativePath: string; content: string }[], rel: string) {
  const f = files.find((f) => f.relativePath === rel);
  if (!f) throw new Error(`expected file ${rel} not emitted`);
  return f;
}

describe("ClaudeMcpAdapter — транспорты и permissions", () => {
  describe("Маппинг транспортов (.mcp.json)", () => {
    // --- stdio → .mcp.json без поля type (default implicit) ---
    it('stdio-сервер записывается без поля "type"', () => {
      const adapter = new ClaudeMcpAdapter();
      const files = adapter.transpile(makeCanonicalFile({ s: { command: "npx", args: ["-y"] } }));
      const mcp = JSON.parse(findFile(files, ".mcp.json").content);
      expect(mcp.mcpServers.s.command).toBe("npx");
      expect("type" in mcp.mcpServers.s).toBe(false);
    });

    // --- http → entry с type="http", url, headers ---
    it('http-сервер записывается с type="http", url, headers', () => {
      const adapter = new ClaudeMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          figma: {
            type: "http",
            url: "https://mcp.figma.com/mcp",
            headers: { "X-Figma-Region": "us-east-1" },
          },
        }),
      );
      const mcp = JSON.parse(findFile(files, ".mcp.json").content);
      expect(mcp.mcpServers.figma).toEqual({
        type: "http",
        url: "https://mcp.figma.com/mcp",
        headers: { "X-Figma-Region": "us-east-1" },
      });
    });

    // --- sse → entry с type="sse", url, headers ---
    it('sse-сервер записывается с type="sse", url, headers', () => {
      const adapter = new ClaudeMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          asana: {
            type: "sse",
            url: "https://mcp.asana.com/sse",
            headers: { Authorization: "Bearer xyz" },
          },
        }),
      );
      const mcp = JSON.parse(findFile(files, ".mcp.json").content);
      expect(mcp.mcpServers.asana).toEqual({
        type: "sse",
        url: "https://mcp.asana.com/sse",
        headers: { Authorization: "Bearer xyz" },
      });
    });

    // --- http без headers → entry без ключа headers ---
    it("http-сервер без headers не содержит ключ headers в entry", () => {
      const adapter = new ClaudeMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          r: { type: "http", url: "https://x/mcp" },
        }),
      );
      const mcp = JSON.parse(findFile(files, ".mcp.json").content);
      expect(mcp.mcpServers.r).toEqual({ type: "http", url: "https://x/mcp" });
      expect("headers" in mcp.mcpServers.r).toBe(false);
    });
  });

  describe("Трансформация includeTools/excludeTools в permissions", () => {
    // --- includeTools → .claude/settings.json permissions.allow ---
    it("includeTools сервера транспилируются в permissions.allow c префиксом mcp__<server>__<tool>", () => {
      const adapter = new ClaudeMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          filesystem: {
            command: "npx",
            includeTools: ["read_file", "list_directory"],
          },
        }),
      );
      const settings = JSON.parse(findFile(files, ".claude/settings.json").content);
      expect(settings.$schema).toBe(CLAUDE_SCHEMA);
      expect(settings.permissions.allow).toEqual(["mcp__filesystem__read_file", "mcp__filesystem__list_directory"]);
    });

    // --- excludeTools → permissions.deny ---
    it("excludeTools сервера транспилируются в permissions.deny с префиксом mcp__<server>__<tool>", () => {
      const adapter = new ClaudeMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          figma: {
            type: "http",
            url: "https://mcp.figma.com/mcp",
            excludeTools: ["delete"],
          },
        }),
      );
      const settings = JSON.parse(findFile(files, ".claude/settings.json").content);
      expect(settings.permissions.deny).toEqual(["mcp__figma__delete"]);
    });

    // --- $schema всегда присутствует в .claude/settings.json ---
    it("$schema всегда присутствует в .claude/settings.json", () => {
      const adapter = new ClaudeMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          s: { command: "npx", includeTools: ["t"] },
        }),
      );
      const settings = JSON.parse(findFile(files, ".claude/settings.json").content);
      expect(settings.$schema).toBe(CLAUDE_SCHEMA);
    });

    // --- $schema также эмитируется, если нет include/excludeTools ---
    // § Расширение 5.3a: settingsOutput содержит только $schema, файл всё равно эмитируется
    it("эмитирует .claude/settings.json с только $schema, если нет includeTools/excludeTools", () => {
      const adapter = new ClaudeMcpAdapter();
      const files = adapter.transpile(makeCanonicalFile({ s: { command: "npx" } }));
      const settings = JSON.parse(findFile(files, ".claude/settings.json").content);
      expect(settings.$schema).toBe(CLAUDE_SCHEMA);
      expect(settings.permissions).toBeUndefined();
    });

    // --- Два сервера с фильтрацией → объединённые allow и deny ---
    it("объединяет allow/deny от нескольких серверов в одном .claude/settings.json", () => {
      const adapter = new ClaudeMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          fs: { command: "npx", includeTools: ["read_file"] },
          figma: {
            type: "http",
            url: "https://figma/mcp",
            excludeTools: ["delete"],
          },
        }),
      );
      const settings = JSON.parse(findFile(files, ".claude/settings.json").content);
      expect(settings.permissions.allow).toEqual(["mcp__fs__read_file"]);
      expect(settings.permissions.deny).toEqual(["mcp__figma__delete"]);
    });

    // --- Только allow: permissions содержит allow без deny ---
    it("permissions содержит только allow, если нет excludeTools", () => {
      const adapter = new ClaudeMcpAdapter();
      const files = adapter.transpile(makeCanonicalFile({ fs: { command: "npx", includeTools: ["read"] } }));
      const settings = JSON.parse(findFile(files, ".claude/settings.json").content);
      expect(settings.permissions.allow).toEqual(["mcp__fs__read"]);
      expect("deny" in settings.permissions).toBe(false);
    });

    // --- .mcp.json НЕ содержит $schema (по спеке: публичной схемы нет) ---
    it(".mcp.json не содержит ключ $schema", () => {
      const adapter = new ClaudeMcpAdapter();
      const files = adapter.transpile(makeCanonicalFile({ s: { command: "npx" } }));
      const mcp = JSON.parse(findFile(files, ".mcp.json").content);
      expect("$schema" in mcp).toBe(false);
    });

    // --- Результат transpile возвращает оба файла ---
    it("возвращает два output-файла: .mcp.json и .claude/settings.json", () => {
      const adapter = new ClaudeMcpAdapter();
      const files = adapter.transpile(makeCanonicalFile({ s: { command: "npx" } }));
      const paths = files.map((f) => f.relativePath).sort();
      expect(paths).toEqual([".claude/settings.json", ".mcp.json"]);
    });
  });
});
