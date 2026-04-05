// validate-docs-linked-list.spec.ts
// Спецификация: docs/specs/help-command.md § Валидация linked list
//               § Скрипт validate-docs-linked-list.ts
//               § Вычисление sidebar_position
//               § Запись sidebar_position в frontmatter
//               § Экспортируемый API

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import { validateDocsLinkedList, fixSidebarPositions } from "../../../scripts/validate-docs-linked-list.js";

/**
 * Вспомогательная функция: создаёт Markdown-файл с frontmatter в указанной директории.
 */
function createDocFile(
  dir: string,
  filename: string,
  opts: {
    title: string;
    description?: string;
    prev?: string;
    next?: string;
    sidebar_position?: number;
  },
): void {
  const fm = [
    "---",
    `title: ${opts.title}`,
    ...(opts.description !== undefined ? [`description: ${opts.description}`] : []),
    ...(opts.prev !== undefined ? [`prev: ${opts.prev}`] : []),
    ...(opts.next !== undefined ? [`next: ${opts.next}`] : []),
    ...(opts.sidebar_position !== undefined ? [`sidebar_position: ${opts.sidebar_position}`] : []),
    "---",
  ].join("\n");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), `${fm}\n\n# ${opts.title}\n\nContent.`, "utf-8");
}

describe("validate-docs-linked-list", () => {
  let tmpDir: string;
  let guideDir: string;
  let referenceDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-validate-ll-"));
    guideDir = path.join(tmpDir, "docs", "guide");
    referenceDir = path.join(tmpDir, "docs", "reference");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // =====================================================================
  // Happy path: корректная цепочка без ошибок
  // § help-command.md § Валидация linked list § Поведение шаги 1-7
  // =====================================================================

  it("возвращает успех при корректной doubly-linked list без ошибок", () => {
    // Цепочка: introduction (head) -> getting-started (tail)
    createDocFile(guideDir, "introduction.md", {
      title: "Introduction",
      description: "Intro",
      next: "getting-started",
    });
    createDocFile(guideDir, "getting-started.md", {
      title: "Getting Started",
      description: "Get started",
      prev: "introduction",
    });

    const result = validateDocsLinkedList(path.join(tmpDir, "docs"));

    expect(result.errors).toEqual([]);
    expect(result.success).toBe(true);
  });

  // =====================================================================
  // Проверка 5a: Multiple heads — более одного файла без prev
  // § help-command.md § Валидация linked list § Поведение шаг 5a
  // =====================================================================

  it("обнаруживает multiple heads в одной категории", () => {
    // alpha и bravo — оба без prev -> два head
    createDocFile(guideDir, "alpha.md", {
      title: "Alpha",
      description: "Alpha",
      next: "charlie",
    });
    createDocFile(guideDir, "bravo.md", {
      title: "Bravo",
      description: "Bravo",
      next: "delta",
    });
    createDocFile(guideDir, "charlie.md", {
      title: "Charlie",
      description: "Charlie",
      prev: "alpha",
    });
    createDocFile(guideDir, "delta.md", {
      title: "Delta",
      description: "Delta",
      prev: "bravo",
    });

    const result = validateDocsLinkedList(path.join(tmpDir, "docs"));

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining("guide: multiple heads: alpha, bravo")]),
    );
  });

  // =====================================================================
  // Проверка 5b: Non-existent slug references — next ссылается на несуществующий slug
  // § help-command.md § Валидация linked list § Поведение шаг 5b
  // =====================================================================

  it("обнаруживает next-ссылку на несуществующий slug", () => {
    createDocFile(guideDir, "alpha.md", {
      title: "Alpha",
      description: "Alpha",
      next: "nonexistent",
    });

    const result = validateDocsLinkedList(path.join(tmpDir, "docs"));

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('guide: alpha.next references non-existent slug "nonexistent"')]),
    );
  });

  it("обнаруживает prev-ссылку на несуществующий slug", () => {
    createDocFile(guideDir, "alpha.md", {
      title: "Alpha",
      description: "Alpha",
      prev: "nonexistent",
    });

    const result = validateDocsLinkedList(path.join(tmpDir, "docs"));

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('guide: alpha.prev references non-existent slug "nonexistent"')]),
    );
  });

  // =====================================================================
  // Проверка 5c: Broken back-references
  // § help-command.md § Валидация linked list § Поведение шаг 5c
  // =====================================================================

  it("обнаруживает broken back-reference: A.next = B, но B.prev != A", () => {
    createDocFile(guideDir, "alpha.md", {
      title: "Alpha",
      description: "Alpha",
      next: "bravo",
    });
    createDocFile(guideDir, "bravo.md", {
      title: "Bravo",
      description: "Bravo",
      prev: "charlie",
    });
    createDocFile(guideDir, "charlie.md", {
      title: "Charlie",
      description: "Charlie",
      next: "bravo",
    });

    const result = validateDocsLinkedList(path.join(tmpDir, "docs"));

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("guide: broken back-reference: alpha.next = bravo, but bravo.prev = charlie"),
      ]),
    );
  });

  it("обнаруживает broken back-reference: A.prev = B, но B.next != A", () => {
    createDocFile(guideDir, "alpha.md", {
      title: "Alpha",
      description: "Alpha",
      prev: "bravo",
    });
    createDocFile(guideDir, "bravo.md", {
      title: "Bravo",
      description: "Bravo",
      next: "charlie",
    });
    createDocFile(guideDir, "charlie.md", {
      title: "Charlie",
      description: "Charlie",
      prev: "bravo",
    });

    const result = validateDocsLinkedList(path.join(tmpDir, "docs"));

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("guide: broken back-reference: alpha.prev = bravo, but bravo.next = charlie"),
      ]),
    );
  });

  // =====================================================================
  // Проверка 5d: Cycles — обход next-указателей приводит к уже посещённому файлу
  // § help-command.md § Валидация linked list § Поведение шаг 5d
  // =====================================================================

  it("обнаруживает цикл в next-цепочке", () => {
    createDocFile(guideDir, "alpha.md", {
      title: "Alpha",
      description: "Alpha",
      next: "bravo",
    });
    createDocFile(guideDir, "bravo.md", {
      title: "Bravo",
      description: "Bravo",
      prev: "alpha",
      next: "alpha",
    });

    const result = validateDocsLinkedList(path.join(tmpDir, "docs"));

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining("guide: cycle detected: alpha -> bravo -> alpha")]),
    );
  });

  // =====================================================================
  // Проверка 5e: Orphaned files — файлы, не достижимые из head через next-цепочку
  // § help-command.md § Валидация linked list § Поведение шаг 5e
  // =====================================================================

  it("обнаруживает orphaned files, не достижимые из head", () => {
    createDocFile(guideDir, "alpha.md", {
      title: "Alpha",
      description: "Alpha",
      next: "bravo",
    });
    createDocFile(guideDir, "bravo.md", {
      title: "Bravo",
      description: "Bravo",
      prev: "alpha",
    });
    // charlie не в цепочке
    createDocFile(guideDir, "charlie.md", {
      title: "Charlie",
      description: "Charlie",
    });

    const result = validateDocsLinkedList(path.join(tmpDir, "docs"));

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining("guide: orphaned files: charlie")]));
  });

  // =====================================================================
  // Расширение 2a: Директория категории не существует -> пропустить (не ошибка)
  // § help-command.md § Валидация linked list § Расширения 2a
  // =====================================================================

  it("пропускает несуществующую директорию категории без ошибки", () => {
    // Создаём только guide, reference не существует
    createDocFile(guideDir, "alpha.md", {
      title: "Alpha",
      description: "Alpha",
    });

    const result = validateDocsLinkedList(path.join(tmpDir, "docs"));

    // Не должно быть ошибки из-за отсутствия reference/
    expect(result.errors.filter((e: string) => e.includes("reference"))).toEqual([]);
  });

  // =====================================================================
  // Расширение 3a: Файл без валидного YAML frontmatter -> ошибка
  // § help-command.md § Валидация linked list § Расширения 3a
  // =====================================================================

  it("сообщает об ошибке для файла без валидного frontmatter", () => {
    fs.mkdirSync(guideDir, { recursive: true });
    fs.writeFileSync(path.join(guideDir, "bad.md"), "# No frontmatter\n\nJust content.", "utf-8");

    const result = validateDocsLinkedList(path.join(tmpDir, "docs"));

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining("guide: bad has invalid frontmatter")]),
    );
  });

  // =====================================================================
  // Граничное условие: полностью корректная цепочка из трёх элементов в двух категориях
  // § help-command.md § Валидация linked list § Поведение шаги 5a-5e
  // =====================================================================

  it("проходит валидацию для корректных цепочек в обеих категориях", () => {
    // guide: alpha -> bravo -> charlie
    createDocFile(guideDir, "alpha.md", {
      title: "Alpha",
      description: "Alpha",
      next: "bravo",
    });
    createDocFile(guideDir, "bravo.md", {
      title: "Bravo",
      description: "Bravo",
      prev: "alpha",
      next: "charlie",
    });
    createDocFile(guideDir, "charlie.md", {
      title: "Charlie",
      description: "Charlie",
      prev: "bravo",
    });

    // reference: cli (single head/tail)
    createDocFile(referenceDir, "cli.md", {
      title: "CLI",
      description: "CLI",
    });

    const result = validateDocsLinkedList(path.join(tmpDir, "docs"));

    expect(result.errors).toEqual([]);
    expect(result.success).toBe(true);
  });

  // =====================================================================
  // Граничное условие: пустая категория (нет .md файлов)
  // § help-command.md § Валидация linked list § Поведение шаги 2-3
  // =====================================================================

  it("не сообщает об ошибках для пустой категории", () => {
    fs.mkdirSync(guideDir, { recursive: true });
    // Пустая guide/ — нет .md файлов

    const result = validateDocsLinkedList(path.join(tmpDir, "docs"));

    expect(result.errors).toEqual([]);
    expect(result.success).toBe(true);
  });

  // =====================================================================
  // Граничное условие: один файл в категории (head и tail одновременно)
  // § help-command.md § Валидация linked list
  // =====================================================================

  it("один файл без prev/next проходит валидацию как single head", () => {
    createDocFile(guideDir, "only.md", {
      title: "Only",
      description: "Only topic",
    });

    const result = validateDocsLinkedList(path.join(tmpDir, "docs"));

    // Один файл — он и head, и tail. Нет orphans (файл IS the chain).
    expect(result.errors).toEqual([]);
    expect(result.success).toBe(true);
  });
});

