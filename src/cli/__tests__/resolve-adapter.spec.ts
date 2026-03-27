// resolve-adapter.spec.ts
// Спецификация: docs/specs/adapter-registry-ext.md § Процедура Resolve Adapter

import { describe, it, expect } from "vitest";
import { resolveAdapter } from "../resolve-adapter.js";

describe("CLI", () => {
  describe("Процедура Resolve Adapter", () => {
    // --- Happy path: шаги 1–2 ---
    // Шаг 1: Найти запись в реестре адаптеров с id, совпадающим со значением adapterId.
    // Шаг 2: Определить projectRoot как текущий рабочий каталог процесса (process.cwd()).
    it("возвращает запись адаптера из реестра и projectRoot равный process.cwd() при валидном adapterId", () => {
      const result = resolveAdapter("claude");

      expect(result.entry).toBeDefined();
      expect(result.entry.id).toBe("claude");
      expect(result.projectRoot).toBe(process.cwd());
    });

    // --- Расширение 1a: запись не найдена ---
    // 1a. Запись не найдена → отобразить сообщение
    // "Unknown agent: {value}. Run 'agloom adapters' to see available adapters.";
    // exit code 1.
    // § adapter-registry-ext.md § Процедура Resolve Adapter § Расширения 1a
    it('выбрасывает ошибку с сообщением "Unknown agent: {value}..." при несуществующем adapterId', () => {
      expect(() => resolveAdapter("nonexistent")).toThrow(
        "Unknown agent: nonexistent. Run 'agloom adapters' to see available adapters.",
      );
    });

    // --- Happy path: resolveAdapter для agentsmd ---
    // § adapter-registry-ext.md § Процедура Resolve Adapter шаг 1:
    // Найти запись в реестре адаптеров с id=agentsmd.
    it('возвращает запись адаптера "agentsmd" из реестра при валидном agentId', () => {
      const result = resolveAdapter("agentsmd");

      expect(result.entry).toBeDefined();
      expect(result.entry.id).toBe("agentsmd");
      expect(result.projectRoot).toBe(process.cwd());
    });
  });
});
