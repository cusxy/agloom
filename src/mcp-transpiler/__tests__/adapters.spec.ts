// adapters.spec.ts
// Спецификация: docs/specs/mcp-transpiler.md § Claude Code MCP-адаптер, § OpenCode MCP-адаптер,
//               § Процедура Build Base Server Config

import { describe, it, expect, vi, afterEach } from "vitest";
import { ClaudeMcpAdapter } from "../adapters/claude-adapter.js";
import { OpenCodeMcpAdapter } from "../adapters/opencode-adapter.js";
import type { McpCanonicalFile } from "../types.js";

/**
 * Создаёт McpCanonicalFile для тестирования адаптеров.
 */
function makeCanonicalFile(mcpServers: Record<string, any>): McpCanonicalFile {
  return {
    relativePath: ".agloom/mcp.yml",
    format: "yaml",
    content: { mcpServers },
  };
}

// =============================================================================
// Claude Code MCP-адаптер
// Спецификация: docs/specs/mcp-transpiler.md § Claude Code MCP-адаптер
// =============================================================================

describe("ClaudeMcpAdapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- Свойство: agentId адаптера ---
  it('имеет agentId равный "claude"', () => {
    const adapter = new ClaudeMcpAdapter();
    expect(adapter.agentId).toBe("claude");
  });

  describe("transpile", () => {
    // --- Happy path: шаги 1-4 -- генерация .mcp.json ---
    it("генерирует .mcp.json с полем mcpServers", () => {
      const adapter = new ClaudeMcpAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          context7: {
            command: "npx",
            args: ["-y", "@upstash/context7-mcp@latest"],
          },
        }),
      );

      expect(files).toHaveLength(1);
      const mcpFile = files.find((f) => f.relativePath === ".mcp.json");
      expect(mcpFile).toBeDefined();
      // § Claude Code MCP-адаптер: генерирует единственный выходной файл .mcp.json
      expect(files.find((f) => f.relativePath === ".claude/settings.json")).toBeUndefined();

      const parsed = JSON.parse(mcpFile!.content);
      expect(parsed.mcpServers.context7.command).toBe("npx");
      expect(parsed.mcpServers.context7.args).toEqual(["-y", "@upstash/context7-mcp@latest"]);
    });

    // --- Трансформация: шаг 3 -- JSON с отступом 2 пробела и завершающим переводом строки ---
    it("сериализует JSON с отступом 2 пробела и завершающим переводом строки", () => {
      const adapter = new ClaudeMcpAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          s1: { command: "npx" },
        }),
      );

      // Проверяем форматирование
      expect(files[0].content).toMatch(/^\{\n {2}/);
      expect(files[0].content).toMatch(/\n$/);
    });

    // --- Warn+ignore для includeTools/excludeTools (§ Обработка includeTools/excludeTools) ---
    it("отбрасывает includeTools из выходного файла", () => {
      vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      const adapter = new ClaudeMcpAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          filesystem: {
            command: "npx",
            args: ["-y", "@mcp/server-filesystem"],
            includeTools: ["read_file", "list_directory"],
          },
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed.mcpServers.filesystem.includeTools).toBeUndefined();
      expect(parsed.mcpServers.filesystem.command).toBe("npx");
      expect(parsed.mcpServers.filesystem.args).toEqual(["-y", "@mcp/server-filesystem"]);
    });

    it("отбрасывает excludeTools из выходного файла", () => {
      vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      const adapter = new ClaudeMcpAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          filesystem: {
            command: "npx",
            excludeTools: ["delete_file"],
          },
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed.mcpServers.filesystem.excludeTools).toBeUndefined();
    });

    // --- Процедура Build Base Server Config: шаг 2 -- args опциональны ---
    it("не включает поле args, если оно отсутствует в каноническом файле", () => {
      const adapter = new ClaudeMcpAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          simple: { command: "node" },
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed.mcpServers.simple).toEqual({ type: "stdio", command: "node" });
      expect("args" in parsed.mcpServers.simple).toBe(false);
    });

    // --- Процедура Build Base Server Config: шаг 2 -- пустой args отбрасывается ---
    it("не включает поле args, если массив пуст", () => {
      const adapter = new ClaudeMcpAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          simple: { command: "node", args: [] },
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect("args" in parsed.mcpServers.simple).toBe(false);
    });

    // --- Процедура Build Base Server Config: шаг 3 -- env опциональны ---
    it("не включает поле env, если оно отсутствует в каноническом файле", () => {
      const adapter = new ClaudeMcpAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          simple: { command: "node", args: ["server.js"] },
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect("env" in parsed.mcpServers.simple).toBe(false);
    });

    // --- Процедура Build Base Server Config: шаг 3 -- пустой env отбрасывается ---
    it("не включает поле env, если объект пуст", () => {
      const adapter = new ClaudeMcpAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          simple: { command: "node", env: {} },
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect("env" in parsed.mcpServers.simple).toBe(false);
    });

    // --- Процедура Build Base Server Config: шаги 2-3 -- args и env присутствуют ---
    it("включает args и env, если они непусты", () => {
      const adapter = new ClaudeMcpAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          filesystem: {
            command: "npx",
            args: ["-y", "@mcp/server-filesystem"],
            env: { ROOT_DIR: "/home/user/project" },
          },
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed.mcpServers.filesystem.args).toEqual(["-y", "@mcp/server-filesystem"]);
      expect(parsed.mcpServers.filesystem.env).toEqual({
        ROOT_DIR: "/home/user/project",
      });
    });

    // --- Happy path: несколько серверов ---
    it("генерирует конфигурацию для нескольких серверов", () => {
      const adapter = new ClaudeMcpAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          context7: {
            command: "npx",
            args: ["-y", "@upstash/context7-mcp@latest"],
          },
          filesystem: {
            command: "npx",
            args: ["-y", "@mcp/server-filesystem"],
            env: { ROOT_DIR: "/home/user" },
          },
        }),
      );

      expect(files).toHaveLength(1);
      const mcpFile = files.find((f) => f.relativePath === ".mcp.json");
      expect(mcpFile).toBeDefined();
      const parsed = JSON.parse(mcpFile!.content);
      expect(Object.keys(parsed.mcpServers)).toHaveLength(2);
      expect(parsed.mcpServers.context7).toBeDefined();
      expect(parsed.mcpServers.filesystem).toBeDefined();
    });

    // --- Граничное условие: пустой mcpServers ---
    it("генерирует файл с пустым mcpServers", () => {
      const adapter = new ClaudeMcpAdapter();

      const files = adapter.transpile(makeCanonicalFile({}));

      // § Claude Code MCP-адаптер: единственный выходной файл .mcp.json
      expect(files).toHaveLength(1);
      const mcpFile = files.find((f) => f.relativePath === ".mcp.json");
      expect(mcpFile).toBeDefined();
      const parsed = JSON.parse(mcpFile!.content);
      expect(parsed.mcpServers).toEqual({});
      expect(files.find((f) => f.relativePath === ".claude/settings.json")).toBeUndefined();
    });

    // --- Проверка формата: соответствие примеру из спецификации ---
    it("генерирует JSON, соответствующий примеру из спецификации", () => {
      const adapter = new ClaudeMcpAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          context7: {
            command: "npx",
            args: ["-y", "@upstash/context7-mcp@latest"],
          },
          filesystem: {
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem"],
            env: { ROOT_DIR: "/home/user/project" },
          },
        }),
      );

      const parsed = JSON.parse(files[0].content);
      // § Маппинг транспортов: type: "stdio" эмитируется явно
      expect(parsed).toEqual({
        mcpServers: {
          context7: {
            type: "stdio",
            command: "npx",
            args: ["-y", "@upstash/context7-mcp@latest"],
          },
          filesystem: {
            type: "stdio",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem"],
            env: { ROOT_DIR: "/home/user/project" },
          },
        },
      });
    });
  });
});

