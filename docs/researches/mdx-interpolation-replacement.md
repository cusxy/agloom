---
type: research
summary: Замена системы интерполяции ${agloom:VAR} на MDX для транспиляции canonical файлов
description: >
  Анализ подходов к замене текущей системы интерполяции переменных
  (${agloom:VAR}, ${env:VAR}) на MDX или альтернативные решения.
  Рассматриваются MDX (compile + custom JSX runtime), remark-directive
  с custom plugins и шаблонизаторы (LiquidJS). Содержит рекомендацию
  по выбору подхода для Agloom CLI.
relates:
  - docs/specs/interpolation.md
---

# Исследование: замена интерполяции на MDX

Дата: 2026-03-31

## Контекст исследования

**Проблема.** Текущая интерполяция Agloom (`${agloom:VAR}`, `${env:VAR}`) —
простой string replacement (185 строк, 0 зависимостей). Покрывает подстановку
путей и env-переменных, но не поддерживает динамическую генерацию контента.

**Мотивация.** Ключевой use-case: автоматическая генерация index-секций
в AGLOOM.md — перечисление ссылок на файлы документации повышает качество
работы AI-модели, но ручное ведение списков трудоёмко.

**Цель.** Определить, оправдана ли замена текущей интерполяции на MDX
или альтернативный подход с динамической генерацией контента.

**Границы.** Server-side (CLI) обработка при транспиляции. Выход — plain
Markdown. Оба формата входных файлов (`.md`, `.mdx`). Полная замена
интерполяции, не дополнение.

## Критерии оценки

Критерии определены до анализа объектов (защита от anchoring bias).

| #   | Критерий             | Описание                                                     | Вес     |
| --- | -------------------- | ------------------------------------------------------------ | ------- |
| K1  | Pipeline fit         | Встраиваемость в discover-transform-write pipeline           | Высокий |
| K2  | Output compatibility | Гарантия plain Markdown на выходе (без JSX, HTML-артефактов) | Высокий |
| K3  | Index generation     | Поддержка динамической генерации контента (file listing)     | Высокий |
| K4  | Bundle overhead      | Размер зависимостей, количество transitive deps              | Средний |
| K5  | DX / Authoring       | Удобство авторинга canonical файлов, IDE support             | Средний |
| K6  | Migration cost       | Объём изменений в кодовой базе, обратная совместимость       | Средний |
| K7  | Maintainability      | Сложность поддержки, coupling с внешними библиотеками        | Средний |

## Объекты анализа

### 1. MDX с custom JSX runtime (mdx-to-md)

**Описание.** Использование `@mdx-js/mdx` для компиляции `.mdx` файлов
в JavaScript, с последующим выполнением через custom JSX runtime,
возвращающий plain Markdown строки вместо React-элементов.

**Механизм.** `compile(source, {outputFormat: 'function-body'})` производит
JS-код. Функция `run()` с custom `jsx`/`jsxs`/`Fragment` конвертирует
компоненты (`<DocIndex path="..." />`) в Markdown-строки.

**Плюсы:**

- Полная выразительность JSX: импорты, выражения, произвольная логика.
- Знакомый синтаксис для разработчиков React-экосистемы.
- Зрелая экосистема: 10M+ загрузок/месяц, активная поддержка.

**Минусы:**

- Тяжёлый: 96.3 kB min+gz, 24 transitive deps. Текущий Agloom имеет
  8 runtime-зависимостей (`package.json` § dependencies) — рост ~30%.
- MDX компилирует в JS, а не в MD. Требуется custom JSX runtime —
  нестандартное использование, слабо документировано, хрупкость при обновлениях.
- Pipeline усложнение: parse MDX -> compile to JS -> evaluate -> string.
  Текущий pipeline — single-pass regex replacement.
- Валидация `.mdx` файлов: стандартный Markdown-линтинг (markdownlint)
  не работает с JSX-вставками. IDE support требует плагина MDX.
- Фронтматтер: MDX не поддерживает YAML front matter нативно,
  требуется `remark-frontmatter` плагин.
- Overkill: для задачи «подстановка переменных + file listing» полная
  MDX-компиляция с JS-выполнением избыточна.

**Контекст применимости.** Оправдан при необходимости произвольной логики
в шаблонах (циклы, условия, импорты). Не оправдан для ограниченного набора
предзаданных операций.

### 2. remark-directive с custom remark plugins

