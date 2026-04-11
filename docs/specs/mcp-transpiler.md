---
summary: MCP Transpiler — библиотека транспиляции MCP-конфигурации из .agloom/ в agent-specific файлы
description: >
  Библиотека для транспиляции канонической MCP-конфигурации (.agloom/mcp.yml
  или .agloom/mcp.json) в agent-specific MCP-файлы. Поддерживает stdio,
  HTTP и SSE транспорты. Генерирует .mcp.json для Claude Code,
  opencode.json для OpenCode, .codex/config.toml для Codex,
  .gemini/settings.json для Gemini, kilo.jsonc для Kilocode.
  Канонические includeTools/excludeTools транспилируются только
  адаптерами с нативной discovery-level фильтрацией (Codex, Gemini);
  для остальных адаптеров игнорируются с предупреждением. Расширяется
  через адаптеры.
type: spec
status: implemented
relates:
  - docs/specs/instructions-transpiler.md
  - docs/specs/skills-transpiler.md
  - docs/specs/agents-transpiler.md
  - docs/specs/cli.md
  - docs/specs/adapter-registry-ext.md
  - docs/specs/layer-model.md
  - docs/specs/provider-overlay.md
  - docs/specs/interpolation.md
  - docs/specs/config.md
  - docs/specs/plugin-manifest.md
  - docs/specs/permissions-transpiler.md
maps_to:
  - src/mcp-transpiler/
---

# MCP Transpiler

