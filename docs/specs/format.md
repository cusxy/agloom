---
summary: Команда format — форматирование и валидация Markdown, JSON, YAML, TOML файлов
description: >
  Команда agloom format для форматирования и проверки файлов проекта.
  Пакет @agloom/markdown-tools предоставляет программный API для prettier
  и markdownlint. CLI интегрирует пакет через команду format с режимами
  write и check.
type: spec
status: implemented
relates:
  - docs/specs/cli.md
  - docs/specs/config.md
maps_to:
  - packages/markdown-tools/
  - src/cli/
---

# Команда format

Ключевые слова «ТРЕБУЕТСЯ», «ЗАПРЕЩАЕТСЯ», «ДОЛЖЕН», «НЕ ДОЛЖЕН», «СЛЕДУЕТ»,
«НЕ СЛЕДУЕТ», «МОЖЕТ» и «НЕОБЯЗАТЕЛЬНО» в этом документе толкуются
в соответствии с [RFC 2119](https://tools.ietf.org/html/rfc2119).

Команда `agloom format` форматирует и валидирует файлы проекта
(Markdown, JSON, YAML, TOML). Форматирование выполняется библиотекой
`@agloom/markdown-tools` (см. § Пакет @agloom/markdown-tools), которая
предоставляет программный API поверх prettier и markdownlint.

Модуль CLI (см. `docs/specs/cli.md`) является потребителем
`@agloom/markdown-tools`.

## Пакет @agloom/markdown-tools

Пакет `@agloom/markdown-tools` расположен в `packages/markdown-tools/`.
Пакет экспортирует программный API для вызова prettier и markdownlint.

### Зависимости

Пакет `@agloom/markdown-tools` ДОЛЖЕН содержать следующие dependencies
в `package.json`:

- `prettier` — форматирование файлов.
- `markdownlint-cli2` — линтинг Markdown-файлов.

### Поддерживаемые форматы

| Расширение      | prettier | markdownlint |
| --------------- | -------- | ------------ |
| `.md`, `.mdx`   | да       | да           |
| `.json`         | да       | нет          |
| `.yaml`, `.yml` | да       | нет          |
| `.toml`         | да       | нет          |

Файлы с расширениями, не перечисленными в таблице, ЗАПРЕЩАЕТСЯ
обрабатывать. Если такой файл попал в список через пользовательский
glob, он ДОЛЖЕН быть пропущен без ошибки.

### Встроенные дефолтные конфиги

#### Prettier

```yaml
proseWrap: preserve
tabWidth: 2
```

#### Markdownlint

```yaml
MD007:
  indent: 2
MD013:
  line_length: 120
  tables: false
MD024:
  siblings_only: true
MD049:
  style: "underscore"
MD050:
  style: "asterisk"
```

### Приоритет конфигурации

Конфигурация инструментов определяется тремя уровнями (от низшего
приоритета к высшему):

1. **Встроенный дефолт** — значения, зашитые в коде пакета
   (см. § Встроенные дефолтные конфиги).
2. **Нативные файлы** — файлы `.prettierrc.*` и `.markdownlint.*`
   в корне проекта. Пакет использует встроенный config resolution
   prettier и markdownlint (инструменты сами находят свои файлы).
   Если нативный файл существует, его значения перекрывают
   встроенный дефолт для соответствующего инструмента.
3. **Секции в `.agloom/config.yml`** — поля `prettier` и `markdownlint`
   в конфигурационном файле (см. § Расширение конфигурационного файла).
   Значения мержатся поверх результата уровней 1 и 2 (shallow merge).

Пакет `@agloom/markdown-tools` передаёт значения из уровня 3
в prettier и markdownlint as-is (passthrough). Собственная валидация
значений конфига со стороны agloom ЗАПРЕЩАЕТСЯ — валидацию выполняют
сами инструменты.

### Инициализация

`createMarkdownTools(config)`.

**Вход:**

- `projectRoot` (string, обязательно) — абсолютный путь к корню проекта.
- `prettierOverrides` (object, опционально, default: `{}`) — значения
  конфига prettier из `.agloom/config.yml` § `prettier`.
- `markdownlintOverrides` (object, опционально, default: `{}`) — значения
  конфига markdownlint из `.agloom/config.yml` § `markdownlint`.

**Поведение:**

1. Сохранить `projectRoot`, `prettierOverrides`, `markdownlintOverrides`
   для использования в методах `format` и `check`.

**Расширения:**

Нет расширений.

**Результат:**

Экземпляр `MarkdownTools`.

### Метод format

`tools.format(filePaths)` — форматирует указанные файлы (prettier --write
и markdownlint --fix).

**Вход:**

- `filePaths` (array\<string>, обязательно) — абсолютные пути к файлам.

**Поведение:**

1. Для каждого файла из `filePaths` определить применимые инструменты
   по расширению (см. § Поддерживаемые форматы).
2. Выполнить prettier --write для файлов, к которым применим prettier.
   Конфиг prettier формируется по правилам § Приоритет конфигурации.
3. Выполнить markdownlint --fix для файлов с расширением `.md` или `.mdx`.
   Конфиг markdownlint формируется по правилам § Приоритет конфигурации.

**Расширения:**

1a. Файл имеет неподдерживаемое расширение → пропустить файл,
не добавлять в результат.

2a. prettier завершился с ошибкой для файла → добавить сообщение
об ошибке в `errors` результата, продолжить с оставшимися файлами.

3a. markdownlint завершился с ошибкой для файла → добавить сообщение
об ошибке в `errors` результата, продолжить с оставшимися файлами.

**Результат:**

`FormatResult`.

- `formattedCount` (number) — количество файлов, успешно обработанных
  хотя бы одним инструментом.
- `errors` (array\<string>) — сообщения об ошибках (пустой массив
  при отсутствии).

### Метод check

`tools.check(filePaths)` — проверяет файлы без изменений (prettier --check
и markdownlint без --fix).

**Вход:**

- `filePaths` (array\<string>, обязательно) — абсолютные пути к файлам.

**Поведение:**

1. Для каждого файла из `filePaths` определить применимые инструменты
   по расширению (см. § Поддерживаемые форматы).
2. Выполнить prettier --check для файлов, к которым применим prettier.
   Конфиг prettier формируется по правилам § Приоритет конфигурации.
3. Выполнить markdownlint (без --fix) для файлов с расширением `.md`
   или `.mdx`. Конфиг markdownlint формируется по правилам
   § Приоритет конфигурации.

**Расширения:**

1a. Файл имеет неподдерживаемое расширение → пропустить файл,
не добавлять в результат.

2a. prettier --check обнаружил файл, требующий форматирования →
добавить путь файла в `failures`.

3a. markdownlint обнаружил нарушения → добавить путь файла
и описание нарушений в `failures`.

2b. prettier завершился с ошибкой (не несоответствие формата,
а ошибка выполнения) → добавить сообщение в `errors`.

3b. markdownlint завершился с ошибкой выполнения → добавить
сообщение в `errors`.

**Результат:**

`CheckResult`.

- `checkedCount` (number) — количество файлов, проверенных
  хотя бы одним инструментом.
- `failures` (array\<string>) — описания несоответствий (файл + причина).
- `errors` (array\<string>) — сообщения об ошибках выполнения (пустой
  массив при отсутствии).

## Расширение конфигурационного файла

Конфигурационный файл `.agloom/config.yml`
(см. `docs/specs/config.md` § Формат файла) расширяется
двумя опциональными полями верхнего уровня:

- `prettier` (object, опционально) — настройки prettier. Значения
  передаются в prettier as-is. При отсутствии поля используются
  уровни 1 и 2 приоритета конфигурации.
- `markdownlint` (object, опционально) — настройки markdownlint.
  Значения передаются в markdownlint as-is. При отсутствии поля
  используются уровни 1 и 2 приоритета конфигурации.

Пример содержимого `.agloom/config.yml` с секциями форматирования:

```yaml
adapters:
  - claude
  - opencode

prettier:
  proseWrap: always
  tabWidth: 4

markdownlint:
  MD013:
    line_length: 80
```

Процедура Load Config (см. `docs/specs/config.md`
§ Процедура Load Config) ДОЛЖНА игнорировать поля `prettier`
и `markdownlint` (они не участвуют в валидации адаптеров).
Команда `format` читает эти поля самостоятельно из результата
парсинга YAML.

## Целевые файлы по умолчанию

При вызове `agloom format` без glob-аргумента команда обрабатывает
файлы, соответствующие следующим паттернам:

- `.agloom/**/*.{md,mdx,json,yaml,yml,toml}`
- `**/AGLOOM.md`

Раскрытие любых glob-паттернов (дефолтных, `--all`
и пользовательских `<file|glob>...`) ДОЛЖНО исключать:

- Директории (baseline): `node_modules`, `.git`, `dist`, `build`,
  `coverage`, `.next`, `.turbo`, `.cache`.
- Файлы и директории, соответствующие правилам `.gitignore`
  в `projectRoot`. Если файл `.gitignore` не существует —
  применяются только baseline-исключения.

Паттерны раскрываются относительно `projectRoot`.

## Команда format

`agloom format [--check] [--all] [<file|glob>...]` — форматирует или проверяет файлы проекта.

**Аргументы:**

- `--check` (boolean, опционально, default: false) — проверить файлы
  без изменений. При обнаружении несоответствий процесс завершается
  с exit code 1.
- `--all` (boolean, опционально, default: false) — использовать паттерн
  `**/*.{md,mdx,json,yaml,yml,toml}` вместо целевых файлов по умолчанию.
  Взаимоисключающий с `<file|glob>...`.
- `<file|glob>...` (array\<string>, опционально) — один или несколько
  glob-паттернов или путей к файлам. Все позиционные аргументы после
  `format` собираются в массив. При указании ЗАМЕНЯЮТ целевые файлы
  по умолчанию (не дополняют). Взаимоисключающий с `--all`.
  При отсутствии и `--all`, и `<file|glob>...` используются целевые
  файлы по умолчанию (см. § Целевые файлы по умолчанию).

**Поведение:**

1. Распарсить аргументы `--check`, `--all` и `<file|glob>...`
   из командной строки.
2. Определить `projectRoot` как текущий рабочий каталог процесса
   (`process.cwd()`).
3. Определить список glob-паттернов:
   - Если указан `--all` — массив `["**/*.{md,mdx,json,yaml,yml,toml}"]`.
   - Если указаны `<file|glob>...` — массив из всех позиционных
     аргументов.
   - Если не указано ни `--all`, ни `<file|glob>...` — паттерны
     по умолчанию (см. § Целевые файлы по умолчанию).
4. Раскрыть glob-паттерны относительно `projectRoot`, получив
   список абсолютных путей к файлам.
5. Прочитать конфигурационный файл `.agloom/config.yml`: распарсить
   YAML, извлечь поля `prettier` и `markdownlint` (или `{}` если
   поля отсутствуют или файл не существует).
6. Создать экземпляр `MarkdownTools` вызовом
   `createMarkdownTools({ projectRoot, prettierOverrides, markdownlintOverrides })`.
7. Если `--check` указан: вызвать `tools.check(filePaths)`.
8. Если `--check` не указан: вызвать `tools.format(filePaths)`.
9. Отобразить результат в TUI (см. § TUI-отображение).
10. Завершить процесс с exit code (см. § Exit codes).

**Расширения:**

1a. Указаны одновременно `--all` и `<file|glob>...` → отобразить
`"Cannot use --all with file arguments."`; exit code 1.

4a. Ни один файл не соответствует glob-паттернам → отобразить
`"No files found."`, завершить с exit code 0.

5a. Файл `.agloom/config.yml` не существует → использовать
`prettierOverrides: {}`, `markdownlintOverrides: {}`.

5b. Файл `.agloom/config.yml` содержит невалидный YAML → отобразить
сообщение об ошибке парсинга; exit code 1.

## TUI-отображение

Рендеринг прогресса для команды `format`.
Рендеринг выполняется React + Ink компонентом `FormatView`.

### Режим format (без --check)

При успехе:

```text
✓ Formatted {formattedCount} files.
```

При наличии ошибок:

```text
✗ Formatted {formattedCount} files with {errors.length} errors.
  {errors[0]}
  {errors[1]}
```

### Режим check (--check)

При отсутствии несоответствий:

```text
✓ All {checkedCount} files are formatted.
```

При наличии несоответствий:

```text
✗ {failures.length} files need formatting:
  {failures[0]}
  {failures[1]}
```

При наличии ошибок выполнения ошибки отображаются после списка
несоответствий:

```text
✗ {failures.length} files need formatting:
  {failures[0]}

Errors:
  {errors[0]}
```

## Exit codes

- `0` — форматирование завершилось успешно (режим format без ошибок)
  или все файлы соответствуют формату (режим check без failures
  и без ошибок).
- `1` — обнаружены ошибки форматирования (режим format), файлы
  не соответствуют формату (режим check, `failures` непуст),
  ошибки выполнения инструментов, ошибка парсинга конфига,
  или указаны одновременно `--all` и `<file|glob>...`.

## Расширение --help

Команда `format` ДОЛЖНА поддерживать `agloom format --help`.

Вывод:

```text
Usage: agloom format [--check] [--all] [<file|glob>...]

Format and lint project files (Markdown, JSON, YAML, TOML).

Options:
  --check  Check files without modifying (exit code 1 if unformatted)
  --all    Format all supported files in the project
```

## Расширение списка команд

Общая справка `agloom --help` (см. `docs/specs/cli.md` § --help)
ДОЛЖНА включать команду `format` в список доступных команд.
Описание: `Format and lint project files`.

Список известных команд для проверки неизвестной команды
(см. `docs/specs/cli.md` § Неизвестная команда) ДОЛЖЕН
включать `format`.

## Вне scope

Следующие аспекты НЕ ВХОДЯТ в scope данной спецификации:

- Флаг `--verbose` (детальный вывод с пофайловым статусом).
- Инфраструктура монорепозитория (workspace configuration).
- Кастомные правила markdownlint.
- Автоматический запуск format при transpile.
- Конфигурируемый список исключаемых директорий для `**/AGLOOM.md`.
