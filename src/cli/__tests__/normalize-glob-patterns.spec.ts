// normalize-glob-patterns.spec.ts
// Спецификация: docs/specs/format.md § Нормализация glob-паттернов

import { describe, it, expect } from "vitest";
import { normalizeGlobPatterns } from "../normalize-glob-patterns.js";

describe("normalizeGlobPatterns", () => {
  describe("Нормализация glob-паттернов", () => {
    // --- Happy path: массив паттернов без ** передаётся без изменений ---
    // Spec: "Если паттерн не соответствует ни одному из случаев —
    // он попадает в итоговый массив как есть, без дополнительного паттерна."
    it("паттерн без ** остаётся без изменений", () => {
      const result = normalizeGlobPatterns(["docs/*.md"]);
      expect(result).toEqual(["docs/*.md"]);
    });

    // --- Случай 2: паттерн содержит /**/ (не в начале) ---
    // Spec: "Паттерн содержит /**/ (не в начале) — ТРЕБУЕТСЯ добавить
    // дополнительный паттерн, в котором первое вхождение /**/ заменено на /."
    // Пример из таблицы: docs/**/*.md -> [docs/**/*.md, docs/*.md]
    it("случай 2: docs/**/*.md добавляет паттерн с первым /**/ заменённым на /", () => {
      const result = normalizeGlobPatterns(["docs/**/*.md"]);
      expect(result).toEqual(["docs/**/*.md", "docs/*.md"]);
    });

    // --- Случай 2: паттерн .agloom/**/*.{md,mdx,json,yaml,yml,toml} ---
    // Spec: пример из таблицы
    it("случай 2: .agloom/**/*.{md,mdx,json,yaml,yml,toml} добавляет нормализованный паттерн", () => {
      const result = normalizeGlobPatterns([".agloom/**/*.{md,mdx,json,yaml,yml,toml}"]);
      expect(result).toEqual([".agloom/**/*.{md,mdx,json,yaml,yml,toml}", ".agloom/*.{md,mdx,json,yaml,yml,toml}"]);
    });

    // --- Случай 1: паттерн начинается с **/ ---
    // Spec: "Паттерн начинается с **/ — ТРЕБУЕТСЯ добавить дополнительный
    // паттерн, в котором ведущий **/ удалён."
    // Пример из таблицы: **/*.md -> [**/*.md, *.md]
    it("случай 1: **/*.md добавляет паттерн без ведущего **/", () => {
      const result = normalizeGlobPatterns(["**/*.md"]);
      expect(result).toEqual(["**/*.md", "*.md"]);
    });

    // --- Случай 1: **/AGLOOM.md ---
    // Spec: пример из таблицы
    it("случай 1: **/AGLOOM.md добавляет паттерн без ведущего **/", () => {
      const result = normalizeGlobPatterns(["**/AGLOOM.md"]);
      expect(result).toEqual(["**/AGLOOM.md", "AGLOOM.md"]);
    });

    // --- Приоритет: оба случая — применяется только случай 1 ---
    // Spec: "Если паттерн соответствует обоим случаям (начинается с **/
    // и содержит ещё одно /**/ далее), применяется только случай 1
    // (удаление ведущего **/)."
    it("при совпадении обоих случаев применяется только случай 1", () => {
      const result = normalizeGlobPatterns(["**/src/**/*.ts"]);
      expect(result).toEqual(["**/src/**/*.ts", "src/**/*.ts"]);
    });

    // --- Несколько паттернов: дефолтные ---
    // Spec: "Нормализация ДОЛЖНА применяться ко всем glob-паттернам
    // независимо от источника: дефолтные..."
    // Spec: § Целевые файлы по умолчанию: [".agloom/**/*.{md,mdx,json,yaml,yml,toml}", "**/AGLOOM.md"]
    it("нормализует массив дефолтных паттернов", () => {
      const result = normalizeGlobPatterns([".agloom/**/*.{md,mdx,json,yaml,yml,toml}", "**/AGLOOM.md"]);
      expect(result).toEqual([
        ".agloom/**/*.{md,mdx,json,yaml,yml,toml}",
        ".agloom/*.{md,mdx,json,yaml,yml,toml}",
        "**/AGLOOM.md",
        "AGLOOM.md",
      ]);
    });

    // --- Граничное условие: пустой массив ---
    // Граничное условие: normalizeGlobPatterns([]) должен вернуть []
    it("пустой массив возвращается без изменений", () => {
      const result = normalizeGlobPatterns([]);
      expect(result).toEqual([]);
    });

    // --- Граничное условие: паттерн из одного ** без слеша ---
    // Граничное условие: паттерн "**" не начинается с **/ и не содержит /**/
    it("паттерн ** без слеша остаётся без изменений", () => {
      const result = normalizeGlobPatterns(["**"]);
      expect(result).toEqual(["**"]);
    });

    // --- Граничное условие: несколько /**/ в паттерне (случай 2) ---
    // Spec: "добавить дополнительный паттерн, в котором первое вхождение
    // /**/ заменено на /"
    it("случай 2: при нескольких /**/ заменяется только первое вхождение", () => {
      const result = normalizeGlobPatterns(["src/**/lib/**/*.ts"]);
      expect(result).toEqual(["src/**/lib/**/*.ts", "src/lib/**/*.ts"]);
    });

    // --- Граничное условие: исходный паттерн остаётся в массиве ---
    // Spec: "Исходный паттерн ДОЛЖЕН остаться в массиве без изменений."
    it("исходный паттерн всегда остаётся первым в результате", () => {
      const result = normalizeGlobPatterns(["docs/**/*.md"]);
      expect(result[0]).toBe("docs/**/*.md");
    });

    // --- Граничное условие: простой путь к файлу ---
    it("простой путь к файлу без glob остаётся без изменений", () => {
      const result = normalizeGlobPatterns(["README.md"]);
      expect(result).toEqual(["README.md"]);
    });

    // --- Смешанный массив: паттерны разных случаев ---
    // Spec: нормализация применяется ко всем паттернам в массиве
    it("корректно обрабатывает смешанный массив паттернов разных случаев", () => {
      const result = normalizeGlobPatterns(["docs/**/*.md", "**/*.yaml", "src/*.ts"]);
      expect(result).toEqual(["docs/**/*.md", "docs/*.md", "**/*.yaml", "*.yaml", "src/*.ts"]);
    });

    // --- --all паттерн ---
    // Spec: § Команда format, шаг 3: --all -> ["**/*.{md,mdx,json,yaml,yml,toml}"]
    // Случай 1: начинается с **/
    it("нормализует паттерн --all", () => {
      const result = normalizeGlobPatterns(["**/*.{md,mdx,json,yaml,yml,toml}"]);
      expect(result).toEqual(["**/*.{md,mdx,json,yaml,yml,toml}", "*.{md,mdx,json,yaml,yml,toml}"]);
    });
  });
});