Ключевые слова "ТРЕБУЕТСЯ", "ЗАПРЕЩАЕТСЯ", "ДОЛЖЕН", "НЕ ДОЛЖЕН", "СЛЕДУЕТ",
"НЕ СЛЕДУЕТ", "МОЖЕТ" и "НЕОБЯЗАТЕЛЬНО" в этом документе толкуются
в соответствии с [RFC 2119](https://tools.ietf.org/html/rfc2119).

Библиотека для транспиляции канонической MCP-конфигурации в agent-specific
MCP-файлы. Канонический файл (`.agloom/mcp.yml` или `.agloom/mcp.json`)
является единственным источником истины; agent-specific файлы -- производные
артефакты, генерируемые при каждом запуске транспиляции.

Архитектура аналогична `instructions-transpiler`
(см. `docs/specs/instructions-transpiler.md`): factory function, адаптеры,
обнаружение, запись результатов. MCP-транспилер является 4-м транспилером
в пайплайне после Instructions, Skills, Agents.

## Канонический формат

Каноническая MCP-конфигурация -- файл `.agloom/mcp.yml` (YAML)
или `.agloom/mcp.json` (JSON) в корне директории `.agloom/`.
Оба формата валидны. При наличии обоих файлов одновременно --
ошибка (см. "Обнаружение канонического файла", расширение 3a).

### Структура канонического файла

Корневой объект ДОЛЖЕН содержать поле `mcpServers` -- объект,
где каждый ключ является идентификатором MCP-сервера,
а значение -- объект конфигурации сервера.

- `mcpServers` (Record\<string, McpServerConfig>, обязательно) --
  конфигурация MCP-серверов.

### Тип McpServerConfig

Транспорт MCP-сервера определяется полем `type`. Поддерживаются три
значения: `"stdio"` (по умолчанию) -- локальный процесс, `"http"` --
удалённый сервер поверх HTTP streaming, `"sse"` -- удалённый сервер
поверх Server-Sent Events.

Общие поля:

- `type` (string: "stdio" | "http" | "sse", опционально, default:
  `"stdio"`) -- транспорт MCP-сервера.
- `includeTools` (array\<string>, опционально) -- whitelist инструментов.
  При наличии -- только перечисленные инструменты доступны.
- `excludeTools` (array\<string>, опционально) -- blacklist инструментов.
  При наличии -- перечисленные инструменты исключаются.

Поля для транспорта `stdio`:

- `command` (string, обязательно) -- команда запуска MCP-сервера.
- `args` (array\<string>, опционально, default: `[]`) -- аргументы
  команды.
- `env` (Record\<string, string>, опционально, default: `{}`) --
  переменные окружения для процесса MCP-сервера.

Поля для транспортов `http` и `sse`:

- `url` (string, обязательно) -- URL удалённого MCP-сервера.
- `headers` (Record\<string, string>, опционально, default: `{}`) --
  HTTP-заголовки, передаваемые при подключении.

### Семантика `includeTools` / `excludeTools`

Поля `includeTools` / `excludeTools` описывают **discovery-level tool
filtering** -- whitelist или blacklist инструментов, которые MCP-клиент
ТРЕБУЕТСЯ advertise модели (или скрыть от неё) на стадии инициализации
connection. Отфильтрованные инструменты не попадают в контекст модели
и не могут быть вызваны.

Discovery-level filtering ЗАПРЕЩАЕТСЯ путать с **postfactum permission
gating** -- runtime-решением `allow` / `ask` / `deny` на каждый
вызов инструмента, описанным в `docs/specs/permissions-transpiler.md`.
Это два разных механизма: первый действует до того, как модель увидит
инструмент; второй -- при попытке вызова уже видимого инструмента.

Поскольку не все MCP-клиенты поддерживают нативную discovery-level
фильтрацию, канонические `includeTools` / `excludeTools` применяются
только теми адаптерами, чей целевой формат имеет соответствующие поля:

- **Codex** -- через `enabled_tools` / `disabled_tools`
  в `.codex/config.toml` (см. § Codex MCP-адаптер).
- **Gemini** -- через нативные `includeTools` / `excludeTools`
  в `.gemini/settings.json` (см. § Gemini MCP-адаптер).

Для остальных адаптеров (**Claude**, **OpenCode**, **Kilocode**)
каноническое указание `includeTools` / `excludeTools` ТРЕБУЕТСЯ
игнорировать с предупреждением в `stderr` (см. соответствующие
секции адаптеров). Канонический формат ЗАПРЕЩАЕТСЯ валидировать
как ошибку: пользователь МОЖЕТ рассматривать `.agloom/mcp.yml`
как кросс-адаптерный файл и ожидать, что каждый адаптер применит
поле по возможности.

### Правила взаимной исключительности полей

Для одного MCP-сервера ТРЕБУЕТСЯ соблюдать следующие ограничения:

1. При `type: "stdio"` (включая случай, когда поле `type` не указано)
   поле `command` является обязательным; поля `url` и `headers`
   ЗАПРЕЩЕНЫ.
2. При `type: "http"` или `type: "sse"` поле `url` является
   обязательным; поля `command`, `args`, `env` ЗАПРЕЩЕНЫ.
3. Поля `includeTools` и `excludeTools` являются взаимоисключающими
   для одного MCP-сервера. При наличии обоих -- ошибка валидации
   (см. "Валидация канонического файла", расширение 3a). Оба поля
   разрешены для любого значения `type`.

### Пример канонического файла (YAML)

```yaml
mcpServers:
  context7:
    command: npx
    args: ["-y", "@upstash/context7-mcp@latest"]
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem"]
    env:
      ROOT_DIR: "${env:PROJECT_ROOT}"
    includeTools:
      - read_file
      - list_directory
  figma:
    type: http
    url: https://mcp.figma.com/mcp
    headers:
      X-Figma-Region: us-east-1
    excludeTools:
      - delete
  asana:
    type: sse
    url: https://mcp.asana.com/sse
    headers:
      Authorization: "Bearer ${env:ASANA_TOKEN}"
```

### Пример канонического файла (JSON)

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    },
    "figma": {
      "type": "http",
      "url": "https://mcp.figma.com/mcp",
      "headers": { "X-Figma-Region": "us-east-1" }
    }
  }
}
```

## Типы данных

### McpCanonicalFile

Результат обнаружения канонического файла.

- `relativePath` (string) -- путь файла относительно `projectRoot`.
- `format` (string: "yaml" | "json") -- формат файла.
- `content` (McpCanonicalContent) -- распарсенное содержимое.

### McpCanonicalContent

Распарсенное содержимое канонического файла.

- `mcpServers` (Record\<string, McpServerConfig>) -- конфигурация
  MCP-серверов.

### McpOutputFile

Результат трансформации для одного адаптера.

- `relativePath` (string) -- путь файла относительно `projectRoot`.
- `content` (string) -- сериализованное содержимое файла.

## Инициализация

`createMcpTranspiler(config)`.

**Вход:**

- `config` (object, обязательно) -- конфигурация транспилера.
  - `projectRoot` (string, обязательно) -- абсолютный путь к корню проекта.
  - `adapters` (array\<McpAdapter>, обязательно) -- массив адаптеров
    для целевых агентов.

**Поведение:**

1. Валидировать, что `projectRoot` является абсолютным путём.
2. Валидировать, что массив `adapters` содержит хотя бы один элемент.
3. Валидировать, что все элементы `adapters` реализуют интерфейс
   `McpAdapter` (см. "Интерфейс адаптера").
4. Валидировать, что значения `agentId` всех адаптеров уникальны.
5. Сохранить конфигурацию в экземпляре.

**Расширения:**

1a. `projectRoot` не является абсолютным путём --
`ConfigError("projectRoot must be an absolute path")`.

2a. Массив `adapters` пуст --
`ConfigError("At least one adapter is required")`.

3a. Элемент `adapters` не реализует интерфейс `McpAdapter` --
`ConfigError("Adapter at index {i} does not implement McpAdapter interface")`.

4a. Обнаружены адаптеры с одинаковым `agentId` --
`ConfigError("Duplicate agentId: {id}")`.

**Результат:**

Экземпляр `McpTranspiler`.

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
3. Для всех string-значений полей `command`, `args`, `env`, `url`,
   `headers` каждого сервера в `mcpServers` ТРЕБУЕТСЯ выполнить
   интерполяцию переменных (см. § Интерполяция переменных) до момента
   записи файла в файловую систему. Конкретный этап pipeline, на котором
   выполняется интерполяция, является деталью реализации.
4. Для каждого зарегистрированного адаптера вызвать
   `adapter.transpile(canonicalFile)`.
5. Собрать результаты всех адаптеров в единый массив `TranspileResult`.

**Расширения:**

1a. Канонический файл не обнаружен --
вернуть пустой массив `TranspileResult[]` (не является ошибкой).

1b. `discover()` выбрасывает `DiscoverError` -- пробросить
к вызывающему коду.

2a. Валидация выбрасывает `TransformError` -- пробросить
к вызывающему коду.

3a. `interpolate` выбрасывает `InterpolationError` -- пробросить
к вызывающему коду.

4a. Адаптер выбрасывает исключение -- создать `TranspileResult`
с `agentId` адаптера, пустым массивом `files` и одним элементом
в `errors` (`TranspileError` с указанием `agentId` и исходной ошибки);
продолжить выполнение остальных адаптеров.

**Результат:**

`TranspileResult[]`.

- `agentId` (string) -- идентификатор агента.
- `files` (array\<McpOutputFile>) -- список сгенерированных файлов.
- `errors` (array\<TranspileError>) -- ошибки, возникшие при транспиляции
  данного адаптера.
  - `agentId` (string) -- идентификатор адаптера.
  - `message` (string) -- описание ошибки.
  - `cause` (Error) -- исходное исключение адаптера.

## Обнаружение канонического файла

`transpiler.discover()` -- обнаруживает канонический MCP-файл в проекте.

**Вход:**

Нет входных параметров.

**Поведение:**

1. Проверить наличие файла `.agloom/mcp.yml` в `projectRoot`.
2. Проверить наличие файла `.agloom/mcp.json` в `projectRoot`.
3. Определить, какой файл использовать.
4. Прочитать содержимое обнаруженного файла.
5. Распарсить содержимое в соответствии с форматом
   (YAML для `.yml`, JSON для `.json`).
6. Сформировать `McpCanonicalFile`.

**Расширения:**

1a. Файл `.agloom/mcp.yml` не существует -- продолжить с шагом 2.

2a. Файл `.agloom/mcp.json` не существует -- продолжить с шагом 3.

3a. Оба файла (`.agloom/mcp.yml` и `.agloom/mcp.json`) существуют --
`DiscoverError("Both .agloom/mcp.yml and .agloom/mcp.json exist. Remove one to resolve the conflict.")`.

3b. Ни один файл не обнаружен -- вернуть `null`.

4a. Ошибка чтения файла (EACCES, файл удалён между обнаружением
и чтением) --
`DiscoverError("Failed to read {relativePath}: {причина}")`.

5a. Ошибка парсинга YAML --
`DiscoverError("Failed to parse .agloom/mcp.yml: {причина}")`.

5b. Ошибка парсинга JSON --
`DiscoverError("Failed to parse .agloom/mcp.json: {причина}")`.

**Результат:**

`McpCanonicalFile | null`.

## Валидация канонического файла

`validateCanonicalContent(content)` -- валидирует распарсенное содержимое
канонического файла.

**Вход:**

- `content` (object, обязательно) -- распарсенное содержимое файла.

**Поведение:**

1. Проверить, что `content` является объектом.
2. Проверить наличие поля `mcpServers` и что его значение
   является объектом.
3. Для каждого MCP-сервера в `mcpServers` валидировать конфигурацию:
   3.1. Определить значение поля `type`. Если поле отсутствует --
   использовать значение по умолчанию `"stdio"`. Если поле присутствует,
   но его значение не входит в множество `{"stdio", "http", "sse"}` --
   ошибка.
   3.2. Если `type = "stdio"`: проверить наличие обязательного поля
   `command` (string). Если поле `args` присутствует -- проверить,
   что значение является массивом строк. Если поле `env` присутствует --
   проверить, что значение является объектом с string-значениями.
   Проверить, что поля `url` и `headers` отсутствуют.
   3.3. Если `type = "http"` или `type = "sse"`: проверить наличие
   обязательного поля `url` (string). Если поле `headers` присутствует --
   проверить, что значение является объектом с string-значениями.
   Проверить, что поля `command`, `args`, `env` отсутствуют.
   3.4. Если поле `includeTools` присутствует -- проверить,
   что значение является массивом строк.
   3.5. Если поле `excludeTools` присутствует -- проверить,
   что значение является массивом строк.
   3.6. Проверить, что `includeTools` и `excludeTools` не указаны
   одновременно.

**Расширения:**

1a. `content` не является объектом --
`TransformError("MCP config must be an object")`.

2a. Поле `mcpServers` отсутствует --
`TransformError("MCP config must contain 'mcpServers' field")`.

2b. Значение `mcpServers` не является объектом --
`TransformError("'mcpServers' must be an object")`.

3.1a. Значение `type` не входит в множество `{"stdio", "http", "sse"}` --
`TransformError("Server '{serverId}': 'type' must be one of 'stdio', 'http', 'sse'")`.

3.2a. При `type = "stdio"` поле `command` отсутствует или не является
строкой --
`TransformError("Server '{serverId}': 'command' is required for stdio transport and must be a string")`.

3.2b. При `type = "stdio"` поле `args` присутствует, но не является
массивом строк --
`TransformError("Server '{serverId}': 'args' must be an array of strings")`.

3.2c. При `type = "stdio"` поле `env` присутствует, но не является
объектом с string-значениями --
`TransformError("Server '{serverId}': 'env' must be an object with string values")`.

3.2d. При `type = "stdio"` присутствует поле `url` или `headers` --
`TransformError("Server '{serverId}': 'url' and 'headers' are not allowed for stdio transport")`.

3.3a. При `type = "http"` или `type = "sse"` поле `url` отсутствует
или не является строкой --
`TransformError("Server '{serverId}': 'url' is required for {type} transport and must be a string")`.

3.3b. При `type = "http"` или `type = "sse"` поле `headers`
присутствует, но не является объектом с string-значениями --
`TransformError("Server '{serverId}': 'headers' must be an object with string values")`.

3.3c. При `type = "http"` или `type = "sse"` присутствует поле
`command`, `args` или `env` --
`TransformError("Server '{serverId}': 'command', 'args', 'env' are not allowed for {type} transport")`.

3.4a. Поле `includeTools` присутствует, но не является массивом строк --
`TransformError("Server '{serverId}': 'includeTools' must be an array of strings")`.

3.5a. Поле `excludeTools` присутствует, но не является массивом строк --
`TransformError("Server '{serverId}': 'excludeTools' must be an array of strings")`.

3.6a. Поля `includeTools` и `excludeTools` указаны одновременно
для сервера --
`TransformError("Server '{serverId}': 'includeTools' and 'excludeTools' are mutually exclusive")`.

**Результат:**

`McpCanonicalContent` -- валидированное содержимое.

## Интерфейс адаптера

Каждый MCP-адаптер ДОЛЖЕН реализовать следующий интерфейс:

- `agentId` (string, readonly) -- уникальный идентификатор агента
  (`"claude"`, `"opencode"`, `"codex"`, `"gemini"`, `"kilocode"`).
- `transpile(file)` -- метод транспиляции (см. ниже).

### transpile

`adapter.transpile(file)` -- генерирует agent-specific MCP-файл
из канонического файла.

**Вход:**

- `file` (McpCanonicalFile, обязательно) -- канонический файл.

**Поведение:**

Определяется конкретным адаптером (см. "Claude Code MCP-адаптер",
"OpenCode MCP-адаптер").

**Расширения:**

Определяются конкретным адаптером.

**Результат:**

`McpOutputFile[]`.

## Процедура Build Stdio Server Config

Общая процедура построения stdio-конфигурации MCP-сервера из
канонического формата. Переиспользуется всеми адаптерами,
поддерживающими stdio-транспорт.

**Вход:**

- `serverConfig` (McpServerConfig, обязательно) -- конфигурация
  сервера из канонического файла. Предполагается, что
  `serverConfig.type` равно `"stdio"` (или опущено).
- `supportsToolFiltering` (boolean, обязательно) -- флаг, определяющий,
  поддерживает ли целевой формат native-поля фильтрации инструментов.

**Поведение:**

1. Создать объект `base` с полем `command` из `serverConfig.command`.
2. Если поле `args` присутствует и непусто -- добавить поле `args`
   в `base`.
3. Если поле `env` присутствует и непусто -- добавить поле `env`
   в `base`.
4. Если `supportsToolFiltering` равен `false` -- поля `includeTools`
   и `excludeTools` ТРЕБУЕТСЯ отбросить (не добавлять в `base`).
   Native-поля фильтрации записываются обёртывающим адаптером
   отдельно (с его собственным именованием ключей).
5. Если `supportsToolFiltering` равен `true` -- значения
   `serverConfig.includeTools` и `serverConfig.excludeTools` ТРЕБУЕТСЯ
   передать обёртывающему адаптеру как есть, чтобы тот обернул их
   в нативные имена полей.

**Расширения:**

Нет расширений.

**Результат:**

- `base` (object) -- объект с полями `command` и опциональными
  `args`, `env`.

## Процедура Build Remote Server Config

Общая процедура построения remote-конфигурации MCP-сервера
(HTTP или SSE) из канонического формата. Переиспользуется всеми
адаптерами, поддерживающими удалённый транспорт.

**Вход:**

- `serverConfig` (McpServerConfig, обязательно) -- конфигурация
  сервера из канонического файла. Предполагается, что
  `serverConfig.type` равно `"http"` или `"sse"`.

**Поведение:**

1. Создать объект `base` с полем `url` из `serverConfig.url`.
2. Если поле `headers` присутствует и непусто -- добавить поле
   `headers` в `base`.
3. Значения `serverConfig.includeTools` и `serverConfig.excludeTools`
   ТРЕБУЕТСЯ передать обёртывающему адаптеру как есть. Оборачивание
   в нативные имена полей выполняется адаптером.

**Расширения:**

Нет расширений.

**Результат:**

- `base` (object) -- объект с полем `url` и опциональным `headers`.

## Claude Code MCP-адаптер

Адаптер для Claude Code. `agentId`: `"claude"`.

Claude Code MCP-адаптер генерирует **единственный** выходной файл
`.mcp.json` в корне проекта -- объект с полем `mcpServers`,
описывающий MCP-серверы.

Для `.mcp.json` публичная JSON-схема отсутствует -- поле `$schema`
в этот файл НЕ добавляется.

Claude Code не имеет нативной discovery-level фильтрации инструментов,
поэтому канонические поля `includeTools` / `excludeTools`
данным адаптером не обрабатываются (см. ниже § Обработка
includeTools/excludeTools).

### Маппинг транспортов

Поле `type` канонического файла отображается в поле `type`
`.mcp.json` без изменения значения. Поле `type` ТРЕБУЕТСЯ записывать
**явно** для всех транспортов, включая `"stdio"`:

| canonical `type` | `.mcp.json` entry                                                    |
| ---------------- | -------------------------------------------------------------------- |
| `"stdio"`        | `{ "type": "stdio", "command": "...", "args": [...], "env": {...} }` |
| `"http"`         | `{ "type": "http", "url": "...", "headers": {...} }`                 |
| `"sse"`          | `{ "type": "sse", "url": "...", "headers": {...} }`                  |

### Обработка `includeTools` / `excludeTools`

Claude Code не поддерживает discovery-level tool filtering: эмитировать
канонические `includeTools` / `excludeTools` в какое-либо нативное поле
`.mcp.json` невозможно. ЗАПРЕЩАЕТСЯ транспилировать эти поля
в permission-записи (permissions являются postfactum gating, что
семантически не эквивалентно discovery filtering).

При обнаружении непустого `includeTools` или `excludeTools` у сервера
в каноническом файле адаптер ТРЕБУЕТСЯ эмитировать предупреждение
в `stderr` вида:

```text
Warning: Claude Code does not support discovery-level tool filtering. Server '{serverId}': 'includeTools'/'excludeTools' ignored. Use .agloom/permissions.yml for postfactum permission gating.
```

После эмиссии предупреждения поля ТРЕБУЕТСЯ игнорировать; entry
сервера в `.mcp.json` формируется без них.

### transpile

`claudeMcpAdapter.transpile(file)`.

**Вход:**

- `file` (McpCanonicalFile, обязательно) -- канонический файл.

**Поведение:**

1. Создать пустой объект `mcpServers` -- будущее содержимое `.mcp.json`.
2. Для каждого сервера `<server>` в `file.content.mcpServers`:
   2.1. Если `serverConfig.type` равен `"stdio"` (или опущено) --
   выполнить процедуру Build Stdio Server Config с
   `supportsToolFiltering = false`; добавить поле `type: "stdio"`
   в результат; сохранить как entry `mcpServers[<server>]`.
   2.2. Если `serverConfig.type` равен `"http"` -- выполнить процедуру
   Build Remote Server Config; добавить поле `type: "http"` в результат;
   сохранить как entry `mcpServers[<server>]`.
   2.3. Если `serverConfig.type` равен `"sse"` -- выполнить процедуру
   Build Remote Server Config; добавить поле `type: "sse"` в результат;
   сохранить как entry `mcpServers[<server>]`.
   2.4. Если `serverConfig.includeTools` или `serverConfig.excludeTools`
   присутствует и непусто -- эмитировать предупреждение в `stderr`
   (см. § Обработка includeTools/excludeTools) и игнорировать поля.
3. Сформировать объект `mcpOutput` с ключом `"mcpServers"`, содержащим
   `mcpServers`. Сериализовать `mcpOutput` в JSON с отступом 2 пробела
   и завершающим переводом строки.
4. Сформировать `McpOutputFile` с `relativePath: ".mcp.json"`.

**Расширения:**

2.4a. См. основной шаг (warn+ignore для `includeTools` /
`excludeTools`).

**Результат:**

`McpOutputFile[]` (массив из одного элемента).

### Deep merge с существующим `.mcp.json`

Файл `.mcp.json` является merge-eligible (`.json`). При наличии
существующего файла по целевому пути (от overlay, плагина
или предыдущего шага) ТРЕБУЕТСЯ применить deep merge в соответствии
с `docs/specs/layer-model.md` § Алгоритм deep merge.

### Пример выходного файла `.mcp.json`

```json
{
  "mcpServers": {
    "context7": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    },
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem"],
      "env": {
        "ROOT_DIR": "/home/user/project"
      }
    },
    "figma": {
      "type": "http",
      "url": "https://mcp.figma.com/mcp",
      "headers": { "X-Figma-Region": "us-east-1" }
    },
    "asana": {
      "type": "sse",
      "url": "https://mcp.asana.com/sse",
      "headers": { "Authorization": "Bearer ..." }
    }
  }
}
```

## OpenCode MCP-адаптер

Адаптер для OpenCode. `agentId`: `"opencode"`.

Генерирует единственный файл `opencode.json` в корне проекта. Файл
содержит ключ `"$schema"` со значением `"https://opencode.ai/config.json"`
и ключ `"mcp"` (описание серверов).

OpenCode не имеет нативной discovery-level фильтрации инструментов,
поэтому канонические поля `includeTools` / `excludeTools` данным
адаптером не обрабатываются (см. ниже § Обработка
includeTools/excludeTools). OpenCode также не поддерживает транспорт
SSE: серверы с `type: "sse"` пропускаются с предупреждением
(см. § Маппинг транспортов).

### Маппинг транспортов

OpenCode различает только два типа: `"stdio"` и `"remote"`.
Канонический `"http"` отображается в `"remote"` со streamable HTTP
семантикой. Канонический `"sse"` OpenCode не поддерживает --
соответствующий сервер пропускается (warn+skip).

| canonical `type` | opencode.json entry                                                             |
| ---------------- | ------------------------------------------------------------------------------- |
| `"stdio"`        | `{ "type": "stdio", "command": "...", "args": [...], "env": {...} }`            |
| `"http"`         | `{ "type": "remote", "url": "...", "headers": {...} }` (headers, если непустой) |
| `"sse"`          | (warn+skip, entry не эмитируется)                                               |

Для транспорта `"stdio"` поле `type: "stdio"` ТРЕБУЕТСЯ записывать
явно.

Для канонического `type: "sse"` ТРЕБУЕТСЯ эмитировать предупреждение
в `stderr` и пропустить сервер:

```text
Warning: OpenCode does not support SSE transport. Server '{serverId}' skipped.
```

Поле `headers` для `type: "remote"` OpenCode поддерживает и ТРЕБУЕТСЯ
передавать as-is (если непустое).

### Обработка `includeTools` / `excludeTools`

OpenCode не поддерживает discovery-level tool filtering. Транспилировать
канонические `includeTools` / `excludeTools` в объект `permission`
файла `opencode.json` ЗАПРЕЩАЕТСЯ: OpenCode `permission` -- postfactum
gating, семантически не эквивалентный discovery filtering.

При обнаружении непустого `includeTools` или `excludeTools` у сервера
в каноническом файле адаптер ТРЕБУЕТСЯ эмитировать предупреждение
в `stderr` вида:

```text
Warning: OpenCode does not support discovery-level tool filtering. Server '{serverId}': 'includeTools'/'excludeTools' ignored. Use .agloom/permissions.yml for postfactum permission gating.
```

После эмиссии предупреждения поля ТРЕБУЕТСЯ игнорировать. Ключ
`"permission"` данным адаптером в `opencode.json` ЗАПРЕЩАЕТСЯ
эмитировать: секция permissions -- задача permissions-транспайлера
(см. `docs/specs/permissions-transpiler.md`).

### transpile

`opencodeMcpAdapter.transpile(file)`.

**Вход:**

- `file` (McpCanonicalFile, обязательно) -- канонический файл.

**Поведение:**

1. Создать пустой объект `mcpSection`.
2. Для каждого сервера `<server>` в `file.content.mcpServers`:
   2.1. Если `serverConfig.type` равен `"sse"` -- эмитировать
   предупреждение в `stderr` (см. § Маппинг транспортов) и перейти
   к следующему серверу.
   2.2. Если `serverConfig.type` равен `"stdio"` (или опущено) --
   выполнить процедуру Build Stdio Server Config с
   `supportsToolFiltering = false`; добавить поле `type: "stdio"`
   в результат; сохранить как entry `mcpSection[<server>]`.
   2.3. Если `serverConfig.type` равен `"http"` -- создать объект
   `{ "type": "remote", "url": serverConfig.url }`. Если
   `serverConfig.headers` непусто -- добавить поле `headers`
   с тем же значением. Сохранить как entry `mcpSection[<server>]`.
   2.4. Если `serverConfig.includeTools` или `serverConfig.excludeTools`
   присутствует и непусто -- эмитировать предупреждение в `stderr`
   (см. § Обработка includeTools/excludeTools) и игнорировать поля.
3. Сформировать объект `output`:
   3.1. Добавить ключ `"$schema"` со значением
   `"https://opencode.ai/config.json"`.
   3.2. Добавить ключ `"mcp"` со значением `mcpSection`.
4. Сериализовать `output` в JSON с отступом 2 пробела
   и завершающим переводом строки.
5. Сформировать `McpOutputFile` с `relativePath: "opencode.json"`.

**Расширения:**

2.1a. См. основной шаг (warn+skip для `type: "sse"`).

2.4a. См. основной шаг (warn+ignore для `includeTools` /
`excludeTools`).

**Результат:**

`McpOutputFile[]` (массив из одного элемента).

### Deep merge с существующим opencode.json

Файл `opencode.json` является merge-eligible (`.json`). При конфликте
по пути `opencode.json` ТРЕБУЕТСЯ применить deep merge в соответствии
с `docs/specs/layer-model.md` § Алгоритм deep merge. Данный адаптер
эмитирует только ключи `"$schema"` и `"mcp"`; остальные ключи файла
(в частности, `"permission"`, записываемый permissions-транспилером)
сохраняются существующим механизмом deep merge.

### Пример выходного файла `opencode.json`

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "context7": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    },
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem"],
      "env": { "ROOT_DIR": "/home/user/project" }
    },
    "figma": {
      "type": "remote",
      "url": "https://mcp.figma.com/mcp",
      "headers": { "X-Figma-Region": "us-east-1" }
    }
  }
}
```

