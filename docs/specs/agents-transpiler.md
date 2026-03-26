---
summary: Agents Transpiler — библиотека транспиляции agent-определений из .agloom/agents/ в agent-specific каталоги
description: >
  Библиотека для транспиляции определений суб-агентов из канонического каталога
  .agloom/agents/ в agent-specific каталоги. Выполняет трансформацию контента:
  парсинг YAML frontmatter, применение override-полей, фильтрацию agent-specific
  секций в body. Расширяется через адаптеры.
type: spec
status: implemented
relates:
  - docs/specs/instructions-transpiler.md
  - docs/specs/skills-transpiler.md
  - docs/specs/cli.md
  - docs/specs/integration-tests.md
  - docs/researches/agent-capabilities-map/RESEARCH.md
maps_to:
  - src/agents-transpiler/
---

# Agents Transpiler

Ключевые слова «ТРЕБУЕТСЯ», «ЗАПРЕЩАЕТСЯ», «ДОЛЖЕН», «НЕ ДОЛЖЕН», «СЛЕДУЕТ»,
«НЕ СЛЕДУЕТ», «МОЖЕТ» и «НЕОБЯЗАТЕЛЬНО» в этом документе толкуются
в соответствии с [RFC 2119](https://tools.ietf.org/html/rfc2119).

Библиотека для транспиляции определений суб-агентов из канонического каталога
`.agloom/agents/` в agent-specific каталоги. Канонический каталог является
единственным источником истины (single source of truth); agent-specific файлы —
производные артефакты, генерируемые при каждом запуске транспиляции.

В отличие от `skills-transpiler` (см. `docs/specs/skills-transpiler.md`),
который выполняет побайтовое копирование, agents-transpiler выполняет
трансформацию контента: парсинг YAML frontmatter с применением override-полей
и фильтрацию agent-specific секций в body.

Архитектура аналогична `instructions-transpiler` и `skills-transpiler`
(см. `docs/specs/instructions-transpiler.md`, `docs/specs/skills-transpiler.md`):
factory function, адаптеры, обнаружение, запись результатов.

## Канонический формат

Агент — одиночный `.md` файл в `.agloom/agents/<name>.md` (git-tracked).
Формат: YAML frontmatter + Markdown body. Парсинг frontmatter выполняется
библиотекой `gray-matter` (зависимость: `gray-matter`, добавляется
в `dependencies` проекта).

Библиотека ЗАПРЕЩАЕТ валидацию семантики полей frontmatter (имена моделей,
списки инструментов и т.д.), потому что валидация является ответственностью
целевых агентов.

### Frontmatter и override

Канонический frontmatter содержит базовые поля и опциональный блок `override`:

```yaml
---
name: code-reviewer
description: Reviews code for best practices
model: sonnet
tools:
  - Read
  - Grep
override:
  opencode:
    model: anthropic/claude-sonnet-4-5
    temperature: 0.1
  claude:
    permissionMode: plan
---
```

Правила трансформации frontmatter описаны в операции «Трансформация контента».

### Синтаксис agent-specific секций

Body МОЖЕТ содержать agent-specific секции, ограниченные HTML-комментариями:

- **Тег открытия**: `<!-- agent:<agent-id> -->`.
- **Тег закрытия**: `<!-- /agent:<agent-id> -->`.

Требования к тегам:

- `<agent-id>` ДОЛЖЕН соответствовать паттерну `[a-z][a-z0-9-]*`.
- Регистр `<agent-id>` — case-sensitive.
- Пробелы (пробелы и табы) внутри тега допустимы между компонентами:
  `<!-- agent: claude -->` эквивалентно `<!-- agent:claude -->`.
- Каждый тег ДОЛЖЕН занимать отдельную строку (допустимы ведущие и завершающие
  пробелы на строке с тегом).
- Тег открытия и закрытия ДОЛЖНЫ совпадать по `<agent-id>`.
- Вложенность секций ЗАПРЕЩАЕТСЯ.

Пример:

```markdown
General instructions visible to all agents.

<!-- agent:claude -->

Claude-specific instructions here.

<!-- /agent:claude -->

<!-- agent:opencode -->

OpenCode-specific instructions here.

<!-- /agent:opencode -->
```

## Типы данных

### AgentDefinition

Обнаруженное определение агента.

- `name` (string) — имя агента (имя файла без расширения `.md`).
- `relativePath` (string) — путь к файлу относительно `projectRoot`
  (например, `".agloom/agents/code-reviewer.md"`).
- `rawContent` (string) — содержимое файла (raw Markdown с frontmatter).

### AgentOutputFile

Файл для записи в целевой каталог.

- `relativePath` (string) — путь назначения относительно `projectRoot`.
- `content` (string) — трансформированное содержимое файла.

### AgentTranspileResult

Результат транспиляции для одного адаптера.

- `agentId` (string) — идентификатор адаптера.
- `files` (array\<AgentOutputFile>) — список файлов для записи.
- `errors` (array\<AgentTranspileError>) — ошибки, возникшие при транспиляции
  данного адаптера.

### AgentTranspileError

Ошибка транспиляции адаптера.

- `agentId` (string) — идентификатор адаптера, при транспиляции которого
  произошла ошибка.
- `message` (string) — описание ошибки.
- `cause` (Error) — исходное исключение адаптера.

### AgentWriteResult

Результат записи файлов.

- `written` (array\<string>) — относительные пути успешно записанных файлов.
- `errors` (array\<AgentWriteError>) — ошибки записи.

### Классы ошибок

- `AgentConfigError` (extends Error) — ошибка конфигурации транспилера.
- `AgentDiscoverError` (extends Error) — ошибка обнаружения определений агентов.
- `AgentTransformError` (extends Error) — ошибка трансформации контента
  (парсинг frontmatter, фильтрация body).
- `AgentWriteError` (extends Error) — ошибка записи файла.

## Инициализация

`createAgentsTranspiler(config)`.

**Вход:**

- `config` (object, обязательно) — конфигурация транспилера.
  - `projectRoot` (string, обязательно) — абсолютный путь к корню проекта.
  - `adapters` (array\<AgentAdapter>, обязательно) — массив адаптеров
    для целевых агентов.

**Поведение:**

1. Валидировать, что `projectRoot` является абсолютным путём.
2. Валидировать, что массив `adapters` содержит хотя бы один элемент.
3. Валидировать, что все элементы `adapters` реализуют интерфейс `AgentAdapter`
   (см. «Интерфейс адаптера»).
4. Валидировать, что значения `agentId` всех адаптеров уникальны.
5. Сохранить конфигурацию в экземпляре.

**Расширения:**

1a. `projectRoot` не является абсолютным путём →
`AgentConfigError("projectRoot must be an absolute path")`.

2a. Массив `adapters` пуст →
`AgentConfigError("At least one adapter is required")`.

3a. Элемент `adapters` не реализует интерфейс `AgentAdapter` →
`AgentConfigError("Adapter at index {i} does not implement AgentAdapter interface")`.

4a. Обнаружены адаптеры с одинаковым `agentId` →
`AgentConfigError("Duplicate agentId: {id}")`.

**Результат:**

Экземпляр `AgentsTranspiler`.

## Обнаружение определений агентов

`transpiler.discover()` — обнаруживает все определения агентов в проекте.

**Вход:**

Нет входных параметров.

**Поведение:**

1. Проверить наличие каталога `.agloom/agents/` в `projectRoot`.
2. Получить список прямых дочерних файлов каталога `.agloom/agents/`.
3. Отфильтровать файлы, оставив только файлы с расширением `.md`.
4. Прочитать содержимое каждого `.md` файла.
5. Сформировать массив `AgentDefinition`, где `name` — имя файла
   без расширения `.md`.

**Расширения:**

1a. Каталог `.agloom/agents/` не существует → вернуть пустой массив
`AgentDefinition[]` (не является ошибкой).

2a. Ошибка доступа к каталогу `.agloom/agents/` (EACCES) →
`AgentDiscoverError("Failed to scan directory .agloom/agents/: {причина}")`.

4a. Ошибка чтения файла (EACCES, файл удалён между обнаружением и чтением) →
`AgentDiscoverError("Failed to read {relativePath}: {причина}")`.

**Результат:**

`AgentDefinition[]`.

## Транспиляция

`transpiler.transpile()` — выполняет полный цикл транспиляции для всех
зарегистрированных адаптеров.

**Вход:**

Нет входных параметров.

**Поведение:**

1. Обнаружить определения агентов в `projectRoot`
   (см. «Обнаружение определений агентов»).
2. Для каждого зарегистрированного адаптера вызвать
   `adapter.transpile(definitions)`.
3. Собрать результаты всех адаптеров в единый массив
   `AgentTranspileResult`.

**Расширения:**

1a. Ни одного определения агента не обнаружено → вернуть пустой массив
`AgentTranspileResult[]` (не является ошибкой).

1b. `discover()` выбрасывает `AgentDiscoverError` →
пробросить к вызывающему коду.

2a. Адаптер выбрасывает исключение → создать `AgentTranspileResult`
с `agentId` адаптера, пустым массивом `files` и одним элементом в `errors`
(`AgentTranspileError` с указанием `agentId` и исходной ошибки);
продолжить выполнение остальных адаптеров.

**Результат:**

`AgentTranspileResult[]`.

## Интерфейс адаптера

Каждый адаптер ДОЛЖЕН реализовать следующий интерфейс:

- `agentId` (string, readonly) — уникальный идентификатор агента
  (например, `"claude"`, `"opencode"`).
- `transpile(definitions)` — метод транспиляции (см. ниже).

### transpile

`adapter.transpile(definitions)` — генерирует agent-specific файлы
из определений агентов.

**Вход:**

- `definitions` (array\<AgentDefinition>, обязательно) — массив
  обнаруженных определений агентов.

**Поведение:**

Определяется конкретным адаптером (см. «Claude Code адаптер»,
«OpenCode адаптер»).

**Расширения:**

Определяются конкретным адаптером.

**Результат:**

`AgentOutputFile[]`.

## Трансформация контента

`transformContent(rawContent, agentId)` — трансформирует содержимое
канонического файла агента для конкретного целевого агента. Функция
экспортируется модулем и используется адаптерами.

**Вход:**

- `rawContent` (string, обязательно) — исходное содержимое `.md` файла
  (YAML frontmatter + Markdown body).
- `agentId` (string, обязательно) — идентификатор целевого агента.

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
8. Выполнить фильтрацию body: `filterBody(content, agentId)`
   (см. «Фильтрация body»).
9. Сериализовать `data` в YAML frontmatter (разделители `---`).
10. Присоединить отфильтрованный body к сериализованному frontmatter.

**Расширения:**

1a. Библиотека `gray-matter` выбрасывает ошибку парсинга →
`AgentTransformError("Failed to parse frontmatter: {причина}")`.

2a. Ключ `override` отсутствует в `data` → пропустить шаги 3–6,
перейти к шагу 7.

3a. Значение `data.override` не является объектом →
`AgentTransformError("Override must be an object")`.

4a. Ключ `agentId` отсутствует в `data.override` → пропустить шаги 5–6,
перейти к шагу 7.

5a. Значение `data.override[agentId]` не является объектом →
`AgentTransformError("Override for '{agentId}' must be an object")`.

8a. `filterBody` выбрасывает `AgentTransformError` → пробросить
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

Пример. Исходный frontmatter:

```yaml
name: code-reviewer
model: sonnet
tools:
  - Read
  - Grep
override:
  opencode:
    model: anthropic/claude-sonnet-4-5
    temperature: 0.1
  claude:
    permissionMode: plan
```

Результат для `agentId = "opencode"`:

```yaml
name: code-reviewer
model: anthropic/claude-sonnet-4-5
tools:
  - Read
  - Grep
temperature: 0.1
```

Результат для `agentId = "claude"`:

```yaml
name: code-reviewer
model: sonnet
tools:
  - Read
  - Grep
permissionMode: plan
```

## Фильтрация body

`filterBody(body, agentId)` — фильтрует agent-specific секции в теле
документа. Функция экспортируется модулем и используется операцией
`transformContent`.

**Вход:**

- `body` (string, обязательно) — тело документа (Markdown без frontmatter).
- `agentId` (string, обязательно) — идентификатор целевого агента.

**Поведение:**

1. Разбить `body` на строки.
2. Выделить agent-specific секции по паттернам тегов
   (открывающий тег → закрывающий тег).
3. Валидировать, что каждый тег открытия имеет соответствующий тег
   закрытия с тем же `<agent-id>`.
4. Валидировать, что секции не вложены друг в друга.
5. Для каждой секции с `<agent-id>`, совпадающим с `agentId`, — раскрыть
   (удалить строки тегов, сохранить строки контента).
6. Для каждой секции с `<agent-id>`, не совпадающим с `agentId`, — удалить
   (строки тегов, строки контента).
7. Строки вне секций — сохранить без изменений.
8. Собрать результирующие строки.

**Расширения:**

2a. Тег содержит `<agent-id>`, не соответствующий паттерну
`[a-z][a-z0-9-]*` →
`AgentTransformError("Invalid agent-id '{id}' in tag at line {N}")`.

3a. Тег открытия не имеет соответствующего тега закрытия →
`AgentTransformError("Unmatched opening tag for agent:{id}")`.

3b. Тег закрытия не имеет соответствующего тега открытия →
`AgentTransformError("Unmatched closing tag for agent:{id}")`.

3c. Идентификатор в теге закрытия не совпадает с идентификатором
ближайшего открытого тега →
`AgentTransformError("Mismatched closing tag: expected agent:{expected}, got agent:{actual}")`.

4a. Обнаружена вложенная секция →
`AgentTransformError("Nested agent section detected: agent:{id} inside agent:{outerId}")`.

**Результат:**

`string` — отфильтрованное тело документа.

Если `body` не содержит agent-specific секций, возвращается без изменений.

### Дополнительные правила фильтрации

- Последовательные пустые строки, образовавшиеся в результате удаления
  секций, НЕ ДОЛЖНЫ схлопываться.
- Библиотека НЕ учитывает контекст Markdown (code blocks, inline code)
  при поиске тегов agent-specific секций. Строка, соответствующая
  паттерну тега, обрабатывается как тег независимо от окружающего
  контекста.

### Пример фильтрации

Исходный body:

```text
General instructions for all agents.

<!-- agent:claude -->
Claude-specific instructions.
<!-- /agent:claude -->
<!-- agent:opencode -->
OpenCode-specific instructions.
<!-- /agent:opencode -->

More general instructions.
```

Результат для `agentId = "claude"`:

```text
General instructions for all agents.

Claude-specific instructions.

More general instructions.
```

Результат для `agentId = "opencode"`:

```text
General instructions for all agents.

OpenCode-specific instructions.

More general instructions.
```

## Claude Code адаптер

Адаптер для Claude Code. `agentId`: `"claude"`.

### Правила генерации

Для каждого обнаруженного определения агента адаптер генерирует
соответствующий файл по следующим правилам:

| Исходный путь               | Целевой путь               | Условие |
| --------------------------- | -------------------------- | ------- |
| `.agloom/agents/<name>.md` | `.claude/agents/<name>.md` | Всегда  |

Адаптер заменяет префикс `.agloom/agents/` на `.claude/agents/`
и трансформирует содержимое файла для `agentId = "claude"`.

### transpile

`claudeAgentAdapter.transpile(definitions)`.

**Вход:**

- `definitions` (array\<AgentDefinition>, обязательно) — массив
  обнаруженных определений агентов.

**Поведение:**

1. Для каждого определения из `definitions` вызвать
   `transformContent(definition.rawContent, "claude")`
   (см. «Трансформация контента»).
2. Заменить префикс `.agloom/agents/` на `.claude/agents/`
   в `definition.relativePath`, сформировав целевой `relativePath`.
3. Сформировать `AgentOutputFile` с вычисленным `relativePath`
   и результатом `transformContent` в качестве `content`.

**Расширения:**

1a. `transformContent` выбрасывает `AgentTransformError` → пробросить
к вызывающему коду.

**Результат:**

`AgentOutputFile[]`.

## OpenCode адаптер

Адаптер для OpenCode. `agentId`: `"opencode"`.

### Правила генерации

Для каждого обнаруженного определения агента адаптер генерирует
соответствующий файл по следующим правилам:

| Исходный путь               | Целевой путь                 | Условие |
| --------------------------- | ---------------------------- | ------- |
| `.agloom/agents/<name>.md` | `.opencode/agents/<name>.md` | Всегда  |

Адаптер заменяет префикс `.agloom/agents/` на `.opencode/agents/`
и трансформирует содержимое файла для `agentId = "opencode"`.

### transpile

`opencodeAgentAdapter.transpile(definitions)`.

**Вход:**

- `definitions` (array\<AgentDefinition>, обязательно) — массив
  обнаруженных определений агентов.

**Поведение:**

1. Для каждого определения из `definitions` вызвать
   `transformContent(definition.rawContent, "opencode")`
   (см. «Трансформация контента»).
2. Заменить префикс `.agloom/agents/` на `.opencode/agents/`
   в `definition.relativePath`, сформировав целевой `relativePath`.
3. Сформировать `AgentOutputFile` с вычисленным `relativePath`
   и результатом `transformContent` в качестве `content`.

**Расширения:**

1a. `transformContent` выбрасывает `AgentTransformError` → пробросить
к вызывающему коду.

**Результат:**

`AgentOutputFile[]`.

## Запись результатов

`transpiler.writeResults(results)` — записывает результаты транспиляции
в файловую систему.

**Вход:**

- `results` (array\<AgentTranspileResult>, обязательно) — результаты
  транспиляции, полученные из `transpile()`.

**Поведение:**

1. Для каждого `AgentTranspileResult` проверить, что массив `errors` пуст.
2. Для каждого `AgentOutputFile` из `files` записать `content`
   в `projectRoot / relativePath` с кодировкой UTF-8, создавая
   промежуточные каталоги при необходимости.
3. Вернуть `AgentWriteResult`.

**Расширения:**

1a. `AgentTranspileResult` содержит непустой `errors` — пропустить запись
всех `files` данного адаптера; создать один `AgentWriteError` с сообщением
`"Skipped {agentId}: transpile errors present"` и добавить его
в `AgentWriteResult.errors`.

2a. Ошибка записи файла или создания каталога (нет прав, диск полон) →
`AgentWriteError("Failed to write {relativePath}: {причина}")`.

**Результат:**

`AgentWriteResult`.

## Вне scope

Следующие аспекты НЕ ВХОДЯТ в scope данной спецификации:

- Создание и scaffolding новых агентов.
- Валидация семантики frontmatter (имена моделей, списки инструментов и т.д.).
- Deep merge для override (только shallow merge top-level ключей).
- Watch mode (отслеживание изменений определений агентов).
- Адаптеры для Codex CLI и Gemini CLI (отдельные спецификации).
- Агенты как директории (только одиночные `.md` файлы).
- CLI-интерфейс (отдельная спецификация).
- Очистка устаревших agent-specific файлов при удалении определений.
- Автоматическое обновление `.gitignore`.
- Markdown-aware парсинг (учёт code blocks при фильтрации секций).
