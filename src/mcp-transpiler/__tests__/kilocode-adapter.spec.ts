// kilocode-adapter.spec.ts
// Спецификация: docs/specs/mcp-transpiler.md § Kilocode MCP-адаптер

import { describe, it, expect, vi, afterEach } from "vitest";
import { KilocodeMcpAdapter } from "../adapters/kilocode-adapter.js";
import type { McpCanonicalFile } from "../types.js";

function makeCanonicalFile(mcpServers: Record<string, any>): McpCanonicalFile {
  return {
    relativePath: ".agloom/mcp.yml",
    format: "yaml",
    content: { mcpServers },
  };
}

const KILOCODE_SCHEMA = "https://app.kilo.ai/config.json";

describe("KilocodeMcpAdapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('имеет agentId равный "kilocode"', () => {
    const adapter = new KilocodeMcpAdapter();
    expect(adapter.agentId).toBe("kilocode");
  });

  describe("transpile", () => {
    it("возвращает единственный .kilocode/mcp.json", () => {
      const adapter = new KilocodeMcpAdapter();
      const files = adapter.transpile(makeCanonicalFile({ s: { command: "npx" } }));
      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe(".kilocode/mcp.json");
    });

    it("содержит top-level $schema", () => {
      const adapter = new KilocodeMcpAdapter();
      const files = adapter.transpile(makeCanonicalFile({ s: { command: "npx" } }));
      const out = JSON.parse(files[0].content);
      expect(out.$schema).toBe(KILOCODE_SCHEMA);
    });

    // --- stdio без поля type ---
    it("stdio-сервер записывается без поля type", () => {
      const adapter = new KilocodeMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          fs: {
            command: "npx",
            args: ["-y"],
            env: { K: "v" },
          },
        }),
      );
      const out = JSON.parse(files[0].content);
      expect(out.mcpServers.fs).toEqual({
        command: "npx",
        args: ["-y"],
        env: { K: "v" },
      });
      expect("type" in out.mcpServers.fs).toBe(false);
    });

    // --- http → type: "streamable-http" (РЕГРЕССИЯ: не "http") ---
    it('http-сервер → type: "streamable-http" (не "http")', () => {
      const adapter = new KilocodeMcpAdapter();
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
      expect(out.mcpServers.figma).toEqual({
        type: "streamable-http",
        url: "https://mcp.figma.com/mcp",
        headers: { "X-Region": "us" },
      });
    });

    // --- sse → type: "sse" ---
    it('sse-сервер → type: "sse" с url и headers', () => {
      const adapter = new KilocodeMcpAdapter();
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
      expect(out.mcpServers.asana).toEqual({
        type: "sse",
        url: "https://mcp.asana.com/sse",
        headers: { Authorization: "Bearer x" },
      });
    });

    // --- includeTools → alwaysAllow в той же entry ---
    it("includeTools добавляется в alwaysAllow той же entry", () => {
      const adapter = new KilocodeMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          fs: {
            command: "npx",
            includeTools: ["read_file", "list_directory"],
          },
        }),
      );
      const out = JSON.parse(files[0].content);
      expect(out.mcpServers.fs.alwaysAllow).toEqual(["read_file", "list_directory"]);
    });

    // --- excludeTools → warn в stderr, поле НЕ добавляется ---
    it("excludeTools: warn в stderr, поле не попадает в output", () => {
      const warnSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      const adapter = new KilocodeMcpAdapter();
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
      expect("disabledTools" in out.mcpServers.figma).toBe(false);
      expect("excludeTools" in out.mcpServers.figma).toBe(false);
      const calls = warnSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(calls).toMatch(/Kilocode does not support tool denylist/);
      expect(calls).toMatch(/figma/);
    });

    // --- http без headers: нет ключа headers ---
    it("http-сервер без headers не содержит ключ headers", () => {
      const adapter = new KilocodeMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          r: { type: "http", url: "https://r/mcp" },
        }),
      );
      const out = JSON.parse(files[0].content);
      expect(out.mcpServers.r.type).toBe("streamable-http");
      expect("headers" in out.mcpServers.r).toBe(false);
    });
  });
});
