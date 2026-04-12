---
summary: Resource Transpiler — библиотека транспиляции docs и schemas из .agloom/ в agent-specific каталоги
description: >
  Библиотека для транспиляции файлов ресурсов (docs, schemas) из канонического
  каталога .agloom/docs/ или .agloom/schemas/ в agent-specific каталоги.
  Копирует файлы с интерполяцией текстовых расширений и побайтовым копированием
  бинарных. Расширяется через адаптеры. Единый класс ResourceTranspiler
  обслуживает оба типа ресурсов.
type: spec
status: implemented
relates:
  - docs/specs/skills-transpiler.md
  - docs/specs/agents-transpiler.md
  - docs/specs/interpolation.md
  - docs/specs/adapter-registry-ext.md
  - docs/specs/cli.md
  - docs/specs/integration-tests.md
  - docs/specs/plugin-values.md
  - docs/specs/provider-overlay.md
maps_to:
  - src/docs-transpiler/
---

# Resource Transpiler

Ключевые слова «ТРЕБУЕТСЯ», «ЗАПРЕЩАЕТСЯ», «ДОЛЖЕН», «НЕ ДОЛЖЕН», «СЛЕДУЕТ»,
«НЕ СЛЕДУЕТ», «МОЖЕТ» и «НЕОБЯЗАТЕЛЬНО» в этом документе толкуются
в соответствии с [RFC 2119](https://tools.ietf.org/html/rfc2119).

Библиотека для транспиляции файлов ресурсов из канонических каталогов
`.agloom/docs/` и `.agloom/schemas/` в agent-specific каталоги. Канонический
каталог является единственным источником истины (single source of truth);
agent-specific файлы — производные артефакты, генерируемые при каждом запуске
транспиляции.

Единый класс `ResourceTranspiler` обслуживает оба типа ресурсов (`docs`
и `schemas`). Тип ресурса определяется параметром `resourceType` при
инициализации и влияет только на путь к каталогу-источнику
(`<agloomDir>/docs/` или `<agloomDir>/schemas/`).

Библиотека ЗАПРЕЩАЕТ валидацию содержимого файлов ресурсов, потому что
ресурсные файлы имеют произвольный формат.

## Типы данных

### ResourceType

Литеральный тип, определяющий вид ресурса.

- `"docs"` — файлы документации.
- `"schemas"` — файлы схем.

### ResourceFile

Обнаруженный файл ресурса.

- `relativePath` (string) — путь файла относительно `projectRoot`
  (например, `".agloom/docs/guide.md"`).

### ResourceOutputFile

Файл для записи в целевой каталог.

- `relativePath` (string) — путь назначения относительно `projectRoot`.
- `sourcePath` (string) — путь исходного файла относительно `projectRoot`.

### ResourceTranspileResult

Результат транспиляции для одного адаптера.

- `agentId` (string) — идентификатор агента.
- `files` (array\<ResourceOutputFile>) — список файлов для записи.
- `errors` (array\<ResourceTranspileError>) — ошибки, возникшие при
  транспиляции данного адаптера.

### ResourceTranspileError

Ошибка транспиляции адаптера.

- `agentId` (string) — идентификатор адаптера, при транспиляции которого
  произошла ошибка.
- `message` (string) — описание ошибки.
- `cause` (Error) — исходное исключение адаптера.

### ResourceWriteResult

Результат записи файлов.

- `written` (array\<string>) — относительные пути успешно записанных файлов.
- `errors` (array\<ResourceWriteError>) — ошибки записи.

### Классы ошибок

- `ResourceConfigError` (extends Error) — ошибка конфигурации транспилера.
- `ResourceDiscoverError` (extends Error) — ошибка обнаружения файлов ресурсов.
- `ResourceWriteError` (extends Error) — ошибка записи файла.

## Whitelist расширений для интерполяции

Константа `INTERPOLATABLE_EXTENSIONS` определяет набор расширений файлов,
для которых выполняется интерполяция переменных при записи. Файлы
с расширениями, не входящими в whitelist, ДОЛЖНЫ копироваться побайтово
без изменений.

Значение (массив строк, case-insensitive при сравнении):

```text
.md, .txt, .json, .jsonc, .jsonl, .xml, .html, .svg, .toml, .yml, .yaml
```

Whitelist ДОЛЖЕН быть единым для обоих типов ресурсов (`docs` и `schemas`).

Расширение файла определяется из `sourcePath` с использованием
`path.extname()`, приведённого к нижнему регистру.

## Интерфейс адаптера

Каждый адаптер ДОЛЖЕН реализовать следующий интерфейс (`ResourceAdapter`):

- `agentId` (string, readonly) — уникальный идентификатор агента
  (например, `"claude"`, `"opencode"`).
- `targetDir` (string, readonly) — путь к целевому каталогу
  относительно `projectRoot` (например, `".claude/docs"`,
  `".opencode/schemas"`).

Адаптер не содержит метода `transpile`, потому что транспиляция
сводится к замене префикса пути и не требует agent-specific логики.
Маппинг путей выполняется транспилером на основе `targetDir`
(см. «Транспиляция»).

## Инициализация

`createResourceTranspiler(config)`.

**Вход:**

- `config` (object, обязательно) — конфигурация транспилера.
  - `projectRoot` (string, обязательно) — абсолютный путь к корню проекта.
  - `adapters` (array\<ResourceAdapter>, обязательно) — массив адаптеров
    для целевых агентов.
  - `resourceType` (ResourceType, обязательно) — тип ресурса
    (`"docs"` или `"schemas"`).
  - `agloomDir` (string, опционально, default: `".agloom"`) — путь
    к каталогу agloom относительно `projectRoot`.

**Поведение:**

1. Валидировать, что `projectRoot` является абсолютным путём.
2. Валидировать, что массив `adapters` содержит хотя бы один элемент.
3. Валидировать, что все элементы `adapters` реализуют интерфейс
   `ResourceAdapter` (содержат строковые поля `agentId` и `targetDir`).
4. Валидировать, что значения `agentId` всех адаптеров уникальны.
5. Валидировать, что `resourceType` равен `"docs"` или `"schemas"`.
6. Создать экземпляр `ResourceTranspiler` с переданными параметрами.

**Расширения:**

1a. `projectRoot` не является абсолютным путём →
`ResourceConfigError("projectRoot must be an absolute path")`.

2a. Массив `adapters` пуст →
`ResourceConfigError("At least one adapter is required")`.

3a. Элемент `adapters` не реализует интерфейс `ResourceAdapter` →
`ResourceConfigError("Adapter at index {i} does not implement ResourceAdapter interface")`.

4a. Обнаружены адаптеры с одинаковым `agentId` →
`ResourceConfigError("Duplicate agentId: {id}")`.

5a. `resourceType` не равен `"docs"` и не равен `"schemas"` →
`ResourceConfigError("Invalid resourceType: {resourceType}")`.

**Результат:**

Экземпляр `ResourceTranspiler`.

## Создание адаптера из реестра

`createResourceAdapter(entry, resourceType)` — создаёт `ResourceAdapter`
из записи реестра адаптеров. Утилита для интеграции с CLI-уровнем.

**Вход:**

- `entry` (object, обязательно) — запись реестра адаптеров.
  - `id` (string, обязательно) — идентификатор адаптера.
  - `paths` (Record\<string, string | undefined>, обязательно) — пути
    к agent-specific каталогам
    (см. `docs/specs/adapter-registry-ext.md` § Расширение AdapterRegistryEntry).
- `resourceType` (ResourceType, обязательно) — тип ресурса
  (`"docs"` или `"schemas"`).

**Поведение:**

1. Определить путь к целевому каталогу как `entry.paths[resourceType]`.
2. Если путь определён — создать `ResourceAdapter` с `agentId`
   равным `entry.id` и `targetDir` равным полученному пути.
3. Если путь не определён — вернуть `null`.

**Расширения:**

Нет расширений.

**Результат:**

`ResourceAdapter | null`.

## Обнаружение файлов ресурсов

`transpiler.discover()` — обнаруживает все файлы ресурсов в проекте.

**Вход:**

Нет входных параметров.

**Поведение:**

1. Определить путь к каталогу ресурсов как
   `<projectRoot>/<agloomDir>/<resourceType>/`.
2. Проверить наличие каталога ресурсов.
3. Рекурсивно получить список всех файлов в каталоге ресурсов.
4. Сформировать массив `ResourceFile`.

**Расширения:**

2a. Каталог ресурсов не существует → вернуть пустой массив
`ResourceFile[]` (не является ошибкой).

3a. Ошибка доступа к каталогу (EACCES) →
`ResourceDiscoverError("Failed to scan directory {dirPath}: {причина}")`.

**Результат:**

`ResourceFile[]`.

## Транспиляция

`transpiler.transpile()` — выполняет полный цикл транспиляции для всех
зарегистрированных адаптеров.

**Вход:**

Нет входных параметров.

**Поведение:**

1. Обнаружить файлы ресурсов (см. «Обнаружение файлов ресурсов»).
2. Для каждого зарегистрированного адаптера выполнить маппинг путей:
   для каждого `ResourceFile` из обнаруженных файлов — заменить префикс
   `<agloomDir>/<resourceType>/` на `<adapter.targetDir>/`, сформировав
   `ResourceOutputFile` с вычисленным `relativePath` и исходным путём файла
   в качестве `sourcePath`. Структура вложенных каталогов внутри каталога
   ресурсов сохраняется.
3. Собрать результаты всех адаптеров в единый массив
   `ResourceTranspileResult`.

**Расширения:**

1a. Ни одного файла не обнаружено → вернуть пустой массив
`ResourceTranspileResult[]` (не является ошибкой).

1b. `discover()` выбрасывает `ResourceDiscoverError` →
пробросить к вызывающему коду.

**Результат:**

`ResourceTranspileResult[]`.

## Запись результатов

`transpiler.writeResults(results, options?)` — записывает результаты
транспиляции в файловую систему, копируя файлы из исходных путей в целевые
с интерполяцией для текстовых файлов.

**Вход:**

- `results` (array\<ResourceTranspileResult>, обязательно) — результаты
  транспиляции, полученные из `transpile()`.
- `options` (object, опционально) — дополнительные параметры записи.
  - `targetRoot` (string, опционально, default: значение `projectRoot`
    из конфигурации транспилера) — абсолютный путь к корню целевого
    проекта. Используется при записи файлов плагинов в локальный проект.
  - `variablesByAgentId` (Record\<string, Record\<string, string>>,
    опционально) — карта agloom-переменных, индексированная по `agentId`.
    Если параметр передан, интерполяция выполняется для файлов
    с расширениями из `INTERPOLATABLE_EXTENSIONS`.
    Если не передан, все файлы копируются побайтово без интерполяции
    (обратная совместимость).
  - `valuesByAgentId` (Record\<string, Record\<string, string>>,
    опционально) — карта values-переменных, индексированная по `agentId`
    (см. `docs/specs/plugin-values.md`). Если параметр передан,
    интерполяция namespace `${values:*}` выполняется для файлов
    с расширениями из `INTERPOLATABLE_EXTENSIONS`.

**Поведение:**

1. Для каждого `ResourceTranspileResult` проверить, что массив `errors` пуст.
2. Определить `effectiveRoot` как `options.targetRoot` (если передан)
   или `projectRoot` из конфигурации транспилера.
3. Проверить наличие `agentId` в картах переменных (если карты переданы).
4. Для каждого `ResourceOutputFile` из `files`:
   - Определить расширение файла из `sourcePath`
     (`path.extname(sourcePath).toLowerCase()`).
   - Если `variablesByAgentId` или `valuesByAgentId` переданы
     И расширение входит в `INTERPOLATABLE_EXTENSIONS`
     (case-insensitive) — прочитать содержимое
     `projectRoot / sourcePath` с кодировкой UTF-8, вызвать
     `interpolate(content, variables, env, values)` где `variables`
     равно `variablesByAgentId[agentId]` (или пустой объект
     при отсутствии), `values` равно `valuesByAgentId[agentId]`
     (или `undefined` при отсутствии), записать результат
     в `effectiveRoot / relativePath` с кодировкой UTF-8,
     создавая промежуточные каталоги при необходимости.
   - Иначе — побайтово скопировать файл из `projectRoot / sourcePath`
     в `effectiveRoot / relativePath`, создавая промежуточные каталоги
     при необходимости.
5. Вернуть `ResourceWriteResult`.

**Расширения:**

1a. `ResourceTranspileResult` содержит непустой `errors` — пропустить запись
всех `files` данного адаптера; создать `ResourceWriteError` с описанием
и добавить в `ResourceWriteResult.errors`.

3a. `variablesByAgentId` передан, но ключ `agentId` текущего
`ResourceTranspileResult` отсутствует в `variablesByAgentId` →
`ResourceWriteError("No interpolation variables for adapter: {agentId}")`.

4a. Исходный файл (`sourcePath`) не существует или недоступен для чтения →
`ResourceWriteError("Failed to read source {sourcePath}: {причина}")`.

4b. Ошибка записи целевого файла или создания каталога (нет прав,
диск полон) →
`ResourceWriteError("Failed to write {relativePath}: {причина}")`.

4c. `interpolate` выбрасывает `InterpolationError` →
`ResourceWriteError("Interpolation failed for {sourcePath}: {причина}")`.

**Результат:**

`ResourceWriteResult`.

## Вне scope

Следующие аспекты НЕ ВХОДЯТ в scope данной спецификации:

- Валидация содержимого и формата файлов ресурсов.
- Watch mode (отслеживание изменений файлов ресурсов).
- CLI-интерфейс (описан в `docs/specs/cli.md`).
- Очистка устаревших agent-specific файлов при удалении ресурсов.
- Автоматическое обновление `.gitignore`.
- Трансформация содержимого (парсинг frontmatter, фильтрация body) —
  ресурсные файлы копируются без content-трансформации,
  в отличие от skills-transpiler.
- Интерполяция в бинарных файлах (расширения не входящие
  в `INTERPOLATABLE_EXTENSIONS`).