## Codex MCP-адаптер

Адаптер для Codex CLI. `agentId`: `"codex"`.

Генерирует единственный файл `.codex/config.toml` в корне проекта.
Формат -- TOML. Сериализация ТРЕБУЕТСЯ выполнять библиотекой
`smol-toml` (см. § Процедура TOML-сериализации MCP-конфигурации).

Codex -- один из двух MCP-адаптеров (вместе с Gemini), у которых
канонические `includeTools` / `excludeTools` применяются напрямую
через нативную discovery-level фильтрацию (`enabled_tools` /
`disabled_tools` в `config.toml`). Для остальных адаптеров (Claude,
OpenCode, Kilocode) эти поля игнорируются с предупреждением
(см. соответствующие секции).

Первой строкой файла ТРЕБУЕТСЯ добавить директиву схемы:

```text
#:schema https://developers.openai.com/codex/config-schema.json
```

Codex поддерживает только транспорты `"stdio"` и `"http"`. Транспорт
`"sse"` Codex не поддерживает -- для каждого такого сервера ТРЕБУЕТСЯ
эмитировать предупреждение в `stderr` и пропустить сервер:

```text
Warning: Codex does not support SSE transport. Server '{serverId}' skipped.
```

### Маппинг транспортов и полей

| canonical       | TOML table `[mcp_servers.<name>]`                                                |
| --------------- | -------------------------------------------------------------------------------- |
| `type: "stdio"` | `command`, `args`, nested table `[mcp_servers.<name>.env]`                       |
| `type: "http"`  | `url`, nested table `[mcp_servers.<name>.http_headers]` (если `headers` непусто) |
| `type: "sse"`   | (warn+skip, entry не эмитируется)                                                |

