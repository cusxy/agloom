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

describe("OpenCodeMcpAdapter — транспорты, schema, tool filtering", () => {
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

    // --- Test O2: http → type: "remote" + url ---
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

    // --- Test O1: sse → warn + skip ---
    // § Маппинг транспортов: "Канонический sse OpenCode не поддерживает — warn+skip"
    it("sse-сервер пропускается и выдаёт предупреждение в stderr", () => {
      const warnSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      const adapter = new OpenCodeMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          asana: { type: "sse", url: "https://mcp.asana.com/sse" },
        }),
      );
      const out = JSON.parse(files[0].content);
      expect("asana" in out.mcp).toBe(false);
      const calls = warnSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(calls).toMatch(/OpenCode does not support SSE/);
      expect(calls).toMatch(/asana/);
    });

    // --- Test O1 (regression): sse+stdio → только stdio в output ---
    it("смешанные транспорты: stdio остаётся, sse пропускается", () => {
      vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      const adapter = new OpenCodeMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          a: { command: "npx" },
          b: { type: "sse", url: "https://b/sse" },
        }),
      );
      const out = JSON.parse(files[0].content);
      expect(Object.keys(out.mcp).sort()).toEqual(["a"]);
    });

    // --- Test O4: http с headers → headers попадают в output ---
    // § Маппинг транспортов: "Поле headers для type: 'remote' OpenCode поддерживает"
    it("http с headers: headers передаются в output", () => {
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
      expect(out.mcp.figma).toEqual({
        type: "remote",
        url: "https://mcp.figma.com/mcp",
        headers: { "X-Region": "us" },
      });
    });

    // --- Test O5: http без headers → нет ключа headers ---
    it("http-сервер без headers не содержит ключ headers", () => {
      const adapter = new OpenCodeMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          r: { type: "http", url: "https://r/mcp" },
        }),
      );
      const out = JSON.parse(files[0].content);
      expect("headers" in out.mcp.r).toBe(false);
    });

    // --- Test O6: warning "headers not supported" больше не эмитируется ---
    it("не эмитирует warning про 'headers' для http-сервера", () => {
      const warnSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      const adapter = new OpenCodeMcpAdapter();
      adapter.transpile(
        makeCanonicalFile({
          figma: {
            type: "http",
            url: "https://figma/mcp",
            headers: { "X-Region": "us" },
          },
        }),
      );
      const calls = warnSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(calls).not.toMatch(/headers/i);
    });
  });

  describe("Warn+ignore для includeTools / excludeTools", () => {
    // --- Test W5: includeTools → warn + нет permission блока ---
    // § Обработка includeTools/excludeTools
    it("includeTools: эмитирует warning, сервер в output без permission-блока", () => {
      const warnSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
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
      expect(out.mcp.fs).toBeDefined();
      expect("includeTools" in out.mcp.fs).toBe(false);
      expect("permission" in out).toBe(false);
      const calls = warnSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(calls).toMatch(/OpenCode does not support discovery-level tool filtering/);
      expect(calls).toMatch(/fs/);
    });

    // --- Test W6: excludeTools → warn + нет permission блока ---
    it("excludeTools: эмитирует warning, сервер в output без permission-блока", () => {
      const warnSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
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
      expect("excludeTools" in out.mcp.figma).toBe(false);
      expect("permission" in out).toBe(false);
      const calls = warnSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(calls).toMatch(/OpenCode does not support discovery-level tool filtering/);
      expect(calls).toMatch(/figma/);
    });

    // --- Test W7 / O7: output содержит только $schema и mcp, никакого permission ---
    it("output opencode.json содержит ровно ключи $schema и mcp (без permission)", () => {
      const adapter = new OpenCodeMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          s: { command: "npx" },
        }),
      );
      const out = JSON.parse(files[0].content);
      expect(Object.keys(out).sort()).toEqual(["$schema", "mcp"]);
    });

    // --- Test O7: permission блок не эмитируется даже пустой ---
    it("не эмитирует ключ 'permission', если нет includeTools/excludeTools", () => {
      const adapter = new OpenCodeMcpAdapter();
      const files = adapter.transpile(makeCanonicalFile({ s: { command: "npx" } }));
      const out = JSON.parse(files[0].content);
      expect("permission" in out).toBe(false);
    });
  });

  describe("$schema и output shape", () => {
    it("содержит top-level $schema = https://opencode.ai/config.json", () => {
      const adapter = new OpenCodeMcpAdapter();
      const files = adapter.transpile(makeCanonicalFile({ s: { command: "npx" } }));
      const out = JSON.parse(files[0].content);
      expect(out.$schema).toBe(OPENCODE_SCHEMA);
    });

    it("возвращает ровно один output-файл", () => {
      const adapter = new OpenCodeMcpAdapter();
      const files = adapter.transpile(makeCanonicalFile({ s: { command: "npx" } }));
      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe("opencode.json");
    });
  });
});
