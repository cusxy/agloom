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
  - docs/specs/adapter-registry-ext.md
  - docs/specs/clean-command.md
  - docs/specs/init-command.md
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

Дополнительные поля (`targetRoot`, `targetFiles`, `projectFiles`,
`instructionsFile`, `dependsOn`) описаны в `docs/specs/adapter-registry-ext.md`
§ Расширение AdapterRegistryEntry.

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

`agloom transpile (--adapter <adapterId> | --all) [--clean] [--verbose]` — запускает
транспиляцию всех трёх транспилеров последовательно. При `--adapter`
используется указанный адаптер; при `--all` — все записи реестра
последовательно.

**Аргументы:**

- `--adapter` (string, опционально) — идентификатор адаптера из реестра.
  Взаимоисключающий с `--all`.
- `--all` (boolean, опционально, default: false) — выполнить транспиляцию
  для всех адаптеров из реестра. Взаимоисключающий с `--adapter`.
- `--verbose` (boolean, опционально, default: false) — показывать все шаги,
  включая шаги с 0 файлов (см. "TUI-отображение прогресса" § Фильтрация шагов).

Аргумент `--clean` определён в `docs/specs/clean-command.md`
§ Расширение команды transpile.

Ровно один из `--adapter` и `--all` ТРЕБУЕТСЯ указать.

### Режим --adapter

**Поведение:**

1. Распарсить аргументы `--adapter` и `--all` из командной строки.
2. Найти запись в реестре адаптеров с `id`, совпадающим со значением `--adapter`.
3. Определить `projectRoot` как текущий рабочий каталог процесса (`process.cwd()`).
4. Разрешить зависимости: собрать упорядоченный список записей для транспиляции
   (см. «Разрешение зависимостей»).
5. Для каждой записи из упорядоченного списка:
   5.1. Отобразить заголовок с spinner (см. "TUI-отображение прогресса" § Заголовок).
   5.2. Выполнить шаг транспиляции "Instructions" (см. "Шаг транспиляции")
   с адаптером `entry.instructions`.
   5.3. Выполнить шаг транспиляции "Skills" (см. "Шаг транспиляции")
   с адаптером `entry.skills`.
   5.4. Выполнить шаг транспиляции "Agents" (см. "Шаг транспиляции")
   с адаптером `entry.agents`.
   5.5. Отобразить результаты шагов в TUI
   (см. "TUI-отображение прогресса" § Результат шага).
6. Вычислить `totalWritten` как сумму `writtenCount` всех шагов.
7. Отобразить итоговую строку (см. "TUI-отображение прогресса" § Итоговая строка).
8. Завершить процесс с exit code (см. "Exit codes").

**Расширения:**

1a. Ни `--adapter`, ни `--all` не указаны → отобразить сообщение
об обязательности одного из аргументов; процесс завершается с exit code 1.

1b. Указаны одновременно `--adapter` и `--all` → отобразить сообщение
о взаимоисключающих аргументах; процесс завершается с exit code 1.

2a. Запись с указанным `id` не найдена в реестре → отобразить сообщение
`"Unknown agent: {value}. Run 'agloom adapters' to see available adapters."`;
процесс завершается с exit code 1.

### Режим --all

**Поведение:**

1. Распарсить аргумент `--all` из командной строки.
2. Определить `projectRoot` как текущий рабочий каталог процесса (`process.cwd()`).
3. Для каждой записи реестра (в порядке определения в массиве):
   3.1. Отобразить заголовок с spinner для текущей записи.
   3.2. Выполнить шаг транспиляции "Instructions" (см. "Шаг транспиляции")
   с адаптером `entry.instructions`.
   3.3. Выполнить шаг транспиляции "Skills" (см. "Шаг транспиляции")
   с адаптером `entry.skills`.
   3.4. Выполнить шаг транспиляции "Agents" (см. "Шаг транспиляции")
   с адаптером `entry.agents`.
   3.5. Отобразить результаты шагов текущей записи в TUI.
4. Вычислить `totalWritten` как суммарный `writtenCount` всех шагов всех записей.
5. Отобразить итоговую строку.
6. Завершить процесс с exit code (см. "Exit codes").

Дедупликация по output path выполняется на уровне `writeResults` каждого
транспилера (см. `docs/specs/instructions-transpiler.md` § Запись результатов).
CLI-уровень передаёт результаты в `writeResults` без собственной дедупликации.

