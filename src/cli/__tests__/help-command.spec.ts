// help-command.spec.ts
// Спецификация: docs/specs/help-command.md § Команда help, § Вывод списка topics,
//               § Разрешение имени topic, § Справка, § Изменения в cli.md

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import React from "react";
import { render } from "ink-testing-library";
import { App } from "../app.js";

/**
 * Вспомогательная функция: создаёт Markdown-файл с frontmatter.
 * Spec: docs/specs/help-command.md § Frontmatter doc-файла
 * Поля prev/next — doubly-linked list (slug предыдущего/следующего topic).
 * Отсутствие prev → head, отсутствие next → tail.
 */
function createDocFile(
  dir: string,
  filename: string,
  opts: { title: string; description?: string; prev?: string; next?: string; body?: string },
): void {
  const fm = [
    "---",
    `title: ${opts.title}`,
    ...(opts.description !== undefined ? [`description: ${opts.description}`] : []),
    ...(opts.prev !== undefined ? [`prev: ${opts.prev}`] : []),
    ...(opts.next !== undefined ? [`next: ${opts.next}`] : []),
    "---",
  ].join("\n");
  const body = opts.body ?? `\n# ${opts.title}\n\nContent of ${opts.title}.`;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), `${fm}\n${body}`, "utf-8");
}

