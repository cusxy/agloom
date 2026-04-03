---
summary: Plugin Values — декларация, валидация и резолвинг переменных плагинов и локального проекта
description: >
  Расширяет plugin.yml секцией variables для декларации переменных плагина,
  config.yml секцией variables для переменных локального проекта и полем values
  в plugin entry для передачи значений. Добавляет namespace ${values:*}
  в систему интерполяции. Определяет процедуры Resolve Plugin Values
  и Resolve Local Values с валидацией, fail-fast для required и sensitive.
type: spec
status: implemented
relates:
  - docs/specs/plugin-manifest.md
  - docs/specs/plugin-loading.md
  - docs/specs/git-plugin-loading.md
  - docs/specs/interpolation.md
  - docs/specs/config.md
  - docs/specs/cli.md
  - docs/specs/layer-model.md
  - docs/specs/provider-overlay.md
maps_to:
  - src/interpolation/
  - src/cli/
  - src/instructions-transpiler/adapters/
  - src/agents-transpiler/adapters/
  - src/skills-transpiler/
  - src/docs-transpiler/
---

# Plugin Values

Ключевые слова «ТРЕБУЕТСЯ», «ЗАПРЕЩАЕТСЯ», «ДОЛЖЕН», «НЕ ДОЛЖЕН», «СЛЕДУЕТ»,
«НЕ СЛЕДУЕТ», «МОЖЕТ» и «НЕОБЯЗАТЕЛЬНО» в этом документе толкуются
в соответствии с [RFC 2119](https://tools.ietf.org/html/rfc2119).

Данная спецификация описывает систему plugin values — декларативную
конфигурацию переменных плагинов и локального проекта. Система обеспечивает
декларацию переменных в `plugin.yml` и `config.yml`, передачу значений
через `values` в plugin entry, валидацию (required, sensitive, unknown)
и резолвинг значений с поддержкой `${env:*}` в defaults.

## Терминология

- **Variable declaration** — описание переменной в секции `variables`
  файла `plugin.yml` или `config.yml`. Содержит метаданные: описание,
  обязательность, значение по умолчанию, признак чувствительности.
- **Variable value** — конкретное значение переменной, заданное
  в секции `values` plugin entry в `config.yml` или разрешённое
  из default.
- **Resolved values** — итоговая карта `Record<string, string>`
  после применения resolution chain: merge значений из `values`
  с defaults из declarations.

## Расширение формата манифеста плагина

Формат файла `plugin.yml`
(см. `docs/specs/plugin-manifest.md` § Формат манифеста) расширяется
опциональным полем верхнего уровня:

- `variables` (object, опционально) — карта деклараций переменных
  плагина. Каждый ключ — имя переменной, значение — объект
  с полями декларации (см. § Тип VariableDeclaration). При
  отсутствии поля `variables` плагин не принимает переменных.

Пример:

```yaml
name: my-plugin
version: 1.0.0
description: "Example plugin"
author:
  name: "John"
  email: "john@example.com"
variables:
  team_name:
    description: "Team name for commit messages"
    required: true
  api_token:
    description: "API token for external service"
    required: true
    sensitive: true
  lint_command:
    description: "Custom lint command"
    default: "pnpm run lint"
  base_url:
    description: "Base URL for API calls"
    default: "${env:BASE_URL}"
```

## Тип VariableDeclaration

Декларация одной переменной:

- `description` (string, обязательно) — описание переменной.
  ДОЛЖНО быть непустой строкой.
- `required` (boolean, опционально, default: `false`) — если `true`,
  переменная ДОЛЖНА иметь значение (из `values` или из `default`).
- `default` (string, опционально) — значение по умолчанию. МОЖЕТ
  содержать `${env:*}` для подстановки переменных окружения.
  Подстановка `${env:*}` в `default` выполняется на этапе резолвинга
  (см. § Процедура Resolve Plugin Values, § Процедура Resolve
  Local Values).
- `sensitive` (boolean, опционально, default: `false`) — если `true`,
  значение переменной является чувствительным (токен, пароль).
  Чувствительные переменные ЗАПРЕЩАЕТСЯ задавать inline
  в `values` (см. § Валидация sensitive).

## Расширение процедуры Load Plugin Manifest

Процедура Load Plugin Manifest
(см. `docs/specs/plugin-manifest.md` § Процедура Load Plugin Manifest)
расширяется обработкой поля `variables`.

**Новые шаги:**

После шага 11 (валидация keywords):

12\. Проверить, содержит ли результат парсинга поле `variables`.
13\. Если `variables` присутствует — проверить, что значение является
объектом (не массивом, не примитивом).
14\. Для каждой записи в `variables` — валидировать как
VariableDeclaration:
14.1. Проверить, что значение является объектом.
14.2. Проверить наличие и тип поля `description` (непустая строка).
14.3. Если поле `required` присутствует — проверить, что значение
является boolean.
14.4. Если поле `default` присутствует — проверить, что значение
является строкой.
14.5. Если поле `sensitive` присутствует — проверить, что значение
является boolean.

**Новые расширения:**

12a. Поле `variables` отсутствует → значение `variables` равно `null`
(плагин не декларирует переменных).

13a. Значение `variables` не является объектом →
`Error("Invalid plugin manifest: 'variables' must be an object.")`.

14.1a. Значение записи не является объектом →
`Error("Invalid plugin manifest: variable '{key}' must be an object.")`.

14.2a. Поле `description` отсутствует или не является непустой строкой →
`Error("Invalid plugin manifest: variable '{key}' must have a non-empty 'description'.")`.

14.3a. Значение `required` не является boolean →
`Error("Invalid plugin manifest: variable '{key}' field 'required' must be a boolean.")`.

14.4a. Значение `default` не является строкой →
`Error("Invalid plugin manifest: variable '{key}' field 'default' must be a string.")`.

14.5a. Значение `sensitive` не является boolean →
`Error("Invalid plugin manifest: variable '{key}' field 'sensitive' must be a boolean.")`.

**Изменения в результате:**

К существующему типу `PluginManifest`
(см. `docs/specs/plugin-manifest.md` § Тип PluginManifest)
ТРЕБУЕТСЯ добавить поле:

- `variables` (Record\<string, VariableDeclaration> | null) — карта
  деклараций переменных (`null` если поле отсутствует в манифесте).

## Расширение формата конфигурационного файла

### Секция variables в config.yml

Формат файла `.agloom/config.yml`
(см. `docs/specs/config.md` § Формат файла) расширяется
опциональным полем верхнего уровня:

- `variables` (object, опционально) — карта переменных локального
  проекта. Каждый ключ — имя переменной. Значение МОЖЕТ быть:
  - **Строка** — трактуется как сокращённый формат
    `{ default: "<значение>" }`. Все остальные поля принимают
    значения по умолчанию (`required: false`,
    `sensitive: false`, `description: ""`).
  - **Объект** — полный формат VariableDeclaration. Поле
    `description` в config.yml НЕОБЯЗАТЕЛЬНО (default: `""`),
    в отличие от plugin.yml где `description` обязательно.

Пример:

```yaml
adapters:
  - claude
variables:
  project_name: "${env:PROJECT_NAME}"
  team:
    description: "Team name"
    default: "platform"
  api_key:
    description: "API key"
    default: "${env:API_KEY}"
    sensitive: true
```

### Секция values в plugin entry

Формат записи плагина в массиве `plugins`
(см. `docs/specs/git-plugin-loading.md`
§ Унифицированный формат записи плагина) расширяется
опциональным полем в объектных форматах `LocalPluginEntry`
и `GitPluginEntry`:

- `values` (object, опционально) — карта значений переменных
  плагина. Каждый ключ — имя переменной из `variables` плагина.
  Каждое значение ДОЛЖНО быть строкой. Значение МОЖЕТ содержать
  `${env:*}` для подстановки переменных окружения.

Пример:

```yaml
plugins:
  - git: git@github.com:cusxy/skill-cycling
    values:
      team_name: "platform"
      api_token: "${env:CYCLING_API_TOKEN}"
  - path: ../local-plugin
    values:
      feature_flag: "true"
```

## Расширение процедуры Load Config

Процедура Load Config (см. `docs/specs/config.md`
§ Процедура Load Config) расширяется обработкой полей `variables`
и `values`.

### Обработка variables

**Новые шаги:**

После обработки поля `plugins` (шаги 5–6,
см. `docs/specs/plugin-loading.md`
§ Расширение процедуры Load Config):

7\. Проверить, содержит ли результат парсинга поле `variables`.
8\. Если `variables` присутствует — проверить, что значение
является объектом.
9\. Для каждой записи в `variables` — нормализовать в
VariableDeclaration:
9.1. Если значение является строкой — преобразовать в
`{ description: "", required: false, default: <значение>, sensitive: false }`.
9.2. Если значение является объектом — валидировать поля:
9.2.1. Если поле `description` присутствует — проверить,
что является строкой.
9.2.2. Если поле `required` присутствует — проверить,
что является boolean.
9.2.3. Если поле `default` присутствует — проверить,
что является строкой.
9.2.4. Если поле `sensitive` присутствует — проверить,
что является boolean.

**Новые расширения:**

7a. Поле `variables` отсутствует → значение `configVariables`
равно `null` (локальный проект не декларирует переменных).

8a. Значение `variables` не является объектом →
`Error("Invalid config: 'variables' must be an object.")`.

9.2a. Значение записи не является ни строкой, ни объектом →
`Error("Invalid config: variable '{key}' must be a string or an object.")`.

9.2.1a. Значение `description` не является строкой →
`Error("Invalid config: variable '{key}' field 'description' must be a string.")`.

9.2.2a. Значение `required` не является boolean →
`Error("Invalid config: variable '{key}' field 'required' must be a boolean.")`.

9.2.3a. Значение `default` не является строкой →
`Error("Invalid config: variable '{key}' field 'default' must be a string.")`.

9.2.4a. Значение `sensitive` не является boolean →
`Error("Invalid config: variable '{key}' field 'sensitive' must be a boolean.")`.

### Обработка values в plugin entries

При обработке каждого элемента массива `plugins` (шаг 6,
см. `docs/specs/git-plugin-loading.md`
§ Расширение процедуры Load Config):

Для объектных форматов (`LocalPluginEntry`, `GitPluginEntry`):

6.3. Если поле `values` присутствует — проверить, что значение
является объектом, все значения являются строками.

**Новые расширения:**

6.3a. Значение `values` не является объектом →
`Error("Invalid config: plugin 'values' must be an object.")`.

6.3b. Значение в `values` не является строкой →
`Error("Invalid config: plugin 'values' entry '{key}' must be a string.")`.

**Изменения в результате:**

К существующему результату Load Config ТРЕБУЕТСЯ добавить:

- `configVariables`
  (Record\<string, VariableDeclaration> | null) — нормализованная
  карта переменных локального проекта, или `null` если поле
  `variables` отсутствует.

## Расширение типов записей плагинов

### Расширение типа ParsedPluginEntry

Тип `ParsedPluginEntry`
(см. `docs/specs/git-plugin-loading.md` § Тип ParsedPluginEntry)
расширяется опциональным полем:

- `values` (Record\<string, string> | null) — карта значений
  переменных из `values` plugin entry. `null` если `values`
  не указан.

### Расширение процедуры Parse Plugin Entry

Процедура Parse Plugin Entry
(см. `docs/specs/git-plugin-loading.md`
§ Процедура Parse Plugin Entry) расширяется обработкой поля `values`.

**Изменения в шагах 5 и 6:**

Шаг 5 (объект `LocalPluginEntry`) изменяется:

5\. Вернуть `{ type: "local", path: entry.path, url: null,
ref: null, values: entry.values ?? null }`.

Шаг 6 (объект `GitPluginEntry`) изменяется:

6\. Вернуть `{ type: "git", url: entry.git, ref: entry.ref ?? null,
path: entry.path ?? null, values: entry.values ?? null }`.

Строковые записи (шаги 2–4) НЕ поддерживают `values` —
результат содержит `values: null`.

## Валидация sensitive

Переменная с `sensitive: true` ЗАПРЕЩАЕТСЯ задавать inline
(без использования `${env:*}`) в секции `values` plugin entry
в `config.yml`. Это обеспечивает защиту от случайного commit
секретов в конфигурационный файл.

Значение считается inline, если оно НЕ содержит ни одного
вхождения паттерна `${env:*}`. Значение, содержащее хотя бы
одно вхождение `${env:*}`, считается безопасным (ссылается
на переменную окружения).

Примеры:

- `api_token: "my-secret-token"` — inline, ЗАПРЕЩЕНО для sensitive.
- `api_token: "${env:API_TOKEN}"` — ссылка на env, допустимо.
- `api_token: "prefix-${env:API_TOKEN}"` — содержит `${env:*}`,
  допустимо.

## Resolution chain для plugin values

Резолвинг значений переменных плагина выполняется в следующем
порядке (от высшего приоритета к низшему):

1. `values` из plugin entry в `config.yml` (пользовательские
   значения).
2. `default` из `variables` в `plugin.yml` (значения по умолчанию
   плагина).

На каждом уровне значения, содержащие `${env:*}`, ТРЕБУЕТСЯ
интерполировать с использованием `process.env` (после загрузки
`.env` файла, см. `docs/specs/interpolation.md`
§ Загрузка .env файла).

## Resolution chain для config variables

Резолвинг значений переменных локального проекта:

1. `default` из `variables` в `config.yml`.

Значения `default`, содержащие `${env:*}`, ТРЕБУЕТСЯ
интерполировать с использованием `process.env`.

## Процедура Resolve Plugin Values (cli:procedure)

Резолвинг и валидация значений переменных для одного плагина.

**Вход:**

- `declarations` (Record\<string, VariableDeclaration> | null,
  обязательно) — декларации переменных из манифеста плагина.
- `providedValues` (Record\<string, string> | null, обязательно) —
  значения из `values` plugin entry в `config.yml`.
- `env` (Record\<string, string | undefined>, обязательно) —
  объект окружения для разрешения `${env:*}`.

**Поведение:**

1. Если `declarations` равен `null` и `providedValues` равен `null` —
   вернуть пустую карту `{}`.
2. Если `declarations` равен `null` и `providedValues` не равен
   `null` — перейти к шагу 3.
3. Проверить наличие unknown variables: для каждого ключа
   из `providedValues` проверить, что ключ присутствует
   в `declarations`.
4. Для каждого ключа из `providedValues`, если соответствующая
   декларация имеет `sensitive: true` — проверить, что значение
   содержит хотя бы одно вхождение паттерна `${env:` (валидация
   sensitive).
5. Создать пустую карту `resolved: Record<string, string>`.
6. Для каждой декларации из `declarations`:
   6.1. Если ключ присутствует в `providedValues` — взять значение
   из `providedValues`.
   6.2. Иначе, если декларация имеет поле `default` — взять
   значение из `default`.
   6.3. Иначе — значение отсутствует.
7. Для каждого значения из шага 6 — интерполировать `${env:*}`
   в значении: заменить каждое вхождение `${env:NAME}`
   на значение `env[NAME]`.
8. Для каждой декларации с `required: true` — проверить, что
   значение присутствует в `resolved` (не отсутствует после
   шагов 6–7).
9. Вернуть `resolved`.

**Расширения:**

2a. `declarations` равен `null`, `providedValues` не равен `null` →
все ключи из `providedValues` являются unknown →
`Error("Unknown plugin values: '{keys}'. Plugin does not declare any variables.")`.
`{keys}` — список ключей через запятую.

3a. Ключ из `providedValues` отсутствует в `declarations` →
`Error("Unknown plugin value: '{key}'. Declared variables: {declaredKeys}.")`.
`{declaredKeys}` — список ключей `declarations` через запятую.

4a. Значение sensitive переменной не содержит `${env:` →
`Error("Sensitive variable '{key}' must not be set inline. Use ${env:VAR_NAME} to reference an environment variable.")`.

7a. `${env:NAME}` в значении, но `env[NAME]` не определён
(значение `undefined`) →
`Error("Undefined environment variable: '{NAME}' in value for variable '{key}'.")`.

8a. Required переменная не имеет значения →
`Error("Required plugin variable '{key}' is not set and has no default.")`.

**Результат:**

- `resolved` (Record\<string, string>) — карта имён переменных
  к их разрешённым значениям. Содержит только переменные,
  для которых найдено значение (из `providedValues` или `default`).
  Переменные без значения и без `required: true` отсутствуют
  в карте.

## Процедура Resolve Local Values (cli:procedure)

Резолвинг значений переменных локального проекта из `config.yml`.

**Вход:**

- `declarations` (Record\<string, VariableDeclaration> | null,
  обязательно) — нормализованные декларации переменных
  из `config.yml`.
- `env` (Record\<string, string | undefined>, обязательно) —
  объект окружения для разрешения `${env:*}`.

**Поведение:**

1. Если `declarations` равен `null` — вернуть пустую карту `{}`.
2. Создать пустую карту `resolved: Record<string, string>`.
3. Для каждой декларации из `declarations`:
   3.1. Если декларация имеет поле `default` — взять значение
   из `default`.
   3.2. Иначе — значение отсутствует.
4. Для каждого значения из шага 3 — интерполировать `${env:*}`
   в значении: заменить каждое вхождение `${env:NAME}`
   на значение `env[NAME]`.
5. Для каждой декларации с `required: true` — проверить, что
   значение присутствует в `resolved`.
6. Вернуть `resolved`.

**Расширения:**

4a. `${env:NAME}` в значении, но `env[NAME]` не определён →
`Error("Undefined environment variable: '{NAME}' in value for variable '{key}'.")`.

5a. Required переменная не имеет значения →
`Error("Required config variable '{key}' is not set and has no default.")`.

**Результат:**

- `resolved` (Record\<string, string>) — карта имён переменных
  к их разрешённым значениям.

## Расширение namespace интерполяции

Система интерполяции (см. `docs/specs/interpolation.md`
§ Синтаксис переменных) расширяется namespace `values`:

- `${values:NAME}` — подстановка значения из resolved values.
- `\${values:NAME}` — escape: заменяется на литерал
  `${values:NAME}` (backslash потребляется).

`NAME` — один или более символов, не содержащих `}`.

### Расширение функции interpolate

Функция `interpolate`
(см. `docs/specs/interpolation.md` § Интерполяция контента)
расширяется поддержкой namespace `values`.

**Новые параметры:**

- `values` (Record\<string, string>, опционально,
  default: `{}`) — карта resolved values для подстановки
  `${values:NAME}`.

**Новые шаги:**

После шага 5 (обработка `${env:NAME}`) и перед шагом 6
(сохранение неизменённого текста). Существующие шаги 6 и 7
сдвигаются на 8 и 9:

6\. Для каждого вхождения `\${values:NAME}` — заменить
на литерал `${values:NAME}` (потребить backslash).

7\. Для каждого вхождения `${values:NAME}` (без предшествующего
`\`) — найти `NAME` в `values`, подставить значение.

**Новые расширения:**

7a. `NAME` не найден в `values` →
`InterpolationError("Unknown values variable: {NAME}")`.

### Изоляция per-plugin

Каждый плагин ДОЛЖЕН получать только свои resolved values
при интерполяции. Плагин A НЕ ДОЛЖЕН иметь доступ к values
плагина B. Глобальных values НЕ существует.

Локальный проект получает resolved local values
при интерполяции своего контента.

## Расширение процедуры Resolve Plugins

Процедура Resolve Plugins
(см. `docs/specs/plugin-loading.md` § Процедура Resolve Plugins)
расширяется передачей `values` в `ResolvedPlugin`.

**Изменения в шаге 2.9:**

Шаг 2.9 (добавление ResolvedPlugin) изменяется:

2.9. Добавить `ResolvedPlugin` с `name`, `path`, `manifest`
и `values` (из `entry.values`, `null` если отсутствует)
в массив `resolved`.

### Расширение типа ResolvedPlugin

Тип `ResolvedPlugin`
(см. `docs/specs/plugin-loading.md` § Тип ResolvedPlugin)
расширяется полем:

- `values` (Record\<string, string> | null) — значения из `values`
  plugin entry в `config.yml`. `null` если `values` не указан.

## Расширение команды transpile (cli:command-ext)

Команда `transpile`
(см. `docs/specs/cli.md` § Команда transpile,
`docs/specs/plugin-loading.md` § Расширение команды transpile,
`docs/specs/interpolation.md` § Расширение команды transpile)
расширяется резолвингом plugin values и local values.

**Новые шаги:**

После шага 3.2/3.3 (Resolve Plugins) и перед шагом 4
(цикл по записям):

3.4. Извлечь `configVariables` из результата Load Config.
3.5. Выполнить процедуру Resolve Local Values
(см. § Процедура Resolve Local Values) с `configVariables`
и `process.env`. Сохранить результат как `localResolvedValues`.
3.6. Для каждого плагина из `plugins`:
3.6.1. Выполнить процедуру Resolve Plugin Values
(см. § Процедура Resolve Plugin Values) с
`plugin.manifest.variables`, `plugin.values` и `process.env`.
Сохранить результат в `plugin.resolvedValues`.

**Изменения в шаге 4 (цикл по записям):**

В цикле шага 4, при обработке каждой записи адаптера:

Шаг 4.2 (обработка плагинов) изменяется:

4.2. Для каждого плагина из `plugins` в порядке объявления:

4.2.0. Установить `adapter.values = plugin.resolvedValues`
для адаптеров Instructions и Agents текущей записи.

4.2.1. Сформировать `pluginValuesByAgentId` — карту
`Record<string, Record<string, string>>`, где ключ —
`entry.id` текущего адаптера, значение —
`plugin.resolvedValues`. Карта используется для передачи
resolved values в `writeResults` транспилеров Skills, Docs,
Schemas через параметр `valuesByAgentId`.

4.2.2–4.2.6. Шаги транспиляции (Instructions, Skills, Agents,
Docs, Schemas) ДОЛЖНЫ выполняться с передачей
`plugin.resolvedValues` в качестве `values` параметра
для интерполяции (см. § Интеграция с транспилерами):

- Instructions: через `adapter.values` (установлен в 4.2.0).
- Skills: через `valuesByAgentId` = `pluginValuesByAgentId`
  в параметрах шага транспиляции.
- Agents: через `adapter.values` (установлен в 4.2.0).
- Docs: через `valuesByAgentId` = `pluginValuesByAgentId`
  в параметрах шага транспиляции.
- Schemas: через `valuesByAgentId` = `pluginValuesByAgentId`
  в параметрах шага транспиляции.

Шаги 4.3–4.5 (обработка локального проекта) изменяются:

4.3.0. Установить `adapter.values = localResolvedValues`
для адаптеров Instructions и Agents текущей записи.

4.3.1. Сформировать `localValuesByAgentId` — карту
`Record<string, Record<string, string>>`, где ключ —
`entry.id`, значение — `localResolvedValues`.

4.3.2–4.3.6. Шаги транспиляции (Instructions, Skills, Agents,
Docs, Schemas) ДОЛЖНЫ выполняться с передачей
`localResolvedValues` в качестве `values` параметра
для интерполяции:

- Instructions: через `adapter.values` (установлен в 4.3.0).
- Skills: через `valuesByAgentId` = `localValuesByAgentId`.
- Agents: через `adapter.values` (установлен в 4.3.0).
- Docs: через `valuesByAgentId` = `localValuesByAgentId`.
- Schemas: через `valuesByAgentId` = `localValuesByAgentId`.

**Изменения в шаге 4.6 (формирование массива layers):**

Вызов `buildLayers` ДОЛЖЕН передавать `plugin.resolvedValues`
для каждого плагина и `localResolvedValues` в качестве
`localValues` (см. § Расширение buildLayers).

**Новые расширения:**

3.5a. Resolve Local Values вернул ошибку → отобразить сообщение
ошибки; процесс завершается с exit code 1.

3.6.1a. Resolve Plugin Values вернул ошибку → отобразить
сообщение ошибки; процесс завершается с exit code 1.

## Интеграция с транспилерами

Resolved values передаются в функцию `interpolate` через
параметр `values`. Транспилеры (Instructions, Skills, Agents,
Docs, Schemas) при вызове `interpolate` ДОЛЖНЫ передавать
`values` соответствующего источника (плагина или локального
проекта).

### Расширение вызовов interpolate

Все точки интеграции, описанные в `docs/specs/interpolation.md`
§ Интеграция с транспилерами, расширяются передачей `values`:

- Instructions Transpiler `transformContent`: вызов `interpolate`
  с `variables` и `values`.
- Agents Transpiler `transformContent`: вызов `interpolate`
  с `variables` и `values`.
- Skills Transpiler `writeResults`: вызов `interpolate`
  с `variables` и `values`.
- Docs Transpiler `writeResults`: вызов `interpolate`
  с `variables` и `values`.
- Schemas Transpiler `writeResults`: вызов `interpolate`
  с `variables` и `values`.

### Расширение адаптеров Instructions и Agents

Адаптеры Instructions Transpiler и Agents Transpiler
расширяются полем `values` для передачи resolved values
в `transformContent`.

**Новые поля:**

К типам адаптеров Instructions Transpiler
(см. `docs/specs/instructions-transpiler.md`)
и Agents Transpiler
(см. `docs/specs/agents-transpiler.md`) ТРЕБУЕТСЯ
добавить поле:

- `values` (Record\<string, string>, опционально) — карта
  resolved values для подстановки `${values:NAME}`
  при интерполяции. Если поле установлено, `transformContent`
  ДОЛЖЕН передавать `values` в `interpolate`.

Поле устанавливается командой `transpile` перед вызовом
шага транспиляции (см. § Расширение команды transpile).

### Расширение writeResults Skills и Docs Transpiler

Операции `writeResults` транспилеров Skills и Docs
расширяются параметром `valuesByAgentId` в объекте `options`.

**Новые параметры:**

К объекту `options` операции `writeResults` транспилеров
Skills (см. `docs/specs/skills-transpiler.md`
§ Запись результатов) и Docs ТРЕБУЕТСЯ добавить поле:

- `valuesByAgentId`
  (Record\<string, Record\<string, string>>, опционально) —
  карта resolved values, индексированная по `agentId`.
  При интерполяции файла ДОЛЖНО использоваться значение
  `valuesByAgentId[result.agentId]`.

**Изменения в поведении:**

При наличии `options.valuesByAgentId` вызов `interpolate`
в шаге копирования файлов ДОЛЖЕН передавать
`valuesByAgentId[result.agentId]` в качестве параметра
`values`.

### Расширение процедуры «Шаг транспиляции»

Процедура «Шаг транспиляции»
(см. `docs/specs/cli.md` § Шаг транспиляции,
`docs/specs/plugin-loading.md`
§ Расширение процедуры «Шаг транспиляции»)
расширяется параметром `valuesByAgentId`.

**Новые параметры:**

К существующим параметрам ТРЕБУЕТСЯ добавить:

- `valuesByAgentId`
  (Record\<string, Record\<string, string>>, опционально) —
  карта resolved values по `agentId`. Передаётся
  в `writeResults` через `options`.

**Изменения в поведении:**

Шаг 3 (вызов `writeResults`) изменяется: если
`valuesByAgentId` передан, объект `options` ДОЛЖЕН
содержать поле `valuesByAgentId`.

### Расширение overlay-step

Тип `LayerSource`
(см. `docs/specs/layer-model.md` § Тип LayerSource)
расширяется полем для per-layer values:

- `values` (Record\<string, string>, опционально) — карта
  resolved values для подстановки `${values:NAME}` при
  интерполяции файлов данного слоя.

Операция overlay в multi-layer режиме
(см. `docs/specs/layer-model.md`
§ Рефакторинг операции overlay) при интерполяции файлов
ДОЛЖНА передавать `layer.values` в `interpolate`
в качестве параметра `values`. Интерполяция `${values:*}`
выполняется ПЕРЕД deep merge, что обеспечивает per-plugin
изоляцию: каждый слой интерполируется своими resolved values
до объединения с другими слоями.

Операция overlay в legacy-режиме
(см. `docs/specs/provider-overlay.md` § Операция overlay)
при наличии параметра `values` ДОЛЖНА передавать его
в `interpolate`.

**Изменение в шаге 2.6:**

Шаг 2.6 (интерполяция в multi-layer режиме) изменяется:

2.6. Если `variables` передан И расширение файла входит
в `INTERPOLATABLE_EXTENSIONS` — прочитать содержимое
файла-источника с кодировкой UTF-8, вызвать
`interpolate(content, variables, env, layer.values)`.

### Расширение buildLayers

Процедура формирования массива layers
(см. `docs/specs/plugin-loading.md`
§ Формирование массива layers) расширяется передачей
resolved values в каждый `LayerSource`.

**Новые параметры:**

К существующим параметрам функции `buildLayers`
ТРЕБУЕТСЯ добавить:

- `plugins[].resolvedValues`
  (Record\<string, string>, опционально) — resolved values
  плагина, полученные из процедуры Resolve Plugin Values
  (см. § Процедура Resolve Plugin Values).
- `localValues` (Record\<string, string>, опционально) —
  resolved values локального проекта, полученные
  из процедуры Resolve Local Values
  (см. § Процедура Resolve Local Values).

**Изменения в поведении:**

Шаг 1 (формирование LayerSource для плагина) изменяется:

1\. Для каждого плагина из `plugins` создать `LayerSource`
с `id` = `plugin.name`, `overlayDir` =
`<plugin.path>/overlays/<entryId>/`
и `values` = `plugin.resolvedValues`.

Шаг 2 (формирование LayerSource для локального проекта)
изменяется:

2\. Создать `LayerSource` для локального проекта
с `id` = `"local"`, `overlayDir` =
`<projectRoot>/.agloom/overlays/<entryId>/`
и `values` = `localValues`.

## Обратная совместимость

При отсутствии секции `variables` в `plugin.yml`:

- `PluginManifest.variables` равен `null`.
- Процедура Resolve Plugin Values возвращает пустую карту `{}`.
- Namespace `${values:*}` не содержит значений.
  Если контент плагина не использует `${values:*}` —
  поведение идентично текущему.

При отсутствии секции `variables` в `config.yml`:

- `configVariables` равен `null`.
- Процедура Resolve Local Values возвращает пустую карту `{}`.
- Поведение идентично текущему.

При отсутствии поля `values` в plugin entry:

- `ParsedPluginEntry.values` равен `null`.
- `ResolvedPlugin.values` равен `null`.
- Процедура Resolve Plugin Values получает `providedValues: null`.
- Если плагин не объявляет required переменных без default —
  поведение идентично текущему.

При передаче `values: {}` в `interpolate` (пустая карта) —
`${values:NAME}` вызывает `InterpolationError`, что является
корректным поведением: переменная не найдена.

## Вне scope

Следующие аспекты НЕ ВХОДЯТ в scope данной спецификации:

- Глобальные values, разделяемые между плагинами.
- Наследование переменных между плагинами.
- Типизация значений переменных (все значения — строки).
- Вложенная интерполяция в values (`${values:${env:X}}`).
- Рекурсивная интерполяция (значение подставленной переменной
  содержит `${...}` — повторная подстановка не выполняется).
- Валидация SPDX-идентификатора в поле `license`
  (см. `docs/specs/plugin-manifest.md` § Вне scope).
- Шифрование sensitive values.
- UI для управления переменными (интерактивный ввод).
