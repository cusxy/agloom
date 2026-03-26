---
summary: Instructions Transpiler — библиотека транспиляции AGLOOM.md в agent-specific файлы инструкций
description: >
  Библиотека для транспиляции канонических файлов AGLOOM.md и AGLOOM.local.md
  в agent-specific файлы инструкций. Поддерживает root, directory,
  local и directory-local канонические файлы. Расширяется через адаптеры.
type: spec
status: implemented
relates:
  - docs/specs/skills-transpiler.md
  - docs/specs/agents-transpiler.md
  - docs/specs/cli.md
  - docs/specs/integration-tests.md
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

## Канонические файлы

Библиотека оперирует четырьмя видами канонических файлов:

- `AGLOOM.md` в корне проекта — общие инструкции (git-tracked).
- `AGLOOM.md` в подпапках проекта — directory-level инструкции (git-tracked).
- `AGLOOM.local.md` в корне проекта — личные инструкции (всегда .gitignore).
- `AGLOOM.local.md` в подпапках проекта — directory-level личные инструкции
  (всегда .gitignore).

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
2. Проверить наличие `AGLOOM.local.md` в `projectRoot`.
3. Рекурсивно найти все файлы `AGLOOM.md` в подпапках `projectRoot`.
4. Рекурсивно найти все файлы `AGLOOM.local.md` в подпапках `projectRoot`.
5. Исключить из результатов поиска каталоги, перечисленные в `.gitignore`
   (если файл `.gitignore` существует в `projectRoot`).
6. Исключить из результатов поиска каталог `node_modules`.
7. Исключить из результатов поиска скрытые каталоги (начинающиеся с `.`).
8. Прочитать содержимое каждого обнаруженного файла.
9. Сформировать массив `CanonicalFile`.

**Расширения:**

3a. Ошибка доступа к каталогу при рекурсивном сканировании (EACCES, ENOENT) →
`DiscoverError("Failed to scan directory {path}: {причина}")`.

4a. Ошибка доступа к каталогу при рекурсивном сканировании (EACCES, ENOENT) →
`DiscoverError("Failed to scan directory {path}: {причина}")`.

5a. Файл `.gitignore` отсутствует → пропустить фильтрацию по `.gitignore`.

8a. Ошибка чтения файла (EACCES, файл удалён между обнаружением и чтением) →
`DiscoverError("Failed to read {relativePath}: {причина}")`.

**Результат:**

`CanonicalFile[]`.

- `relativePath` (string) — путь файла относительно `projectRoot`.
- `type` (string: "root" | "directory" | "local" | "directory-local") — тип файла.
  - `"root"` — `AGLOOM.md` в корне проекта.
  - `"directory"` — `AGLOOM.md` в подпапке проекта.
  - `"local"` — `AGLOOM.local.md` в корне проекта.
  - `"directory-local"` — `AGLOOM.local.md` в подпапке проекта.
- `content` (string) — содержимое файла (raw Markdown).

## Интерфейс адаптера

Каждый адаптер ДОЛЖЕН реализовать следующий интерфейс:

- `agentId` (string, readonly) — уникальный идентификатор агента (например, `"claude"`,
  `"opencode"`).
- `transpile(files)` — метод транспиляции (см. ниже).

### transpile

`adapter.transpile(files)` — генерирует agent-specific файлы из канонических файлов.

**Вход:**

- `files` (array\<CanonicalFile>, обязательно) — массив канонических файлов.

**Поведение:**

Определяется конкретным адаптером (см. «Claude Code адаптер», «OpenCode адаптер»).

**Расширения:**

Определяются конкретным адаптером.

**Результат:**

`OutputFile[]`.

- `relativePath` (string) — путь файла относительно `projectRoot`.
- `content` (string) — содержимое файла.

## Claude Code адаптер

Адаптер для Claude Code. `agentId`: `"claude"`.

### Правила генерации

Для каждого канонического файла адаптер генерирует соответствующий
agent-specific файл по следующим правилам:

