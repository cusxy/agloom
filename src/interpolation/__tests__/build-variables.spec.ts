// build-variables.spec.ts
// Спецификация: docs/specs/interpolation.md § Построение карты переменных

import { describe, it, expect } from "vitest";
import { buildVariables } from "../build-variables.js";

/**
 * Минимальный тип записи адаптера для тестирования buildVariables.
 * Соответствует полям AdapterRegistryEntry, которые использует buildVariables:
 * id, targetRoot, paths.
 */
interface TestAdapter {
  id: string;
  targetRoot: string;
  paths: {
    skills?: string;
    agents?: string;
    docs?: string;
    schemas?: string;
  };
}

function makeAdapter(
  id: string,
  targetRoot: string,
  paths: TestAdapter["paths"] = {},
): TestAdapter {
  return { id, targetRoot, paths };
}

const PROJECT_ROOT = "/home/user/myapp";

describe("Interpolation", () => {
  describe("Построение карты переменных", () => {
    // --- Happy path: шаги 1–8 — полная карта переменных ---
    it("строит полную карту с каноническими, динамическими и per-adapter переменными", () => {
      const claude = makeAdapter("claude", ".claude", {
        skills: ".claude/skills",
        agents: ".claude/agents",
        docs: ".claude/docs",
        schemas: ".claude/schemas",
      });
      const opencode = makeAdapter("opencode", ".opencode", {
        skills: ".opencode/skills",
        agents: ".opencode/agents",
        docs: ".opencode/docs",
        schemas: ".opencode/schemas",
      });
      const agentsmd = makeAdapter("agentsmd", ".agents", {});

      const result = buildVariables(
        claude,
        [claude, opencode, agentsmd],
        PROJECT_ROOT,
      );

      // Канонические
      expect(result["PROJECT_DIR"]).toBe(PROJECT_ROOT);
      expect(result["AGLOOM_DIR"]).toBe(".agloom");
      expect(result["AGLOOM_SKILLS_DIR"]).toBe(".agloom/skills");

      // Динамические (per-current-adapter)
      expect(result["ROOT_DIR"]).toBe(".claude");
      expect(result["SKILLS_DIR"]).toBe(".claude/skills");
      expect(result["AGENTS_DIR"]).toBe(".claude/agents");

      // Per-adapter: claude
      expect(result["CLAUDE_DIR"]).toBe(".claude");
      expect(result["CLAUDE_SKILLS_DIR"]).toBe(".claude/skills");

      // Per-adapter: opencode
      expect(result["OPENCODE_DIR"]).toBe(".opencode");
      expect(result["OPENCODE_SKILLS_DIR"]).toBe(".opencode/skills");

      // Per-adapter: agentsmd — НЕ должно быть (пустой paths)
      expect(result).not.toHaveProperty("AGENTSMD_DIR");
    });

    // --- Трансформация: шаг 2 — PROJECT_DIR содержит значение параметра projectRoot ---
    it("устанавливает PROJECT_DIR равным параметру projectRoot", () => {
      const adapter = makeAdapter("test", ".test", {});

      const result = buildVariables(adapter, [adapter], "/absolute/path");

      expect(result["PROJECT_DIR"]).toBe("/absolute/path");
    });

    // --- Трансформация: шаг 2 — PROJECT_DIR единственная каноническая переменная с абсолютным путём ---
    it("содержит PROJECT_DIR как единственную каноническую переменную с абсолютным путём", () => {
      const adapter = makeAdapter("test", ".test", {});

      const result = buildVariables(adapter, [adapter], "/home/user/project");

      // PROJECT_DIR — абсолютный путь
      expect(result["PROJECT_DIR"]).toBe("/home/user/project");

      // Все остальные канонические переменные — относительные пути (не начинаются с /)
      expect(result["AGLOOM_DIR"]).not.toMatch(/^\//);
      expect(result["AGLOOM_SKILLS_DIR"]).not.toMatch(/^\//);
      expect(result["AGLOOM_AGENTS_DIR"]).not.toMatch(/^\//);
      expect(result["AGLOOM_DOCS_DIR"]).not.toMatch(/^\//);
      expect(result["AGLOOM_SCHEMAS_DIR"]).not.toMatch(/^\//);
    });

    // --- Трансформация: шаг 3 — канонические переменные с фиксированными значениями ---
    it("содержит все канонические переменные с фиксированными значениями", () => {
      const adapter = makeAdapter("test", ".test", {});

      const result = buildVariables(adapter, [adapter], PROJECT_ROOT);

      expect(result["PROJECT_DIR"]).toBe(PROJECT_ROOT);
      expect(result["AGLOOM_DIR"]).toBe(".agloom");
      expect(result["AGLOOM_SKILLS_DIR"]).toBe(".agloom/skills");
      expect(result["AGLOOM_AGENTS_DIR"]).toBe(".agloom/agents");
      expect(result["AGLOOM_DOCS_DIR"]).toBe(".agloom/docs");
      expect(result["AGLOOM_SCHEMAS_DIR"]).toBe(".agloom/schemas");
    });

    // --- Трансформация: шаг 4 — ROOT_DIR всегда соответствует currentAdapter.targetRoot ---
    it("устанавливает ROOT_DIR равным currentAdapter.targetRoot", () => {
      const adapter = makeAdapter("custom", ".custom-root", {});

      const result = buildVariables(adapter, [adapter], PROJECT_ROOT);

      expect(result["ROOT_DIR"]).toBe(".custom-root");
    });

    // --- Трансформация: шаг 5 — динамическая переменная присутствует, если поле paths определено ---
    it("добавляет динамическую переменную для каждого определённого поля paths текущего адаптера", () => {
      const adapter = makeAdapter("claude", ".claude", {
        skills: ".claude/skills",
        agents: ".claude/agents",
        docs: ".claude/docs",
        schemas: ".claude/schemas",
      });

      const result = buildVariables(adapter, [adapter], PROJECT_ROOT);

      expect(result["SKILLS_DIR"]).toBe(".claude/skills");
      expect(result["AGENTS_DIR"]).toBe(".claude/agents");
      expect(result["DOCS_DIR"]).toBe(".claude/docs");
      expect(result["SCHEMAS_DIR"]).toBe(".claude/schemas");
    });

    // --- Трансформация: шаг 5 — динамическая переменная НЕ присутствует, если поле paths не определено ---
    it("не добавляет динамическую переменную, если соответствующее поле paths не определено у текущего адаптера", () => {
      const adapter = makeAdapter("agentsmd", ".agents", {});

      const result = buildVariables(adapter, [adapter], PROJECT_ROOT);

      expect(result).not.toHaveProperty("SKILLS_DIR");
      expect(result).not.toHaveProperty("AGENTS_DIR");
      expect(result).not.toHaveProperty("DOCS_DIR");
      expect(result).not.toHaveProperty("SCHEMAS_DIR");
    });

    // --- Трансформация: шаг 5 — частичное определение paths ---
    it("добавляет только определённые динамические переменные при частичном определении paths", () => {
      const adapter = makeAdapter("partial", ".partial", {
        skills: ".partial/skills",
        // agents не определено
        docs: ".partial/docs",
        // schemas не определено
      });

      const result = buildVariables(adapter, [adapter], PROJECT_ROOT);

      expect(result["SKILLS_DIR"]).toBe(".partial/skills");
      expect(result["DOCS_DIR"]).toBe(".partial/docs");
      expect(result).not.toHaveProperty("AGENTS_DIR");
      expect(result).not.toHaveProperty("SCHEMAS_DIR");
    });

    // --- Трансформация: шаги 6–8 — per-adapter переменные генерируются для адаптеров с непустым paths ---
    it("генерирует per-adapter переменные для каждого адаптера из allAdapters с непустым paths", () => {
      const current = makeAdapter("claude", ".claude", {
        skills: ".claude/skills",
      });
      const opencode = makeAdapter("opencode", ".opencode", {
        skills: ".opencode/skills",
        agents: ".opencode/agents",
      });

      const result = buildVariables(current, [current, opencode], PROJECT_ROOT);

      // CLAUDE per-adapter
      expect(result["CLAUDE_DIR"]).toBe(".claude");
      expect(result["CLAUDE_SKILLS_DIR"]).toBe(".claude/skills");

      // OPENCODE per-adapter
      expect(result["OPENCODE_DIR"]).toBe(".opencode");
      expect(result["OPENCODE_SKILLS_DIR"]).toBe(".opencode/skills");
      expect(result["OPENCODE_AGENTS_DIR"]).toBe(".opencode/agents");
    });

    // --- Трансформация: шаг 6 — per-adapter переменные НЕ генерируются для адаптера с пустым paths ---
    it("не генерирует per-adapter переменные для адаптера с пустым объектом paths", () => {
      const current = makeAdapter("claude", ".claude", {
        skills: ".claude/skills",
      });
      const agentsmd = makeAdapter("agentsmd", ".agents", {});

      const result = buildVariables(current, [current, agentsmd], PROJECT_ROOT);

      // AGENTSMD per-adapter переменные НЕ должны присутствовать
      expect(result).not.toHaveProperty("AGENTSMD_DIR");
      expect(result).not.toHaveProperty("AGENTSMD_SKILLS_DIR");
      expect(result).not.toHaveProperty("AGENTSMD_AGENTS_DIR");
      expect(result).not.toHaveProperty("AGENTSMD_DOCS_DIR");
      expect(result).not.toHaveProperty("AGENTSMD_SCHEMAS_DIR");
    });

    // --- Трансформация: шаг 7 — {PREFIX}_DIR всегда генерируется для адаптера с непустым paths ---
    it("всегда генерирует {PREFIX}_DIR для адаптера с непустым paths", () => {
      const current = makeAdapter("test", ".test", {});
      const other = makeAdapter("other", ".other-root", {
        skills: ".other/skills",
      });

      const result = buildVariables(current, [current, other], PROJECT_ROOT);

      // OTHER_DIR должен всегда присутствовать, т.к. paths непустой
      expect(result["OTHER_DIR"]).toBe(".other-root");
    });

    // --- Трансформация: шаг 8 — per-adapter подпеременная генерируется только если поле paths определено ---
    it("генерирует per-adapter подпеременную только если соответствующее поле paths определено", () => {
      const current = makeAdapter("test", ".test", {});
      const other = makeAdapter("other", ".other", {
        skills: ".other/skills",
        // agents не определено
      });

      const result = buildVariables(current, [current, other], PROJECT_ROOT);

      expect(result["OTHER_DIR"]).toBe(".other");
      expect(result["OTHER_SKILLS_DIR"]).toBe(".other/skills");
      expect(result).not.toHaveProperty("OTHER_AGENTS_DIR");
      expect(result).not.toHaveProperty("OTHER_DOCS_DIR");
      expect(result).not.toHaveProperty("OTHER_SCHEMAS_DIR");
    });

    // --- Трансформация: шаг 6 — PREFIX = adapter.id.toUpperCase() ---
    it("использует adapter.id.toUpperCase() как PREFIX для per-adapter переменных", () => {
      const current = makeAdapter("test", ".test", {});
      const claude = makeAdapter("claude", ".claude", {
        skills: ".claude/skills",
      });

      const result = buildVariables(current, [current, claude], PROJECT_ROOT);

      // PREFIX = "CLAUDE" (uppercase)
      expect(result).toHaveProperty("CLAUDE_DIR");
      expect(result).toHaveProperty("CLAUDE_SKILLS_DIR");
      expect(result).not.toHaveProperty("claude_DIR");
    });

    // --- Граничное условие: projectRoot с trailing slash ---
    it("сохраняет projectRoot как есть без нормализации trailing slash", () => {
      const adapter = makeAdapter("test", ".test", {});

      const result = buildVariables(adapter, [adapter], "/home/user/myapp/");

      // projectRoot передаётся as-is
      expect(result["PROJECT_DIR"]).toBe("/home/user/myapp/");
    });

    // --- Пример из спецификации: полная конфигурация реестра (claude, opencode, agentsmd) ---
    it("генерирует per-adapter переменные согласно примеру из спецификации", () => {
      const claude = makeAdapter("claude", ".claude", {
        skills: ".claude/skills",
        agents: ".claude/agents",
        docs: ".claude/docs",
        schemas: ".claude/schemas",
      });
      const opencode = makeAdapter("opencode", ".opencode", {
        skills: ".opencode/skills",
        agents: ".opencode/agents",
        docs: ".opencode/docs",
        schemas: ".opencode/schemas",
      });
      const agentsmd = makeAdapter("agentsmd", ".agents", {});

      const result = buildVariables(
        claude,
        [claude, opencode, agentsmd],
        PROJECT_ROOT,
      );

      // PROJECT_DIR — каноническая переменная
      expect(result["PROJECT_DIR"]).toBe(PROJECT_ROOT);

      // claude per-adapter
      expect(result["CLAUDE_DIR"]).toBe(".claude");
      expect(result["CLAUDE_SKILLS_DIR"]).toBe(".claude/skills");
      expect(result["CLAUDE_AGENTS_DIR"]).toBe(".claude/agents");
      expect(result["CLAUDE_DOCS_DIR"]).toBe(".claude/docs");
      expect(result["CLAUDE_SCHEMAS_DIR"]).toBe(".claude/schemas");

      // opencode per-adapter
      expect(result["OPENCODE_DIR"]).toBe(".opencode");
      expect(result["OPENCODE_SKILLS_DIR"]).toBe(".opencode/skills");
      expect(result["OPENCODE_AGENTS_DIR"]).toBe(".opencode/agents");
      expect(result["OPENCODE_DOCS_DIR"]).toBe(".opencode/docs");
      expect(result["OPENCODE_SCHEMAS_DIR"]).toBe(".opencode/schemas");

      // agentsmd — пустой paths → нет per-adapter переменных
      expect(result).not.toHaveProperty("AGENTSMD_DIR");
    });
  });
});