`includeTools` / `excludeTools` ТРЕБУЕТСЯ отображать в native-поля
Codex без изменения порядка элементов:

- `includeTools` -> `enabled_tools` (array of strings).
- `excludeTools` -> `disabled_tools` (array of strings).

### transpile

`codexMcpAdapter.transpile(file)`.

**Вход:**

- `file` (McpCanonicalFile, обязательно) -- канонический файл.

**Поведение:**

1. Создать пустой объект `mcpServers`.
2. Для каждого сервера `<server>` в `file.content.mcpServers`:
   2.1. Если `serverConfig.type` равен `"sse"` -- эмитировать
   предупреждение в `stderr` и перейти к следующему серверу.
   2.2. Если `serverConfig.type` равен `"stdio"` (или опущено) --
   выполнить процедуру Build Stdio Server Config с
   `supportsToolFiltering = true`; сохранить результат как entry
   `mcpServers[<server>]`.
   2.3. Если `serverConfig.type` равен `"http"` -- создать объект
   с полем `url` из `serverConfig.url`. Если `serverConfig.headers`
   непусто -- добавить поле `http_headers` с тем же значением.
   Сохранить как entry `mcpServers[<server>]`.
   2.4. Если `serverConfig.includeTools` присутствует -- добавить
   в entry поле `enabled_tools` со значением `serverConfig.includeTools`.
   2.5. Если `serverConfig.excludeTools` присутствует -- добавить
   в entry поле `disabled_tools` со значением `serverConfig.excludeTools`.
