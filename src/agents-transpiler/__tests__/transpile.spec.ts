// transpile.spec.ts
// Спецификация: docs/specs/agents-transpiler.md § Транспиляция

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createAgentsTranspiler } from "../index.js";
import { AgentDiscoverError } from "../errors.js";

/**
 * Стаб-адаптер, возвращающий предсказуемые файлы.
 */
function createStubAdapter(
  agentId: string,
  transpileFn?: (definitions: any[]) => any[],
) {
  return {
    agentId,
    transpile: transpileFn ?? (() => []),
  };
}

describe("AgentsTranspiler", () => {
  describe("Транспиляция", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sds-agents-transpile-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- Happy path: шаги 1–3 — полный цикл транспиляции ---
    it("выполняет полный цикл: discover → adapter.transpile(definitions) → собрать результаты", () => {
      const agentsDir = path.join(tmpDir, ".agents", "agents");
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.writeFileSync(
        path.join(agentsDir, "code-reviewer.md"),
        "---\nname: code-reviewer\n---\nBody.",
      );

      const adapter1 = createStubAdapter("adapter-a", (defs) =>
        defs.map((d) => ({
          relativePath: `.adapter-a/agents/${d.name}.md`,
          content: `Transformed for A: ${d.rawContent}`,
        })),
      );
      const adapter2 = createStubAdapter("adapter-b", (defs) =>
        defs.map((d) => ({
          relativePath: `.adapter-b/agents/${d.name}.md`,
          content: `Transformed for B: ${d.rawContent}`,
        })),
      );

      const transpiler = createAgentsTranspiler({
        projectRoot: tmpDir,
        adapters: [adapter1, adapter2],
      });

      const results = transpiler.transpile();

      expect(results).toHaveLength(2);

      const resultA = results.find((r) => r.agentId === "adapter-a");
      expect(resultA).toBeDefined();
      expect(resultA!.files).toHaveLength(1);
      expect(resultA!.errors).toHaveLength(0);

      const resultB = results.find((r) => r.agentId === "adapter-b");
      expect(resultB).toBeDefined();
      expect(resultB!.files).toHaveLength(1);
      expect(resultB!.errors).toHaveLength(0);
    });

    // --- Расширение 1a: нет определений агентов → пустой массив ---
    it("возвращает пустой массив AgentTranspileResult[], если определений агентов не обнаружено", () => {
      // tmpDir не содержит .agents/agents/

      const transpiler = createAgentsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      const results = transpiler.transpile();

      expect(results).toEqual([]);
    });

    // --- Расширение 1b: discover() выбрасывает AgentDiscoverError → пробросить ---
    it("пробрасывает AgentDiscoverError к вызывающему коду, если discover() выбросил ошибку", () => {
      const agentsDir = path.join(tmpDir, ".agents", "agents");
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.chmodSync(agentsDir, 0o000);

      const transpiler = createAgentsTranspiler({
        projectRoot: tmpDir,
        adapters: [createStubAdapter("claude")],
      });

      try {
        expect(() => transpiler.transpile()).toThrow(AgentDiscoverError);
      } finally {
        fs.chmodSync(agentsDir, 0o755);
      }
    });

    // --- Расширение 2a: адаптер выбрасывает исключение → AgentTranspileResult с ошибкой, продолжить остальные ---
    it("создаёт AgentTranspileResult с ошибкой при исключении адаптера и продолжает остальные", () => {
      const agentsDir = path.join(tmpDir, ".agents", "agents");
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.writeFileSync(
        path.join(agentsDir, "agent.md"),
        "---\nname: agent\n---\nContent.",
      );

      const failingAdapter = {
        agentId: "failing",
        transpile: () => {
          throw new Error("Adapter internal failure");
        },
      };

      const successAdapter = createStubAdapter("success", (defs) =>
        defs.map((d) => ({
          relativePath: `success/${d.name}.md`,
          content: d.rawContent,
        })),
      );

      const transpiler = createAgentsTranspiler({
        projectRoot: tmpDir,
        adapters: [failingAdapter, successAdapter],
      });

      const results = transpiler.transpile();

      // Должны быть результаты для обоих адаптеров
      expect(results).toHaveLength(2);

      // Failing adapter — с ошибкой
      const failingResult = results.find((r) => r.agentId === "failing");
      expect(failingResult).toBeDefined();
      expect(failingResult!.files).toHaveLength(0);
      expect(failingResult!.errors).toHaveLength(1);
      expect(failingResult!.errors[0].message).toContain(
        "Adapter internal failure",
      );
      expect(failingResult!.errors[0].agentId).toBe("failing");
      expect(failingResult!.errors[0].cause).toBeInstanceOf(Error);

      // Success adapter — успешно
      const successResult = results.find((r) => r.agentId === "success");
      expect(successResult).toBeDefined();
      expect(successResult!.errors).toHaveLength(0);
      expect(successResult!.files).toHaveLength(1);
    });
  });
});
