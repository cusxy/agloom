---
summary: Команда clean — удаление сгенерированных agent-специфичных файлов
description: >
  Команда agloom clean для удаления файлов, сгенерированных
  транспиляцией. Флаг --clean для команды transpile.
type: spec
status: implemented
relates:
  - docs/specs/cli.md
  - docs/specs/adapter-registry-ext.md
  - docs/specs/config.md
maps_to:
  - src/cli/
---

# Команда clean

Ключевые слова «ТРЕБУЕТСЯ», «ЗАПРЕЩАЕТСЯ», «ДОЛЖЕН», «НЕ ДОЛЖЕН», «СЛЕДУЕТ»,
«НЕ СЛЕДУЕТ», «МОЖЕТ» и «НЕОБЯЗАТЕЛЬНО» в этом документе толкуются
в соответствии с [RFC 2119](https://tools.ietf.org/html/rfc2119).

Данная спецификация добавляет команду `clean` в CLI
(см. `docs/specs/cli.md`) и флаг `--clean` для команды `transpile`.

## Типы данных

### CleanOutcome

Результат выполнения очистки.

- `removedCount` (number) — количество удалённых файлов.
- `errors` (array\<string>) — сообщения об ошибках.

## Процедура Clean Files

Общая процедура удаления сгенерированных файлов адаптера.
Переиспользуется командой `clean` и расширением `--clean`
команды `transpile`.

**Вход:**

- `entry` (AdapterRegistryEntry, обязательно) — запись адаптера из реестра.
- `projectRoot` (string, обязательно) — абсолютный путь к корню проекта.

**Поведение:**

1. Рекурсивно удалить директорию `<projectRoot>/<entry.targetRoot>/`
   со всем её содержимым (файлы и поддиректории). Сама директория
   `targetRoot` также удаляется.
2. Удалить каждый файл из `entry.targetFiles`
   (пути относительно `projectRoot`).
3. Сформировать `CleanOutcome` с `removedCount` (суммарное количество
   файлов, успешно удалённых на шагах 1 и 2) и `errors`.

**Расширения:**

1a. Директория `<projectRoot>/<entry.targetRoot>/` не существует →
`removedCount: 0`, не является ошибкой.

1b. Ошибка удаления файла или директории (EACCES и т.п.) →
добавить сообщение в `errors`, продолжить с оставшимися файлами.

2a. Файл из `targetFiles` не существует → пропустить файл,
не является ошибкой.

2b. Ошибка удаления файла из `targetFiles` (EACCES и т.п.) →
добавить сообщение в `errors`, продолжить с оставшимися файлами.

**Результат:**

- `outcome` (CleanOutcome) — результат выполнения очистки.

## Команда clean

`agloom clean [--adapter <adapterId> | --all] [--verbose]` — удаляет
сгенерированные файлы для указанного адаптера, всех адаптеров или
адаптеров из конфигурационного файла (см. `docs/specs/config.md`).

**Аргументы:**

- `--adapter` (string, опционально) — идентификатор адаптера из реестра.
  Взаимоисключающий с `--all`.
- `--all` (boolean, опционально, default: false) — выполнить очистку
  для всех адаптеров из реестра. Взаимоисключающий с `--adapter`.
- `--verbose` (boolean, опционально, default: false) — показывать все
  результаты, включая адаптеры с 0 удалённых файлов.

Аргументы `--adapter` и `--all` являются взаимоисключающими.
При отсутствии обоих используется конфигурационный файл
(см. `docs/specs/config.md`).

**Поведение:**

1. Распарсить аргументы `--adapter`, `--all` и `--verbose`
   из командной строки.
2. Определить `projectRoot` как текущий рабочий каталог процесса
   (`process.cwd()`).
3. Выполнить процедуру Resolve Adapters from CLI Args
   (см. `docs/specs/config.md`
   § Процедура Resolve Adapters from CLI Args)
   с `adapter`, `all`, `projectRoot`, `"clean"`.
4. Для каждой записи из полученного списка выполнить процедуру
   Clean Files (см. § Процедура Clean Files) с `entry`
   и `projectRoot`.
5. Вычислить `totalRemoved` как сумму `removedCount` всех очисток.
6. Отобразить результат в TUI (см. § Вывод).
7. Завершить процесс с exit code (см. § Exit codes).

**Расширения:**

3a. Resolve Adapters from CLI Args вернул ошибку → отобразить
сообщение ошибки; процесс завершается с exit code 1.

### Вывод

Вывод подчиняется правилам фильтрации по `--verbose`:

- Без `--verbose`: строки с 0 удалённых файлов и без ошибок
  скрываются. Если все адаптеры имеют 0 удалённых файлов
  и нет ошибок — отображается `"Nothing to clean."`.
- С `--verbose`: все строки отображаются, включая 0 удалённых файлов.

Режим --adapter — при наличии видимых результатов:

```text
✓ Cleaning for {adapterId}...
  ✓ {removedCount} files removed

Done. {removedCount} files removed.
```

Символ `✓` в заголовке и строке результата СЛЕДУЕТ отображать
зелёным цветом.

Режим --adapter — при наличии ошибок:

```text
✓ Cleaning for {adapterId}...
  ✗ {errors[0]}

Done. {removedCount} files removed.
```

Символ `✗` СЛЕДУЕТ отображать красным цветом.

Режим --all — при наличии видимых результатов:

```text
✓ Cleaning for claude...
  ✓ {removedCount} files removed
✓ Cleaning for opencode...
  ✓ {removedCount} files removed

Done. {totalRemoved} files removed.
```

Адаптеры, у которых `removedCount === 0` и нет ошибок,
скрываются при отсутствии `--verbose`.

Итоговая строка `"Done. {totalRemoved} files removed."` отображается
всегда. Значение `totalRemoved` — сумма `removedCount` всех адаптеров.

**Exit codes:**

- `0` — все очистки завершились без ошибок.
- `1` — указаны оба `--adapter` и `--all` одновременно; конфиг
  не найден (при отсутствии `--adapter` и `--all`); ошибка конфига;
  неизвестный или скрытый адаптер; или ошибка удаления.

## Расширение команды transpile

Команда `transpile` (см. `docs/specs/cli.md` § Команда transpile)
расширяется флагом `--clean`.

**Новые аргументы:**

- `--clean` (boolean, опционально, default: false) — выполнить
  очистку перед транспиляцией.

### Поведение --clean

При наличии флага `--clean` в шаге 4 команды `transpile`
(см. `docs/specs/cli.md` § Команда transpile) перед транспиляцией
каждой записи выполняется процедура Clean Files
(см. § Процедура Clean Files) с `entry` и `projectRoot`.

**Изменения в выводе:**

При использовании `--adapter`: результат очистки отображается
перед прогрессом транспиляции:

```text
Cleaning for {adapterId}...
  ✓ {removedCount} files removed

◐ Transpiling for {adapterId}...
  ✓ Instructions  3 files
  ...

Done. {totalWritten} files written.
```

При использовании `--all` или конфига: результаты очистки
НЕ отображаются в TUI.

**Изменения в exit codes:**

Ошибка очистки НЕ прерывает транспиляцию. Exit code `1` если хотя бы
одна ошибка в clean ИЛИ transpile шагах.

## Справка

Команда `clean` ДОЛЖНА быть добавлена в вывод `agloom --help`:

```text
  clean        Remove generated agent-specific files
```

Команда ДОЛЖНА поддерживать `agloom clean --help`.
Вывод `agloom clean --help`:

```text
Usage: agloom clean [--adapter <adapterId> | --all] [--verbose]

Remove generated agent-specific files for the specified adapter.

Options:
  --adapter <adapterId>  Adapter ID from the registry
  --all                  Clean for all supported adapters
  --verbose              Show details even when 0 files removed
```

## Вне scope

- Merge runtime-файлов (settings.json) при clean.
- Очистка directory-level instruction файлов (`subdir/CLAUDE.md`).
- Исключение `*.local.*` файлов при очистке.
