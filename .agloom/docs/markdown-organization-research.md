---
summary: Организация и валидация markdown-документации
description: >-
  Исследование фреймворков организации markdown-документов, систем
  типизации, инструментов валидации и AI-ревью
blueprint: schemas/draft/research.schema.yml
relates:
  - .agloom/docs/agent-as-program.md
  - .agloom/docs/dor-dod-criteria.md
---

# Исследование: организация и валидация markdown-документации

Дата: 2026-03-15

## Контекст исследования

Проект Agloom содержит два слоя markdown-документации:

- **Продуктовые спецификации** (`docs/`) — что система делает
- **Инфраструктура агентов** (`.agloom/`) — как система разрабатывается

Каждый документ имеет YAML front matter с полем `type` (`index`, `spec`, `doc`, `research`), от которого зависит
набор обязательных полей и структурные ограничения. По мере роста количества документов возникает потребность в:

1. Формализованной системе типизации документов (аналог JSON Schema для API-контрактов)
2. Автоматической валидации документов по типу
3. Фреймворке организации документов в файловой системе
4. Возможности AI-ревью документов по спецификации типа

Исследование анализирует индустриальные подходы и инструменты для решения этих задач.

## Часть 1. Фреймворки организации документации

### 1.1. Diataxis (Daniele Procida)

Наиболее признанный фреймворк организации технической документации. Название от древнегреческого
_dia_ (через) + _taxis_ (расположение). Определяет четыре типа документов по двум осям:

|                  | Практическое применение | Теоретическое знание |
| ---------------- | ----------------------- | -------------------- |
| **При обучении** | Tutorial                | Explanation          |
| **При работе**   | How-To Guide            | Reference            |

- **Tutorial** (learning-oriented) — пошаговое обучение, читатель «на рельсах»
- **How-To Guide** (problem-oriented) — решение конкретной задачи, предполагает базовые знания
- **Reference** (information-oriented) — фактографическая справка (API, конфигурация, спецификации)
- **Explanation** (understanding-oriented) — контекст, обоснование, «почему так устроено»

Ключевой принцип: **типы не смешиваются**. Tutorial, который отвлекается на Explanation, или Reference,
который переключается на How-To — типичные примеры запутанной документации.

Принят Canonical (Ubuntu), Cloudflare, Gatsby, Django и др.

**Релевантность для Agloom:** средняя. Diataxis ориентирован на документацию для конечных пользователей
продукта. Текущие документы Agloom — это спецификации для агентов и разработчиков, не пользовательская
документация. Однако принцип разделения типов напрямую применим, и текущая система типов (`spec`, `doc`,
`research`, `index`) фактически реализует аналогичный подход:

| Agloom `type` | Ближайший аналог Diataxis | Различие                                           |
|---------------| ------------------------- | -------------------------------------------------- |
| `spec`        | Reference (частично)      | Spec управляет имплементацией, не просто описывает |
| `doc`         | Explanation               | Прямое соответствие                                |
| `research`    | Explanation               | Глубже, с источниками и анализом                   |
| `index`       | — (нет аналога)           | Структурный элемент, пререквизит папки             |

Источники:

