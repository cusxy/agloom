---
summary: Расширение реестра адаптеров — targetRoot, targetFiles, projectFiles, instructionsFile, dependsOn, hidden, Resolve Adapter
description: >
  Расширяет AdapterRegistryEntry полями targetRoot, targetFiles, projectFiles,
  instructionsFile, dependsOn и hidden. Определяет общую процедуру Resolve Adapter
  для переиспользования в командах, принимающих --adapter.
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

- `targetRoot` (string, обязательно) — относительный путь к корневой директории
  agent-специфичных файлов (например, `".claude"`, `".opencode"`, `".agents"`).
- `targetFiles` (array\<string>, обязательно) — список относительных путей к файлам
  за пределами `targetRoot`, которые генерируются транспилерами
  (например, `["CLAUDE.md"]`). Массив МОЖЕТ быть пустым, если адаптер
  не генерирует файлов за пределами `targetRoot`.
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

## Обновление реестра адаптеров

В реестр адаптеров ТРЕБУЕТСЯ добавить поля `targetRoot`, `targetFiles`,
`projectFiles`, `instructionsFile`, `dependsOn`, `overlayImportPaths`
и `hidden` для каждой записи:

| `id`         | `targetRoot`  | `targetFiles`                         | `projectFiles`                        | `instructionsFile` | `dependsOn`    | `overlayImportPaths`                                   | `hidden` |
| ------------ | ------------- | ------------------------------------- | ------------------------------------- | ------------------ | -------------- | ------------------------------------------------------ | -------- |
| `"claude"`   | `".claude"`   | `["CLAUDE.md", ".mcp.json"]`          | `["CLAUDE.md"]`                       | `"CLAUDE.md"`      | `[]`           | `[".claude", "**/CLAUDE.md", ".mcp.json"]`             | `false`  |
| `"opencode"` | `".opencode"` | `["opencode.json"]`                   | `[]`                                  | `null`             | `["agentsmd"]` | `[".opencode", "opencode.json"]`                       | `false`  |
| `"agentsmd"` | `".agents"`   | `["AGENTS.md", "AGENTS.override.md"]` | `["AGENTS.md", "AGENTS.override.md"]` | `"AGENTS.md"`      | `[]`           | `[".agents", "**/AGENTS.md", "**/AGENTS.override.md"]` | `true`   |

### Запись agentsmd

Запись `"agentsmd"` представляет формат файлов `AGENTS.md`, используемый
несколькими агентами (OpenCode, Gemini CLI и др.). Поле `targetFiles`
ДОЛЖНО содержать `["AGENTS.md", "AGENTS.override.md"]`, поскольку оба файла
генерируются за пределами `targetRoot`. Файл `AGENTS.override.md` генерируется
из канонического `AGLOOM.override.md`. Запись `"opencode"` НЕ ДОЛЖНА
дублировать файлы, принадлежащие `"agentsmd"`: генерация `AGENTS.md`
и `AGENTS.override.md` ДОЛЖНА выполняться через адаптер `"agentsmd"`.

### Запись opencode

Запись `"opencode"` описывает агент OpenCode. Поле `targetFiles` ДОЛЖНО
содержать `["opencode.json"]`, поскольку файл `opencode.json` генерируется
MCP-транспилером (см. `docs/specs/mcp-transpiler.md`) и permissions-транспилером
(см. `docs/specs/permissions-transpiler.md`) за пределами `targetRoot`.
Файл `opencode.json` является merge-eligible: несколько транспилеров
генерируют отдельные секции (`mcp`, `permission`), которые объединяются
при записи в единый файл. Поле `overlayImportPaths` ДОЛЖНО содержать
`[".opencode", "opencode.json"]`, чтобы файл `opencode.json` включался
в overlay при выполнении `init`. Поле `projectFiles` ДОЛЖНО быть пустым
массивом, поскольку OpenCode не имеет уникальных файлов в project tree.
Поле `instructionsFile` ДОЛЖНО быть `null`, поскольку OpenCode не имеет
собственного формата файла инструкций.

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
- Адаптеры для Codex CLI и Gemini CLI.
