---
summary: Instructions Transpiler — библиотека транспиляции AGLOOM.md в agent-specific файлы инструкций
description: >
  Библиотека для транспиляции канонических файлов AGLOOM.md
  в agent-specific файлы инструкций. Поддерживает root и directory
  канонические файлы. Выполняет трансформацию контента:
  парсинг YAML frontmatter, применение override-полей, фильтрацию agent-specific
  секций в body с валидацией допустимых agentId. Расширяется через адаптеры.
type: spec
status: implemented
relates:
  - docs/specs/skills-transpiler.md
  - docs/specs/agents-transpiler.md
  - docs/specs/interpolation.md
  - docs/specs/cli.md
  - docs/specs/integration-tests.md
  - docs/specs/adapter-registry-ext.md
  - docs/researches/agent-capabilities-map/RESEARCH.md
  - docs/researches/existing-alternatives/RESEARCH.md
maps_to:
  - src/instructions-transpiler/
---

# Instructions Transpiler

Ключевые слова «ТРЕБУЕТСЯ», «ЗАПРЕЩАЕТСЯ», «ДОЛЖЕН», «НЕ ДОЛЖЕН», «СЛЕДУЕТ»,
«НЕ СЛЕДУЕТ», «МОЖЕТ» и «НЕОБЯЗАТЕЛЬНО» в этом документе толкуются
в соответствии с [RFC 2119](https://tools.ietf.org/html/rfc2119).

Библиотека для транспиляции канонического файла `AGLOOM.md`
в agent-specific файлы инструкций.
Канонический формат является единственным источником истины (single source of truth);
agent-specific файлы — производные артефакты, генерируемые при каждом запуске
транспиляции.

В отличие от `skills-transpiler` (см. `docs/specs/skills-transpiler.md`),
который выполняет побайтовое копирование, instructions-transpiler выполняет
трансформацию контента: парсинг YAML frontmatter с применением override-полей
и фильтрацию agent-specific секций в body.

## Канонические файлы

Библиотека оперирует двумя видами канонических файлов:

- `AGLOOM.md` в корне проекта — общие инструкции (git-tracked).
- `AGLOOM.md` в подпапках проекта — directory-level инструкции (git-tracked).

### Frontmatter и override

Канонический frontmatter содержит опциональный блок `override`:

```yaml
---
override:
  claude:
    someKey: value
---
```

Правила трансформации frontmatter описаны в операции «Трансформация контента».

### Синтаксис agent-specific секций

Body МОЖЕТ содержать agent-specific секции, ограниченные HTML-комментариями.
Синтаксис тегов, требования к `<agent-id>`, правила вложенности —
идентичны описанию в `docs/specs/agents-transpiler.md` § Синтаксис
agent-specific секций.

Критическое отличие от agents-transpiler: в файлах инструкций ТРЕБУЕТСЯ
валидация допустимых `<agent-id>` (см. «Фильтрация body» § Валидация
допустимых agentId).

## Инициализация

`createInstructionsTranspiler(config)`.

**Вход:**

- `config` (object, обязательно) — конфигурация транспилера.
  - `projectRoot` (string, обязательно) — абсолютный путь к корню проекта.
  - `adapters` (array\<Adapter>, обязательно) — массив адаптеров для целевых агентов.

**Поведение:**

1. Валидировать, что `projectRoot` является абсолютным путём.
2. Валидировать, что массив `adapters` содержит хотя бы один элемент.
3. Валидировать, что все элементы `adapters` реализуют интерфейс `Adapter`
   (см. «Интерфейс адаптера»).
4. Валидировать, что значения `agentId` всех адаптеров уникальны.
5. Сохранить конфигурацию в экземпляре.

**Расширения:**

1a. `projectRoot` не является абсолютным путём →
`ConfigError("projectRoot must be an absolute path")`.

2a. Массив `adapters` пуст →
`ConfigError("At least one adapter is required")`.

3a. Элемент `adapters` не реализует интерфейс `Adapter` →
`ConfigError("Adapter at index {i} does not implement Adapter interface")`.

4a. Обнаружены адаптеры с одинаковым `agentId` →
`ConfigError("Duplicate agentId: {id}")`.

**Результат:**

Экземпляр `InstructionsTranspiler`.

## Транспиляция

`transpiler.transpile()` — выполняет полный цикл транспиляции для всех
зарегистрированных адаптеров.

**Вход:**

Нет входных параметров.

**Поведение:**

1. Обнаружить канонические файлы в `projectRoot` (см. «Обнаружение канонических файлов»).
2. Для каждого зарегистрированного адаптера вызвать `adapter.transpile(files)`.
3. Собрать результаты всех адаптеров в единый массив `TranspileResult`.

**Расширения:**

1a. Ни одного канонического файла не обнаружено →
вернуть пустой массив `TranspileResult[]` (не является ошибкой).

1b. `discover()` выбрасывает `DiscoverError` → пробросить к вызывающему коду.

2a. Адаптер выбрасывает исключение → создать `TranspileResult` с `agentId` адаптера,
пустым массивом `files` и одним элементом в `errors` (`TranspileError` с указанием
`agentId` и исходной ошибки); продолжить выполнение остальных адаптеров.

**Результат:**

`TranspileResult[]`.

- `agentId` (string) — идентификатор агента.
- `files` (array\<OutputFile>) — список сгенерированных файлов.
  - `relativePath` (string) — путь файла относительно `projectRoot`.
  - `content` (string) — содержимое файла.
- `errors` (array\<TranspileError>) — ошибки, возникшие при транспиляции данного адаптера.
  - `agentId` (string) — идентификатор адаптера, при транспиляции которого произошла ошибка.
  - `message` (string) — описание ошибки.
  - `cause` (Error) — исходное исключение адаптера.

## Обнаружение канонических файлов

`transpiler.discover()` — обнаруживает все канонические файлы в проекте.

**Вход:**

Нет входных параметров.

**Поведение:**

1. Проверить наличие `AGLOOM.md` в `projectRoot`.
2. Рекурсивно найти все файлы `AGLOOM.md` в подпапках `projectRoot`.
3. Исключить из результатов поиска каталоги, перечисленные в `.gitignore`
   (если файл `.gitignore` существует в `projectRoot`).
4. Исключить из результатов поиска каталог `node_modules`.
5. Исключить из результатов поиска скрытые каталоги (начинающиеся с `.`).
6. Прочитать содержимое каждого обнаруженного файла.
7. Сформировать массив `CanonicalFile`.

**Расширения:**

2a. Ошибка доступа к каталогу при рекурсивном сканировании (EACCES, ENOENT) →
`DiscoverError("Failed to scan directory {path}: {причина}")`.

3a. Файл `.gitignore` отсутствует → пропустить фильтрацию по `.gitignore`.

6a. Ошибка чтения файла (EACCES, файл удалён между обнаружением и чтением) →
`DiscoverError("Failed to read {relativePath}: {причина}")`.

**Результат:**

`CanonicalFile[]`.

- `relativePath` (string) — путь файла относительно `projectRoot`.
- `type` (string: "root" | "directory") — тип файла.
  - `"root"` — `AGLOOM.md` в корне проекта.
  - `"directory"` — `AGLOOM.md` в подпапке проекта.
- `content` (string) — содержимое файла (raw Markdown).

## Интерфейс адаптера

Каждый адаптер ДОЛЖЕН реализовать следующий интерфейс:

- `constructor(allowedAgentIds)` — конструктор, принимающий список
  допустимых идентификаторов агентов.
  - `allowedAgentIds` (array\<string>, опционально) — список допустимых
    идентификаторов агентов для валидации в `filterBody`
    (см. «Валидация допустимых agentId» § Формирование списка allowedAgentIds).
    Адаптер ДОЛЖЕН сохранить переданное значение для использования
    в методе `transpile`.
- `agentId` (string, readonly) — уникальный идентификатор агента (например, `"claude"`,
  `"agentsmd"`, `"opencode"`).
- `transpile(files)` — метод транспиляции (см. ниже).

### transpile

`adapter.transpile(files)` — генерирует agent-specific файлы из канонических файлов.

**Вход:**

- `files` (array\<CanonicalFile>, обязательно) — массив канонических файлов.

**Поведение:**

Определяется конкретным адаптером (см. «Claude Code адаптер»,
«AGENTS.md адаптер», «OpenCode адаптер»).

**Расширения:**

Определяются конкретным адаптером.

**Результат:**

`OutputFile[]`.

- `relativePath` (string) — путь файла относительно `projectRoot`.
- `content` (string) — содержимое файла.

## Трансформация контента

`transformContent(rawContent, agentId, allowedAgentIds?)` — трансформирует
содержимое канонического файла инструкций для конкретного целевого агента.
Функция экспортируется модулем и используется адаптерами.

Механизм трансформации (парсинг frontmatter, override, фильтрация body)
идентичен описанию в `docs/specs/agents-transpiler.md` § Трансформация контента,
за исключением:

- Класс ошибок — `TransformError` (не `AgentTransformError`).
- Параметр `allowedAgentIds` передаётся в `filterBody`
  (см. «Фильтрация body» § Валидация допустимых agentId).

**Вход:**

- `rawContent` (string, обязательно) — исходное содержимое `.md` файла
  (опциональный YAML frontmatter + Markdown body).
- `agentId` (string, обязательно) — идентификатор целевого агента.
- `allowedAgentIds` (array\<string>, опционально) — список допустимых
  идентификаторов агентов для валидации в `filterBody`.

**Поведение:**

1. Выполнить парсинг `rawContent` библиотекой `gray-matter`, получив
   объект frontmatter (`data`) и тело документа (`content`).
2. Проверить наличие ключа `override` в `data`.
3. Валидировать, что значение `data.override` является объектом.
4. Проверить наличие ключа, совпадающего с `agentId`, в `data.override`.
5. Валидировать, что значение `data.override[agentId]` является объектом.
6. Для каждого ключа-значения из `data.override[agentId]` установить
   значение этого ключа в `data` (shallow merge).
7. Удалить ключ `override` из `data`.
8. Выполнить фильтрацию body: `filterBody(content, agentId, allowedAgentIds)`
   (см. «Фильтрация body»).
9. Сериализовать `data` в YAML frontmatter (разделители `---`).
10. Присоединить отфильтрованный body к сериализованному frontmatter.

**Расширения:**

1a. Библиотека `gray-matter` выбрасывает ошибку парсинга →
`TransformError("Failed to parse frontmatter: {причина}")`.

2a. Ключ `override` отсутствует в `data` → пропустить шаги 3–6,
перейти к шагу 7.

3a. Значение `data.override` не является объектом →
`TransformError("Override must be an object")`.

4a. Ключ `agentId` отсутствует в `data.override` → пропустить шаги 5–6,
перейти к шагу 7.

5a. Значение `data.override[agentId]` не является объектом →
`TransformError("Override for '{agentId}' must be an object")`.

8a. `filterBody` выбрасывает `TransformError` → пробросить
к вызывающему коду.

9a. `data` после удаления `override` является пустым объектом →
пропустить шаг 9; содержимое файла состоит только
из отфильтрованного body (без разделителей `---`).

**Результат:**

`string` — трансформированное содержимое файла.

### Правила shallow merge

Shallow merge применяется при наличии `override[agentId]`:

- Каждый ключ из `override[agentId]` заменяет top-level ключ в `data`
  целиком (не deep merge).
- Если ключ из `override[agentId]` отсутствует в базовых полях `data`,
  он ДОБАВЛЯЕТСЯ как новый top-level ключ.
- Ключ `override` НЕ УЧАСТВУЕТ в merge — он удаляется на шаге 7.

## Фильтрация body

`filterBody(body, agentId, allowedAgentIds?)` — фильтрует agent-specific
секции в теле документа. Функция экспортируется модулем и используется
операцией `transformContent`.

Механизм фильтрации (парсинг тегов, раскрытие/удаление секций) идентичен
описанию в `docs/specs/agents-transpiler.md` § Фильтрация body,
за исключением:

- Класс ошибок — `TransformError` (не `AgentTransformError`).
- Дополнительный параметр `allowedAgentIds` (см. ниже).

**Вход:**

- `body` (string, обязательно) — тело документа (Markdown без frontmatter).
- `agentId` (string, обязательно) — идентификатор целевого агента.
- `allowedAgentIds` (array\<string>, опционально) — список допустимых
  идентификаторов агентов. Если параметр передан, выполняется валидация
  каждого `<agent-id>` в тегах (см. «Валидация допустимых agentId»).

**Поведение:**

1. Разбить `body` на строки.
2. Выделить agent-specific секции по паттернам тегов
   (открывающий тег → закрывающий тег).
3. Валидировать, что `<agent-id>` каждого тега соответствует паттерну
   `[a-z][a-z0-9-]*`.
4. Если параметр `allowedAgentIds` передан — валидировать, что `<agent-id>`
   каждого открывающего тега входит в `allowedAgentIds`
   (см. «Валидация допустимых agentId»).
5. Валидировать, что каждый тег открытия имеет соответствующий тег
   закрытия с тем же `<agent-id>`.
6. Валидировать, что секции не вложены друг в друга.
7. Для каждой секции с `<agent-id>`, совпадающим с `agentId`, — раскрыть
   (удалить строки тегов, сохранить строки контента).
8. Для каждой секции с `<agent-id>`, не совпадающим с `agentId`, — удалить
   (строки тегов, строки контента).
9. Строки вне секций — сохранить без изменений.
10. Собрать результирующие строки.

**Расширения:**

3a. Тег содержит `<agent-id>`, не соответствующий паттерну
`[a-z][a-z0-9-]*` →
`TransformError("Invalid agent-id '{id}' in tag at line {N}")`.

4a. `<agent-id>` открывающего тега не входит в `allowedAgentIds` →
`TransformError("Invalid agent-id '{id}' in instruction file: '{id}' does not have its own instruction format. Use the corresponding format-specific agent-id instead.")`.

5a. Тег открытия не имеет соответствующего тега закрытия →
`TransformError("Unmatched opening tag for agent:{id}")`.

5b. Тег закрытия не имеет соответствующего тега открытия →
`TransformError("Unmatched closing tag for agent:{id}")`.

5c. Идентификатор в теге закрытия не совпадает с идентификатором
ближайшего открытого тега →
`TransformError("Mismatched closing tag: expected agent:{expected}, got agent:{actual}")`.

6a. Обнаружена вложенная секция →
`TransformError("Nested agent section detected: agent:{id} inside agent:{outerId}")`.

**Результат:**

`string` — отфильтрованное тело документа.

Если `body` не содержит agent-specific секций, возвращается без изменений.

### Валидация допустимых agentId

В файлах инструкций ТРЕБУЕТСЯ валидация `<agent-id>` в тегах
`<!-- agent:X -->`. Допустимые `<agent-id>` определяются наличием
собственного файла инструкций у агента — то есть наличием записи
в реестре адаптеров (см. `docs/specs/cli.md` § Реестр адаптеров),
у которой `instructionsFile` не равен `null`
(см. `docs/specs/adapter-registry-ext.md`).

#### Формирование списка allowedAgentIds

Список `allowedAgentIds` формируется вызывающим кодом (CLI-модулем
или тестами) на основе реестра адаптеров. CLI-модуль ДОЛЖЕН
сформировать `allowedAgentIds` как массив `entry.id` для записей
реестра, у которых `entry.instructionsFile !== null`.

Адаптеры получают `allowedAgentIds` через конструктор. Каждый адаптер,
вызывающий `transformContent`, ДОЛЖЕН передавать полученный
`allowedAgentIds` в параметр `allowedAgentIds` функции `transformContent`,
которая в свою очередь передаёт его в `filterBody`.

#### Допустимые и запрещённые идентификаторы

Адаптеры, вызывающие `transformContent`, ДОЛЖНЫ передавать
`allowedAgentIds` — массив идентификаторов агентов, имеющих собственный
формат инструкций:

- `"claude"` — допустим (`CLAUDE.md`).
- `"agentsmd"` — допустим (`AGENTS.md`).
- `"opencode"` — ЗАПРЕЩЁН (не имеет собственного формата инструкций,
  использует `AGENTS.md` через адаптер `"agentsmd"`).

При обнаружении запрещённого `<agent-id>` в открывающем теге
`<!-- agent:X -->` функция `filterBody` ДОЛЖНА выбросить ошибку
(см. расширение 4a).

### Дополнительные правила фильтрации

- Последовательные пустые строки, образовавшиеся в результате удаления
  секций, НЕ ДОЛЖНЫ схлопываться.
- Библиотека НЕ учитывает контекст Markdown (code blocks, inline code)
  при поиске тегов agent-specific секций. Строка, соответствующая
  паттерну тега, обрабатывается как тег независимо от окружающего
  контекста.

## Классы ошибок

- `ConfigError` (extends Error) — ошибка конфигурации транспилера.
- `DiscoverError` (extends Error) — ошибка обнаружения канонических файлов.
- `TransformError` (extends Error) — ошибка трансформации контента
  (парсинг frontmatter, фильтрация body).
- `WriteError` (extends Error) — ошибка записи файла.

## Claude Code адаптер

Адаптер для Claude Code. `agentId`: `"claude"`.

### Правила генерации

Для каждого канонического файла адаптер генерирует соответствующий
agent-specific файл по следующим правилам:

| Канонический файл      | Тип       | Генерируемый файл            | Условие |
| ---------------------- | --------- | ---------------------------- | ------- |
| `AGLOOM.md` (корень)   | root      | `CLAUDE.md` (корень)         | Всегда  |
| `AGLOOM.md` (подпапка) | directory | `CLAUDE.md` (та же подпапка) | Всегда  |

### transpile

`claudeAdapter.transpile(files)`.

**Вход:**

- `files` (array\<CanonicalFile>, обязательно) — массив канонических файлов.

**Поведение:**

1. Отфильтровать `files`, оставив файлы типов `"root"` и `"directory"`.
2. Для каждого файла вызвать `transformContent(file.content, "claude", this.allowedAgentIds)`,
   где `this.allowedAgentIds` — значение, сохранённое из конструктора
   (см. «Интерфейс адаптера» и «Валидация допустимых agentId»
   § Формирование списка allowedAgentIds).
3. Заменить `AGLOOM.md` на `CLAUDE.md` в `relativePath`.
4. Сформировать `OutputFile` с изменённым `relativePath` и результатом
   `transformContent` в качестве `content`.

**Расширения:**

2a. `transformContent` выбрасывает `TransformError` → пробросить
к вызывающему коду.

**Результат:**

`OutputFile[]`.

## AGENTS.md адаптер

Адаптер для формата AGENTS.md. `agentId`: `"agentsmd"`.

### Правила генерации

Для каждого канонического файла адаптер генерирует соответствующий
agent-specific файл по следующим правилам:

| Канонический файл      | Тип       | Генерируемый файл            | Условие |
| ---------------------- | --------- | ---------------------------- | ------- |
| `AGLOOM.md` (корень)   | root      | `AGENTS.md` (корень)         | Всегда  |
| `AGLOOM.md` (подпапка) | directory | `AGENTS.md` (та же подпапка) | Всегда  |

### transpile

`agentsmdAdapter.transpile(files)`.

**Вход:**

- `files` (array\<CanonicalFile>, обязательно) — массив канонических файлов.

**Поведение:**

1. Отфильтровать `files`, оставив файлы типов `"root"` и `"directory"`.
2. Для каждого файла вызвать `transformContent(file.content, "agentsmd", this.allowedAgentIds)`,
   где `this.allowedAgentIds` — значение, сохранённое из конструктора
   (см. «Интерфейс адаптера» и «Валидация допустимых agentId»
   § Формирование списка allowedAgentIds).
3. Заменить `AGLOOM.md` на `AGENTS.md` в `relativePath`.
4. Сформировать `OutputFile` с изменённым `relativePath` и результатом
   `transformContent` в качестве `content`.

**Расширения:**

2a. `transformContent` выбрасывает `TransformError` → пробросить
к вызывающему коду.

**Результат:**

`OutputFile[]`.

## OpenCode адаптер

Адаптер для OpenCode. `agentId`: `"opencode"`.

OpenCode не имеет собственного формата файла инструкций.
Файл `AGENTS.md` генерируется адаптером `"agentsmd"`
(см. «AGENTS.md адаптер»). Адаптер `"opencode"` для
instructions-transpiler является no-op.

### transpile

`opencodeAdapter.transpile(files)`.

**Вход:**

- `files` (array\<CanonicalFile>, обязательно) — массив канонических файлов.

**Поведение:**

1. Вернуть пустой массив `OutputFile[]`.

**Расширения:**

Нет расширений.

**Результат:**

`OutputFile[]` (всегда пустой массив).

## Запись результатов

`transpiler.writeResults(results)` — записывает результаты транспиляции
в файловую систему.

**Вход:**

- `results` (array\<TranspileResult>, обязательно) — результаты транспиляции,
  полученные из `transpile()`.

**Поведение:**

1. Для каждого `TranspileResult` проверить, что массив `errors` пуст.
2. Собрать все `OutputFile` из всех `TranspileResult` с пустым `errors`.
3. Выполнить дедупликацию: если несколько `OutputFile` имеют одинаковый
   `relativePath`, сохранить только первый встреченный (в порядке обхода
   массива `results`).
4. Для каждого уникального `OutputFile` записать `content`
   в `projectRoot / relativePath` с кодировкой UTF-8, создавая
   промежуточные каталоги при необходимости.
5. Вернуть массив путей записанных файлов.

**Расширения:**

1a. `TranspileResult` содержит непустой `errors` — пропустить запись всех `files`
данного адаптера; включить ошибки в `WriteResult.errors`.

4a. Ошибка записи файла или создания каталога (нет прав, диск полон) →
`WriteError("Failed to write {relativePath}: {причина}")`.

**Результат:**

`WriteResult`.

- `written` (array\<string>) — относительные пути успешно записанных файлов.
- `errors` (array\<WriteError>) — ошибки записи.

## Вне scope

Следующие аспекты НЕ ВХОДЯТ в scope данной спецификации:

- Skills, commands, sub-agents, MCP-конфигурация.
- Модульные правила (`.claude/rules/`, `.kilocode/rules/`).
- Executable hooks, tool settings, permissions.
- CLI-интерфейс (отдельная спецификация).
- Watch mode (отслеживание изменений канонических файлов).
- Автоматическое обновление `.gitignore`.
- Адаптеры для Codex CLI и Gemini CLI (отдельные спецификации).
- Deep merge для override (только shallow merge top-level ключей).
- Markdown-aware парсинг (учёт code blocks при фильтрации секций).
