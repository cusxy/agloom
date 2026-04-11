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
  - docs/specs/format.md
  - docs/specs/cli-global-flags.md
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

По умолчанию файл `.agloom/config.yml` расположен в
`<resourcesRoot>/config.yml`, где `resourcesRoot` — директория ресурсов
agloom (см. `docs/specs/cli-global-flags.md` § Термины). При вызове CLI
без глобальных флагов `resourcesRoot` равен `<projectRoot>/.agloom`,
что соответствует пути `<projectRoot>/.agloom/config.yml`. Источник
конфига МОЖЕТ быть переопределён флагом `--config`
(см. `docs/specs/cli-global-flags.md` § --config).

Формат — YAML с полями верхнего уровня:

- `adapters` (array\<string>, опционально) — список идентификаторов адаптеров
  из реестра (см. `docs/specs/cli.md` § Реестр адаптеров). При наличии массив
  НЕ ДОЛЖЕН быть пустым. Поле МОЖЕТ отсутствовать, если конфиг используется
  только для других назначений (например, `plugins` или `variables`); в этом
  случае команды CLI ТРЕБУЮТ передачи `--adapter` или `--all`
  (см. § Процедура Resolve Adapters from CLI Args).

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

## Процедура Read Config Source

Вспомогательная процедура чтения и парсинга содержимого конфига
из `ConfigSource`. Переиспользуется процедурой Load Config
(для валидации и извлечения `adapters`/`plugins`/`variables`)
и командой `format` (для извлечения секций `prettier`/`markdownlint`).
Цель — единая точка выполнения I/O над `configSource` и однократный
парсинг YAML.

**Вход:**

- `configSource` (ConfigSource, обязательно) — дескриптор источника
  конфига (см. `docs/specs/cli-global-flags.md` § Тип ConfigSource).

**Поведение:**

1. Получить содержимое конфига согласно `configSource.kind`:
   - Если `configSource.kind === "file"` — попытаться прочитать файл
     по пути `configSource.path`.
   - Если `configSource.kind === "stdin"` — прочитать стандартный
     входной поток процесса в виде UTF-8 строки.
2. Распарсить содержимое как YAML.
3. Нормализовать результат: если парсинг вернул `null` или `undefined`
   (пустой файл, пустой stdin) — вернуть `{ kind: "parsed", value: {} }`.
4. Если результат парсинга — объект — вернуть
   `{ kind: "parsed", value: <объект> }`.

**Расширения:**

1a. `configSource.kind === "file"` и файл не существует → вернуть
`{ kind: "missing" }`. Данный случай достижим только при неявном
(дефолтном) `configSource`: если флаг `--config` указан явно,
front-end пайплайн проверяет существование файла до вызова
Read Config Source (см. `docs/specs/cli-global-flags.md`
§ Процедура Resolve Global Flags, расширение 7a).

2a. Содержимое не является валидным YAML →
`Error("Invalid config file: {parseErrorMessage}")`.

4a. Результат парсинга — не объект (например, YAML-скаляр или массив
на верхнем уровне) → `Error("Invalid config: 'adapters' must be an array of strings.")`.

**Результат:**

- `result` (object) — один из двух вариантов:
  - `{ kind: "missing" }` — источник отсутствует (только для дефолтного
    file-configSource, файл не существует).
  - `{ kind: "parsed", value: object }` — сырой YAML-объект
    (после нормализации пустого источника до `{}`). Валидация
    конкретных полей выполняется вызывающими процедурами.

## Процедура Load Config

Валидация и извлечение структурированных полей из сырого
YAML-объекта конфига. Переиспользуется процедурой Run CLI
(см. `docs/specs/cli-global-flags.md` § Процедура Run CLI) один раз
за жизненный цикл CLI. Процедура извлекает поля `adapters`, `plugins`,
`variables`; поля `prettier` и `markdownlint` ИГНОРИРУЮТСЯ
и читаются командой `format` напрямую из `rawConfig`
(см. `docs/specs/format.md` § Команда format).

Load Config НЕ выполняет собственный I/O: чтение и парсинг уже
сделаны процедурой Read Config Source, и результат передаётся
в Load Config как готовый объект.

**Вход:**

- `rawConfig` (object, обязательно) — результат процедуры
  Read Config Source: либо `{ kind: "missing" }`, либо
  `{ kind: "parsed", value: object }`.

**Поведение:**

1. Если `rawConfig.kind === "missing"` — вернуть результат
   `{ adapterIds: null, pluginPaths: null, pluginEntries: null, configVariables: null }`.
   Иначе — использовать `rawConfig.value` как парсированный
   YAML-объект для последующих шагов.
2. Если `rawConfig.value` содержит поле `adapters`, проверить, что
   значение `adapters` является непустым массивом строк.
3. Если поле `adapters` присутствует — для каждого элемента массива
   проверить, что запись с таким `id` существует в реестре адаптеров
   и НЕ является скрытой (`hidden !== true`).
4. Сформировать результат: `adapterIds` равен массиву из поля `adapters`,
   если поле присутствует; иначе `adapterIds` равен `null`.

Относительные пути, записанные внутри YAML-содержимого конфига
(например, `plugins: path: ./foo`, пути в `overlay:`), ТРЕБУЕТСЯ
резолвить относительно `configSource.baseDir`
(см. `docs/specs/cli-global-flags.md` § Разрешение относительных путей
внутри YAML-конфига), независимо от `--project-dir` и `--agloom-dir`.
Для `configSource.kind === "file"` это `path.dirname(configSource.path)`;
для `configSource.kind === "stdin"` — `process.cwd()`.

