---
summary: Мета-схема документов
description: >-
  Проектирование мета-схемы для типизации и валидации
  markdown-документов, анализ $schema и blueprint,
  версионирование, каналы стабильности
blueprint: schemas/draft/research.schema.yml
relates:
  - .claude/docs/markdown-organization-research.md
  - .claude/docs/agent-as-program.md
---

# Исследование: мета-схема документов

Дата: 2026-03-15

## Контекст исследования

Исследование [markdown-organization-research.md](markdown-organization-research.md) определило потребность в формализованной
системе типизации markdown-документов. Текущее состояние: 4 типа документов (`index`, `spec`, `doc`,
`research`) описаны в прозе CLAUDE.md, валидация не автоматизирована.

Цель: спроектировать мета-схему — формальный vocabulary для описания типов markdown-документов,
с версионированием и возможностью автоматической валидации.

Требования к дизайну:

1. Чёткое разделение: `$schema` — для JSON/YAML данных, отдельный механизм — для markdown-документов
2. Версионирование схем, заложенное на этапе проектирования
3. Возможность переиспользования другими системами в будущем
4. Покрытие всех уровней валидации (frontmatter, body, prose, cross-references)

## Часть 1. Разделение областей ответственности

### 1.1. `$schema` — только для данных

`$schema` — понятие из мира JSON Schema. Оно предназначено для валидации
структурированных данных (JSON, YAML). Markdown-файл — это не данные,
а prose-документ с опциональным YAML-заголовком.

Корректное использование `$schema` в проекте:

| Файл               | `$schema` указывает на                         | Обоснование                                |
| ------------------ | ---------------------------------------------- | ------------------------------------------ |
| `meta-schema.json` | `https://json-schema.org/draft/2020-12/schema` | JSON Schema валидирует JSON Schema         |
| `*.schema.yml`     | `../meta-schema.json` (относительный путь)     | YAML данные валидируются JSON Schema       |
| `*.md` (markdown)  | **Не используется**                            | Markdown — не данные, `$schema` неприменим |

Спецификация JSON Schema (draft/2020-12) определяет `$schema` как объявление диалекта,
в котором написана **схема**. Инстанс (валидируемый документ) не содержит `$schema`.
Это фундаментальное ограничение: `$schema` — связь между схемой и мета-схемой,
не между инстансом и схемой.

Существуют прецеденты использования `$schema` в YAML frontmatter markdown-файлов
(remark-lint-frontmatter-schema, LwDITA), но они переопределяют семантику `$schema`,
а не следуют ей. Мы выбираем не повторять эту практику.

### 1.2. `blueprint` — для markdown-документов

Для объявления типа markdown-документа вводится поле `blueprint` — внутренняя конвенция
проекта. Значение — относительный URI к определению типа.

Семантика: **blueprint = структурная спецификация, которой документ должен соответствовать**.

Метафора из инженерии: чертёж (blueprint) — техническая спецификация, по которой
проверяют результат. Документ «построен по чертежу» и валидируется на соответствие ему.

```yaml
---
blueprint: schemas/v1/spec.schema.yml
summary: Авторизация
description: Аутентификация, сессии, API-токены
status: implemented
---
```

### 1.3. Выбор имени поля

Рассмотрены альтернативы:

| Поле            | Происхождение           | Семантика                                  | Проблема                                   |
| --------------- | ----------------------- | ------------------------------------------ | ------------------------------------------ |
| `$schema`       | JSON Schema             | Диалект схемы                              | Для данных, не для документов              |
| `conformsTo`    | Dublin Core (ISO 15836) | Соответствие стандарту                     | RDF-свойство; в YAML frontmatter — натяжка |
| `profile`       | RFC 6906                | Дополнительная семантика поверх media type | HTTP-centric; не про классификацию         |
| `template`      | Общеупотребительное     | Шаблон для создания копий                  | Коннотация scaffold (creation-time)        |
| **`blueprint`** | Внутренняя конвенция    | Структурная спецификация для валидации     | —                                          |
| `type`          | Текущий подход          | Классификация документа                    | Не несёт версию; implicit, не explicit     |

**Решение: `blueprint`.**

- Точная метафора: чертёж, по которому проверяют постройку (validation-time, не creation-time)
- Не перегружено в software-экосистеме (в отличие от `template`, `type`, `schema`)
- Не присваивает полю семантику чужого стандарта — честная внутренняя конвенция
- URI-значение естественно несёт версию через путь (`schemas/v1/...`)

Определение конвенции:

> **`blueprint`** — URI определения типа документа. Документ ДОЛЖЕН соответствовать
> структурным и содержательным требованиям, заданным определением типа.
> Валидатор использует `blueprint` для выбора правил проверки.

### 1.4. Итоговая архитектура ссылок

```text
meta-schema.json    ──$schema──→  JSON Schema draft/2020-12   (стандарт JSON Schema)
*.schema.yml        ──$schema──→  meta-schema.json             (стандарт JSON Schema)
*.md                ──blueprint──→ *.schema.yml                (внутренняя конвенция)
```

Каждый уровень использует механизм, соответствующий природе файла:
JSON/YAML данные → `$schema`, markdown-документы → `blueprint`.

## Часть 2. Версионирование

### 2.1. Стратегии версионирования схем

Исследованы три стратегии:

#### A. Независимое версионирование (per-type)

Каждый тип имеет собственную версию: `spec.v1.schema.yml`, `spec.v2.schema.yml`.
Типы эволюционируют независимо.

