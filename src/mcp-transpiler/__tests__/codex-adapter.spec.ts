// codex-adapter.spec.ts
// Спецификация: docs/specs/mcp-transpiler.md § Codex MCP-адаптер,
//               § Процедура TOML-сериализации MCP-конфигурации

import { describe, it, expect, vi, afterEach } from "vitest";
import * as TOML from "smol-toml";
import { CodexMcpAdapter } from "../adapters/codex-adapter.js";
import type { McpCanonicalFile } from "../types.js";

function makeCanonicalFile(mcpServers: Record<string, any>): McpCanonicalFile {
  return {
    relativePath: ".agloom/mcp.yml",
    format: "yaml",
    content: { mcpServers },
  };
}

const CODEX_SCHEMA_LINE = "#:schema https://developers.openai.com/codex/config-schema.json";

describe("CodexMcpAdapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- Свойство: agentId ---
  it('имеет agentId равный "codex"', () => {
    const adapter = new CodexMcpAdapter();
    expect(adapter.agentId).toBe("codex");
  });

  describe("transpile", () => {
    // --- Шаг 4: schema-директива первой строкой ---
    it("содержит директиву схемы первой строкой", () => {
      const adapter = new CodexMcpAdapter();
      const files = adapter.transpile(makeCanonicalFile({ s: { command: "npx" } }));
      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe(".codex/config.toml");
      const firstLine = files[0].content.split("\n")[0];
      expect(firstLine).toBe(CODEX_SCHEMA_LINE);
    });

    // --- stdio: таблица mcp_servers.<name> с command, args ---
    it("stdio-сервер эмитируется как [mcp_servers.<name>] с command и args", () => {
      const adapter = new CodexMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          context7: {
            command: "npx",
            args: ["-y", "@upstash/context7-mcp@latest"],
          },
        }),
      );
      const parsed = TOML.parse(files[0].content) as any;
      expect(parsed.mcp_servers.context7.command).toBe("npx");
      expect(parsed.mcp_servers.context7.args).toEqual(["-y", "@upstash/context7-mcp@latest"]);
    });

    // --- stdio с env: nested table [mcp_servers.<name>.env] ---
    it("stdio-сервер с env эмитирует nested table [mcp_servers.<name>.env]", () => {
      const adapter = new CodexMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          fs: {
            command: "npx",
            args: ["@mcp/fs"],
            env: { ROOT_DIR: "/home/user" },
          },
        }),
      );
      const content = files[0].content;
      expect(content).toMatch(/\[mcp_servers\.fs\]/);
      expect(content).toMatch(/\[mcp_servers\.fs\.env\]/);
      const parsed = TOML.parse(content) as any;
      expect(parsed.mcp_servers.fs.env).toEqual({ ROOT_DIR: "/home/user" });
    });

    // --- stdio без env: нет nested table env ---
    it("stdio-сервер без env не содержит таблицу env", () => {
      const adapter = new CodexMcpAdapter();
      const files = adapter.transpile(makeCanonicalFile({ fs: { command: "npx" } }));
      expect(files[0].content).not.toMatch(/\.env\]/);
    });

    // --- http: url + http_headers ---
    it("http-сервер эмитирует url и http_headers (если headers непусто)", () => {
      const adapter = new CodexMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          figma: {
            type: "http",
            url: "https://mcp.figma.com/mcp",
            headers: { "X-Figma-Region": "us-east-1" },
          },
        }),
      );
      const parsed = TOML.parse(files[0].content) as any;
      expect(parsed.mcp_servers.figma.url).toBe("https://mcp.figma.com/mcp");
      expect(parsed.mcp_servers.figma.http_headers).toEqual({
        "X-Figma-Region": "us-east-1",
      });
    });

    // --- http без headers: http_headers отсутствует ---
    it("http-сервер без headers не содержит http_headers", () => {
      const adapter = new CodexMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          r: { type: "http", url: "https://x/mcp" },
        }),
      );
      const parsed = TOML.parse(files[0].content) as any;
      expect(parsed.mcp_servers.r.url).toBe("https://x/mcp");
      expect("http_headers" in parsed.mcp_servers.r).toBe(false);
    });

    // --- sse: warn + skip (entry не эмитируется) ---
    it("sse-сервер пропускается и выдаёт предупреждение в stderr", () => {
      const warnSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      const adapter = new CodexMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          asana: { type: "sse", url: "https://mcp.asana.com/sse" },
        }),
      );
      const content = files[0].content;
      expect(content).not.toMatch(/mcp_servers\.asana/);
      const calls = warnSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(calls).toMatch(/Codex does not support SSE/);
      expect(calls).toMatch(/asana/);
    });

    // --- Mixed: stdio + http + sse → два сервера в output, sse пропущен ---
    it("смешанные транспорты: stdio+http в output, sse пропущен", () => {
      vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      const adapter = new CodexMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          a: { command: "npx" },
          b: { type: "http", url: "https://b/mcp" },
          c: { type: "sse", url: "https://c/sse" },
        }),
      );
      const parsed = TOML.parse(files[0].content) as any;
      expect(Object.keys(parsed.mcp_servers).sort()).toEqual(["a", "b"]);
    });

    // --- includeTools → enabled_tools array ---
    it("includeTools эмитируется как enabled_tools", () => {
      const adapter = new CodexMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          fs: {
            command: "npx",
            includeTools: ["read_file", "list_directory"],
          },
        }),
      );
      const parsed = TOML.parse(files[0].content) as any;
      expect(parsed.mcp_servers.fs.enabled_tools).toEqual(["read_file", "list_directory"]);
    });

    // --- excludeTools → disabled_tools array ---
    it("excludeTools эмитируется как disabled_tools", () => {
      const adapter = new CodexMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          figma: {
            type: "http",
            url: "https://figma/mcp",
            excludeTools: ["delete"],
          },
        }),
      );
      const parsed = TOML.parse(files[0].content) as any;
      expect(parsed.mcp_servers.figma.disabled_tools).toEqual(["delete"]);
    });

    // --- § Процедура TOML-сериализации, шаг 2: детерминированный порядок ключей ---
    it("ключи верхнего уровня эмитируются в порядке: command → args → enabled_tools → disabled_tools", () => {
      const adapter = new CodexMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          fs: {
            command: "npx",
            args: ["-y"],
            includeTools: ["read_file"],
          },
        }),
      );
      const body = files[0].content;
      // Извлекаем фрагмент таблицы fs
      const table = body.slice(body.indexOf("[mcp_servers.fs]"));
      const cmdIdx = table.indexOf("command");
      const argsIdx = table.indexOf("args");
      const etIdx = table.indexOf("enabled_tools");
      expect(cmdIdx).toBeGreaterThanOrEqual(0);
      expect(argsIdx).toBeGreaterThan(cmdIdx);
      expect(etIdx).toBeGreaterThan(argsIdx);
    });

    // --- § Процедура TOML-сериализации, шаг 2: url → http_headers порядок для http ---
    it("http-сервер эмитирует url перед http_headers", () => {
      const adapter = new CodexMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          figma: {
            type: "http",
            url: "https://figma/mcp",
            headers: { X: "1" },
          },
        }),
      );
      const body = files[0].content;
      const urlIdx = body.indexOf("url");
      const hhIdx = body.indexOf("http_headers");
      expect(urlIdx).toBeGreaterThan(0);
      expect(hhIdx).toBeGreaterThan(urlIdx);
    });

    // --- § Процедура TOML-сериализации, шаг 3: env эмитируется ПОСЛЕ server-таблицы ---
    it("nested table env эмитируется сразу после таблицы сервера", () => {
      const adapter = new CodexMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          fs: {
            command: "npx",
            args: ["-y"],
            env: { ROOT: "/r" },
            includeTools: ["read_file"],
          },
        }),
      );
      const body = files[0].content;
      // env идёт после enabled_tools (после всех top-level ключей таблицы)
      const etIdx = body.indexOf("enabled_tools");
      const envIdx = body.indexOf("[mcp_servers.fs.env]");
      expect(envIdx).toBeGreaterThan(etIdx);
    });

    // --- § Процедура TOML-сериализации, шаг 5: пустая строка между таблицами серверов ---
    it("между таблицами серверов эмитируется пустая строка", () => {
      const adapter = new CodexMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          a: { command: "npx" },
          b: { command: "node" },
        }),
      );
      expect(files[0].content).toMatch(/\[mcp_servers\.a\][\s\S]*?\n\n\[mcp_servers\.b\]/);
    });

    // --- Детерминированность сериализации между прогонами ---
    it("сериализация детерминирована между двумя прогонами с одинаковым входом", () => {
      const adapter1 = new CodexMcpAdapter();
      const adapter2 = new CodexMcpAdapter();
      const input = () =>
        makeCanonicalFile({
          a: {
            command: "npx",
            args: ["-y"],
            env: { A: "1", B: "2" },
            includeTools: ["t1", "t2"],
          },
          b: { type: "http", url: "https://b/mcp", headers: { X: "1" } },
        });
      const out1 = adapter1.transpile(input())[0].content;
      const out2 = adapter2.transpile(input())[0].content;
      expect(out1).toBe(out2);
    });

    // --- Граничное условие: пустой mcpServers ---
    it("пустой mcpServers: output содержит schema-директиву", () => {
      const adapter = new CodexMcpAdapter();
      const files = adapter.transpile(makeCanonicalFile({}));
      expect(files[0].content.split("\n")[0]).toBe(CODEX_SCHEMA_LINE);
      expect(files[0].content).not.toMatch(/\[mcp_servers\./);
    });
  });
});
