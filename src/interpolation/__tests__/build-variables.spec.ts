// build-variables.spec.ts
// Спецификация: docs/specs/interpolation.md § Построение карты переменных

import { describe, it, expect } from "vitest";
import { buildVariables } from "../build-variables.js";

/**
 * Минимальный тип записи адаптера для тестирования buildVariables.
 * После удаления targetRoot используются только id и paths.
 */
interface TestAdapter {
  id: string;
  paths: {
    skills?: string;
    agents?: string;
    docs?: string;
    schemas?: string;
  };
}

function makeAdapter(id: string, paths: TestAdapter["paths"] = {}): TestAdapter {
  return { id, paths };
}

const PROJECT_ROOT = "/home/user/myapp";

describe("Interpolation", () => {
  describe("Построение карты переменных", () => {
    // --- Happy path: шаги 1–6 — полная карта переменных ---
    // § interpolation.md: Канонические, Динамические, Per-adapter переменные
    it("строит полную карту с каноническими, динамическими и per-adapter переменными", () => {
      const claude = makeAdapter("claude", {
        skills: ".claude/skills",
        agents: ".claude/agents",
        docs: ".claude/docs",
        schemas: ".claude/schemas",
      });
      const opencode = makeAdapter("opencode", {
        skills: ".opencode/skills",
        agents: ".opencode/agents",
        docs: ".opencode/docs",
        schemas: ".opencode/schemas",
      });
      const agentsmd = makeAdapter("agentsmd", {});

      const result = buildVariables(claude, [claude, opencode, agentsmd], PROJECT_ROOT);

      // Канонические
      expect(result["PROJECT_DIR"]).toBe(PROJECT_ROOT);
      expect(result["AGLOOM_DIR"]).toBe(".agloom");
      expect(result["AGLOOM_SKILLS_DIR"]).toBe(".agloom/skills");

      // Динамические (per-current-adapter) — НЕ содержит ROOT_DIR
      expect(result).not.toHaveProperty("ROOT_DIR");
      expect(result["SKILLS_DIR"]).toBe(".claude/skills");
      expect(result["AGENTS_DIR"]).toBe(".claude/agents");

      // Per-adapter: claude — НЕ содержит {PREFIX}_DIR
      expect(result).not.toHaveProperty("CLAUDE_DIR");
      expect(result["CLAUDE_SKILLS_DIR"]).toBe(".claude/skills");

      // Per-adapter: opencode — НЕ содержит {PREFIX}_DIR
      expect(result).not.toHaveProperty("OPENCODE_DIR");
      expect(result["OPENCODE_SKILLS_DIR"]).toBe(".opencode/skills");

      // Per-adapter: agentsmd — НЕ должно быть (пустой paths)
      expect(result).not.toHaveProperty("AGENTSMD_DIR");
    });

    // --- Трансформация: шаг 2 — PROJECT_DIR содержит значение параметра projectRoot ---
    // § interpolation.md: PROJECT_DIR = значение параметра projectRoot
    it("устанавливает PROJECT_DIR равным параметру projectRoot", () => {
      const adapter = makeAdapter("test", {});

      const result = buildVariables(adapter, [adapter], "/absolute/path");

      expect(result["PROJECT_DIR"]).toBe("/absolute/path");
    });

    // --- Трансформация: шаг 2 — PROJECT_DIR единственная каноническая переменная с абсолютным путём ---
    // § interpolation.md: PROJECT_DIR — единственная каноническая переменная, содержащая абсолютный путь.
    it("содержит PROJECT_DIR как единственную каноническую переменную с абсолютным путём", () => {
      const adapter = makeAdapter("test", {});

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
    // § interpolation.md: Таблица канонических переменных
    it("содержит все канонические переменные с фиксированными значениями", () => {
      const adapter = makeAdapter("test", {});

      const result = buildVariables(adapter, [adapter], PROJECT_ROOT);

      expect(result["PROJECT_DIR"]).toBe(PROJECT_ROOT);
      expect(result["AGLOOM_DIR"]).toBe(".agloom");
      expect(result["AGLOOM_SKILLS_DIR"]).toBe(".agloom/skills");
      expect(result["AGLOOM_AGENTS_DIR"]).toBe(".agloom/agents");
      expect(result["AGLOOM_DOCS_DIR"]).toBe(".agloom/docs");
      expect(result["AGLOOM_SCHEMAS_DIR"]).toBe(".agloom/schemas");
    });

    // --- Удаление ROOT_DIR: buildVariables НЕ содержит ROOT_DIR ---
    // § interpolation.md: ROOT_DIR отсутствует в таблице канонических и динамических переменных
    it("НЕ содержит переменную ROOT_DIR", () => {
      const adapter = makeAdapter("claude", {
        skills: ".claude/skills",
        agents: ".claude/agents",
        docs: ".claude/docs",
        schemas: ".claude/schemas",
      });

      const result = buildVariables(adapter, [adapter], PROJECT_ROOT);

      expect(result).not.toHaveProperty("ROOT_DIR");
    });

    // --- Удаление {PREFIX}_DIR: buildVariables НЕ содержит {PREFIX}_DIR ---
    // § interpolation.md: per-adapter переменные — только {PREFIX}_SKILLS_DIR, {PREFIX}_AGENTS_DIR,
    // {PREFIX}_DOCS_DIR, {PREFIX}_SCHEMAS_DIR. Переменная {PREFIX}_DIR отсутствует.
    it("НЕ содержит переменные {PREFIX}_DIR для адаптеров с непустым paths", () => {
      const claude = makeAdapter("claude", {
        skills: ".claude/skills",
        agents: ".claude/agents",
      });
      const opencode = makeAdapter("opencode", {
        skills: ".opencode/skills",
      });

      const result = buildVariables(claude, [claude, opencode], PROJECT_ROOT);

      expect(result).not.toHaveProperty("CLAUDE_DIR");
      expect(result).not.toHaveProperty("OPENCODE_DIR");
      // Но {PREFIX}_SKILLS_DIR и {PREFIX}_AGENTS_DIR должны присутствовать
      expect(result["CLAUDE_SKILLS_DIR"]).toBe(".claude/skills");
      expect(result["CLAUDE_AGENTS_DIR"]).toBe(".claude/agents");
      expect(result["OPENCODE_SKILLS_DIR"]).toBe(".opencode/skills");
    });

    // --- Трансформация: шаг 4 — динамическая переменная присутствует, если поле paths определено ---
    // § interpolation.md: SKILLS_DIR = currentAdapter.paths.skills, и т.д.
    it("добавляет динамическую переменную для каждого определённого поля paths текущего адаптера", () => {
      const adapter = makeAdapter("claude", {
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

    // --- Трансформация: шаг 4 — динамическая переменная НЕ присутствует, если поле paths не определено ---
    // § interpolation.md: Если поле не определено, переменная НЕ ДОЛЖНА присутствовать.
    it("не добавляет динамическую переменную, если соответствующее поле paths не определено у текущего адаптера", () => {
      const adapter = makeAdapter("agentsmd", {});

      const result = buildVariables(adapter, [adapter], PROJECT_ROOT);

      expect(result).not.toHaveProperty("SKILLS_DIR");
      expect(result).not.toHaveProperty("AGENTS_DIR");
      expect(result).not.toHaveProperty("DOCS_DIR");
      expect(result).not.toHaveProperty("SCHEMAS_DIR");
    });

    // --- Трансформация: шаг 4 — частичное определение paths ---
    // § interpolation.md: динамическая переменная ДОЛЖНА присутствовать только если поле paths определено
    it("добавляет только определённые динамические переменные при частичном определении paths", () => {
      const adapter = makeAdapter("partial", {
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

    // --- Трансформация: шаги 5–6 — per-adapter переменные генерируются для адаптеров с непустым paths ---
    // § interpolation.md: Для каждого адаптера с Object.keys(adapter.paths).length > 0 генерируются per-adapter переменные
    it("генерирует per-adapter переменные для каждого адаптера из allAdapters с непустым paths", () => {
      const current = makeAdapter("claude", {
        skills: ".claude/skills",
      });
      const opencode = makeAdapter("opencode", {
        skills: ".opencode/skills",
        agents: ".opencode/agents",
      });

      const result = buildVariables(current, [current, opencode], PROJECT_ROOT);

      // CLAUDE per-adapter (без CLAUDE_DIR)
      expect(result["CLAUDE_SKILLS_DIR"]).toBe(".claude/skills");

      // OPENCODE per-adapter (без OPENCODE_DIR)
      expect(result["OPENCODE_SKILLS_DIR"]).toBe(".opencode/skills");
      expect(result["OPENCODE_AGENTS_DIR"]).toBe(".opencode/agents");
    });

    // --- Трансформация: шаг 5 — per-adapter переменные НЕ генерируются для адаптера с пустым paths ---
    // § interpolation.md: Для адаптера с пустым объектом paths per-adapter переменные НЕ ДОЛЖНЫ генерироваться.
    it("не генерирует per-adapter переменные для адаптера с пустым объектом paths", () => {
      const current = makeAdapter("claude", {
        skills: ".claude/skills",
      });
      const agentsmd = makeAdapter("agentsmd", {});

      const result = buildVariables(current, [current, agentsmd], PROJECT_ROOT);

      // AGENTSMD per-adapter переменные НЕ должны присутствовать
      expect(result).not.toHaveProperty("AGENTSMD_DIR");
      expect(result).not.toHaveProperty("AGENTSMD_SKILLS_DIR");
      expect(result).not.toHaveProperty("AGENTSMD_AGENTS_DIR");
      expect(result).not.toHaveProperty("AGENTSMD_DOCS_DIR");
      expect(result).not.toHaveProperty("AGENTSMD_SCHEMAS_DIR");
    });

    // --- Трансформация: шаг 6 — per-adapter подпеременная генерируется только если поле paths определено ---
    // § interpolation.md: {PREFIX}_SKILLS_DIR генерируется только если adapter.paths.skills определено
    it("генерирует per-adapter подпеременную только если соответствующее поле paths определено", () => {
      const current = makeAdapter("test", {});
      const other = makeAdapter("other", {
        skills: ".other/skills",
        // agents не определено
      });

      const result = buildVariables(current, [current, other], PROJECT_ROOT);

      expect(result["OTHER_SKILLS_DIR"]).toBe(".other/skills");
      expect(result).not.toHaveProperty("OTHER_DIR");
      expect(result).not.toHaveProperty("OTHER_AGENTS_DIR");
      expect(result).not.toHaveProperty("OTHER_DOCS_DIR");
      expect(result).not.toHaveProperty("OTHER_SCHEMAS_DIR");
    });

    // --- Трансформация: шаг 5 — PREFIX = adapter.id.toUpperCase() ---
    // § interpolation.md: {PREFIX} = adapter.id.toUpperCase()
    it("использует adapter.id.toUpperCase() как PREFIX для per-adapter переменных", () => {
      const current = makeAdapter("test", {});
      const claude = makeAdapter("claude", {
        skills: ".claude/skills",
      });

      const result = buildVariables(current, [current, claude], PROJECT_ROOT);

      // PREFIX = "CLAUDE" (uppercase)
      expect(result).toHaveProperty("CLAUDE_SKILLS_DIR");
      expect(result).not.toHaveProperty("claude_SKILLS_DIR");
    });

    // --- Граничное условие: projectRoot с trailing slash ---
    it("сохраняет projectRoot как есть без нормализации trailing slash", () => {
      const adapter = makeAdapter("test", {});

      const result = buildVariables(adapter, [adapter], "/home/user/myapp/");

      // projectRoot передаётся as-is
      expect(result["PROJECT_DIR"]).toBe("/home/user/myapp/");
    });

    // --- Пример из спецификации: полная конфигурация реестра (claude, opencode, agentsmd) ---
    // § interpolation.md § Пример: CLAUDE_SKILLS_DIR → ".claude/skills" и т.д.
    it("генерирует per-adapter переменные согласно примеру из спецификации", () => {
      const claude = makeAdapter("claude", {
        skills: ".claude/skills",
        agents: ".claude/agents",
        docs: ".claude/docs",
        schemas: ".claude/schemas",
      });
      const opencode = makeAdapter("opencode", {
        skills: ".opencode/skills",
        agents: ".opencode/agents",
        docs: ".opencode/docs",
        schemas: ".opencode/schemas",
      });
      const agentsmd = makeAdapter("agentsmd", {});

      const result = buildVariables(claude, [claude, opencode, agentsmd], PROJECT_ROOT);

      // PROJECT_DIR — каноническая переменная
      expect(result["PROJECT_DIR"]).toBe(PROJECT_ROOT);

      // claude per-adapter (без CLAUDE_DIR)
      expect(result).not.toHaveProperty("CLAUDE_DIR");
      expect(result["CLAUDE_SKILLS_DIR"]).toBe(".claude/skills");
      expect(result["CLAUDE_AGENTS_DIR"]).toBe(".claude/agents");
      expect(result["CLAUDE_DOCS_DIR"]).toBe(".claude/docs");
      expect(result["CLAUDE_SCHEMAS_DIR"]).toBe(".claude/schemas");

      // opencode per-adapter (без OPENCODE_DIR)
      expect(result).not.toHaveProperty("OPENCODE_DIR");
      expect(result["OPENCODE_SKILLS_DIR"]).toBe(".opencode/skills");
      expect(result["OPENCODE_AGENTS_DIR"]).toBe(".opencode/agents");
      expect(result["OPENCODE_DOCS_DIR"]).toBe(".opencode/docs");
      expect(result["OPENCODE_SCHEMAS_DIR"]).toBe(".opencode/schemas");

      // agentsmd — пустой paths → нет per-adapter переменных
      expect(result).not.toHaveProperty("AGENTSMD_DIR");
    });
  });
});
