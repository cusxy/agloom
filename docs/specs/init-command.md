---
summary: Команда init — импорт существующих agent-специфичных файлов в overlays/
description: >
  Команда agent-sds init для копирования существующих agent-специфичных
  файлов в .agents/overlays/<adapterId>/.
type: spec
status: implemented
relates:
  - docs/specs/cli.md
  - docs/specs/adapter-registry-ext.md
  - docs/specs/provider-overlay.md
maps_to:
  - src/cli/
---

# Команда init

Ключевые слова «ТРЕБУЕТСЯ», «ЗАПРЕЩАЕТСЯ», «ДОЛЖЕН», «НЕ ДОЛЖЕН», «СЛЕДУЕТ»,
«НЕ СЛЕДУЕТ», «МОЖЕТ» и «НЕОБЯЗАТЕЛЬНО» в этом документе толкуются
в соответствии с [RFC 2119](https://tools.ietf.org/html/rfc2119).

Данная спецификация добавляет команду `init` в CLI
(см. `docs/specs/cli.md`). Команда импортирует существующие
agent-специфичные файлы в `.agents/overlays/<adapterId>/`
(см. `docs/specs/provider-overlay.md` § Структура директории overlays/).

## Типы данных

### InitOutcome

Результат выполнения импорта.

- `copiedCount` (number) — количество скопированных файлов.
- `errors` (array\<string>) — сообщения об ошибках.

## Команда init

`agent-sds init --adapter <adapterId> [--force]` — копирует существующие
agent-специфичные файлы в `.agents/overlays/<adapterId>/`.

**Аргументы:**

- `--adapter` (string, обязательно) — идентификатор адаптера из реестра.
- `--force` (boolean, опционально, default: false) — перезаписать
  существующие файлы.

<!-- prettier-ignore-start -->

**Поведение:**

1. Распарсить аргументы `--adapter` и `--force` из командной строки.
2–3. Resolve Adapter
(см. `docs/specs/adapter-registry-ext.md` § Процедура Resolve Adapter).
4. Определить целевую директорию как
   `<projectRoot>/.agents/overlays/<entry.id>/`.
5. Проверить, что целевая директория не содержит файлов.
6. Создать целевую директорию и промежуточные каталоги
   при необходимости.
7. Рекурсивно скопировать все файлы из
   `<projectRoot>/<entry.targetRoot>/` в целевую директорию,
   сохраняя структуру каталогов.
8. Сформировать `InitOutcome` с `copiedCount` (количество файлов,
   успешно скопированных на шаге 7) и `errors`.
9. Отобразить результат в TUI (см. § Вывод).
10. Завершить процесс с exit code (см. § Exit codes).

<!-- prettier-ignore-end -->

**Расширения:**

1a. Аргумент `--adapter` не указан → отобразить сообщение
об обязательности аргумента `--adapter`; exit code 1.

5a. Целевая директория уже существует и содержит файлы,
флаг `--force` не указан → отобразить сообщение
`".agents/overlays/{entry.id}/ already exists. Use --force to overwrite."`;
exit code 1.

5b. Флаг `--force` указан → пропустить проверку,
перезаписать существующие файлы при копировании.

6a. Ошибка создания директории → отобразить сообщение об ошибке;
exit code 1.

7a. Директория `targetRoot` не существует → `copiedCount: 0`,
не является ошибкой.

7b. Ошибка копирования → добавить сообщение в `errors`,
продолжить с оставшимися файлами.

**Вывод:**

Вариант вывода определяется по условию:

- Если `errors` непуст → вариант «ошибки».
- Если `copiedCount > 0` и `errors` пуст → вариант «успех».
- Если `copiedCount = 0` и `errors` пуст → вариант «отсутствие файлов».

Вариант «успех»:

```text
Initializing for {adapterId}...
  ✓ {copiedCount} files copied to .agents/overlays/{adapterId}/

Done.
```

Вариант «ошибки»:

```text
Initializing for {adapterId}...
  ✗ {errors[0]}

Done. {copiedCount} files copied.
```

Вариант «отсутствие файлов»:

```text
Initializing for {adapterId}...
  No files found.

Done.
```

**Exit codes:**

- `0` — успех (включая 0 файлов).
- `1` — аргумент `--adapter` не указан, неизвестный адаптер,
  директория уже существует без `--force`, ошибка создания
  директории, или ошибка копирования.

## Справка

Команда `init` ДОЛЖНА быть добавлена в вывод `agent-sds --help`:

```text
  init         Import existing agent configs into .agents/overlays/
```

Команда ДОЛЖНА поддерживать `agent-sds init --help`.
Вывод `agent-sds init --help`:

```text
Usage: agent-sds init --adapter <adapterId> [--force]

Import existing agent configs into .agents/overlays/

Options:
  --adapter <adapterId>  Adapter identifier (required)
  --force                Overwrite existing files
  --help                 Show help
```

## Вне scope

- Автоматическое создание канонических файлов из agent-специфичных
  (reverse transpile).
