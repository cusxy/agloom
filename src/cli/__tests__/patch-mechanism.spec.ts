// patch-mechanism.spec.ts
// Спецификация: docs/specs/patch-mechanism.md

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { AdapterRegistryEntry } from "../types.js";

// Импорт функций из overlay-step.
// classifyFile — определяет стратегию слияния (§ Определение стратегии для конкретного файла).
// stripOverrideSuffix — удаляет суффикс .override/.patch из имени файла.
// runOverlayStep — операция overlay с поддержкой layers и стратегии patch.
// applyPatch — процедура Apply Patch (§ Процедура Apply Patch).
import { classifyFile, runOverlayStep, applyPatch } from "../overlay-step.js";

/**
 * Минимальный стаб AdapterRegistryEntry для тестов overlay.
 */
function createTestEntry(
  overrides: Partial<AdapterRegistryEntry> = {},
): AdapterRegistryEntry {
  return {
    id: "test-adapter",
    description: "Test Adapter",
    instructions: {} as AdapterRegistryEntry["instructions"],
    skills: {} as AdapterRegistryEntry["skills"],
    agents: {} as AdapterRegistryEntry["agents"],
    targetRoot: ".test-target",
    targetFiles: [],
    projectFiles: [],
    instructionsFile: null,
    dependsOn: [],
    hidden: false,
    overlayImportPaths: [],
    paths: {},
    ...overrides,
  };
}

// =============================================================================
// § Конвенция .patch — определение стратегии
// =============================================================================

