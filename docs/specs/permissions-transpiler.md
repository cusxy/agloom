---
summary: Permissions Transpiler — библиотека транспиляции permissions из .agloom/ в agent-specific файлы
description: >
  Библиотека для транспиляции канонической конфигурации разрешений
  (.agloom/permissions.yml или .agloom/permissions.json) в agent-specific
  файлы. Генерирует секцию permissions в .claude/settings.json для Claude Code
  и секцию permission в opencode.json для OpenCode. Поддерживает секции
  shell, mcp, file с семантикой first-match-wins в каноническом формате
  и инверсией порядка для last-match-wins адаптеров. Расширяется через адаптеры.
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

- `shell` (object, опционально) -- правила для shell-команд.
  - `allow` (array\<string>, опционально, default: `[]`) -- паттерны
    разрешённых shell-команд (выполнять без подтверждения).
  - `ask` (array\<string>, опционально, default: `[]`) -- паттерны
    shell-команд, требующих подтверждения пользователя.
  - `deny` (array\<string>, опционально, default: `[]`) -- паттерны
    запрещённых shell-команд.
- `mcp` (object, опционально) -- правила для MCP-инструментов.
  - `allow` (array\<string>, опционально, default: `[]`) -- паттерны
    разрешённых MCP-инструментов (выполнять без подтверждения).
  - `ask` (array\<string>, опционально, default: `[]`) -- паттерны
    MCP-инструментов, требующих подтверждения пользователя.
  - `deny` (array\<string>, опционально, default: `[]`) -- паттерны
    запрещённых MCP-инструментов.
- `file` (object, опционально) -- правила доступа к файлам.
  - `deny` (array\<string>, опционально, default: `[]`) -- паттерны
    запрещённых путей.
  - `read` (array\<string>, опционально, default: `[]`) -- паттерны
    путей с доступом на чтение.
  - `write` (array\<string>, опционально, default: `[]`) -- паттерны
    путей с доступом на чтение и запись.

### Нотация shell-паттернов

Shell-паттерны используют формат `<command>:<args-glob>`:

- `command` -- имя команды или путь (например, `ls`, `git status`,
  `./gradlew`).
- `args-glob` -- glob-паттерн аргументов (`*` для любых аргументов).

Примеры:

- `"ls:*"` -- команда `ls` с любыми аргументами.
- `"git status:*"` -- команда `git status` с любыми аргументами.
- `"./gradlew:*"` -- команда `./gradlew` с любыми аргументами.
- `"*:*"` -- любая команда с любыми аргументами.

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
  allow:
    - "./gradlew:*"
    - "ls:*"
    - "git status:*"
  ask:
    - "npm:*"
  deny:
    - "*:*"
mcp:
  allow:
    - "bitbucket:get_pull_request"
    - "jenkins:get_build"
  ask:
    - "bitbucket:*"
    - "jenkins:*"
  deny:
    - "*:*"
file:
  deny:
    - "**/.env"
  read:
    - "src/**"
  write:
    - "src/**/*.ts"
