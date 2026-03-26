---
summary: CLI — Ink-based TUI интерфейс для Agent SDS
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
maps_to:
  - src/cli/
---

# CLI

Ключевые слова "ТРЕБУЕТСЯ", "ЗАПРЕЩАЕТСЯ", "ДОЛЖЕН", "НЕ ДОЛЖЕН", "СЛЕДУЕТ",
"НЕ СЛЕДУЕТ", "МОЖЕТ" и "НЕОБЯЗАТЕЛЬНО" в этом документе толкуются
в соответствии с [RFC 2119](https://tools.ietf.org/html/rfc2119).

CLI-модуль для запуска транспиляции канонических конфигураций Agent SDS
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

| `id`         | `description`   | `instructions`    | `skills`               | `agents`               |
| ------------ | --------------- | ----------------- | ---------------------- | ---------------------- |
| `"claude"`   | `"Claude Code"` | `ClaudeAdapter`   | `ClaudeSkillAdapter`   | `ClaudeAgentAdapter`   |
| `"opencode"` | `"OpenCode"`    | `OpenCodeAdapter` | `OpenCodeSkillAdapter` | `OpenCodeAgentAdapter` |

Адаптеры импортируются из соответствующих транспилер-модулей:

- `ClaudeAdapter`, `OpenCodeAdapter` — из `src/instructions-transpiler/`.
- `ClaudeSkillAdapter`, `OpenCodeSkillAdapter` — из `src/skills-transpiler/`.
- `ClaudeAgentAdapter`, `OpenCodeAgentAdapter` — из `src/agents-transpiler/`.

## Команда transpile

`agent-sds transpile --adapter <adapterId>` — запускает транспиляцию
всех трёх транспилеров последовательно с указанным адаптером.

**Вход:**

- `--adapter` (string, обязательно) — идентификатор адаптера из реестра.

**Поведение:**

1. Распарсить аргумент `--adapter` из командной строки.
2. Найти запись в реестре адаптеров с `id`, совпадающим со значением `--adapter`.
3. Определить `projectRoot` как текущий рабочий каталог процесса (`process.cwd()`).
4. Отобразить заголовок с spinner (см. "TUI-отображение прогресса" § Заголовок).
5. Выполнить шаг транспиляции "Instructions" (см. "Шаг транспиляции")
   с фабрикой `createInstructionsTranspiler` и адаптером `entry.instructions`.
6. Выполнить шаг транспиляции "Skills" (см. "Шаг транспиляции")
   с фабрикой `createSkillsTranspiler` и адаптером `entry.skills`.
7. Выполнить шаг транспиляции "Agents" (см. "Шаг транспиляции")
   с фабрикой `createAgentsTranspiler` и адаптером `entry.agents`.
8. Отобразить результаты всех шагов в TUI
   (см. "TUI-отображение прогресса" § Результат шага).
   Порядок отображения: Instructions → Skills → Agents.
9. Вычислить `totalWritten` как сумму `writtenCount` всех трёх шагов.
10. Отобразить итоговую строку (см. "TUI-отображение прогресса" § Итоговая строка).
11. Завершить процесс с exit code (см. "Exit codes").

**Расширения:**

1a. Аргумент `--adapter` не указан → CLI-парсер отображает сообщение
об обязательности аргумента `--adapter`; процесс завершается с exit code 1.

2a. Запись с указанным `id` не найдена в реестре → отобразить сообщение
`"Unknown adapter: {value}. Run 'agent-sds adapters' to see available adapters."`;
процесс завершается с exit code 1.

**Результат:**

Вывод TUI-прогресса в stdout. Процесс завершается с exit code 0 или 1
(см. "Exit codes").

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

`agent-sds adapters` — выводит список доступных адаптеров из реестра.

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
```

Процесс завершается с exit code 0.

## Глобальные опции

### --help

`agent-sds --help` или `agent-sds help` — отображает общую справку.

**Вход:**

Нет входных параметров.

**Поведение:**

1. Отобразить описание программы.
2. Отобразить список доступных команд (`transpile`, `adapters`)
   с кратким описанием каждой.
3. Отобразить список глобальных опций (`--help`, `--version`).

**Расширения:**

Нет расширений.

**Результат:**

Вывод справки в stdout. Процесс завершается с exit code 0.

Каждая команда ДОЛЖНА поддерживать опцию `--help`:

- `agent-sds transpile --help` — справка по команде `transpile`.
- `agent-sds adapters --help` — справка по команде `adapters`.

### --version

`agent-sds --version` или `agent-sds version` — отображает версию программы.

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

При вызове `agent-sds` без указания команды ДОЛЖНА отображаться
общая справка (аналогично `agent-sds --help`). Процесс завершается
с exit code 0.

## TUI-отображение прогресса

Правила рендеринга прогресса для команды `transpile`.
Рендеринг выполняется компонентами React + Ink.

### Заголовок

Во время выполнения транспиляции отображается строка со spinner
(компонент `ink-spinner`). Анимация spinner НЕОБЯЗАТЕЛЬНА — при быстрых
синхронных операциях spinner МОЖЕТ отображаться как статический символ:

```text
◐ Transpiling for {adapterId}...
```

### Результат шага

#### Успешный шаг

Шаг без ошибок (`errors` пуст) отображается как:

```text
  ✓ {name}        {writtenCount} files
```

Символ `✓` СЛЕДУЕТ отображать зелёным цветом.

#### Неуспешный шаг

Шаг с ошибками (`errors` непуст) отображается как:

```text
  ✗ {name}        {errors[0]}
```

Символ `✗` СЛЕДУЕТ отображать красным цветом.
Отображается сообщение первой ошибки из массива `errors`.

### Итоговая строка

После завершения всех трёх шагов отображается пустая строка,
затем итоговая строка:

```text
Done. {totalWritten} files written.
```

Значение `totalWritten` — сумма `writtenCount` всех трёх шагов,
включая шаги с ошибками (частично записанные файлы учитываются).

### Пример полного вывода (успех)

```text
◐ Transpiling for claude...
  ✓ Instructions  3 files
  ✓ Skills        5 files
  ✓ Agents        2 files

Done. 10 files written.
```

### Пример полного вывода (частичная ошибка)

```text
◐ Transpiling for claude...
  ✓ Instructions  3 files
  ✓ Skills        5 files
  ✗ Agents        Failed to write .claude/agents/reviewer.md: EACCES

Done. 8 files written.
```

## Exit codes

- `0` — все три шага транспиляции завершились без ошибок
  (массив `errors` пуст в каждом `TranspilerStepOutcome`).
- `1` — хотя бы один шаг транспиляции завершился с ошибками,
  аргумент `--adapter` не указан, или указанный адаптер не найден в реестре.

## Конфигурация сборки

### Entry point

Точка входа CLI-модуля: `src/cli/index.tsx`.

### package.json

В `package.json` ТРЕБУЕТСЯ добавить:

- Поле `bin`:

  ```json
  {
    "bin": {
      "agent-sds": "./dist/cli/index.js"
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
- Флаг `--verbose` (подробный вывод списка записанных файлов).
- Флаг `--dry-run` (пробный запуск без записи файлов).
- Команда `init` (инициализация проекта).
- Конфигурационный файл (`.agent-sds.yml` и т.п.).
- Короткий алиас бинарника (`sds`, `asds`).
- Адаптеры для Codex CLI и Gemini CLI.
- Очистка устаревших agent-specific файлов.