- Pro: гранулярность, минимум ненужных миграций
- Con: N типов x M версий = комбинаторная сложность; пути blueprint сложнее;
  мета-схема и типы могут рассинхронизироваться

#### B. Lockstep-версионирование (per-directory)

Все схемы разделяют одну версию: `schemas/v1/`, `schemas/v2/`. При изменении
любого компонента — новая версия всего набора.

- Pro: простота; все документы в одной версии используют согласованный набор правил;
  пути blueprint предсказуемы; мета-схема и типы всегда синхронны
- Con: изменение одного типа требует копирования всех; при 4 типах — терпимо,
  при 40 — проблематично

#### C. SemVer в файле + major в пути

Major-версия — в пути директории (`schemas/v1/`). Minor/patch — внутри файла
как поле `version`. Major = breaking changes, minor/patch = backward-compatible.

- Pro: баланс между простотой путей и гранулярностью версий
- Con: два места хранения версии (путь + поле)

**Решение: стратегия C (SemVer в файле + major в пути).**

При текущем масштабе (4 типа) lockstep (B) был бы достаточен, но стратегия C
обеспечивает запас для роста без изменения архитектуры. Major в пути гарантирует,
что значения `blueprint` в документах остаются стабильными при minor/patch обновлениях.

### 2.2. Структура директорий: per-type vs lockstep

Помимо стратегии версионирования, рассмотрен вопрос физической организации файлов:
отдельная директория для каждого типа или общая директория для всех типов одной версии.

**Per-type (отдельная директория для каждого типа):**

```text
schemas/
├── spec/
│   ├── v1/
│   │   └── spec.schema.yml
│   └── v2/
│       └── spec.schema.yml
├── doc/
│   └── v1/
│       └── doc.schema.yml
```

**Lockstep (общая директория для всех типов):**

```text
schemas/
├── v1/
│   ├── spec.schema.yml
│   ├── doc.schema.yml
```

Сравнение:

| Аспект                       | Per-type                                               | Lockstep                                    |
| ---------------------------- | ------------------------------------------------------ | ------------------------------------------- |
| Независимость версий         | spec v3, doc v1, agent v2 — каждый сам по себе         | Все типы в `v1/` разделяют major            |
| Breaking change в одном типе | Создаётся `spec/v2/`, остальные не затронуты           | Копировать все типы в `v2/` или ждать       |
| Согласованность между типами | Не гарантирована: spec/v2 может конфликтовать с doc/v1 | Гарантирована: все типы в `v1/` совместимы  |
| Blueprint path               | `schemas/spec/v1/spec.schema.yml` — redundancy         | `schemas/v1/spec.schema.yml` — коротко      |
| Обзор всех типов             | N директорий, собрать текущие версии                   | Одна папка `v1/` — весь набор перед глазами |
| `$schema` путь в type def    | `../../meta-schema.json` (2 уровня)                    | `../meta-schema.json` (1 уровень)           |
| Масштаб                      | Оправдан при 30+ типах, нескольких maintainers         | Оправдан при <15 типах, одном maintainer    |

Ключевое различие — **кросс-типовая согласованность**. Per-type решает проблему
«зачем бампить doc, если менялся только spec», но создаёт новую: если `spec/v2`
начинает требовать формат `relates`, который `doc/v1` не поддерживает — конфликт
обнаружится только при валидации документов, не при проектировании схем. В lockstep
все типы внутри `v1/` — проверенный набор.

**Решение: lockstep.**

При текущих 7 типах и одном maintainer координационная цена lockstep ≈ 0.
Главное преимущество per-type (независимость версий) не востребовано.
Пересмотреть при количестве типов >15 или появлении независимых maintainers.

### 2.3. Что является breaking change

Семантика SemVer применительно к схемам документов:

**MAJOR (новая директория `v{N+1}/`, сброс minor/patch):**

- Удаление поля frontmatter (required или optional)
- Изменение типа существующего поля
- Добавление нового required поля frontmatter
- Сужение enum (удаление допустимого значения)
- Удаление обязательной секции body
- Изменение структуры определения типа (meta-schema breaking change)

**MINOR (инкремент minor, совместимость сохраняется):**

- Добавление нового optional поля frontmatter
- Расширение enum (добавление нового допустимого значения)
- Добавление новой optional секции body
- Ослабление constraints (увеличение maxLength, ослабление pattern)
- Добавление нового типа документа

**PATCH (инкремент patch, только исправления):**

- Исправление описания без семантических изменений
- Исправление regex-паттерна (bug fix, не сужение)
- Обновление ссылок на источники

### 2.4. Политика поддержки версий

- При выпуске `v{N+1}` версия `v{N}` переходит в статус **deprecated**
- Deprecated-версия поддерживается (валидатор принимает оба `v{N}` и `v{N+1}`)
  до тех пор, пока все документы не мигрированы
- Миграция: замена пути `blueprint` + приведение frontmatter в соответствие
- Документы без `blueprint` (legacy) валидируются по последней версии с предупреждением

### 2.5. Каналы стабильности: `draft/` и `-labs`

#### 2.5.1. Проблема

SemVer предполагает, что каждое breaking change — событие, требующее ceremony
(новая директория, миграция документов). На этапе проектирования новой схемы
каждое изменение формально breaking: добавление required поля, переименование,
смена типа. Применение стандартных правил major-версий приводит к одному из двух:

- Частые бессмысленные бампы (`v1` → `v2` → `v3` за один день проектирования)
- Автор избегает нужных изменений, потому что цена breaking change кажется высокой

Нужен механизм для работы со схемами, которые ещё не стабилизировались.

#### 2.5.2. Прецедент: Docker BuildKit release channels

