// transpile-with-agentsmd.spec.ts
// Спецификация: docs/specs/instructions-transpiler.md § Транспиляция (обновлённая)
// Тесты, требующие AgentsMdAdapter — выделены в отдельный файл,
// чтобы не блокировать существующие тесты до создания адаптера.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createInstructionsTranspiler } from "../index.js";
import { ClaudeAdapter } from "../adapters/claude-adapter.js";
import { OpenCodeAdapter } from "../adapters/opencode-adapter.js";
import { AgentsMdAdapter } from "../adapters/agentsmd-adapter.js";

describe("InstructionsTranspiler", () => {
  describe("Транспиляция с AgentsMdAdapter", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-transpile-agmd-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- AgentsMdAdapter генерирует AGENTS.md ---
    // Спецификация: § AGENTS.md адаптер → transpile, шаги 1–4
    it("AgentsMdAdapter генерирует AGENTS.md из канонических файлов", () => {
      fs.writeFileSync(path.join(tmpDir, "AGLOOM.md"), "Root instructions.");

      const transpiler = createInstructionsTranspiler({
        projectRoot: tmpDir,
        adapters: [new AgentsMdAdapter()],
      });

      const results = transpiler.transpile();

      expect(results).toHaveLength(1);
      const agentsmdResult = results.find((r) => r.agentId === "agentsmd");
      expect(agentsmdResult).toBeDefined();
      expect(agentsmdResult!.files).toHaveLength(1);
      expect(agentsmdResult!.files[0].relativePath).toBe("AGENTS.md");
      expect(agentsmdResult!.files[0].content).toBe("Root instructions.");
      expect(agentsmdResult!.errors).toHaveLength(0);
    });

    // --- Полный pipeline с тремя адаптерами: Claude, AgentsMd, OpenCode ---
    // Спецификация: § Транспиляция — шаги 1–3 с тремя адаптерами
    it("корректно обрабатывает три адаптера: Claude генерирует CLAUDE.md, AgentsMd генерирует AGENTS.md, OpenCode — пустой", () => {
      fs.writeFileSync(path.join(tmpDir, "AGLOOM.md"), "Shared instructions.");

      const transpiler = createInstructionsTranspiler({
        projectRoot: tmpDir,
        adapters: [
          new ClaudeAdapter(),
          new AgentsMdAdapter(),
          new OpenCodeAdapter(),
        ],
      });

      const results = transpiler.transpile();

      expect(results).toHaveLength(3);

      const claudeResult = results.find((r) => r.agentId === "claude");
      expect(claudeResult).toBeDefined();
      expect(claudeResult!.files).toHaveLength(1);
      expect(claudeResult!.files[0].relativePath).toBe("CLAUDE.md");

      const agentsmdResult = results.find((r) => r.agentId === "agentsmd");
      expect(agentsmdResult).toBeDefined();
      expect(agentsmdResult!.files).toHaveLength(1);
      expect(agentsmdResult!.files[0].relativePath).toBe("AGENTS.md");

      const opencodeResult = results.find((r) => r.agentId === "opencode");
      expect(opencodeResult).toBeDefined();
      expect(opencodeResult!.files).toHaveLength(0);
    });
  });
});
