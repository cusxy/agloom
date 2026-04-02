---
type: research
summary: Стратегии поставки пользовательской документации CLI-инструментов через npm package
description: >
  Анализ подходов production-ready Node.js CLI к documentation delivery:
  man pages, bundled docs, AI-native файлы, single-source pipeline.
  Включает эмпирические данные из 10+ production пакетов.
---

# Исследование: Documentation Delivery для CLI через npm

Дата: 2026-03-29

## Контекст исследования

### Проблема

Agloom — TypeScript CLI-инструмент (Ink/React), текущая конфигурация:
`"files": ["dist"]`. Документация доступна только на GitHub. При `npm install`
пользователь получает исполняемый файл без встроенной справки, man pages
или AI-совместимых файлов.

### Мотивация

Современные CLI-инструменты обслуживают два типа «пользователей»: людей
(терминал, `--help`, `man`) и AI-агентов (Claude Code, Cursor, Copilot).
Стратегия documentation delivery определяет, насколько эффективно оба типа
находят и используют справочную информацию.

### Цель

Определить оптимальную стратегию documentation delivery для agloom,
учитывая: доступность при `npm install`, совместимость с AI-инструментами,
maintenance burden и влияние на размер пакета.

### Границы

- Только Node.js/TypeScript CLI-инструменты, распространяемые через npm.
- Не рассматриваются: website-генерация (MkDocs, Docusaurus), API-документация.

## Критерии оценки

Определены до анализа объектов (защита от anchoring bias).

| #   | Критерий                | Описание                                               | Вес  |
| --- | ----------------------- | ------------------------------------------------------ | ---- |
| C1  | Zero-config доступность | Документация доступна сразу после `npm install -g`     | High |
| C2  | AI-совместимость        | AI-инструменты могут читать и индексировать формат     | High |
| C3  | Maintenance burden      | Стоимость поддержки pipeline, количество источников    | Med  |
| C4  | Package size impact     | Влияние на размер npm tarball                          | Med  |
| C5  | Discoverability         | Пользователь находит документацию без внешних ресурсов | Med  |
| C6  | Single-source потенциал | Генерация нескольких форматов из одного источника      | Low  |

## Объекты анализа

Пять подходов, выделенных на основе анализа 10+ production CLI-пакетов:

| #   | Подход                      | Эталонный пакет  | Файл анализа                                               |
| --- | --------------------------- | ---------------- | ---------------------------------------------------------- |
| A1  | Web-Only (dist + README)    | eslint, prettier | [approaches/web-only.md](approaches/web-only.md)           |
| A2  | Man Pages + In-Package Docs | npm              | [approaches/man-pages.md](approaches/man-pages.md)         |
| A3  | Bundled Markdown Docs       | next             | [approaches/bundled-docs.md](approaches/bundled-docs.md)   |
| A4  | AI-Native Files             | (emerging)       | [approaches/ai-native.md](approaches/ai-native.md)         |
| A5  | Single-Source Pipeline      | mise (usage-cli) | [approaches/single-source.md](approaches/single-source.md) |

## Сравнительная таблица

| Критерий            | A1 Web-Only | A2 Man Pages | A3 Bundled Docs | A4 AI-Native | A5 Single-Source |
| ------------------- | ----------- | ------------ | --------------- | ------------ | ---------------- |
| C1 Zero-config      | Low         | High (POSIX) | High            | Medium       | High             |
| C2 AI-совместимость | Low         | Low          | High            | High         | High             |
| C3 Maintenance      | Minimal     | Medium       | Medium          | Low          | High (setup)     |
| C4 Package size     | Minimal     | +0.5-1 MB    | +1-3 MB         | +5-20 KB     | +0.5-3 MB        |
| C5 Discoverability  | Low         | High         | High            | Medium       | High             |
| C6 Single-source    | N/A         | Partial      | No              | No           | Full             |

**Легенда**: Low/Medium/High — относительная оценка в контексте agloom.

## Эмпирические данные: Production CLI пакеты

Данные собраны 2026-03-29 через `npm view <pkg> --json` (unpacked size,
man field) и `npm pack <pkg> --dry-run` (перечень файлов, размеры).
Верифицировано для 10 пакетов из npm registry (latest versions).

