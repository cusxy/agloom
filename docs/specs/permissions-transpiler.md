---
summary: Permissions Transpiler — библиотека транспиляции permissions из .agloom/ в agent-specific файлы
description: >
  Библиотека для транспиляции канонической конфигурации разрешений
  (.agloom/permissions.yml или .agloom/permissions.json) в agent-specific
  файлы. Является единственным источником postfactum permission gating
  для Claude, OpenCode, Kilocode и поддерживает Codex, Gemini через
  нативные rules/policy движки. Канонический формат использует
  first-match-wins; препроцессинг (dropShadowedRules,
  flattenWhitelistConflicts) нормализует семантику для target-движков
  с last-match-wins или decision-severity-wins. Расширяется через адаптеры.
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
  "file": [{ "**/.env": "deny" }, { "src/**/*.ts": "write" }, { "src/**": "read" }]
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

## Общий препроцессинг правил

Permissions-транспилер является **единственным** источником postfactum
permission gating для адаптеров Claude, OpenCode и Kilocode: MCP-транспилер
после разведения MCP и permissions (см. `docs/specs/mcp-transpiler.md`
§ Семантика `includeTools` / `excludeTools`) НЕ эмитирует permission-блоки
в общие output-файлы (`.claude/settings.json`, `opencode.json`,
`kilo.jsonc`). Весь permission gating для этих адаптеров формируется
исключительно из канонического `.agloom/permissions.yml` и проходит
через препроцессинг, описанный в данной секции.

Препроцессинг применяется к каноническим массивам правил
(`shell`, `mcp`, `file`) **до** передачи конкретному адаптеру.
Цель -- нормализовать canonical first-match-wins для target-движков
с отличной от canonical семантикой.

Препроцессинг состоит из двух процедур: `dropShadowedRules` (применяется
всеми адаптерами) и `flattenWhitelistConflicts` (применяется только
адаптерами с decision-severity-wins семантикой, см. § Препроцессинг
для decision-severity-wins движков).

### Argv-представление паттернов

Обе процедуры препроцессинга оперируют паттернами в виде массива
argv-токенов.

- Для shell-правила -- argv получается по правилам трансформации
  канонических shell-паттернов в argv (см. § Трансформация shell-паттернов
  для Codex): трейлинг-wildcard удаляется, оставшаяся строка разбивается
  по whitespace; паттерны, для которых argv не определён
  (bare/leading/middle wildcard), НЕ участвуют в сравнении по префиксу
  и считаются несравнимыми (ни одно правило не является префиксом такого
  паттерна и наоборот).
- Для mcp-правила -- argv -- это массив `[server, tool]`, где `tool`
  равен `"*"` для wildcard. Правило `"<server>:*"` считается префиксом
  правила `"<server>:<tool>"` для любого `<tool>`; правило `"*:*"`
  считается префиксом любого mcp-правила.
- Для file-правила -- argv получается разбиением glob-паттерна на части
  по разделителю `/`; сегменты `**` и `*` учитываются литерально
  (без glob-expansion). Более короткий общий префикс по сегментам
  считается префиксом более длинного.

**Определение "префикс":** argv `A` является префиксом argv `B`,
если `A.length <= B.length` и `A[i] === B[i]` для всех
`0 <= i < A.length`. Префикс ДОЛЖЕН быть строгим (`A.length < B.length`)
для `flattenWhitelistConflicts` и нестрогим (включая равенство)
для `dropShadowedRules`.

### Процедура `dropShadowedRules`

Удаляет правила, которые shadowed в canonical first-match-wins (более
раннее правило является префиксом или равным текущему). Такие правила
никогда не срабатывают в canonical семантике, поэтому удаление
безопасно для любого target-движка.

**Вход:**

- `rules` (array\<PermissionRule>, обязательно) -- канонический массив
  правил секции `shell`, `mcp` или `file`.
- `section` (string: `"shell"` | `"mcp"` | `"file"`, обязательно) --
  имя секции (для диагностического сообщения).

**Поведение:**

1. Создать пустой массив `result`.
2. Для каждого правила `R[i]` входного массива в порядке следования:
   2.1. Вычислить `argv(R[i])` в соответствии с § Argv-представление
   паттернов.
   2.2. Для каждого уже добавленного правила `R[j]` в `result`
   (`j < i`):
   - Если `argv(R[j])` определён, `argv(R[i])` определён
     и `argv(R[j])` является нестрогим префиксом `argv(R[i])` --
     правило `R[i]` помечается как shadowed.
     2.3. Если `R[i]` помечено как shadowed -- эмитировать предупреждение
     в `stderr`: `"Warning: {section} rule '{pattern_i}' is shadowed by earlier rule '{pattern_j}' and never matches under first-match-wins semantics. Rule skipped."`.
     Пропустить `R[i]` (не добавлять в `result`).
     2.4. Иначе -- добавить `R[i]` в `result`.
3. Вернуть `result`.

**Расширения:**

Нет расширений.

**Результат:**

`array<PermissionRule>` -- массив правил без shadowed-дубликатов.

### Применимость `dropShadowedRules`

Процедура универсальна и ТРЕБУЕТСЯ к применению всеми Permissions-
адаптерами (Claude, OpenCode, Codex, Gemini, Kilocode) как обязательный
первый шаг препроцессинга перед специфичной для адаптера трансформацией.
Удалённые правила никогда не сработали бы в canonical first-match-wins,
поэтому их удаление не изменяет наблюдаемую семантику.

## Препроцессинг для decision-severity-wins движков

Некоторые permissions engines используют **most-restrictive-wins**
семантику: при пересечении паттернов правило с более строгим decision
выигрывает, независимо от специфичности или порядка. Это расходится
с canonical first-match-wins в случае whitelist-паттернов
(например, `"git status *": allow` → `"git *": deny`: в canonical
выиграет первое правило, а в most-restrictive-wins -- второе).

К таким движкам относятся:

- **Codex** -- `forbidden > prompt > allow` (подтверждено
  [Codex rules reference](https://developers.openai.com/codex/rules)).
- **Claude Code** -- `deny > ask > allow`: правила оцениваются в порядке
  deny → ask → allow, первое совпавшее правило побеждает (подтверждено
  [Claude Code permissions reference](https://code.claude.com/docs/en/permissions)
  § Manage permissions: "Rules are evaluated in order: deny -> ask -> allow.
  The first matching rule wins, so deny rules always take precedence").

Для таких адаптеров ТРЕБУЕТСЯ применять процедуру
`flattenWhitelistConflicts` после `dropShadowedRules`.

### Severity decision

Для процедуры `flattenWhitelistConflicts` каноническому действию
назначается целочисленная severity:

Для секций `shell` и `mcp`:

- `allow` → severity `0`.
- `ask` → severity `1`.
- `deny` → severity `2`.

Для секции `file`:

- `write` → severity `0`.
- `read` → severity `1`.
- `deny` → severity `2`.

Правило `R[j]` считается **строже** `R[i]`, если
`severity(R[j]) > severity(R[i])`.

### Процедура `flattenWhitelistConflicts`

Удаляет правила, которые перекрывали бы более узкие canonical-правила
с менее строгим decision под most-restrictive-wins семантикой.

**Вход:**

- `rules` (array\<PermissionRule>, обязательно) -- массив правил,
  уже прошедший через `dropShadowedRules`.
- `section` (string: `"shell"` | `"mcp"` | `"file"`, обязательно) --
  имя секции (для диагностического сообщения).

**Поведение:**

1. Создать пустое множество `dropIndexes`.
2. Для каждой пары индексов `(i, j)` где `0 <= i < j < rules.length`,
   и `i`, `j` не входят в `dropIndexes`:
   2.1. Вычислить `argv(R[i])` и `argv(R[j])` в соответствии с § Argv-
   представление паттернов.
   2.2. Если хотя бы один из argv не определён -- пропустить пару.
   2.3. Если `argv(R[j])` является **строгим** префиксом `argv(R[i])`
   (`argv(R[j]).length < argv(R[i]).length`) И
   `severity(R[j]) > severity(R[i])`:
   - Эмитировать предупреждение в `stderr`:
     `"Warning: {section} rule '{pattern_j}' → '{decision_j}' would override narrower '{pattern_i}' → '{decision_i}' under most-restrictive-wins semantics. Broader rule skipped to preserve canonical first-match intent."`.
   - Добавить индекс `j` в `dropIndexes`.
3. Вернуть массив `rules` без элементов с индексами из `dropIndexes`,
   сохраняя относительный порядок.

**Расширения:**

Нет расширений.

**Результат:**

`array<PermissionRule>` -- массив правил без broader-override конфликтов.

### Теорема эквивалентности

После последовательного применения `dropShadowedRules` и
`flattenWhitelistConflicts` к каноническому массиву правил, для любой
команды `cmd` результаты canonical first-match-wins и decision-severity-
wins на результирующем массиве совпадают.

Доказательство (неформальное):

1. После `dropShadowedRules`: для любой пары `(i, j)` с `i < j`,
   `R[i]` НЕ является нестрогим префиксом `R[j]`. Значит либо паттерны
   disjoint, либо `R[j]` является строгим префиксом `R[i]` (более поздние
   правила строго специфичнее более ранних).
2. После `flattenWhitelistConflicts`: для любой пары `(i, j)` с `i < j`,
   если `R[j]` является строгим префиксом `R[i]`, то
   `severity(R[j]) <= severity(R[i])`.
3. Пусть `S` -- множество индексов правил, совпавших с командой.
   - Canonical: выигрывает `R[min(S)]`.
   - Decision-severity-wins: выигрывает правило с максимальной severity;
     tie-break среди правил равного severity определяется движком
     (Claude Code документирует file-order tie-break: "first matching
     rule wins"; Codex формально tie-break не определяет).
4. Если `|S| = 1` -- тривиально.
5. Если `|S| > 1`: по пункту 1, более ранние правила (меньший индекс)
   строго специфичнее более поздних. Значит `R[min(S)]` -- самое
   специфичное. По пункту 2, более поздние правила имеют severity
   не большую, чем `R[min(S)]`. Следовательно, `R[min(S)]` имеет
   максимальную severity в `S` (или разделяет максимум с более поздними,
   менее специфичными правилами). `R[min(S)]` по построению
   одновременно является (а) самым специфичным в `S` и (б) первым
   по file-order среди правил равного severity в `S`. Поэтому
   `R[min(S)]` выигрывает независимо от tie-break стратегии конкретного
   движка: и Claude Code (file-order), и Codex (most-restrictive без
   формально определённого tie-break) выбирают одно и то же правило. ✓

### Ограничения подхода

Препроцессинг обеспечивает эквивалентность canonical first-match-wins
и decision-severity-wins в большинстве реалистичных конфигураций,
но имеет два известных ограничения.

1. **Broader-deny-with-narrower-allow.** Препроцессинг корректен
   для whitelist-паттерна (узкий allow + широкий deny), но НЕ позволяет
   выразить противоположный паттерн: широкий deny с узкими allow-
   исключениями. В canonical first-match-wins этот паттерн работает
   (узкий allow стоит раньше), но после `flattenWhitelistConflicts`
   широкое deny-правило будет удалено, поскольку оно перекрывало бы
   более узкий allow под most-restrictive-wins.

   Для такого сценария пользователь ДОЛЖЕН полагаться на глобальные
   catch-all настройки соответствующего агента (например, Codex
   `approval_policy` в `config.toml`) как механизм запрета команд,
   не покрытых явными правилами. Соответствие canonical для
   explicitly-listed команд обеспечивается препроцессингом;
   автоматическое детектирование catch-all настроек агента вне scope
   данной спецификации.

2. **Wildcard-паттерны в не-трейлинг позиции.** Shell-правила с символом
   `*` в bare, leading или middle позиции (например, `*`, `* --version`,
   `git * --version`) имеют неопределённую argv-representation
   (см. § Argv-представление паттернов) и ТРЕБУЕТСЯ исключать
   из prefix-сравнений в обеих препроцессорных процедурах. Для
   адаптеров с decision-severity-wins движком (Claude, Codex) это
   означает, что теорема эквивалентности НЕ гарантирует совпадение
   canonical first-match-wins с native engine семантикой, если среди
   правил присутствуют такие паттерны одновременно с пересекающимися
   trailing-wildcard или literal-prefix правилами.

   Конкретный контрпример для canonical:

   ```yaml
   shell:
     - "git status --version": allow
     - "* --version": deny
   ```

   Canonical first-match: `git status --version` → allow. Claude
   most-restrictive-wins (после передачи обоих правил as-is): оба
   матчат, `deny > allow` → deny. Расхождение.

   Codex-адаптер дополнительно пропускает non-trailing-wildcard правила
   полностью на стадии transform (см. § Codex Permissions-адаптер,
   § Трансформация shell-паттернов для Codex), поэтому для Codex gap
   не проявляется в output -- правила с неопределённой argv просто
   не попадают в `.codex/rules/agloom.rules`. Claude-адаптер
   транспилирует их as-is в `Bash(<pattern>)` элементы
   `permissions.allow` / `permissions.deny`, что может привести
   к расхождению наблюдаемого поведения с canonical при наличии
   конфликтующих правил.

   Пользователю СЛЕДУЕТ избегать смешивания non-trailing wildcard
   правил с overlapping trailing-wildcard или literal правилами
   в пределах одной секции `shell`; при необходимости такого смешения
   СЛЕДУЕТ вручную проверить совпадение семантик для конкретных
   целевых команд.

### Применимость `flattenWhitelistConflicts`

Процедура ТРЕБУЕТСЯ к применению адаптерами с decision-severity-wins
engine:

- Claude Code Permissions-адаптер.
- Codex Permissions-адаптер.

Процедура НЕ ТРЕБУЕТСЯ (и НЕ ДОЛЖНА применяться) адаптерами:

- OpenCode (last-match-wins; после инверсии массива эквивалентно canonical
  first-match-wins).
- Kilocode (last-match-wins; после инверсии массива эквивалентно canonical
  first-match-wins).
- Gemini (priority-based; priority назначается вручную `999 - i`,
  что имитирует first-match-wins).

Порядок вызова строго обязателен: сначала `dropShadowedRules`,
затем `flattenWhitelistConflicts`.

## Claude Code Permissions-адаптер

Адаптер для Claude Code. `agentId`: `"claude"`.

Генерирует файл `.claude/settings.json` в корне проекта с ключом
`"permissions"`. При наличии существующего `.claude/settings.json`
(от overlay или предыдущих шагов транспиляции) ТРЕБУЕТСЯ выполнить
deep merge через layer model (см. `docs/specs/layer-model.md`).

Claude Code поддерживает секции `shell` и `mcp`. Секция `file`
НЕ поддерживается Claude Code. Действие `ask` НЕ поддерживается
Claude Code -- правила с действием `ask` пропускаются с предупреждением.

Claude Code использует **decision-severity-wins** семантику
(`deny > ask > allow`, первое совпавшее правило побеждает в рамках
каждого decision-бакета). Для сохранения соответствия canonical
first-match-wins на массивах `shell` и `mcp` ТРЕБУЕТСЯ применять
препроцессинг (см. § Общий препроцессинг правил и § Препроцессинг
для decision-severity-wins движков):

1. Сначала `dropShadowedRules`.
2. Затем `flattenWhitelistConflicts`.

Препроцессинг применяется к секциям `shell` и `mcp` независимо.

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
2. Если `file.content.shell` присутствует:
   2.0. Применить `dropShadowedRules(file.content.shell, "shell")` →
   `shellFiltered1`; затем `flattenWhitelistConflicts(shellFiltered1, "shell")` →
   `shellFiltered2`. Далее итерировать `shellFiltered2`:
   2.1. Для каждого правила с действием `allow` -- трансформировать
   паттерн в формат Claude (см. "Трансформация shell-правил для Claude")
   и добавить в `permissions.allow`.
   2.2. Для каждого правила с действием `deny` -- трансформировать
   паттерн в формат Claude и добавить в `permissions.deny`.
   2.3. Подсчитать количество правил с действием `ask`.
   Если количество больше нуля -- эмитировать предупреждение
   в `stderr`: `"Warning: Claude Code does not support 'ask' action. {N} shell rule(s) skipped."`,
   где `{N}` -- количество правил с действием `ask`.
3. Если `file.content.mcp` присутствует:
   3.0. Применить `dropShadowedRules(file.content.mcp, "mcp")` →
   `mcpFiltered1`; затем `flattenWhitelistConflicts(mcpFiltered1, "mcp")` →
   `mcpFiltered2`. Далее итерировать `mcpFiltered2`:
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
    "deny": ["Bash(git push *)", "Bash(*)", "mcp__untrusted-server__*", "mcp__*__*"]
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

Permissions-транспилер OpenCode является единственным источником
блока `permission` в `opencode.json`: MCP-транспилер OpenCode после
разведения MCP и permissions (см. `docs/specs/mcp-transpiler.md`
§ Семантика `includeTools` / `excludeTools`) НЕ эмитирует
permission-блок, поэтому конфликт по ключу `permission` между
MCP- и Permissions-транспилерами отсутствует.

Перед инверсией массивов ТРЕБУЕТСЯ применять `dropShadowedRules`
(см. § Общий препроцессинг правил). Процедура
`flattenWhitelistConflicts` НЕ применяется, поскольку OpenCode
last-match-wins после инверсии эквивалентен canonical first-match-wins.

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
   2.1. Применить `dropShadowedRules(file.content.mcp, "mcp")` →
   `mcpFiltered`.
   2.2. Развернуть массив `mcpFiltered` (`reverse`).
   2.3. Для каждого правила -- трансформировать паттерн
   (см. "Трансформация MCP-правил для OpenCode")
   и добавить в `permission` как ключ-значение.
3. Если `file.content.shell` присутствует:
   3.1. Применить `dropShadowedRules(file.content.shell, "shell")` →
   `shellFiltered`.
   3.2. Развернуть массив `shellFiltered` (`reverse`).
   3.3. Создать объект `bash`.
   3.4. Для каждого правила -- передать паттерн as-is
   и добавить в `bash` как ключ-значение.
   3.5. Добавить `bash` в `permission`.
4. Если `file.content.file` присутствует:
   4.1. Применить `dropShadowedRules(file.content.file, "file")` →
   `fileFiltered`.
   4.2. Развернуть массив `fileFiltered` (`reverse`).
   4.3. Создать объект `file`.
   4.4. Для каждого правила -- добавить в `file` как ключ-значение.
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

## Codex Permissions-адаптер

Адаптер для Codex CLI. `agentId`: `"codex"`.

Генерирует файл `.codex/rules/agloom.rules` в корне проекта.
Файл содержит правила в синтаксисе Codex rules (Starlark-like
function-call syntax, см.
[Codex rules reference](https://developers.openai.com/codex/rules)).

Codex поддерживает только правила для shell-команд в rules-файле.
Секции `mcp` и `file` канонического формата НЕ поддерживаются
и пропускаются с предупреждением. Per-MCP-tool gating для Codex
выполняется через `config.toml` (`enabled_tools`/`disabled_tools`)
и описан в `docs/specs/mcp-transpiler.md` § Codex MCP-адаптер.

Codex применяет правила по принципу **most-restrictive-wins**
(`forbidden > prompt > allow`) при пересечении паттернов (подтверждено
[Codex rules reference](https://developers.openai.com/codex/rules)).
Канонический формат использует **first-match-wins**. Расхождение
семантики разрешается алгоритмически через препроцессинг канонического
массива `shell`:

1. Сначала `dropShadowedRules` (см. § Общий препроцессинг правил).
2. Затем `flattenWhitelistConflicts` (см. § Препроцессинг
   для decision-severity-wins движков).

После препроцессинга canonical first-match-wins и Codex
most-restrictive-wins дают эквивалентный результат для всех
explicitly-listed команд (см. § Теорема эквивалентности).

Случай, когда пользователь хочет настоящий broader-deny с узкими
allow-исключениями, НЕ поддерживается: Codex `prefix_rule` не позволяет
exclude один префикс из другого. Для такого сценария пользователь
ДОЛЖЕН полагаться на Codex `approval_policy` из `config.toml`
как catch-all для команд, не покрытых явными правилами.
Автоматическое детектирование `approval_policy` вне scope данной
спецификации (см. § Вне scope).

### Маппинг действий для Codex

Маппинг действий канонического формата в значения `decision`
Codex rules:

- `allow` → `"allow"`.
- `ask` → `"prompt"`.
- `deny` → `"forbidden"`.

### Трансформация shell-паттернов для Codex

Codex `prefix_rule(pattern=[...])` принимает массив argv-токенов
и применяется как prefix match по первым токенам командной строки.
Канонические shell-паттерны (glob) ТРЕБУЕТСЯ преобразовывать
в argv-массив по следующим правилам:

1. Если паттерн оканчивается на последовательность из одного
   пробела и символа `*` (далее — "трейлинг-wildcard") — удалить
   эти два символа, разбить оставшуюся строку по whitespace
   на argv-токены.
2. Если паттерн не содержит символа `*` — разбить всю строку
   по whitespace на argv-токены (без удаления суффикса).
3. Если паттерн равен одному символу `*` (bare wildcard) —
   пропустить с предупреждением.
4. Если первым символом паттерна является `*` (leading wildcard) —
   пропустить с предупреждением.
5. Если `*` встречается в любой другой позиции, кроме
   трейлинг-wildcard (между токенами или внутри токена) —
   пропустить с предупреждением.

Примеры:

- `"git push *"` → `["git", "push"]`.
- `"./gradlew *"` → `["./gradlew"]`.
- `"git status"` → `["git", "status"]`.
- `"*"` → skip (bare wildcard).
- `"* --version"` → skip (leading wildcard).
- `"git * --version"` → skip (middle wildcard).

### Формат output-файла Codex

Output-файл `.codex/rules/agloom.rules` — текстовый файл, содержащий
последовательность вызовов `prefix_rule(...)` в порядке следования
правил канонического массива `shell`. Между соседними вызовами
ТРЕБУЕТСЯ вставлять одну пустую строку для читаемости.

Каждый вызов ДОЛЖЕН иметь форму:

```text
prefix_rule(
    pattern = ["<token1>", "<token2>", ...],
    decision = "<allow|prompt|forbidden>",
)
```

Файл ДОЛЖЕН заканчиваться переводом строки.

### transpile

`codexPermissionsAdapter.transpile(file)`.

**Вход:**

- `file` (PermissionsCanonicalFile, обязательно) -- канонический файл.

**Поведение:**

1. Создать пустой массив строк `lines`.
2. Если `file.content.mcp` присутствует -- эмитировать предупреждение
   в `stderr`: `"Warning: Codex does not support per-tool MCP gating in rules file. 'mcp' section ignored. Use Codex config.toml (enabled_tools/disabled_tools) via MCP transpiler."`.
3. Если `file.content.file` присутствует -- эмитировать предупреждение
   в `stderr`: `"Warning: Codex does not support file permissions. 'file' section ignored."`.
4. Если `file.content.shell` присутствует:
   4.0. Применить `dropShadowedRules(file.content.shell, "shell")` →
   `shellFiltered1`; затем
   `flattenWhitelistConflicts(shellFiltered1, "shell")` →
   `shellFiltered2`. Далее итерировать `shellFiltered2` в порядке
   массива:
   4.1. Для каждого правила применить трансформацию shell-паттерна
   (см. "Трансформация shell-паттернов для Codex").
   4.2. Если паттерн пропускается (bare/leading/middle wildcard) --
   эмитировать предупреждение в `stderr`:
   `"Warning: Codex does not support shell pattern '{pattern}'. Rule skipped."`.
   4.3. Если паттерн преобразован в argv-массив -- применить
   маппинг действия (см. "Маппинг действий для Codex") и сформировать
   вызов `prefix_rule(pattern=[...], decision="...")`.
   4.4. Добавить сформированный вызов в `lines`.
5. Объединить `lines` с разделителем пустой строки.
6. Добавить завершающий перевод строки.
7. Сформировать `PermissionsOutputFile`
   с `relativePath: ".codex/rules/agloom.rules"` и сериализованным
   `content`.

**Расширения:**

4a. `file.content.shell` отсутствует или все правила пропущены --
сформировать `PermissionsOutputFile` с пустой строкой в качестве
`content` (одинокий `\n`). Пустой файл является валидным Codex
rules-файлом.

**Результат:**

`PermissionsOutputFile[]` (массив из одного элемента).

### Пример выходного файла `.codex/rules/agloom.rules`

Для канонического файла из примера выше правило `"*": deny`
пропускается (bare wildcard):

```text
prefix_rule(
    pattern = ["git", "push"],
    decision = "forbidden",
)

prefix_rule(
    pattern = ["./gradlew"],
    decision = "allow",
)

prefix_rule(
    pattern = ["ls"],
    decision = "allow",
)

prefix_rule(
    pattern = ["git", "status"],
    decision = "allow",
)

prefix_rule(
    pattern = ["npm"],
    decision = "prompt",
)
```

Предупреждения в `stderr`:

```text
Warning: Codex does not support per-tool MCP gating in rules file. 'mcp' section ignored. Use Codex config.toml (enabled_tools/disabled_tools) via MCP transpiler.
Warning: Codex does not support file permissions. 'file' section ignored.
Warning: Codex does not support shell pattern '*'. Rule skipped.
```

### Deep merge с существующим .codex/rules/agloom.rules

Файл `.codex/rules/agloom.rules` имеет расширение `.rules`, которое
НЕ входит в список merge-eligible форматов
(см. `docs/specs/layer-model.md` § Merge-eligible форматы). При
конфликте по целевому пути ТРЕБУЕТСЯ применить стратегию override
(полная замена файла). Deep merge НЕ выполняется. Custom AST-merge
для Starlark-подобного синтаксиса Codex `.rules` -- возможная future-
работа (см. § Вне scope).

### Инвариант "MCP > Permissions" для Codex

MCP-транспилер Codex пишет в `.codex/config.toml`
(см. `docs/specs/mcp-transpiler.md` § Codex MCP-адаптер).
Permissions-транспилер Codex пишет в `.codex/rules/agloom.rules`.
Файлы не пересекаются; конфликт перезаписи невозможен.

## Gemini Permissions-адаптер

Адаптер для Gemini CLI. `agentId`: `"gemini"`.

Генерирует файл `.gemini/policies/agloom.toml` в корне проекта.
Файл содержит правила в формате Gemini policy engine
(TOML с массивом `[[rule]]`, см.
[Gemini policy engine reference](https://geminicli.com/docs/reference/policy-engine)).

Gemini policy engine поддерживает секции `shell` (через tool
`run_shell_command`) и `mcp` (через поля `toolName`+`mcpName`).
Секция `file` канонического формата НЕ поддерживается Gemini
policy engine и пропускается с предупреждением.

### Маппинг действий для Gemini

Маппинг действий канонического формата в значения `decision`
Gemini policy engine:

- `allow` → `"allow"`.
- `ask` → `"ask_user"`.
- `deny` → `"deny"`.

### Маппинг приоритета для Gemini

Канонический формат использует **first-match-wins** (первое
совпавшее правило побеждает). Gemini policy engine использует
числовой `priority` (диапазон `0..999`, выигрывает правило с большим
значением). Для массива `rules` длины `N` (где `i` — 0-based индекс
правила в массиве) ТРЕБУЕТСЯ присваивать `priority = 999 - i`.
Таким образом, первое правило получает `priority = 999`, а последнее —
`priority = 999 - N + 1`.

Если суммарное количество эмитируемых правил (shell + mcp, после
пропуска `file` и пропуска wildcard `*:*`) превышает 1000 —
`TransformError("Gemini policy engine supports at most 1000 rules per file (priority overflow). Got {N} rules.")`.

Нумерация `i` ведётся по порядку эмиссии правил в итоговом файле
(сначала shell-правила в каноническом порядке, затем mcp-правила
в каноническом порядке).

### Трансформация shell-правил для Gemini

Каждое shell-правило канонического формата ТРЕБУЕТСЯ преобразовывать
в элемент `[[rule]]` с `toolName = "run_shell_command"` по следующим
правилам:

1. Если паттерн оканчивается на последовательность из одного
   пробела и символа `*` (трейлинг-wildcard) — удалить эти два
   символа и использовать оставшуюся строку как `commandPrefix`.
2. Если паттерн не содержит символа `*` — использовать всю строку
   как `commandPrefix` (prefix match).
3. Если паттерн равен одному символу `*` (bare wildcard) —
   не устанавливать `commandPrefix` и не устанавливать
   `commandRegex` (правило применяется ко всем вызовам
   `run_shell_command`).
4. Если `*` встречается в любой другой позиции, кроме
   трейлинг-wildcard, — преобразовать glob-паттерн в regex
   (каждое вхождение `*` → `.+`, прочие regex-метасимволы
   экранируются как литералы) и использовать результат
   как `commandRegex` с якорями `^` и `$`.

Примеры:

- `"git push *"` → `toolName = "run_shell_command"`, `commandPrefix = "git push"`.
- `"./gradlew *"` → `toolName = "run_shell_command"`, `commandPrefix = "./gradlew"`.
- `"git status"` → `toolName = "run_shell_command"`, `commandPrefix = "git status"`.
- `"*"` → `toolName = "run_shell_command"` (без `commandPrefix`/`commandRegex`).
- `"* --version"` → `toolName = "run_shell_command"`, `commandRegex = "^.+ --version$"`.
- `"git * --version"` → `toolName = "run_shell_command"`, `commandRegex = "^git .+ --version$"`.

### Трансформация MCP-правил для Gemini

Каждое MCP-правило канонического формата `<server>:<tool>`
ТРЕБУЕТСЯ преобразовывать в элемент `[[rule]]` по правилам:

1. Если `tool` не равен `"*"` — установить `toolName = "<tool>"`
   и `mcpName = "<server>"`.
2. Если `tool` равен `"*"` и `server` не равен `"*"` — установить
   только `mcpName = "<server>"` (без `toolName`, правило применяется
   ко всем инструментам сервера).
3. Если `server` равен `"*"` и `tool` равен `"*"` (паттерн `*:*`) —
   пропустить с предупреждением (Gemini policy engine не имеет
   универсального catch-all для MCP; fall-through default-поведение
   обычно покрывает этот случай).

Примеры:

- `"bitbucket:get_pull_request"` → `toolName = "get_pull_request"`, `mcpName = "bitbucket"`.
- `"bitbucket:*"` → `mcpName = "bitbucket"` (без `toolName`).
- `"*:*"` → skip.

### transpile

`geminiPermissionsAdapter.transpile(file)`.

**Вход:**

- `file` (PermissionsCanonicalFile, обязательно) -- канонический файл.

**Поведение:**

1. Создать пустой массив `rules` элементов формата
   `{ toolName?, commandPrefix?, commandRegex?, mcpName?, decision, priority }`.
2. Если `file.content.file` присутствует -- эмитировать предупреждение
   в `stderr`: `"Warning: Gemini policy engine does not support file permissions. 'file' section ignored."`.
3. Если `file.content.shell` присутствует:
   3.0. Применить `dropShadowedRules(file.content.shell, "shell")` →
   `shellFiltered`. Далее итерировать `shellFiltered` в порядке массива:
   3.1. Для каждого правила применить трансформацию shell-паттерна
   (см. "Трансформация shell-правил для Gemini").
   3.2. Применить маппинг действия (см. "Маппинг действий
   для Gemini").
   3.3. Добавить элемент в `rules`.
4. Если `file.content.mcp` присутствует:
   4.0. Применить `dropShadowedRules(file.content.mcp, "mcp")` →
   `mcpFiltered`. Далее итерировать `mcpFiltered` в порядке массива:
   4.1. Для каждого правила применить трансформацию MCP-паттерна
   (см. "Трансформация MCP-правил для Gemini").
   4.2. Если паттерн пропускается (`*:*`) -- эмитировать предупреждение
   в `stderr`: `"Warning: Gemini does not support catch-all MCP pattern '*:*'. Rule skipped."`.
   4.3. Применить маппинг действия.
   4.4. Добавить элемент в `rules`.
5. Проверить, что `rules.length <= 1000`. Если длина больше --
   `TransformError`.
6. Присвоить каждому элементу `rules` поле `priority = 999 - i`
   (где `i` — 0-based индекс в массиве `rules` после всех добавлений).
7. Сериализовать `rules` в TOML-документ с секциями `[[rule]]`,
   по одной на каждый элемент массива.
8. Добавить завершающий перевод строки.
9. Сформировать `PermissionsOutputFile`
   с `relativePath: ".gemini/policies/agloom.toml"`
   и сериализованным `content`.

**Расширения:**

5a. `rules.length > 1000` --
`TransformError("Gemini policy engine supports at most 1000 rules per file (priority overflow). Got {N} rules.")`.

**Результат:**

`PermissionsOutputFile[]` (массив из одного элемента).

### Пример выходного файла `.gemini/policies/agloom.toml`

Для канонического файла из примера выше (`*:*` пропущено):

```toml
[[rule]]
toolName = "run_shell_command"
commandPrefix = "git push"
decision = "deny"
priority = 999

[[rule]]
toolName = "run_shell_command"
commandPrefix = "./gradlew"
decision = "allow"
priority = 998

[[rule]]
toolName = "run_shell_command"
commandPrefix = "ls"
decision = "allow"
priority = 997

[[rule]]
toolName = "run_shell_command"
commandPrefix = "git status"
decision = "allow"
priority = 996

[[rule]]
toolName = "run_shell_command"
commandPrefix = "npm"
decision = "ask_user"
priority = 995

[[rule]]
toolName = "run_shell_command"
decision = "deny"
priority = 994

[[rule]]
toolName = "get_pull_request"
mcpName = "bitbucket"
decision = "allow"
priority = 993

[[rule]]
toolName = "get_build"
mcpName = "jenkins"
decision = "allow"
priority = 992

[[rule]]
mcpName = "bitbucket"
decision = "ask_user"
priority = 991

[[rule]]
mcpName = "jenkins"
decision = "ask_user"
priority = 990
```

### Deep merge с существующим .gemini/policies/agloom.toml

Файл `.gemini/policies/agloom.toml` имеет расширение `.toml`,
которое входит в список merge-eligible форматов
(см. `docs/specs/layer-model.md` § Merge-eligible форматы). Deep
merge TOML-массивов `[[rule]]` выполняется как полная замена массива
(а не объединение элементов). Для сценария данного цикла это
приемлемо: массив `rule` в output-файле полностью формируется
Permissions-транспилером, overlay-слои с дополнительными
`[[rule]]`-элементами в данном цикле не гарантируются.

### Инвариант "MCP > Permissions" для Gemini

MCP-транспилер Gemini пишет в `.gemini/settings.json`
(см. `docs/specs/mcp-transpiler.md` § Gemini MCP-адаптер).
Permissions-транспилер Gemini пишет в `.gemini/policies/agloom.toml`.
Файлы не пересекаются; конфликт перезаписи невозможен.

## Kilocode Permissions-адаптер

Адаптер для Kilocode. `agentId`: `"kilocode"`.

Генерирует файл `kilo.jsonc` в корне проекта. Файл является единым
конфигурационным файлом Kilocode и содержит одновременно MCP-блок
(`mcpServers`), записываемый MCP-транспилером, и блок `permission`,
записываемый Permissions-транспилером. Слияние выполняется через
deep merge layer model.

Содержимое, эмитируемое Permissions-адаптером, ТРЕБУЕТСЯ записывать
как чистый JSON (без JSONC-комментариев), симметрично MCP-адаптеру
(см. `docs/specs/mcp-transpiler.md` § Kilocode MCP-адаптер).

Kilocode поддерживает все три секции канонического формата:
`shell` (ключ `bash`), `mcp` (flat-ключи `<server>_<tool>`),
`file` (три категории: `read`, `edit`, `write`).

Kilocode использует семантику **last-match-wins** для path-паттернов.
При транспиляции ТРЕБУЕТСЯ инвертировать порядок массивов правил
(аналогично OpenCode), чтобы сохранить эквивалентную семантику
канонического first-match-wins.

Перед инверсией массивов ТРЕБУЕТСЯ применять `dropShadowedRules`
(см. § Общий препроцессинг правил). Процедура
`flattenWhitelistConflicts` НЕ применяется, поскольку Kilocode
last-match-wins после инверсии эквивалентен canonical first-match-wins.

Permissions-транспилер Kilocode является единственным источником
permission gating для Kilocode: MCP-транспилер Kilocode после
разведения MCP и permissions (см. `docs/specs/mcp-transpiler.md`
§ Kilocode MCP-адаптер) НЕ эмитирует `alwaysAllow` в per-entry
конфигурации `mcpServers`. Обязанность по эмиссии `alwaysAllow`
передана Permissions-транспилеру.

### Маппинг действий для Kilocode (shell, mcp)

Маппинг действий канонического формата в значения Kilocode для
секций `shell` и `mcp`:

- `allow` → `"allow"`.
- `ask` → `"ask"`.
- `deny` → `"deny"`.

### Трансформация shell-правил для Kilocode

Shell-правила эмитируются как пары `<pattern>: <action>` в объекте
`permission.bash`. Паттерны передаются as-is (Kilocode поддерживает
нативные glob-символы `*` и `?`). Массив shell-правил инвертируется
(`reverse`) перед эмиссией в объект.

### Трансформация MCP-правил для Kilocode

MCP-правила эмитируются в двух местах:

1. **Flat-ключи в объекте `permission`** -- `<server>_<tool>: "allow" | "ask" | "deny"`.
   Разделитель `:` заменяется на `_`. Массив MCP-правил инвертируется
   (`reverse`) перед эмиссией. Применяется ко всем правилам независимо
   от действия.
2. **Per-server `alwaysAllow`** в блоке `mcpServers.<server>` --
   массив имён инструментов, автоматически одобряемых без запроса.
   Эмитируется только для правил с действием `allow` и только
   для паттернов вида `<server>:<tool>` с конкретным `tool`
   (не wildcard). Эмиссия выполняется через deep merge с блоком
   `mcpServers`, записанным MCP-транспилером (см. § Deep merge
   с существующим kilo.jsonc).

Flat-ключи ТРЕБУЕТСЯ эмитировать для всех правил; `alwaysAllow`
ТРЕБУЕТСЯ эмитировать дополнительно только для `allow`-правил
с конкретным инструментом.

**Правила эмиссии `alwaysAllow`:**

- Паттерн `<server>:<tool>` с действием `allow`, где `<tool>` НЕ равно
  `"*"` -- добавить `<tool>` в массив `mcpServers[<server>].alwaysAllow`.
- Паттерн `<server>:*` с действием `allow` (bulk allow) -- пропустить
  с предупреждением: `"Warning: Kilocode 'alwaysAllow' requires concrete tool names; bulk allow pattern '<server>:*' cannot be expanded (tool set of the server is not known at transpile time). Flat permission key '<server>_*' emitted; per-tool alwaysAllow not populated."`.
- Паттерн `*:*` с действием `allow` -- пропустить с предупреждением
  (аналогично).
- Правила с действиями `ask` / `deny` -- в `alwaysAllow` не попадают
  (семантически соответствует отсутствию в списке авто-одобрения).

Примеры flat-ключей:

- `"bitbucket:get_pull_request"` → `"bitbucket_get_pull_request"`.
- `"bitbucket:*"` → `"bitbucket_*"`.
- `"*:*"` → `"*_*"`.

Примеры `alwaysAllow`:

- `"bitbucket:get_pull_request": allow` → `mcpServers.bitbucket.alwaysAllow += ["get_pull_request"]`.
- `"bitbucket:*": allow` → skip (с предупреждением).
- `"bitbucket:get_pull_request": deny` → `alwaysAllow` не меняется.

### Трансформация file-правил для Kilocode

Kilocode разделяет file-permissions на три независимые категории:
`read`, `edit`, `write`. Каждая категория — объект, где ключ —
glob-паттерн пути, значение — `"allow"` / `"ask"` / `"deny"`.

Канонические file-действия раскрываются в три категории Kilocode
по следующей таблице:

| canonical | `permission.read[pattern]` | `permission.edit[pattern]` | `permission.write[pattern]` |
| --------- | -------------------------- | -------------------------- | --------------------------- |
| `deny`    | `"deny"`                   | `"deny"`                   | `"deny"`                    |
| `read`    | `"allow"`                  | `"deny"`                   | `"deny"`                    |
| `write`   | `"allow"`                  | `"allow"`                  | `"allow"`                   |

Массив file-правил инвертируется (`reverse`) перед эмиссией
в каждую из трёх категорий.

### transpile

`kilocodePermissionsAdapter.transpile(file)`.

**Вход:**

- `file` (PermissionsCanonicalFile, обязательно) -- канонический файл.

**Поведение:**

1. Создать пустой объект `permission` и пустой объект `mcpServers`
   (будет содержать только per-server `alwaysAllow`-записи).
2. Если `file.content.mcp` присутствует:
   2.1. Применить `dropShadowedRules(file.content.mcp, "mcp")` →
   `mcpFiltered`.
   2.2. Для каждого правила в `mcpFiltered` (в каноническом порядке)
   с действием `allow` и конкретным `<tool>` (не `*`) --
   добавить `<tool>` в `mcpServers[<server>].alwaysAllow`
   (создавая массив при первом добавлении, не допуская дубликатов).
   Для `<server>:*` с `allow` или `*:*` с `allow` -- эмитировать
   предупреждение (см. § Трансформация MCP-правил для Kilocode)
   и не добавлять в `alwaysAllow`.
   2.3. Развернуть массив `mcpFiltered` (`reverse`).
   2.4. Для каждого правила в развёрнутом массиве -- трансформировать
   паттерн в flat-ключ (см. "Трансформация MCP-правил для Kilocode")
   и действие (см. "Маппинг действий для Kilocode") и добавить
   в `permission` как ключ-значение.
3. Если `file.content.shell` присутствует:
   3.1. Применить `dropShadowedRules(file.content.shell, "shell")` →
   `shellFiltered`.
   3.2. Развернуть массив `shellFiltered` (`reverse`).
   3.3. Создать объект `bash`.
   3.4. Для каждого правила передать паттерн as-is, применить
   маппинг действия и добавить в `bash` как ключ-значение.
   3.5. Добавить `bash` в `permission`.
4. Если `file.content.file` присутствует:
   4.1. Применить `dropShadowedRules(file.content.file, "file")` →
   `fileFiltered`.
   4.2. Развернуть массив `fileFiltered` (`reverse`).
   4.3. Создать объекты `read`, `edit`, `write` (все пустые).
   4.4. Для каждого правила применить маппинг категорий
   (см. "Трансформация file-правил для Kilocode") и добавить
   соответствующие значения в `read`, `edit`, `write`.
   4.5. Добавить `read`, `edit`, `write` в `permission`.
5. Сформировать объект `output`: корневой объект с ключом
   `"permission"` (содержащим `permission`) и, если `mcpServers`
   не пуст, с ключом `"mcpServers"` (содержащим `mcpServers`).
6. Сериализовать `output` в JSON с отступом 2 пробела
   и завершающим переводом строки.
7. Сформировать `PermissionsOutputFile`
   с `relativePath: "kilo.jsonc"`.

**Расширения:**

Нет расширений.

**Результат:**

`PermissionsOutputFile[]` (массив из одного элемента).

### Пример выходного файла `kilo.jsonc` (Permissions-слой)

Permissions-адаптер эмитирует блок `permission` и (опционально)
фрагмент `mcpServers` с полями `alwaysAllow` для server entries.
Остальная часть `mcpServers` (поля `type`, `command`, `args`, `env`,
`url`, `headers`, `disabled` и т.п.) записывается MCP-транспилером
(см. `docs/specs/mcp-transpiler.md` § Kilocode MCP-адаптер)
и сохраняется при deep merge.

Для канонического файла из примера выше Permissions-адаптер эмитирует:

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
    "read": {
      "src/**": "allow",
      "src/**/*.ts": "allow",
      "**/.env": "deny"
    },
    "edit": {
      "src/**": "deny",
      "src/**/*.ts": "allow",
      "**/.env": "deny"
    },
    "write": {
      "src/**": "deny",
      "src/**/*.ts": "allow",
      "**/.env": "deny"
    }
  },
  "mcpServers": {
    "bitbucket": {
      "alwaysAllow": ["get_pull_request"]
    },
    "jenkins": {
      "alwaysAllow": ["get_build"]
    }
  }
}
```

Предупреждения в `stderr` для bulk-wildcard правил с действием `allow`
(в данном примере правил `bitbucket:*` и `jenkins:*` действие `ask`,
поэтому предупреждения не эмитируются; правило `*:*: deny` в
`alwaysAllow` не попадает по определению).

После deep merge с MCP-слоем (записанным раньше в том же файле)
итоговый `kilo.jsonc` содержит top-level ключи `$schema`, `mcpServers`
(с полным составом полей сервера включая `alwaysAllow`), `permission`.

### Deep merge с существующим kilo.jsonc

Файл `kilo.jsonc` имеет расширение `.jsonc`, которое входит в список
merge-eligible форматов (см. `docs/specs/layer-model.md`
§ Merge-eligible форматы). При конфликте по целевому пути ТРЕБУЕТСЯ
применить deep merge в соответствии с `docs/specs/layer-model.md`
§ Алгоритм deep merge.

### Координация с MCP-транспилером Kilocode

Файл `kilo.jsonc` является общим для MCP- и Permissions-транспилеров
Kilocode. MCP-транспилер записывает top-level ключи `$schema`
и `mcpServers.<server>` с полями конфигурации серверов (см.
`docs/specs/mcp-transpiler.md` § Kilocode MCP-адаптер) и НЕ
эмитирует поле `alwaysAllow` ни в одном server entry.
Permissions-транспилер записывает top-level ключ `permission`
и, дополнительно, поле `mcpServers.<server>.alwaysAllow` в тех же
server entries, которые ранее создал MCP-транспилер.

Пересечение по ключу `mcpServers` разрешается через deep merge
(см. `docs/specs/layer-model.md` § Алгоритм deep merge): MCP-транспилер
эмитирует `mcpServers.<server>` без поля `alwaysAllow`, Permissions-
транспилер эмитирует `mcpServers.<server>.alwaysAllow`, результатом
deep merge является union ключей в каждом server entry. Конфликт
перезаписи ключа `alwaysAllow` невозможен, поскольку MCP-транспилер
это поле не эмитирует.

Если Permissions-транспилер эмитирует `alwaysAllow` для server,
которого нет в `mcpServers` (canonical `permissions.yml` ссылается
на server, отсутствующий в canonical `mcp.yml`), server entry
создаётся только с полем `alwaysAllow`. Валидация существования
сервера в MCP-конфигурации вне scope данной спецификации
(см. § Вне scope).

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
| `"codex"`    | `CodexPermissionsAdapter`    |
| `"gemini"`   | `GeminiPermissionsAdapter`   |
| `"kilocode"` | `KilocodePermissionsAdapter` |
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

- Адаптеры для Cursor, Copilot.
- `${values:*}` интерполяция в permissions.
- Per-agent permissions (permissions, привязанные к конкретному агенту
  внутри проекта) -- только project-level.
- Валидация существования MCP-серверов, указанных в MCP-правилах
  (включая случай, когда Kilocode `alwaysAllow` эмитируется для server,
  отсутствующего в канонической MCP-конфигурации).
- Wildcard-расширение паттернов (паттерны передаются адаптерам as-is,
  без glob-expansion). В частности, Kilocode `alwaysAllow` не
  поддерживает bulk-allow для `<server>:*` -- правила с таким паттерном
  пропускаются с предупреждением.
- Автоматическая миграция со старого формата (группировка по действиям)
  на новый (ordered list).
- Custom AST-merge для Codex `.rules`-файлов -- файл использует
  override-стратегию. Парсинг Starlark-подобного синтаксиса и
  структурное слияние правил -- возможная future-работа.
- Автоматическое детектирование Codex `approval_policy` из `config.toml`
  для проверки catch-all семантики. Пользователь самостоятельно
  конфигурирует `approval_policy` как глобальный fallback для команд,
  не покрытых явными `prefix_rule` правилами.
- Разрешение конфликтов между canonical first-match-wins и
  decision-severity-wins движков **за пределами** whitelist-паттерна
  (узкий allow + широкий deny). Сценарий с широким deny и узкими
  allow-исключениями НЕ поддерживается препроцессингом
  `flattenWhitelistConflicts` -- см. § Ограничения подхода.