```

### Пример канонического файла (JSON)

```json
{
  "shell": {
    "allow": ["./gradlew:*", "ls:*", "git status:*"],
    "ask": ["npm:*"],
    "deny": ["*:*"]
  },
  "mcp": {
    "allow": ["bitbucket:get_pull_request", "jenkins:get_build"],
    "ask": ["bitbucket:*", "jenkins:*"],
    "deny": ["*:*"]
  }
}
```

## Типы данных

### PermissionsCanonicalFile

Результат обнаружения канонического файла.

- `relativePath` (string) -- путь файла относительно `projectRoot`.
- `format` (string: "yaml" | "json") -- формат файла.
- `content` (PermissionsCanonicalContent) -- распарсенное содержимое.

### PermissionsCanonicalContent

Распарсенное содержимое канонического файла.

- `shell` (ShellPermissions | undefined) -- правила для shell-команд.
- `mcp` (McpPermissions | undefined) -- правила для MCP-инструментов.
- `file` (FilePermissions | undefined) -- правила доступа к файлам.

### ShellPermissions

- `allow` (array\<string>) -- паттерны разрешённых shell-команд.
- `ask` (array\<string>) -- паттерны shell-команд, требующих подтверждения.
- `deny` (array\<string>) -- паттерны запрещённых shell-команд.

### McpPermissions

- `allow` (array\<string>) -- паттерны разрешённых MCP-инструментов.
- `ask` (array\<string>) -- паттерны MCP-инструментов, требующих подтверждения.
- `deny` (array\<string>) -- паттерны запрещённых MCP-инструментов.

### FilePermissions

- `deny` (array\<string>) -- паттерны запрещённых путей.
- `read` (array\<string>) -- паттерны путей с доступом на чтение.
- `write` (array\<string>) -- паттерны путей с доступом на чтение и запись.

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
3. Если поле `shell` присутствует -- валидировать структуру:
   3.1. Проверить, что значение является объектом.
   3.2. Проверить, что содержит только допустимые ключи
   (`allow`, `ask`, `deny`).
   3.3. Если поле `allow` присутствует -- проверить, что значение
   является массивом строк.
   3.4. Если поле `ask` присутствует -- проверить, что значение
   является массивом строк.
   3.5. Если поле `deny` присутствует -- проверить, что значение
   является массивом строк.
   3.6. Для каждого элемента `allow`, `ask` и `deny` -- проверить,
   что строка соответствует формату `<command>:<args-glob>`
   (содержит ровно один разделитель `:`).
4. Если поле `mcp` присутствует -- валидировать структуру:
   4.1. Проверить, что значение является объектом.
   4.2. Проверить, что содержит только допустимые ключи
   (`allow`, `ask`, `deny`).
   4.3. Если поле `allow` присутствует -- проверить, что значение
   является массивом строк.
   4.4. Если поле `ask` присутствует -- проверить, что значение
   является массивом строк.
   4.5. Если поле `deny` присутствует -- проверить, что значение
   является массивом строк.
   4.6. Для каждого элемента `allow`, `ask` и `deny` -- проверить,
   что строка соответствует формату `<server>:<tool>`
   (содержит ровно один разделитель `:`).
5. Если поле `file` присутствует -- валидировать структуру:
   5.1. Проверить, что значение является объектом.
   5.2. Проверить, что содержит только допустимые ключи
   (`deny`, `read`, `write`).
   5.3. Если поле `deny` присутствует -- проверить, что значение
   является массивом строк.
   5.4. Если поле `read` присутствует -- проверить, что значение
   является массивом строк.
   5.5. Если поле `write` присутствует -- проверить, что значение
   является массивом строк.

**Расширения:**

1a. `content` не является объектом --
`TransformError("Permissions config must be an object")`.

2a. `content` содержит неизвестный ключ --
`TransformError("Unknown key '{key}' in permissions config. Allowed keys: shell, mcp, file")`.

3a. Значение `shell` не является объектом --
`TransformError("'shell' must be an object")`.

3b. `shell` содержит неизвестный ключ --
`TransformError("Unknown key '{key}' in 'shell'. Allowed keys: allow, ask, deny")`.

3c. Поле `shell.allow` присутствует, но не является массивом строк --
`TransformError("'shell.allow' must be an array of strings")`.

3d. Поле `shell.ask` присутствует, но не является массивом строк --
`TransformError("'shell.ask' must be an array of strings")`.

3e. Поле `shell.deny` присутствует, но не является массивом строк --
`TransformError("'shell.deny' must be an array of strings")`.

3f. Элемент `shell.allow`, `shell.ask` или `shell.deny` не соответствует
формату `<command>:<args-glob>` --
`TransformError("Invalid shell pattern '{pattern}': must match format '<command>:<args-glob>'")`.

4a. Значение `mcp` не является объектом --
`TransformError("'mcp' must be an object")`.

4b. `mcp` содержит неизвестный ключ --
`TransformError("Unknown key '{key}' in 'mcp'. Allowed keys: allow, ask, deny")`.

4c. Поле `mcp.allow` присутствует, но не является массивом строк --
`TransformError("'mcp.allow' must be an array of strings")`.

4d. Поле `mcp.ask` присутствует, но не является массивом строк --
`TransformError("'mcp.ask' must be an array of strings")`.

4e. Поле `mcp.deny` присутствует, но не является массивом строк --
`TransformError("'mcp.deny' must be an array of strings")`.

4f. Элемент `mcp.allow`, `mcp.ask` или `mcp.deny` не соответствует
формату `<server>:<tool>` --
`TransformError("Invalid MCP pattern '{pattern}': must match format '<server>:<tool>'")`.

5a. Значение `file` не является объектом --
`TransformError("'file' must be an object")`.

5b. `file` содержит неизвестный ключ --
`TransformError("Unknown key '{key}' in 'file'. Allowed keys: deny, read, write")`.

5c. Поле `file.deny` присутствует, но не является массивом строк --
`TransformError("'file.deny' must be an array of strings")`.

5d. Поле `file.read` присутствует, но не является массивом строк --
`TransformError("'file.read' must be an array of strings")`.

5e. Поле `file.write` присутствует, но не является массивом строк --
`TransformError("'file.write' must be an array of strings")`.

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

Каждое shell-правило из канонического формата `<command>:<args-glob>`
ТРЕБУЕТСЯ трансформировать в формат Claude Code `Bash(<command>:<args-glob>)`.

Примеры:

- `"ls:*"` → `"Bash(ls:*)"`
- `"./gradlew:*"` → `"Bash(./gradlew:*)"`
- `"git status:*"` → `"Bash(git status:*)"`

### Трансформация MCP-правил для Claude

Каждое MCP-правило из канонического формата `<server>:<tool>`
ТРЕБУЕТСЯ трансформировать в формат Claude Code `mcp__<server>__<tool>`.
Разделитель `:` заменяется на `__`.

Примеры:

- `"bitbucket:get_pull_request"` → `"mcp__bitbucket__get_pull_request"`
- `"bitbucket:*"` → `"mcp__bitbucket__*"`

### transpile

`claudePermissionsAdapter.transpile(file)`.

**Вход:**

- `file` (PermissionsCanonicalFile, обязательно) -- канонический файл.

**Поведение:**

1. Создать пустой объект `permissions` с полями `allow` и `deny`
   (оба -- пустые массивы).
2. Если `file.content.shell` присутствует:
   2.1. Для каждого элемента `shell.allow` -- трансформировать
   в формат Claude (см. "Трансформация shell-правил для Claude")
   и добавить в `permissions.allow`.
   2.2. Если `shell.ask` непуст -- эмитировать предупреждение
   в `stderr`: `"Warning: Claude Code does not support 'ask' action. {N} shell rule(s) skipped."`,
   где `{N}` -- количество элементов в `shell.ask`.
   2.3. Для каждого элемента `shell.deny` -- трансформировать
   в формат Claude и добавить в `permissions.deny`.
3. Если `file.content.mcp` присутствует:
   3.1. Для каждого элемента `mcp.allow` -- трансформировать
   в формат Claude (см. "Трансформация MCP-правил для Claude")
   и добавить в `permissions.allow`.
   3.2. Если `mcp.ask` непуст -- эмитировать предупреждение
   в `stderr`: `"Warning: Claude Code does not support 'ask' action. {N} mcp rule(s) skipped."`,
   где `{N}` -- количество элементов в `mcp.ask`.
   3.3. Для каждого элемента `mcp.deny` -- трансформировать
   в формат Claude и добавить в `permissions.deny`.
4. Если `file.content.file` присутствует -- эмитировать предупреждение
   в `stderr`: `"Warning: Claude Code does not support file permissions. 'file' section ignored."`.
5. Удалить пустые массивы: если `permissions.allow` пуст -- удалить
   ключ `allow`; если `permissions.deny` пуст -- удалить ключ `deny`.
6. Сформировать объект `output` с ключом `"permissions"`,
   содержащим `permissions`.
7. Сериализовать `output` в JSON с отступом 2 пробела
   и завершающим переводом строки.
8. Сформировать `PermissionsOutputFile`
   с `relativePath: ".claude/settings.json"`.

**Расширения:**

Нет расширений.

**Результат:**

`PermissionsOutputFile[]` (массив из одного элемента).

### Пример выходного файла (.claude/settings.json)

Для канонического файла из примера выше правила `shell.ask`
и `mcp.ask` пропускаются с предупреждением:

```json
{
  "permissions": {
    "allow": [
      "Bash(./gradlew:*)",
      "Bash(ls:*)",
      "Bash(git status:*)",
      "mcp__bitbucket__get_pull_request",
      "mcp__jenkins__get_build"
    ],
    "deny": ["Bash(*:*)", "mcp__*__*"]
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
инвертировать порядок правил. Правила из `allow`, `ask` и `deny`
ТРЕБУЕТСЯ объединить в единый массив с действиями и развернуть:
наиболее специфичные правила (allow для конкретных инструментов)
оказываются последними и побеждают при last-match-wins.

Алгоритм инверсии для тройки (allow, ask, deny):

1. Сформировать массив пар `(pattern, action)` из `allow`, `ask`
   и `deny` в порядке объявления в каноническом файле.
   Порядок: сначала элементы `allow` (с действием `"allow"`),
   затем элементы `ask` (с действием `"ask"`),
   затем элементы `deny` (с действием `"deny"`).
2. Развернуть массив (`reverse`).
3. Записать результат как объект, где ключ -- паттерн,
   значение -- действие.

### Трансформация shell-правил для OpenCode

OpenCode представляет shell-правила как объект `bash`
внутри `permission`, где ключ -- паттерн команды, значение -- действие
(`"allow"`, `"deny"`, `"ask"`).

Каждое shell-правило из канонического формата `<command>:<args-glob>`
ТРЕБУЕТСЯ трансформировать: разделитель `:` заменяется на пробел ` `.

Примеры:

- `"ls:*"` → `"ls *"`
- `"./gradlew:*"` → `"./gradlew *"`
- `"*:*"` → `"*"`

Специальный случай: паттерн `"*:*"` ТРЕБУЕТСЯ трансформировать в `"*"`
(без пробела).

### Трансформация MCP-правил для OpenCode

OpenCode представляет MCP-правила как плоские ключи в `permission`,
где ключ -- `<server>_<tool>`, значение -- действие
(`"allow"`, `"deny"`, `"ask"`).
Разделитель `:` заменяется на `_`.

Примеры:

- `"bitbucket:get_pull_request"` → `"bitbucket_get_pull_request"`
- `"bitbucket:*"` → `"bitbucket_*"`

### Трансформация file-правил для OpenCode

OpenCode представляет file-правила как объект `file`
внутри `permission`, где ключ -- паттерн пути, значение -- действие
(`"deny"`, `"read"`, `"write"`).

File-правила из канонического формата передаются без изменения паттернов.

Маппинг действий:

- `deny` → `"deny"`
- `read` → `"read"`
- `write` → `"write"`

### Инверсия для file-секции

File-секция содержит три списка (`deny`, `read`, `write`) вместо двух
(`allow`, `deny`). Алгоритм инверсии для file-секции:

1. Сформировать массив пар `(pattern, action)` из `deny`, `read`
   и `write` в порядке объявления в каноническом файле.
   Порядок: сначала элементы `deny` (с действием `"deny"`),
   затем `read` (с действием `"read"`), затем `write`
   (с действием `"write"`).
2. Развернуть массив (`reverse`).
3. Записать результат как объект, где ключ -- паттерн,
   значение -- действие.

### transpile

`opencodePermissionsAdapter.transpile(file)`.

**Вход:**

- `file` (PermissionsCanonicalFile, обязательно) -- канонический файл.

**Поведение:**

1. Создать пустой объект `permission`.
2. Если `file.content.mcp` присутствует:
   2.1. Сформировать массив пар `(pattern, action)` из `mcp.allow`,
   `mcp.ask` и `mcp.deny` (см. "Инверсия порядка правил").
   2.2. Развернуть массив.
   2.3. Для каждой пары -- трансформировать паттерн
   (см. "Трансформация MCP-правил для OpenCode")
   и добавить в `permission` как ключ-значение.
3. Если `file.content.shell` присутствует:
   3.1. Сформировать массив пар `(pattern, action)` из `shell.allow`,
   `shell.ask` и `shell.deny` (см. "Инверсия порядка правил").
   3.2. Развернуть массив.
   3.3. Создать объект `bash`.
   3.4. Для каждой пары -- трансформировать паттерн
   (см. "Трансформация shell-правил для OpenCode")
   и добавить в `bash` как ключ-значение.
   3.5. Добавить `bash` в `permission`.
4. Если `file.content.file` присутствует:
   4.1. Сформировать массив пар `(pattern, action)` из `file.deny`,
   `file.read` и `file.write` (см. "Инверсия для file-секции").
   4.2. Развернуть массив.
   4.3. Создать объект `file`.
   4.4. Для каждой пары -- добавить в `file` как ключ-значение.
   4.5. Добавить `file` в `permission`.
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
    "bash": {
      "*": "deny",
      "npm *": "ask",
      "git status *": "allow",
      "ls *": "allow",
      "./gradlew *": "allow"
    },
    "file": {
      "src/**/*.ts": "write",
      "src/**": "read",
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

## Вне scope

Следующие аспекты НЕ ВХОДЯТ в scope данной спецификации:

- Адаптеры для Codex, Gemini CLI, Cursor, Copilot, KiloCode, agentsmd.
- `${values:*}` интерполяция в permissions.
- Per-agent permissions (permissions, привязанные к конкретному агенту
  внутри проекта) -- только project-level.
- Валидация существования MCP-серверов, указанных в MCP-правилах.
- Wildcard-расширение паттернов (паттерны передаются адаптерам as-is,
  без glob-expansion).