| Пакет          | Unpacked | Man | Docs             | Shell Compl. | Schema |
| -------------- | -------- | --- | ---------------- | ------------ | ------ |
| npm            | 11.0 MB  | 89  | MD+HTML          | bash, fish   | —      |
| pnpm           | 18.9 MB  | —   | —                | 4 shells     | —      |
| eslint         | 2.9 MB   | —   | —                | —            | —      |
| prettier       | 8.6 MB   | —   | —                | —            | —      |
| turbo          | 47.1 KB  | —   | —                | —            | 31 KB  |
| next (16.2)    | 154 MB   | —   | 2.5 MB (391 .md) | —            | —      |
| @biomejs/biome | 669 KB   | —   | —                | —            | 508 KB |
| vercel         | 8.3 MB   | —   | —                | —            | —      |
| vitest         | 1.9 MB   | —   | —                | —            | —      |
| tsx            | 432 KB   | —   | —                | —            | —      |

Ключевое наблюдение: из 10 пакетов только **npm** поставляет man pages,
только **next** поставляет bundled documentation (с версии 16.2).
Остальные 8 используют подход Web-Only.

Дополнительные артефакты, не являющиеся documentation delivery в узком
смысле, но повышающие developer experience: **shell completions** (npm, pnpm —
4 shell'а) и **JSON Schema** для config-файлов (turbo — 31 KB, biome — 508 KB).
Эти артефакты выходят за границы данного исследования, но представляют
интерес для отдельного анализа CLI developer experience.

## Заключение

### Рекомендуемая стратегия для agloom

**A4 (AI-Native) + элементы A5 (Single-Source)** — оптимальный баланс
для проекта текущего масштаба.

### Обоснование

1. **AI-совместимость — приоритет #1 для agloom.** Agloom — инструмент
   для AI coding assistants. Пользователи agloom — разработчики,
   активно использующие Claude Code, Cursor, Copilot. Поставка AGENTS.md
   и CLAUDE.md в npm-пакете обеспечивает максимальную релевантность
   для целевой аудитории.

2. **Минимальный overhead.** AI-native файлы добавляют 5-20 KB к пакету
   (ничтожно при текущем `dist`). Man pages добавили бы ~0.5 MB и build step
   при сомнительной ценности (единственный пользователь man pages
   в Node.js экосистеме — npm).

3. **Markdown как single source.** Документация в `docs/` может служить
   источником для: (a) `--help` рендеринга через `marked-terminal`,
   (b) AGENTS.md генерации, (c) website (будущее). Man pages НЕ рекомендуются
   на текущем этапе — их добавление оправдано только при значительном росте
   пользовательской базы за пределами AI-инструментов.

### Риски рекомендуемого подхода

1. **Фрагментация форматов.** AGENTS.md не является native для Claude Code
   (читается через SDK, не как CLAUDE.md). Поддержка может деградировать
   при смене приоритетов vendor'ов.
2. **Молодость конвенции.** AGENTS.md stewarded by Linux Foundation с 2025,
   но стандарт может существенно измениться. Формат llms.txt не принят
   ни одним major AI vendor как обязательный.
3. **Ограниченное покрытие non-AI пользователей.** Подход A4 не помогает
   пользователям без AI-инструментов. Man pages и rich `--help` остаются
   единственным способом offline documentation для этой аудитории.
4. **marked-terminal как зависимость.** Добавляет runtime dependency
   для help subcommand. При проблемах с совместимостью (marked major version
   bump) потребуется обновление.

### Конкретный план

1. Добавить в `files`: `["dist", "docs/usage", "AGENTS.md"]`.
2. Создать `AGENTS.md` в корне проекта с инструкциями для AI-агентов
   и ссылками на `docs/usage/*.md`.
3. Реализовать `agloom help <topic>` через `marked-terminal` для рендеринга
   Markdown из `docs/usage/` в терминал.
4. Генерировать `llms.txt` при публикации website (будущее).

### Отложенные решения

- **Man pages**: добавить при достижении > 1000 weekly downloads.
- **Bundled full docs (A3)**: добавить при появлении потребности
  в version-matched документации в `node_modules`.

## Источники

- [npm package.json docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/)
- [AGENTS.md — official spec](https://agents.md/)
- [GitHub Blog: How to write a great agents.md](https://github.blog/ai-and-ml/github-copilot/how-to-write-a-great-agents-md-lessons-from-over-2500-repositories/)
- [Next.js 16.2: AI Improvements](https://nextjs.org/blog/next-16-2-ai)
- [llmstxt.org — llms.txt specification](https://llmstxt.org/)
- [marked-terminal — npm](https://www.npmjs.com/package/marked-terminal)
- [marked-man — npm](https://www.npmjs.com/package/marked-man)
- [usage CLI — jdx](https://usage.jdx.dev)
- [Claude Code CLAUDE.md docs](https://claude.com/blog/using-claude-md-files)
- [npm help command docs](https://docs.npmjs.com/cli/v7/commands/npm-help/)
- [How to Ship man pages with Node Programs](https://dev.to/hughrawlinson/how-to-ship-man-pages-with-your-node-programs-3j4g)