3. Выполнить процедуру TOML-сериализации MCP-конфигурации
   (см. § Процедура TOML-сериализации MCP-конфигурации) над
   `mcpServers`, получив строку `tomlBody`.
4. Сформировать итоговую строку `content` как конкатенацию:
   `"#:schema https://developers.openai.com/codex/config-schema.json\n"`,
   пустой строки, `tomlBody`.
5. Сформировать `McpOutputFile` с
   `relativePath: ".codex/config.toml"` и `content = content`.

**Расширения:**

2.1a. См. основной шаг (warn+skip).

**Результат:**

`McpOutputFile[]` (массив из одного элемента).

### Deep merge с существующим .codex/config.toml

Файл `.codex/config.toml` является merge-eligible (`.toml`,
см. `docs/specs/layer-model.md` § Классификация файлов по стратегии
слияния). При наличии существующего файла по целевому пути ТРЕБУЕТСЯ
применить deep merge в соответствии с `docs/specs/layer-model.md`
§ Алгоритм deep merge.

### Пример выходного файла `.codex/config.toml`

```toml
#:schema https://developers.openai.com/codex/config-schema.json

[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp@latest"]

[mcp_servers.filesystem]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem"]
enabled_tools = ["read_file", "list_directory"]

[mcp_servers.filesystem.env]
ROOT_DIR = "/home/user/project"

[mcp_servers.figma]
url = "https://mcp.figma.com/mcp"
disabled_tools = ["delete"]

[mcp_servers.figma.http_headers]
"X-Figma-Region" = "us-east-1"
```