**Описание.** Использование `remark` (unified) с плагином `remark-directive`
для парсинга директив в Markdown-синтаксисе и custom remark-плагинов
для их обработки. Входной и выходной формат — Markdown.

**Механизм.** Автор пишет директиву `::doc-index{path=".agloom/docs/"}`
в `.md` файле. Плагин `remark-directive` парсит её в AST-узел.
Custom remark-плагин обрабатывает узел: читает директорию, генерирует
MDAST-список ссылок, подставляет в дерево. `remark-stringify` сериализует
обратно в Markdown.

**Плюсы:**

- Нативный Markdown-in, Markdown-out pipeline: вход и выход — `.md`.
- Лёгкий: `remark-directive` — 20 kB, 4 direct deps (npm, v4.0.0).
  `remark` — ~30 kB.
- Расширяемость через plugin API: каждая операция — отдельный плагин.
- Директивный синтаксис основан на Generic Directives proposal
  (CommonMark forum discussion, не принятый стандарт).
- Безопасность: нет eval/arbitrary code execution.

**Минусы:**

- Новая dependency chain: unified + remark-parse + remark-stringify +
  remark-directive + mdast-util-\* — суммарно ~15 transitive deps.
- Директивный синтаксис непривычен авторам: `::directive{attr="val"}`
  менее читаем, чем JSX `<Component attr="val" />` или `${var}`.
- Потребуется написать custom remark-плагины для каждой операции
  (doc-index, переменные). Работа с MDAST API требует знания unified.
- Текущую интерполяцию `${agloom:VAR}` нельзя выразить директивами
  inline без `:var[AGENTS_DIR]{ns="agloom"}` — более громоздко.
- YAML front matter: `remark-frontmatter` требуется как отдельный плагин.

**Контекст применимости.** Оправдан при необходимости Markdown-native
расширений с гарантией Markdown-выхода. Не оправдан при требовании
минимального dependency footprint.

### 3. Шаблонизатор (LiquidJS)

**Описание.** Использование LiquidJS (Shopify-совместимый шаблонизатор)
для обработки canonical файлов. Переменные и custom tags заменяют
текущую интерполяцию и обеспечивают динамическую генерацию.

**Механизм.** Автор пишет `{{ agloom.AGENTS_DIR }}` для переменных
и `{% doc_index path=".agloom/docs/" %}` для генерации. LiquidJS
парсит шаблон, выполняет custom tags (зарегистрированные в runtime),
выводит plain text.

**Плюсы:**

- Зрелый шаблонизатор: ~1.4M загрузок/неделю, активно поддерживается.
- 1 runtime dependency (`commander`), минимальный dependency footprint.
- Custom tags API: `engine.registerTag('doc_index', ...)` — простой
  механизм расширения для file listing и подобных операций.
- Вывод — plain text, нет промежуточной конвертации через JS/AST.
- Знакомый синтаксис `{{ var }}` / `{% tag %}` для тех, кто работал
  с Jekyll, Shopify, Eleventy.

**Минусы:**

- Размер: ~73 kB min / ~22 kB min+gz. Больше, чем remark-directive,
  но значительно меньше MDX.
- Конфликт синтаксиса: `{{ }}` и `{% %}` могут конфликтовать
  с YAML front matter и кодовыми блоками в Markdown.
  Требуется настройка delimiters или raw-блоки.
- Шаблонизатор не понимает структуру Markdown — оперирует plain text.
  Ошибка в шаблоне может породить невалидный Markdown.
- Liquid-синтаксис не является расширением Markdown — это отдельный
  язык, наложенный поверх. IDE не покажет ошибки Markdown+Liquid вместе.
- Миграция с `${agloom:VAR}` на `{{ agloom.AGENTS_DIR }}` затрагивает
  все canonical файлы. Синтаксис `{{ }}` визуально отличается от `${}`
  и требует обновления документации.

**Контекст применимости.** Оправдан при необходимости шаблонной логики
(циклы, условия, фильтры) без привязки к JSX/Markdown AST. Не оправдан
при требовании Markdown-aware обработки.

### 4. Расширение текущей системы (regex + custom handlers)

**Описание.** Расширение существующей интерполяции custom-директивами
вида `${agloom:doc-index(.agloom/docs/)}` с обработчиками, генерирующими
Markdown-контент. Без внешних зависимостей.

**Механизм.** Regex-паттерн расширяется для распознавания функциональных
вызовов. Handler-реестр маппит имена операций на функции-генераторы.
Функция `doc-index` читает директорию и возвращает Markdown-список.