Docker BuildKit использует **release channels** для образов `docker/dockerfile`:

- `docker/dockerfile:1` — stable channel, SemVer, backward-compatible
- `docker/dockerfile:1-labs` — labs channel: всё из stable + экспериментальные фичи
- `docker/dockerfile:1.2-labs` — pinned labs version

Ключевые свойства:

- **Labs — надмножество stable**: содержит все стабильные фичи + экспериментальные
- **Стабильные фичи в labs** следуют SemVer, **экспериментальные — нет**
- Фичи **выпускаются** (graduate) из labs в stable при следующем релизе
- Пользователь осознанно выбирает channel через тег образа

Источники:

- [Docker BuildKit Custom Dockerfile syntax](https://docs.docker.com/build/buildkit/frontend/)
- [Dockerfile Release Notes](https://docs.docker.com/build/dockerfile/release-notes/)

#### 2.5.3. Два канала для двух ситуаций

Анализ показал, что одного механизма недостаточно для покрытия двух разных сценариев:

**Сценарий 1: совершенно новый тип (greenfield).** Стабильной версии не существует.
Схема проходит несколько итераций до первого стабильного выпуска. Если использовать
`v1-labs/workflow.schema.yml` без `v1/workflow.schema.yml`, это создаёт ложное
впечатление, что стабильная версия существует.

**Сценарий 2: эксперимент с существующим стабильным типом.** Есть `v1/spec.schema.yml`,
нужно попробовать изменения (возможно breaking) до принятия решения о `v2`.

Решение — два канала:

| Канал        | Назначение                               | SemVer     | Breaking changes                            |
| ------------ | ---------------------------------------- | ---------- | ------------------------------------------- |
| `draft/`     | Новые типы без stable baseline           | Нет        | Без ограничений                             |
| `v{N}-labs/` | Эксперименты поверх существующего stable | Частично\* | Без ограничений для экспериментальной части |

\* Стабильная часть (унаследованная из `v{N}/`) подчиняется SemVer,
экспериментальная — нет.

Сравнение `draft/` и `-labs`:

| Аспект             | `draft/`                              | `v{N}-labs`                                          |
| ------------------ | ------------------------------------- | ---------------------------------------------------- |
| Baseline           | Нет — автономный                      | Есть — привязан к `v{N}/`                            |
| Происхождение ясно | Нет: непонятно, от чего отталкивается | Да: это `v{N}` + изменения                           |
| Допускает отказ    | Да: draft может быть отвергнут        | Да: labs может не войти в stable                     |
| Graduation         | `draft/` → `v1/` (первый stable)      | `v{N}-labs/` → `v{N}/` (minor) или `v{N+1}/` (major) |

Альтернатива `v0/` (SemVer major version 0 = initial development) рассмотрена
и отклонена: `v0` создаёт ожидание, что за ним обязательно будет `v1`, но
draft-схема может быть отвергнута целиком. `draft/` семантически точнее.

#### 2.5.4. Жизненный цикл

```text
draft/workflow  ──graduation──→  v1/workflow
                                     │
                                v1-labs/workflow  ──minor──→  v1/workflow (обновлённый)
                                                  ──major──→  v2/workflow
                                                                  │
                                                             v2-labs/workflow  ──...
```

Полный цикл: `draft` → `v1` → `v1-labs` (эксперименты) →
`v1` (minor, если backward-compatible) или `v2` (breaking) → `v2-labs` → ...

#### 2.5.5. Правила каналов

**`draft/` — greenfield:**

- Ни SemVer, ни backward compatibility. Breaking changes без церемонии
- Поле `version` в файле отсутствует или имеет значение `"0.0.0"`
- Документы с `blueprint: schemas/draft/...` осознанно принимают нестабильность
- Нет pinning: изменение draft-схемы немедленно затрагивает все документы
- Graduation: когда схема стабилизируется, копируется в `v1/` с `version: "1.0.0"`

**`v{N}-labs/` — эксперименты поверх stable:**

- Создаётся копированием из `v{N}/` с экспериментальными изменениями
- Стабильная часть соответствует `v{N}/`, экспериментальная — свободна
- Документы с `blueprint: schemas/v{N}-labs/...` осознанно принимают нестабильность
  экспериментальных аспектов
- Graduation: backward-compatible изменения → minor bump в `v{N}/`;
  breaking → новая директория `v{N+1}/`

**Критерии graduation из draft в `v1/`:**

- Все документы, использующие draft-схему, успешно валидируются
- Структура frontmatter стабилизировалась (нет планируемых breaking changes)
- Схема использована минимум в 2-3 документах (подтверждение применимости)

**Миграция при graduation:**

- Все документы обновляют `blueprint` с `schemas/draft/...` на `schemas/v1/...`
  (или с `schemas/v{N}-labs/...` на `schemas/v{N}/...` / `schemas/v{N+1}/...`)
- Используется тот же механизм миграции, что и для major-версий ([§ 2.4](#24-политика-поддержки-версий))

### 2.6. Хранение версий

```text
schemas/
├── meta-schema.json               # JSON Schema: vocabulary определений типов
│                                   #   $schema: draft/2020-12
│                                   #   $id: urn:acorn:schemas:meta-schema:v1
├── draft/                          # Greenfield: новые типы без stable baseline
│   └── workflow.schema.yml         #   Нет version / version: "0.0.0"
├── v1/                             # Stable: major version 1
│   ├── index.schema.yml            #   $schema: ../meta-schema.json
│   ├── spec.schema.yml             #   version: "1.0.0"
│   ├── doc.schema.yml
│   └── research.schema.yml
├── v1-labs/                        # Labs: эксперименты поверх v1
│   └── spec.schema.yml            #   v1 spec + пробные изменения
└── CHANGELOG.md                    # История изменений схем
```

Поле `version` внутри каждого `.schema.yml`:

```yaml
version: '1.0.0' # SemVer: MAJOR.MINOR.PATCH
```

Major в `version` должен совпадать с номером директории. Это инвариант,
проверяемый валидатором. Для `draft/` инвариант не применяется.

## Часть 3. Трёхуровневая архитектура

### 3.1. Уровни

```text
JSON Schema specification (draft/2020-12)
  │ $schema (стандарт)
  ▼
meta-schema.json                      Уровень 0: vocabulary
  │ $schema (стандарт)               Определяет допустимую структуру
  ▼                                   type definition файлов
schemas/v1/*.schema.yml               Уровень 1: определения типов
  │ blueprint (конвенция)            Определяют правила для markdown-
  ▼                                   документов конкретного типа
docs/**/*.md, .claude/**/*.md         Уровень 2: документы
```

Каждый уровень валидируется уровнем выше. Механизм связи зависит от природы файла:
`$schema` для данных (уровни 0–1), `blueprint` для документов (уровень 2).

### 3.2. Формат определений типов

Определение типа — YAML-файл. Не markdown, не JSON Schema. YAML выбран потому что:

- Читаемость выше JSON при наличии вложенных структур и комментариев
- Привычный формат для конфигурации в экосистеме Node.js/TypeScript
- Валидируется JSON Schema (YAML -> JSON маппинг 1:1)
- Поддерживается всеми инструментами экосистемы (ajv, VS Code, remark-lint)

Определение типа **не является** JSON Schema. Оно содержит JSON Schema-совместимые
constraints для frontmatter, но также определяет правила для body, prose и ссылок —
аспекты, которые JSON Schema не покрывает.

Определение типа содержит `$schema` — ссылку на `meta-schema.json`. Это корректное
использование `$schema`: YAML-данные объявляют схему, по которой они валидируются.

### 3.3. Vocabulary мета-схемы

Мета-схема определяет, какие аспекты документа можно ограничить. Vocabulary состоит
из пяти секций, соответствующих уровням валидации 2–6 из исследования
[markdown-organization-research.md](markdown-organization-research.md):

| Секция        | Уровень валидации   | Исполнитель        | Что определяет                                             |
| ------------- | ------------------- | ------------------ | ---------------------------------------------------------- |
| `frontmatter` | 2. Schema           | Детерминистический | Обязательные/опциональные поля, типы, constraints          |
| `structure`   | 3. Body structure   | Детерминистический | Heading rules, обязательные секции, требуемые элементы     |
| `prose`       | 4. Prose quality    | Детерминистический | Язык, грамматическое лицо, RFC 2119, Vale styles           |
| `references`  | 5. Cross-references | Детерминистический | Валидация frontmatter-ссылок и internal links              |
| `review`      | 6. AI review        | LLM-агент          | Семантические критерии, guidance для нюансированной оценки |

Уровень 1 (форматирование) — внешний к системе типов:
Prettier и markdownlint не зависят от типа документа.

Секции 2–5 проверяются детерминистическими инструментами (ajv, AST traversal, Vale, link checker).
Секция 6 (`review`) проверяется LLM-агентом, который получает определение типа как вход
и возвращает findings в формате agent-protocol.md.

Разделение «что проверять» (определение типа) и «как проверять» (агент-ревьюер)
зеркалит архитектуру spec-cycle: type definition = DoD для документа,
агент-ревьюер = generic reviewer, параметризуемый type definition.

### 3.4. `blueprint` как мета-поле

Поле `blueprint` в frontmatter markdown-документа — **мета-поле**, обрабатываемое
валидатором до начала валидации. Оно не описывается в секции `frontmatter` определения
типа (это создало бы циклическую зависимость: чтобы найти тип, нужно знать тип).

Аналогия: `$schema` в JSON Schema также не описывается как property схемы —
это мета-поле, обрабатываемое инфраструктурой валидации.

Валидатор обрабатывает `blueprint` так:

1. Прочитать `blueprint` из frontmatter
2. Резолвить путь относительно корня проекта
3. Загрузить определение типа
4. Валидировать **остальные** поля frontmatter по секции `frontmatter` определения типа
5. Валидировать body, prose, references по остальным секциям

## Часть 4. Мета-схема

### 4.1. Проектные решения

| Решение                       | Выбор                       | Обоснование                                                             |
| ----------------------------- | --------------------------- | ----------------------------------------------------------------------- |
| Формат мета-схемы             | JSON Schema (draft/2020-12) | Переиспользование стандарта, экосистема инструментов (ajv, VS Code)     |
| `$id` мета-схемы              | URN, не привязан к домену   | Проект не имеет домена; URI = идентификатор, не URL                     |
| `$defs` для переиспользования | Shared definitions          | Frontmatter field constraints, section rules — повторяются между типами |
| `additionalProperties: false` | На уровне мета-схемы        | Запрет неизвестных секций в определениях типов                          |

### 4.2. Структура мета-схемы

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:acorn:schemas:meta-schema:v1",
  "title": "Acorn Document Type Definition",
  "description": "Meta-schema defining the vocabulary for markdown document type definitions",

  "type": "object",
  "required": ["$schema", "name", "version", "description", "frontmatter"],
  "additionalProperties": false,

  "properties": {
    "$schema": {
      "type": "string",
      "description": "Path to meta-schema.json for validation and editor support"
    },
    "name": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]*$",
      "description": "Type identifier. Matches the filename stem (e.g. 'spec' from spec.schema.yml)"
    },
    "version": {
      "$ref": "#/$defs/semver",
      "description": "SemVer version of this type definition"
    },
    "description": {
      "type": "string",
      "minLength": 1,
      "description": "Purpose and intended usage of this document type"
    },
    "frontmatter": { "$ref": "#/$defs/frontmatterRules" },
    "structure":   { "$ref": "#/$defs/structureRules" },
    "prose":       { "$ref": "#/$defs/proseRules" },
    "references":  { "$ref": "#/$defs/referenceRules" },
    "review":      { "$ref": "#/$defs/reviewRules" }
  },

  "$defs": { "...see §4.3..." }
}
```

### 4.3. Определения (`$defs`)

#### Общие

```json
"semver": {
  "type": "string",
  "pattern": "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)$"
}
```

#### Frontmatter rules (`frontmatterRules`)

```json
"frontmatterRules": {
  "type": "object",
  "required": ["required"],
  "additionalProperties": false,
  "properties": {
    "required": { "$ref": "#/$defs/fieldMap" },
    "optional": { "$ref": "#/$defs/fieldMap" },
    "additionalProperties": {
      "type": "boolean",
      "default": false,
      "description": "Allow undeclared fields in frontmatter"
    }
  }
},

"fieldMap": {
  "type": "object",
  "additionalProperties": { "$ref": "#/$defs/fieldConstraint" }
},

"fieldConstraint": {
  "type": "object",
  "required": ["type"],
  "additionalProperties": false,
  "properties": {
    "type":      { "enum": ["string", "number", "boolean", "array"] },
    "enum":      { "type": "array", "minItems": 1 },
    "const":     {},
    "minLength": { "type": "integer", "minimum": 0 },
    "pattern":   { "type": "string", "format": "regex" },
    "items":     { "$ref": "#/$defs/fieldConstraint" },
    "description": { "type": "string" }
  }
}
```

`fieldConstraint` использует подмножество ключевых слов JSON Schema (`type`, `enum`,
`const`, `minLength`, `pattern`, `items`). Это сознательное решение: constraints
frontmatter семантически совместимы с JSON Schema, что позволяет конвертировать
определение типа в полноценную JSON Schema для валидации инструментами типа ajv.

#### Structure rules (`structureRules`)

```json
"structureRules": {
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "headings": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "require_h1":         { "type": "boolean", "default": true },
        "max_depth":          { "type": "integer", "minimum": 1, "maximum": 6 },
        "h1_matches_summary": { "type": "boolean", "default": false }
      }
    },
    "sections": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "required": {
          "type": "array",
          "items": { "$ref": "#/$defs/sectionRule" }
        },
        "optional": {
          "type": "array",
          "items": { "$ref": "#/$defs/sectionRule" }
        }
      }
    },
    "elements": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "code_blocks": { "$ref": "#/$defs/elementMinRule" },
        "tables":      { "$ref": "#/$defs/elementMinRule" },
        "lists":       { "$ref": "#/$defs/elementMinRule" }
      }
    }
  }
},

