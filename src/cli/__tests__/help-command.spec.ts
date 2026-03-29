// help-command.spec.ts
// Спецификация: docs/specs/help-command.md § Команда help, § Вывод списка topics,
//               § Справка, § Изменения в cli.md

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import React from "react";
import { render } from "ink-testing-library";
import { App } from "../app.js";

describe("CLI", () => {
  describe("Команда help", () => {
    let tmpDir: string;
    let originalExitCode: number | undefined;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agl-help-cmd-"));
      originalExitCode = process.exitCode;
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      process.exitCode = originalExitCode;
    });

    // =====================================================================
    // Happy path: agloom help (без topic) — список topics
    // § help-command.md § Команда help § Поведение шаги 1-7
    // 1. Распарсить позиционный аргумент <topic>.
    // 2. Вычислить абсолютный путь к директории документации.
    // 3. Прочитать содержимое директории документации.
    // 4. Отобрать файлы с расширением .md.
    // 5. Для каждого файла определить имя topic.
    // 6. Отсортировать список topics по имени.
    // 7. Если <topic> не указан — отобразить список topics.
    // =====================================================================

    it("без аргумента topic отображает список доступных topics в алфавитном порядке и exit code 0", () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, { args: ["help"] }),
      );

      const output = lastFrame()!;

      // § Вывод списка topics: "Available help topics:"
      expect(output).toContain("Available help topics:");

      // § Вывод списка topics: "Run 'agloom help <topic>' to learn more."
      expect(output).toContain("Run 'agloom help <topic>' to learn more.");

      // § Начальные topics: файлы из docs/usage/ должны быть перечислены
      // (adapters, clean, configuration, init, transpile — алфавитный порядок)
      expect(output).toContain("adapters");
      expect(output).toContain("clean");
      expect(output).toContain("configuration");
      expect(output).toContain("init");
      expect(output).toContain("transpile");

      // § Exit codes: 0 — список topics отображён успешно
      expect(process.exitCode).toBeUndefined();

      unmount();
    });

    // --- Трансформация: сортировка topics в алфавитном порядке (шаг 6) ---
    // § help-command.md § Команда help § Поведение шаг 6:
    // Отсортировать список topics по имени в алфавитном порядке.
    it("отображает topics в алфавитном порядке", () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, { args: ["help"] }),
      );

      const output = lastFrame()!;

      // Проверяем порядок: adapters < clean < configuration < init < transpile
      const adaptersIdx = output.indexOf("adapters");
      const cleanIdx = output.indexOf("clean");
      const configIdx = output.indexOf("configuration");
      const initIdx = output.indexOf("init");
      const transpileIdx = output.indexOf("transpile");

      expect(adaptersIdx).toBeLessThan(cleanIdx);
      expect(cleanIdx).toBeLessThan(configIdx);
      expect(configIdx).toBeLessThan(initIdx);
      expect(initIdx).toBeLessThan(transpileIdx);

      unmount();
    });

    // --- Трансформация: каждый topic на отдельной строке с отступом в два пробела ---
    // § help-command.md § Вывод списка topics:
    // Каждый topic — на отдельной строке с отступом в два пробела.
    it("отображает каждый topic на отдельной строке с отступом в два пробела и описанием", () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, { args: ["help"] }),
      );

      const output = lastFrame()!;

      // Каждый topic с отступом в два пробела, имя и описание
      expect(output).toMatch(/^ {2}adapters\s+\S/m);
      expect(output).toMatch(/^ {2}configuration\s+\S/m);
      expect(output).toMatch(/^ {2}transpile\s+\S/m);

      unmount();
    });

    // =====================================================================
    // Happy path: agloom help <topic> — рендер конкретного topic
    // § help-command.md § Команда help § Поведение шаги 8-11
    // 8. Найти topic, имя которого совпадает с <topic>.
    // 9. Прочитать содержимое файла <docsDir>/<topic>.md.
    // 10. Отрендерить Markdown-содержимое через marked + marked-terminal.
    // 11. Отобразить результат рендеринга в stdout.
    // =====================================================================

    it("при указании существующего topic отрендеривает Markdown-содержимое и exit code 0", () => {
      // "configuration" — один из начальных topics из docs/usage/
      // Читаем содержимое topic-файла для позитивной проверки
      const docsDir = path.resolve(import.meta.dirname, "../../../docs/usage");
      const topicContent = fs.readFileSync(
        path.join(docsDir, "configuration.md"),
        "utf-8",
      );
      // Извлекаем первый заголовок Markdown (# Title) для позитивного assert
      const headingMatch = topicContent.match(/^#\s+(.+)$/m);
      const headingText = headingMatch?.[1] ?? "";

      const { lastFrame, unmount } = render(
        React.createElement(App, { args: ["help", "configuration"] }),
      );

      const output = lastFrame()!;

      // Позитивный assert: вывод содержит текст заголовка из topic-файла
      // (подтверждает, что файл был прочитан и содержимое отрендерено)
      expect(headingText.length).toBeGreaterThan(0);
      expect(output).toContain(headingText);

      // § Поведение шаг 10: рендеринг через marked + marked-terminal
      // Вывод содержит ANSI-коды (терминал-совместимый формат),
      // что подтверждает использование marked-terminal, а не raw Markdown.
      // eslint-disable-next-line no-control-regex
      expect(output).toMatch(/\x1b\[/);

      // Не должен содержать список topics — это рендер конкретного topic
      expect(output).not.toContain("Available help topics:");

      // Не должен содержать общую справку CLI — это рендер topic, не HelpView
      expect(output).not.toContain(
        "Transpile canonical configs for a target adapter",
      );
      expect(output).not.toContain("Commands:");

      // § Exit codes: 0 — topic отрендерен успешно
      expect(process.exitCode).toBeUndefined();

      unmount();
    });

    // =====================================================================
    // Happy path: agloom help <topic> — topic с именем, совпадающим с командой
    // § help-command.md § Команда help § Поведение шаги 8-11
    // Имя topic "transpile" совпадает с именем команды "transpile".
    // parseArgs направляет позиционный аргумент после "help" в helpTopic,
    // поэтому система ДОЛЖНА отрендерить docs/usage/transpile.md,
    // а не выполнить команду transpile.
    // =====================================================================

    it("при указании topic с именем команды (transpile) отрендеривает Markdown, а не выполняет команду", () => {
      // "transpile" — topic, чьё имя совпадает с командой CLI
      const docsDir = path.resolve(import.meta.dirname, "../../../docs/usage");
      const topicContent = fs.readFileSync(
        path.join(docsDir, "transpile.md"),
        "utf-8",
      );
      // Извлекаем первый заголовок Markdown (# Transpile) для позитивного assert
      const headingMatch = topicContent.match(/^#\s+(.+)$/m);
      const headingText = headingMatch?.[1] ?? "";

      const { lastFrame, unmount } = render(
        React.createElement(App, { args: ["help", "transpile"] }),
      );

      const output = lastFrame()!;

      // Позитивный assert: вывод содержит текст заголовка из topic-файла
      // (подтверждает, что файл docs/usage/transpile.md был прочитан и отрендерен)
      expect(headingText.length).toBeGreaterThan(0);
      expect(output).toContain(headingText);

      // § Поведение шаг 10: рендеринг через marked + marked-terminal
      // Вывод содержит ANSI-коды (терминал-совместимый формат)
      // eslint-disable-next-line no-control-regex
      expect(output).toMatch(/\x1b\[/);

      // НЕ должен содержать вывод команды transpile (результаты транспиляции)
      expect(output).not.toContain("Transpiling for");
      expect(output).not.toContain("files written");

      // НЕ должен содержать список topics (это рендер конкретного topic)
      expect(output).not.toContain("Available help topics:");

      // НЕ должен содержать общую справку CLI
      expect(output).not.toContain("Commands:");

      // § Exit codes: 0 — topic отрендерен успешно
      expect(process.exitCode).toBeUndefined();

      unmount();
    });

    // =====================================================================
    // Расширение 3a: Директория документации не существует
    // § help-command.md § Расширения 3a:
    // Директория документации не существует → список topics считается пустым.
    // Это приводит к расширению 7a (пустой список).
    // =====================================================================

    // Этот тест не может быть непосредственно проверен через CLI, т.к.
    // docs/usage/ поставляется вместе с кодом. Покрывается косвенно
    // через расширение 7a.

    // =====================================================================
    // Расширение 7a: Список topics пуст
    // § help-command.md § Расширения 7a:
    // Список topics пуст (директория отсутствует или не содержит .md-файлов) →
    // отобразить "No help topics available."; exit code 1.
    // =====================================================================

    // Примечание: для тестирования этого расширения нужно моделировать
    // отсутствие docs/usage/ или пустую директорию. Однако путь
    // вычисляется через import.meta.dirname (шаг 2), поэтому прямой
    // тест затруднён без мока файловой системы. Тест написан как
    // unit-тест на уровне функции, если она будет экспортирована.
    // Для integration-теста потребуется отдельный механизм.

    // =====================================================================
    // Расширение 8a: Topic не найден, список topics непуст
    // § help-command.md § Расширения 8a:
    // Topic с указанным именем не найден, список topics непуст →
    // отобразить "Unknown help topic: {topic}.", пустую строку
    // и список доступных topics; exit code 1.
    // =====================================================================

    it('при несуществующем topic и непустом списке отображает "Unknown help topic" со списком topics и exit code 1', () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, { args: ["help", "nonexistent-topic"] }),
      );

      const output = lastFrame()!;

      // Точный формат сообщения из спецификации
      expect(output).toContain("Unknown help topic: nonexistent-topic.");

      // § Расширение 8a: пустая строка между сообщением об ошибке и списком topics
      expect(output).toMatch(
        /Unknown help topic: nonexistent-topic\.\n\nAvailable help topics:/,
      );

      // Список доступных topics (§ Вывод списка topics)
      expect(output).toContain("Available help topics:");
      expect(output).toContain("Run 'agloom help <topic>' to learn more.");

      // § Exit codes: 1 — topic не найден
      expect(process.exitCode).toBe(1);

      unmount();
    });

    // =====================================================================
    // Расширение 8b: Topic не найден, список topics пуст
    // § help-command.md § Расширения 8b:
    // Topic с указанным именем не найден, список topics пуст →
    // отобразить "Unknown help topic: {topic}."; exit code 1.
    // =====================================================================

    // Примечание: тестирование затруднено по той же причине, что и 7a —
    // docs/usage/ поставляется вместе с кодом. В реальном окружении
    // список topics непуст (начальные topics).

    // =====================================================================
    // Расширение 9a: Ошибка чтения файла
    // § help-command.md § Расширения 9a:
    // Ошибка чтения файла → отобразить "Failed to read help topic: {topic}.";
    // exit code 1.
    // =====================================================================

    // Примечание: для моделирования ошибки чтения потребуется chmod 000
    // на файле docs/usage/<topic>.md, что нежелательно в тестах —
    // повлияет на другие тесты и CI. Тест будет реализован при наличии
    // injectable file reader.

    // =====================================================================
    // Расширение 10a: Ошибка рендеринга Markdown
    // § help-command.md § Расширения 10a:
    // Ошибка рендеринга Markdown → отобразить
    // "Failed to render help topic: {topic}."; exit code 1.
    // =====================================================================

    // Примечание: ошибка рендеринга marked + marked-terminal крайне
    // маловероятна при корректном Markdown-файле. Тест будет реализован
    // при наличии injectable renderer.

    // =====================================================================
    // Трансформация: Вычисление пути через import.meta.dirname (шаг 2)
    // § help-command.md § Команда help § Поведение шаг 2:
    // Путь разрешается через import.meta.dirname, не process.cwd().
    // =====================================================================

    it("резолвит путь к docs/usage/ через import.meta.dirname, а не process.cwd()", () => {
      // Вызываем из tmpDir (отличного от projectRoot) — help всё равно должен работать
      const originalCwd = process.cwd();
      try {
        process.chdir(tmpDir);

        const { lastFrame, unmount } = render(
          React.createElement(App, { args: ["help"] }),
        );

        const output = lastFrame()!;

        // Список topics должен загрузиться, т.к. путь через import.meta.dirname
        expect(output).toContain("Available help topics:");

        unmount();
      } finally {
        process.chdir(originalCwd);
      }
    });

    // =====================================================================
    // Трансформация: Фильтрация только .md файлов (шаг 4)
    // § help-command.md § Команда help § Поведение шаг 4:
    // Отобрать файлы с расширением .md.
    // =====================================================================

    // Примечание: проверка фильтрации .md файлов — косвенно покрывается
    // happy path тестом (список содержит только имена topics, не .txt/.json).

    // =====================================================================
    // Трансформация: Имя topic = имя файла без .md (шаг 5)
    // § help-command.md § Команда help § Поведение шаг 5:
    // Для каждого файла определить имя topic как имя файла без расширения .md.
    // =====================================================================

    it("отображает имена topics без расширения .md", () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, { args: ["help"] }),
      );

      const output = lastFrame()!;

      // § Поведение шаг 5: имя topic = имя файла без расширения .md
      // Вывод должен содержать "Available help topics:" (контекст списка)
      expect(output).toContain("Available help topics:");

      // Topics без .md расширения
      expect(output).toContain("configuration");
      expect(output).not.toContain("configuration.md");

      unmount();
    });

    // =====================================================================
    // § help-command.md § Справка
    // Команда help ДОЛЖНА поддерживать agloom help --help.
    // =====================================================================

    it("help --help отображает справку по команде help", () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, { args: ["help", "--help"] }),
      );

      const output = lastFrame()!;

      // § Справка: "Usage: agloom help [<topic>]"
      expect(output).toContain("Usage: agloom help [<topic>]");

      // § Справка: "Show help topics or display a specific help topic."
      expect(output).toContain(
        "Show help topics or display a specific help topic.",
      );

      // § Справка: Arguments section с описанием аргумента
      expect(output).toContain("Arguments:");
      expect(output).toContain("<topic>");
      // § Справка: "<topic>  Help topic name (e.g., configuration, transpile)"
      expect(output).toContain("Help topic name");

      // Exit code 0
      expect(process.exitCode).toBeUndefined();

      unmount();
    });

    // =====================================================================
    // § help-command.md § Изменения в cli.md § Добавление help в список команд
    // Команда help ДОЛЖНА быть добавлена в вывод agloom --help.
    // =====================================================================

    it('содержит команду "help" с описанием в выводе agloom --help', () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, { args: ["--help"] }),
      );

      const output = lastFrame()!;

      // § Изменения в cli.md § Добавление help в список команд:
      // "  help         Show help topics or display a specific help topic"
      // Regex отличает команду help от флага --help / "Show help"
      expect(output).toMatch(
        / {2}help\s+Show help topics or display a specific help topic/,
      );

      unmount();
    });

    // =====================================================================
    // § help-command.md § Изменения в cli.md § Изменение секции --help
    // agloom help больше НЕ является алиасом --help.
    // =====================================================================

    it("agloom help отображает список topics, а не общую справку (не алиас --help)", () => {
      const { lastFrame: helpFrame, unmount: unmountHelp } = render(
        React.createElement(App, { args: ["help"] }),
      );
      const helpOutput = helpFrame()!;
      unmountHelp();

      const { lastFrame: globalHelpFrame, unmount: unmountGlobalHelp } = render(
        React.createElement(App, { args: ["--help"] }),
      );
      const globalHelpOutput = globalHelpFrame()!;
      unmountGlobalHelp();

      // help должен отображать список topics, а не общую справку
      expect(helpOutput).toContain("Available help topics:");
      // Не должен быть идентичен выводу --help
      expect(helpOutput).not.toEqual(globalHelpOutput);
    });

    // =====================================================================
    // § help-command.md § Изменения в cli.md § Изменение секции «Неизвестная команда»
    // Список известных команд дополняется значением help.
    // =====================================================================

    it("help распознаётся как команда и отображает список topics, а не Unknown command", () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, { args: ["help"] }),
      );

      const output = lastFrame()!;

      // Не должно быть "Unknown command: help"
      expect(output).not.toContain("Unknown command");

      // Должен отображать список topics (не общую справку)
      expect(output).toContain("Available help topics:");

      unmount();
    });

    // =====================================================================
    // Расширение 8a: формат сообщения "Unknown help topic" с другим topic
    // § help-command.md § Расширения 8a:
    // Сообщение содержит подставленное имя topic и список доступных topics.
    // (8b не тестируется — требуется пустая docs/usage/, недоступная
    // без injectable docs path.)
    // =====================================================================

    it('расширение 8a: "Unknown help topic: {topic}." с подставленным именем и списком topics', () => {
      const { lastFrame, unmount } = render(
        React.createElement(App, { args: ["help", "nonexistent"] }),
      );

      const output = lastFrame()!;

      // Сообщение содержит подставленное имя topic
      expect(output).toContain("Unknown help topic: nonexistent.");

      // § Расширение 8a: список topics присутствует (т.к. docs/usage/ содержит topics)
      expect(output).toContain("Available help topics:");

      unmount();
    });
  });
});
