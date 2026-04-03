---
summary: MCP Transpiler — библиотека транспиляции MCP-конфигурации из .agloom/ в agent-specific файлы
description: >
  Библиотека для транспиляции канонической MCP-конфигурации (.agloom/mcp.yml
  или .agloom/mcp.json) в agent-specific MCP-файлы. Генерирует .mcp.json
  для Claude Code и секцию mcp в opencode.json для OpenCode. Поддерживает
  tool filtering в каноническом формате с отбрасыванием при генерации
  для адаптеров, не поддерживающих фильтрацию. Расширяется через адаптеры.
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

- `command` (string, обязательно) -- команда запуска MCP-сервера.
- `args` (array\<string>, опционально, default: `[]`) -- аргументы
  команды.
- `env` (Record\<string, string>, опционально, default: `{}`) --
  переменные окружения для процесса MCP-сервера.
- `includeTools` (array\<string>, опционально) -- whitelist инструментов.
  При наличии -- только перечисленные инструменты доступны.
- `excludeTools` (array\<string>, опционально) -- blacklist инструментов.
  При наличии -- перечисленные инструменты исключаются.

Поля `includeTools` и `excludeTools` являются взаимоисключающими
для одного MCP-сервера. При наличии обоих -- ошибка валидации
(см. "Валидация канонического файла", расширение 3a).

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
```

### Пример канонического файла (JSON)

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
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
3. Выполнить интерполяцию строковых значений в `canonicalFile.content`
   (см. "Интерполяция переменных"). Для каждого сервера
   в `mcpServers` интерполировать значения полей `command`,
   каждого элемента `args` и каждого значения в `env`.
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
   3.1. Проверить наличие обязательного поля `command` (string).
   3.2. Если поле `args` присутствует -- проверить, что значение
   является массивом строк.
   3.3. Если поле `env` присутствует -- проверить, что значение
   является объектом с string-значениями.
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

3a. Поля `includeTools` и `excludeTools` указаны одновременно
для сервера --
`TransformError("Server '{serverId}': 'includeTools' and 'excludeTools' are mutually exclusive")`.

3b. Поле `command` отсутствует или не является строкой --
`TransformError("Server '{serverId}': 'command' is required and must be a string")`.

3c. Поле `args` присутствует, но не является массивом строк --
`TransformError("Server '{serverId}': 'args' must be an array of strings")`.

3d. Поле `env` присутствует, но не является объектом
с string-значениями --
`TransformError("Server '{serverId}': 'env' must be an object with string values")`.

3e. Поле `includeTools` присутствует, но не является массивом строк --
`TransformError("Server '{serverId}': 'includeTools' must be an array of strings")`.

3f. Поле `excludeTools` присутствует, но не является массивом строк --
`TransformError("Server '{serverId}': 'excludeTools' must be an array of strings")`.

**Результат:**

`McpCanonicalContent` -- валидированное содержимое.

## Интерфейс адаптера

Каждый MCP-адаптер ДОЛЖЕН реализовать следующий интерфейс:

- `agentId` (string, readonly) -- уникальный идентификатор агента
  (например, `"claude"`, `"opencode"`).
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

## Процедура Build Base Server Config

Общая процедура построения базовой конфигурации MCP-сервера
из канонического формата. Переиспользуется адаптерами Claude
и OpenCode для устранения дублирования шагов трансформации.

**Вход:**

- `serverConfig` (McpServerConfig, обязательно) -- конфигурация
  сервера из канонического файла.

**Поведение:**

1. Создать объект с полем `command` из `serverConfig.command`.
2. Если поле `args` присутствует и непусто -- добавить
   поле `args`.
3. Если поле `env` присутствует и непусто -- добавить
   поле `env`.
4. Поля `includeTools` и `excludeTools` ТРЕБУЕТСЯ отбросить
   (не поддерживаются целевыми адаптерами в MVP).

**Расширения:**

Нет расширений.

**Результат:**

- `baseConfig` (object) -- объект с полями `command`
  и опциональными `args`, `env`.

## Claude Code MCP-адаптер

Адаптер для Claude Code. `agentId`: `"claude"`.

Генерирует файл `.mcp.json` в корне проекта. Формат -- объект
с полем `mcpServers`, где каждый сервер содержит поля `command`,
`args`, `env`.

### transpile

`claudeMcpAdapter.transpile(file)`.

**Вход:**

- `file` (McpCanonicalFile, обязательно) -- канонический файл.

**Поведение:**

1. Создать пустой объект `output` с полем `mcpServers`.
2. Для каждого сервера в `file.content.mcpServers`:
   2.1--2.4. Build Base Server Config
   (см. § Процедура Build Base Server Config).
3. Сериализовать `output` в JSON с отступом 2 пробела
   и завершающим переводом строки.
4. Сформировать `McpOutputFile` с `relativePath: ".mcp.json"`.

**Расширения:**

Нет расширений.

**Результат:**

`McpOutputFile[]` (массив из одного элемента).

### Пример выходного файла (.mcp.json)

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem"],
      "env": {
        "ROOT_DIR": "/home/user/project"
      }
    }
  }
}
```