**Плюсы:**

- Zero new dependencies: решение в рамках существующих 185 строк кода.
- Минимальная миграция: текущий синтаксис `${agloom:VAR}` сохраняется,
  добавляются новые паттерны.
- Pipeline не меняется: single-pass regex replacement.
- Полный контроль: нет coupling с внешними AST-форматами или runtime.

**Минусы:**

- Regex-based парсинг ограничен: вложенные скобки, escape-последовательности,
  edge cases усложняют регулярные выражения.
- Нет AST: ошибки в генерируемом контенте не валидируются
  как корректный Markdown.
- Ad-hoc расширение: каждая новая операция — новый regex-паттерн
  и handler. Нет стандартизированного plugin API.
- Масштабируемость: при росте числа операций regex-подход становится
  хрупким и трудноподдерживаемым.
- Нестандартный синтаксис: `${agloom:doc-index(...)}` — проприетарный,
  нет IDE support, нет lint tools.

**Контекст применимости.** Оправдан при ограниченном числе операций
(1-3 custom handlers) и приоритете минимального footprint.
Не оправдан при ожидании роста числа расширений.

## Сравнительная таблица

| Критерий           | MDX + custom runtime | remark-directive     | LiquidJS               | Расширение regex   |
| ------------------ | -------------------- | -------------------- | ---------------------- | ------------------ |
| K1 Pipeline fit    | Низкий               | Высокий              | Средний                | Высокий            |
| K2 Output compat   | Низкий (custom JSX)  | Высокий              | Средний                | Высокий            |
| K3 Index gen       | Высокий              | Высокий              | Высокий                | Средний            |
| K4 Bundle          | Низкий (96 kB, 24d)  | Средний (50 kB, 15d) | Средний (22 kB gz, 1d) | Высокий (0)        |
| K5 DX / Authoring  | Средний              | Низкий               | Средний                | Средний            |
| K6 Migration cost  | Высокий              | Высокий              | Высокий                | Низкий             |
| K7 Maintainability | Низкий               | Средний              | Средний                | Низкий (при росте) |

## Заключение

### Рекомендация: расширение текущей системы (объект 4)

MDX не подходит: компилирует Markdown в JavaScript, тогда как Agloom
требует Markdown на выходе. Custom JSX runtime — хрупкое решение
с 24 transitive dependencies ради задачи, решаемой без них.

remark-directive — корректный Markdown-native подход, но dependency chain
(unified + remark + mdast-util-\*) и MDAST API избыточны для текущего
scope (подстановка переменных + 1-2 генератора контента).

LiquidJS — зрелый шаблонизатор, но конфликт `{{ }}` с YAML front matter
и отсутствие Markdown-awareness повышают риск генерации невалидного контента.

Расширение текущей regex-системы custom handlers обеспечивает:

- Решение ключевого use-case (doc-index) без новых зависимостей.
- Сохранение текущего синтаксиса `${agloom:VAR}` и pipeline.
- Минимальную миграцию (добавление, не замена).

Ограничение подхода — масштабируемость. При росте числа операций
(>3-5 custom handlers) СЛЕДУЕТ пересмотреть решение в пользу
remark-directive как следующего шага эволюции.

### Стратегия реализации

1. Добавить handler registry в модуль интерполяции.
2. Реализовать `doc-index` handler для генерации Markdown-списка ссылок.
3. Сохранить обратную совместимость с текущим синтаксисом.
4. Порог пересмотра: при 4+ custom handlers — исследовать remark-directive.

## Источники

- [@mdx-js/mdx — npm](https://www.npmjs.com/package/@mdx-js/mdx), [Bundlephobia](https://bundlephobia.com/package/@mdx-js/mdx)
- [MDX — официальная документация](https://mdxjs.com/), [remark-mdx](https://mdxjs.com/packages/remark-mdx/)
- [remark-directive — GitHub](https://github.com/remarkjs/remark-directive), [npm](https://www.npmjs.com/package/remark-directive)
- [remark — GitHub](https://github.com/remarkjs/remark)
- [LiquidJS — npm](https://www.npmjs.com/package/liquidjs)
- [Create a remark plugin — unified](https://unifiedjs.com/learn/guide/create-a-remark-plugin/)
- [Generic directives proposal — CommonMark](https://talk.commonmark.org/t/generic-directives-plugins-syntax/444)