"sectionRule": {
  "type": "object",
  "required": ["name", "level"],
  "additionalProperties": false,
  "properties": {
    "name":      { "type": "string", "description": "Heading text or regex pattern" },
    "level":     { "type": "integer", "minimum": 2, "maximum": 6 },
    "min_words": { "type": "integer", "minimum": 0 }
  }
},

"elementMinRule": {
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "min": { "type": "integer", "minimum": 0 }
  }
}
```

#### Prose rules (`proseRules`)

```json
"proseRules": {
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "language": {
      "enum": ["ru", "en"],
      "description": "Primary language of the document"
    },
    "person": {
      "enum": ["first", "second", "third"],
      "description": "Required grammatical person"
    },
    "rfc2119": {
      "enum": ["required", "optional", "forbidden"],
      "description": "Usage of RFC 2119 keywords"
    },
    "vale": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "extends": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Vale style packages to apply"
        }
      }
    }
  }
}
```

#### Reference rules (`referenceRules`)

```json
"referenceRules": {
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "frontmatter": {
      "type": "object",
      "additionalProperties": { "$ref": "#/$defs/refFieldRule" }
    },
    "internal_links": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "must_resolve": { "type": "boolean", "default": true }
      }
    }
  }
},

"refFieldRule": {
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "target_must_exist": {
      "type": "boolean",
      "default": true,
      "description": "Target path must exist in the file system"
    },
    "allowed_extensions": {
      "type": "array",
      "items": { "type": "string", "pattern": "^\\." },
      "description": "Allowed file extensions for targets"
    },
    "allowed_prefixes": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Allowed path prefixes for targets"
    }
  }
}
```

#### Review rules (`reviewRules`)

```json
"reviewRules": {
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "criteria": {
      "type": "array",
      "items": { "$ref": "#/$defs/reviewCriterion" },
      "description": "Structured rules for AI reviewer. Each criterion is evaluated as pass/fail."
    },
    "guidance": {
      "type": "string",
      "description": "Free-form review guidance for nuanced assessment beyond binary criteria"
    }
  }
},

