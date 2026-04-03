---
summary: Конфигурационный файл .agloom/config.yml
description: >
  Конфигурационный файл .agloom/config.yml для указания набора адаптеров
  по умолчанию. Процедуры Load Config, Resolve Adapters from Config
  и Resolve Adapters from CLI Args.
type: spec
status: implemented
relates:
  - docs/specs/cli.md
  - docs/specs/adapter-registry-ext.md
  - docs/specs/init-command.md
  - docs/specs/clean-command.md
  - docs/specs/plugin-manifest.md
  - docs/specs/plugin-loading.md
  - docs/specs/git-plugin-loading.md
  - docs/specs/plugin-values.md
maps_to:
  - src/cli/
---

# Конфигурационный файл

Ключевые слова «ТРЕБУЕТСЯ», «ЗАПРЕЩАЕТСЯ», «ДОЛЖЕН», «НЕ ДОЛЖЕН», «СЛЕДУЕТ»,
«НЕ СЛЕДУЕТ», «МОЖЕТ» и «НЕОБЯЗАТЕЛЬНО» в этом документе толкуются
в соответствии с [RFC 2119](https://tools.ietf.org/html/rfc2119).

Данная спецификация описывает конфигурационный файл `.agloom/config.yml`,
определяющий набор адаптеров по умолчанию для команд CLI. Файл используется
командами `transpile`, `clean`, `init` и `adapters`
(см. `docs/specs/cli.md`, `docs/specs/clean-command.md`,
`docs/specs/init-command.md`) когда ни `--adapter`, ни `--all` не указаны.

## Формат файла

Файл `.agloom/config.yml` расположен в `<projectRoot>/.agloom/config.yml`.
Формат — YAML с единственным полем верхнего уровня:

- `adapters` (array\<string>, обязательно) — список идентификаторов адаптеров
  из реестра (см. `docs/specs/cli.md` § Реестр адаптеров). Массив
  НЕ ДОЛЖЕН быть пустым.

Пример содержимого:

```yaml
# Agloom configuration
# List of adapters to use by default when no --adapter or --all flag is provided.
# Run 'agloom adapters --all' to see all available adapters.
adapters:
  - claude
  - opencode
```

Скрытые адаптеры (см. `docs/specs/adapter-registry-ext.md`
§ Расширение AdapterRegistryEntry, поле `hidden`) ЗАПРЕЩАЕТСЯ
указывать в конфигурационном файле.

## Процедура Load Config

Загрузка и валидация конфигурационного файла. Переиспользуется командами
`transpile`, `clean`, `init` и `adapters`.

**Вход:**

- `projectRoot` (string, обязательно) — абсолютный путь к корню проекта.

**Поведение:**

1. Попытаться прочитать файл `<projectRoot>/.agloom/config.yml`.
2. Распарсить содержимое файла как YAML.
3. Проверить, что результат парсинга содержит поле `adapters`
   и значение `adapters` является непустым массивом строк.
4. Для каждого элемента массива `adapters` проверить, что запись
   с таким `id` существует в реестре адаптеров и НЕ является скрытой
   (`hidden !== true`).

**Расширения:**

1a. Файл не существует → вернуть `null` (конфиг отсутствует).

2a. Содержимое файла не является валидным YAML →
`Error("Invalid config file: {parseErrorMessage}")`.

3a. Поле `adapters` отсутствует →
`Error("Invalid config: 'adapters' field is required.")`.

3b. Значение `adapters` не является массивом или содержит
нестроковые элементы →
`Error("Invalid config: 'adapters' must be an array of strings.")`.

3c. Массив `adapters` пуст →
`Error("Invalid config: 'adapters' must not be empty.")`.

4a. Элемент массива не соответствует ни одной записи реестра →
`Error("Invalid config: unknown adapter '{id}'.")`.

4b. Элемент массива соответствует скрытому адаптеру →
`Error("Invalid config: adapter '{id}' cannot be specified in config.")`.

**Результат:**

- `adapterIds` (array\<string>) — список идентификаторов адаптеров
  из конфига, или `null` если файл не существует.

## Процедура Resolve Adapters from Config

Разрешение списка адаптеров из конфига с учётом зависимостей.
Для каждого адаптера из конфига выполняется разрешение зависимостей
(см. `docs/specs/cli.md` § Разрешение зависимостей).

**Вход:**

- `adapterIds` (array\<string>, обязательно) — список идентификаторов
  адаптеров из конфига (результат процедуры Load Config).

**Поведение:**

1. Для каждого `id` из `adapterIds` вызвать процедуру
   Разрешение зависимостей
   (см. `docs/specs/cli.md` § Разрешение зависимостей)
   с `entryId = id` и `registry = adapterRegistry`.
2. Объединить все результаты в единый дедуплицированный список
   в топологическом порядке: зависимости идут перед зависящими
   от них записями. Каждая запись ДОЛЖНА присутствовать в результате
   не более одного раза (дедупликация по `id`).

**Расширения:**

Нет расширений (валидация `adapterIds` выполнена процедурой Load Config;
расширения процедуры Разрешение зависимостей применяются).

**Результат:**

- `entries` (array\<AdapterRegistryEntry>) — дедуплицированный упорядоченный
  список записей адаптеров в топологическом порядке.

**Пример:**

При `adapterIds = ["claude", "opencode"]` и реестре где
`opencode.dependsOn = ["agentsmd"]`, `claude.dependsOn = []`:
результат = `[claude, agentsmd, opencode]`.

При `adapterIds = ["claude"]`:
результат = `[claude]`.

## Процедура Resolve Adapters from CLI Args

Общая процедура разрешения списка адаптеров из аргументов командной
строки. Переиспользуется командами `transpile`, `clean` и `init`.
Инкапсулирует проверку взаимоисключающих аргументов, валидацию
адаптера, разрешение зависимостей и fallback на конфигурационный файл.

**Вход:**

- `adapter` (string | null, обязательно) — значение аргумента `--adapter`,
  или `null` если не указан.
- `all` (boolean, обязательно) — значение аргумента `--all`.
- `projectRoot` (string, обязательно) — абсолютный путь к корню проекта.
- `command` (string, обязательно) — имя вызывающей команды
  (`"transpile"`, `"clean"` или `"init"`).

**Поведение:**

1. Проверить, что `adapter` и `all` не указаны одновременно
   (`adapter !== null && all === true`).
2. Если `adapter` указан (`adapter !== null`): выполнить процедуру
   Resolve Adapter
   (см. `docs/specs/adapter-registry-ext.md` § Процедура Resolve Adapter)
   с `adapter`. Выполнить процедуру Разрешение зависимостей
   (см. `docs/specs/cli.md` § Разрешение зависимостей)
   с `entryId = adapter`. Вернуть полученный список записей.
3. Если `all` указан (`all === true`): вернуть все записи реестра
   адаптеров в порядке определения.
4. Выполнить процедуру Load Config
   (см. § Процедура Load Config) с `projectRoot`.
5. Выполнить процедуру Resolve Adapters from Config
   (см. § Процедура Resolve Adapters from Config) с `adapterIds`.
   Вернуть полученный список записей.

**Расширения:**

1a. `adapter` и `all` указаны одновременно →
`Error("--adapter and --all are mutually exclusive.")`.

2a. Resolve Adapter вернул ошибку (адаптер не найден или скрытый) →
пробросить ошибку вызывающей команде.

4a. Load Config вернул `null`:

- Если `command !== "init"` →
  `Error("No config found. Use --adapter <id> or --all, or run 'agloom init' to create a config.")`.
- Если `command === "init"` →
  `Error("No config found. Use --adapter <id> or --all to specify adapters.")`.

4b. Load Config вернул ошибку → пробросить ошибку вызывающей команде.

**Результат:**

- `entries` (array\<AdapterRegistryEntry>) — упорядоченный список записей
  адаптеров для обработки. При `--adapter` — в топологическом порядке
  (с разрешёнными зависимостями). При `--all` — в порядке определения
  в реестре. При использовании конфига — в топологическом порядке
  (результат Resolve Adapters from Config).