## OpenCode MCP-адаптер

Адаптер для OpenCode. `agentId`: `"opencode"`.

Генерирует файл `opencode.json` в корне проекта с ключом `"mcp"`.
При наличии существующего `opencode.json` (от overlay или предыдущих
шагов транспиляции) ТРЕБУЕТСЯ выполнить deep merge через layer model
(см. `docs/specs/layer-model.md`).

### transpile

`opencodeMcpAdapter.transpile(file)`.

**Вход:**

- `file` (McpCanonicalFile, обязательно) -- канонический файл.

**Поведение:**

1. Создать объект `mcpSection` с серверами.
2. Для каждого сервера в `file.content.mcpServers`:
   2.1--2.4. Build Base Server Config
   (см. § Процедура Build Base Server Config).
3. Сформировать объект `output` с ключом `"mcp"`,
   содержащим `mcpSection`.
4. Сериализовать `output` в JSON с отступом 2 пробела
   и завершающим переводом строки.
5. Сформировать `McpOutputFile` с `relativePath: "opencode.json"`.

**Расширения:**

Нет расширений.

**Результат:**

`McpOutputFile[]` (массив из одного элемента).

### Deep merge с существующим opencode.json

Файл `opencode.json` МОЖЕТ содержать данные, записанные overlay-шагом
или другими источниками. Дедупликация и merge по output path
выполняется на уровне `writeResults` (см. "Запись результатов").
При конфликте по пути `opencode.json` ТРЕБУЕТСЯ применить deep merge
в соответствии с `docs/specs/layer-model.md` § Алгоритм deep merge,
поскольку `opencode.json` является merge-eligible файлом (расширение `.json`).

### Пример выходного файла (opencode.json)

```json
{
  "mcp": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
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

- `mcp` (McpAdapter | null, обязательно) -- экземпляр MCP-адаптера.
  Значение `null` означает, что адаптер не поддерживает
  MCP-транспиляцию.

### Обновление реестра адаптеров

| `id`         | `mcp`                |
| ------------ | -------------------- |
| `"claude"`   | `ClaudeMcpAdapter`   |
| `"opencode"` | `OpenCodeMcpAdapter` |
| `"agentsmd"` | `null`               |

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
строковых значений полей `command`, `args`, `env`.

Синтаксис `${VAR}` без namespace-prefix НЕ ДОЛЖЕН обрабатываться
Agloom и ДОЛЖЕН передаваться as-is в output. Это позволяет
использовать shell-подстановки и нативные переменные окружения
в конфигурации MCP-серверов.

## Вне scope

Следующие аспекты НЕ ВХОДЯТ в scope данной спецификации:

- Agent-scoped MCP (per-agent MCP-конфигурация) --
  только project-level.
- HTTP/SSE транспорт -- только stdio в MVP.
- Адаптеры для Codex CLI и Gemini CLI
  (поля `includeTools`/`excludeTools` сохраняются
  в каноническом формате для будущих адаптеров).
- Поля `trust`, `required`, `timeout` -- специфичны
  для будущих адаптеров.
- MCP-server discovery (автоматическое обнаружение серверов).
- Валидация доступности MCP-серверов при транспиляции.