"reviewCriterion": {
  "type": "object",
  "required": ["id", "rule", "severity"],
  "additionalProperties": false,
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^[A-Z][A-Z0-9]*$",
      "description": "Unique identifier within the type (e.g. S6, A9)"
    },
    "rule": {
      "type": "string",
      "description": "What to check — one verifiable statement"
    },
    "severity": {
      "enum": ["error", "warning"],
      "description": "error = must fix before acceptance, warning = recommendation"
    },
    "examples": { "$ref": "#/$defs/reviewExamples" }
  }
},

"reviewExamples": {
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "pass": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Examples of text that satisfies the criterion"
    },
    "fail": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Examples of text that violates the criterion"
    }
  }
}
```

Секция `review` содержит два компонента:

- **`criteria`** — структурированные правила, каждое с уникальным id, формулировкой и severity.
  AI-ревьюер проверяет каждый criterion как pass/fail и возвращает findings для failures.
  Опциональные `examples` (pass/fail) устраняют неоднозначность формулировки — few-shot
  примеры повышают точность оценки LLM.

- **`guidance`** — свободный текст для нюансированной оценки, которую нельзя свести
  к бинарным критериям (полнота, внутренняя непротиворечивость, актуальность).
  AI-ревьюер использует guidance для генерации рекомендаций уровня warning.

Разделение criteria/guidance отражает два режима работы LLM:
criteria → classification (pass/fail, высокая agreement между запусками),
guidance → generation (открытые наблюдения, ниже agreement, но выше coverage).

## Часть 5. Определения типов

Поле `blueprint` — мета-поле, обрабатываемое валидатором. Оно не описывается
в секции `frontmatter` определений типов ([§ 3.4](#34-blueprint-как-мета-поле)). Поле `type` (текущий подход)
удаляется: тип определяется из `blueprint`.

### 5.1. `spec.schema.yml`

```yaml
$schema: ../meta-schema.json