## Процедура TOML-сериализации MCP-конфигурации

Общая процедура преобразования объекта `mcpServers` (JavaScript-объект)
в TOML-строку, пригодную для записи в `.codex/config.toml`.

**Вход:**

- `mcpServers` (Record\<string, object>, обязательно) -- карта серверов.
  Ключ -- имя сервера, значение -- объект с подмножеством полей:
  `command`, `args`, `env`, `url`, `http_headers`, `enabled_tools`,
  `disabled_tools`.

**Поведение:**

1. Для каждого сервера `<server>` ТРЕБУЕТСЯ эмитировать заголовок
   TOML-таблицы `[mcp_servers.<server>]` на отдельной строке.
2. Scalar- и array-ключи верхнего уровня внутри таблицы сервера
   ТРЕБУЕТСЯ записывать в следующем порядке:
   1. `command` (если присутствует);
   2. `args` (если присутствует);
   3. `url` (если присутствует);
   4. `enabled_tools` (если присутствует);
   5. `disabled_tools` (если присутствует).
3. Nested-таблицы (`http_headers`, `env`) ТРЕБУЕТСЯ эмитировать после
   всех scalar- и array-ключей родительской таблицы сервера, поскольку
   заголовок nested-таблицы в TOML открывает новый scope, в который
   попадают все последующие ключи. Порядок nested-таблиц:
   1. `http_headers` как `[mcp_servers.<server>.http_headers]`
      (если присутствует и непусто);
   2. `env` как `[mcp_servers.<server>.env]` (если присутствует
      и непусто).
4. Ключи внутри `env` и `http_headers` ТРЕБУЕТСЯ эмитировать в порядке
   итерации по входному объекту (стабильный порядок вставки).
5. Между таблицами разных серверов ТРЕБУЕТСЯ эмитировать пустую
   строку для читаемости.
6. Значения строк ТРЕБУЕТСЯ сериализовать как TOML basic strings
   (в двойных кавычках). Escaping управляется библиотекой `smol-toml`.
7. Значения массивов строк ТРЕБУЕТСЯ сериализовать как однострочные
   TOML-массивы (в квадратных скобках).
8. Итоговую строку ТРЕБУЕТСЯ завершать переводом строки (`\n`).

**Расширения:**

Нет расширений.

**Результат:**

- `tomlBody` (string) -- TOML-представление `mcpServers`.

## Gemini MCP-адаптер

Адаптер для Gemini CLI. `agentId`: `"gemini"`.

Генерирует единственный файл `.gemini/settings.json` в корне проекта.
Формат -- JSON. Верхний уровень содержит ключ `"$schema"` со значением
`"https://raw.githubusercontent.com/google-gemini/gemini-cli/main/schemas/settings.schema.json"`
и ключ `"mcpServers"`.

Gemini -- один из двух MCP-адаптеров (вместе с Codex), у которых
канонические `includeTools` / `excludeTools` применяются напрямую
через нативную discovery-level фильтрацию (одноимённые поля
`includeTools` / `excludeTools` в `settings.json`). Для остальных
адаптеров (Claude, OpenCode, Kilocode) эти поля игнорируются
с предупреждением (см. соответствующие секции).

### Маппинг транспортов и полей

Gemini использует три разных имени полей URL для stdio / HTTP / SSE:

| canonical       | Gemini entry                                        |
| --------------- | --------------------------------------------------- |
| `type: "stdio"` | `{ "command": "...", "args": [...], "env": {...} }` |
| `type: "http"`  | `{ "httpUrl": "...", "headers": {...} }`            |
| `type: "sse"`   | `{ "url": "...", "headers": {...} }`                |

Асимметрия: canonical `type: "http"` отображается в ключ `httpUrl`,
canonical `type: "sse"` -- в ключ `url`. Ключ `type` в Gemini entry
НЕ записывается (тип различается по имени ключа URL).

Поля `includeTools` / `excludeTools` являются native-полями Gemini
и ТРЕБУЕТСЯ передавать как есть в entry сервера (без переименования).

### transpile

`geminiMcpAdapter.transpile(file)`.

**Вход:**

- `file` (McpCanonicalFile, обязательно) -- канонический файл.

**Поведение:**

1. Создать пустой объект `mcpServers`.
2. Для каждого сервера `<server>` в `file.content.mcpServers`:
   2.1. Если `serverConfig.type` равен `"stdio"` (или опущено) --
   выполнить процедуру Build Stdio Server Config с
   `supportsToolFiltering = true`; сохранить результат как entry
   `mcpServers[<server>]`.
   2.2. Если `serverConfig.type` равен `"http"` -- создать объект
   с полем `httpUrl` из `serverConfig.url`. Если `serverConfig.headers`
   непусто -- добавить поле `headers`. Сохранить как entry
   `mcpServers[<server>]`.
   2.3. Если `serverConfig.type` равен `"sse"` -- создать объект
   с полем `url` из `serverConfig.url`. Если `serverConfig.headers`
   непусто -- добавить поле `headers`. Сохранить как entry
   `mcpServers[<server>]`.
   2.4. Если `serverConfig.includeTools` присутствует -- добавить
   в entry поле `includeTools` со значением `serverConfig.includeTools`.
   2.5. Если `serverConfig.excludeTools` присутствует -- добавить
   в entry поле `excludeTools` со значением `serverConfig.excludeTools`.
3. Сформировать объект `output`:
   3.1. Добавить ключ `"$schema"` со значением
   `"https://raw.githubusercontent.com/google-gemini/gemini-cli/main/schemas/settings.schema.json"`.
   3.2. Добавить ключ `"mcpServers"` со значением `mcpServers`.
4. Сериализовать `output` в JSON с отступом 2 пробела
   и завершающим переводом строки.
