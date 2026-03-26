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

`agloom clean --adapter <adapterId>` — удаляет сгенерированные
файлы для указанного адаптера.

**Аргументы:**

- `--adapter` (string, обязательно) — идентификатор адаптера из реестра.

**Поведение:**

1. Распарсить аргумент `--adapter` из командной строки.
2–3. Resolve Adapter
(см. `docs/specs/adapter-registry-ext.md` § Процедура Resolve Adapter).
4–6. Clean Files (см. § Процедура Clean Files).
7. Отобразить результат в TUI (см. § Вывод).
8. Завершить процесс с exit code (см. § Exit codes).

**Расширения:**

1a. Аргумент `--adapter` не указан → отобразить сообщение
об обязательности аргумента `--adapter`; процесс завершается
с exit code 1.

**Вывод:**

При успехе:

```text
Cleaning for {adapterId}...
  ✓ {removedCount} files removed

Done.
```

При наличии ошибок:

```text
Cleaning for {adapterId}...
  ✗ {errors[0]}

Done. {removedCount} files removed.
```

**Exit codes:**

- `0` — успех.
- `1` — ошибка удаления или неизвестный адаптер.

## Расширение команды transpile

Команда `transpile` (см. `docs/specs/cli.md` § Команда transpile)
расширяется флагом `--clean`.

**Новые аргументы:**

- `--clean` (boolean, опционально, default: false) — выполнить
  очистку перед транспиляцией.

**Новые шаги:**

После шага 3 (определение projectRoot):
4. При наличии флага `--clean` выполнить процедуру Clean Files
(см. § Процедура Clean Files) с `entry` и `projectRoot`.

Нумерация последующих шагов команды `transpile` сдвигается на 1.

**Изменения в выводе:**

Результат очистки отображается перед прогрессом транспиляции:

```text
Cleaning for {adapterId}...
  ✓ {removedCount} files removed

◐ Transpiling for {adapterId}...
  ✓ Instructions  3 files
  ...

Done. {totalWritten} files written.
```

**Изменения в exit codes:**

Ошибка очистки НЕ прерывает транспиляцию. Exit code `1` если хотя бы
одна ошибка в clean ИЛИ transpile шагах.

## Справка

Команда `clean` ДОЛЖНА быть добавлена в вывод `agloom --help`:

```text
  clean        Remove generated agent-specific files
```

Команда ДОЛЖНА поддерживать `agloom clean --help`.

## Вне scope

- Merge runtime-файлов (settings.json) при clean.
- Очистка directory-level instruction файлов (`subdir/CLAUDE.md`).
- Исключение `*.local.*` файлов при очистке.