name: spec
version: '1.0.0'
description: >
  Спецификация модуля с жизненным циклом.
  Управляет имплементацией: код должен соответствовать спецификации.
  Имеет статус (draft -> ready -> implemented -> outdated).

frontmatter:
  required:
    summary:
      type: string
      minLength: 1
      description: Заголовок спецификации
    description:
      type: string
      minLength: 1
      description: Краткое описание (1-2 предложения)
    status:
      type: string
      enum: [draft, ready, implemented, outdated]
      description: Статус жизненного цикла спецификации
  optional:
    relates:
      type: array
      items:
        type: string
        pattern: "^(docs|apps|packages|\\.claude)/"
      description: Связанные документы (кросс-ссылки)
    maps_to:
      type: array
      items:
        type: string
      description: Пути к коду, реализующему спецификацию
  additionalProperties: false

structure:
  headings:
    require_h1: true
    max_depth: 4
  sections:
    required:
      - name: 'Обзор'
        level: 2

prose:
  language: ru
  person: third
  rfc2119: required

references:
  frontmatter:
    relates:
      target_must_exist: true
      allowed_extensions: ['.md']
    maps_to:
      target_must_exist: false
  internal_links:
    must_resolve: true

review:
  criteria:
    - id: S3
      rule: Документ содержит стандартную вставку RFC 2119 после front matter
      severity: error
    - id: S4
      rule: Каждая операция содержит секции Вход, Поведение, Расширения, Результат
      severity: error
    - id: S5
      rule: Нет маркеров [NEEDS CLARIFICATION] при status ready или implemented
      severity: error
    - id: S6
      rule: Текст написан в третьем лице — нет обращений на «ты» и императивов
      severity: error
      examples:
        pass:
          - 'Система создаёт запись в таблице sessions.'
        fail:
          - 'Создайте запись в таблице sessions.'
    - id: S7
      rule: Ключевые слова RFC 2119 используются по назначению
      severity: error
    - id: S8
      rule: Каждый шаг поведения — одно наблюдаемое действие, без «и»
      severity: warning
      examples:
        pass:
          - 'Система создаёт запись в таблице.'
        fail:
          - 'Система создаёт запись в таблице и отправляет уведомление.'
  guidance: >
    Оценить полноту покрытия: все ли аспекты модуля описаны.
    Проверить что каждая операция однозначно определяет поведение системы.
    Убедиться что расширения покрывают граничные случаи и ошибки.
```

### 5.2. `index.schema.yml`

```yaml
$schema: ../meta-schema.json

name: index
version: '1.0.0'
description: >
  Общее описание концепции папки и пререквизиты для остальных файлов.
  Обязателен к прочтению при работе с любым файлом из папки.
  Один index.md на директорию.

frontmatter:
  required:
    summary:
      type: string
      minLength: 1
    description:
      type: string
      minLength: 1
  optional:
    relates:
      type: array
      items:
        type: string
  additionalProperties: false

structure:
  headings:
    require_h1: true
    max_depth: 3

prose:
  language: ru
  person: third
  rfc2119: optional

references:
  frontmatter:
    relates:
      target_must_exist: true
      allowed_extensions: ['.md']
  internal_links:
    must_resolve: true
```

### 5.3. `doc.schema.yml`

```yaml
$schema: ../meta-schema.json

name: doc
version: '1.0.0'
description: >
  Информационный документ: архитектура, гайды, конвенции.
  Не управляет имплементацией, предоставляет контекст и объяснения.

frontmatter:
  required:
    summary:
      type: string
      minLength: 1
    description:
      type: string
      minLength: 1
  optional:
    relates:
      type: array
      items:
        type: string
  additionalProperties: false

structure:
  headings:
    require_h1: true
    max_depth: 4

prose:
  language: ru
  person: third
  rfc2119: optional

references:
  frontmatter:
    relates:
      target_must_exist: true
      allowed_extensions: ['.md']
  internal_links:
    must_resolve: true
```

### 5.4. `research.schema.yml`

```yaml
$schema: ../meta-schema.json

