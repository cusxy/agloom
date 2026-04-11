---
summary: Глобальные CLI-флаги --project-dir, --agloom-dir, --config
description: >
  Три глобальных флага CLI для переопределения источников конфигурации agloom:
  --project-dir, --agloom-dir, --config. Модель chained defaults, правила
  существования путей, единый front-end пайплайн парсинга/валидации,
  развязка writeRoot / resourcesRoot / configSource в коде.
type: spec
status: implemented
relates:
  - docs/specs/cli.md
  - docs/specs/config.md
  - docs/specs/init-command.md
  - docs/specs/clean-command.md
  - docs/specs/help-command.md
  - docs/specs/format.md
  - docs/specs/plugin-loading.md
maps_to:
  - src/cli/
---

# Глобальные CLI-флаги

Ключевые слова «ТРЕБУЕТСЯ», «ЗАПРЕЩАЕТСЯ», «ДОЛЖЕН», «НЕ ДОЛЖЕН», «СЛЕДУЕТ»,
«НЕ СЛЕДУЕТ», «МОЖЕТ» и «НЕОБЯЗАТЕЛЬНО» в этом документе толкуются
в соответствии с [RFC 2119](https://tools.ietf.org/html/rfc2119).

Данная спецификация описывает три глобальных флага командной строки,
переопределяющих источники конфигурации agloom: `--project-dir`,
`--agloom-dir`, `--config`. Флаги применимы ко всем командам CLI
(см. `docs/specs/cli.md` § Команды) и обрабатываются единым front-end
пайплайном до передачи управления конкретной команде.

Мотивация — возможность одноразового запуска agloom с альтернативным
конфигом или ресурсами без модификации файлов в проекте: try-режим для
плагина из git, применение чужого набора ресурсов в собственном проекте,
полный custom-запуск с раздельными read/write путями.

## Термины

- **writeRoot** — абсолютный путь к корню проекта, в который CLI
  записывает сгенерированные agent-specific файлы (CLAUDE.md,
  AGENTS.md, `.claude/`, и т.д.). Соответствует значению `--project-dir`.
- **resourcesRoot** — абсолютный путь к директории, из которой CLI
  читает канонические ресурсы agloom (skills, agents, overlays, и т.д.).
  Соответствует значению `--agloom-dir`.
- **configSource** — дескриптор источника конфигурационного файла.
  Соответствует значению `--config`.

Эти три понятия развязаны: одна роль — один параметр
(см. § Модель развязки абстракций).

## Типы данных

### ConfigSource

Дескриптор источника конфигурационного файла.

- `kind` (string: "file" | "stdin", обязательно) — тип источника.
- `path` (string, обязательно при `kind === "file"`) — абсолютный путь
  к файлу конфигурации. Отсутствует при `kind === "stdin"`.
- `baseDir` (string, обязательно) — абсолютный путь к директории,
  относительно которой ТРЕБУЕТСЯ разрешать относительные пути,
  записанные внутри YAML-содержимого конфига. При `kind === "file"`
  значение равно `path.dirname(path)`. При `kind === "stdin"` значение
  равно текущему рабочему каталогу процесса (`process.cwd()`).

### ResolvedPaths

Результат front-end пайплайна — итоговый набор путей, передаваемый
в конкретную команду CLI.

- `writeRoot` (string, обязательно) — абсолютный путь, итог резолва
  `--project-dir`.
- `resourcesRoot` (string, обязательно) — абсолютный путь, итог резолва
  `--agloom-dir`.
- `configSource` (ConfigSource, обязательно) — итог резолва `--config`.
- `explicit` (object, обязательно) — какие флаги указаны явно пользователем.
  - `projectDir` (boolean) — `true` если передан `--project-dir`.
  - `agloomDir` (boolean) — `true` если передан `--agloom-dir`.
  - `config` (boolean) — `true` если передан `--config`.

## Флаги

### --project-dir

`--project-dir <path>` — абсолютный или относительный путь к корню
проекта (writeRoot). Относительный путь разрешается относительно текущего
рабочего каталога процесса.

- Тип значения: `string`.
- Обязательность: опционально.
- Значение по умолчанию: `process.cwd()` (текущий рабочий каталог).
- Каскадирует в дефолты `--agloom-dir` и `--config` (см. § Правила каскада).

### --agloom-dir

`--agloom-dir <path>` — абсолютный или относительный путь к директории
с каноническими ресурсами agloom (resourcesRoot). Относительный путь
разрешается относительно текущего рабочего каталога процесса
(НЕ относительно `--project-dir`).

- Тип значения: `string`.
- Обязательность: опционально.
- Значение по умолчанию: `<project-dir-resolved>/.agloom` — производится
  от итогового значения `--project-dir` после каскада.
- Каскадирует в дефолт `--config` (см. § Правила каскада).

### --config

`--config <path|->` — абсолютный или относительный путь к файлу
конфигурации, либо строка `-` для чтения конфига из stdin. Относительный
путь разрешается относительно текущего рабочего каталога процесса.

- Тип значения: `string`.
- Обязательность: опционально.
- Значение по умолчанию: `<agloom-dir-resolved>/config.yml` — производится
  от итогового значения `--agloom-dir` после каскада.
- Специальное значение `-` означает чтение YAML-содержимого из stdin.

Синтаксис всех трёх флагов — `--flag <value>` (значение передаётся
отдельным позиционным токеном), а не `--flag=<value>`. Это соответствует
существующему стилю парсинга аргументов в CLI
(см. `docs/specs/cli.md` § Команда transpile).

## Правила каскада

Переопределение верхнего по каскаду флага изменяет дефолты нижних,
если нижние не переопределены явно. Переопределение нижнего флага
НЕ изменяет дефолты верхних.

Каскадный порядок (сверху вниз): `--project-dir` → `--agloom-dir` →
`--config`.

Формально — дефолты вычисляются последовательно:

1. Если `--project-dir` указан явно — `projectDirResolved` равен
   `path.resolve(process.cwd(), <value>)`. Иначе — равен `process.cwd()`.
2. Если `--agloom-dir` указан явно — `agloomDirResolved` равен
   `path.resolve(process.cwd(), <value>)`. Иначе — равен
   `path.join(projectDirResolved, ".agloom")`.
3. Если `--config` указан явно и равен `-` — `configSource.kind = "stdin"`.
   Если `--config` указан явно и отличен от `-` — `configSource.kind = "file"`,
   `configSource.path = path.resolve(process.cwd(), <value>)`. Иначе —
   `configSource.kind = "file"`, `configSource.path = path.join(agloomDirResolved, "config.yml")`.
4. `configSource.baseDir` вычисляется по § Тип ConfigSource.

Примеры (при `cwd = /home/user/proj`):

| Явно переданы флаги                                            | `writeRoot`       | `resourcesRoot`           | `configSource`                                                 |
| -------------------------------------------------------------- | ----------------- | ------------------------- | -------------------------------------------------------------- |
| (нет)                                                          | `/home/user/proj` | `/home/user/proj/.agloom` | `{ kind: "file", path: "/home/user/proj/.agloom/config.yml" }` |
| `--project-dir /x`                                             | `/x`              | `/x/.agloom`              | `{ kind: "file", path: "/x/.agloom/config.yml" }`              |
| `--agloom-dir /y/.agloom`                                      | `/home/user/proj` | `/y/.agloom`              | `{ kind: "file", path: "/y/.agloom/config.yml" }`              |
| `--config /z/try.yml`                                          | `/home/user/proj` | `/home/user/proj/.agloom` | `{ kind: "file", path: "/z/try.yml" }`                         |
| `--project-dir /x --config /z/try.yml`                         | `/x`              | `/x/.agloom`              | `{ kind: "file", path: "/z/try.yml" }`                         |
| `--config /a/try.yml --agloom-dir /b/.agloom --project-dir /c` | `/c`              | `/b/.agloom`              | `{ kind: "file", path: "/a/try.yml" }`                         |
| `--config -`                                                   | `/home/user/proj` | `/home/user/proj/.agloom` | `{ kind: "stdin", baseDir: "/home/user/proj" }`                |
| `--project-dir /x --config -`                                  | `/x`              | `/x/.agloom`              | `{ kind: "stdin", baseDir: "/home/user/proj" }`                |

Обратите внимание на последнюю строку: `configSource.baseDir` для
`--config -` равен `cwd` (`/home/user/proj`), а НЕ `writeRoot` (`/x`).
Это следует из правила «stdin не имеет физического расположения,
базой становится текущий рабочий каталог процесса»
(см. § Тип ConfigSource и § Разрешение относительных путей внутри
YAML-конфига). Относительные пути, записанные в stdin-YAML, будут
резолвиться относительно `cwd` процесса, а не значения `--project-dir`
или `--agloom-dir`, что отличает эту комбинацию от любого другого
варианта каскада.

## Правила существования путей

- Если флаг указан **явно** — соответствующий путь ДОЛЖЕН существовать,
  иначе front-end пайплайн завершает процесс с ошибкой.
- Если флаг **не указан** (используется дефолт) — отсутствие пути НЕ является
  ошибкой; команда работает в empty-state согласно своей семантике.

Конкретные правила по флагам:

- `--project-dir <dir>` явно → `<dir>` ДОЛЖЕН существовать и быть директорией.
- `--agloom-dir <dir>` явно → `<dir>` ДОЛЖЕН существовать и быть директорией.
- `--config <file>` явно, `<file> !== "-"` → `<file>` ДОЛЖЕН существовать
  и быть обычным файлом.
- `--config -` явно → stdin читается как валидный источник; пустой stdin
  эквивалентен пустому YAML-конфигу (не ошибка).
- Дефолтный `writeRoot` отсутствует → не ошибка (empty-state).
- Дефолтный `resourcesRoot` отсутствует → не ошибка (empty-state).
- Дефолтный `configSource.path` отсутствует → не ошибка, Load Config
  возвращает пустой результат (см. `docs/specs/config.md`
  § Процедура Load Config).

## Разрешение относительных путей внутри YAML-конфига

Пути, записанные **внутри** YAML-содержимого конфига (например, поле
`plugins: path: ./foo`, относительные пути в `overlay:`, и иные поля,
интерпретируемые как пути), ТРЕБУЕТСЯ резолвить относительно значения
`configSource.baseDir` (см. § Тип ConfigSource), независимо от значений
`--project-dir` и `--agloom-dir`.

- Для `configSource.kind === "file"` — база равна `path.dirname(configSource.path)`.
- Для `configSource.kind === "stdin"` — база равна `process.cwd()`.

Это соответствует конвенции helm/docker-compose, где пути в конфиге
резолвятся относительно физического расположения самого файла конфига.

При использовании дефолтного пути конфига (`<agloom-dir-resolved>/config.yml`)
базой является `<agloom-dir-resolved>`, что совпадает с текущим
поведением, где конфиг лежит в `.agloom/` и пути внутри него
резолвятся относительно `.agloom/`. Данное правило обратно совместимо
с существующими файлами `.agloom/config.yml`.

## Front-end пайплайн

Общий пайплайн обработки глобальных флагов, выполняемый для каждой
команды CLI **до** передачи управления в саму команду.

### Процедура Resolve Global Flags

Переиспользуется всеми командами CLI как единственный источник
`ResolvedPaths`.

**Вход:**

- `argv` (array\<string>, обязательно) — массив аргументов командной
  строки процесса (значение `process.argv.slice(2)`).
- `cwd` (string, обязательно) — абсолютный путь к текущему рабочему
  каталогу процесса.
- `stdin` (ReadableStream, обязательно) — стандартный входной поток
  процесса.

**Поведение:**

1. Распарсить три глобальных флага `--project-dir`, `--agloom-dir`,
   `--config` из `argv`, вычислив значения `rawProjectDir`, `rawAgloomDir`,
   `rawConfig` (string | undefined каждый) и флаги явного указания
   `explicit.projectDir`, `explicit.agloomDir`, `explicit.config`.
2. Вычислить `projectDirResolved`: если `explicit.projectDir` —
   `path.resolve(cwd, rawProjectDir)`; иначе — `cwd`.
3. Вычислить `agloomDirResolved`: если `explicit.agloomDir` —
   `path.resolve(cwd, rawAgloomDir)`; иначе —
   `path.join(projectDirResolved, ".agloom")`.
4. Вычислить `configSource`:
   4.1. Если `explicit.config` и `rawConfig === "-"` — установить
   `configSource.kind = "stdin"`, `configSource.baseDir = cwd`.
   4.2. Если `explicit.config` и `rawConfig !== "-"` — установить
   `configSource.kind = "file"`,
   `configSource.path = path.resolve(cwd, rawConfig)`,
   `configSource.baseDir = path.dirname(configSource.path)`.
   4.3. Иначе — установить `configSource.kind = "file"`,
   `configSource.path = path.join(agloomDirResolved, "config.yml")`,
   `configSource.baseDir = agloomDirResolved`.
5. Если `explicit.projectDir` — проверить, что `projectDirResolved`
   существует и является директорией.
6. Если `explicit.agloomDir` — проверить, что `agloomDirResolved`
   существует и является директорией.
7. Если `explicit.config` и `configSource.kind === "file"` — проверить,
   что `configSource.path` существует и является обычным файлом.
8. Сформировать `ResolvedPaths` со значениями `writeRoot = projectDirResolved`,
   `resourcesRoot = agloomDirResolved`, `configSource`, `explicit`.

**Расширения:**

1a. Флаг указан без значения (например, `--project-dir` без следующего
токена) → `Error("Missing value for {flag}.")`; exit code 1.

1b. Один из трёх флагов указан дважды → `Error("{flag} specified more than once.")`;
exit code 1.

5a. `projectDirResolved` не существует → `Error("Directory does not exist: {projectDirResolved}.")`;
exit code 1.

5b. `projectDirResolved` существует, но не является директорией →
`Error("Not a directory: {projectDirResolved}.")`; exit code 1.

6a. `agloomDirResolved` не существует → `Error("Directory does not exist: {agloomDirResolved}.")`;
exit code 1.

6b. `agloomDirResolved` существует, но не является директорией →
`Error("Not a directory: {agloomDirResolved}.")`; exit code 1.

7a. `configSource.path` не существует → `Error("File does not exist: {configSource.path}.")`;
exit code 1.

7b. `configSource.path` существует, но не является обычным файлом →
`Error("Not a file: {configSource.path}.")`; exit code 1.

**Результат:**

- `paths` (ResolvedPaths) — итоговый набор путей для передачи
  в конкретную команду.

### Процедура Run CLI

Общий жизненный цикл запуска CLI. Инкапсулирует порядок: резолв флагов
→ валидация существования → загрузка конфига → выбор и выполнение команды.

**Вход:**

- `argv` (array\<string>, обязательно) — `process.argv.slice(2)`.
- `cwd` (string, обязательно) — `process.cwd()`.
- `stdin` (ReadableStream, обязательно) — `process.stdin`.

**Поведение:**

1. Выполнить процедуру Resolve Global Flags (см. § Процедура Resolve
   Global Flags) с `argv`, `cwd`, `stdin`, получив `paths`.
2. Выполнить процедуру Read Config Source
   (см. `docs/specs/config.md` § Процедура Read Config Source)
   с `paths.configSource`, получив `rawConfig` (тип
   `{ kind: "missing" } | { kind: "parsed", value: object }`).
   Выполнить процедуру Load Config
   (см. `docs/specs/config.md` § Процедура Load Config) с `rawConfig`
   (а не с `configSource` напрямую, чтобы избежать повторного I/O).
   Результат сохранить как `loadedConfig` (тип `LoadConfigResult`).
   Значения `rawConfig` и `loadedConfig` — **единственные** результаты
   чтения и парсинга конфига за весь жизненный цикл CLI; команды НЕ
   ДОЛЖНЫ повторно вызывать Read Config Source или Load Config
   и НЕ ДОЛЖНЫ повторно читать `configSource`.
3. Определить команду из `argv` (см. `docs/specs/cli.md` § Команды).
4. Передать управление в обработчик выбранной команды, передав
   `paths`, `rawConfig` и `loadedConfig`.

**Расширения:**

1a. Resolve Global Flags вернул ошибку → отобразить сообщение ошибки;
exit code 1. Последующие шаги (включая загрузку конфига и выполнение
команды) НЕ выполняются.

2a. Read Config Source или Load Config вернул ошибку (невалидный YAML,
сырой результат не является объектом, поле `adapters` невалидно,
неизвестный или скрытый адаптер в конфиге, невалидное поле `plugins`
или `variables`) → отобразить сообщение ошибки; exit code 1.
Последующие шаги (выполнение команды) НЕ выполняются. Данная ветвь
срабатывает и для команд, которые семантически не используют содержимое
конфига (`init` с `--adapter`, `help`, `version`, `--help` без команды):
невалидный YAML или семантически невалидное содержимое блокируют ЛЮБУЮ
команду. Это сознательная регрессия (см. § Известные регрессии eager-загрузки).

3a. `argv` содержит неизвестную команду → обработка согласно
`docs/specs/cli.md` § Неизвестная команда (exit code 1).

**Результат:**

- `paths` (ResolvedPaths) — передаются в команду.
- `rawConfig` (object) — результат Read Config Source: либо
  `{ kind: "missing" }`, либо `{ kind: "parsed", value: <сырой
YAML-объект> }`. Передаётся в команду для прямого доступа к полям,
  не обрабатываемым Load Config (например, `prettier` и `markdownlint`
  для команды `format`).
- `loadedConfig` (LoadConfigResult) — результат Load Config
  (см. `docs/specs/config.md` § Процедура Load Config). Передаётся
  в команду как готовый результат. Команды, которым содержимое конфига
  не требуется (help, version, --help, init с `--adapter`/`--all`), МОГУТ
  игнорировать `loadedConfig`; повторные вызовы Load Config или
  Read Config Source ЗАПРЕЩЕНЫ.

### Известные регрессии eager-загрузки

Eager-загрузка конфига в Run CLI (шаг 2) является сознательным
архитектурным решением, следующим из пользовательского требования
«все команды единообразно проходят через пайплайн загрузки». Следствие —
невалидный `<resourcesRoot>/config.yml` (невалидный YAML, неизвестный
адаптер, пустой массив `adapters` и т.п.) блокирует выполнение ЛЮБОЙ
команды, даже той, которая семантически не использует содержимое:

- `agloom version` — не печатает версию, если существующий дефолтный
  `config.yml` содержит невалидный YAML.
- `agloom --help` — не отображает справку в тех же условиях.
- `agloom help <topic>` — не рендерит topic в тех же условиях.
- `agloom init --adapter claude` — не выполняет init, если существующий
  дефолтный `config.yml` содержит невалидный YAML, несмотря на то
  что `init` с `--adapter` создаёт новый конфиг и не нуждается в содержимом
  старого.

Если пользователь хочет обойти эту регрессию для `init` в типичном
workflow «чинить сломанный проект», он МОЖЕТ использовать `--config -`
с пустым stdin (`echo -n | agloom init --adapter claude --config -`),
что даёт валидный пустой конфиг и позволяет init создать новый.

### Единообразие применения пайплайна

Процедура Run CLI ТРЕБУЕТСЯ применять ко **всем** вызовам CLI, включая:

- команды `transpile`, `clean`, `init`, `adapters`, `format`, `help`;
- `agloom version` и `agloom --version`;
- `agloom --help` и вызов `agloom` без команды;
- вызовы с `<command> --help`.

Валидация существования путей выполняется ДО обработки `--help`
и `--version`. Если передан несуществующий путь в одном из глобальных
флагов, ошибка валидации пайплайна пересиливает отображение справки
или версии. Это согласуется с существующим правилом, по которому
наличие `--help` не подавляет ошибку неизвестной команды
(см. `docs/specs/cli.md` § Неизвестная команда).

Команды, которые семантически не используют все три значения
(например, `help` не нуждается в `resourcesRoot`), всё равно проходят
через пайплайн: значения вычисляются и валидируются, но команда МОЖЕТ
их игнорировать (см. § Семантика команд).

## Модель развязки абстракций

Текущая реализация использует параметр `projectRoot` одновременно
для трёх ролей: (1) база для чтения `.agloom/config.yml`, (2) база
для чтения ресурсов (skills/agents/overlays), (3) база для записи
выходных файлов. Данная спецификация развязывает эти роли.

### Соответствие флагов и ролей

| Флаг            | Роль                                | Параметр в коде |
| --------------- | ----------------------------------- | --------------- |
| `--project-dir` | Запись выходных файлов (writeRoot)  | `writeRoot`     |
| `--agloom-dir`  | Чтение ресурсов (skills/agents/...) | `resourcesRoot` |
| `--config`      | Загрузка конфигурационного файла    | `configSource`  |

### Отношение к существующему внутреннему параметру `agloomDir`

В текущей реализации транспилеров Skills и Agents существует внутренний
параметр `agloomDir: string` (см. `docs/specs/plugin-loading.md`
§ Расширение процедуры «Шаг транспиляции»), семантика которого —
**относительный subpath** от `projectRoot` до директории ресурсов
(значение `".agloom"` для локального проекта, `"."` для плагина).

Данная спецификация **не изменяет** существующий параметр `agloomDir`
и не переопределяет его семантику. Новый флаг `--agloom-dir` оперирует
**абсолютным** `resourcesRoot` на уровне CLI front-end; связь
с внутренним `agloomDir` транспилера выполняется через адаптацию
вызова фабрики транспилера в процедуре «Шаг транспиляции»:

- Для локального проекта при отсутствии явного `--agloom-dir` значение
  `resourcesRoot` равно `<writeRoot>/.agloom`, что означает тот же
  путь, что и `path.join(writeRoot, ".agloom")`. Вызов транспилера
  с `projectRoot: writeRoot, agloomDir: ".agloom"` даёт тот же
  результат и обратно совместим с текущим поведением.
- Для локального проекта при явном `--agloom-dir <path>` значение
  `resourcesRoot` может быть произвольной директорией, не связанной
  с `writeRoot`. В этом случае вызов транспилера ТРЕБУЕТСЯ выполнять
  с `projectRoot: resourcesRoot, agloomDir: "."`. Такой вызов
  переиспользует существующий механизм плагинов: транспилер
  обнаруживает `skills/`, `agents/`, `AGLOOM.md` непосредственно
  в `resourcesRoot` (как у плагина), а запись выполняется в `writeRoot`
  через параметр `targetRoot` процедуры `writeResults`
  (см. `docs/specs/plugin-loading.md` § Расширение процедуры
  «Шаг транспиляции», параметр `sourceRoot`).

Формально — процедура «Шаг транспиляции» вызывается с параметрами:

- `projectRoot = writeRoot` — для записи результатов.
- `sourceRoot = resourcesRoot` — если `resourcesRoot !== path.join(writeRoot, ".agloom")`
  ИЛИ явно передан `--agloom-dir`; иначе `sourceRoot` не передаётся.
- `agloomDir = "."` — если `sourceRoot` передан; иначе `agloomDir`
  не передаётся (default `".agloom"`).

Эта модель развязки:

- НЕ требует переименования внутреннего параметра `agloomDir` транспилеров.
- НЕ затрагивает плагинную загрузку (плагины продолжают использовать
  `projectRoot: plugin.path, sourceRoot: plugin.path, agloomDir: "."`;
  см. `docs/specs/plugin-loading.md` § Интеграция с транспилерами).
- Переиспользует существующий разделённый discover/transform/write
  механизм, введённый для плагинов.

### Невмешательство в plugin-loading

Новые глобальные флаги работают на уровне входного пайплайна **основного**
проекта. Внутренняя загрузка плагинов (процедура Resolve Plugins,
см. `docs/specs/plugin-loading.md` § Процедура Resolve Plugins)
ЗАПРЕЩАЕТСЯ изменять: каждый плагин продолжает использовать собственный
`plugin.path` как источник ресурсов и не зависит от значений
`--project-dir`, `--agloom-dir`, `--config`.

## Семантика команд

Таблица определяет, какие значения `ResolvedPaths` каждая команда
использует семантически. Все команды проходят через единый пайплайн
(§ Процедура Run CLI) и, как следствие, валидируют все три флага
независимо от семантического использования.

| Команда                 | `writeRoot`     | `resourcesRoot` | `configSource`                                       |
| ----------------------- | --------------- | --------------- | ---------------------------------------------------- |
| `transpile`             | используется    | используется    | используется                                         |
| `clean`                 | используется    | используется    | используется                                         |
| `init`                  | используется    | используется    | валидируется, значение игнорируется                  |
| `adapters`              | не используется | не используется | используется                                         |
| `format`                | используется    | используется    | используется (для секций `prettier`, `markdownlint`) |
| `help`                  | не используется | не используется | не используется                                      |
| `--version` / `version` | не используется | не используется | не используется                                      |
| `--help` / без команды  | не используется | не используется | не используется                                      |

Уточнения по командам:

- **`transpile`** — читает конфиг из `configSource`, читает ресурсы
  из `resourcesRoot`, пишет в `writeRoot`. Per-adapter шаг транспиляции
  вызывается по правилам § Модель развязки абстракций.
- **`clean`** — читает конфиг из `configSource`, удаляет сгенерированные
  файлы внутри `writeRoot`. Ресурсы плагинов (`resourcesRoot`) используются
  только для определения списка адаптеров через `configSource`.
- **`init`** — читает значение `resourcesRoot` для размещения создаваемого
  `<resourcesRoot>/config.yml` и использует `writeRoot` как базу
  для импорта overlay-файлов (из существующих agent-файлов проекта).
  Проверка «уже инициализирован» в init ТРЕБУЕТСЯ выполнять только
  по признакам agloom (наличие `<resourcesRoot>/config.yml` или
  непустого `<resourcesRoot>/overlays/`), а не по факту существования
  самой директории — это делает флаг `--agloom-dir` пригодным для
  workflow `mkdir -p /new/.agloom && agloom init --agloom-dir /new/.agloom`
  (см. `docs/specs/init-command.md` § Команда init, шаг 4
  и расширения 4a–4d). Значение `configSource` валидируется пайплайном
  на существование, но содержимое загруженного конфига `init` НЕ
  использует (команда создаёт новый конфиг, а не читает существующий).
- **`adapters`** — читает список адаптеров из `configSource`; без явного
  `--adapter`/`--all` показывает активные, иначе — все.
- **`format`** — использует `writeRoot` как базу для относительных
  путей в позиционных аргументах и glob discovery, `resourcesRoot`
  как базу для дефолтного паттерна `.agloom/**/*.{md,...}`,
  `configSource` как источник секций `prettier` и `markdownlint`.
- **`help`** — рендерит topics из директории документации пакета.
  Все три значения `ResolvedPaths` команда игнорирует, но пайплайн
  валидирует явные флаги, если они переданы.
- **`--version` / `version`** — печатает версию. Игнорирует все три
  значения; пайплайн валидирует явные флаги.
- **`--help` / вызов без команды** — отображает общую справку.
  Игнорирует все три значения; пайплайн валидирует явные флаги.

## Обратная совместимость

При вызове agloom без передачи новых глобальных флагов:

1. `explicit.projectDir === false` → `writeRoot = process.cwd()`.
2. `explicit.agloomDir === false` → `resourcesRoot = path.join(process.cwd(), ".agloom")`.
3. `explicit.config === false` → `configSource.kind = "file"`,
   `configSource.path = path.join(process.cwd(), ".agloom", "config.yml")`.

Это совпадает с текущим hardcoded поведением
(`path.join(projectRoot, ".agloom", "config.yml")`, см. `src/cli/config.ts`),
где `projectRoot = process.cwd()`. Поведение всех существующих команд
ДОЛЖНО быть идентично текущей реализации при отсутствии новых флагов.

## Exit codes

Front-end пайплайн добавляет следующие причины завершения процесса
с exit code 1 для всех команд CLI:

- Явно переданный `--project-dir` указывает на несуществующий путь.
- Явно переданный `--project-dir` указывает на существующий путь,
  не являющийся директорией.
- Явно переданный `--agloom-dir` указывает на несуществующий путь.
- Явно переданный `--agloom-dir` указывает на существующий путь,
  не являющийся директорией.
- Явно переданный `--config <path>` (`path !== "-"`) указывает
  на несуществующий путь.
- Явно переданный `--config <path>` (`path !== "-"`) указывает
  на существующий путь, не являющийся обычным файлом.
- Один из трёх флагов указан без значения.
- Один из трёх флагов указан дважды.
- Ошибка Read Config Source (см. `docs/specs/config.md`
  § Процедура Read Config Source, расширения 2a, 4a):
  невалидный YAML; сырой результат парсинга не является объектом.
- Ошибка Load Config (см. `docs/specs/config.md` § Процедура Load Config,
  расширения 2a, 2b, 3a, 3b): невалидное значение `adapters`
  (не массив строк); пустой массив `adapters`; неизвестный адаптер;
  скрытый адаптер.
- Ошибка загрузки плагинов в расширении Load Config
  (см. `docs/specs/plugin-loading.md` § Расширение процедуры Load Config,
  расширение 5a): значение `plugins` не массив строк.

Пустой stdin при `--config -` НЕ является ошибкой: Read Config Source
нормализует пустой источник до `{ kind: "parsed", value: {} }`
(см. `docs/specs/config.md` § Процедура Read Config Source, шаг 3),
что эквивалентно валидному пустому конфигу и даёт
`loadedConfig.adapterIds === null`.

## Примеры

### Без флагов — regression

```text
cd /home/user/proj
agloom transpile
```

Эквивалентно текущему поведению: `writeRoot`, `resourcesRoot`,
`configSource.path` вычисляются от `/home/user/proj`.

### `--project-dir` — переезд read/write в другую директорию

```text
agloom transpile --project-dir /other/project
```

Каскад: `writeRoot = /other/project`, `resourcesRoot = /other/project/.agloom`,
`configSource.path = /other/project/.agloom/config.yml`.

### `--agloom-dir` — чужие ресурсы, запись в cwd

```text
cd /home/user/proj
agloom transpile --agloom-dir /other/project/.agloom
```

Каскад: `writeRoot = /home/user/proj`, `resourcesRoot = /other/project/.agloom`,
`configSource.path = /other/project/.agloom/config.yml`. Ресурсы читаются
из `/other/project/.agloom`, результаты пишутся в `/home/user/proj`.

### `--config` — try-режим для конфига

```text
cd /home/user/proj
agloom transpile --config /tmp/try.yml
```

Каскад: `writeRoot = /home/user/proj`,
`resourcesRoot = /home/user/proj/.agloom`,
`configSource.path = /tmp/try.yml`,
`configSource.baseDir = /tmp`. Относительные пути в `/tmp/try.yml`
резолвятся относительно `/tmp`.

### `--config -` — конфиг из stdin

```text
cat try.yml | agloom transpile --config -
```

`configSource.kind = "stdin"`, `configSource.baseDir = process.cwd()`.
Пустой stdin (`echo -n | agloom transpile --config -`) — валидный
пустой конфиг, не ошибка.

Комбинация `--config -` с `--project-dir`:

```text
cd /home/user/proj
cat try.yml | agloom transpile --project-dir /x --config -
```

`writeRoot = /x`, `resourcesRoot = /x/.agloom`, но
`configSource.baseDir = /home/user/proj` (cwd процесса, НЕ `/x`).
Если `try.yml` содержит, например, `plugins: - ./shared`, путь
резолвится в `/home/user/proj/shared`, а не `/x/shared`. Это
асимметрия: для stdin base НЕ каскадируется через `--project-dir`,
потому что у stdin нет физического расположения, и единственной
стабильной базой является cwd процесса.

### Полный custom — три независимые базы

```text
agloom transpile --config /a/try.yml --agloom-dir /b/.agloom --project-dir /c
```

`writeRoot = /c`, `resourcesRoot = /b/.agloom`,
`configSource.path = /a/try.yml`. Все три явно переопределены;
каскад не применяется к явно указанным значениям.

### `--project-dir` с несуществующим путём — ошибка на любой команде

```text
$ agloom version --project-dir /nonexistent
Error: Directory does not exist: /nonexistent.
```

Exit code 1. Пайплайн валидирует путь до обработки команды `version`,
несмотря на то что `version` не использует `writeRoot` семантически.

### `init --config /x/try.yml` — не ошибка

```text
agloom init --adapter claude --config /x/try.yml
```

Если `/x/try.yml` существует — пайплайн проходит валидацию, Load Config
читает файл; `init` игнорирует загруженное содержимое и создаёт новый
`<resourcesRoot>/config.yml` по собственной логике (см. `docs/specs/init-command.md`).

## Вне scope

Следующие аспекты НЕ ВХОДЯТ в scope данной спецификации:

- Флаг `--set` или аналогичный DSL для точечного переопределения
  отдельных полей конфига.
- JSONPath / key=value интерфейс для CLI-переопределений.
- Передача plugin values через CLI (только через YAML-конфиг;
  см. `docs/specs/plugin-values.md`).
- Одноразовые флаги `--plugin <source>` — текущая модель выражает
  любую вариацию плагинов через `--config`.
- Мёрж переданного через `--config` файла поверх on-disk файла:
  `--config` **заменяет** источник, а не накладывается.
- Поддержка `init`-from-template через `--config` (`--config` для `init`
  является no-op в отношении содержимого).
- Файлы `config.local.yml`, `config.overlay.yml`, `config.override.yml` —
  будущая фича.
- Автодобавление `.agloom/` суффикса к значению `--agloom-dir`
  (значение флага ТРЕБУЕТСЯ передавать с полным путём, включая
  сегмент `.agloom`, если он присутствует в целевой структуре).
