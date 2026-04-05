---
summary: Permissions Transpiler — библиотека транспиляции permissions из .agloom/ в agent-specific файлы
description: >
  Библиотека для транспиляции канонической конфигурации разрешений
  (.agloom/permissions.yml или .agloom/permissions.json) в agent-specific
  файлы. Генерирует секцию permissions в .claude/settings.json для Claude Code
  и секцию permission в opencode.json для OpenCode. Каждая секция (shell, mcp,
  file) -- упорядоченный массив пар pattern:action с семантикой first-match-wins
  в каноническом формате и инверсией порядка для last-match-wins адаптеров.
  Расширяется через адаптеры.
type: spec
status: implemented
relates:
  - docs/specs/mcp-transpiler.md
  - docs/specs/cli.md
  - docs/specs/adapter-registry-ext.md
  - docs/specs/layer-model.md
  - docs/specs/provider-overlay.md
  - docs/specs/plugin-manifest.md
maps_to:
  - src/permissions-transpiler/
---

# Permissions Transpiler

Ключевые слова "ТРЕБУЕТСЯ", "ЗАПРЕЩАЕТСЯ", "ДОЛЖЕН", "НЕ ДОЛЖЕН", "СЛЕДУЕТ",
"НЕ СЛЕДУЕТ", "МОЖЕТ" и "НЕОБЯЗАТЕЛЬНО" в этом документе толкуются
в соответствии с [RFC 2119](https://tools.ietf.org/html/rfc2119).

Библиотека для транспиляции канонической конфигурации разрешений
в agent-specific файлы. Канонический файл (`.agloom/permissions.yml`
или `.agloom/permissions.json`) является единственным источником истины;
agent-specific файлы -- производные артефакты, генерируемые при каждом
запуске транспиляции.

Архитектура аналогична `mcp-transpiler`
(см. `docs/specs/mcp-transpiler.md`): factory function, адаптеры,
обнаружение, валидация, трансформация, запись результатов.

## Канонический формат

Каноническая конфигурация разрешений -- файл `.agloom/permissions.yml`
(YAML) или `.agloom/permissions.json` (JSON) в корне директории `.agloom/`.
Оба формата валидны. При наличии обоих файлов одновременно --
ошибка (см. "Обнаружение канонического файла", расширение 3a).

### Семантика порядка правил

Канонический формат использует семантику **first-match-wins**: первое
совпавшее правило в массиве определяет действие. Адаптеры с иной
семантикой (например, OpenCode -- last-match-wins) ДОЛЖНЫ инвертировать
порядок правил при транспиляции.

### Структура канонического файла

Корневой объект МОЖЕТ содержать три секции: `shell`, `mcp`, `file`.
Все секции опциональны. При отсутствии всех секций канонический файл
считается пустым (не является ошибкой).

Каждая секция -- упорядоченный массив правил. Каждое правило --
объект с ровно одним ключом (паттерн) и значением (действие).

- `shell` (array\<PermissionRule>, опционально) -- правила для shell-команд.
  Каждый элемент -- объект `{ "<pattern>": "<action>" }`.
  - `pattern` (string) -- нативный glob-паттерн shell-команды.
  - `action` (string: "allow" | "ask" | "deny") -- действие.
- `mcp` (array\<PermissionRule>, опционально) -- правила для MCP-инструментов.
  Каждый элемент -- объект `{ "<pattern>": "<action>" }`.
  - `pattern` (string) -- паттерн в формате `<server>:<tool>`.
  - `action` (string: "allow" | "ask" | "deny") -- действие.
- `file` (array\<PermissionRule>, опционально) -- правила доступа к файлам.
  Каждый элемент -- объект `{ "<pattern>": "<action>" }`.
  - `pattern` (string) -- glob-паттерн пути к файлу.
  - `action` (string: "deny" | "read" | "write") -- действие.

### Нотация shell-паттернов

Shell-паттерны -- нативные glob-паттерны, сопоставляемые с полной
строкой команды (команда + аргументы). Разделитель `:` между командой
и аргументами НЕ используется.

Примеры:

- `"git push *"` -- команда `git push` с любыми аргументами.
- `"./gradlew *"` -- команда `./gradlew` с любыми аргументами.
- `"git status *"` -- команда `git status` с любыми аргументами.
- `"* --version"` -- любая команда с аргументом `--version`.
- `"*"` -- любая команда с любыми аргументами.

### Нотация MCP-паттернов

MCP-паттерны используют формат `<server>:<tool>`:

- `server` -- идентификатор MCP-сервера.
- `tool` -- имя инструмента или `*` для всех инструментов сервера.

Примеры:

- `"bitbucket:get_pull_request"` -- конкретный инструмент.
- `"bitbucket:*"` -- все инструменты сервера `bitbucket`.
- `"*:*"` -- все инструменты всех серверов.

### Пример канонического файла (YAML)

```yaml
shell:
  - "git push *": deny
  - "./gradlew *": allow
  - "ls *": allow
  - "git status *": allow
  - "npm *": ask
  - "*": deny
mcp:
  - "untrusted-server:*": deny
  - "bitbucket:get_pull_request": allow
  - "jenkins:get_build": allow
  - "bitbucket:*": ask
  - "jenkins:*": ask
  - "*:*": deny
file:
  - "**/.env": deny
  - "src/**/*.ts": write
  - "src/**": read
```

### Пример канонического файла (JSON)

```json
{
  "shell": [
    { "git push *": "deny" },
    { "./gradlew *": "allow" },
    { "ls *": "allow" },
    { "git status *": "allow" },
    { "npm *": "ask" },
    { "*": "deny" }
  ],
  "mcp": [
    { "untrusted-server:*": "deny" },
    { "bitbucket:get_pull_request": "allow" },
    { "jenkins:get_build": "allow" },
    { "bitbucket:*": "ask" },
    { "jenkins:*": "ask" },
    { "*:*": "deny" }
  ],
  "file": [
    { "**/.env": "deny" },
    { "src/**/*.ts": "write" },
    { "src/**": "read" }
  ]
}
```

## Типы данных

### PermissionRule

Единичное правило разрешений -- объект с ровно одним ключом.

- Ключ (string) -- паттерн.
- Значение (string) -- действие.

### ShellPermissionRule

- Ключ (string) -- нативный glob-паттерн shell-команды.
- Значение (string: "allow" | "ask" | "deny") -- действие.

### McpPermissionRule

- Ключ (string) -- паттерн в формате `<server>:<tool>`.
- Значение (string: "allow" | "ask" | "deny") -- действие.

### FilePermissionRule

- Ключ (string) -- glob-паттерн пути к файлу.
- Значение (string: "deny" | "read" | "write") -- действие.

### PermissionsCanonicalFile

Результат обнаружения канонического файла.

- `relativePath` (string) -- путь файла относительно `projectRoot`.
- `format` (string: "yaml" | "json") -- формат файла.
- `content` (PermissionsCanonicalContent) -- распарсенное содержимое.

### PermissionsCanonicalContent

Распарсенное содержимое канонического файла.

- `shell` (array\<ShellPermissionRule> | undefined) -- правила для shell-команд.
- `mcp` (array\<McpPermissionRule> | undefined) -- правила для MCP-инструментов.
- `file` (array\<FilePermissionRule> | undefined) -- правила доступа к файлам.

### PermissionsOutputFile

Результат трансформации для одного адаптера.

- `relativePath` (string) -- путь файла относительно `projectRoot`.
- `content` (string) -- сериализованное содержимое файла.

## Инициализация

`createPermissionsTranspiler(config)`.

**Вход:**

- `config` (object, обязательно) -- конфигурация транспилера.
  - `projectRoot` (string, обязательно) -- абсолютный путь к корню проекта.
  - `adapters` (array\<PermissionsAdapter>, обязательно) -- массив адаптеров
    для целевых агентов.

**Поведение:**

1. Валидировать, что `projectRoot` является абсолютным путём.
2. Валидировать, что массив `adapters` содержит хотя бы один элемент.
3. Валидировать, что все элементы `adapters` реализуют интерфейс
   `PermissionsAdapter` (см. "Интерфейс адаптера").
4. Валидировать, что значения `agentId` всех адаптеров уникальны.
5. Сохранить конфигурацию в экземпляре.

**Расширения:**

1a. `projectRoot` не является абсолютным путём --
`ConfigError("projectRoot must be an absolute path")`.

2a. Массив `adapters` пуст --
`ConfigError("At least one adapter is required")`.

3a. Элемент `adapters` не реализует интерфейс `PermissionsAdapter` --
`ConfigError("Adapter at index {i} does not implement PermissionsAdapter interface")`.

4a. Обнаружены адаптеры с одинаковым `agentId` --
`ConfigError("Duplicate agentId: {id}")`.

**Результат:**

Экземпляр `PermissionsTranspiler`.

## Транспиляция

`transpiler.transpile()` -- выполняет полный цикл транспиляции для всех
зарегистрированных адаптеров.

**Вход:**

Нет входных параметров.

**Поведение:**

1. Обнаружить канонический файл в `projectRoot`
   (см. "Обнаружение канонического файла").
2. Валидировать содержимое канонического файла
   (см. "Валидация канонического файла").
3. Для каждого зарегистрированного адаптера вызвать
   `adapter.transpile(canonicalFile)`.
4. Собрать результаты всех адаптеров в единый массив `TranspileResult`.

**Расширения:**

1a. Канонический файл не обнаружен --
вернуть пустой массив `TranspileResult[]` (не является ошибкой).

1b. `discover()` выбрасывает `DiscoverError` -- пробросить
к вызывающему коду.

2a. Валидация выбрасывает `TransformError` -- пробросить
к вызывающему коду.

3a. Адаптер выбрасывает исключение -- создать `TranspileResult`
с `agentId` адаптера, пустым массивом `files` и одним элементом
в `errors` (`TranspileError` с указанием `agentId` и исходной ошибки);
продолжить выполнение остальных адаптеров.

**Результат:**

`TranspileResult[]`.

- `agentId` (string) -- идентификатор агента.
- `files` (array\<PermissionsOutputFile>) -- список сгенерированных файлов.
- `errors` (array\<TranspileError>) -- ошибки, возникшие при транспиляции
  данного адаптера.
  - `agentId` (string) -- идентификатор адаптера.
  - `message` (string) -- описание ошибки.
  - `cause` (Error) -- исходное исключение адаптера.

## Обнаружение канонического файла

`transpiler.discover()` -- обнаруживает канонический permissions-файл
в проекте.

**Вход:**

Нет входных параметров.

**Поведение:**

1. Проверить наличие файла `.agloom/permissions.yml` в `projectRoot`.
2. Проверить наличие файла `.agloom/permissions.json` в `projectRoot`.
3. Определить, какой файл использовать.
4. Прочитать содержимое обнаруженного файла.
5. Распарсить содержимое в соответствии с форматом
   (YAML для `.yml`, JSON для `.json`).
6. Сформировать `PermissionsCanonicalFile`.

**Расширения:**

1a. Файл `.agloom/permissions.yml` не существует -- продолжить с шагом 2.

2a. Файл `.agloom/permissions.json` не существует -- продолжить с шагом 3.

3a. Оба файла (`.agloom/permissions.yml` и `.agloom/permissions.json`)
существуют --
`DiscoverError("Both .agloom/permissions.yml and .agloom/permissions.json exist. Remove one to resolve the conflict.")`.

3b. Ни один файл не обнаружен -- вернуть `null`.

4a. Ошибка чтения файла (EACCES, файл удалён между обнаружением
и чтением) --
`DiscoverError("Failed to read {relativePath}: {причина}")`.

5a. Ошибка парсинга YAML --
`DiscoverError("Failed to parse .agloom/permissions.yml: {причина}")`.

5b. Ошибка парсинга JSON --
`DiscoverError("Failed to parse .agloom/permissions.json: {причина}")`.

**Результат:**

`PermissionsCanonicalFile | null`.

## Валидация канонического файла

`validatePermissionsContent(content)` -- валидирует распарсенное содержимое
канонического файла.

**Вход:**

- `content` (object, обязательно) -- распарсенное содержимое файла.

**Поведение:**

1. Проверить, что `content` является объектом.
2. Проверить, что `content` содержит только допустимые ключи
   (`shell`, `mcp`, `file`).
3. Если поле `shell` присутствует -- валидировать как упорядоченный
   массив правил:
   3.1. Проверить, что значение является массивом.
   3.2. Для каждого элемента массива -- проверить, что элемент
   является объектом с ровно одним ключом.
   3.3. Для каждого элемента -- проверить, что значение (действие)
   является строкой из множества `{"allow", "ask", "deny"}`.
4. Если поле `mcp` присутствует -- валидировать как упорядоченный
   массив правил:
   4.1. Проверить, что значение является массивом.
   4.2. Для каждого элемента массива -- проверить, что элемент
   является объектом с ровно одним ключом.
   4.3. Для каждого элемента -- проверить, что значение (действие)
   является строкой из множества `{"allow", "ask", "deny"}`.
   4.4. Для каждого элемента -- проверить, что ключ (паттерн)
   содержит ровно один разделитель `:` (формат `<server>:<tool>`).
5. Если поле `file` присутствует -- валидировать как упорядоченный
   массив правил:
   5.1. Проверить, что значение является массивом.
   5.2. Для каждого элемента массива -- проверить, что элемент
   является объектом с ровно одним ключом.
   5.3. Для каждого элемента -- проверить, что значение (действие)
   является строкой из множества `{"deny", "read", "write"}`.

**Расширения:**

1a. `content` не является объектом --
`TransformError("Permissions config must be an object")`.

2a. `content` содержит неизвестный ключ --
`TransformError("Unknown key '{key}' in permissions config. Allowed keys: shell, mcp, file")`.

3a. Значение `shell` не является массивом --
`TransformError("'shell' must be an array of permission rules")`.

3b. Элемент `shell` не является объектом или содержит не ровно один ключ --
`TransformError("Each rule in 'shell' must be an object with exactly one key (pattern) and one value (action)")`.

3c. Значение (действие) элемента `shell` не входит
в множество `{"allow", "ask", "deny"}` --
`TransformError("Invalid action '{action}' in 'shell' rule '{pattern}'. Allowed actions: allow, ask, deny")`.

4a. Значение `mcp` не является массивом --
`TransformError("'mcp' must be an array of permission rules")`.

4b. Элемент `mcp` не является объектом или содержит не ровно один ключ --
`TransformError("Each rule in 'mcp' must be an object with exactly one key (pattern) and one value (action)")`.

4c. Значение (действие) элемента `mcp` не входит
в множество `{"allow", "ask", "deny"}` --
`TransformError("Invalid action '{action}' in 'mcp' rule '{pattern}'. Allowed actions: allow, ask, deny")`.

4d. Ключ (паттерн) элемента `mcp` не содержит ровно один разделитель `:` --
`TransformError("Invalid MCP pattern '{pattern}': must match format '<server>:<tool>'")`.

5a. Значение `file` не является массивом --
`TransformError("'file' must be an array of permission rules")`.

5b. Элемент `file` не является объектом или содержит не ровно один ключ --
`TransformError("Each rule in 'file' must be an object with exactly one key (pattern) and one value (action)")`.

5c. Значение (действие) элемента `file` не входит
в множество `{"deny", "read", "write"}` --
`TransformError("Invalid action '{action}' in 'file' rule '{pattern}'. Allowed actions: deny, read, write")`.

**Результат:**

`PermissionsCanonicalContent` -- валидированное содержимое.

## Интерфейс адаптера

Каждый Permissions-адаптер ДОЛЖЕН реализовать следующий интерфейс:

- `agentId` (string, readonly) -- уникальный идентификатор агента
  (например, `"claude"`, `"opencode"`).
- `transpile(file)` -- метод транспиляции (см. ниже).

### transpile

`adapter.transpile(file)` -- генерирует agent-specific permissions-файл
из канонического файла.

**Вход:**

- `file` (PermissionsCanonicalFile, обязательно) -- канонический файл.

**Поведение:**

Определяется конкретным адаптером (см. "Claude Code Permissions-адаптер",
"OpenCode Permissions-адаптер").

**Расширения:**

Определяются конкретным адаптером.

**Результат:**

`PermissionsOutputFile[]`.

## Claude Code Permissions-адаптер

Адаптер для Claude Code. `agentId`: `"claude"`.

Генерирует файл `.claude/settings.json` в корне проекта с ключом
`"permissions"`. При наличии существующего `.claude/settings.json`
(от overlay или предыдущих шагов транспиляции) ТРЕБУЕТСЯ выполнить
deep merge через layer model (см. `docs/specs/layer-model.md`).

Claude Code поддерживает секции `shell` и `mcp`. Секция `file`
НЕ поддерживается Claude Code. Действие `ask` НЕ поддерживается
Claude Code -- правила с действием `ask` пропускаются с предупреждением.

### Трансформация shell-правил для Claude

Каждый shell-паттерн из канонического формата ТРЕБУЕТСЯ обернуть
в формат Claude Code `Bash(<pattern>)`. Паттерн передаётся as-is,
без трансформации разделителей.

Примеры:

- `"git push *"` -> `"Bash(git push *)"`
- `"./gradlew *"` -> `"Bash(./gradlew *)"`
- `"git status *"` -> `"Bash(git status *)"`
- `"* --version"` -> `"Bash(* --version)"`
- `"*"` -> `"Bash(*)"`

### Трансформация MCP-правил для Claude

Каждое MCP-правило из канонического формата `<server>:<tool>`
ТРЕБУЕТСЯ трансформировать в формат Claude Code `mcp__<server>__<tool>`.
Разделитель `:` заменяется на `__`.

Примеры:

- `"bitbucket:get_pull_request"` -> `"mcp__bitbucket__get_pull_request"`
- `"bitbucket:*"` -> `"mcp__bitbucket__*"`

### transpile

`claudePermissionsAdapter.transpile(file)`.

**Вход:**

- `file` (PermissionsCanonicalFile, обязательно) -- канонический файл.

**Поведение:**

1. Создать пустой объект `permissions` с полями `allow` и `deny`
   (оба -- пустые массивы).
2. Если `file.content.shell` присутствует -- итерировать массив правил:
   2.1. Для каждого правила с действием `allow` -- трансформировать
   паттерн в формат Claude (см. "Трансформация shell-правил для Claude")
   и добавить в `permissions.allow`.
   2.2. Для каждого правила с действием `deny` -- трансформировать
   паттерн в формат Claude и добавить в `permissions.deny`.
   2.3. Подсчитать количество правил с действием `ask`.
   Если количество больше нуля -- эмитировать предупреждение
   в `stderr`: `"Warning: Claude Code does not support 'ask' action. {N} shell rule(s) skipped."`,
   где `{N}` -- количество правил с действием `ask`.
3. Если `file.content.mcp` присутствует -- итерировать массив правил:
   3.1. Для каждого правила с действием `allow` -- трансформировать
   паттерн в формат Claude (см. "Трансформация MCP-правил для Claude")
   и добавить в `permissions.allow`.
   3.2. Для каждого правила с действием `deny` -- трансформировать
   паттерн в формат Claude и добавить в `permissions.deny`.
   3.3. Подсчитать количество правил с действием `ask`.
   Если количество больше нуля -- эмитировать предупреждение
   в `stderr`: `"Warning: Claude Code does not support 'ask' action. {N} mcp rule(s) skipped."`,
   где `{N}` -- количество правил с действием `ask`.
4. Если `file.content.file` присутствует -- эмитировать предупреждение
   в `stderr`: `"Warning: Claude Code does not support file permissions. 'file' section ignored."`.
5. Удалить пустые массивы: если `permissions.allow` пуст -- удалить
   ключ `allow`; если `permissions.deny` пуст -- удалить ключ `deny`.
6. Проверить, что объект `permissions` непуст (содержит хотя бы один
   ключ `allow` или `deny`).
7. Сформировать объект `output` с ключом `"permissions"`,
   содержащим `permissions`.
8. Сериализовать `output` в JSON с отступом 2 пробела
   и завершающим переводом строки.
9. Сформировать `PermissionsOutputFile`
   с `relativePath: ".claude/settings.json"`.

**Расширения:**

6a. Объект `permissions` пуст (не содержит ни `allow`, ни `deny`) --
сформировать `output` как пустой объект `{}` (без ключа `"permissions"`).
Продолжить с шагом 8.

**Результат:**

`PermissionsOutputFile[]` (массив из одного элемента).

### Пример выходного файла (.claude/settings.json)

Для канонического файла из примера выше правила с действием `ask`
пропускаются с предупреждением:

```json
{
  "permissions": {
    "allow": [
      "Bash(./gradlew *)",
      "Bash(ls *)",
      "Bash(git status *)",
      "mcp__bitbucket__get_pull_request",
      "mcp__jenkins__get_build"
    ],
    "deny": [
      "Bash(git push *)",
      "Bash(*)",
      "mcp__untrusted-server__*",
      "mcp__*__*"
    ]
  }
}
```

Предупреждения в `stderr`:

```text
Warning: Claude Code does not support 'ask' action. 1 shell rule(s) skipped.
Warning: Claude Code does not support 'ask' action. 2 mcp rule(s) skipped.
```

### Deep merge с существующим .claude/settings.json

Файл `.claude/settings.json` МОЖЕТ содержать данные, записанные
overlay-шагом или другими транспилерами. Дедупликация и merge
по output path выполняется на уровне `writeResults`
(см. "Запись результатов"). При конфликте по пути
`.claude/settings.json` ТРЕБУЕТСЯ применить deep merge
в соответствии с `docs/specs/layer-model.md` § Алгоритм deep merge,
поскольку `.claude/settings.json` является merge-eligible файлом
(расширение `.json`).

## OpenCode Permissions-адаптер

Адаптер для OpenCode. `agentId`: `"opencode"`.

Генерирует файл `opencode.json` в корне проекта с ключом `"permission"`.
При наличии существующего `opencode.json` (от overlay или предыдущих
шагов транспиляции) ТРЕБУЕТСЯ выполнить deep merge через layer model
(см. `docs/specs/layer-model.md`).

OpenCode поддерживает все три секции: `shell`, `mcp`, `file`.

OpenCode использует семантику **last-match-wins**. При транспиляции
ТРЕБУЕТСЯ инвертировать порядок правил из канонического формата
(first-match-wins), чтобы обеспечить эквивалентную семантику
в целевом формате.

### Инверсия порядка правил

Канонический формат: first-match-wins (первое совпавшее правило побеждает).
OpenCode: last-match-wins (последнее совпавшее правило побеждает).

Для сохранения эквивалентной семантики при транспиляции ТРЕБУЕТСЯ
инвертировать порядок массива правил (`reverse`). Поскольку
канонический формат уже является упорядоченным массивом пар
pattern:action, инверсия выполняется простым разворотом массива.

### Трансформация shell-правил для OpenCode

OpenCode представляет shell-правила как объект `bash`
внутри `permission`, где ключ -- паттерн команды, значение -- действие
(`"allow"`, `"deny"`, `"ask"`).

Shell-паттерны из канонического формата передаются as-is
(нативные глобы совпадают с форматом OpenCode).

Примеры:

- `"git push *"` -> `"git push *"`
- `"./gradlew *"` -> `"./gradlew *"`
- `"* --version"` -> `"* --version"`
- `"*"` -> `"*"`

### Трансформация MCP-правил для OpenCode

OpenCode представляет MCP-правила как плоские ключи в `permission`,
где ключ -- `<server>_<tool>`, значение -- действие
(`"allow"`, `"deny"`, `"ask"`).
Разделитель `:` заменяется на `_`.

Примеры:

- `"bitbucket:get_pull_request"` -> `"bitbucket_get_pull_request"`
- `"bitbucket:*"` -> `"bitbucket_*"`

### Трансформация file-правил для OpenCode

OpenCode представляет file-правила как объект `file`
внутри `permission`, где ключ -- паттерн пути, значение -- действие
(`"deny"`, `"read"`, `"write"`).

File-правила из канонического формата передаются без изменения паттернов.

Маппинг действий:

- `deny` -> `"deny"`
- `read` -> `"read"`
- `write` -> `"write"`

### transpile

`opencodePermissionsAdapter.transpile(file)`.

**Вход:**

- `file` (PermissionsCanonicalFile, обязательно) -- канонический файл.

**Поведение:**

1. Создать пустой объект `permission`.
2. Если `file.content.mcp` присутствует:
   2.1. Развернуть массив MCP-правил (`reverse`).
   2.2. Для каждого правила -- трансформировать паттерн
   (см. "Трансформация MCP-правил для OpenCode")
   и добавить в `permission` как ключ-значение.
3. Если `file.content.shell` присутствует:
   3.1. Развернуть массив shell-правил (`reverse`).
   3.2. Создать объект `bash`.
   3.3. Для каждого правила -- передать паттерн as-is
   и добавить в `bash` как ключ-значение.
   3.4. Добавить `bash` в `permission`.
4. Если `file.content.file` присутствует:
   4.1. Развернуть массив file-правил (`reverse`).
   4.2. Создать объект `file`.
   4.3. Для каждого правила -- добавить в `file` как ключ-значение.
   4.4. Добавить `file` в `permission`.
5. Сформировать объект `output` с ключом `"permission"`,
   содержащим `permission`.
6. Сериализовать `output` в JSON с отступом 2 пробела
   и завершающим переводом строки.
7. Сформировать `PermissionsOutputFile`
   с `relativePath: "opencode.json"`.

**Расширения:**

Нет расширений.

**Результат:**

`PermissionsOutputFile[]` (массив из одного элемента).

### Пример выходного файла (opencode.json)

Для канонического файла из примера выше:

```json
{
  "permission": {
    "*_*": "deny",
    "jenkins_*": "ask",
    "bitbucket_*": "ask",
    "jenkins_get_build": "allow",
    "bitbucket_get_pull_request": "allow",
    "untrusted-server_*": "deny",
    "bash": {
      "*": "deny",
      "npm *": "ask",
      "git status *": "allow",
      "ls *": "allow",
      "./gradlew *": "allow",
      "git push *": "deny"
    },
    "file": {
      "src/**": "read",
      "src/**/*.ts": "write",
      "**/.env": "deny"
    }
  }
}
```

### Deep merge с существующим opencode.json

Файл `opencode.json` МОЖЕТ содержать данные, записанные overlay-шагом
или другими транспилерами (в том числе MCP-транспилером). Дедупликация
и merge по output path выполняется на уровне `writeResults`
(см. "Запись результатов"). При конфликте по пути `opencode.json`
ТРЕБУЕТСЯ применить deep merge в соответствии с
`docs/specs/layer-model.md` § Алгоритм deep merge,
поскольку `opencode.json` является merge-eligible файлом
(расширение `.json`).

## Запись результатов

`transpiler.writeResults(results)` -- записывает результаты транспиляции
в файловую систему.

**Вход:**

- `results` (array\<TranspileResult>, обязательно) -- результаты
  транспиляции, полученные из `transpile()`.

**Поведение:**

1. Для каждого `TranspileResult` проверить, что массив `errors` пуст.
2. Собрать все `PermissionsOutputFile` из всех `TranspileResult`
   с пустым `errors`.
3. Выполнить дедупликацию: если несколько `PermissionsOutputFile` имеют
   одинаковый `relativePath`, применить deep merge для merge-eligible
   файлов (`.json`) в порядке обхода массива `results`.
4. Для каждого уникального файла: если по целевому пути
   `projectRoot / relativePath` существует файл (от overlay
   или предыдущего шага) -- применить deep merge результата
   транспиляции поверх существующего содержимого.
5. Записать итоговое содержимое в `projectRoot / relativePath`
   с кодировкой UTF-8, создавая промежуточные каталоги
   при необходимости.
6. Вернуть массив путей записанных файлов.

**Расширения:**

1a. `TranspileResult` содержит непустой `errors` -- пропустить
запись всех `files` данного адаптера; включить ошибки
в `WriteResult.errors`.

4a. Существующий файл по целевому пути содержит невалидный JSON --
перезаписать файл целиком (не выполнять merge).

5a. Ошибка записи файла или создания каталога (нет прав, диск полон) --
`WriteError("Failed to write {relativePath}: {причина}")`.

**Результат:**

`WriteResult`.

- `written` (array\<string>) -- относительные пути успешно
  записанных файлов.
- `errors` (array\<WriteError>) -- ошибки записи.

## Классы ошибок

- `ConfigError` (extends Error) -- ошибка конфигурации транспилера.
- `DiscoverError` (extends Error) -- ошибка обнаружения канонического файла.
- `TransformError` (extends Error) -- ошибка валидации или трансформации.
- `TranspileError` (extends Error) -- ошибка транспиляции адаптера.
- `WriteError` (extends Error) -- ошибка записи файла.

## Расширение AdapterRegistryEntry

К существующему типу `AdapterRegistryEntry`
(см. `docs/specs/cli.md` § Типы данных) ТРЕБУЕТСЯ добавить поле:

- `permissions` (PermissionsAdapter | null, обязательно) -- экземпляр
  Permissions-адаптера. Значение `null` означает, что адаптер
  не поддерживает Permissions-транспиляцию.

### Обновление реестра адаптеров

| `id`         | `permissions`                |
| ------------ | ---------------------------- |
| `"claude"`   | `ClaudePermissionsAdapter`   |
| `"opencode"` | `OpenCodePermissionsAdapter` |
| `"agentsmd"` | `null`                       |

Адаптер `"agentsmd"` НЕ имеет Permissions-адаптера, поскольку формат
AGENTS.md не определяет конфигурацию разрешений.

## Расширение команды transpile

Команда `transpile` (см. `docs/specs/cli.md` § Команда transpile)
расширяется шагом Permissions.

**Новые шаги:**

После шага MCP (4.5 в mcp-transpiler):
4.6. Если `entry.permissions` не равен `null` -- выполнить шаг
транспиляции "Permissions" (см. `docs/specs/cli.md` § Шаг транспиляции)
с адаптером `entry.permissions`.

**Изменения в выводе:**

Шаг Permissions отображается после шага MCP:

```text
  ✓ Permissions         1 files
```

Если `entry.permissions` равен `null` -- шаг Permissions не выполняется
и не отображается.

**Изменения в TranspilerStepOutcome:**

Поле `name` типа `TranspilerStepOutcome`
(см. `docs/specs/cli.md` § Типы данных) ТРЕБУЕТСЯ расширить
допустимым значением `"Permissions"`:

- `name` (string: `"Instructions"` | `"Skills"` | `"Agents"` | `"MCP"` | `"Permissions"` | `"Overlay"`)

**Изменения в exit codes:**

Exit code учитывает ошибки шага Permissions наравне с остальными шагами.

## Расширение структуры директории плагина

Директория плагина (см. `docs/specs/plugin-manifest.md`
§ Структура директории плагина) МОЖЕТ содержать permissions-конфигурацию:

```text
<plugin-root>/
├── plugin.yml
├── permissions.yml     # Permissions-конфигурация плагина (опционально)
├── permissions.json    # Permissions-конфигурация плагина (опционально)
├── ...
```

Формат `permissions.yml` / `permissions.json` в плагине идентичен
каноническому формату (см. "Канонический формат"). При наличии обоих
файлов в одном плагине -- ошибка (аналогично локальному проекту).

Permissions-конфигурация плагина участвует в модели слоёв
(см. `docs/specs/layer-model.md` § Порядок применения слоёв)
как отдельный слой. Deep merge выполняется в порядке приоритета:
плагины (в порядке объявления), затем локальный проект.

### Соответствие путей

| Путь в `.agloom/`          | Путь в плагине              |
| -------------------------- | --------------------------- |
| `.agloom/permissions.yml`  | `<plugin>/permissions.yml`  |
| `.agloom/permissions.json` | `<plugin>/permissions.json` |

## Обратная совместимость

Старый формат канонического файла (группировка по действиям:
`shell: { allow: [...], ask: [...], deny: [...] }`) НЕ поддерживается.
При обнаружении старого формата валидация ДОЛЖНА завершиться ошибкой
(расширение 3a: `"'shell' must be an array of permission rules"`).
Миграция со старого формата на новый выполняется вручную.

## Вне scope

Следующие аспекты НЕ ВХОДЯТ в scope данной спецификации:

- Адаптеры для Codex, Gemini CLI, Cursor, Copilot, KiloCode, agentsmd.
- `${values:*}` интерполяция в permissions.
- Per-agent permissions (permissions, привязанные к конкретному агенту
  внутри проекта) -- только project-level.
- Валидация существования MCP-серверов, указанных в MCP-правилах.
- Wildcard-расширение паттернов (паттерны передаются адаптерам as-is,
  без glob-expansion).
- Автоматическая миграция со старого формата (группировка по действиям)
  на новый (ordered list).