name: research
version: '1.0.0'
description: >
  Исследование и анализ: обоснование решений, обзор альтернатив, источники.
  Содержит обязательные секции «Контекст» и «Сводка».

frontmatter:
  required:
    summary:
      type: string
      minLength: 1
    description:
      type: string
      minLength: 1
  optional:
    relates:
      type: array
      items:
        type: string
  additionalProperties: false

structure:
  headings:
    require_h1: true
    max_depth: 4
  sections:
    required:
      - name: 'Контекст'
        level: 2
      - name: 'Сводка'
        level: 2

prose:
  language: ru
  person: third
  rfc2119: optional

references:
  frontmatter:
    relates:
      target_must_exist: true
      allowed_extensions: ['.md']
  internal_links:
    must_resolve: true

review:
  criteria:
    - id: R4
      rule: Присутствует дата проведения исследования
      severity: warning
    - id: R5
      rule: Рассмотрены альтернативы — минимум два варианта с обоснованием выбора
      severity: warning
  guidance: >
    Оценить полноту анализа альтернатив — не упущены ли значимые варианты.
    Проверить что решения обоснованы и обоснования не содержат логических ошибок.
    Убедиться что источники указаны и релевантны.
```

## Часть 6. `blueprint` в документах

### 6.1. Формат

**До (текущее состояние):**

```yaml
---
summary: Авторизация
description: Аутентификация, сессии, API-токены
type: spec
status: implemented
---
```

**После:**

```yaml
---
blueprint: schemas/v1/spec.schema.yml
summary: Авторизация
description: Аутентификация, сессии, API-токены
status: implemented
---
```

Поле `type` удаляется. Тип документа однозначно определяется из `blueprint`
(имя файла без `.schema.yml`).

### 6.2. Резолвинг

Валидатор определяет тип документа:

1. Если есть `blueprint` -> резолвить относительно корня проекта -> загрузить определение типа
2. Если нет `blueprint`, но есть `type` -> резолвить как `schemas/v{latest}/{type}.schema.yml`
   (backward compatibility с legacy-документами, с предупреждением)
3. Если нет ни `blueprint`, ни `type` -> ошибка валидации

### 6.3. Позиция в frontmatter

`blueprint` — первое поле frontmatter (по аналогии с `$schema` в JSON Schema,
которое ставится первым в JSON-документе). Это конвенция для читаемости, не требование.

### 6.4. Blueprint и каналы стабильности

Документ выбирает канал стабильности через значение `blueprint`:

```yaml
# Stable — SemVer гарантии
blueprint: schemas/v1/spec.schema.yml

# Labs — экспериментальные изменения поверх v1
blueprint: schemas/v1-labs/spec.schema.yml