**Расширения:**

Нет расширений (расширения аргументов описаны в режиме --adapter § 1a, 1b).

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
- `projectRoot` (string, обязательно) — абсолютный путь к корню проекта.
- `name` (string: "Instructions" | "Skills" | "Agents", обязательно) — имя шага.

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

## Команда adapters

`agloom adapters` — выводит список доступных адаптеров из реестра.

**Вход:**

Нет входных параметров.

**Поведение:**

1. Прочитать все записи из реестра адаптеров.
2. Отобразить заголовок `"Available adapters:"`.
3. Для каждой записи отобразить строку с `id` и `description`,
   разделёнными пробелами.

**Расширения:**

Нет расширений.

**Результат:**

Вывод в stdout. Формат:

```text
Available adapters:

  claude       Claude Code
  opencode     OpenCode
  agentsmd     AGENTS.md (Codex, OpenCode, KiloCode, ...)
```

Процесс завершается с exit code 0.

## Глобальные опции

### --help

`agloom --help` или `agloom help` — отображает общую справку.

**Вход:**

Нет входных параметров.

**Поведение:**

1. Отобразить описание программы.
2. Отобразить список доступных команд (`transpile`, `clean`, `init`, `adapters`)
   с кратким описанием каждой. Описание команды `init`:
   `Import existing agent configs into .agloom/`.
3. Отобразить список глобальных опций (`--help`, `--version`).

**Расширения:**

Нет расширений.

**Результат:**

Вывод справки в stdout. Процесс завершается с exit code 0.

Каждая команда ДОЛЖНА поддерживать опцию `--help`:

- `agloom transpile --help` — справка по команде `transpile`.
- `agloom adapters --help` — справка по команде `adapters`.

Вывод `agloom transpile --help` ДОЛЖЕН содержать строку usage:

```text
Usage: agloom transpile (--adapter <adapterId> | --all) [--clean] [--verbose]
```

### --version

`agloom --version` или `agloom version` — отображает версию программы.

**Вход:**

Нет входных параметров.

**Поведение:**

1. Прочитать значение поля `version` из `package.json`.
2. Отобразить прочитанное значение.

**Расширения:**

Нет расширений.

**Результат:**

Вывод версии в stdout (например, `"0.1.0"`). Процесс завершается
с exit code 0.

### Вызов без команды

При вызове `agloom` без указания команды ДОЛЖНА отображаться
общая справка (аналогично `agloom --help`). Процесс завершается
с exit code 0.

### Неизвестная команда

При вызове `agloom <unknown>`, где `<unknown>` не является
известной командой (`transpile`, `clean`, `init`, `adapters`)
и не является флагом (не начинается с `--`), ДОЛЖНО отображаться
сообщение:

```text
Unknown command: {cmd}. Run 'agloom --help' to see available commands.
```

Процесс завершается с exit code 1.

## TUI-отображение прогресса

Правила рендеринга прогресса для команды `transpile`.
Рендеринг выполняется компонентами React + Ink.

### Заголовок

Во время выполнения транспиляции отображается строка со spinner
(компонент `ink-spinner`). По завершении операции spinner
заменяется на символ `✓` (зелёный):

```text
◐ Transpiling for {adapterId}...   ← во время выполнения
✓ Transpiling for {adapterId}...   ← после завершения
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
```

Символ `✗` СЛЕДУЕТ отображать красным цветом.
Отображается сообщение первой ошибки из массива `errors`.

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
✓ Transpiling for claude...
  ✓ Instructions     3 files
  ✓ Skills           5 files
  ✗ Agents        Failed to write .claude/agents/reviewer.md: EACCES

Done. 8 files written.
```

## Exit codes

- `0` — все шаги транспиляции завершились без ошибок
  (массив `errors` пуст в каждом `TranspilerStepOutcome`).
- `1` — хотя бы один шаг транспиляции завершился с ошибками,
  ни `--adapter`, ни `--all` не указаны, указаны оба одновременно,
  указанный адаптер не найден в реестре, или вызвана неизвестная команда.

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
- Конфигурационный файл (`.agloom.yml` и т.п.).
- Адаптеры для Codex CLI и Gemini CLI.
- Очистка устаревших agent-specific файлов.
