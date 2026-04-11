// opencode-adapter-transport.spec.ts
// Спецификация: docs/specs/mcp-transpiler.md § OpenCode MCP-адаптер

import { describe, it, expect, vi, afterEach } from "vitest";
import { OpenCodeMcpAdapter } from "../adapters/opencode-adapter.js";
import type { McpCanonicalFile } from "../types.js";

function makeCanonicalFile(mcpServers: Record<string, any>): McpCanonicalFile {
  return {
    relativePath: ".agloom/mcp.yml",
    format: "yaml",
    content: { mcpServers },
  };
}

const OPENCODE_SCHEMA = "https://opencode.ai/config.json";

describe("OpenCodeMcpAdapter — транспорты, schema, permissions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Маппинг транспортов", () => {
    // --- stdio: явный type: "stdio" ---
    it('stdio-сервер записывается с явным type: "stdio"', () => {
      const adapter = new OpenCodeMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          s: { command: "npx", args: ["-y", "@pkg"], env: { K: "v" } },
        }),
      );
      const out = JSON.parse(files[0].content);
      expect(out.mcp.s.type).toBe("stdio");
      expect(out.mcp.s.command).toBe("npx");
      expect(out.mcp.s.args).toEqual(["-y", "@pkg"]);
      expect(out.mcp.s.env).toEqual({ K: "v" });
    });

    // --- http → type: "remote" + url ---
    it('http-сервер отображается в type: "remote" + url (не "http")', () => {
      const adapter = new OpenCodeMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          figma: { type: "http", url: "https://mcp.figma.com/mcp" },
        }),
      );
      const out = JSON.parse(files[0].content);
      expect(out.mcp.figma).toEqual({
        type: "remote",
        url: "https://mcp.figma.com/mcp",
      });
    });

    // --- sse → type: "remote" + url ---
    it('sse-сервер также отображается в type: "remote" (не "sse")', () => {
      const adapter = new OpenCodeMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          asana: { type: "sse", url: "https://mcp.asana.com/sse" },
        }),
      );
      const out = JSON.parse(files[0].content);
      expect(out.mcp.asana).toEqual({
        type: "remote",
        url: "https://mcp.asana.com/sse",
      });
    });

    // --- http с headers → warn в stderr, headers НЕ попадают в output ---
    it("http с headers: предупреждение в stderr, headers отбрасываются", () => {
      const warnSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      const adapter = new OpenCodeMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          figma: {
            type: "http",
            url: "https://mcp.figma.com/mcp",
            headers: { "X-Region": "us" },
          },
        }),
      );
      const out = JSON.parse(files[0].content);
      expect("headers" in out.mcp.figma).toBe(false);
      const calls = warnSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(calls).toMatch(/OpenCode does not support MCP 'headers'/);
      expect(calls).toMatch(/figma/);
    });

    // --- sse с headers → warn аналогично ---
    it("sse с headers: предупреждение в stderr, headers отбрасываются", () => {
      const warnSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      const adapter = new OpenCodeMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          asana: {
            type: "sse",
            url: "https://mcp.asana.com/sse",
            headers: { Authorization: "Bearer x" },
          },
        }),
      );
      const out = JSON.parse(files[0].content);
      expect("headers" in out.mcp.asana).toBe(false);
      const calls = warnSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(calls).toMatch(/asana/);
    });
  });

  describe("Трансформация includeTools/excludeTools в permission", () => {
    // --- includeTools → permission[<s>_<t>] = "allow" ---
    it('includeTools добавляет ключи permission["<s>_<t>"] = "allow"', () => {
      const adapter = new OpenCodeMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          fs: {
            command: "npx",
            includeTools: ["read_file", "list_directory"],
          },
        }),
      );
      const out = JSON.parse(files[0].content);
      expect(out.permission).toEqual({
        fs_read_file: "allow",
        fs_list_directory: "allow",
      });
    });

    // --- excludeTools → permission[<s>_<t>] = "deny" ---
    it('excludeTools добавляет ключи permission["<s>_<t>"] = "deny"', () => {
      const adapter = new OpenCodeMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          figma: {
            type: "http",
            url: "https://figma/mcp",
            excludeTools: ["delete"],
          },
        }),
      );
      const out = JSON.parse(files[0].content);
      expect(out.permission.figma_delete).toBe("deny");
    });

    // --- Нет includeTools/excludeTools → нет ключа permission ---
    it("permission отсутствует, если нет includeTools/excludeTools", () => {
      const adapter = new OpenCodeMcpAdapter();
      const files = adapter.transpile(makeCanonicalFile({ s: { command: "npx" } }));
      const out = JSON.parse(files[0].content);
      expect("permission" in out).toBe(false);
    });
  });

  describe("$schema и output", () => {
    it("содержит top-level $schema = https://opencode.ai/config.json", () => {
      const adapter = new OpenCodeMcpAdapter();
      const files = adapter.transpile(makeCanonicalFile({ s: { command: "npx" } }));
      const out = JSON.parse(files[0].content);
      expect(out.$schema).toBe(OPENCODE_SCHEMA);
    });

    it("возвращает ровно один output-файл", () => {
      const adapter = new OpenCodeMcpAdapter();
      const files = adapter.transpile(makeCanonicalFile({ s: { command: "npx", includeTools: ["t"] } }));
      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe("opencode.json");
    });
  });
});
