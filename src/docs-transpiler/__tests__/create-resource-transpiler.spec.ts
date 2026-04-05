// create-resource-transpiler.spec.ts
// Спецификация: docs/specs/docs-transpiler.md § Инициализация
// Спецификация: docs/specs/docs-transpiler.md § Создание адаптера из реестра

import { describe, it, expect } from "vitest";
import { createResourceTranspiler, createResourceAdapter } from "../index.js";
import { ResourceConfigError } from "../errors.js";

/**
 * Стаб-адаптер, реализующий минимальный интерфейс ResourceAdapter.
 * Используется для тестирования фабричной функции, а не поведения адаптера.
 */
function createStubAdapter(agentId: string, targetDir: string = `.${agentId}/docs`) {
  return {
    agentId,
    targetDir,
  };
}

describe("ResourceTranspiler", () => {
  describe("Инициализация", () => {
    // --- Happy path: шаги 1–6 ---
    it("создаёт экземпляр при валидной конфигурации с resourceType docs", () => {
      const transpiler = createResourceTranspiler({
        projectRoot: "/absolute/path/to/project",
        adapters: [createStubAdapter("claude", ".claude/docs")],
        resourceType: "docs",
      });

      expect(transpiler).toBeDefined();
    });

    // --- Happy path: шаги 1–6, resourceType schemas ---
    it("создаёт экземпляр при валидной конфигурации с resourceType schemas", () => {
      const transpiler = createResourceTranspiler({
        projectRoot: "/absolute/path/to/project",
        adapters: [createStubAdapter("claude", ".claude/schemas")],
        resourceType: "schemas",
      });

      expect(transpiler).toBeDefined();
    });

    // --- Happy path: опциональный agloomDir с default ---
    it("использует .agloom как значение agloomDir по умолчанию", () => {
      const transpiler = createResourceTranspiler({
        projectRoot: "/absolute/path",
        adapters: [createStubAdapter("claude")],
        resourceType: "docs",
      });

      expect(transpiler).toBeDefined();
    });

    // --- Happy path: кастомный agloomDir ---
    it("принимает кастомное значение agloomDir", () => {
      const transpiler = createResourceTranspiler({
        projectRoot: "/absolute/path",
        adapters: [createStubAdapter("claude")],
        resourceType: "docs",
        agloomDir: ".custom-agloom",
      });

      expect(transpiler).toBeDefined();
    });

    // --- Расширение 1a: projectRoot не абсолютный путь ---
    it("выбрасывает ResourceConfigError, если projectRoot — относительный путь", () => {
      expect(() =>
        createResourceTranspiler({
          projectRoot: "relative/path",
          adapters: [createStubAdapter("claude")],
          resourceType: "docs",
        }),
      ).toThrow(ResourceConfigError);

      expect(() =>
        createResourceTranspiler({
          projectRoot: "relative/path",
          adapters: [createStubAdapter("claude")],
          resourceType: "docs",
        }),
      ).toThrow("projectRoot must be an absolute path");
    });

    // --- Расширение 2a: пустой массив adapters ---
    it("выбрасывает ResourceConfigError, если массив adapters пуст", () => {
      expect(() =>
        createResourceTranspiler({
          projectRoot: "/absolute/path",
          adapters: [],
          resourceType: "docs",
        }),
      ).toThrow(ResourceConfigError);

      expect(() =>
        createResourceTranspiler({
          projectRoot: "/absolute/path",
          adapters: [],
          resourceType: "docs",
        }),
      ).toThrow("At least one adapter is required");
    });

    // --- Расширение 3a: адаптер не реализует интерфейс ResourceAdapter ---
    it("выбрасывает ResourceConfigError, если адаптер не реализует интерфейс ResourceAdapter", () => {
      const invalidAdapter = { notAnAdapter: true } as any;

      expect(() =>
        createResourceTranspiler({
          projectRoot: "/absolute/path",
          adapters: [invalidAdapter],
          resourceType: "docs",
        }),
      ).toThrow(ResourceConfigError);

      expect(() =>
        createResourceTranspiler({
          projectRoot: "/absolute/path",
          adapters: [invalidAdapter],
          resourceType: "docs",
        }),
      ).toThrow("Adapter at index 0 does not implement ResourceAdapter interface");
    });

    // --- Расширение 3a: адаптер без targetDir ---
    it("выбрасывает ResourceConfigError, если адаптер не содержит targetDir", () => {
      const invalidAdapter = { agentId: "claude" } as any;

      expect(() =>
        createResourceTranspiler({
          projectRoot: "/absolute/path",
          adapters: [invalidAdapter],
          resourceType: "docs",
        }),
      ).toThrow(ResourceConfigError);

      expect(() =>
        createResourceTranspiler({
          projectRoot: "/absolute/path",
          adapters: [invalidAdapter],
          resourceType: "docs",
        }),
      ).toThrow("Adapter at index 0 does not implement ResourceAdapter interface");
    });

    // --- Расширение 4a: дублирующийся agentId ---
    it("выбрасывает ResourceConfigError при дублировании agentId среди адаптеров", () => {
      expect(() =>
        createResourceTranspiler({
          projectRoot: "/absolute/path",
          adapters: [createStubAdapter("claude"), createStubAdapter("claude")],
          resourceType: "docs",
        }),
      ).toThrow(ResourceConfigError);

      expect(() =>
        createResourceTranspiler({
          projectRoot: "/absolute/path",
          adapters: [createStubAdapter("claude"), createStubAdapter("claude")],
          resourceType: "docs",
        }),
      ).toThrow("Duplicate agentId: claude");
    });

    // --- Расширение 5a: невалидный resourceType ---
    it("выбрасывает ResourceConfigError при невалидном resourceType", () => {
      expect(() =>
        createResourceTranspiler({
          projectRoot: "/absolute/path",
          adapters: [createStubAdapter("claude")],
          resourceType: "invalid" as any,
        }),
      ).toThrow(ResourceConfigError);

      expect(() =>
        createResourceTranspiler({
          projectRoot: "/absolute/path",
          adapters: [createStubAdapter("claude")],
          resourceType: "invalid" as any,
        }),
      ).toThrow("Invalid resourceType: invalid");
    });
  });

  describe("Создание адаптера из реестра", () => {
    // --- Happy path: шаги 1–2 — создание ResourceAdapter из entry.paths[resourceType] ---
    it("создаёт ResourceAdapter из entry.paths.docs", () => {
      const entry = {
        id: "claude",
        targetRoot: ".claude",
        paths: {
          docs: ".claude/docs",
          schemas: ".claude/schemas",
        },
      } as any;

      const adapter = createResourceAdapter(entry, "docs");

      expect(adapter).not.toBeNull();
      expect(adapter!.agentId).toBe("claude");
      expect(adapter!.targetDir).toBe(".claude/docs");
    });

    // --- Happy path: шаги 1–2 — создание ResourceAdapter для schemas ---
    it("создаёт ResourceAdapter из entry.paths.schemas", () => {
      const entry = {
        id: "opencode",
        targetRoot: ".opencode",
        paths: {
          docs: ".opencode/docs",
          schemas: ".opencode/schemas",
        },
      } as any;

      const adapter = createResourceAdapter(entry, "schemas");

      expect(adapter).not.toBeNull();
      expect(adapter!.agentId).toBe("opencode");
      expect(adapter!.targetDir).toBe(".opencode/schemas");
    });

    // --- Расширение: шаг 3 — null при отсутствии пути ---
    it("возвращает null, если entry.paths не содержит ключ resourceType", () => {
      const entry = {
        id: "agentsmd",
        targetRoot: ".agents",
        paths: {},
      } as any;

      const adapter = createResourceAdapter(entry, "docs");

      expect(adapter).toBeNull();
    });

    // --- Граничное условие: paths.schemas отсутствует, paths.docs определён ---
    it("возвращает null для schemas, если paths содержит только docs", () => {
      const entry = {
        id: "custom",
        targetRoot: ".custom",
        paths: {
          docs: ".custom/docs",
        },
      } as any;

      const adapter = createResourceAdapter(entry, "schemas");

      expect(adapter).toBeNull();
    });
  });
});
