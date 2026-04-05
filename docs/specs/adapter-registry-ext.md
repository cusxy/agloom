---
summary: Расширение реестра адаптеров — targetFiles, projectFiles, instructionsFile, dependsOn, hidden, paths, Resolve Adapter
description: >
  Расширяет AdapterRegistryEntry полями targetFiles, projectFiles,
  instructionsFile, dependsOn, hidden и paths. Определяет записи для
  адаптеров claude, opencode, agentsmd, kilocode, codex, gemini.
  Определяет общую процедуру Resolve Adapter для переиспользования
  в командах, принимающих --adapter.
type: spec
status: implemented
relates:
  - docs/specs/cli.md
  - docs/specs/instructions-transpiler.md
  - docs/specs/interpolation.md
  - docs/specs/init-command.md
  - docs/specs/config.md
  - docs/specs/plugin-manifest.md
  - docs/specs/mcp-transpiler.md
  - docs/specs/permissions-transpiler.md
maps_to:
  - src/cli/
---

# Расширение реестра адаптеров

Ключевые слова «ТРЕБУЕТСЯ», «ЗАПРЕЩАЕТСЯ», «ДОЛЖЕН», «НЕ ДОЛЖЕН», «СЛЕДУЕТ»,
«НЕ СЛЕДУЕТ», «МОЖЕТ» и «НЕОБЯЗАТЕЛЬНО» в этом документе толкуются
в соответствии с [RFC 2119](https://tools.ietf.org/html/rfc2119).

Данная спецификация расширяет реестр адаптеров
(см. `docs/specs/cli.md` § Реестр адаптеров) дополнительными
метаданными, необходимыми для операций с файловой системой
целевого агента, признаком скрытости адаптера и формализует
общую процедуру разрешения адаптера.

## Расширение AdapterRegistryEntry

К существующему типу `AdapterRegistryEntry`
(см. `docs/specs/cli.md` § Типы данных) ТРЕБУЕТСЯ добавить поля:

- `targetFiles` (array\<string>, обязательно) — список относительных путей к файлам,
  которые генерируются транспилерами (например, `["CLAUDE.md"]`).
  Массив МОЖЕТ быть пустым, если адаптер не генерирует отдельных файлов.
- `projectFiles` (array\<string>, обязательно) — имена agent-специфичных файлов,
  принадлежащих данному адаптеру в project tree
  (например, `["CLAUDE.md"]`). Используется командами `clean`
  и `init` для определения файлов, относящихся к адаптеру.
  Массив МОЖЕТ быть пустым, если адаптер не имеет уникальных файлов
  в project tree.
- `instructionsFile` (string | null, обязательно) — имя собственного файла
  инструкций агента (например, `"CLAUDE.md"`, `"AGENTS.md"`). Значение `null`
  означает, что агент НЕ ИМЕЕТ собственного формата файла инструкций.
  Используется для валидации допустимых `agentId` в `<!-- agent:X -->` блоках
  файлов инструкций.
- `dependsOn` (array\<string>, обязательно) — идентификаторы адаптеров,
  от которых зависит данный адаптер. При выполнении `transpile --adapter`
  для адаптера с непустым `dependsOn` все зависимости ДОЛЖНЫ быть
  транспилированы до самого адаптера. Массив МОЖЕТ быть пустым.
  Связь является явной: наличие `instructionsFile: null` НЕ подразумевает
  автоматическую зависимость от какого-либо адаптера.
- `overlayImportPaths` (array\<string>, обязательно) — список путей относительно
  project root, которые импортируются в overlay при выполнении `init`. Каждый
  элемент — файл, директория или glob-паттерн (например, `"**/CLAUDE.md"`).
  Glob-паттерны ТРЕБУЕТСЯ резолвить через библиотеку `fast-glob`
  с параметрами `cwd: projectRoot`, `dot: false`,
  `ignore: ["**/node_modules/**"]`. Параметр `dot: false` исключает файлы
  и директории, имя которых начинается с `.`. Используется процедурой
  Init Overlay Files
  (см. `docs/specs/init-command.md` § Процедура Init Overlay Files).
- `hidden` (boolean, обязательно) — признак скрытого адаптера.
  Скрытые адаптеры (`hidden: true`):
  - ЗАПРЕЩАЕТСЯ указывать в конфигурационном файле
    `.agloom/config.yml` (см. `docs/specs/config.md`).
  - ЗАПРЕЩАЕТСЯ указывать через `--adapter`.
  - НЕ отображаются в выводе команды `adapters`
    (см. `docs/specs/cli.md` § Команда adapters).
  - МОГУТ быть включены только неявно через `dependsOn`
    другого адаптера.
  - МОГУТ быть обработаны при указании `--all` для команд
    `transpile`, `clean` и `init`.
- `paths` (object, обязательно) — пути к agent-specific каталогам
  относительно `projectRoot`. Объект МОЖЕТ содержать следующие
  опциональные ключи:
  - `skills` (string, опционально) — путь к каталогу skills.
  - `agents` (string, опционально) — путь к каталогу agents.
  - `docs` (string, опционально) — путь к каталогу docs.
  - `schemas` (string, опционально) — путь к каталогу schemas.
    Объект МОЖЕТ быть пустым (`{}`), если адаптер не имеет
    собственных каталогов (например, `"agentsmd"`).

## Обновление реестра адаптеров

В реестр адаптеров ТРЕБУЕТСЯ добавить поля `targetFiles`,
`projectFiles`, `instructionsFile`, `dependsOn`, `overlayImportPaths`,
`hidden` и `paths` для каждой записи:

| `id`         | `targetFiles`                         | `projectFiles`                        | `instructionsFile` | `dependsOn`    | `overlayImportPaths`                                   | `hidden` | `paths`                                                                                                            |
| ------------ | ------------------------------------- | ------------------------------------- | ------------------ | -------------- | ------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------ |
| `"claude"`   | `["CLAUDE.md", ".mcp.json"]`          | `["CLAUDE.md"]`                       | `"CLAUDE.md"`      | `[]`           | `[".claude", "**/CLAUDE.md", ".mcp.json"]`             | `false`  | `{ skills: ".claude/skills", agents: ".claude/agents", docs: ".claude/docs", schemas: ".claude/schemas" }`         |
| `"opencode"` | `["opencode.json"]`                   | `[]`                                  | `null`             | `["agentsmd"]` | `[".opencode", "opencode.json"]`                       | `false`  | `{ skills: ".opencode/skills", agents: ".opencode/agents", docs: ".opencode/docs", schemas: ".opencode/schemas" }` |
| `"agentsmd"` | `["AGENTS.md", "AGENTS.override.md"]` | `["AGENTS.md", "AGENTS.override.md"]` | `"AGENTS.md"`      | `[]`           | `[".agents", "**/AGENTS.md", "**/AGENTS.override.md"]` | `true`   | `{}`                                                                                                               |
| `"kilocode"` | `[]`                                  | `[]`                                  | `null`             | `["agentsmd"]` | `[".kilo"]`                                            | `false`  | `{ skills: ".kilo/skills", agents: ".kilo/agents", docs: ".kilo/docs", schemas: ".kilo/schemas" }`                 |
| `"codex"`    | `[]`                                  | `[]`                                  | `null`             | `["agentsmd"]` | `[".codex", ".agents"]`                                | `false`  | `{ skills: ".agents/skills", agents: ".codex/agents" }`                                                            |
| `"gemini"`   | `["GEMINI.md"]`                       | `["GEMINI.md"]`                       | `"GEMINI.md"`      | `[]`           | `[".gemini", "**/GEMINI.md"]`                          | `false`  | `{ skills: ".gemini/skills", agents: ".gemini/agents", docs: ".gemini/docs", schemas: ".gemini/schemas" }`         |

### Запись agentsmd

Запись `"agentsmd"` представляет формат файлов `AGENTS.md`, используемый
несколькими агентами (OpenCode, KiloCode, Codex и др.). Поле `targetFiles`
ДОЛЖНО содержать `["AGENTS.md", "AGENTS.override.md"]`, поскольку оба файла
генерируются в корне проекта. Файл `AGENTS.override.md` генерируется
из канонического `AGLOOM.override.md`. Запись `"opencode"` НЕ ДОЛЖНА
дублировать файлы, принадлежащие `"agentsmd"`: генерация `AGENTS.md`
и `AGENTS.override.md` ДОЛЖНА выполняться через адаптер `"agentsmd"`.

### Запись opencode

Запись `"opencode"` описывает агент OpenCode. Поле `targetFiles` ДОЛЖНО
содержать `["opencode.json"]`, поскольку файл `opencode.json` генерируется
MCP-транспилером (см. `docs/specs/mcp-transpiler.md`) и permissions-транспилером
(см. `docs/specs/permissions-transpiler.md`) в корне проекта.
Файл `opencode.json` является merge-eligible: несколько транспилеров
генерируют отдельные секции (`mcp`, `permission`), которые объединяются
при записи в единый файл. Поле `overlayImportPaths` ДОЛЖНО содержать
`[".opencode", "opencode.json"]`, чтобы файл `opencode.json` включался
в overlay при выполнении `init`. Поле `projectFiles` ДОЛЖНО быть пустым
массивом, поскольку OpenCode не имеет уникальных файлов в project tree.
Поле `instructionsFile` ДОЛЖНО быть `null`, поскольку OpenCode не имеет
собственного формата файла инструкций.

### Запись kilocode

Запись `"kilocode"` описывает агент KiloCode. Поле `instructionsFile`
ДОЛЖНО быть `null`, поскольку KiloCode не имеет собственного формата
файла инструкций — использует `AGENTS.md` через адаптер `"agentsmd"`.
Поле `dependsOn` ДОЛЖНО содержать `["agentsmd"]`. Поле `targetFiles`
ДОЛЖНО быть пустым массивом, поскольку KiloCode не генерирует файлов
в корне проекта. Поле `overlayImportPaths` ДОЛЖНО содержать `[".kilo"]`.

### Запись codex

Запись `"codex"` описывает агент Codex (OpenAI). Поле `instructionsFile`
ДОЛЖНО быть `null`, поскольку Codex не имеет собственного формата файла
инструкций — использует `AGENTS.md` через адаптер `"agentsmd"`.
Поле `dependsOn` ДОЛЖНО содержать `["agentsmd"]`. Поле `targetFiles`
ДОЛЖНО быть пустым массивом. Поле `overlayImportPaths` ДОЛЖНО содержать
`[".codex", ".agents"]`, поскольку Codex использует два каталога:
`.codex/` для agents и `.agents/` для skills. Поле `paths` ДОЛЖНО
содержать `{ skills: ".agents/skills", agents: ".codex/agents" }` —
skills размещаются в `.agents/skills/` (НЕ в `.codex/skills/`).

### Запись gemini

Запись `"gemini"` описывает агент Gemini (Google). Поле `instructionsFile`
ДОЛЖНО быть `"GEMINI.md"`, поскольку Gemini имеет собственный формат
файла инструкций (аналогично Claude с `CLAUDE.md`). Поле `dependsOn`
ДОЛЖНО быть пустым массивом. Поле `targetFiles` ДОЛЖНО содержать
`["GEMINI.md"]`, поскольку файл инструкций генерируется в корне проекта.
Поле `overlayImportPaths` ДОЛЖНО содержать `[".gemini", "**/GEMINI.md"]`.

## Процедура Resolve Adapter

Общая процедура разрешения адаптера для команд,
принимающих аргумент `--adapter`. Каждая такая команда
МОЖЕТ ссылаться на эту процедуру вместо повторного описания шагов.

Процедура принимает уже распарсенный `agentId`. Парсинг аргумента
`--adapter` из командной строки является ответственностью вызывающей
команды и НЕ ВХОДИТ в данную процедуру.

При использовании флага `--all` вместо `--adapter` процедура Resolve Adapter
НЕ вызывается — вызывающая команда ДОЛЖНА использовать все записи
из реестра адаптеров напрямую.

**Вход:**

- `agentId` (string, обязательно) — идентификатор адаптера из реестра.

**Поведение:**

1. Найти запись в реестре адаптеров с `id`, совпадающим
   со значением `agentId`.
2. Определить `projectRoot` как текущий рабочий каталог процесса
   (`process.cwd()`).

**Расширения:**

1a. Запись не найдена →
`Error("Unknown agent: {value}. Run 'agloom adapters' to see available adapters.")`.

1b. Запись найдена, но `entry.hidden === true` →
`Error("Adapter '{value}' cannot be used directly. It is included automatically as a dependency.")`.

**Результат:**

- `entry` (AdapterRegistryEntry) — запись адаптера из реестра.
- `projectRoot` (string) — абсолютный путь к корню проекта.

## Вне scope

- Глобальный scope (home directory).
- MCP-адаптеры для KiloCode, Codex и Gemini.
- Permissions-адаптеры для KiloCode, Codex и Gemini.
- Config transpiler (kilo.jsonc, config.toml, settings.json).