- [Diataxis](https://diataxis.fr/)
- [What is Diataxis (I'd Rather Be Writing)](https://idratherbewriting.com/blog/what-is-diataxis-documentation-framework)
- [Diataxis adoption at Canonical](https://ubuntu.com/blog/diataxis-a-new-foundation-for-canonical-documentation)

### 1.2. DITA (Darwin Information Typing Architecture)

Стандарт OASIS для structured authoring, первый релиз в 2005. Полноценная архитектура
типизации документов с наследованием и специализацией.

Базовые типы информации (DITA 1.3):

- **Task** — процедура (шаги для достижения результата)
- **Concept** — определения, правила, общие положения
- **Reference** — фактографический справочный материал
- **Troubleshooting** — описание проблемы + причины + решения
- **Glossary Entry** — глоссарная запись

Каждый тип — специализация базового `Topic`, который содержит `title`, `prolog` (метаданные),
`body`. Тип определяет **структуру body** — какие элементы допустимы и в каком порядке.

Ключевые концепции DITA, применимые к markdown-системе:

- **Information typing** — документ объявляет свой тип, тип определяет структуру и правила
- **Topic-based authoring** — документ = самодостаточный модуль (topic), не глава книги
- **Maps** — отдельные файлы, определяющие навигацию и связи между topics
- **Specialization** — создание новых типов через наследование от базовых
- **Content reuse** — conref/conkeyref (трансклюзия фрагментов между документами)

**DITA vs. Markdown:** DITA — полноценный стандарт с XML-схемами, markdown — формат разметки.
Прямое сравнение некорректно. Но концепции DITA (information typing, topic-based authoring,
schema-driven validation) можно воспроизвести поверх markdown с помощью frontmatter + инструментов
валидации.

**LwDITA (Lightweight DITA):** стандарт OASIS для упрощённого DITA в трёх форматах: XML, HTML5,
**Markdown**. Начиная с DITA-OT 4.1 (LwDITA plug-in 5.0), поддерживается ключ `$schema`
в YAML frontmatter для указания типа документа. Пример:

```yaml
---
$schema: urn:oasis:names:tc:dita:xsd:concept.xsd
---
```

Это прямой прецедент: **markdown-документ объявляет свою схему через frontmatter**.
На данный момент валидация по схеме не выполняется (только parsing hints), но паттерн установлен.

**Релевантность для Agloom:** высокая концептуально. Идеи information typing и schema-driven
validation из DITA — то, что нужно реализовать поверх markdown. LwDITA показывает, что индустрия
движется в сторону `$schema` в frontmatter.

Источники:

- [DITA (Wikipedia)](https://en.wikipedia.org/wiki/Darwin_Information_Typing_Architecture)
- [DITA-OT Markdown Schemas](https://www.dita-ot.org/dev/reference/markdown/markdown-schemas)
- [LwDITA Introduction (OASIS)](https://docs.oasis-open.org/dita/LwDITA/v1.0/cnprd01/LwDITA-v1.0-cnprd01.html)
- [Markdown vs. DITA (Doctave)](https://www.doctave.com/blog/markdown-vs-dita)

### 1.3. Docs-as-Code

Философия, а не конкретный инструмент: документация хранится рядом с кодом, версионируется
в Git, проходит через PR/review, линтится в CI, собирается автоматически.

Ключевые практики:

- Документы лежат рядом с кодом, который описывают
- Изменения кода и документации — в одном PR
- Markdown как основной формат (CommonMark или GFM)
- Линтинг (markdownlint, Vale) в CI pipeline
- Статические генераторы (MkDocs, Docusaurus, Hugo) для публикации
- ADR (Architectural Decision Records) для фиксации решений

**Релевантность для Agloom:** проект уже следует этой философии.

### 1.4. Zettelkasten

Метод организации личных заметок Никласа Лумана. Атомарные заметки, связанные ссылками.
Как верно подмечено в вопросе — **не подходит** для документирования системы.
Zettelkasten оптимизирован для emergence (непредвиденных связей между идеями),
а документация системы требует **иерархии и типизации**.

### 1.5. Сводка по фреймворкам

| Фреймворк    | Фокус                           | Типизация | Валидация  | Релевантность           |
| ------------ | ------------------------------- | --------- | ---------- | ----------------------- |
| Diataxis     | Пользовательская документация   | 4 типа    | Нет        | Средняя                 |
| DITA         | Enterprise structured authoring | Полная    | XML Schema | Высокая (концептуально) |
| LwDITA       | DITA в Markdown                 | `$schema` | Нет (пока) | Высокая                 |
| Docs-as-Code | Философия процесса              | Нет       | Линтеры    | Уже применяется         |
| Zettelkasten | Личные заметки                  | Нет       | Нет        | Не подходит             |

## Часть 2. Системы типизации документов (Document Schema)

### 2.1. JSON Schema для YAML frontmatter

Базовый подход: YAML front matter — это YAML, YAML типы (null, bool, int, string, array,
object) маппятся на JSON 1:1, значит YAML frontmatter можно валидировать JSON Schema.

Реализации:

- **remark-lint-frontmatter-schema** — плагин remark-lint. Документ указывает свою схему
  через `$schema` ключ в frontmatter (относительный путь). Плагин парсит frontmatter
  и валидирует его против JSON Schema. Интеграция в CI через remark CLI.

- **@github-docs/frontmatter** — npm-пакет GitHub. Парсер frontmatter на основе gray-matter
  с валидацией по revalidator JSON schema. Поддерживает: валидацию типов, длин, паттернов;
  `validateKeyNames` (запрет неизвестных ключей); `validateKeyOrder` (порядок ключей).
  Используется в тестах GitHub Docs для валидации каждой страницы.

- **ajv-cli** / **check-jsonschema** — CLI-инструменты для валидации YAML/JSON против
  JSON Schema. Требуют предварительного извлечения frontmatter из markdown.

**Паттерн:** определяем JSON Schema для каждого `type` документа. Документ указывает свой `type`
в frontmatter. Валидатор выбирает соответствующую схему и проверяет frontmatter.

Это прямой аналог того, как API-контракты валидируются по OpenAPI/JSON Schema.

Источники:

- [remark-lint-frontmatter-schema](https://github.com/JulianCataldo/remark-lint-frontmatter-schema)
- [@github-docs/frontmatter (npm)](https://www.npmjs.com/package/@github-docs/frontmatter)
- [Validating YAML frontmatter with JSONSchema (ndumas.com)](https://ndumas.com/2023/06/validating-yaml-frontmatter-with-jsonschema/)

### 2.2. mdschema — declarative schema-based Markdown validator

Инструмент, наиболее близкий к поставленной задаче. Валидирует **и frontmatter, и структуру
body** markdown-документа по декларативной схеме.

Возможности:

- **Frontmatter:** типы полей (string, number, boolean, array, date), форматы (date, email, url),
  required/optional
- **Структура body:** правила для headings (иерархия, обязательность), code blocks (min count),
  images (require alt), lists (тип), tables, word count, forbidden text
- **Ссылки:** валидация внутренних якорей, относительных путей, внешних URL
- **CI/CD:** GitHub Action, JSON Schema для `.mdschema.yml` (автодополнение в VS Code/Neovim)

Пример `.mdschema.yml`:

```yaml
frontmatter:
  required:
    - title:
        type: string
    - type:
        type: string
        enum: [spec, doc, research, index]
    - status:
        type: string
        enum: [draft, ready, implemented, outdated]
        when:
          type: spec
  optional:
    - relates:
        type: array
    - maps_to:
        type: array
structure:
  headings:
    require_h1: true
    max_depth: 4
```

**Релевантность:** очень высокая. mdschema решает основную задачу — валидация markdown-документа
по схеме типа. Однако для условной валидации (разные правила для разных `type`) может потребоваться
несколько схем или обёртка.

Источники:

- [mdschema (GitHub)](https://github.com/jackchuka/mdschema)

### 2.3. markdown-validator (Final-State-Press)

Валидирует markdown по декларативному JSON rule set. Правила проверяют YAML frontmatter
и body через XPath. Ориентирован на большие документационные репозитории (DocFX, Hugo).

Источники:

- [markdown-validator (GitHub)](https://github.com/mattbriggs/markdown-validator)

### 2.4. mdvalidator (XSD-подход)

Конвертирует markdown в XHTML, валидирует полученный XHTML против XSD schema.
Прямая аналогия с XML/DITA подходом: markdown -> XHTML -> XSD validation.

Источники:

- [mdvalidator (GitHub)](https://github.com/gitzain/mdvalidator)

### 2.5. Front Matter CMS (VS Code extension)

CMS внутри VS Code. Позволяет определять content types с полями и их типами
в `frontmatter.json`. Каждый content type — набор полей с типами, taxonomy, data files.
VS Code обеспечивает автодополнение и inline-валидацию при редактировании.

Ключевая концепция: `frontMatter.taxonomy.contentTypes` — массив определений типов контента.
Каждый тип имеет `name` (соответствует `type` в frontmatter документа) и `fields` (набор полей
с типами и ограничениями). Поддерживает custom taxonomy, data files, field groups.

**Релевантность:** средняя. Полезен для DX при редактировании, но не заменяет CI-валидацию.
Работает только в VS Code.

Источники:

- [Front Matter CMS — Content Types](https://frontmatter.codes/docs/content-creation/content-types)
- [Front Matter CMS (VS Code Marketplace)](https://marketplace.visualstudio.com/items?itemName=eliostruyf.vscode-front-matter)

### 2.6. Structured MADR — прецедент из ADR

Расширение стандарта MADR (Markdown Architectural Decision Records) с:

- YAML frontmatter со структурированными полями (title, type, category, status, tags,
  technologies, audience, related)
- JSON Schema для валидации frontmatter
- GitHub Action валидатор
- Audit trails в Markdown

Это ближайший прецедент к задаче Agloom: **markdown-документы с типизированным frontmatter,
валидируемые по JSON Schema в CI/CD**. Structured MADR явно спроектирован для потребления
AI-инструментами (фильтрация по frontmatter без парсинга прозы).

Источники:

- [structured-madr (GitHub)](https://github.com/zircote/structured-madr)

### 2.7. Docusaurus — Joi schema для frontmatter

Docusaurus валидирует frontmatter всех документов против Joi schema внутренне.
Используется `@docusaurus/utils-validation` с `JoiFrontMatter`. Поддерживает:
unknown keys (custom metadata), strict mode, friendly error messages.

Хотя Docusaurus — SSG, его подход к валидации frontmatter через Joi schema —
хороший reference implementation.

Источники:

- [Docusaurus plugin-content-docs](https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-docs)
- [Strict frontmatter validation (GitHub issue)](https://github.com/facebook/docusaurus/issues/4591)

### 2.8. GitHub Docs — production-grade reference

GitHub Docs определяет frontmatter schema в `lib/frontmatter.ts`. Тестовый набор
валидирует каждую страницу. Поддерживает: content types (страница, продукт, категория),
версионирование, topics из allow-list, conditional fields.

`@github-docs/frontmatter` npm-пакет доступен для переиспользования.

Источники:

- [GitHub Docs — YAML frontmatter](https://docs.github.com/en/contributing/writing-for-github-docs/using-yaml-frontmatter)
- [@github-docs/frontmatter (npm)](https://www.npmjs.com/package/@github-docs/frontmatter)

## Часть 3. Инструменты валидации

### 3.1. Уровни валидации

По аналогии с программным обеспечением, валидация markdown-документов может выполняться
на нескольких уровнях:

| Уровень                  | Аналогия в SE        | Что проверяется                                | Инструменты                |
| ------------------------ | -------------------- | ---------------------------------------------- | -------------------------- |
| 1. Форматирование        | Formatter (Prettier) | Синтаксис markdown, стиль разметки             | markdownlint, Prettier     |
| 2. Структура frontmatter | Type checker         | Типы полей, обязательные поля, enum, формат    | JSON Schema, mdschema, Joi |
| 3. Структура body        | Linter (ESLint)      | Наличие heading, секций, code blocks, таблиц   | mdschema, custom remark    |
| 4. Prose quality         | Prose linter         | Грамматика, стиль, vocabulary, тон             | Vale                       |
| 5. Семантика             | Integration tests    | Ссылки, cross-references, consistency          | mdschema (links), custom   |
| 6. Content review        | Code review          | Полнота, корректность, соответствие назначению | AI agent (LLM)             |

Текущее покрытие в Agloom:

- Уровень 1: **покрыт** (Prettier `fmt:md`, markdownlint)
- Уровни 2–6: **не покрыты**

### 3.2. markdownlint + custom rules

markdownlint (Node.js, DavidAnson) — 60+ встроенных правил для синтаксиса и стиля markdown.
Поддерживает custom rules через `options.customRules` — JavaScript-функции, которые получают
AST документа и могут проверять произвольные свойства.

Применимость: custom rule может парсить frontmatter и валидировать его по схеме, но это
не основное назначение инструмента. Лучше использовать специализированные инструменты
для frontmatter-валидации.

Источники:

- [markdownlint (GitHub)](https://github.com/DavidAnson/markdownlint)
- [markdownlint Custom Rules](https://github.com/DavidAnson/markdownlint/blob/main/doc/CustomRules.md)

### 3.3. Vale — prose linter

Vale — open-source линтер для прозы. Написан на Go, кроссплатформенный, быстрый.
Понимает синтаксис markdown, HTML, reStructuredText, AsciiDoc, DITA, XML.

Ключевые возможности:

- **Styles** — набор правил в виде YAML-файлов. Extension points: existence (наличие токена),
  repetition (повторы), spelling, substitution, conditional и др.
- **Vocabulary** — списки допустимых/запрещённых слов (продукты, акронимы, термины)
- **Готовые пакеты стилей**: proselint, write-good, alex, Google Developer Style Guide
- **Custom styles** — организационные стандарты, tone of voice, терминология
- **Интеграция**: VS Code, IntelliJ, Sublime, Git hooks, CI/CD (GitHub Action)

Применимость для Agloom:

- Валидация RFC 2119 keywords (ТРЕБУЕТСЯ, ЗАПРЕЩАЕТСЯ и т.д.) — проверка корректного
  использования в нужных контекстах
- Vocabulary для терминов проекта (TypeORM, NestJS, spec-cycle и др.)
- Проверка тона документа (третье лицо в spec, второе лицо в агентах)
- Запрет определённых конструкций по типу документа

Книга: Brian P. Hogan «Write Better with Vale» (Pragmatic Programmers, 2025).

Источники:

- [Vale](https://vale.sh)
- [Vale (GitHub)](https://github.com/errata-ai/vale)
- [Write Better with Vale (Pragmatic Programmers)](https://pragprog.com/titles/bhvale/write-better-with-vale/)

### 3.4. remark ecosystem

remark — markdown processor на основе unified. Поддерживает плагины для парсинга,
трансформации и линтинга. `remark-lint` — набор правил линтинга. Позволяет писать
custom rules через AST traversal.

`remark-lint-frontmatter-schema` — плагин, который валидирует frontmatter по JSON Schema,
указанной в `$schema` ключе frontmatter документа. Это самый прямой аналог паттерна
`$schema` из JSON Schema / LwDITA.

### 3.5. Композитный pipeline

По аналогии с pipeline валидации кода (`format -> build -> lint -> test`),
документация может проходить через:

```text
format (Prettier) -> schema (frontmatter) -> structure (body) -> prose (Vale) -> links -> [AI review]
```

Каждый шаг — независимый инструмент, результаты агрегируются.

## Часть 4. AI-ревью документов

### 4.1. Stanford Agentic Reviewer

Система для ревью академических статей. Использует markdown статьи + синтезированный
обзор литературы для генерации ревью по шаблону. Оценивает по 7 измерениям: оригинальность,
важность, обоснованность, soundness экспериментов, ясность, ценность, контекстуализация.

Корреляция Spearman между AI и одним человеческим рецензентом: 0.42
(при human-to-human: 0.41). AI-рецензент приближается к уровню человека.

Применимость: паттерн «ревью по шаблону с оценкой по измерениям» напрямую применим
к ревью документов по типу. Шаблон ревью = DoD типа документа.

Источники:

- [Stanford Agentic Reviewer](https://paperreview.ai/tech-overview)

### 4.2. Azure AI Document Review (Solution Accelerator)

Open-source решение на Azure с агентным подходом:

- Определение review agents через «guideline prompts»
- Каждый агент проверяет документ на соответствие определённым критериям
- Feedback loop для улучшения качества ревью

Применимость: паттерн «guideline prompt per document type» — тот же подход,
что и агенты spec-cycle, но для документации.

Источники:

- [ai-document-review (GitHub)](https://github.com/akashtalole/ai-document-review)

### 4.3. Evaluator-Optimizer pattern

Общий паттерн из agentic coding: один LLM генерирует, другой оценивает и даёт feedback,
итеративно. Применим к документации: writer agent + reviewer agent.

В системе spec-cycle этот паттерн уже реализован (spec-writer -> spec-reviewer),
но только для спецификаций, не для произвольных markdown-документов.

### 4.4. Связь с agent-as-program.md

В исследовании «Агентский пайплайн как программа» ([agent-as-program.md](agent-as-program.md))
определено, что система spec-cycle — **интерпретируемая программа**, и для неё возможен
**linter** (статический анализ до запуска). AI-ревью документации — это расширение того же
подхода: linter для документов, где часть правил детерминистична (schema, structure),
а часть — вероятностна (prose quality, content completeness).

Композитная модель:

```text
Детерминистический linter              AI reviewer
(schema + structure + links)    +    (prose + completeness + consistency)
         ↓                                    ↓
    pass/fail + errors                  findings + suggestions
         ↓                                    ↓
                    агрегированный отчёт
```

## Часть 5. Валидация мета-схем

### 5.1. Проблема: кто валидирует валидатор?

Части 2–4 описывают валидацию markdown-документов по схемам типов. Но сами схемы —
тоже артефакты, и их корректность необходимо гарантировать. Это классическая проблема
мета-уровня: JSON Schema решает её через **мета-схемы** — схему, которая валидирует
другие схемы.

### 5.2. Цепочка валидации

В архитектуре Agloom (`.agloom/schemas/`) присутствует трёхуровневая цепочка:

```text
Уровень 3: JSON Schema draft-2020-12 (официальная мета-схема IETF)
               валидирует ↓
Уровень 2: meta-schema.json (vocabulary Agloom — «схема схем»)
               валидирует ↓
Уровень 1: draft/*.schema.yml (определения типов документов)
               валидирует ↓
Уровень 0: docs/**/*.md, .agloom/**/*.md (сами документы)
```

Каждый уровень уже **объявляет** свою мета-схему через `$schema`:

- `meta-schema.json`: `"$schema": "https://json-schema.org/draft/2020-12/schema"`
- `*.schema.yml`: `$schema: ../meta-schema.json`

Но объявление — не enforcement. Валидация должна **выполняться** инструментами.

### 5.3. Инструменты валидации мета-уровня

**Уровень 3 → 2 (официальная мета-схема → meta-schema.json):**

- `ajv compile` — при компиляции схемы ajv неявно проверяет её против мета-схемы.
  Если `meta-schema.json` содержит невалидный JSON Schema, компиляция упадёт.
- `check-jsonschema --check-metaschema meta-schema.json` — CLI-инструмент (Python),
  явная проверка что файл является корректной JSON Schema.

**Уровень 2 → 1 (meta-schema.json → \*.schema.yml):**

- `check-jsonschema --schemafile meta-schema.json draft/*.schema.yml` — понимает YAML
  нативно, не требует предварительной конвертации.
- `ajv validate -s meta-schema.json -d <yaml-as-json>` — требует конвертации YAML → JSON
  (через `js-yaml` или `yq`).

**Уровень 1 → 0 (_.schema.yml → _.md):**

- Описан в Части 2 (JSON Schema для frontmatter).
- Дополнительно: скрипт-маршрутизатор, который читает `type` из frontmatter документа,
  выбирает соответствующую `*.schema.yml`, конвертирует её frontmatter-секцию в JSON Schema,
  и валидирует frontmatter документа.

### 5.4. Аналогии

| Домен             | Мета-уровень                     | Уровень типов            | Уровень данных      |
| ----------------- | -------------------------------- | ------------------------ | ------------------- |
| JSON Schema       | draft-2020-12 meta-schema        | Пользовательская schema  | JSON-документ       |
| TypeScript        | TypeScript compiler              | `.d.ts` type definitions | `.ts` код           |
| SQL               | INFORMATION_SCHEMA               | DDL (CREATE TABLE)       | DML (INSERT/SELECT) |
| DITA              | DITA architectural specification | DTD/XSD topic type       | XML topic           |
| **Agloom schemas** | `meta-schema.json`               | `*.schema.yml`           | `*.md` frontmatter  |

### 5.5. Pipeline с мета-валидацией

```text
doc:meta       meta-schema.json корректна (check-jsonschema --check-metaschema)
  → doc:schema    *.schema.yml соответствуют meta-schema.json
    → doc:frontmatter   *.md frontmatter соответствует своему type schema
      → doc:structure / doc:prose / doc:links
```

Шаги `doc:meta` и `doc:schema` выполняются редко (только при изменении схем), но должны
быть в CI для гарантии целостности. Аналогия: `tsc --noEmit` проверяет типы, даже если
код не изменился.

### 5.6. Рекомендуемый инструмент

`check-jsonschema` (Python, pip) — единственный инструмент, покрывающий оба мета-уровня:

- `--check-metaschema` для валидации meta-schema.json
- `--schemafile` для валидации YAML против любой JSON Schema

Альтернатива: `ajv-cli` (Node.js, npm) — ближе к стеку проекта, но требует
конвертации YAML → JSON для schema.yml файлов.

## Часть 6. Анализ применимости к Agloom

### 6.1. Текущая система типов

В AGLOOM.md определены 4 типа документов с полями frontmatter:

| Тип        | Обязательные поля                  | Опциональные     |
| ---------- | ---------------------------------- | ---------------- |
| `index`    | summary, description, type         | relates          |
| `spec`     | summary, description, type, status | relates, maps_to |
| `doc`      | summary, description, type         | relates          |
| `research` | summary, description, type         | relates          |

Статусы (только `spec`): `draft`, `ready`, `implemented`, `outdated`.

Это уже де-факто schema, но описанная в прозе AGLOOM.md, а не формально.

### 6.2. Что можно формализовать

**Уровень 1 — JSON Schema для frontmatter (минимальные усилия, высокий ROI):**

Определить JSON Schema для каждого `type`. Валидировать в CI. Инструменты:

- `remark-lint-frontmatter-schema` — если хочется `$schema` в каждом документе
- `@github-docs/frontmatter` — если хочется centralized schema
- Простой скрипт на Node.js: gray-matter (parse) + ajv (validate) — минимум зависимостей

Пример JSON Schema для `type: spec`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["summary", "description", "type", "status"],
  "properties": {
    "summary": { "type": "string", "minLength": 1 },
    "description": { "type": "string", "minLength": 1 },
    "type": { "const": "spec" },
    "status": { "enum": ["draft", "ready", "implemented", "outdated"] },
    "relates": { "type": "array", "items": { "type": "string" } },
    "maps_to": { "type": "array", "items": { "type": "string" } }
  },
  "additionalProperties": false
}
```

**Уровень 2 — Структура body (средние усилия):**

Определить структурные правила для каждого типа. Инструменты: mdschema или custom remark plugin.
Примеры правил:

- `spec`: обязательный H1, секции определённые spec-format.md
- `index`: обязательный H1, без H4+
- `research`: обязательные секции «Контекст», «Сводка» / «Источники»

**Уровень 3 — Prose quality (Vale):**

Определить Vale styles для проекта:

- Vocabulary (термины проекта)
- RFC 2119 keywords (проверка что ТРЕБУЕТСЯ/ЗАПРЕЩАЕТСЯ используются корректно)
- Тон (третье лицо в spec, второе в агентах)

**Уровень 4 — AI review agent:**

Определить review agent (аналог spec-reviewer), который:

- Получает на вход markdown-документ + его тип + DoD типа
- Оценивает полноту, корректность, consistency
- Возвращает findings

Это расширение системы spec-cycle на произвольные документы.

### 6.3. Рекомендуемый порядок внедрения

| Приоритет | Действие                                                     | Усилия  | ROI                    |
| --------- | ------------------------------------------------------------ | ------- | ---------------------- |
| 0         | Валидация мета-схемы и type schemas (doc:meta + doc:schema)  | Низкие  | Высокий                |
| 1         | JSON Schema для frontmatter + CI-валидация (doc:frontmatter) | Низкие  | Высокий                |
| 2         | Vale с vocabulary и базовыми стилями                         | Низкие  | Средний                |
| 3         | Структурные правила body по типу (mdschema)                  | Средние | Средний                |
| 4         | Cross-reference валидация (relates, maps_to)                 | Средние | Средний                |
| 5         | AI review agent для документов                               | Высокие | Высокий (при масштабе) |

### 6.4. Интеграция в существующий pipeline

Текущий pipeline: `format -> build -> lint -> test`

Расширенный pipeline с документацией:

```text
format (Prettier)
  -> build (tsc)
  -> lint (ESLint)
  -> doc:frontmatter (frontmatter validation)
  -> doc:structure (body validation)
  -> doc:prose (Vale)
  -> doc:links (cross-references)
  -> test (Jest)
```

Шаги `doc:*` могут быть объединены в один `doc:validate` или оставаться раздельными
для granular feedback. Шаги `doc:meta` и `doc:schema` выполняются первыми — без корректных
схем остальные шаги бессмысленны.

## Заключение

| Вопрос                           | Ответ                                                                                                 |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Фреймворк организации            | DITA information typing (концептуально) + Docs-as-Code (практически); Diataxis — для user-facing docs |
| Система типизации                | JSON Schema для frontmatter (прямой аналог JSON Schema для API)                                       |
| Паттерн объявления типа          | `type` в frontmatter (уже есть); опционально `$schema` (как LwDITA, remark-lint)                      |
| Валидация мета-схем              | `check-jsonschema --check-metaschema` (meta-schema.json) + `--schemafile` (\*.schema.yml)             |
| Инструмент валидации frontmatter | gray-matter + ajv (минимум), или @github-docs/frontmatter, или remark-lint-frontmatter-schema         |
| Инструмент валидации body        | mdschema (declarative) или custom remark plugin                                                       |
| Prose linter                     | Vale с custom styles и vocabulary                                                                     |
| AI-ревью                         | Расширение паттерна spec-reviewer на произвольные документы (evaluator-optimizer pattern)             |
| Ближайший production reference   | GitHub Docs (frontmatter schema + CI tests) и Structured MADR (JSON Schema + GitHub Action)           |
| Прецедент `$schema` в markdown   | LwDITA (DITA-OT 4.1+), remark-lint-frontmatter-schema                                                 |
