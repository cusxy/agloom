---
summary: Структура пользовательской документации — guide/ и reference/
description: >
  Спецификация структуры пользовательской документации Agloom:
  директории docs/guide/ (tutorials) и docs/reference/ (справочник),
  frontmatter-формат, порядок файлов, требования к содержанию
  каждого документа, обновление README.md.
type: spec
status: implemented
relates:
  - docs/specs/help-command.md
  - docs/specs/cli.md
  - docs/specs/config.md
  - docs/specs/plugin-manifest.md
  - docs/specs/plugin-loading.md
  - docs/specs/plugin-values.md
  - docs/specs/interpolation.md
  - docs/specs/patch-mechanism.md
  - docs/specs/provider-overlay.md
  - docs/specs/instructions-transpiler.md
  - docs/specs/skills-transpiler.md
  - docs/specs/agents-transpiler.md
  - docs/specs/permissions-transpiler.md
  - docs/specs/mcp-transpiler.md
maps_to:
  - docs/guide/
  - docs/reference/
  - README.md
---

# Структура пользовательской документации

Ключевые слова «ТРЕБУЕТСЯ», «ЗАПРЕЩАЕТСЯ», «ДОЛЖЕН», «НЕ ДОЛЖЕН», «СЛЕДУЕТ»,
«НЕ СЛЕДУЕТ», «МОЖЕТ» и «НЕОБЯЗАТЕЛЬНО» в этом документе толкуются
в соответствии с [RFC 2119](https://tools.ietf.org/html/rfc2119).

Данная спецификация описывает структуру пользовательской документации Agloom,
заменяющую текущую директорию `docs/usage/`. Документация разделена на две
категории по Diátaxis framework:

- **Guide** (`docs/guide/`) — tutorial-style, learning-oriented.
  Пошаговое обучение, читатель «на рельсах».
- **Reference** (`docs/reference/`) — information-oriented.
  Фактографическая справка для существующих пользователей.

Язык документации — английский (проект open source).

## Структура директорий

```text
docs/
├── guide/
│   ├── introduction.md
│   ├── getting-started.md
│   ├── project-structure.md
│   ├── instructions.md
│   ├── skills-and-agents.md
│   ├── plugins.md
│   ├── overlays.md
│   └── variables.md
├── reference/
│   ├── cli.md
│   ├── config.md
│   ├── plugin-manifest.md
│   ├── adapters.md
│   ├── interpolation.md
│   ├── patch-operations.md
│   └── transpilers.md
├── specs/          (без изменений)
├── researches/     (без изменений)
└── postmortems/    (без изменений)
```

## Frontmatter-формат

Каждый файл документации ТРЕБУЕТСЯ начинать с YAML frontmatter:

```yaml
---
title: <заголовок документа>
description: <однострочное описание, используется в agloom help>
order: <целое число, определяет порядок в списке topics>
---
```

- `title` (string, обязательно) — заголовок документа. Используется
  для отображения в `agloom help` если нужен human-readable title.
- `description` (string, обязательно) — описание документа в одну строку.
  Отображается в выводе `agloom help` рядом с именем topic.
  Длина СЛЕДУЕТ ограничивать 80 символами.
- `order` (integer, обязательно) — порядок отображения в списке topics.
  Нумерация начинается с 1. Значения НЕ ДОЛЖНЫ повторяться внутри
  одной категории.

## Удаление docs/usage/

Директория `docs/usage/` ТРЕБУЕТСЯ удалить целиком после создания
новой структуры. Все 5 файлов (`configuration.md`, `transpile.md`,
`init.md`, `clean.md`, `adapters.md`) заменяются документами
в `docs/guide/` и `docs/reference/`.

## Обновление package.json

Поле `files` в `package.json` ТРЕБУЕТСЯ обновить
(см. `docs/specs/help-command.md` § Конфигурация сборки).

## Категория Guide

### guide/introduction.md (order: 1)

**Цель:** объяснить проблему, которую решает Agloom, его философию
и позиционирование. Читатель после прочтения понимает «зачем мне это».

**Содержание ТРЕБУЕТСЯ включать:**

1. **The Problem** — AI coding assistants (Claude Code, OpenCode, Codex,
   KiloCode и др.) используют разные форматы конфигурации. Ручное
   поддержание нескольких файлов — tedious и error-prone.
2. **The Solution** — единый канонический формат (`.agloom/`),
   транспиляция в agent-specific файлы. Аналогия: Sass → CSS,
   TypeScript → JavaScript.
3. **Core Principles:**
   - Single source of truth — одна директория `.agloom/`, множество выходов.
   - Adapter-driven — каждый целевой инструмент поддерживается адаптером.
   - Plugin-extensible — переиспользование skills, agents, docs через плагины.
   - Non-intrusive — Agloom генерирует файлы, но не вмешивается
     в работу целевых инструментов.
4. **When to use Agloom** — проект использует 2+ AI coding assistants,
   команда хочет стандартизировать инструкции, есть переиспользуемые
   skills/agents между проектами.
5. **When NOT to use Agloom** — проект использует только один инструмент
   и не планирует расширяться, нет потребности в плагинах.

**Содержание ЗАПРЕЩАЕТСЯ включать:** установку, конкретные команды CLI,
примеры конфигурации (это scope getting-started и reference).

### guide/getting-started.md (order: 2)

**Цель:** от нуля до первого `agloom transpile` за 5 минут.
Пошаговый tutorial.

**Содержание ТРЕБУЕТСЯ включать:**

1. **Prerequisites** — Node.js 20+, npm/pnpm.
2. **Installation** — `npm install -g agloom`.
3. **Step 1: Initialize** — создание `.agloom/config.yml` вручную
   или через `agloom init --adapter claude`.
4. **Step 2: Write instructions** — создание `.agloom/instructions/AGLOOM.md`
   с минимальным содержимым.
5. **Step 3: Transpile** — `agloom transpile` и объяснение что произошло.
6. **Step 4: Verify** — проверка сгенерированных файлов.
7. **Formatting** — краткое упоминание `agloom format` для
   форматирования файлов проекта. Ссылка на reference/cli для деталей.
8. **What's next** — ссылки на project-structure, instructions, plugins.

**Tutorial-стиль:** каждый шаг содержит команду для выполнения
и объяснение результата. Читатель ДОЛЖЕН иметь возможность следовать
шагам дословно и получить рабочий результат.

### guide/project-structure.md (order: 3)

**Цель:** объяснить анатомию директории `.agloom/` и связь между
каноническими и сгенерированными файлами.

**Содержание ТРЕБУЕТСЯ включать:**

1. **Canonical directory** — полная структура `.agloom/` с описанием
   каждой поддиректории:
   - `config.yml` — конфигурация проекта.
   - `instructions/` — инструкции для агентов.
   - `skills/` — определения skills.
   - `agents/` — определения sub-agents.
   - `docs/` — документация для агентов.
   - `schemas/` — JSON/OpenAPI схемы.
   - `mcp.yml` — конфигурация MCP-серверов.
   - `permissions.yml` — разрешения.
   - `overlays/<adapter>/` — per-adapter overrides.
   - `mcp.yml` — конфигурация MCP-серверов (краткое упоминание,
     подробнее в reference/transpilers).
   - `permissions.yml` — разрешения агентов (краткое упоминание,
     подробнее в reference/transpilers).
2. **Generated files** — какие файлы генерирует каждый адаптер.
   Таблица: adapter → output files.
3. **Important rule** — НИКОГДА не редактировать сгенерированные файлы
   напрямую, всегда `.agloom/` → transpile.
4. **.gitignore** — рекомендация: сгенерированные файлы следует добавить
   в `.gitignore`, canonical `.agloom/` — коммитить.

### guide/instructions.md (order: 4)

**Цель:** научить писать инструкции для AI-агентов с agent-specific блоками.

**Содержание ТРЕБУЕТСЯ включать:**

1. **What are instructions** — файл `AGLOOM.md` в `.agloom/instructions/`,
   содержит инструкции для AI coding assistants.
2. **Basic instructions** — создание AGLOOM.md с общими инструкциями,
   которые попадут во все адаптеры.
3. **Agent-specific blocks** — HTML-комментарии `<!-- agent:id -->`
   / `<!-- /agent:id -->` для content, специфичного для конкретного
   адаптера. Пример с claude и agentsmd.
4. **Valid agent IDs** — `claude`, `agentsmd`. Объяснение что `opencode`
   использует `agentsmd` формат (AGENTS.md).
5. **Multiple instruction files** — если поддерживается, описать;
   если нет — указать явно.
6. **Example** — полный пример AGLOOM.md с общими и agent-specific секциями.

### guide/skills-and-agents.md (order: 5)

**Цель:** научить создавать skills и agents.

**Содержание ТРЕБУЕТСЯ включать:**

1. **What are skills** — переиспользуемые action-определения,
   хранятся в `.agloom/skills/`.
2. **Creating a skill** — пошаговый пример создания skill-файла.
   Формат: Markdown с frontmatter. Показать структуру frontmatter.
3. **What are agents** — определения sub-agents,
   хранятся в `.agloom/agents/`.
4. **Creating an agent** — пошаговый пример создания agent-файла.
5. **Adapter support** — таблица: какие адаптеры поддерживают skills/agents.
   (claude и opencode — да, agentsmd — нет).
6. **Example** — реалистичный пример skill + agent.

### guide/plugins.md (order: 6)

**Цель:** научить использовать и создавать плагины.

**Содержание ТРЕБУЕТСЯ включать:**

1. **What are plugins** — переиспользуемые пакеты skills, agents, docs,
   schemas. Могут быть локальными или git-репозиториями.
2. **Using a plugin** — добавление plugin в config.yml:
   - Из git: `git@github.com:user/plugin`, `https://...`, с ref и subpath.
   - Локальный: `../path/to/plugin`.
   - Object-форма с values.
3. **Plugin values** — передача значений в плагин. Пример с `values:`.
   Environment variables через `${env:VAR}`.
4. **Creating a plugin** — структура plugin-директории:
   `plugin.yml` + `.agloom/` subdirectories.
   Ссылка на reference/plugin-manifest для полного формата.
5. **Plugin caching** — git-плагины кешируются в `~/.agloom/cache/plugins/`.
   Очистка: `agloom cache clean`. Флаг `--refresh` при transpile.
6. **How plugins merge** — плагины проходят тот же pipeline что и локальный
   контент, результаты мержатся в output.

### guide/overlays.md (order: 7)

**Цель:** научить использовать overlays для adapter-specific кастомизации.

**Содержание ТРЕБУЕТСЯ включать:**

1. **What are overlays** — raw файлы в `.agloom/overlays/<adapter>/`,
   применяются после транспиляции. Для контента, который не вписывается
   в канонический формат.
2. **When to use overlays** — adapter-specific configs, JSON settings,
   файлы, которые адаптер ожидает в определённом формате.
3. **File merge strategies:**
   - **Deep merge** — `.json`, `.jsonc`, `.yaml`, `.yml`, `.toml`.
   - **Full replacement** — все остальные форматы.
4. **Suffix modifiers:**
   - `.override` — принудительная полная замена (вместо merge).
   - `.patch` — patch operations для тонкой настройки.
5. **Example** — конкретный пример overlay для Claude adapter.
6. **Ссылка** на reference/patch-operations для полного описания операций.

### guide/variables.md (order: 8)

**Цель:** научить использовать переменные и интерполяцию.

**Содержание ТРЕБУЕТСЯ включать:**

1. **What is interpolation** — подстановка значений в файлы при транспиляции.
2. **Variable namespaces:**
   - `${agloom:VAR}` — адаптер-зависимые переменные (e.g., `${agloom:SKILLS_DIR}`,
     `${agloom:CLAUDE_SKILLS_DIR}`).
   - `${env:VAR}` — переменная окружения.
   - `${values:VAR}` — project/plugin значение.
3. **Project variables** — объявление в `config.yml` секции `variables`.
   Shorthand и full form. Required, default, sensitive.
4. **Plugin values** — передача значений в плагины через `values:` в config.
5. **.env file** — автоматически загружается из корня проекта.
6. **Where interpolation applies** — в каких файлах происходит подстановка
   (список расширений).
7. **Example** — сквозной пример: объявление переменной в config →
   использование в skill → результат после transpile.

## Категория Reference

### reference/cli.md (order: 1)

**Цель:** полная справка по всем CLI-командам.

**Содержание ТРЕБУЕТСЯ включать для каждой команды:**

- Synopsis (usage string).
- Описание.
- Все опции с типами и default values.
- Примеры.
- Exit codes.

**Команды:**

1. `agloom transpile` — с опциями `--adapter`, `--all`, `--clean`,
   `--verbose`, `--refresh`.
2. `agloom clean` — с опциями `--adapter`, `--all`, `--verbose`.
3. `agloom init` — с опциями `--adapter`, `--all`, `--force`, `--verbose`.
4. `agloom adapters` — с опцией `--all`.
5. `agloom format` — с опциями `--check`, `--all`, файлы/глобы.
6. `agloom help` — с аргументом `<topic>`.
7. `agloom cache clean`.
8. Global options: `--help`, `--version`.

### reference/config.md (order: 2)

**Цель:** полное описание формата `.agloom/config.yml`.

**Содержание ТРЕБУЕТСЯ включать:**

1. **File location** — `<projectRoot>/.agloom/config.yml`.
2. **Full schema** — все поля с типами, описаниями, constraints:
   - `adapters` — array\<string>, обязательно, not empty.
   - `plugins` — array, опционально. String и object формы.
   - `variables` — object, опционально. Shorthand и full form.
   - `prettier` — object, опционально.
   - `markdownlint` — object, опционально.
3. **Validation rules** — что вызывает ошибку (unknown adapters,
   hidden adapters, empty array, etc.).
4. **Complete example** — пример со всеми секциями.

### reference/plugin-manifest.md (order: 3)

**Цель:** полное описание формата `plugin.yml`.

**Содержание ТРЕБУЕТСЯ включать:**

1. **File location** — корень plugin-директории.
2. **Full schema** — все поля:
   - `name` — string, lowercase+hyphens, max 214 chars.
   - `version` — string, valid semver.
   - `description` — string.
   - `author` — object (`name`, `email`, `url`).
   - `license` — string, опционально.
   - `homepage` — string (valid URL), опционально.
   - `keywords` — array\<string>, опционально.
   - `variables` — object, опционально. Описание variable declarations.
3. **Validation rules**.
4. **Example** — полный plugin.yml.

### reference/adapters.md (order: 4)

**Цель:** справка по доступным адаптерам.

**Содержание ТРЕБУЕТСЯ включать:**

1. **Adapter table** — ID, description, output files.
2. **Per-adapter details:**
   - `claude` — capabilities, output paths, dependencies.
   - `opencode` — capabilities, output paths, dependency on agentsmd.
   - `agentsmd` — capabilities, limitations (no skills/agents).
3. **Capability matrix** — таблица: adapter × feature
   (instructions, skills, agents, docs, schemas, mcp, permissions, overlays).
4. **Dependencies** — opencode → agentsmd.
5. **Hidden adapters** — agentsmd hidden, не указывается в config напрямую.

### reference/interpolation.md (order: 5)

**Цель:** полная справка по интерполяции переменных.

**Содержание ТРЕБУЕТСЯ включать:**

1. **Syntax** — `${type:key}`, `${type:key.subkey}`.
2. **Variable types** — полное описание каждого типа:
   - `adapters` — доступные ключи и свойства.
   - `env` — поведение при отсутствии переменной.
   - `values` — порядок разрешения (plugin values → project variables → env).
3. **Resolution order / precedence**.
4. **Sensitive variables** — правила (`${env:*}` only).
5. **Supported file extensions** — полный список.
6. **Error handling** — что происходит при unresolved variable.

### reference/patch-operations.md (order: 6)

**Цель:** справка по patch-операциям в overlays.

**Содержание ТРЕБУЕТСЯ включать:**

Полное описание каждой операции с примерами:

1. `$set` — замена целевого значения.
2. `$merge` — deep merge объекта.
3. `$mergeBy` — merge массива по ключу (`key` + `items`).
4. `$append` — добавление в конец массива.
5. `$prepend` — добавление в начало массива.
6. `$remove` — удаление из массива (deep equality).
7. `$unset` — удаление ключей из объекта.
8. `$insertAt` — вставка по индексу (`index` + `items`).

Для каждой операции: input → patch → result.

### reference/transpilers.md (order: 7)

**Цель:** справка по модулям транспиляции.

**Содержание ТРЕБУЕТСЯ включать:**

1. **Pipeline overview** — порядок выполнения transpiler modules.
2. **Per-transpiler description:**
   - Instructions Transpiler — source, output per adapter, agent blocks.
   - Skills Transpiler — source, output, adapter support.
   - Agents Transpiler — source, output, adapter support.
   - Docs Transpiler — source, output.
   - Schemas Transpiler — source, output.
   - MCP Transpiler — source format, output per adapter.
   - Permissions Transpiler — source format, output.
3. **Overlay step** — когда и как применяются overlays.
4. **Plugin merge** — когда и как мержатся результаты плагинов.

## README.md

README.md ТРЕБУЕТСЯ переписать полностью. Структура:

1. **Title + tagline** — `agloom` + однострочное описание.
2. **Warning banner** — текущий ⚠️ Warning о нестабильности (сохранить).
3. **The problem / The solution** — краткая версия (2-3 предложения каждый),
   НЕ дублирующая guide/introduction.md.
4. **Quick start** — 4-5 команд от установки до первого transpile.
   НЕ дублирует guide/getting-started.md — только суть.
5. **Supported adapters** — таблица (adapter, description, output).
6. **Documentation** — ссылки на guide/ и reference/ с кратким описанием
   каждого документа. Формат: два раздела (Guide, Reference) со списком
   ссылок.
7. **License** — Apache 2.0.

README НЕ ДОЛЖЕН содержать:

- Подробного описания plugin system (есть в guide/plugins).
- Описания overlays (есть в guide/overlays).
- Описания interpolation (есть в guide/variables).
- Описания формата config.yml (есть в reference/config).
- Полного списка CLI commands с флагами (есть в reference/cli).

## Источники данных

При написании документации ТРЕБУЕТСЯ использовать следующие
источники (в порядке приоритета):

1. Спецификации в `docs/specs/` — каноническое описание поведения.
2. Исходный код `src/` — фактическая реализация.
3. Текущий `README.md` — для верификации, не как основной источник.

## Вне scope

- Содержимое `docs/specs/`, `docs/researches/`, `docs/postmortems/` —
  без изменений.
- Механика команды `agloom help` — описана в `docs/specs/help-command.md`.
- Переводы документации на другие языки.
- Генерация документации из кода (JSDoc, TypeDoc).
- Web-сайт документации.
