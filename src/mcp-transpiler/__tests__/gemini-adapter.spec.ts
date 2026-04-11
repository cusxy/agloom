// gemini-adapter.spec.ts
// Спецификация: docs/specs/mcp-transpiler.md § Gemini MCP-адаптер

import { describe, it, expect } from "vitest";
import { GeminiMcpAdapter } from "../adapters/gemini-adapter.js";
import type { McpCanonicalFile } from "../types.js";

function makeCanonicalFile(mcpServers: Record<string, any>): McpCanonicalFile {
  return {
    relativePath: ".agloom/mcp.yml",
    format: "yaml",
    content: { mcpServers },
  };
}

const GEMINI_SCHEMA = "https://raw.githubusercontent.com/google-gemini/gemini-cli/main/schemas/settings.schema.json";

describe("GeminiMcpAdapter", () => {
  it('имеет agentId равный "gemini"', () => {
    const adapter = new GeminiMcpAdapter();
    expect(adapter.agentId).toBe("gemini");
  });

  describe("transpile", () => {
    it("возвращает единственный output-файл .gemini/settings.json", () => {
      const adapter = new GeminiMcpAdapter();
      const files = adapter.transpile(makeCanonicalFile({ s: { command: "npx" } }));
      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe(".gemini/settings.json");
    });

    it("содержит top-level $schema", () => {
      const adapter = new GeminiMcpAdapter();
      const files = adapter.transpile(makeCanonicalFile({ s: { command: "npx" } }));
      const out = JSON.parse(files[0].content);
      expect(out.$schema).toBe(GEMINI_SCHEMA);
    });

    // --- stdio: command, args, env ---
    it("stdio-сервер → { command, args, env } без поля type", () => {
      const adapter = new GeminiMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          fs: {
            command: "npx",
            args: ["-y", "@mcp/fs"],
            env: { ROOT: "/r" },
          },
        }),
      );
      const out = JSON.parse(files[0].content);
      expect(out.mcpServers.fs).toEqual({
        command: "npx",
        args: ["-y", "@mcp/fs"],
        env: { ROOT: "/r" },
      });
      expect("type" in out.mcpServers.fs).toBe(false);
    });

    // --- http → ключ httpUrl (НЕ url) ---
    it('http-сервер → ключ "httpUrl" (не "url")', () => {
      const adapter = new GeminiMcpAdapter();
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
      expect(out.mcpServers.figma.httpUrl).toBe("https://mcp.figma.com/mcp");
      expect("url" in out.mcpServers.figma).toBe(false);
      expect(out.mcpServers.figma.headers).toEqual({ "X-Region": "us" });
    });

    // --- sse → ключ url (НЕ httpUrl) ---
    it('sse-сервер → ключ "url" (не "httpUrl")', () => {
      const adapter = new GeminiMcpAdapter();
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
      expect(out.mcpServers.asana.url).toBe("https://mcp.asana.com/sse");
      expect("httpUrl" in out.mcpServers.asana).toBe(false);
    });

    // --- Регрессионный тест на асимметрию http ↔ httpUrl, sse ↔ url ---
    it("http и sse используют разные ключи URL (httpUrl vs url)", () => {
      const adapter = new GeminiMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          h: { type: "http", url: "https://h/mcp" },
          s: { type: "sse", url: "https://s/sse" },
        }),
      );
      const out = JSON.parse(files[0].content);
      expect(out.mcpServers.h.httpUrl).toBe("https://h/mcp");
      expect(out.mcpServers.s.url).toBe("https://s/sse");
      expect("url" in out.mcpServers.h).toBe(false);
      expect("httpUrl" in out.mcpServers.s).toBe(false);
    });

    // --- includeTools: native поле 1:1 ---
    it("includeTools передаётся как native поле без переименования", () => {
      const adapter = new GeminiMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          fs: { command: "npx", includeTools: ["read_file", "list_directory"] },
        }),
      );
      const out = JSON.parse(files[0].content);
      expect(out.mcpServers.fs.includeTools).toEqual(["read_file", "list_directory"]);
    });

    // --- excludeTools: native поле 1:1 ---
    it("excludeTools передаётся как native поле без переименования", () => {
      const adapter = new GeminiMcpAdapter();
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
      expect(out.mcpServers.figma.excludeTools).toEqual(["delete"]);
    });

    // --- http без headers: нет ключа headers ---
    it("http-сервер без headers не содержит ключ headers", () => {
      const adapter = new GeminiMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          r: { type: "http", url: "https://r/mcp" },
        }),
      );
      const out = JSON.parse(files[0].content);
      expect("headers" in out.mcpServers.r).toBe(false);
    });
  });
});