describe("CLI", () => {
  describe("Команда help", () => {
    let originalExitCode: number | undefined;
    let originalDocsDirEnv: string | undefined;
    let tmpDocsDir: string;
    let guideDir: string;
    let referenceDir: string;

    beforeEach(() => {
      originalExitCode = process.exitCode;
      originalDocsDirEnv = process.env.AGLOOM_DOCS_DIR;

      // Изолированная docs/ директория per-test. Используем env var
      // AGLOOM_DOCS_DIR для переопределения пути, чтобы не мутировать
      // реальную docs/ (иначе — кросс-воркерная гонка с другими spec-файлами,
      // которые запускают `agloom help` и читают topics из реального docs/).
      tmpDocsDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-help-docs-"));
      process.env.AGLOOM_DOCS_DIR = tmpDocsDir;
      guideDir = path.join(tmpDocsDir, "guide");
      referenceDir = path.join(tmpDocsDir, "reference");
    });

    afterEach(() => {
      process.exitCode = originalExitCode;

      if (originalDocsDirEnv === undefined) {
        delete process.env.AGLOOM_DOCS_DIR;
      } else {
        process.env.AGLOOM_DOCS_DIR = originalDocsDirEnv;
      }

      fs.rmSync(tmpDocsDir, { recursive: true, force: true });
    });

    // =====================================================================
    // Happy path: agloom help (без topic) — категоризированный список topics
    // § help-command.md § Команда help § Поведение шаги 1-8
    // =====================================================================

    it("без аргумента topic отображает категоризированный список topics с секциями Guide и Reference", () => {
      // Arrange: создать файлы в docs/guide/ и docs/reference/
      createDocFile(guideDir, "getting-started.md", {
        title: "Getting Started",
        description: "How to get started with Agloom",
        next: "configuration",
      });
      createDocFile(guideDir, "configuration.md", {
        title: "Configuration",
        description: "Configure Agloom for your project",
        prev: "getting-started",
      });
      createDocFile(referenceDir, "cli.md", {
        title: "CLI Reference",
        description: "Complete CLI reference",
      });

      const { lastFrame, unmount } = render(React.createElement(App, { args: ["help"] }));

      const output = lastFrame()!;

      // § Вывод списка topics: "Available help topics:"
      expect(output).toContain("Available help topics:");

      // § Вывод списка topics: категория Guide с отступом 2 пробела + двоеточие
      expect(output).toMatch(/^ {2}Guide:/m);

      // § Вывод списка topics: topics с отступом 4 пробела
      expect(output).toMatch(/^ {4}guide\/getting-started/m);
      expect(output).toMatch(/^ {4}guide\/configuration/m);

      // § Вывод списка topics: категория Reference
      expect(output).toMatch(/^ {2}Reference:/m);
      expect(output).toMatch(/^ {4}reference\/cli/m);

      // § Вывод списка topics: descriptions
      expect(output).toContain("How to get started with Agloom");
      expect(output).toContain("Configure Agloom for your project");
      expect(output).toContain("Complete CLI reference");

      // § Вывод списка topics: footer
      expect(output).toContain("Run 'agloom help <topic>' to learn more.");

      // § Exit codes: 0
      expect(process.exitCode).toBeUndefined();

      unmount();
    });

    // =====================================================================
    // Трансформация: сортировка topics по frontmatter after (linked list) (шаг 7)
    // § help-command.md § Команда help § Поведение шаг 7
    // =====================================================================

    it("отображает topics внутри категории в порядке doubly-linked list (prev/next)", () => {
      createDocFile(guideDir, "advanced.md", {
        title: "Advanced",
        description: "Advanced usage",
        prev: "configuration",
      });
      createDocFile(guideDir, "getting-started.md", {
        title: "Getting Started",
        description: "Get started",
        next: "configuration",
      });
      createDocFile(guideDir, "configuration.md", {
        title: "Configuration",
        description: "Config",
        prev: "getting-started",
        next: "advanced",
      });

      const { lastFrame, unmount } = render(React.createElement(App, { args: ["help"] }));

      const output = lastFrame()!;

      // Порядок: getting-started (1) < configuration (5) < advanced (10)
      const gsIdx = output.indexOf("guide/getting-started");
      const cfgIdx = output.indexOf("guide/configuration");
      const advIdx = output.indexOf("guide/advanced");

      expect(gsIdx).toBeGreaterThan(-1);
      expect(cfgIdx).toBeGreaterThan(-1);
      expect(advIdx).toBeGreaterThan(-1);
      expect(gsIdx).toBeLessThan(cfgIdx);
      expect(cfgIdx).toBeLessThan(advIdx);

      unmount();
    });

    // =====================================================================
    // Трансформация: порядок категорий Guide → Reference
    // § help-command.md § Вывод списка topics: категории в порядке DocCategory.order
    // =====================================================================

    it("отображает категории в порядке Guide → Reference", () => {
      createDocFile(guideDir, "intro.md", {
        title: "Intro",
        description: "Introduction",
      });
      createDocFile(referenceDir, "api.md", {
        title: "API",
        description: "API reference",
      });

      const { lastFrame, unmount } = render(React.createElement(App, { args: ["help"] }));

      const output = lastFrame()!;

      const guideIdx = output.indexOf("Guide:");
      const refIdx = output.indexOf("Reference:");

      expect(guideIdx).toBeGreaterThan(-1);
      expect(refIdx).toBeGreaterThan(-1);
      expect(guideIdx).toBeLessThan(refIdx);

      unmount();
    });

    // =====================================================================
    // Трансформация: ширина колонки name по самому длинному name среди ВСЕХ категорий
    // § help-command.md § Вывод списка topics: правила форматирования
    // =====================================================================

    it("выравнивает колонку name по самому длинному name среди всех категорий", () => {
      // guide/getting-started — длинное имя (24 символа)
      createDocFile(guideDir, "getting-started.md", {
        title: "Getting Started",
        description: "Desc A",
      });
      // reference/cli — короткое имя (13 символов)
      createDocFile(referenceDir, "cli.md", {
        title: "CLI",
        description: "Desc B",
      });

      const { lastFrame, unmount } = render(React.createElement(App, { args: ["help"] }));

      const output = lastFrame()!;
      const lines = output.split("\n");

      // Найти строки с topics
      const gsLine = lines.find((l) => l.includes("guide/getting-started"));
      const cliLine = lines.find((l) => l.includes("reference/cli"));

      expect(gsLine).toBeDefined();
      expect(cliLine).toBeDefined();

      // Описания должны начинаться в одной и той же колонке
      const gsDescStart = gsLine!.indexOf("Desc A");
      const cliDescStart = cliLine!.indexOf("Desc B");
      expect(gsDescStart).toBeGreaterThan(0);
      expect(cliDescStart).toBeGreaterThan(0);
      expect(gsDescStart).toBe(cliDescStart);

      unmount();
    });

    // =====================================================================
    // Расширение: пустая категория не отображается
    // § help-command.md § Вывод списка topics: категория, не содержащая topics,
    //   НЕ ДОЛЖНА отображаться
    // =====================================================================

    it("не отображает категорию, если она не содержит topics", () => {
      // Только guide, reference пустой (не создаём)
      createDocFile(guideDir, "intro.md", {
        title: "Intro",
        description: "Introduction",
      });
      // reference директорию не создаём

      const { lastFrame, unmount } = render(React.createElement(App, { args: ["help"] }));

      const output = lastFrame()!;

      expect(output).toContain("Guide:");
      expect(output).not.toContain("Reference:");

      unmount();
    });

    // =====================================================================
    // Happy path: agloom help guide/getting-started — рендер topic с префиксом
    // § help-command.md § Команда help § Поведение шаги 9-13
    // § help-command.md § Разрешение имени topic § Поведение шаг 1
    // =====================================================================

    it("при указании topic с префиксом (guide/getting-started) рендерит содержимое без frontmatter", () => {
      createDocFile(guideDir, "getting-started.md", {
        title: "Getting Started",
        description: "How to get started",
        body: "\n# Getting Started\n\nWelcome to Agloom guide.",
      });

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["help", "guide/getting-started"],
        }),
      );

      const output = lastFrame()!;

      // § Поведение шаг 11: frontmatter удалён перед рендерингом
      expect(output).not.toContain("title:");
      expect(output).not.toContain("description:");
      expect(output).not.toContain("prev:");
      expect(output).not.toContain("next:");
      expect(output).not.toContain("---");

      // § Поведение шаг 12-13: содержимое отрендерено
      expect(output).toContain("Getting Started");
      expect(output).toContain("Welcome to Agloom guide");

      // Не должен содержать список topics
      expect(output).not.toContain("Available help topics:");

      // § Exit codes: 0
      expect(process.exitCode).toBeUndefined();

      unmount();
    });

    // =====================================================================
    // Happy path: agloom help reference/cli — рендер topic из reference
    // § help-command.md § Команда help § Поведение шаги 9-13
    // =====================================================================

    it("при указании topic с префиксом reference/ рендерит содержимое", () => {
      createDocFile(referenceDir, "cli.md", {
        title: "CLI Reference",
        description: "Complete CLI reference",
        body: "\n# CLI Reference\n\nAll CLI commands documented here.",
      });

      const { lastFrame, unmount } = render(React.createElement(App, { args: ["help", "reference/cli"] }));

      const output = lastFrame()!;

      expect(output).toContain("CLI Reference");
      expect(output).toContain("All CLI commands documented here");
      expect(output).not.toContain("Available help topics:");
      expect(process.exitCode).toBeUndefined();

      unmount();
    });

    // =====================================================================
    // Happy path: agloom help getting-started (без префикса) — resolve unique
    // § help-command.md § Разрешение имени topic § Поведение шаги 2-3
    // =====================================================================

    it("при указании topic без префикса находит unique match и рендерит", () => {
      createDocFile(guideDir, "getting-started.md", {
        title: "Getting Started",
        description: "How to get started",
        body: "\n# Getting Started\n\nThis is the getting started guide.",
      });

      const { lastFrame, unmount } = render(React.createElement(App, { args: ["help", "getting-started"] }));

      const output = lastFrame()!;

      expect(output).toContain("Getting Started");
      expect(output).toContain("This is the getting started guide");
      expect(output).not.toContain("Available help topics:");
      expect(process.exitCode).toBeUndefined();

      unmount();
    });

    // =====================================================================
    // Расширение 2a: Ambiguous topic (одинаковый slug в двух категориях)
    // § help-command.md § Разрешение имени topic § Расширения 2a
    // =====================================================================

    it("при ambiguous topic (slug в двух категориях) отображает ошибку с перечнем", () => {
      // Одинаковый slug 'overview' в guide и reference
      createDocFile(guideDir, "overview.md", {
        title: "Guide Overview",
        description: "Guide overview",
      });
      createDocFile(referenceDir, "overview.md", {
        title: "Reference Overview",
        description: "Reference overview",
      });

      const { lastFrame, unmount } = render(React.createElement(App, { args: ["help", "overview"] }));

      const output = lastFrame()!;

      // § Расширение 2a: "Ambiguous help topic: {topic}. Did you mean one of these?"
      expect(output).toContain("Ambiguous help topic: overview. Did you mean one of these?");

      // Список совпавших topic names с отступом 2 пробела
      expect(output).toMatch(/^ {2}guide\/overview$/m);
      expect(output).toMatch(/^ {2}reference\/overview$/m);

      // § Exit codes: 1
      expect(process.exitCode).toBe(1);

      unmount();
    });

    // =====================================================================
    // Расширение 1a: Topic с префиксом не найден, список topics непуст
    // § help-command.md § Разрешение имени topic § Расширения 1a
    // =====================================================================

    it("при несуществующем topic с префиксом и непустом списке отображает Unknown + список", () => {
      createDocFile(guideDir, "intro.md", {
        title: "Intro",
        description: "Introduction",
      });

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["help", "guide/nonexistent"],
        }),
      );

      const output = lastFrame()!;

      expect(output).toContain("Unknown help topic: guide/nonexistent.");
      // Пустая строка между сообщением и списком
      expect(output).toMatch(/Unknown help topic: guide\/nonexistent\.\n\nAvailable help topics:/);
      expect(output).toContain("Available help topics:");

      expect(process.exitCode).toBe(1);

      unmount();
    });

    // =====================================================================
    // Расширение 1b: Topic с префиксом не найден, список topics пуст
    // § help-command.md § Разрешение имени topic § Расширения 1b
    // =====================================================================

    it("при несуществующем topic с префиксом и пустом списке отображает Unknown без списка", () => {
      // Не создаём никаких файлов → пустой список topics

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["help", "guide/nonexistent"],
        }),
      );

      const output = lastFrame()!;

      expect(output).toContain("Unknown help topic: guide/nonexistent.");
      expect(output).not.toContain("Available help topics:");

      expect(process.exitCode).toBe(1);

      unmount();
    });

    // =====================================================================
    // Расширение 2b: Topic без префикса не найден, список topics непуст
    // § help-command.md § Разрешение имени topic § Расширения 2b
    // =====================================================================

    it("при несуществующем topic без префикса и непустом списке отображает Unknown + список", () => {
      createDocFile(guideDir, "intro.md", {
        title: "Intro",
        description: "Introduction",
      });

      const { lastFrame, unmount } = render(React.createElement(App, { args: ["help", "nonexistent"] }));

      const output = lastFrame()!;

      expect(output).toContain("Unknown help topic: nonexistent.");
      expect(output).toMatch(/Unknown help topic: nonexistent\.\n\nAvailable help topics:/);

      expect(process.exitCode).toBe(1);

      unmount();
    });

    // =====================================================================
    // Расширение 2c: Topic без префикса не найден, список topics пуст
    // § help-command.md § Разрешение имени topic § Расширения 2c
    // =====================================================================

    it("при несуществующем topic без префикса и пустом списке отображает Unknown без списка", () => {
      // Не создаём файлов

      const { lastFrame, unmount } = render(React.createElement(App, { args: ["help", "nonexistent"] }));

      const output = lastFrame()!;

      expect(output).toContain("Unknown help topic: nonexistent.");
      expect(output).not.toContain("Available help topics:");

      expect(process.exitCode).toBe(1);

      unmount();
    });

    // =====================================================================
    // Расширение 8a: Список topics пуст по всем категориям
    // § help-command.md § Команда help § Расширения 8a
    // =====================================================================

    it("при пустом списке topics отображает 'No help topics available.' и exit code 1", () => {
      // Не создаём файлов → оба каталога пусты или не существуют

      const { lastFrame, unmount } = render(React.createElement(App, { args: ["help"] }));

      const output = lastFrame()!;

      expect(output).toContain("No help topics available.");
      expect(process.exitCode).toBe(1);

      unmount();
    });

    // =====================================================================
    // Расширение 3a: Директория категории не существует → пустой список для неё
    // § help-command.md § Команда help § Расширения 3a
    // =====================================================================

    it("при отсутствии директории категории считает её пустой", () => {
      // Создаём только guide, reference не существует
      createDocFile(guideDir, "intro.md", {
        title: "Intro",
        description: "Introduction",
      });
      // referenceDir не создаём

      const { lastFrame, unmount } = render(React.createElement(App, { args: ["help"] }));

      const output = lastFrame()!;

      // Список отображается (guide содержит topics)
      expect(output).toContain("Available help topics:");
      expect(output).toContain("guide/intro");
      // Reference не отображается (категория пуста)
      expect(output).not.toContain("Reference:");

      expect(process.exitCode).toBeUndefined();

      unmount();
    });

    // =====================================================================
    // Расширение 5a: Файл без валидного YAML frontmatter → skip
    // § help-command.md § Команда help § Расширения 5a
    // =====================================================================

    it("пропускает файл без валидного YAML frontmatter", () => {
      createDocFile(guideDir, "valid.md", {
        title: "Valid",
        description: "Valid topic",
      });
      // Создаём файл без frontmatter
      fs.writeFileSync(path.join(guideDir, "invalid.md"), "# No Frontmatter\n\nJust plain content.", "utf-8");

      const { lastFrame, unmount } = render(React.createElement(App, { args: ["help"] }));

      const output = lastFrame()!;

      expect(output).toContain("guide/valid");
      // Файл без frontmatter НЕ должен быть в списке
      expect(output).not.toContain("guide/invalid");

      unmount();
    });

    // =====================================================================
    // Расширение 5b: Frontmatter без description → description = ""
    // § help-command.md § Команда help § Расширения 5b
    // =====================================================================

    it("при отсутствии description в frontmatter использует пустую строку", () => {
      // Файл с frontmatter без description
      fs.mkdirSync(guideDir, { recursive: true });
      fs.writeFileSync(path.join(guideDir, "no-desc.md"), "---\ntitle: No Desc\n---\n\n# No Desc\n\nContent.", "utf-8");

      const { lastFrame, unmount } = render(React.createElement(App, { args: ["help"] }));

      const output = lastFrame()!;

      // Topic должен быть в списке (не пропущен)
      expect(output).toContain("guide/no-desc");

      unmount();
    });

    // =====================================================================
    // Расширение 5c: Frontmatter без полей prev и next → topic становится orphan
    // § help-command.md § Команда help § Расширения 5c
    // =====================================================================

    it("при отсутствии prev и next в frontmatter topic становится orphan (показывается после цепочки)", () => {
      // Цепочка: first (head, next: second) → second (prev: first, tail)
      createDocFile(guideDir, "first.md", {
        title: "First",
        description: "First topic",
        next: "second",
      });
      createDocFile(guideDir, "second.md", {
        title: "Second",
        description: "Second topic",
        prev: "first",
      });
      // Файл без prev/next → orphan, должен отображаться после цепочки
      fs.mkdirSync(guideDir, { recursive: true });
      fs.writeFileSync(
        path.join(guideDir, "no-links.md"),
        "---\ntitle: No Links\ndescription: No links topic\n---\n\n# No Links\n\nContent.",
        "utf-8",
      );

      const { lastFrame, unmount } = render(React.createElement(App, { args: ["help"] }));

      const output = lastFrame()!;

      // Все три topics должны быть в выводе
      expect(output).toContain("guide/first");
      expect(output).toContain("guide/second");
      expect(output).toContain("guide/no-links");

      // Orphan (no-links) должен идти после цепочки (first, second)
      const firstIdx = output.indexOf("guide/first");
      const secondIdx = output.indexOf("guide/second");
      const noLinksIdx = output.indexOf("guide/no-links");
      expect(firstIdx).toBeLessThan(secondIdx);
      expect(secondIdx).toBeLessThan(noLinksIdx);

      unmount();
    });

    // =====================================================================
    // Расширение 10a: Ошибка чтения файла
    // § help-command.md § Команда help § Расширения 10a
    // =====================================================================

    it("при ошибке чтения файла отображает 'Failed to read help topic' и exit code 1", () => {
      createDocFile(guideDir, "unreadable.md", {
        title: "Unreadable",
        description: "Unreadable topic",
      });

      // Создаём topic, затем делаем файл нечитаемым
      const filePath = path.join(guideDir, "unreadable.md");
      fs.chmodSync(filePath, 0o000);

      try {
        const { lastFrame, unmount } = render(
          React.createElement(App, {
            args: ["help", "guide/unreadable"],
          }),
        );

        const output = lastFrame()!;

        expect(output).toContain("Failed to read help topic: guide/unreadable.");
        expect(process.exitCode).toBe(1);

        unmount();
      } finally {
        // Восстановить права для cleanup
        fs.chmodSync(filePath, 0o644);
      }
    });

    // =====================================================================
    // Расширение 12a: Ошибка рендеринга Markdown
    // § help-command.md § Команда help § Расширения 12a:
    // Ошибка рендеринга Markdown → отобразить сообщение
    // "Failed to render help topic: {topic}."; exit code 1.
    //
    // Обоснование подхода: marked + marked-terminal являются
    // детерминистичными библиотеками, которые не выбрасывают исключений
    // на произвольном строковом вводе. Единственный способ вызвать
    // ошибку рендеринга — нарушение внутреннего состояния marked
    // (например, дефектный extension). Для проверки защитного catch-блока
    // используется vi.mock на уровне модуля marked — это обоснованное
    // исключение из правила «не мокать детерминистичные библиотеки»,
    // т.к. тестируется именно поведение при невоспроизводимой ошибке,
    // а не корректность вызова marked.
    // =====================================================================

    it("при ошибке рендеринга Markdown отображает 'Failed to render help topic' и exit code 1", async () => {
      createDocFile(guideDir, "render-error.md", {
        title: "Render Error",
        description: "Topic that triggers render error",
        body: "\n# Render Error\n\nContent that should be rendered.",
      });

      // Динамический import для доступа к модулю marked
      const markedModule = await import("marked");
      const originalParse = markedModule.marked.parse;

      // Временно подменяем parse, чтобы выбросить исключение
      // Обоснование: единственный способ проверить защитный catch-блок
      // для ошибки рендеринга — marked не выбрасывает на строковом вводе
      markedModule.marked.parse = () => {
        throw new Error("Simulated render failure");
      };

      try {
        const { lastFrame, unmount } = render(
          React.createElement(App, {
            args: ["help", "guide/render-error"],
          }),
        );

        const output = lastFrame()!;

        expect(output).toContain("Failed to render help topic: guide/render-error.");
        expect(process.exitCode).toBe(1);

        unmount();
      } finally {
        // Восстановить оригинальный parse
        markedModule.marked.parse = originalParse;
      }
    });

    // =====================================================================
    // Трансформация: frontmatter stripped при рендеринге topic
    // § help-command.md § Команда help § Поведение шаг 11
    // =====================================================================

    it("удаляет frontmatter при рендеринге topic (не показывается в output)", () => {
      createDocFile(guideDir, "test-strip.md", {
        title: "Strip Test",
        description: "Testing frontmatter stripping",
        body: "\n# Strip Test\n\nBody content only.",
      });

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["help", "guide/test-strip"],
        }),
      );

      const output = lastFrame()!;

      // Frontmatter не должен быть в выводе
      expect(output).not.toContain("title: Strip Test");
      expect(output).not.toContain("description: Testing frontmatter stripping");
      expect(output).not.toContain("prev:");
      expect(output).not.toContain("next:");

      // Содержимое должно быть
      expect(output).toContain("Body content only");

      unmount();
    });

    // =====================================================================
    // Трансформация: topic name = {category}/{slug}
    // § help-command.md § Команда help § Поведение шаг 6
    // =====================================================================

    it("формирует имя topic в формате {category}/{slug}", () => {
      createDocFile(guideDir, "getting-started.md", {
        title: "Getting Started",
        description: "Get started",
      });
      createDocFile(referenceDir, "cli.md", {
        title: "CLI",
        description: "CLI ref",
      });

      const { lastFrame, unmount } = render(React.createElement(App, { args: ["help"] }));

      const output = lastFrame()!;

      // Имена в формате category/slug
      expect(output).toContain("guide/getting-started");
      expect(output).toContain("reference/cli");

      // Не должно быть имён без префикса в списке
      // (description может содержать слово "getting-started", но в строке topic
      // с отступом 4 пробела должен быть полный формат)
      expect(output).toMatch(/^ {4}guide\/getting-started/m);
      expect(output).toMatch(/^ {4}reference\/cli/m);

      unmount();
    });

    // =====================================================================
    // Расширение: Markdown рендерится через marked + marked-terminal
    // § help-command.md § Команда help § Поведение шаг 12
    // =====================================================================

    it("рендерит Markdown через marked + marked-terminal (ANSI-коды в выводе)", () => {
      createDocFile(guideDir, "md-test.md", {
        title: "Markdown Test",
        description: "Test markdown rendering",
        body: "\n# Markdown Test\n\nSome **bold** and `code` content.",
      });

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["help", "guide/md-test"],
        }),
      );

      const output = lastFrame()!;

      // Вывод содержит ANSI-коды (терминал-совместимый формат)
      // eslint-disable-next-line no-control-regex
      expect(output).toMatch(/\x1b\[/);

      expect(output).toContain("Markdown Test");
      expect(process.exitCode).toBeUndefined();

      unmount();
    });

    // =====================================================================
    // Трансформация: import.meta.dirname для резолва пути
    // § help-command.md § Команда help § Поведение шаг 2
    // =====================================================================

    it("резолвит путь к docs/ через import.meta.dirname, а не process.cwd()", () => {
      createDocFile(guideDir, "intro.md", {
        title: "Intro",
        description: "Introduction",
      });

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-help-cwd-test-"));
      const originalCwd = process.cwd();
      try {
        process.chdir(tmpDir);

        const { lastFrame, unmount } = render(React.createElement(App, { args: ["help"] }));

        const output = lastFrame()!;

        // Список topics должен загрузиться, т.к. путь через import.meta.dirname
        expect(output).toContain("Available help topics:");
        expect(output).toContain("guide/intro");

        unmount();
      } finally {
        process.chdir(originalCwd);
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    // =====================================================================
    // § help-command.md § Справка: agloom help --help
    // =====================================================================

    it("help --help отображает справку с примерами guide/getting-started, reference/cli", () => {
      const { lastFrame, unmount } = render(React.createElement(App, { args: ["help", "--help"] }));

      const output = lastFrame()!;

      // § Справка: "Usage: agloom help [<topic>]"
      expect(output).toContain("Usage: agloom help [<topic>]");

      // § Справка: "Show help topics or display a specific help topic."
      expect(output).toContain("Show help topics or display a specific help topic.");

      // § Справка: Arguments section
      expect(output).toContain("Arguments:");
      expect(output).toContain("<topic>");

      // § Справка: примеры с новым форматом имён
      expect(output).toContain("guide/getting-started");
      expect(output).toContain("reference/cli");

      // Exit code 0
      expect(process.exitCode).toBeUndefined();

      unmount();
    });

    // =====================================================================
    // § help-command.md § Изменения в cli.md § Добавление help в список команд
    // =====================================================================

    it('содержит команду "help" с описанием в выводе agloom --help', () => {
      const { lastFrame, unmount } = render(React.createElement(App, { args: ["--help"] }));

      const output = lastFrame()!;

      expect(output).toMatch(/ {2}help\s+Show help topics or display a specific help topic/);

      unmount();
    });

    // =====================================================================
    // § help-command.md § Изменения в cli.md § Изменение секции --help
    // agloom help больше НЕ является алиасом --help
    // =====================================================================

    it("agloom help отображает категоризированный список topics, а не общую справку", () => {
      createDocFile(guideDir, "intro.md", {
        title: "Intro",
        description: "Introduction",
      });

      const { lastFrame: helpFrame, unmount: unmountHelp } = render(React.createElement(App, { args: ["help"] }));
      const helpOutput = helpFrame()!;
      unmountHelp();

      const { lastFrame: globalHelpFrame, unmount: unmountGlobalHelp } = render(
        React.createElement(App, { args: ["--help"] }),
      );
      const globalHelpOutput = globalHelpFrame()!;
      unmountGlobalHelp();

      // help должен отображать категоризированный список topics
      expect(helpOutput).toContain("Available help topics:");
      expect(helpOutput).toContain("Guide:");
      // Не должен быть идентичен выводу --help
      expect(helpOutput).not.toEqual(globalHelpOutput);
    });

    // =====================================================================
    // § help-command.md § Изменения в cli.md § Изменение секции «Неизвестная команда»
    // =====================================================================

    it("help распознаётся как команда, а не Unknown command", () => {
      // Создаём минимальные данные
      createDocFile(guideDir, "intro.md", {
        title: "Intro",
        description: "Introduction",
      });

      const { lastFrame, unmount } = render(React.createElement(App, { args: ["help"] }));

      const output = lastFrame()!;

      expect(output).not.toContain("Unknown command");
      expect(output).toContain("Available help topics:");

      unmount();
    });

    // =====================================================================
    // Граничное условие: topic с именем команды (transpile)
    // § help-command.md § Команда help § Поведение шаги 9-13
    // =====================================================================

    it("при указании topic с именем команды (guide/transpile) рендерит topic, а не выполняет команду", () => {
      createDocFile(guideDir, "transpile.md", {
        title: "Transpile",
        description: "How to transpile",
        body: "\n# Transpile Guide\n\nStep-by-step transpile instructions.",
      });

      const { lastFrame, unmount } = render(
        React.createElement(App, {
          args: ["help", "guide/transpile"],
        }),
      );

      const output = lastFrame()!;

      expect(output).toContain("Transpile Guide");
      expect(output).toContain("Step-by-step transpile instructions");
      expect(output).not.toContain("Available help topics:");
      expect(output).not.toContain("Transpiling for");
      expect(process.exitCode).toBeUndefined();

      unmount();
    });

    // =====================================================================
    // Граничное условие: description из frontmatter (не из H1)
    // § help-command.md § Команда help § Поведение шаг 6
    // =====================================================================

    it("берёт description из frontmatter, а не из первой строки после H1", () => {
      createDocFile(guideDir, "desc-test.md", {
        title: "Desc Test",
        description: "Frontmatter description value",
        body: "\n# Title\n\nBody text that is not description.",
      });

      const { lastFrame, unmount } = render(React.createElement(App, { args: ["help"] }));

      const output = lastFrame()!;

      // Description из frontmatter
      expect(output).toContain("Frontmatter description value");
      // Body текст не является описанием в списке topics
      // (он может быть в output если содержится где-то в formatting,
      // но строка topic должна содержать frontmatter description)
      const topicLine = output.split("\n").find((l) => l.includes("guide/desc-test"));
      expect(topicLine).toBeDefined();
      expect(topicLine).toContain("Frontmatter description value");

      unmount();
    });

    // =====================================================================
    // Граничное условие: пустая строка между категориями
    // § help-command.md § Вывод списка topics: между категориями — пустая строка
    // =====================================================================

    it("между категориями в списке topics присутствует пустая строка", () => {
      createDocFile(guideDir, "intro.md", {
        title: "Intro",
        description: "Introduction",
      });
      createDocFile(referenceDir, "api.md", {
        title: "API",
        description: "API reference",
      });

      const { lastFrame, unmount } = render(React.createElement(App, { args: ["help"] }));

      const output = lastFrame()!;

      // Между последним topic Guide и заголовком Reference — пустая строка
      // Паттерн: строка с guide/intro, затем пустая строка, затем "  Reference:"
      expect(output).toMatch(/guide\/intro.*\n\n {2}Reference:/s);

      unmount();
    });

    // =====================================================================
    // Расширение 7a: Ни один TopicEntry не имеет prev === undefined (head не найден)
    // → все topics считаются orphans, сортируются по slug алфавитно
    // § help-command.md § Команда help § Расширения 7a
    // =====================================================================

    it("при отсутствии head (все topics имеют prev) все topics сортируются алфавитно как orphans", () => {
      // Все три файла имеют prev → нет head
      createDocFile(guideDir, "charlie.md", {
        title: "Charlie",
        description: "Charlie topic",
        prev: "bravo",
        next: "delta",
      });
      createDocFile(guideDir, "bravo.md", {
        title: "Bravo",
        description: "Bravo topic",
        prev: "alpha",
        next: "charlie",
      });
      createDocFile(guideDir, "delta.md", {
        title: "Delta",
        description: "Delta topic",
        prev: "charlie",
      });

      const { lastFrame, unmount } = render(React.createElement(App, { args: ["help"] }));

      const output = lastFrame()!;

      // Все три должны быть в выводе
      expect(output).toContain("guide/bravo");
      expect(output).toContain("guide/charlie");
      expect(output).toContain("guide/delta");

      // Все orphans → алфавитный порядок: bravo, charlie, delta
      const bravoIdx = output.indexOf("guide/bravo");
      const charlieIdx = output.indexOf("guide/charlie");
      const deltaIdx = output.indexOf("guide/delta");
      expect(bravoIdx).toBeLessThan(charlieIdx);
      expect(charlieIdx).toBeLessThan(deltaIdx);

      unmount();
    });

    // =====================================================================
    // Расширение 7b: Несколько heads (более одного topic без prev)
    // → первый по алфавитному порядку slug становится head,
    //   остальные heads, не достижимые из head через next-цепочку, → orphans
    // § help-command.md § Команда help § Расширения 7b
    // =====================================================================

    it("при нескольких heads выбирает алфавитно первый, остальные становятся orphans", () => {
      // "alpha" и "charlie" оба без prev → два head-кандидата
      // Алфавитно первый = alpha → alpha становится head
      createDocFile(guideDir, "charlie.md", {
        title: "Charlie",
        description: "Charlie topic",
        next: "delta",
      });
      createDocFile(guideDir, "alpha.md", {
        title: "Alpha",
        description: "Alpha topic",
        next: "bravo",
      });
      createDocFile(guideDir, "bravo.md", {
        title: "Bravo",
        description: "Bravo topic",
        prev: "alpha",
      });
      createDocFile(guideDir, "delta.md", {
        title: "Delta",
        description: "Delta topic",
        prev: "charlie",
      });

      const { lastFrame, unmount } = render(React.createElement(App, { args: ["help"] }));

      const output = lastFrame()!;

      // Цепочка от alpha: alpha → bravo
      // charlie не достижим из alpha → orphan
      // delta не достижим из alpha → orphan
      // Порядок: alpha, bravo, charlie, delta (orphans алфавитно)
      const alphaIdx = output.indexOf("guide/alpha");
      const bravoIdx = output.indexOf("guide/bravo");
      const charlieIdx = output.indexOf("guide/charlie");
      const deltaIdx = output.indexOf("guide/delta");

      expect(alphaIdx).toBeGreaterThan(-1);
      expect(bravoIdx).toBeGreaterThan(-1);
      expect(charlieIdx).toBeGreaterThan(-1);
      expect(deltaIdx).toBeGreaterThan(-1);

      // alpha и bravo в цепочке, перед orphans
      expect(alphaIdx).toBeLessThan(bravoIdx);
      // orphans (charlie, delta) после цепочки, алфавитно
      expect(bravoIdx).toBeLessThan(charlieIdx);
      expect(charlieIdx).toBeLessThan(deltaIdx);

      unmount();
    });

    // =====================================================================
    // Расширение 7c: next-указатель ссылается на несуществующий slug
    // → цепочка обрывается, оставшиеся topics → orphans
    // § help-command.md § Команда help § Расширения 7c
    // =====================================================================

    it("при broken next-ссылке цепочка обрывается, оставшиеся topics становятся orphans", () => {
      // alpha → bravo → (next: "nonexistent") — цепочка обрывается
      // charlie не в цепочке → orphan
      createDocFile(guideDir, "alpha.md", {
        title: "Alpha",
        description: "Alpha topic",
        next: "bravo",
      });
      createDocFile(guideDir, "bravo.md", {
        title: "Bravo",
        description: "Bravo topic",
        prev: "alpha",
        next: "nonexistent",
      });
      createDocFile(guideDir, "charlie.md", {
        title: "Charlie",
        description: "Charlie topic",
        prev: "bravo",
      });

      const { lastFrame, unmount } = render(React.createElement(App, { args: ["help"] }));

      const output = lastFrame()!;

      // Все три topics должны быть в выводе
      expect(output).toContain("guide/alpha");
      expect(output).toContain("guide/bravo");
      expect(output).toContain("guide/charlie");

      // Цепочка: alpha → bravo (обрывается на nonexistent)
      // charlie → orphan (показывается после цепочки)
      const alphaIdx = output.indexOf("guide/alpha");
      const bravoIdx = output.indexOf("guide/bravo");
      const charlieIdx = output.indexOf("guide/charlie");

      expect(alphaIdx).toBeLessThan(bravoIdx);
      expect(bravoIdx).toBeLessThan(charlieIdx);

      unmount();
    });

    // =====================================================================
    // Граничное условие: только .md файлы включаются (шаг 4)
    // § help-command.md § Команда help § Поведение шаг 4
    // =====================================================================

    it("включает только .md файлы, игнорируя другие расширения", () => {
      createDocFile(guideDir, "valid.md", {
        title: "Valid",
        description: "Valid topic",
      });
      // Создаём .txt файл — не должен попасть в список
      fs.writeFileSync(
        path.join(guideDir, "invalid.txt"),
        "---\ntitle: Invalid\ndescription: Should not appear\n---\n\nContent.",
        "utf-8",
      );

      const { lastFrame, unmount } = render(React.createElement(App, { args: ["help"] }));

      const output = lastFrame()!;

      expect(output).toContain("guide/valid");
      expect(output).not.toContain("guide/invalid");

      unmount();
    });
  });
});