# Draft — нестабильная схема, может измениться в любой момент
blueprint: schemas/draft/workflow.schema.yml
```

Валидатор определяет канал по пути:

- `schemas/v{N}/...` → stable
- `schemas/v{N}-labs/...` → labs
- `schemas/draft/...` → draft

Для labs и draft валидатор может выводить предупреждение:
«документ использует нестабильную схему».

## Часть 7. Файловая структура

```text
schemas/
├── meta-schema.json                 # JSON Schema: vocabulary определений типов
│                                    #   $schema: draft/2020-12
│                                    #   $id: urn:acorn:schemas:meta-schema:v1
├── draft/                           # Greenfield: новые типы без stable baseline
│   └── *.schema.yml                 #   Нет version / version: "0.0.0"
├── v1/                              # Stable: major version 1
│   ├── spec.schema.yml              #   $schema: ../meta-schema.json
│   ├── index.schema.yml             #   version: "1.0.0"
│   ├── doc.schema.yml
│   ├── research.schema.yml
│   ├── manifest.schema.yml
│   └── agent.schema.yml
├── v1-labs/                         # Labs: эксперименты поверх v1
│   └── *.schema.yml                 #   v1 + пробные изменения
└── CHANGELOG.md                     # История изменений схем
```

Правила:

- `meta-schema.json` — единственный JSON-файл (потому что это JSON Schema)
- `v{N}/*.schema.yml` — определения типов в YAML с `$schema: ../meta-schema.json`
- `draft/*.schema.yml` — нестабильные определения, `$schema: ../meta-schema.json`
- `v{N}-labs/*.schema.yml` — экспериментальные определения, `$schema: ../meta-schema.json`
- `CHANGELOG.md` — обязателен; фиксирует изменения, breaking changes, миграции
- Директория `v{N+1}/` создаётся только при breaking change
- Директория `v{N}-labs/` создаётся при необходимости экспериментов; удаляется после graduation

## Часть 8. Pipeline валидации

### 8.1. Bootstrap (самоконсистентность)

Перед валидацией документов необходимо убедиться, что сами схемы корректны:

```text
1. meta-schema.json validates against JSON Schema draft/2020-12  (внешний стандарт)
2. schemas/{v1,v1-labs,draft}/*.schema.yml validate against meta-schema.json  (наш vocabulary)
3. version field in v{N}/*.schema.yml matches directory v{N}     (инвариант, не для draft)
```

Это аналог `tsc --noEmit` — проверка типов до запуска кода.

### 8.2. Валидация документов

```text
doc:validate
  ├── doc:schema       Frontmatter vs определение типа (level 2)
  ├── doc:structure    Body structure vs определение типа (level 3)
  ├── doc:prose        Prose quality, Vale styles (level 4)
  ├── doc:links        Cross-references, internal links (level 5)
  └── doc:review       AI review: criteria + guidance (level 6)
```

`doc:validate` — точка агрегации. Гранулярные шаги (`doc:schema`, `doc:structure`, ...)
позволяют запускать проверки по отдельности для быстрой обратной связи во время
редактирования. `doc:validate` запускает все шаги последовательно и агрегирует результаты.

`doc:review` отличается от остальных шагов: он недетерминистический (LLM), дороже
по времени и ресурсам, и его результаты менее воспроизводимы. Поэтому `doc:review`
может запускаться отдельно от детерминистических шагов — например, только при
graduation из draft или перед merge.

### 8.3. Интеграция в общий pipeline

```text
format (Prettier)
  -> build (tsc)
  -> lint (ESLint)
  -> doc:validate (schema + structure + prose + links + [review])
  -> test (Jest)
```

`[review]` — опциональный шаг, запускаемый по флагу или при определённых условиях
(graduation, pre-merge). Детерминистические шаги запускаются всегда.

## Часть 9. Миграция существующих документов

### 9.1. Стратегия

Миграция должна быть **постепенной и неразрушительной**:

1. Создать `schemas/` с мета-схемой и определениями типов v1
2. Заменить `type` на `blueprint` в документах (автоматизируемо: `type` -> `blueprint` маппинг)
3. Валидатор поддерживает оба варианта (`blueprint` и legacy `type`) на этапе миграции
4. После миграции всех документов — удалить поддержку `type` из валидатора

### 9.2. Скрипт миграции (концептуально)

```text
Для каждого .md файла с frontmatter:
  1. Прочитать frontmatter.type
  2. Если type существует и blueprint отсутствует:
     -> Заменить type: {name} на blueprint: schemas/v1/{name}.schema.yml
  3. Валидировать документ по определению типа
  4. Вывести отчёт (pass/fail per document)
```

## Заключение

| Решение                       | Выбор                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| `$schema` для JSON/YAML       | Стандартное использование: meta-schema.json и \*.schema.yml                              |
| Механизм для markdown         | `blueprint` — внутренняя конвенция, URI к определению типа                               |
| Обоснование имени `blueprint` | Точная метафора (валидация, не scaffold); не перегружено; не присваивает чужую семантику |
| Формат значения `blueprint`   | Относительный путь от корня: `schemas/v1/{name}.schema.yml`                              |
| Версионирование               | SemVer (MAJOR.MINOR.PATCH); major в пути директории, full version в файле                |
| Breaking change               | Удаление/изменение полей, сужение enum, новое required поле                              |
| Структура директорий          | Lockstep (все типы в `v{N}/`); per-type при >15 типах                                    |
| Каналы стабильности           | `draft/` (greenfield) + `v{N}-labs/` (эксперименты поверх stable)                        |
| Прецедент каналов             | Docker BuildKit: stable + labs channels                                                  |
| Graduation из draft           | Копирование в `v1/` при стабилизации; критерии: валидация, стабильность, применимость    |
| Graduation из labs            | `v{N}/` (minor, backward-compatible) или `v{N+1}/` (breaking)                            |
| Формат определений типов      | YAML с `$schema: ../meta-schema.json` (корректное использование $schema для YAML-данных) |
| Формат мета-схемы             | JSON Schema draft/2020-12                                                                |
| `$id` мета-схемы              | `urn:acorn:schemas:meta-schema:v1` (URN, не URL)                                         |
| `blueprint` как мета-поле     | Не описывается в type definition; обрабатывается валидатором до начала валидации         |
| AI review в type definition   | Секция `review`: `criteria` (structured pass/fail) + `guidance` (free-form) + `examples` |
| Разделение review             | criteria → classification (высокая agreement), guidance → generation (высокая coverage)  |
| Схемы заменяют document-types | `.claude/docs/document-types/` больше не нужны; все правила в `.claude/schemas/v1/`      |
| Валидатор                     | Custom (gray-matter + ajv + custom logic + LLM для review)                               |
| Миграция                      | Постепенная: `type` -> `blueprint`, оба поддерживаются параллельно                       |
| `doc:validate`                | Точка агрегации: schema + structure + prose + links + [review]                           |
| `doc:review`                  | Опциональный LLM-шаг; запускается при graduation или pre-merge                           |

Источники:

- [JSON Schema Core Specification (draft/2020-12)](https://json-schema.org/draft/2020-12/json-schema-core)
- [JSON Schema — $schema keyword](https://www.learnjsonschema.com/2020-12/core/schema/)
- [JSON Schema — Dialect and Vocabulary](https://json-schema.org/understanding-json-schema/reference/schema)
- [DCMI: conformsTo (ISO 15836)](https://www.dublincore.org/specifications/dublin-core/dcmi-terms/terms/conformsTo/)
- [RFC 6906 — The 'profile' Link Relation Type](https://www.rfc-editor.org/rfc/rfc6906.html)
- [remark-lint-frontmatter-schema](https://github.com/JulianCataldo/remark-lint-frontmatter-schema)
- [LwDITA (OASIS)](https://docs.oasis-open.org/dita/LwDITA/v1.0/cnprd01/LwDITA-v1.0-cnprd01.html)
- [SchemaVer (Snowplow)](https://snowplow.io/blog/introducing-schemaver-for-semantic-versioning-of-schemas)
- [Structured MADR (JSON Schema + GitHub Action)](https://github.com/zircote/structured-madr)
- [Semantic Versioning 2.0.0](https://semver.org/)
- [Docker BuildKit Custom Dockerfile syntax](https://docs.docker.com/build/buildkit/frontend/)
- [Dockerfile Release Notes](https://docs.docker.com/build/dockerfile/release-notes/)