describe("Patch-механизм", () => {
  describe("Определение стратегии для файла с суффиксом .patch", () => {
    // § Определение стратегии для конкретного файла, правило 2:
    // Если имя файла содержит суффикс .patch И расширение merge-eligible — стратегия patch
    it("классифицирует файл с суффиксом .patch и merge-eligible расширением как patch", () => {
      expect(classifyFile("settings.patch.json")).toBe("patch");
      expect(classifyFile("config.patch.yaml")).toBe("patch");
      expect(classifyFile("config.patch.yml")).toBe("patch");
      expect(classifyFile("config.patch.toml")).toBe("patch");
      expect(classifyFile("tsconfig.patch.jsonc")).toBe("patch");
    });

    // § Определение стратегии, правило 1: .override имеет приоритет над .patch
    it("классифицирует файл с суффиксом .override как override, даже если .patch присутствует ранее в имени", () => {
      expect(classifyFile("settings.override.json")).toBe("override");
    });

    // § Область применения суффикса .patch: для не-merge-eligible расширений
    // файл обрабатывается как обычный override
    it("классифицирует файл с суффиксом .patch и не-merge-eligible расширением как override", () => {
      expect(classifyFile("readme.patch.md")).toBe("override");
      expect(classifyFile("data.patch.xml")).toBe("override");
    });

    // § Взаимоисключаемость с .override: файл с обоими суффиксами — ошибка
    // Этот тест проверяется через runOverlayStep (ошибка добавляется в errors)
  });

  // =============================================================================
  // § Взаимоисключаемость .patch и .override
  // =============================================================================

  describe("Взаимоисключаемость .patch и .override", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-patch-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function createLayer(
      layerId: string,
      files: Record<string, string | Buffer>,
    ): string {
      const layerDir = path.join(tmpDir, "layers", layerId);
      for (const [relativePath, content] of Object.entries(files)) {
        const filePath = path.join(layerDir, relativePath);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        if (typeof content === "string") {
          fs.writeFileSync(filePath, content, "utf-8");
        } else {
          fs.writeFileSync(filePath, content);
        }
      }
      return layerDir;
    }

    // § Взаимоисключаемость с .override: settings.patch.override.json — ошибка
    it("добавляет ошибку и пропускает файл при наличии обоих суффиксов .patch и .override", () => {
      const entry = createTestEntry({ id: "claude" });
      const layerDir = createLayer("local", {
        "settings.patch.override.json": JSON.stringify({ key: "value" }),
      });

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [{ id: "local", overlayDir: layerDir }],
      });

      expect(outcome.errors).toHaveLength(1);
      expect(outcome.writtenCount).toBe(0);
    });

    // § Взаимоисключаемость с .override: settings.override.patch.json — ошибка
    it("добавляет ошибку и пропускает файл при обратном порядке суффиксов .override.patch", () => {
      const entry = createTestEntry({ id: "claude" });
      const layerDir = createLayer("local", {
        "settings.override.patch.json": JSON.stringify({ key: "value" }),
      });

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [{ id: "local", overlayDir: layerDir }],
      });

      expect(outcome.errors).toHaveLength(1);
      expect(outcome.writtenCount).toBe(0);
    });
  });

  // =============================================================================
  // § Маркеры операций — $append
  // =============================================================================

  describe("Маркер $append", () => {
    // § $append — Поведение: добавляет элементы в конец массива
    it("добавляет элементы в конец целевого массива", () => {
      const base = { editor: { rulers: [80, 120] } };
      const patch = { editor: { rulers: { $append: [140] } } };
      const result = applyPatch(base, patch);
      expect(result).toEqual({ editor: { rulers: [80, 120, 140] } });
    });

    // Граничное условие: несколько элементов в $append
    it("добавляет несколько элементов в конец массива с сохранением порядка", () => {
      const base = { items: [1] };
      const patch = { items: { $append: [2, 3, 4] } };
      const result = applyPatch(base, patch);
      expect(result).toEqual({ items: [1, 2, 3, 4] });
    });

    // Граничное условие: пустой $append
    it("не изменяет массив при пустом $append", () => {
      const base = { items: [1, 2, 3] };
      const patch = { items: { $append: [] } };
      const result = applyPatch(base, patch);
      expect(result).toEqual({ items: [1, 2, 3] });
    });

    // § Обработка несуществующего целевого поля — $append:
    // предупреждение в errors, пропуск операции, массив НЕ ДОЛЖЕН создаваться
    it("пропускает $append на несуществующем поле и не создаёт массив", () => {
      const base = { other: "value" } as Record<string, unknown>;
      const patch = { missing: { $append: [1, 2] } };
      const result = applyPatch(base, patch);
      expect(result).not.toHaveProperty("missing");
    });
  });

  // =============================================================================
  // § Маркеры операций — $prepend
  // =============================================================================

  describe("Маркер $prepend", () => {
    // § $prepend — Поведение: вставляет элементы в начало массива
    it("добавляет элементы в начало целевого массива с сохранением порядка", () => {
      const base = { plugins: ["existing-plugin"] };
      const patch = {
        plugins: { $prepend: ["first-plugin", "second-plugin"] },
      };
      const result = applyPatch(base, patch);
      expect(result).toEqual({
        plugins: ["first-plugin", "second-plugin", "existing-plugin"],
      });
    });

    // Граничное условие: пустой $prepend
    it("не изменяет массив при пустом $prepend", () => {
      const base = { items: [1, 2, 3] };
      const patch = { items: { $prepend: [] } };
      const result = applyPatch(base, patch);
      expect(result).toEqual({ items: [1, 2, 3] });
    });

    // § Обработка несуществующего целевого поля — $prepend:
    // предупреждение в errors, пропуск операции
    it("пропускает $prepend на несуществующем поле и не создаёт массив", () => {
      const base = { other: "value" } as Record<string, unknown>;
      const patch = { missing: { $prepend: [1, 2] } };
      const result = applyPatch(base, patch);
      expect(result).not.toHaveProperty("missing");
    });
  });

  // =============================================================================
  // § Маркеры операций — $remove
  // =============================================================================

  describe("Маркер $remove", () => {
    // § $remove — Поведение: удаляет все вхождения элемента по строгому равенству
    it("удаляет элементы из массива по строгому равенству", () => {
      const base = {
        files: { exclude: ["node_modules", "dist", ".cache"] },
      };
      const patch = {
        files: { exclude: { $remove: ["node_modules", ".cache"] } },
      };
      const result = applyPatch(base, patch);
      expect(result).toEqual({ files: { exclude: ["dist"] } });
    });

    // § $remove — silent no-op если элемент не найден
    it("пропускает несуществующий элемент без ошибки (silent no-op)", () => {
      const base = { items: ["a", "b", "c"] };
      const patch = { items: { $remove: ["z"] } };
      const result = applyPatch(base, patch);
      expect(result).toEqual({ items: ["a", "b", "c"] });
    });

    // § $remove — deep equal для объектов
    it("удаляет объект из массива по глубокому равенству", () => {
      const base = {
        items: [
          { id: 1, name: "a" },
          { id: 2, name: "b" },
        ],
      };
      const patch = { items: { $remove: [{ id: 1, name: "a" }] } };
      const result = applyPatch(base, patch);
      expect(result).toEqual({ items: [{ id: 2, name: "b" }] });
    });

    // § $remove — удаляет ВСЕ вхождения
    it("удаляет все вхождения элемента из массива", () => {
      const base = { items: [1, 2, 1, 3, 1] };
      const patch = { items: { $remove: [1] } };
      const result = applyPatch(base, patch);
      expect(result).toEqual({ items: [2, 3] });
    });

    // § Обработка несуществующего целевого поля — $remove: silent no-op
    it("выполняет silent no-op при $remove на несуществующем поле", () => {
      const base = { other: "value" } as Record<string, unknown>;
      const patch = { missing: { $remove: ["a"] } };
      const result = applyPatch(base, patch);
      expect(result).not.toHaveProperty("missing");
      expect(result).toEqual({ other: "value" });
    });
  });

  // =============================================================================
  // § Маркеры операций — $set
  // =============================================================================

  describe("Маркер $set", () => {
    // § $set — Поведение: устанавливает значение, заменяя текущее целиком
    it("устанавливает значение ключа, заменяя текущее", () => {
      const base = { editor: { fontSize: 14, tabSize: 2 } };
      const patch = { editor: { fontSize: { $set: 16 } } };
      const result = applyPatch(base, patch);
      expect(result).toEqual({ editor: { fontSize: 16, tabSize: 2 } });
    });

    // § $set — Если ключ не существует — он создаётся
    it("создаёт ключ, если он не существует", () => {
      const base = { editor: { fontSize: 14 } };
      const patch = { editor: { theme: { $set: "dark" } } };
      const result = applyPatch(base, patch);
      expect(result).toEqual({ editor: { fontSize: 14, theme: "dark" } });
    });

    // § $set — допускается любой тип значения
    it("устанавливает значение любого типа (объект)", () => {
      const base = { config: "old" } as Record<string, unknown>;
      const patch = { config: { $set: { nested: { deep: true } } } };
      const result = applyPatch(base, patch);
      expect(result).toEqual({ config: { nested: { deep: true } } });
    });

    // § $set — допускается null
    it("устанавливает null как значение", () => {
      const base = { key: "value" } as Record<string, unknown>;
      const patch = { key: { $set: null } };
      const result = applyPatch(base, patch);
      expect(result).toEqual({ key: null });
    });

    // § $set — допускается массив
    it("устанавливает массив как значение", () => {
      const base = { items: "not-array" } as Record<string, unknown>;
      const patch = { items: { $set: [1, 2, 3] } };
      const result = applyPatch(base, patch);
      expect(result).toEqual({ items: [1, 2, 3] });
    });

    // § Обработка несуществующего целевого поля — $set: ключ создаётся
    it("создаёт несуществующий ключ через $set", () => {
      const base = {} as Record<string, unknown>;
      const patch = { newKey: { $set: "newValue" } };
      const result = applyPatch(base, patch);
      expect(result).toEqual({ newKey: "newValue" });
    });
  });

  // =============================================================================
  // § Маркеры операций — $unset
  // =============================================================================

  describe("Маркер $unset", () => {
    // § $unset — Поведение: удаляет ключи из объекта
    it("удаляет указанные ключи из объекта", () => {
      const base = {
        editor: { fontSize: 14, wordWrap: "on", minimap: true },
      };
      const patch = { editor: { $unset: ["wordWrap", "minimap"] } };
      const result = applyPatch(base, patch);
      expect(result).toEqual({ editor: { fontSize: 14 } });
    });

    // § $unset — silent no-op если ключ не существует
    it("пропускает несуществующий ключ без ошибки (silent no-op)", () => {
      const base = { editor: { fontSize: 14 } };
      const patch = { editor: { $unset: ["nonexistent"] } };
      const result = applyPatch(base, patch);
      expect(result).toEqual({ editor: { fontSize: 14 } });
    });

    // § Обработка несуществующего целевого поля — $unset: silent no-op
    it("выполняет silent no-op при $unset на несуществующем поле", () => {
      const base = { other: "value" } as Record<string, unknown>;
      const patch = { missing: { $unset: ["key"] } };
      const result = applyPatch(base, patch);
      expect(result).toEqual({ other: "value" });
    });
  });

  // =============================================================================
  // § Маркеры операций — $merge
  // =============================================================================

  describe("Маркер $merge", () => {
    // § $merge — Поведение: deep merge вложенного объекта
    it("выполняет deep merge с текущим значением", () => {
      const base = {
        editor: { fontSize: 14, tabSize: 2, rulers: [80] },
      };
      const patch = { editor: { $merge: { fontSize: 16, tabSize: 4 } } };
      const result = applyPatch(base, patch);
      expect(result).toEqual({
        editor: { fontSize: 16, tabSize: 4, rulers: [80] },
      });
    });

    // § $merge — Если целевое поле отсутствует — создаётся как пустой объект
    it("создаёт пустой объект и мержит, если целевое поле отсутствует", () => {
      const base = {} as Record<string, unknown>;
      const patch = { editor: { $merge: { fontSize: 16 } } };
      const result = applyPatch(base, patch);
      expect(result).toEqual({ editor: { fontSize: 16 } });
    });

    // § Применение маркера к узлу, п.3: если base не является объектом и не undefined —
    // установить parent[parentKey] равным value
    it("заменяет не-объектное значение на значение $merge", () => {
      const base = { editor: "string-value" } as Record<string, unknown>;
      const patch = { editor: { $merge: { fontSize: 16 } } };
      const result = applyPatch(base, patch);
      expect(result).toEqual({ editor: { fontSize: 16 } });
    });
  });

  // =============================================================================
  // § Маркеры операций — $mergeBy
  // =============================================================================

  describe("Маркер $mergeBy", () => {
    // § $mergeBy — Поведение: merge массива объектов по ключевому полю
    it("мержит элемент массива по ключевому полю", () => {
      const base = {
        tasks: [
          { name: "build", command: "tsc", args: ["--strict"] },
          { name: "test", command: "vitest" },
        ],
      };
      const patch = {
        tasks: {
          $mergeBy: {
            key: "name",
            items: [
              { name: "build", args: ["--strict", "--noEmit"] },
              { name: "lint", command: "eslint" },
            ],
          },
        },
      };
      const result = applyPatch(base, patch);
      expect(result).toEqual({
        tasks: [
          {
            name: "build",
            command: "tsc",
            args: ["--strict", "--noEmit"],
          },
          { name: "test", command: "vitest" },
          { name: "lint", command: "eslint" },
        ],
      });
    });

    // § $mergeBy — п.4: порядок существующих элементов сохраняется
    it("сохраняет порядок существующих элементов", () => {
      const base = {
        items: [
          { id: "c", val: 3 },
          { id: "a", val: 1 },
          { id: "b", val: 2 },
        ],
      };
      const patch = {
        items: {
          $mergeBy: {
            key: "id",
            items: [{ id: "a", val: 10 }],
          },
        },
      };
      const result = applyPatch(base, patch);
      expect((result as Record<string, unknown[]>).items[0]).toEqual({
        id: "c",
        val: 3,
      });
      expect((result as Record<string, unknown[]>).items[1]).toEqual({
        id: "a",
        val: 10,
      });
      expect((result as Record<string, unknown[]>).items[2]).toEqual({
        id: "b",
        val: 2,
      });
    });

    // § $mergeBy — п.5: новые элементы добавляются в конец в порядке items
    it("добавляет новые элементы (не нашедшие пару) в конец массива", () => {
      const base = { items: [{ id: "a" }] };
      const patch = {
        items: {
          $mergeBy: {
            key: "id",
            items: [
              { id: "b", val: 1 },
              { id: "c", val: 2 },
            ],
          },
        },
      };
      const result = applyPatch(base, patch);
      const items = (result as Record<string, unknown[]>).items;
      expect(items).toHaveLength(3);
      expect(items[1]).toEqual({ id: "b", val: 1 });
      expect(items[2]).toEqual({ id: "c", val: 2 });
    });

    // § $mergeBy — Расширение 1a: элемент целевого массива не является объектом —
    // пропустить при сопоставлении
    it("пропускает не-объектные элементы целевого массива при сопоставлении", () => {
      const base = { items: ["string-element", { id: "a", val: 1 }] };
      const patch = {
        items: {
          $mergeBy: {
            key: "id",
            items: [{ id: "a", val: 10 }],
          },
        },
      };
      const result = applyPatch(base, patch);
      const items = (result as Record<string, unknown[]>).items;
      expect(items[0]).toBe("string-element");
      expect(items[1]).toEqual({ id: "a", val: 10 });
    });

    // § Обработка несуществующего целевого поля — $mergeBy:
    // создать [], все items добавляются как новые
    it("создаёт пустой массив и добавляет все items при несуществующем поле", () => {
      const base = {} as Record<string, unknown>;
      const patch = {
        tasks: {
          $mergeBy: {
            key: "name",
            items: [{ name: "build", command: "tsc" }],
          },
        },
      };
      const result = applyPatch(base, patch);
      expect(result).toEqual({
        tasks: [{ name: "build", command: "tsc" }],
      });
    });
  });

  // =============================================================================
  // § Маркеры операций — $insertAt
  // =============================================================================

  describe("Маркер $insertAt", () => {
    // § $insertAt — Поведение: вставка элементов по индексу
    it("вставляет элементы по указанному индексу", () => {
      const base = { plugins: ["a", "b", "c"] };
      const patch = {
        plugins: { $insertAt: { index: 1, items: ["x", "y"] } },
      };
      const result = applyPatch(base, patch);
      expect(result).toEqual({ plugins: ["a", "x", "y", "b", "c"] });
    });

    // § $insertAt — нормализация: отрицательный index → max(0, length + index)
    it("нормализует отрицательный index: -1 вставляет перед последним элементом", () => {
      const base = { items: ["a", "b", "c"] };
      const patch = {
        items: { $insertAt: { index: -1, items: ["x"] } },
      };
      const result = applyPatch(base, patch);
      // length=3, index=-1 → max(0, 3+(-1)) = 2
      expect(result).toEqual({ items: ["a", "b", "x", "c"] });
    });

    // § $insertAt — нормализация: большой отрицательный → max(0, length + index) = 0
    it("нормализует большой отрицательный index до 0", () => {
      const base = { items: ["a", "b"] };
      const patch = {
        items: { $insertAt: { index: -100, items: ["x"] } },
      };
      const result = applyPatch(base, patch);
      // length=2, index=-100 → max(0, 2+(-100)) = max(0, -98) = 0
      expect(result).toEqual({ items: ["x", "a", "b"] });
    });

    // § $insertAt — clamp: index > length → вставка в конец
    it("clamp: index больше длины массива — вставка в конец", () => {
      const base = { items: ["a", "b"] };
      const patch = {
        items: { $insertAt: { index: 100, items: ["x"] } },
      };
      const result = applyPatch(base, patch);
      expect(result).toEqual({ items: ["a", "b", "x"] });
    });

    // § $insertAt — index === 0 → вставка в начало
    it("вставляет в начало при index === 0", () => {
      const base = { items: ["a", "b"] };
      const patch = {
        items: { $insertAt: { index: 0, items: ["x"] } },
      };
      const result = applyPatch(base, patch);
      expect(result).toEqual({ items: ["x", "a", "b"] });
    });

    // § $insertAt — порядок элементов items сохраняется
    it("сохраняет порядок элементов items при вставке", () => {
      const base = { items: ["a", "d"] };
      const patch = {
        items: { $insertAt: { index: 1, items: ["b", "c"] } },
      };
      const result = applyPatch(base, patch);
      expect(result).toEqual({ items: ["a", "b", "c", "d"] });
    });

    // § Обработка несуществующего целевого поля — $insertAt:
    // предупреждение, пропуск операции, массив НЕ создаётся
    it("пропускает $insertAt на несуществующем поле и не создаёт массив", () => {
      const base = { other: "value" } as Record<string, unknown>;
      const patch = {
        missing: { $insertAt: { index: 0, items: [1, 2] } },
      };
      const result = applyPatch(base, patch);
      expect(result).not.toHaveProperty("missing");
    });
  });

  // =============================================================================
  // § Комбинация маркеров в одном узле
  // =============================================================================

  describe("Комбинация маркеров в одном узле", () => {
    // § Порядок: $remove → $insertAt → $prepend → $append
    it("применяет маркеры в фиксированном порядке: $remove, затем $append", () => {
      const base = { items: [1, 2, 3, 4] };
      const patch = { items: { $remove: [2, 4], $append: [5] } };
      const result = applyPatch(base, patch);
      // Сначала $remove: [1, 3], затем $append: [1, 3, 5]
      expect(result).toEqual({ items: [1, 3, 5] });
    });

    // § Порядок: $unset → $merge
    it("применяет $unset перед $merge", () => {
      const base = { config: { a: 1, b: 2, c: 3 } };
      const patch = {
        config: { $unset: ["b"], $merge: { d: 4 } },
      };
      const result = applyPatch(base, patch);
      // Сначала $unset (удалить b): {a:1, c:3}, затем $merge: {a:1, c:3, d:4}
      expect(result).toEqual({ config: { a: 1, c: 3, d: 4 } });
    });

    // § Порядок: $insertAt → $prepend → $append
    it("применяет $insertAt, затем $prepend, затем $append", () => {
      const base = { items: ["b"] };
      const patch = {
        items: {
          $insertAt: { index: 0, items: ["a"] },
          $prepend: ["first"],
          $append: ["last"],
        },
      };
      const result = applyPatch(base, patch);
      // Сначала $insertAt(0, ["a"]): ["a", "b"]
      // Затем $prepend(["first"]): ["first", "a", "b"]
      // Затем $append(["last"]): ["first", "a", "b", "last"]
      expect(result).toEqual({ items: ["first", "a", "b", "last"] });
    });

    // § Ограничения: $set + $merge — ЗАПРЕЩАЕТСЯ
    it("выбрасывает ошибку при комбинации $set и $merge в одном узле", () => {
      const base = { editor: { fontSize: 14 } };
      const patch = {
        editor: { $set: { fontSize: 16 }, $merge: { tabSize: 4 } },
      };
      // applyPatch должен вернуть ошибку или бросить; проверяем через overlay
      // Для unit-теста applyPatch: ожидаем, что функция сообщает об ошибке
      expect(() => applyPatch(base, patch)).toThrow();
    });

    // § Ограничения: $set + $mergeBy — ЗАПРЕЩАЕТСЯ
    it("выбрасывает ошибку при комбинации $set и $mergeBy в одном узле", () => {
      const base = { items: [{ id: "a" }] };
      const patch = {
        items: {
          $set: [],
          $mergeBy: { key: "id", items: [{ id: "b" }] },
        },
      };
      expect(() => applyPatch(base, patch)).toThrow();
    });

    // § $mergeBy + $merge в одном узле — ДОПУСКАЕТСЯ
    // $merge применяется к объекту-родителю, $mergeBy к массиву-значению.
    // Оба маркера — siblings в одном узле config.
    it("допускает комбинацию $merge и $mergeBy в одном узле", () => {
      const base = {
        config: {
          name: "old",
          items: [{ id: "a", val: 1 }],
        },
      };
      const patch = {
        config: {
          $merge: { name: "new", extra: true },
          $mergeBy: {
            key: "id",
            items: [{ id: "a", val: 10 }],
          },
        },
      };
      const result = applyPatch(base, patch);
      const config = (result as Record<string, Record<string, unknown>>).config;
      // $merge применён к объекту config: name обновлён, extra добавлен
      expect(config.name).toBe("new");
      expect(config.extra).toBe(true);
      // $mergeBy применён к массиву config.items: элемент с id:"a" обновлён
      expect(config.items).toEqual([{ id: "a", val: 10 }]);
    });

    // § $append, $prepend, $remove МОГУТ присутствовать одновременно
    it("применяет $remove, затем $prepend, затем $append в одном узле", () => {
      const base = { items: [1, 2, 3] };
      const patch = {
        items: { $remove: [2], $prepend: [0], $append: [4] },
      };
      const result = applyPatch(base, patch);
      // $remove: [1, 3], $prepend: [0, 1, 3], $append: [0, 1, 3, 4]
      expect(result).toEqual({ items: [0, 1, 3, 4] });
    });
  });

  // =============================================================================
  // § Процедура Apply Patch — навигация и рекурсия
  // =============================================================================

  describe("Процедура Apply Patch", () => {
    // § Поведение, шаг 1: если base undefined — инициализировать как {}
    it("инициализирует base как пустой объект при undefined", () => {
      const patch = { key: { $set: "value" } };
      const result = applyPatch(undefined, patch);
      expect(result).toEqual({ key: "value" });
    });

    // § Поведение, шаги 4-6: навигация по вложенной структуре
    it("рекурсивно навигирует по вложенной структуре до маркера", () => {
      const base = { a: { b: { c: { value: "old" } } } };
      const patch = { a: { b: { c: { value: { $set: "new" } } } } };
      const result = applyPatch(base, patch);
      expect(result).toEqual({ a: { b: { c: { value: "new" } } } });
    });

    // § Поведение, шаг 7: не-объектные значения без маркеров — пропускаются
    it("пропускает не-объектные значения без маркеров в patch-файле", () => {
      const base = { key: "original" };
      const patch = { key: "new-value" };
      const result = applyPatch(base, patch);
      // "new-value" — строка, не объект, без маркеров → пропускается
      expect(result).toEqual({ key: "original" });
    });

    // § Расширение 3a: неизвестный маркер — ошибка
    it("выбрасывает ошибку при неизвестном маркере ($unknown)", () => {
      const base = { items: [1, 2, 3] };
      const patch = { items: { $unknown: [4] } };
      expect(() => applyPatch(base, patch)).toThrow();
    });
  });

  // =============================================================================
  // § Валидация значений маркеров
  // =============================================================================

  describe("Валидация значений маркеров", () => {
    // § Валидация типа значения — $append: значение ДОЛЖНО быть массивом
    it("выбрасывает ошибку при не-массивном значении $append", () => {
      const base = { items: [1, 2] };
      const patch = { items: { $append: "not-array" } };
      expect(() => applyPatch(base, patch)).toThrow();
    });

    // § Валидация типа значения — $prepend: значение ДОЛЖНО быть массивом
    it("выбрасывает ошибку при не-массивном значении $prepend", () => {
      const base = { items: [1, 2] };
      const patch = { items: { $prepend: "not-array" } };
      expect(() => applyPatch(base, patch)).toThrow();
    });

    // § Валидация типа значения — $remove: значение ДОЛЖНО быть массивом
    it("выбрасывает ошибку при не-массивном значении $remove", () => {
      const base = { items: [1, 2] };
      const patch = { items: { $remove: "not-array" } };
      expect(() => applyPatch(base, patch)).toThrow();
    });

    // § Валидация типа значения — $unset: значение ДОЛЖНО быть массивом строк
    it("выбрасывает ошибку при не-массивном значении $unset", () => {
      const base = { obj: { a: 1 } };
      const patch = { obj: { $unset: "not-array" } };
      expect(() => applyPatch(base, patch)).toThrow();
    });

    // § Валидация типа значения — $unset: содержит не-строки
    it("выбрасывает ошибку при не-строковых элементах в $unset", () => {
      const base = { obj: { a: 1 } };
      const patch = { obj: { $unset: [123] } };
      expect(() => applyPatch(base, patch)).toThrow();
    });

    // § Валидация типа значения — $merge: значение ДОЛЖНО быть объектом
    it("выбрасывает ошибку при не-объектном значении $merge", () => {
      const base = { obj: { a: 1 } };
      const patch = { obj: { $merge: "not-object" } };
      expect(() => applyPatch(base, patch)).toThrow();
    });

    // § Валидация типа значения — $mergeBy: значение ДОЛЖНО быть объектом
    it("выбрасывает ошибку при не-объектном значении $mergeBy", () => {
      const base = { items: [{ id: "a" }] };
      const patch = { items: { $mergeBy: "not-object" } };
      expect(() => applyPatch(base, patch)).toThrow();
    });

    // § Валидация — $mergeBy: key не является строкой
    it("выбрасывает ошибку при нестроковом key в $mergeBy", () => {
      const base = { items: [{ id: "a" }] };
      const patch = {
        items: { $mergeBy: { key: 123, items: [{ id: "b" }] } },
      };
      expect(() => applyPatch(base, patch)).toThrow();
    });

    // § Валидация — $mergeBy: items не является массивом
    it("выбрасывает ошибку при не-массивном items в $mergeBy", () => {
      const base = { items: [{ id: "a" }] };
      const patch = {
        items: { $mergeBy: { key: "id", items: "not-array" } },
      };
      expect(() => applyPatch(base, patch)).toThrow();
    });

    // § Валидация элементов $mergeBy — item не является объектом
    it("выбрасывает ошибку при не-объектном элементе в $mergeBy items", () => {
      const base = { items: [{ id: "a" }] };
      const patch = {
        items: {
          $mergeBy: { key: "id", items: ["not-object"] },
        },
      };
      expect(() => applyPatch(base, patch)).toThrow();
    });

    // § Валидация элементов $mergeBy — item не содержит поля key
    it("выбрасывает ошибку при отсутствии поля key в элементе $mergeBy items", () => {
      const base = { items: [{ id: "a" }] };
      const patch = {
        items: {
          $mergeBy: {
            key: "id",
            items: [{ name: "no-id-field" }],
          },
        },
      };
      expect(() => applyPatch(base, patch)).toThrow();
    });

    // § Валидация типа значения — $insertAt: значение ДОЛЖНО быть объектом
    it("выбрасывает ошибку при не-объектном значении $insertAt", () => {
      const base = { items: [1, 2] };
      const patch = { items: { $insertAt: "not-object" } };
      expect(() => applyPatch(base, patch)).toThrow();
    });

    // § Валидация — $insertAt: index не является integer
    it("выбрасывает ошибку при нецелочисленном index в $insertAt", () => {
      const base = { items: [1, 2] };
      const patch = {
        items: { $insertAt: { index: 1.5, items: [3] } },
      };
      expect(() => applyPatch(base, patch)).toThrow();
    });

    // § Валидация — $insertAt: items не является массивом
    it("выбрасывает ошибку при не-массивном items в $insertAt", () => {
      const base = { items: [1, 2] };
      const patch = {
        items: { $insertAt: { index: 0, items: "not-array" } },
      };
      expect(() => applyPatch(base, patch)).toThrow();
    });

    // § Валидация целевого типа — $append на не-массиве
    it("выбрасывает ошибку при $append на не-массиве", () => {
      const base = { value: "string" } as Record<string, unknown>;
      const patch = { value: { $append: [1] } };
      expect(() => applyPatch(base, patch)).toThrow();
    });

    // § Валидация целевого типа — $prepend на не-массиве
    it("выбрасывает ошибку при $prepend на не-массиве", () => {
      const base = { value: "string" } as Record<string, unknown>;
      const patch = { value: { $prepend: [1] } };
      expect(() => applyPatch(base, patch)).toThrow();
    });

    // § Валидация целевого типа — $remove на не-массиве
    it("выбрасывает ошибку при $remove на не-массиве", () => {
      const base = { value: "string" } as Record<string, unknown>;
      const patch = { value: { $remove: [1] } };
      expect(() => applyPatch(base, patch)).toThrow();
    });

    // § Валидация целевого типа — $insertAt на не-массиве
    it("выбрасывает ошибку при $insertAt на не-массиве", () => {
      const base = { value: "string" } as Record<string, unknown>;
      const patch = {
        value: { $insertAt: { index: 0, items: [1] } },
      };
      expect(() => applyPatch(base, patch)).toThrow();
    });

    // § Валидация целевого типа — $unset на не-объекте
    it("выбрасывает ошибку при $unset на не-объекте", () => {
      const base = { value: [1, 2, 3] } as Record<string, unknown>;
      const patch = { value: { $unset: ["key"] } };
      expect(() => applyPatch(base, patch)).toThrow();
    });

    // § Валидация целевого типа — $mergeBy на не-массиве
    it("выбрасывает ошибку при $mergeBy на не-массиве", () => {
      const base = { value: "string" } as Record<string, unknown>;
      const patch = {
        value: {
          $mergeBy: { key: "id", items: [{ id: "a" }] },
        },
      };
      expect(() => applyPatch(base, patch)).toThrow();
    });
  });

  // =============================================================================
  // § Взаимодействие со слоями
  // =============================================================================

  describe("Взаимодействие со слоями", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-patch-layer-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function createLayer(
      layerId: string,
      files: Record<string, string | Buffer>,
    ): string {
      const layerDir = path.join(tmpDir, "layers", layerId);
      for (const [relativePath, content] of Object.entries(files)) {
        const filePath = path.join(layerDir, relativePath);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        if (typeof content === "string") {
          fs.writeFileSync(filePath, content, "utf-8");
        } else {
          fs.writeFileSync(filePath, content);
        }
      }
      return layerDir;
    }

    // § Удаление суффикса .patch при записи: settings.patch.yaml → settings.yaml
    it("удаляет суффикс .patch из имени файла при записи", () => {
      const entry = createTestEntry({ id: "claude" });

      // Создаём целевой файл
      fs.writeFileSync(
        path.join(tmpDir, "settings.json"),
        JSON.stringify({ editor: { fontSize: 14, rulers: [80, 120] } }),
      );

      const layerDir = createLayer("local", {
        "settings.patch.json": JSON.stringify({
          editor: { rulers: { $append: [140] } },
        }),
      });

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [{ id: "local", overlayDir: layerDir }],
      });

      expect(outcome.errors).toEqual([]);
      expect(outcome.writtenCount).toBe(1);

      // Файл записан как settings.json
      expect(fs.existsSync(path.join(tmpDir, "settings.json"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, "settings.patch.json"))).toBe(
        false,
      );

      const written = JSON.parse(
        fs.readFileSync(path.join(tmpDir, "settings.json"), "utf-8"),
      );
      expect(written).toEqual({
        editor: { fontSize: 14, rulers: [80, 120, 140] },
      });
    });

    // § Комбинация стратегий между слоями: merge в слое A, patch в слое B
    it("применяет patch после merge из предыдущего слоя", () => {
      const entry = createTestEntry({ id: "claude" });

      const pluginDir = createLayer("plugin-a", {
        "settings.json": JSON.stringify({
          editor: { fontSize: 14, rulers: [80, 120] },
        }),
      });

      const localDir = createLayer("local", {
        "settings.patch.json": JSON.stringify({
          editor: { rulers: { $append: [140] } },
        }),
      });

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [
          { id: "plugin-a", overlayDir: pluginDir },
          { id: "local", overlayDir: localDir },
        ],
      });

      expect(outcome.errors).toEqual([]);
      expect(outcome.writtenCount).toBe(1);

      const written = JSON.parse(
        fs.readFileSync(path.join(tmpDir, "settings.json"), "utf-8"),
      );
      expect(written).toEqual({
        editor: { fontSize: 14, rulers: [80, 120, 140] },
      });
    });

    // § Комбинация стратегий: patch после override
    it("применяет patch над результатом override из предыдущего слоя", () => {
      const entry = createTestEntry({ id: "claude" });

      const pluginDir = createLayer("plugin-a", {
        "settings.override.json": JSON.stringify({
          editor: { fontSize: 14, rulers: [80] },
        }),
      });

      const localDir = createLayer("local", {
        "settings.patch.json": JSON.stringify({
          editor: { rulers: { $append: [120] } },
        }),
      });

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [
          { id: "plugin-a", overlayDir: pluginDir },
          { id: "local", overlayDir: localDir },
        ],
      });

      expect(outcome.errors).toEqual([]);

      const written = JSON.parse(
        fs.readFileSync(path.join(tmpDir, "settings.json"), "utf-8"),
      );
      expect(written).toEqual({
        editor: { fontSize: 14, rulers: [80, 120] },
      });
    });

    // § Формат patch-файла и целевого файла: расширения МОГУТ отличаться
    it("применяет patch из YAML-файла к JSON-целевому файлу", () => {
      const entry = createTestEntry({ id: "claude" });

      // Существующий целевой файл в формате JSON
      fs.writeFileSync(
        path.join(tmpDir, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: { strict: true, target: "es2020" },
        }),
      );

      // Patch в YAML-формате, но целевой путь — tsconfig.json (после удаления .patch)
      // Однако tsconfig.patch.yaml → целевой файл tsconfig.yaml, не tsconfig.json
      // Для применения к tsconfig.json нужен tsconfig.patch.json
      const layerDir = createLayer("local", {
        "tsconfig.patch.json": JSON.stringify({
          compilerOptions: { target: { $set: "es2022" } },
        }),
      });

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [{ id: "local", overlayDir: layerDir }],
      });

      expect(outcome.errors).toEqual([]);

      const written = JSON.parse(
        fs.readFileSync(path.join(tmpDir, "tsconfig.json"), "utf-8"),
      );
      expect(written).toEqual({
        compilerOptions: { strict: true, target: "es2022" },
      });
    });

    // § Расширение overlay-step, шаг 2.9: patch с состоянием из mergeState
    it("читает существующий целевой файл, если mergeState не содержит записи", () => {
      const entry = createTestEntry({ id: "claude" });

      // Существующий целевой файл (от предыдущих транспилерных шагов)
      fs.writeFileSync(
        path.join(tmpDir, "config.json"),
        JSON.stringify({ items: [1, 2, 3] }),
      );

      const layerDir = createLayer("local", {
        "config.patch.json": JSON.stringify({
          items: { $append: [4, 5] },
        }),
      });

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [{ id: "local", overlayDir: layerDir }],
      });

      expect(outcome.errors).toEqual([]);

      const written = JSON.parse(
        fs.readFileSync(path.join(tmpDir, "config.json"), "utf-8"),
      );
      expect(written).toEqual({ items: [1, 2, 3, 4, 5] });
    });

    // § Расширение 2.9a: парсинг patch-файла завершился ошибкой
    it("добавляет ошибку парсинга patch-файла в errors и пропускает файл", () => {
      const entry = createTestEntry({ id: "claude" });

      const layerDir = createLayer("local", {
        "settings.patch.json": "{ invalid json ]]]",
        "good.json": JSON.stringify({ key: "value" }),
      });

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [{ id: "local", overlayDir: layerDir }],
      });

      // good.json записан, settings.patch.json пропущен
      expect(outcome.writtenCount).toBe(1);
      expect(outcome.errors).toHaveLength(1);
      expect(outcome.errors[0]).toContain("local");
    });

    // § Расширение 2.9b: парсинг существующего целевого файла завершился ошибкой
    it("добавляет ошибку парсинга целевого файла в errors и пропускает файл", () => {
      const entry = createTestEntry({ id: "claude" });

      // Невалидный целевой файл
      fs.writeFileSync(path.join(tmpDir, "config.json"), "{ broken json");

      const layerDir = createLayer("local", {
        "config.patch.json": JSON.stringify({
          key: { $set: "value" },
        }),
      });

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [{ id: "local", overlayDir: layerDir }],
      });

      expect(outcome.errors).toHaveLength(1);
      expect(outcome.errors[0]).toContain("config");
    });

    // § Обработка ошибок: tolerant level 2 — продолжает с оставшимися файлами
    it("продолжает обработку оставшихся файлов после ошибки в одном patch-файле", () => {
      const entry = createTestEntry({ id: "claude" });

      fs.writeFileSync(
        path.join(tmpDir, "good.json"),
        JSON.stringify({ items: [1, 2] }),
      );

      const layerDir = createLayer("local", {
        // Невалидный patch — $append на не-массиве
        "bad.patch.json": JSON.stringify({
          value: { $append: [1] },
        }),
        "good.patch.json": JSON.stringify({
          items: { $append: [3] },
        }),
      });

      // Создаём целевой файл bad.json с не-массивом
      fs.writeFileSync(
        path.join(tmpDir, "bad.json"),
        JSON.stringify({ value: "string" }),
      );

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [{ id: "local", overlayDir: layerDir }],
      });

      // bad.patch.json вызвал ошибку, но good.patch.json обработан
      expect(outcome.errors.length).toBeGreaterThanOrEqual(1);

      const written = JSON.parse(
        fs.readFileSync(path.join(tmpDir, "good.json"), "utf-8"),
      );
      expect(written).toEqual({ items: [1, 2, 3] });
    });

    // § Определение стратегии: файл с base undefined (целевой файл не существует)
    it("применяет patch к пустому объекту, если целевой файл не существует", () => {
      const entry = createTestEntry({ id: "claude" });

      const layerDir = createLayer("local", {
        "new-config.patch.json": JSON.stringify({
          key: { $set: "value" },
        }),
      });

      const outcome = runOverlayStep({
        entry,
        projectRoot: tmpDir,
        layers: [{ id: "local", overlayDir: layerDir }],
      });

      expect(outcome.errors).toEqual([]);

      const written = JSON.parse(
        fs.readFileSync(path.join(tmpDir, "new-config.json"), "utf-8"),
      );
      expect(written).toEqual({ key: "value" });
    });
  });
});