5. Сформировать `McpOutputFile`
   с `relativePath: ".gemini/settings.json"`.

**Расширения:**

Нет расширений.

**Результат:**

`McpOutputFile[]` (массив из одного элемента).

### Deep merge с существующим .gemini/settings.json

Файл `.gemini/settings.json` является merge-eligible (`.json`).
При наличии существующего файла по целевому пути ТРЕБУЕТСЯ применить
deep merge в соответствии с `docs/specs/layer-model.md`
§ Алгоритм deep merge.

### Пример выходного файла `.gemini/settings.json`

```json
{
  "$schema": "https://raw.githubusercontent.com/google-gemini/gemini-cli/main/schemas/settings.schema.json",
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem"],
      "env": { "ROOT_DIR": "/home/user/project" },
      "includeTools": ["read_file", "list_directory"]
    },
    "figma": {
      "httpUrl": "https://mcp.figma.com/mcp",
      "headers": { "X-Figma-Region": "us-east-1" },
      "excludeTools": ["delete"]
    },
    "asana": {
      "url": "https://mcp.asana.com/sse",
      "headers": { "Authorization": "Bearer ..." }
    }
  }
}
```

## Kilocode MCP-адаптер

Адаптер для Kilocode. `agentId`: `"kilocode"`.

Генерирует единственный файл `kilo.jsonc` в корне проекта. Файл
является единым конфигурационным файлом Kilocode (аналогично
`opencode.json` для OpenCode): содержит ключ `"$schema"`, ключ
`"mcpServers"` (описание MCP-серверов) и, в будущих циклах,
также ключ `"permission"` (правила permissions), записываемые
в тот же файл через deep merge.

Хотя расширение файла -- `.jsonc` (JSONC-совместимый формат
Kilocode), содержимое, эмитируемое данным адаптером, ТРЕБУЕТСЯ
сериализовать как чистый JSON (без `//`- и `/* */`-комментариев
со стороны Agloom). Чистый JSON является валидным JSONC, поэтому
Kilocode читает такой файл штатно. Верхний уровень итогового
объекта содержит ключ `"$schema"` со значением
`"https://app.kilo.ai/config.json"` и ключ `"mcpServers"`.

### Маппинг транспортов и полей

| canonical       | Kilocode entry                                                        |
| --------------- | --------------------------------------------------------------------- |
| `type: "stdio"` | `{ "command": "...", "args": [...], "env": {...} }` (без поля `type`) |
| `type: "http"`  | `{ "type": "streamable-http", "url": "...", "headers": {...} }`       |
| `type: "sse"`   | `{ "type": "sse", "url": "...", "headers": {...} }`                   |

Canonical `type: "http"` отображается в значение `"streamable-http"`
поля `type` Kilocode (не `"http"`). Canonical `type: "sse"`
отображается в значение `"sse"`.

### Обработка `includeTools` / `excludeTools`

Kilocode имеет per-entry поле `alwaysAllow` (array of strings), однако
это **не** discovery-level tool filtering, а postfactum permission
gating: перечисленные инструменты автоматически одобряются без запроса
пользователя, но остаются видимыми модели. Семантически это относится
к permissions, а не к tool filtering, и ЗАПРЕЩАЕТСЯ выводить
`alwaysAllow` из канонических `includeTools` / `excludeTools`.

Поле `alwaysAllow` в `kilo.jsonc` эмитируется только
permissions-транспайлером (см. `docs/specs/permissions-transpiler.md`);
данный адаптер его ЗАПРЕЩАЕТСЯ записывать.

При обнаружении непустого `includeTools` или `excludeTools` у сервера
в каноническом файле адаптер ТРЕБУЕТСЯ эмитировать предупреждение
в `stderr` вида:

```text
Warning: Kilocode does not support discovery-level tool filtering. Server '{serverId}': 'includeTools'/'excludeTools' ignored. Use .agloom/permissions.yml for postfactum permission gating (Kilocode alwaysAllow will be emitted by the permissions transpiler).
```

После эмиссии предупреждения поля ТРЕБУЕТСЯ игнорировать; entry
сервера в `kilo.jsonc` формируется без них.

### transpile

`kilocodeMcpAdapter.transpile(file)`.

**Вход:**

- `file` (McpCanonicalFile, обязательно) -- канонический файл.

**Поведение:**

1. Создать пустой объект `mcpServers`.
2. Для каждого сервера `<server>` в `file.content.mcpServers`:
   2.1. Если `serverConfig.type` равен `"stdio"` (или опущено) --
   выполнить процедуру Build Stdio Server Config с
   `supportsToolFiltering = false`; сохранить результат как entry
   `mcpServers[<server>]`.
   2.2. Если `serverConfig.type` равен `"http"` -- создать объект
   `{ "type": "streamable-http", "url": serverConfig.url }`. Если
   `serverConfig.headers` непусто -- добавить поле `headers`.
   Сохранить как entry `mcpServers[<server>]`.
   2.3. Если `serverConfig.type` равен `"sse"` -- создать объект
   `{ "type": "sse", "url": serverConfig.url }`. Если
   `serverConfig.headers` непусто -- добавить поле `headers`.
   Сохранить как entry `mcpServers[<server>]`.
   2.4. Если `serverConfig.includeTools` или `serverConfig.excludeTools`
   присутствует и непусто -- эмитировать предупреждение в `stderr`
   (см. § Обработка includeTools/excludeTools) и игнорировать поля.
3. Сформировать объект `output`:
   3.1. Добавить ключ `"$schema"` со значением
   `"https://app.kilo.ai/config.json"`.
   3.2. Добавить ключ `"mcpServers"` со значением `mcpServers`.
4. Сериализовать `output` в JSON с отступом 2 пробела
   и завершающим переводом строки. Сериализация ТРЕБУЕТСЯ
   выполняться стандартным JSON-сериализатором; комментарии
   (`//` или `/* */`) в вывод ЗАПРЕЩАЕТСЯ эмитировать.
5. Сформировать `McpOutputFile`
   с `relativePath: "kilo.jsonc"`.

**Расширения:**

2.4a. См. основной шаг (warn+ignore для `includeTools` /
`excludeTools`).

**Результат:**

`McpOutputFile[]` (массив из одного элемента).

### Deep merge с существующим kilo.jsonc

Файл `kilo.jsonc` является merge-eligible (`.jsonc`,
см. `docs/specs/layer-model.md` § Классификация файлов
по стратегии слияния). При наличии существующего файла
по целевому пути `kilo.jsonc` (от overlay, плагина
или предыдущего шага) ТРЕБУЕТСЯ применить deep merge
в соответствии с `docs/specs/layer-model.md`
§ Алгоритм deep merge. Если существующее содержимое
файла не является валидным JSON (например, пользователь
вручную добавил `//`-комментарии) -- base ТРЕБУЕТСЯ
игнорировать и полностью перезаписать файл результатом
транспиляции (симметрично поведению для невалидного JSON,
см. `docs/specs/layer-model.md` § Парсинг файлов для merge).