При вызове со стандартным конфигом
(`configSource.kind === "file"`,
`configSource.path === <resourcesRoot>/config.yml`) поведение
эквивалентно текущему: пути внутри конфига резолвятся относительно
`resourcesRoot`, что совпадает с `.agloom/` в обратной совместимости.

**Расширения:**

1a. `rawConfig.kind === "missing"` → вернуть результат
`{ adapterIds: null, pluginPaths: null, pluginEntries: null, configVariables: null }`.
Не является ошибкой.

2a. Значение `adapters` не является массивом или содержит
нестроковые элементы →
`Error("Invalid config: 'adapters' must be an array of strings.")`.

2b. Массив `adapters` пуст →
`Error("Invalid config: 'adapters' must not be empty.")`.

3a. Элемент массива не соответствует ни одной записи реестра →
`Error("Invalid config: unknown adapter '{id}'.")`.

3b. Элемент массива соответствует скрытому адаптеру →
`Error("Invalid config: adapter '{id}' cannot be specified in config.")`.

**Результат:**

- `adapterIds` (array\<string> | null) — список идентификаторов адаптеров
  из конфига; `null` если поле `adapters` отсутствует в файле или если
  сам файл не существует.

## Процедура Resolve Adapters from Config

Разрешение списка адаптеров с учётом зависимостей и дедупликации.
Для каждого `id` из входного списка выполняется разрешение
зависимостей (см. `docs/specs/cli.md` § Разрешение зависимостей).
Переиспользуется как процедурой Load Config (для адаптеров из
`.agloom/config.yml`), так и процедурой Resolve Adapters from CLI Args
(для дедуплицированного списка значений `--adapter`).

**Вход:**

- `adapterIds` (array\<string>, обязательно) — список идентификаторов
  адаптеров. Каждый `id` ДОЛЖЕН существовать в реестре адаптеров;
  валидация существования и видимости выполняется вызывающей процедурой
  (Load Config — для конфига, Resolve Adapter — для значений `--adapter`).

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
адаптеров, разрешение зависимостей, дедупликацию и fallback
на конфигурационный файл.

**Вход:**

- `adapterIds` (array\<string>, обязательно) — значения аргумента
  `--adapter`, накопленные в массив в порядке появления на командной
  строке. Пустой массив, если флаг не был указан ни разу.
- `all` (boolean, обязательно) — значение аргумента `--all`.
- `loadedConfig` (LoadConfigResult, обязательно) — готовый результат
  процедуры Load Config, полученный Run CLI до вызова команды
  (см. `docs/specs/cli-global-flags.md` § Процедура Run CLI).
  Процедура `Resolve Adapters from CLI Args` ЗАПРЕЩАЕТСЯ выполнять
  собственный вызов Load Config или читать `configSource` — парсинг
  конфига уже выполнен эагерно в Run CLI.
- `command` (string, обязательно) — имя вызывающей команды
  (`"transpile"`, `"clean"` или `"init"`).

**Поведение:**

1. Проверить, что `adapterIds` и `all` не указаны одновременно
   (`adapterIds.length > 0 && all === true`).
2. Если `adapterIds.length > 0`: дедуплицировать `adapterIds`
   с сохранением порядка первого появления каждого `id`. Для каждого
   `id` из дедуплицированного списка выполнить процедуру Resolve Adapter
   (см. `docs/specs/adapter-registry-ext.md` § Процедура Resolve Adapter)
   с `id`. Выполнить процедуру Resolve Adapters from Config
   (см. § Процедура Resolve Adapters from Config) с дедуплицированным
   списком в качестве `adapterIds` для построения единого упорядоченного
   списка записей в топологическом порядке. Вернуть полученный список.
3. Если `all` указан (`all === true`): вернуть все записи реестра
   адаптеров в порядке определения.
4. Использовать поле `loadedConfig.adapterIds` (уже загруженный результат
   Load Config из Run CLI; см. `docs/specs/cli-global-flags.md`
   § Процедура Run CLI). Собственный вызов Load Config ЗАПРЕЩЁН.
5. Если `loadedConfig.adapterIds` является непустым массивом строк:
   выполнить процедуру Resolve Adapters from Config
   (см. § Процедура Resolve Adapters from Config) с этим списком.
   Вернуть полученный список записей.

**Расширения:**

1a. `adapterIds` непустой и `all === true` →
`Error("--adapter and --all are mutually exclusive.")`.

2a. Resolve Adapter вернул ошибку (адаптер не найден или скрытый) →
пробросить ошибку вызывающей команде.

2b. В `adapterIds` есть повторяющиеся идентификаторы → дедуплицировать
молча, повторы не являются ошибкой.

5a. `loadedConfig.adapterIds === null` (поле `adapters` в конфиге
отсутствовало, дефолтный файл не существует, или stdin был пуст):

- Если `command === "init"` →
  `Error("No adapters specified. Use --adapter <id> or --all to specify adapters.")`.
- Если `command !== "init"` →
  `Error("No adapters specified. Use --adapter <id>, --all, or add 'adapters' to .agloom/config.yml.")`.

Ошибки самой процедуры Load Config в Resolve Adapters from CLI Args
НЕ обрабатываются: они уже пойманы процедурой Run CLI
(см. `docs/specs/cli-global-flags.md` § Процедура Run CLI, расширение 2a)
и вызвали завершение процесса до вызова данной процедуры.

**Результат:**

- `entries` (array\<AdapterRegistryEntry>) — упорядоченный список записей
  адаптеров для обработки. При `--adapter` (один или несколько раз) —
  в топологическом порядке после дедупликации входного списка
  (с разрешёнными зависимостями). При `--all` — в порядке определения
  в реестре. При использовании конфига — в топологическом порядке
  (результат Resolve Adapters from Config).
