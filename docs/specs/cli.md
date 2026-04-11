---
summary: CLI — Ink-based TUI интерфейс для Agloom
description: >
  CLI-модуль на базе React + Ink для запуска транспиляции канонических
  конфигураций в agent-specific файлы. Содержит встроенный реестр адаптеров,
  команды transpile и adapters, TUI-отображение прогресса.
type: spec
status: implemented
relates:
  - docs/specs/instructions-transpiler.md
  - docs/specs/skills-transpiler.md
  - docs/specs/agents-transpiler.md
  - docs/specs/interpolation.md
  - docs/specs/adapter-registry-ext.md
  - docs/specs/clean-command.md
  - docs/specs/init-command.md
  - docs/specs/config.md
  - docs/specs/help-command.md
  - docs/specs/plugin-loading.md
  - docs/specs/docs-transpiler.md
  - docs/specs/format.md
  - docs/specs/mcp-transpiler.md
  - docs/specs/permissions-transpiler.md
  - docs/specs/cli-global-flags.md
maps_to:
  - src/cli/
---

# CLI

Ключевые слова «ТРЕБУЕТСЯ», «ЗАПРЕЩАЕТСЯ», «ДОЛЖЕН», «НЕ ДОЛЖЕН», «СЛЕДУЕТ»,
«НЕ СЛЕДУЕТ», «МОЖЕТ» и «НЕОБЯЗАТЕЛЬНО» в этом документе толкуются
в соответствии с [RFC 2119](https://tools.ietf.org/html/rfc2119).

CLI-модуль для запуска транспиляции канонических конфигураций Agloom
в agent-specific файлы. Реализован на базе React + Ink (TUI framework).
Содержит встроенный реестр адаптеров и предоставляет команды для
транспиляции и просмотра доступных адаптеров.

Модуль является потребителем библиотек `instructions-transpiler`
(см. `docs/specs/instructions-transpiler.md`), `skills-transpiler`
(см. `docs/specs/skills-transpiler.md`) и `agents-transpiler`
(см. `docs/specs/agents-transpiler.md`).

## Зависимости

Модуль CLI добавляет следующие зависимости в `package.json`:

- `ink` — TUI framework для React.
- `ink-spinner` — spinner-компонент для Ink.
- `react` — peer dependency для Ink.
- Парсинг аргументов командной строки реализован встроенной функцией (внешний CLI-парсер НЕОБЯЗАТЕЛЕН).

## Типы данных

### AdapterRegistryEntry

Запись реестра адаптеров.

- `id` (string) — уникальный идентификатор адаптера (например, `"claude"`).
- `description` (string) — человекочитаемое описание адаптера.
- `instructions` (Adapter) — экземпляр адаптера для instructions-transpiler
  (см. `docs/specs/instructions-transpiler.md` § Интерфейс адаптера).
- `skills` (SkillAdapter) — экземпляр адаптера для skills-transpiler
  (см. `docs/specs/skills-transpiler.md` § Интерфейс адаптера).
- `agents` (AgentAdapter) — экземпляр адаптера для agents-transpiler
  (см. `docs/specs/agents-transpiler.md` § Интерфейс адаптера).

Дополнительные поля (`targetFiles`, `projectFiles`,
`instructionsFile`, `dependsOn`, `hidden`, `paths`) описаны
в `docs/specs/adapter-registry-ext.md` § Расширение AdapterRegistryEntry.

### TranspilerStepOutcome

Результат одного шага транспиляции (один транспилер).

- `name` (string: "Instructions" | "Skills" | "Agents") — отображаемое имя шага.
- `writtenCount` (number) — количество успешно записанных файлов.
- `errors` (array\<string>) — сообщения об ошибках (пустой массив при отсутствии).

## Реестр адаптеров

Реестр адаптеров — встроенный массив `AdapterRegistryEntry`.
Реестр является единственным местом определения списка поддерживаемых адаптеров.
Команды `transpile` и `adapters` читают данные из этого реестра.

### Состав реестра

| `id`         | `description`                                  | `instructions`    | `skills`               | `agents`               |
| ------------ | ---------------------------------------------- | ----------------- | ---------------------- | ---------------------- |
| `"claude"`   | `"Claude Code"`                                | `ClaudeAdapter`   | `ClaudeSkillAdapter`   | `ClaudeAgentAdapter`   |
| `"opencode"` | `"OpenCode"`                                   | `OpenCodeAdapter` | `OpenCodeSkillAdapter` | `OpenCodeAgentAdapter` |
| `"agentsmd"` | `"AGENTS.md (Codex, OpenCode, KiloCode, ...)"` | `AgentsMdAdapter` | `AgentsMdSkillAdapter` | `AgentsMdAgentAdapter` |

Адаптеры импортируются из соответствующих транспилер-модулей:

- `ClaudeAdapter`, `OpenCodeAdapter`, `AgentsMdAdapter` — из `src/instructions-transpiler/`.
- `ClaudeSkillAdapter`, `OpenCodeSkillAdapter`, `AgentsMdSkillAdapter` — из `src/skills-transpiler/`.
- `ClaudeAgentAdapter`, `OpenCodeAgentAdapter`, `AgentsMdAgentAdapter` — из `src/agents-transpiler/`.

`OpenCodeAdapter` является no-op для instructions: метод `transpile()` возвращает
пустой массив `OutputFile[]`. Генерация `AGENTS.md` из канонических инструкций
выполняется адаптером `AgentsMdAdapter`.

## Команда transpile

`agloom transpile [--adapter <adapterId>]... [--all] [--clean] [--verbose]` —
запускает транспиляцию всех трёх транспилеров последовательно. При одном
или нескольких `--adapter` используются указанные адаптеры; при `--all` —
все записи реестра последовательно; при отсутствии обоих — адаптеры
из конфигурационного файла (см. `docs/specs/config.md`).

**Аргументы:**

- `--adapter` (string, опционально, повторяемый) — идентификатор адаптера
  из реестра. МОЖЕТ быть указан несколько раз для транспиляции нескольких
  адаптеров за один запуск (например,
  `--adapter claude --adapter opencode`). Взаимоисключающий с `--all`.
  Повторяющиеся идентификаторы дедуплицируются с сохранением порядка
  первого появления.
- `--all` (boolean, опционально, default: false) — выполнить транспиляцию
  для всех адаптеров из реестра. Взаимоисключающий с `--adapter`.
- `--verbose` (boolean, опционально, default: false) — показывать все шаги,
  включая шаги с 0 файлов (см. "TUI-отображение прогресса" § Фильтрация шагов).

Аргумент `--clean` определён в `docs/specs/clean-command.md`
§ Расширение команды transpile.

Аргументы `--adapter` (даже если указан несколько раз) и `--all`
являются взаимоисключающими. При отсутствии обоих используется
конфигурационный файл (см. `docs/specs/config.md`).

**Поведение:**

1. Распарсить аргументы из командной строки: значения всех вхождений
   `--adapter` накопить в массив `adapterIds` в порядке появления;
   распарсить булевы флаги `--all` и `--verbose`.
2. Получить `paths` (ResolvedPaths) и `loadedConfig` (LoadConfigResult)
   от front-end пайплайна (см. `docs/specs/cli-global-flags.md`
   § Процедура Run CLI). Определить `projectRoot` как `paths.writeRoot`,
   `resourcesRoot` как `paths.resourcesRoot`.
3. Выполнить процедуру Resolve Adapters from CLI Args
   (см. `docs/specs/config.md`
   § Процедура Resolve Adapters from CLI Args)
   с `adapterIds`, `all`, `loadedConfig`, `"transpile"`.
4. Для каждой записи из полученного списка:
   4.1. Отобразить заголовок с spinner
   (см. "TUI-отображение прогресса" § Заголовок).
   4.2. Выполнить шаг транспиляции "Instructions" (см. "Шаг транспиляции")
   с адаптером `entry.instructions` и `projectRoot`. Если
   `resourcesRoot !== path.join(projectRoot, ".agloom")` — дополнительно
   передать `sourceRoot = resourcesRoot` и `agloomDir = "."`
   (см. `docs/specs/plugin-loading.md`
   § Расширение процедуры «Шаг транспиляции»).
   4.3. Выполнить шаг транспиляции "Skills" (см. "Шаг транспиляции")
   с адаптером `entry.skills` и `projectRoot`; правило передачи
   `sourceRoot`/`agloomDir` идентично шагу 4.2.
   4.4. Выполнить шаг транспиляции "Agents" (см. "Шаг транспиляции")
   с адаптером `entry.agents` и `projectRoot`; правило передачи
   `sourceRoot`/`agloomDir` идентично шагу 4.2.
   4.5. Отобразить результаты шагов в TUI
   (см. "TUI-отображение прогресса" § Результат шага).
5. Вычислить `totalWritten` как сумму `writtenCount` всех шагов.
6. Отобразить итоговую строку
   (см. "TUI-отображение прогресса" § Итоговая строка).
7. Завершить процесс с exit code (см. "Exit codes").

Дедупликация по output path выполняется на уровне `writeResults` каждого
транспилера (см. `docs/specs/instructions-transpiler.md` § Запись результатов).
CLI-уровень передаёт результаты в `writeResults` без собственной дедупликации.

**Расширения:**

3a. Resolve Adapters from CLI Args вернул ошибку → отобразить
сообщение ошибки; процесс завершается с exit code 1.

**Результат:**

Вывод TUI-прогресса в stdout. Процесс завершается с exit code 0 или 1
(см. "Exit codes").

## Разрешение зависимостей

Процедура построения упорядоченного списка записей для транспиляции.
Используется режимом `--adapter` для автоматического включения
зависимостей указанного адаптера.

**Вход:**

- `entryId` (string, обязательно) — идентификатор запрошенного адаптера.
- `registry` (array\<AdapterRegistryEntry>, обязательно) — реестр адаптеров.

**Поведение:**

1. Рекурсивно собрать все записи, необходимые для транспиляции:
   начиная с записи `entryId`, для каждого `id` из `entry.dependsOn`
   рекурсивно добавить зависимость и её зависимости.
   Каждая запись ДОЛЖНА присутствовать в результате не более одного раза
   (дедупликация по `id`).

**Расширения:**

1a. Обнаружен цикл зависимостей → `Error("Circular dependency detected")`.

1b. Зависимость не найдена в реестре →
`Error("Unknown dependency: {id}")`.

**Результат:**

`AdapterRegistryEntry[]` — упорядоченный список записей для транспиляции
в топологическом порядке: зависимости идут перед зависящими от них записями.

**Пример:**

При `entryId = "opencode"` и реестре где `opencode.dependsOn = ["agentsmd"]`:
результат = `[agentsmd, opencode]`.

При `entryId = "claude"` и `claude.dependsOn = []`:
результат = `[claude]`.

## Шаг транспиляции

Общий паттерн выполнения одного транспилера в рамках команды `transpile`.
Шаг выполняется три раза — по одному для каждого транспилера
(Instructions, Skills, Agents).

**Вход:**

- `transpilerFactory` (function, обязательно) — фабричная функция транспилера
  (`createInstructionsTranspiler`, `createSkillsTranspiler`
  или `createAgentsTranspiler`).
- `adapter` (object, обязательно) — экземпляр адаптера для данного транспилера.
- `projectRoot` (string, обязательно) — абсолютный путь к корню проекта
  (writeRoot: база для записи результатов; см.
  `docs/specs/cli-global-flags.md` § Модель развязки абстракций).
- `name` (string: "Instructions" | "Skills" | "Agents", обязательно) — имя шага.

Дополнительные параметры `sourceRoot` и `agloomDir` определены
в `docs/specs/plugin-loading.md` § Расширение процедуры «Шаг транспиляции».
Они используются как для плагинов, так и для локального проекта
с кастомным `--agloom-dir`: вызывающий код команды `transpile`
при `ResolvedPaths.resourcesRoot !== path.join(writeRoot, ".agloom")`
передаёт в «Шаг транспиляции» `sourceRoot = resourcesRoot`
и `agloomDir = "."` через то же расширение
(см. `docs/specs/cli-global-flags.md` § Модель развязки абстракций).
Концепт `resourcesRoot` существует на уровне CLI front-end
(в `ResolvedPaths`) и НЕ является отдельным параметром «Шаг транспиляции».

**Поведение:**

1. Создать экземпляр транспилера вызовом
   `transpilerFactory({ projectRoot, adapters: [adapter] })`.
2. Вызвать `transpiler.transpile()`, получив `transpileResults`.
3. Вызвать `transpiler.writeResults(transpileResults)`, получив `writeResult`.
   `writeResults()` НЕ ДОЛЖЕН выбрасывать исключений — ошибки записи
   возвращаются в массиве `writeResult.errors`.
4. Определить `writtenCount` как длину `writeResult.written`.
5. Определить `errors` как массив сообщений из `writeResult.errors`
   (`writeResult.errors.map(e => e.message)`).
6. Сформировать `TranspilerStepOutcome` с `name`, `writtenCount`, `errors`.

**Расширения:**

2a. `transpile()` выбрасывает исключение → сформировать
`TranspilerStepOutcome` с `writtenCount: 0` и `[exception.message]`
в `errors`; пропустить шаги 3-5.

**Результат:**

`TranspilerStepOutcome`.

## Обработка ошибок транспиляции

Команда `transpile` ДОЛЖНА конвертировать все фатальные ошибки шагов
транспиляции (Instructions, Skills, Agents, MCP, Permissions, Docs,
Schemas, Overlay) в структурированные записи `TranspilerStepOutcome.errors`,
вместо того чтобы распространять исключения до уровня React/Ink
рендеринга или Node.js runtime.

### Общий контракт шагов

Каждая процедура-раннер шага транспиляции — `runTranspileStep`
(см. § Шаг транспиляции) и `runOverlayStep`
(см. `docs/specs/provider-overlay.md` § Операция overlay,
`docs/specs/layer-model.md` § Расширение «Операция overlay»
для multi-layer режима) — ЗАПРЕЩЕНО выбрасывать исключения наружу.
Любая ошибка, возникшая во время выполнения шага, ДОЛЖНА быть
возвращена как элемент массива `TranspilerStepOutcome.errors`
текущего шага. Шаг ДОЛЖЕН быть сформирован даже при фатальном
прерывании: `writtenCount` отражает число файлов, успешно
записанных до момента прерывания (частичный прогресс шага),
`errors` содержит минимум одно сообщение с причиной прерывания.

Этот контракт симметричен контракту `writeResults` транспилеров
(см. § Шаг транспиляции, шаг 3): ошибки возвращаются в структуре,
а не бросаются как исключения.

### Сохранение прогресса между шагами

При возникновении фатальной ошибки в одном из шагов результаты всех
предшествующих успешно завершённых шагов (включая шаги предыдущих
адаптеров при мульти-адаптерном запуске) ДОЛЖНЫ быть сохранены
в массиве `entryResults` и отображены в TUI
(см. § TUI-отображение прогресса). Стратегия выполнения последующих
шагов внутри того же адаптера после фатальной ошибки шага определяется
спецификацией соответствующего шага.

TranspileView ДОЛЖЕН отрисовать финальный фрейм, содержащий:

1. Результаты всех завершённых шагов (успешные шаги через блок
   «Успешный шаг», см. § TUI-отображение прогресса § Результат шага).
2. Результат шага, в котором возникла фатальная ошибка (через
   блок «Неуспешный шаг» с сообщением ошибки).
3. Итоговую строку (см. § TUI-отображение прогресса § Итоговая строка)
   с префиксом `"Failed."`.

Отрисовка финального фрейма ДОЛЖНА происходить до размонтирования
Ink-приложения. ЗАПРЕЩЕНО завершать процесс выбросом необработанного
исключения: пользователь ДОЛЖЕН увидеть структурированный вывод
с именем шага и текстом ошибки вместо stack trace.

### Категории фатальных ошибок

Нижеследующие классы ошибок ДОЛЖНЫ обрабатываться по контракту
§ Общий контракт шагов:

- `LayerMergeError` (см. `docs/specs/layer-model.md`
  § Парсинг файлов для merge) — невалидный base или incoming файл
  в merge-eligible формате. Возникает внутри `runOverlayStep`
  в multi-layer режиме. Сообщение, добавляемое в `errors`, ДОЛЖНО
  содержать:
  - абсолютный путь к невалидному файлу;
  - формат файла (расширение);
  - сообщение исходного парсера (с указанием offset/line/column,
    если парсер его предоставляет);
  - указание на следующее действие пользователя в виде текста
    `"Please fix or remove the file and retry transpilation."`.
- `InterpolationError` (см. `docs/specs/interpolation.md`
  § Классы ошибок) — неизвестная переменная или ошибка разрешения
  `${env:*}` / `${values:*}`. Возникает внутри шагов транспиляции
  и внутри `runOverlayStep`. Сообщение в `errors` ДОЛЖНО содержать
  относительный путь файла и причину.
- Ошибки I/O при чтении источников, создании каталогов, записи
  целевых файлов — добавляются в `errors` текущего шага
  с текстом, полученным из `Error.message` исходного исключения.
- Ошибки транспилеров, возникающие на стадии `transpile()`
  (см. § Шаг транспиляции, расширение 2a) — конвертируются
  в одно сообщение `errors[0] = exception.message`.

Ошибки, которые НЕ относятся к перечисленным категориям
(`TypeError`, `ReferenceError`, ошибки рантайма Node.js и т.п.),
НЕ ДОЛЖНЫ обрабатываться этим контрактом. Их распространение
до уровня Node.js runtime является индикатором бага Agloom
и обрабатывается стандартным механизмом uncaught exception.

### Формат отображения ошибки в TUI

Отображение ошибок шага следует блоку «Неуспешный шаг»
(см. § TUI-отображение прогресса § Результат шага). Первая строка
массива `errors` выводится на одной строке с именем шага; каждая
последующая строка — на отдельной строке с отступом.

Для `LayerMergeError` сообщение ДОЛЖНО быть разбито на несколько
строк массива `errors` так, чтобы первая строка однозначно
идентифицировала файл и формат, а последующие строки содержали
сообщение парсера и инструкцию
`"Please fix or remove the file and retry transpilation."`.
Каждая логическая строка ДОЛЖНА быть отдельным элементом массива
`errors`, чтобы существующий механизм построчного рендеринга
(см. § TUI-отображение прогресса § Неуспешный шаг) отрисовал её
на отдельной строке с отступом.

### Exit code

При наличии хотя бы одной записи в `errors` любого шага любого
адаптера exit code процесса ДОЛЖЕН быть `1` (см. § Exit codes).
Exit code `0` ДОЛЖЕН устанавливаться только если все
`TranspilerStepOutcome.errors` всех выполненных шагов пусты.
Частичный успех (некоторые шаги записали файлы, другие упали)
завершается с exit code `1`; значение `totalWritten` в итоговой
строке отражает фактически записанные файлы.

## Команда adapters

`agloom adapters [--all]` — выводит список адаптеров. Без `--all`
отображает активные адаптеры из конфига; с `--all` — все доступные
адаптеры. Скрытые адаптеры (см. `docs/specs/adapter-registry-ext.md`
§ Расширение AdapterRegistryEntry, поле `hidden`) не отображаются.

**Аргументы:**

- `--all` (boolean, опционально, default: false) — отобразить все
  доступные (нескрытые) адаптеры из реестра вместо активных из конфига.

**Поведение:**

1. Распарсить аргумент `--all` из командной строки.
2. Получить `paths` (ResolvedPaths) и `loadedConfig` (LoadConfigResult)
   от front-end пайплайна (см. `docs/specs/cli-global-flags.md`
   § Процедура Run CLI). Собственный вызов Load Config ЗАПРЕЩЁН:
   `adapters --all` ИЛИ команда без `--all` использует готовый
   `loadedConfig`.
3. Если `--all` не указан: использовать `loadedConfig.adapterIds`
   как источник списка активных адаптеров (без повторного вызова
   Load Config).
4. Определить заголовок и список записей для отображения:
   - Если `--all` указан — заголовок `"Available adapters:"`,
     список: все записи реестра с `hidden !== true`.
   - Если `loadedConfig.adapterIds !== null` — заголовок
     `"Active adapters:"`, список: записи реестра, соответствующие
     `loadedConfig.adapterIds`.
   - Если `loadedConfig.adapterIds === null` (поле `adapters`
     отсутствовало в источнике, дефолтный файл не существует, или
     stdin был пуст) — заголовок `"Available adapters:"`, список:
     все записи реестра с `hidden !== true`.
5. Отобразить заголовок.
6. Для каждой записи из списка отобразить строку с `id`
   и `description`, разделёнными пробелами.

**Расширения:**

Нет расширений. Ошибки Load Config поймались на этапе Run CLI
(см. `docs/specs/cli-global-flags.md` § Процедура Run CLI,
расширение 2a) и завершили процесс до запуска команды `adapters`.

**Результат:**

При наличии конфига с `adapters: [claude, opencode]`:

```text
Active adapters:

  claude       Claude Code
  opencode     OpenCode
```

При отсутствии конфига или с `--all`:

```text
Available adapters:

  claude       Claude Code
  opencode     OpenCode
```

Процесс завершается с exit code 0.

## Глобальные опции

Помимо `--help` и `--version`, CLI поддерживает три глобальных флага
для переопределения источников конфигурации:

- `--project-dir <path>` — корень проекта для записи выходных файлов.
- `--agloom-dir <path>` — директория с каноническими ресурсами agloom.
- `--config <path|->` — файл конфигурации или stdin (`-`).

Семантика флагов, chained defaults, правила существования путей,
front-end пайплайн парсинга/валидации и применение per-command
определены в `docs/specs/cli-global-flags.md`. Все команды CLI
(`transpile`, `clean`, `init`, `adapters`, `format`, `help`,
`version`, `--version`, `--help`, вызов без команды) проходят через
единый пайплайн (см. `docs/specs/cli-global-flags.md` § Процедура Run CLI)
до обработки командно-специфичной логики.

Вывод команд `transpile --help` и иных `<command> --help` ДОЛЖЕН
перечислять три глобальных флага в разделе Options.

### --help

`agloom --help` — отображает общую справку.

**Вход:**

Нет входных параметров.

**Поведение:**

1. Пройти front-end пайплайн (см. `docs/specs/cli-global-flags.md`
   § Процедура Run CLI). При несуществующем явном пути в одном
   из трёх глобальных флагов — завершиться с ошибкой валидации
   до отображения справки.
2. Отобразить описание программы.
3. Отобразить список доступных команд (`transpile`, `clean`, `init`, `adapters`,
   `help`) с кратким описанием каждой. Описание команды `init`:
   `Import existing agent configs into .agloom/`.
   Описание команды `help`:
   `Show help topics or display a specific help topic`.
4. Отобразить список глобальных опций (`--help`, `--version`,
   `--project-dir`, `--agloom-dir`, `--config`).

**Расширения:**

1a. Front-end пайплайн вернул ошибку валидации глобальных флагов →
отобразить сообщение ошибки; exit code 1. Справка НЕ отображается.

**Результат:**

Вывод справки в stdout. Процесс завершается с exit code 0.

Каждая команда ДОЛЖНА поддерживать опцию `--help`:

- `agloom transpile --help` — справка по команде `transpile`.
- `agloom adapters --help` — справка по команде `adapters`.

Вывод `agloom transpile --help` ДОЛЖЕН содержать строку usage:

```text
Usage: agloom transpile [--adapter <adapterId>]... [--all] [--clean] [--verbose]
```

Вывод `agloom adapters --help`:

```text
Usage: agloom adapters [--all]

Show active adapters from config, or all available adapters.

Options:
  --all  Show all available adapters (not just those in config)
```

### --version

`agloom --version` или `agloom version` — отображает версию программы.

**Вход:**

Нет входных параметров.

**Поведение:**

1. Пройти front-end пайплайн (см. `docs/specs/cli-global-flags.md`
   § Процедура Run CLI). При несуществующем явном пути в одном
   из трёх глобальных флагов — завершиться с ошибкой валидации
   до печати версии.
2. Прочитать значение поля `version` из `package.json`.
3. Отобразить прочитанное значение.

**Расширения:**

1a. Front-end пайплайн вернул ошибку валидации глобальных флагов →
отобразить сообщение ошибки; exit code 1. Версия НЕ отображается.

**Результат:**

Вывод версии в stdout (например, `"0.1.0"`). Процесс завершается
с exit code 0.

### Вызов без команды

При вызове `agloom` без указания команды ДОЛЖНА отображаться
общая справка (аналогично `agloom --help`). Процесс завершается
с exit code 0.

### Неизвестная команда

При вызове `agloom <unknown>`, где `<unknown>` не является
известной командой (`transpile`, `clean`, `init`, `adapters`, `help`)
и не является флагом (не начинается с `--`), ДОЛЖНО отображаться
сообщение:

```text
Unknown command: {cmd}. Run 'agloom --help' to see available commands.
```

Наличие флага `--help` в аргументах НЕ ДОЛЖНО подавлять ошибку
неизвестной команды. Приоритет ошибки неизвестной команды ДОЛЖЕН
быть выше, чем отображение глобальной справки `--help`.

Процесс завершается с exit code 1.

## TUI-отображение прогресса

Правила рендеринга прогресса для команды `transpile`.
Рендеринг выполняется компонентами React + Ink.

### Заголовок

Во время выполнения транспиляции отображается строка со spinner
(компонент `ink-spinner`). По завершении операции spinner
заменяется на символ `✓` (зелёный) если все шаги записи успешны,
или на символ `✗` (красный) если хотя бы один шаг содержит ошибки:

```text
◐ Transpiling for {adapterId}...   ← во время выполнения
✓ Transpiling for {adapterId}...   ← после завершения (все шаги успешны)
✗ Transpiling for {adapterId}...   ← после завершения (есть ошибки)
```

### Результат шага

Выравнивание колонок: имя шага выравнивается по левому краю
до 14 символов (`name.padEnd(14)`), количество файлов
выравнивается по правому краю до 4 символов
(`writtenCount.padStart(4)`).

#### Успешный шаг

Шаг без ошибок (`errors` пуст) отображается как:

```text
  ✓ {name.padEnd(14)}{writtenCount.padStart(4)} files
```

Символ `✓` СЛЕДУЕТ отображать зелёным цветом.

#### Неуспешный шаг

Шаг с ошибками (`errors` непуст) отображается как:

```text
  ✗ {name.padEnd(14)}{errors[0]}
      {errors[1]}
      {errors[2]}
      ...
```

Символ `✗` СЛЕДУЕТ отображать красным цветом.
Первая ошибка отображается на строке с именем шага.
Последующие ошибки отображаются на отдельных строках с отступом.
ТРЕБУЕТСЯ отображать все ошибки из массива `errors`, а не только первую.

### Фильтрация шагов (--verbose)

Без `--verbose`: шаги с `writtenCount === 0` и пустым `errors`
скрываются. Если для записи все шаги скрыты — заголовок записи
также не отображается. Если все шаги всех записей скрыты
и нет ошибок — отображается `"Nothing to transpile."`.

С `--verbose`: все шаги отображаются, включая шаги с 0 файлов.

### Итоговая строка

После завершения всех шагов отображается пустая строка,
затем итоговая строка:

```text
Done. {totalWritten} files written.
```

При наличии ошибок хотя бы в одном шаге итоговая строка ДОЛЖНА
отображать `"Failed."` вместо `"Done."`:

```text
Failed. {totalWritten} files written.
```

Значение `totalWritten` — сумма `writtenCount` всех шагов,
включая шаги с ошибками (частично записанные файлы учитываются).
Итоговая строка отображается всегда, независимо от `--verbose`.

### Пример полного вывода (успех)

```text
✓ Transpiling for claude...
  ✓ Instructions     3 files
  ✓ Skills           5 files
  ✓ Agents           2 files

Done. 10 files written.
```

### Пример полного вывода (частичная ошибка)

```text
✗ Transpiling for claude...
  ✓ Instructions     3 files
  ✓ Skills           5 files
  ✗ Agents        Failed to write .claude/agents/reviewer.md: EACCES

Failed. 8 files written.
```

## Exit codes

- `0` — все шаги транспиляции завершились без ошибок
  (массив `errors` пуст в каждом `TranspilerStepOutcome`).
- `1` — хотя бы один шаг транспиляции завершился с ошибками,
  указаны `--adapter` и `--all` одновременно, в `.agloom/config.yml`
  отсутствует поле `adapters` (или сам файл) при отсутствии
  `--adapter` и `--all`, ошибка конфига, указанный адаптер не найден
  или скрытый, или вызвана неизвестная команда.

## Конфигурация сборки

### Entry point

Точка входа CLI-модуля: `src/cli/index.tsx`.

### package.json

В `package.json` ТРЕБУЕТСЯ добавить:

- Поле `bin`:

  ```json
  {
    "bin": {
      "agloom": "./dist/cli/index.js"
    }
  }
  ```

- Скрипт `build` в `scripts`:

  ```json
  {
    "scripts": {
      "build": "tsc"
    }
  }
  ```

### tsconfig.json

В `tsconfig.json` ТРЕБУЕТСЯ внести следующие изменения:

- Поле `include` ДОЛЖНО содержать паттерн `"src/**/*.tsx"`
  помимо существующего `"src/**/*.ts"`.
- Поле `jsx` ДОЛЖНО быть установлено в значение `"react-jsx"`
  для поддержки JSX-синтаксиса Ink-компонентов.

## Вне scope

Следующие аспекты НЕ ВХОДЯТ в scope данной спецификации:

- Watch mode (отслеживание изменений файлов).
- Флаг `--dry-run` (пробный запуск без записи файлов).
- Адаптеры для Codex CLI и Gemini CLI.
- Очистка устаревших agent-specific файлов.