### Пример выходного файла `kilo.jsonc`

```json
{
  "$schema": "https://app.kilo.ai/config.json",
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem"],
      "env": { "ROOT_DIR": "/home/user/project" }
    },
    "figma": {
      "type": "streamable-http",
      "url": "https://mcp.figma.com/mcp",
      "headers": { "X-Figma-Region": "us-east-1" }
    },
    "asana": {
      "type": "sse",
      "url": "https://mcp.asana.com/sse",
      "headers": { "Authorization": "Bearer ..." }
    }
  }
}
```

## Запись результатов

`transpiler.writeResults(results)` -- записывает результаты транспиляции
в файловую систему.

**Вход:**

- `results` (array\<TranspileResult>, обязательно) -- результаты
  транспиляции, полученные из `transpile()`.

**Поведение:**

1. Для каждого `TranspileResult` проверить, что массив `errors` пуст.
2. Собрать все `McpOutputFile` из всех `TranspileResult` с пустым `errors`.
3. Выполнить дедупликацию: если несколько `McpOutputFile` имеют
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

4a. Существующий файл по целевому пути содержит невалидное содержимое
merge-eligible формата (невалидный JSON, невалидный TOML и т.п.) --
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

- `mcp` (McpAdapter | null, обязательно) -- экземпляр MCP-адаптера.
  Значение `null` означает, что адаптер не поддерживает
  MCP-транспиляцию.

### Обновление реестра адаптеров

| `id`         | `mcp`                |
| ------------ | -------------------- |
| `"claude"`   | `ClaudeMcpAdapter`   |
| `"opencode"` | `OpenCodeMcpAdapter` |
| `"agentsmd"` | `null`               |
| `"codex"`    | `CodexMcpAdapter`    |
| `"gemini"`   | `GeminiMcpAdapter`   |
| `"kilocode"` | `KilocodeMcpAdapter` |

Адаптер `"agentsmd"` НЕ имеет MCP-адаптера, поскольку формат
AGENTS.md не определяет MCP-конфигурацию.

## Расширение команды transpile

Команда `transpile` (см. `docs/specs/cli.md` § Команда transpile)
расширяется шагом MCP.

**Новые шаги:**

После шага 4.4 (Agents):
4.5. Если `entry.mcp` не равен `null` -- выполнить шаг транспиляции
"MCP" (см. `docs/specs/cli.md` § Шаг транспиляции)
с адаптером `entry.mcp`.

**Изменения в выводе:**

Шаг MCP отображается после шага Agents:

```text
  ✓ MCP               1 files
```

Если `entry.mcp` равен `null` -- шаг MCP не выполняется
и не отображается.

**Изменения в TranspilerStepOutcome:**

Поле `name` типа `TranspilerStepOutcome`
(см. `docs/specs/cli.md` § Типы данных) ТРЕБУЕТСЯ расширить
допустимым значением `"MCP"`:

- `name` (string: `"Instructions"` | `"Skills"` | `"Agents"` | `"Overlay"` | `"MCP"`)

Описание шага транспиляции (см. `docs/specs/cli.md`
§ Шаг транспиляции) расширяется: шаг выполняется
для каждого транспилера, включая MCP (при наличии
`entry.mcp !== null`).

**Изменения в exit codes:**

Exit code учитывает ошибки шага MCP наравне с остальными шагами.

## Расширение структуры директории плагина

Директория плагина (см. `docs/specs/plugin-manifest.md`
§ Структура директории плагина) МОЖЕТ содержать MCP-конфигурацию:

```text
<plugin-root>/
├── plugin.yml
├── mcp.yml             # MCP-конфигурация плагина (опционально)
├── mcp.json            # MCP-конфигурация плагина (опционально)
├── ...
```

Формат `mcp.yml` / `mcp.json` в плагине идентичен каноническому
формату (см. "Канонический формат"). При наличии обоих файлов
в одном плагине -- ошибка (аналогично локальному проекту).

MCP-конфигурация плагина участвует в модели слоёв
(см. `docs/specs/layer-model.md` § Порядок применения слоёв)
как отдельный слой. Deep merge выполняется в порядке приоритета:
плагины (в порядке объявления), затем локальный проект.

### Соответствие путей

| Путь в `.agloom/`  | Путь в плагине      |
| ------------------ | ------------------- |
| `.agloom/mcp.yml`  | `<plugin>/mcp.yml`  |
| `.agloom/mcp.json` | `<plugin>/mcp.json` |

## Интерполяция переменных

Интерполяция agloom-переменных (синтаксис `${env:VAR}`,
`${agloom:VAR}`, `${values:VAR}`)
(см. `docs/specs/interpolation.md`) ДОЛЖНА выполняться
при обработке канонического файла. Интерполяция ДОЛЖНА выполняться
после парсинга и перед передачей в адаптеры -- на уровне
строковых значений следующих полей каждого сервера:

- `command` (stdio),
- каждого элемента `args` (stdio),
- каждого значения в `env` (stdio),
- `url` (http / sse),
- каждого значения в `headers` (http / sse).

Синтаксис `${VAR}` без namespace-prefix НЕ ДОЛЖЕН обрабатываться
Agloom и ДОЛЖЕН передаваться as-is в output. Это позволяет
использовать shell-подстановки и нативные переменные окружения
в конфигурации MCP-серверов.

## Вне scope

Следующие аспекты НЕ ВХОДЯТ в scope данной спецификации:

- Agent-scoped MCP (per-agent MCP-конфигурация) --
  только project-level.
- Поля `trust`, `required`, `timeout`, `startup_timeout_sec`,
  `tool_timeout_sec`, `alwaysAllow` в каноническом формате --
  остаются platform-specific и не имеют канонического представления.
  Kilocode `alwaysAllow` эмитируется permissions-транспайлером
  (см. `docs/specs/permissions-transpiler.md`), а не MCP-адаптером.
- OAuth и сопутствующие поля: `oauth`, `headersHelper` (Claude);
  `bearer_token_env_var`, `env_http_headers` (Codex);
  `authProviderType`, `oauth` (Gemini); `timeout`, `disabled`
  (Kilocode). Интеграция с OAuth не транспилируется.
- Discovery-level tool filtering через permissions-транспайлер
  для Claude, OpenCode, Kilocode. Архитектурное разграничение:
  MCP-адаптеры отвечают за discovery-level advertising инструментов,
  permissions-транспайлер -- за postfactum gating на каждом вызове
  (см. § Семантика `includeTools` / `excludeTools`).
- MCP-server discovery (автоматическое обнаружение серверов).
- Валидация доступности MCP-серверов при транспиляции.
