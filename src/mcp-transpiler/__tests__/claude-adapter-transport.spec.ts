// claude-adapter-transport.spec.ts
// Спецификация: docs/specs/mcp-transpiler.md § Claude Code MCP-адаптер

import { describe, it, expect, vi, afterEach } from "vitest";
import { ClaudeMcpAdapter } from "../adapters/claude-adapter.js";
import type { McpCanonicalFile } from "../types.js";

function makeCanonicalFile(mcpServers: Record<string, any>): McpCanonicalFile {
  return {
    relativePath: ".agloom/mcp.yml",
    format: "yaml",
    content: { mcpServers },
  };
}

function findFile(files: { relativePath: string; content: string }[], rel: string) {
  const f = files.find((f) => f.relativePath === rel);
  if (!f) throw new Error(`expected file ${rel} not emitted`);
  return f;
}

describe("ClaudeMcpAdapter — транспорты и output shape", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Output shape: только .mcp.json", () => {
    // --- Test C1: ровно один output-файл ---
    // § Claude Code MCP-адаптер: "генерирует единственный выходной файл .mcp.json"
    it("возвращает массив ровно из одного элемента", () => {
      const adapter = new ClaudeMcpAdapter();
      const files = adapter.transpile(makeCanonicalFile({ s: { command: "npx" } }));
      expect(files).toHaveLength(1);
    });

    // --- Test C2: единственный элемент — .mcp.json, нет .claude/settings.json ---
    it("единственный элемент имеет relativePath '.mcp.json' и нет '.claude/settings.json'", () => {
      const adapter = new ClaudeMcpAdapter();
      const files = adapter.transpile(makeCanonicalFile({ s: { command: "npx" } }));
      const paths = files.map((f) => f.relativePath);
      expect(paths).toEqual([".mcp.json"]);
      expect(paths).not.toContain(".claude/settings.json");
    });

    // --- .mcp.json не содержит $schema ---
    it(".mcp.json не содержит ключ $schema", () => {
      const adapter = new ClaudeMcpAdapter();
      const files = adapter.transpile(makeCanonicalFile({ s: { command: "npx" } }));
      const mcp = JSON.parse(findFile(files, ".mcp.json").content);
      expect("$schema" in mcp).toBe(false);
    });
  });

  describe("Маппинг транспортов (.mcp.json)", () => {
    // --- Test C4: stdio → явный type: "stdio" ---
    // § Маппинг транспортов: "Поле type ТРЕБУЕТСЯ записывать явно для всех транспортов, включая stdio"
    it('stdio-сервер записывается с явным type: "stdio"', () => {
      const adapter = new ClaudeMcpAdapter();
      const files = adapter.transpile(makeCanonicalFile({ s: { command: "npx", args: ["-y"] } }));
      const mcp = JSON.parse(findFile(files, ".mcp.json").content);
      expect(mcp.mcpServers.s.type).toBe("stdio");
      expect(mcp.mcpServers.s.command).toBe("npx");
      expect(mcp.mcpServers.s.args).toEqual(["-y"]);
    });

    it("stdio без явного поля type в каноническом файле всё равно эмитирует type: 'stdio'", () => {
      const adapter = new ClaudeMcpAdapter();
      const files = adapter.transpile(makeCanonicalFile({ s: { command: "npx" } }));
      const mcp = JSON.parse(findFile(files, ".mcp.json").content);
      expect(mcp.mcpServers.s.type).toBe("stdio");
    });

    // --- Test C5: http → type="http" ---
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

    // --- Test C5: sse → type="sse" ---
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

  describe("Warn+ignore для includeTools / excludeTools", () => {
    // --- Test W1: includeTools → warning + entry без полей фильтрации ---
    // § Обработка includeTools/excludeTools
    it("includeTools: эмитирует warning в stderr и игнорирует поле", () => {
      const warnSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      const adapter = new ClaudeMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          filesystem: {
            command: "npx",
            includeTools: ["read_file", "list_directory"],
          },
        }),
      );
      const mcp = JSON.parse(findFile(files, ".mcp.json").content);
      // entry сервера не содержит includeTools/excludeTools и никаких native-эквивалентов
      expect("includeTools" in mcp.mcpServers.filesystem).toBe(false);
      expect("excludeTools" in mcp.mcpServers.filesystem).toBe(false);
      expect("enabled_tools" in mcp.mcpServers.filesystem).toBe(false);
      expect("disabled_tools" in mcp.mcpServers.filesystem).toBe(false);
      // Warning эмитирован
      const calls = warnSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(calls).toMatch(/Claude Code does not support discovery-level tool filtering/);
      expect(calls).toMatch(/filesystem/);
    });

    // --- Test W2: excludeTools → warning + entry без полей фильтрации ---
    it("excludeTools: эмитирует warning в stderr и игнорирует поле", () => {
      const warnSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
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
      const mcp = JSON.parse(findFile(files, ".mcp.json").content);
      expect("excludeTools" in mcp.mcpServers.figma).toBe(false);
      expect("disabled_tools" in mcp.mcpServers.figma).toBe(false);
      const calls = warnSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(calls).toMatch(/Claude Code does not support discovery-level tool filtering/);
      expect(calls).toMatch(/figma/);
    });

    // --- Test W4: отсутствие .claude/settings.json (ни permissions, ни schema) ---
    it("не создаёт .claude/settings.json даже при наличии includeTools", () => {
      vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      const adapter = new ClaudeMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          s: { command: "npx", includeTools: ["t"] },
        }),
      );
      const paths = files.map((f) => f.relativePath);
      expect(paths).not.toContain(".claude/settings.json");
      expect(paths).toEqual([".mcp.json"]);
    });

    // --- Нет поля permissions в .mcp.json при наличии includeTools ---
    it(".mcp.json не содержит ключ 'permissions' при наличии includeTools", () => {
      vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      const adapter = new ClaudeMcpAdapter();
      const files = adapter.transpile(
        makeCanonicalFile({
          s: { command: "npx", includeTools: ["t"] },
        }),
      );
      const mcp = JSON.parse(findFile(files, ".mcp.json").content);
      expect("permissions" in mcp).toBe(false);
    });

    // --- Без includeTools/excludeTools warning не эмитируется ---
    it("не эмитирует warning, если нет includeTools/excludeTools", () => {
      const warnSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      const adapter = new ClaudeMcpAdapter();
      adapter.transpile(makeCanonicalFile({ s: { command: "npx" } }));
      const calls = warnSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(calls).not.toMatch(/discovery-level tool filtering/);
    });
  });
});