// =============================================================================
// OpenCode MCP-адаптер
// Спецификация: docs/specs/mcp-transpiler.md § OpenCode MCP-адаптер
// =============================================================================

describe("OpenCodeMcpAdapter", () => {
  // --- Свойство: agentId адаптера ---
  it('имеет agentId равный "opencode"', () => {
    const adapter = new OpenCodeMcpAdapter();
    expect(adapter.agentId).toBe("opencode");
  });

  describe("transpile", () => {
    // --- Happy path: шаги 1-5 -- генерация opencode.json с ключом mcp ---
    it('генерирует opencode.json с ключом "mcp"', () => {
      const adapter = new OpenCodeMcpAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          context7: {
            command: "npx",
            args: ["-y", "@upstash/context7-mcp@latest"],
          },
        }),
      );

      expect(files).toHaveLength(1);
      expect(files[0].relativePath).toBe("opencode.json");

      const parsed = JSON.parse(files[0].content);
      expect(parsed.mcp).toBeDefined();
      expect(parsed.mcp.context7).toBeDefined();
      expect(parsed.mcp.context7.command).toBe("npx");
      expect(parsed.mcp.context7.args).toEqual(["-y", "@upstash/context7-mcp@latest"]);
    });

    // --- Трансформация: шаг 4 -- JSON с отступом 2 пробела и завершающим переводом строки ---
    it("сериализует JSON с отступом 2 пробела и завершающим переводом строки", () => {
      const adapter = new OpenCodeMcpAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          s1: { command: "npx" },
        }),
      );

      expect(files[0].content).toMatch(/^\{\n {2}/);
      expect(files[0].content).toMatch(/\n$/);
    });

    // --- Процедура Build Base Server Config: шаг 4 -- отбрасывание includeTools/excludeTools ---
    it("отбрасывает includeTools из выходного файла", () => {
      const adapter = new OpenCodeMcpAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          filesystem: {
            command: "npx",
            includeTools: ["read_file"],
          },
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed.mcp.filesystem.includeTools).toBeUndefined();
    });

    it("отбрасывает excludeTools из выходного файла", () => {
      const adapter = new OpenCodeMcpAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          filesystem: {
            command: "npx",
            excludeTools: ["delete_file"],
          },
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed.mcp.filesystem.excludeTools).toBeUndefined();
    });

    // --- Процедура Build Base Server Config: шаг 2 -- args опциональны ---
    it("не включает поле args, если оно отсутствует", () => {
      const adapter = new OpenCodeMcpAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          simple: { command: "node" },
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect("args" in parsed.mcp.simple).toBe(false);
    });

    // --- Процедура Build Base Server Config: шаг 3 -- env опциональны ---
    it("не включает поле env, если оно отсутствует", () => {
      const adapter = new OpenCodeMcpAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          simple: { command: "node" },
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect("env" in parsed.mcp.simple).toBe(false);
    });

    // --- Структура: ключ "mcp" вместо "mcpServers" ---
    it('использует ключ "mcp" вместо "mcpServers" на верхнем уровне', () => {
      const adapter = new OpenCodeMcpAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          s1: { command: "npx" },
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed.mcpServers).toBeUndefined();
      expect(parsed.mcp).toBeDefined();
    });

    // --- Happy path: несколько серверов ---
    it("генерирует конфигурацию для нескольких серверов", () => {
      const adapter = new OpenCodeMcpAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          context7: {
            command: "npx",
            args: ["-y", "@upstash/context7-mcp@latest"],
          },
          filesystem: {
            command: "npx",
            args: ["-y", "@mcp/server-filesystem"],
            env: { ROOT_DIR: "/home/user" },
          },
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(Object.keys(parsed.mcp)).toHaveLength(2);
    });

    // --- Граничное условие: пустой mcpServers ---
    it("генерирует файл с пустым mcp-объектом", () => {
      const adapter = new OpenCodeMcpAdapter();

      const files = adapter.transpile(makeCanonicalFile({}));

      expect(files).toHaveLength(1);
      const parsed = JSON.parse(files[0].content);
      expect(parsed.mcp).toEqual({});
    });

    // --- Проверка формата: соответствие примеру из спецификации ---
    it("генерирует JSON, соответствующий примеру из спецификации", () => {
      const adapter = new OpenCodeMcpAdapter();

      const files = adapter.transpile(
        makeCanonicalFile({
          context7: {
            command: "npx",
            args: ["-y", "@upstash/context7-mcp@latest"],
          },
        }),
      );

      const parsed = JSON.parse(files[0].content);
      expect(parsed).toEqual({
        $schema: "https://opencode.ai/config.json",
        mcp: {
          context7: {
            type: "stdio",
            command: "npx",
            args: ["-y", "@upstash/context7-mcp@latest"],
          },
        },
      });
    });
  });
});