// =====================================================================
// fixSidebarPositions
// Спецификация: docs/specs/help-command.md
//   § Скрипт validate-docs-linked-list.ts (шаги 10-12, расширение 11a)
//   § Вычисление sidebar_position
//   § Запись sidebar_position в frontmatter
//   § Экспортируемый API
//
// fixSidebarPositions ещё не реализована — все тесты упадут (red TDD).
// =====================================================================

describe("fixSidebarPositions", () => {
  let tmpDir: string;
  let guideDir: string;
  let referenceDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-fix-sp-"));
    guideDir = path.join(tmpDir, "docs", "guide");
    referenceDir = path.join(tmpDir, "docs", "reference");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  /**
   * Вспомогательная функция: считывает sidebar_position из frontmatter файла.
   */
  function readSidebarPosition(filePath: string): number | undefined {
    const content = fs.readFileSync(filePath, "utf-8");
    const match = content.match(/^sidebar_position:\s*(\d+)\s*$/m);
    return match ? Number(match[1]) : undefined;
  }

  // =====================================================================
  // Happy path: корректная цепочка, sidebar_position записан
  // § Экспортируемый API — fixSidebarPositions возвращает { writtenCount, skippedCount }
  // § Вычисление sidebar_position — шаги 1-6
  // § Запись sidebar_position в frontmatter — шаги 1-7
  // =====================================================================

  it("записывает sidebar_position для корректной цепочки и возвращает writtenCount/skippedCount", () => {
    // Цепочка: alpha (head) -> bravo -> charlie (tail)
    createDocFile(guideDir, "alpha.md", {
      title: "Alpha",
      description: "Alpha",
      next: "bravo",
    });
    createDocFile(guideDir, "bravo.md", {
      title: "Bravo",
      description: "Bravo",
      prev: "alpha",
      next: "charlie",
    });
    createDocFile(guideDir, "charlie.md", {
      title: "Charlie",
      description: "Charlie",
      prev: "bravo",
    });

    const result = fixSidebarPositions(path.join(tmpDir, "docs"));

    expect(result.writtenCount).toBe(3);
    expect(result.skippedCount).toBe(0);

    // § Вычисление sidebar_position — шаг 5: позиция = индекс в цепочке + 1
    expect(readSidebarPosition(path.join(guideDir, "alpha.md"))).toBe(1);
    expect(readSidebarPosition(path.join(guideDir, "bravo.md"))).toBe(2);
    expect(readSidebarPosition(path.join(guideDir, "charlie.md"))).toBe(3);
  });

  // =====================================================================
  // Вычисление sidebar_position: orphans после цепочки по алфавиту
  // § Вычисление sidebar_position — шаги 3-6
  // =====================================================================

  it("назначает orphans позиции после цепочки в алфавитном порядке по slug", () => {
    // Цепочка: alpha (head, pos=1)
    // Orphans: delta (pos=2), zeta (pos=3) — по алфавиту
    createDocFile(guideDir, "alpha.md", {
      title: "Alpha",
      description: "Alpha",
    });
    createDocFile(referenceDir, "zeta.md", {
      title: "Zeta",
      description: "Zeta",
    });
    createDocFile(referenceDir, "delta.md", {
      title: "Delta",
      description: "Delta",
    });
    createDocFile(referenceDir, "alpha.md", {
      title: "Alpha Ref",
      description: "Alpha Ref",
      next: "bravo",
    });
    createDocFile(referenceDir, "bravo.md", {
      title: "Bravo Ref",
      description: "Bravo Ref",
      prev: "alpha",
    });

    fixSidebarPositions(path.join(tmpDir, "docs"));

    // guide: alpha = 1 (single head, chain of 1, no orphans)
    expect(readSidebarPosition(path.join(guideDir, "alpha.md"))).toBe(1);

    // reference: alpha (head, pos=1) -> bravo (pos=2), orphans: delta (pos=3), zeta (pos=4)
    expect(readSidebarPosition(path.join(referenceDir, "alpha.md"))).toBe(1);
    expect(readSidebarPosition(path.join(referenceDir, "bravo.md"))).toBe(2);
    expect(readSidebarPosition(path.join(referenceDir, "delta.md"))).toBe(3);
    expect(readSidebarPosition(path.join(referenceDir, "zeta.md"))).toBe(4);
  });

  // =====================================================================
  // Запись sidebar_position: замена существующего значения (regex-поиск)
  // § Запись sidebar_position в frontmatter — шаг 5
  // =====================================================================

  it("заменяет существующий sidebar_position в frontmatter на вычисленное значение", () => {
    // alpha с устаревшим sidebar_position: 99
    createDocFile(guideDir, "alpha.md", {
      title: "Alpha",
      description: "Alpha",
      next: "bravo",
      sidebar_position: 99,
    });
    createDocFile(guideDir, "bravo.md", {
      title: "Bravo",
      description: "Bravo",
      prev: "alpha",
      sidebar_position: 99,
    });

    const result = fixSidebarPositions(path.join(tmpDir, "docs"));

    expect(result.writtenCount).toBe(2);
    expect(readSidebarPosition(path.join(guideDir, "alpha.md"))).toBe(1);
    expect(readSidebarPosition(path.join(guideDir, "bravo.md"))).toBe(2);
  });

  // =====================================================================
  // Запись sidebar_position: вставка перед закрывающим --- когда поле отсутствует
  // § Запись sidebar_position в frontmatter — шаг 6
  // =====================================================================

  it("вставляет sidebar_position перед закрывающим --- когда поле отсутствует", () => {
    createDocFile(guideDir, "alpha.md", {
      title: "Alpha",
      description: "Alpha",
    });

    fixSidebarPositions(path.join(tmpDir, "docs"));

    const content = fs.readFileSync(path.join(guideDir, "alpha.md"), "utf-8");
    // sidebar_position должен быть внутри frontmatter (между --- и ---)
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    expect(fmMatch).not.toBeNull();
    expect(fmMatch![1]).toContain("sidebar_position: 1");
  });

  // =====================================================================
  // Идемпотентность: sidebar_position совпадает — файл не перезаписывается
  // § Расширение 11a — файл НЕ ДОЛЖЕН перезаписываться (mtime не меняется)
  // =====================================================================

  it("не перезаписывает файл, если sidebar_position совпадает с вычисленным", () => {
    // alpha — head (pos=1), bravo — (pos=2). Оба уже с правильными значениями.
    createDocFile(guideDir, "alpha.md", {
      title: "Alpha",
      description: "Alpha",
      next: "bravo",
      sidebar_position: 1,
    });
    createDocFile(guideDir, "bravo.md", {
      title: "Bravo",
      description: "Bravo",
      prev: "alpha",
      sidebar_position: 2,
    });

    // Запомним mtime до вызова
    const mtimeBefore = {
      alpha: fs.statSync(path.join(guideDir, "alpha.md")).mtimeMs,
      bravo: fs.statSync(path.join(guideDir, "bravo.md")).mtimeMs,
    };

    // Небольшая задержка, чтобы mtime гарантированно отличался при записи
    const start = Date.now();
    while (Date.now() - start < 50) {
      /* busy wait */
    }

    const result = fixSidebarPositions(path.join(tmpDir, "docs"));

    expect(result.writtenCount).toBe(0);
    expect(result.skippedCount).toBe(2);

    // mtime не должен измениться
    expect(fs.statSync(path.join(guideDir, "alpha.md")).mtimeMs).toBe(mtimeBefore.alpha);
    expect(fs.statSync(path.join(guideDir, "bravo.md")).mtimeMs).toBe(mtimeBefore.bravo);
  });

  // =====================================================================
  // Смешанный случай: часть файлов обновлена, часть пропущена
  // § Расширение 11a + § Запись sidebar_position в frontmatter
  // =====================================================================

  it("возвращает корректные writtenCount и skippedCount при частичном обновлении", () => {
    // alpha (pos=1) уже корректен, bravo (pos=2) нужно обновить
    createDocFile(guideDir, "alpha.md", {
      title: "Alpha",
      description: "Alpha",
      next: "bravo",
      sidebar_position: 1,
    });
    createDocFile(guideDir, "bravo.md", {
      title: "Bravo",
      description: "Bravo",
      prev: "alpha",
      sidebar_position: 99,
    });

    const result = fixSidebarPositions(path.join(tmpDir, "docs"));

    expect(result.writtenCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    expect(readSidebarPosition(path.join(guideDir, "bravo.md"))).toBe(2);
  });

  // =====================================================================
  // Обе категории обрабатываются
  // § Скрипт validate-docs-linked-list.ts — шаг 10 (для каждой категории)
  // =====================================================================

  it("вычисляет и записывает sidebar_position для обеих категорий", () => {
    // guide: intro (head) -> setup
    createDocFile(guideDir, "intro.md", {
      title: "Intro",
      description: "Intro",
      next: "setup",
    });
    createDocFile(guideDir, "setup.md", {
      title: "Setup",
      description: "Setup",
      prev: "intro",
    });

    // reference: cli (single)
    createDocFile(referenceDir, "cli.md", {
      title: "CLI",
      description: "CLI",
    });

    const result = fixSidebarPositions(path.join(tmpDir, "docs"));

    expect(result.writtenCount).toBe(3);
    expect(readSidebarPosition(path.join(guideDir, "intro.md"))).toBe(1);
    expect(readSidebarPosition(path.join(guideDir, "setup.md"))).toBe(2);
    expect(readSidebarPosition(path.join(referenceDir, "cli.md"))).toBe(1);
  });

  // =====================================================================
  // Граничное условие: один файл в категории
  // § Вычисление sidebar_position — шаги 1-2 (цепочка из одного элемента)
  // =====================================================================

  it("назначает sidebar_position: 1 единственному файлу в категории", () => {
    createDocFile(guideDir, "only.md", {
      title: "Only",
      description: "Only",
    });

    const result = fixSidebarPositions(path.join(tmpDir, "docs"));

    expect(result.writtenCount).toBe(1);
    expect(readSidebarPosition(path.join(guideDir, "only.md"))).toBe(1);
  });

  // =====================================================================
  // Граничное условие: пустая категория (нет .md файлов) — не ломается
  // § Скрипт validate-docs-linked-list.ts — расширение 3a
  // =====================================================================

  it("корректно обрабатывает пустые категории и несуществующие директории", () => {
    // Только guide с одним файлом, reference не существует
    createDocFile(guideDir, "alpha.md", {
      title: "Alpha",
      description: "Alpha",
    });

    const result = fixSidebarPositions(path.join(tmpDir, "docs"));

    expect(result.writtenCount).toBe(1);
    expect(result.skippedCount).toBe(0);
    expect(readSidebarPosition(path.join(guideDir, "alpha.md"))).toBe(1);
  });

  // =====================================================================
  // Точечная модификация: сохранение форматирования остальных полей frontmatter
  // § Запись sidebar_position в frontmatter — точечная модификация текста файла
  // =====================================================================

  it("сохраняет остальные поля frontmatter без изменений при записи sidebar_position", () => {
    createDocFile(guideDir, "alpha.md", {
      title: "Alpha",
      description: "Alpha description",
      next: "bravo",
    });
    createDocFile(guideDir, "bravo.md", {
      title: "Bravo",
      description: "Bravo description",
      prev: "alpha",
    });

    fixSidebarPositions(path.join(tmpDir, "docs"));

    const contentAfter = fs.readFileSync(path.join(guideDir, "alpha.md"), "utf-8");

    // Исходные поля должны остаться нетронутыми
    expect(contentAfter).toContain("title: Alpha");
    expect(contentAfter).toContain("description: Alpha description");
    expect(contentAfter).toContain("next: bravo");
    // sidebar_position добавлен
    expect(contentAfter).toContain("sidebar_position: 1");
    // Содержимое после frontmatter не изменилось
    expect(contentAfter).toContain("# Alpha");
    expect(contentAfter).toContain("Content.");
  });

  // =====================================================================
  // Граничное условие: длинная цепочка из 5 элементов
  // § Вычисление sidebar_position — шаги 1-5 (1-based нумерация)
  // =====================================================================

  it("назначает последовательные позиции 1..N для длинной цепочки", () => {
    createDocFile(guideDir, "a.md", {
      title: "A",
      description: "A",
      next: "b",
    });
    createDocFile(guideDir, "b.md", {
      title: "B",
      description: "B",
      prev: "a",
      next: "c",
    });
    createDocFile(guideDir, "c.md", {
      title: "C",
      description: "C",
      prev: "b",
      next: "d",
    });
    createDocFile(guideDir, "d.md", {
      title: "D",
      description: "D",
      prev: "c",
      next: "e",
    });
    createDocFile(guideDir, "e.md", {
      title: "E",
      description: "E",
      prev: "d",
    });

    const result = fixSidebarPositions(path.join(tmpDir, "docs"));

    expect(result.writtenCount).toBe(5);
    expect(readSidebarPosition(path.join(guideDir, "a.md"))).toBe(1);
    expect(readSidebarPosition(path.join(guideDir, "b.md"))).toBe(2);
    expect(readSidebarPosition(path.join(guideDir, "c.md"))).toBe(3);
    expect(readSidebarPosition(path.join(guideDir, "d.md"))).toBe(4);
    expect(readSidebarPosition(path.join(guideDir, "e.md"))).toBe(5);
  });

  // =====================================================================
  // Повторный вызов — идемпотентность (двойной вызов)
  // § Расширение 11a — повторный вызов не изменяет файлы
  // =====================================================================

  it("повторный вызов возвращает writtenCount: 0, skippedCount: N (идемпотентность)", () => {
    createDocFile(guideDir, "alpha.md", {
      title: "Alpha",
      description: "Alpha",
      next: "bravo",
    });
    createDocFile(guideDir, "bravo.md", {
      title: "Bravo",
      description: "Bravo",
      prev: "alpha",
    });

    // Первый вызов — записывает
    const first = fixSidebarPositions(path.join(tmpDir, "docs"));
    expect(first.writtenCount).toBe(2);

    // Второй вызов — всё совпадает, ничего не пишет
    const second = fixSidebarPositions(path.join(tmpDir, "docs"));
    expect(second.writtenCount).toBe(0);
    expect(second.skippedCount).toBe(2);
  });
});