| Канонический файл             | Тип             | Генерируемый файл                  | Условие |
| ----------------------------- | --------------- | ---------------------------------- | ------- |
| `AGLOOM.md` (корень)         | root            | `CLAUDE.md` (корень)               | Всегда  |
| `AGLOOM.md` (подпапка)       | directory       | `CLAUDE.md` (та же подпапка)       | Всегда  |
| `AGLOOM.local.md` (корень)   | local           | `CLAUDE.local.md` (корень)         | Всегда  |
| `AGLOOM.local.md` (подпапка) | directory-local | `CLAUDE.local.md` (та же подпапка) | Всегда  |

### transpile

`claudeAdapter.transpile(files)`.

**Вход:**

- `files` (array\<CanonicalFile>, обязательно) — массив канонических файлов.

**Поведение:**

1. Отфильтровать `files`, оставив файлы типов `"root"`, `"directory"`,
   `"local"` и `"directory-local"`.
2. Для файла типа `"root"` или `"directory"` — заменить `AGLOOM.md` на `CLAUDE.md`
   в `relativePath`.
3. Для файла типа `"local"` или `"directory-local"` — заменить `AGLOOM.local.md`
   на `CLAUDE.local.md` в `relativePath`.
4. Сформировать `OutputFile` с изменённым `relativePath` и `file.content`.

**Расширения:**

Нет расширений.

**Результат:**

`OutputFile[]`.

## OpenCode адаптер

Адаптер для OpenCode. `agentId`: `"opencode"`.

### Правила генерации

OpenCode нативно читает `AGENTS.md`. Адаптер генерирует `AGENTS.md`
из канонического `AGLOOM.md` для обеспечения совместимости.
OpenCode не поддерживает directory-level
инструкции, local инструкции и directory-local инструкции.

| Канонический файл             | Тип             | Генерируемый файл   | Условие                                            |
| ----------------------------- | --------------- | ------------------- | -------------------------------------------------- |
| `AGLOOM.md` (корень)         | root            | `AGENTS.md` (корень) | Всегда                                             |
| `AGLOOM.md` (подпапка)       | directory       | _(не генерируется)_ | OpenCode не поддерживает directory-level инструкции |
| `AGLOOM.local.md` (корень)   | local           | _(не генерируется)_ | OpenCode не поддерживает local инструкции           |
| `AGLOOM.local.md` (подпапка) | directory-local | _(не генерируется)_ | OpenCode не поддерживает directory-local инструкции |

### transpile

`opencodeAdapter.transpile(files)`.

**Вход:**

- `files` (array\<CanonicalFile>, обязательно) — массив канонических файлов.

**Поведение:**

1. Отфильтровать `files`, оставив только файлы типа `"root"`.
2. Для каждого файла типа `"root"` — заменить `AGLOOM.md` на `AGENTS.md`
   в `relativePath`.
3. Сформировать `OutputFile` с изменённым `relativePath` и `file.content`.

**Расширения:**

Нет расширений.

**Результат:**

`OutputFile[]`.

## Запись результатов

`transpiler.writeResults(results)` — записывает результаты транспиляции
в файловую систему.

**Вход:**

- `results` (array\<TranspileResult>, обязательно) — результаты транспиляции,
  полученные из `transpile()`.

**Поведение:**

1. Для каждого `TranspileResult` проверить, что массив `errors` пуст.
2. Для каждого `OutputFile` из `files` записать `content` в `projectRoot / relativePath`
   с кодировкой UTF-8, создавая промежуточные каталоги при необходимости.
3. Вернуть массив путей записанных файлов.

**Расширения:**

1a. `TranspileResult` содержит непустой `errors` — пропустить запись всех `files`
данного адаптера; включить ошибки в `WriteResult.errors`.

2a. Ошибка записи файла или создания каталога (нет прав, диск полон) →
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
- Agent-specific секции через HTML-комментарии (исключены из scope).
