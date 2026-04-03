---
summary: Загрузка плагинов из Git-репозиториев — унифицированный формат записи, кеширование с TTL, авторизация
description: >
  Расширяет plugin-loading поддержкой git-плагинов: унифицированный формат
  записи в config.yml (строковый автодетект и объектный формат), глобальный
  кеш с TTL-based invalidation для mutable refs, авторизация через
  credential helpers и AGLOOM_GIT_TOKEN, команда cache clean.
type: spec
status: implemented
relates:
  - docs/specs/plugin-loading.md
  - docs/specs/plugin-manifest.md
  - docs/specs/config.md
  - docs/specs/layer-model.md
  - docs/specs/cli.md
  - docs/specs/plugin-values.md
maps_to:
  - src/cli/
---

# Загрузка плагинов из Git-репозиториев

Ключевые слова «ТРЕБУЕТСЯ», «ЗАПРЕЩАЕТСЯ», «ДОЛЖЕН», «НЕ ДОЛЖЕН», «СЛЕДУЕТ»,
«НЕ СЛЕДУЕТ», «МОЖЕТ» и «НЕОБЯЗАТЕЛЬНО» в этом документе толкуются
в соответствии с [RFC 2119](https://tools.ietf.org/html/rfc2119).

Данная спецификация расширяет механизм загрузки плагинов
(см. `docs/specs/plugin-loading.md`) поддержкой загрузки плагинов
из Git-репозиториев. Спецификация описывает унифицированный формат записи
плагина в конфиге, глобальный кеш с TTL-based invalidation,
авторизацию и команду `cache clean`.

## Терминология

- **Git-плагин** — плагин, источник которого указан как Git-репозиторий
  (HTTPS или SSH URL) в конфигурационном файле.
- **Локальный плагин** — плагин, источник которого указан как путь
  в файловой системе. Определён в `docs/specs/plugin-loading.md`.
- **Ref** — ссылка Git: тег, имя ветки, полный commit SHA (40 hex-символов)
  или `null` (отсутствует). При `null` разрешается в HEAD (default branch).
- **Resolved SHA** — полный commit SHA (40 hex-символов), однозначно
  идентифицирующий состояние репозитория.
- **Mutable ref** — ref, указывающий на разные коммиты в разные моменты
  времени (имя ветки). HEAD также является mutable ref.
- **Immutable ref** — ref, стабильно указывающий на один коммит
  (тег или полный commit SHA). Тег определяется как ref, который
  НЕ является 40-hex SHA, но `git ls-remote` возвращает точное
  совпадение по `refs/tags/<ref>`.
- **Git URL** — строка, являющаяся URL git-репозитория. Определяется
  по наличию хотя бы одного из признаков: содержит `://`, начинается
  с `git@`, заканчивается на `.git`.

## Унифицированный формат записи плагина

Формат поля `plugins` в `.agloom/config.yml`
(см. `docs/specs/plugin-loading.md` § Расширение формата
конфигурационного файла) расширяется поддержкой git-плагинов.
Тип поля изменяется с `array<string>`
на `array<string | LocalPluginEntry | GitPluginEntry>`.

Каждый элемент массива `plugins` ДОЛЖЕН быть одним из:

- **Строка** — автодетект типа:
  - Если строка содержит `#` — git-плагин (разбор по процедуре
    Parse Plugin Entry, см. § Процедура Parse Plugin Entry).
  - Если строка НЕ содержит `#`, но является Git URL
    (см. § Функция isGitUrl) — git-плагин без ref
    (`ref: null`).
  - Иначе — локальный путь к плагину. Обрабатывается по текущей
    логике (см. `docs/specs/plugin-loading.md`).
- **Объект `LocalPluginEntry`** — запись локального плагина:
  - `path` (string, обязательно) — путь к директории плагина.
    Путь МОЖЕТ быть относительным (разрешается относительно корня
    проекта) или абсолютным.
- **Объект `GitPluginEntry`** — запись git-плагина со следующими полями:
  - `git` (string, обязательно) — URL git-репозитория. ДОЛЖЕН быть
    валидным HTTPS URL (начинается с `https://`) или SSH URL
    (формат `git@<host>:<owner>/<repo>` или `ssh://`).
  - `ref` (string, опционально) — Git ref: тег, имя ветки
    или полный commit SHA (40 hex-символов). При отсутствии —
    разрешается в HEAD (default branch).
  - `path` (string, опционально) — относительный путь к подпапке
    внутри репозитория, содержащей плагин. Путь ДОЛЖЕН быть
    относительным (без ведущего `/`). Путь НЕ ДОЛЖЕН содержать
    компоненты `..`.

Строковый формат git-плагина:

- С ref: `<url>#<ref>` — пример: `https://github.com/org/repo#v1.0.0`.
- С ref и subpath (Terraform-style `//`):
  `<url>//<path>#<ref>` — пример:
  `https://github.com/org/repo//plugins/eslint#v1.0.0`.
- SSH с ref: `git@github.com:org/repo#main`.
- Без ref (автодетект Git URL): `<url>` — пример:
  `https://github.com/org/repo`. Ref разрешается в HEAD.
- Без ref с subpath: `<url>//<path>` — пример:
  `https://github.com/org/repo//plugins/eslint`. Ref разрешается в HEAD.
- SSH без ref: `git@github.com:org/repo`.

Пример конфигурации:

```yaml
plugins:
  - ../local-plugin # строка — локальный
  - path: ../local-plugin # объект — локальный
  - https://github.com/org/repo#v1.0.0 # строка — git с ref
  - https://github.com/org/repo//plugins/eslint#v1.0.0 # строка — git с subpath и ref
  - git@github.com:org/repo#main # строка — git SSH с ref
  - https://github.com/org/repo # строка — git без ref (HEAD)
  - https://github.com/org/repo//plugins/eslint # строка — git с subpath без ref (HEAD)
  - git@github.com:org/repo # строка — git SSH без ref (HEAD)
  - https://github.com/org/repo.git # строка — git без ref (HEAD, .git суффикс)
  - git: https://github.com/org/repo # объект — git с ref
    ref: v1.0.0
    path: plugins/eslint
  - git: https://github.com/org/repo # объект — git без ref (HEAD)
```

## Тип LocalPluginEntry

- `path` (string) — путь к директории плагина.

## Тип GitPluginEntry

- `git` (string) — URL git-репозитория.
- `ref` (string | null) — Git ref (тег, ветка или commit SHA).
  `null` если не указан — разрешается в HEAD (default branch).
- `path` (string | null) — относительный путь к подпапке
  (`null` если не указан).

## Тип ParsedPluginEntry

Результат процедуры Parse Plugin Entry:

- `type` (string: `"local"` | `"git"`) — тип плагина.
- `path` (string) — для `"local"`: путь к директории плагина.
  Для `"git"`: subpath внутри репозитория (если указан), иначе `null`.
- `url` (string | null) — URL git-репозитория (только для `"git"`,
  `null` для `"local"`).
- `ref` (string | null) — Git ref (только для `"git"`,
  `null` для `"local"`).

## Функция isGitUrl

Определяет, является ли строка Git URL. Строка является Git URL,
если выполняется хотя бы одно из условий:

- Строка содержит `://` (HTTPS или SSH протокол).
- Строка начинается с `git@` (SSH shorthand).
- Строка заканчивается на `.git`.

Функция возвращает `true` если хотя бы одно условие выполнено,
`false` иначе.

## Процедура Parse Plugin Entry (cli:procedure)

Разбор элемента массива `plugins` из raw entry (string | object)
в типизированную структуру `ParsedPluginEntry`.

**Вход:**

- `entry` (string | object, обязательно) — элемент массива `plugins`.

**Поведение:**

1. Определить тип `entry`: если `entry` является строкой —
   перейти к шагу 2; если `entry` является объектом с полем `path` —
   перейти к шагу 5; если `entry` является объектом с полем `git` —
   перейти к шагу 6.
2. Проверить, содержит ли строка символ `#`.
3. Если строка НЕ содержит `#`:
   3.1. Вызвать `isGitUrl(entry)` (см. § Функция isGitUrl).
   3.2. Если результат `true` — проверить, содержит ли `entry`
   `//` (два слеша подряд), исключая `://` в начале протокола.
   3.2.1. Если `entry` содержит `//` — разбить: часть до `//` = git URL,
   часть после `//` = subpath. Вернуть
   `{ type: "git", url: gitUrl, ref: null, path: subpath }`.
   3.2.2. Если `entry` НЕ содержит `//` — вернуть
   `{ type: "git", url: entry, ref: null, path: null }`.
   3.3. Если результат `false` — вернуть
   `{ type: "local", path: entry, url: null, ref: null }`.
4. Если строка содержит `#` — разбить по последнему `#`:
   часть до = URL-часть, часть после = ref.
   4.1. Проверить, содержит ли URL-часть `//` (два слеша подряд),
   исключая `://` в начале протокола.
   4.2. Если URL-часть содержит `//` — разбить: часть до `//` = git URL,
   часть после `//` = subpath.
   4.3. Если URL-часть НЕ содержит `//` — git URL = URL-часть,
   subpath = `null`.
   4.4. Вернуть `{ type: "git", url: gitUrl, ref: ref, path: subpath }`.
5. Вернуть `{ type: "local", path: entry.path, url: null, ref: null }`.
6. Вернуть `{ type: "git", url: entry.git, ref: entry.ref ?? null, path: entry.path ?? null }`.

**Расширения:**

1a. `entry` не является ни строкой, ни объектом, или является объектом
без полей `path` и `git` →
`Error("Invalid config: each 'plugins' entry must be a string, an object with 'path' field, or an object with 'git' field.")`.

4a. Ref-часть (после `#`) является пустой строкой →
`Error("Invalid config: git plugin ref must not be empty in '{entry}'.")`.

4b. URL-часть (до `#`) является пустой строкой →
`Error("Invalid config: git plugin URL must not be empty in '{entry}'.")`.

**Результат:**

- `parsed` (ParsedPluginEntry) — типизированная структура записи плагина.

## Расширение процедуры Load Config

Процедура Load Config (см. `docs/specs/config.md`
§ Процедура Load Config) расширяется для валидации нового формата
поля `plugins`.

**Изменения в шаге 6:**

Шаг 6 (добавлен в `docs/specs/plugin-loading.md`
§ Расширение процедуры Load Config) изменяется: вместо проверки
«массив строк» ТРЕБУЕТСЯ проверять «массив, каждый элемент которого
является строкой, объектом `LocalPluginEntry` или объектом `GitPluginEntry`».

Для каждого элемента массива `plugins`:

6.1. Выполнить процедуру Parse Plugin Entry
(см. § Процедура Parse Plugin Entry) с элементом.
6.2. Если результат имеет `type: "git"` — валидировать git-специфичные поля:
6.2.1. Проверить, что значение `url` начинается с `https://`,
`ssh://` или соответствует паттерну `git@<host>:`.
6.2.2. Если значение `ref` не равно `null` — проверить,
что значение является непустой строкой.
6.2.3. Если поле `path` присутствует — проверить, что значение
является непустой строкой, не начинается с `/`
и не содержит компонентов `..`.

**Новые расширения:**

6.1a. Parse Plugin Entry вернул ошибку → пробросить ошибку.

6.2.1a. Значение `url` не является валидным Git URL →
`Error("Invalid config: plugin entry 'git' must be an HTTPS or SSH git URL.")`.

6.2.2a. Значение `ref` не равно `null` и не является непустой строкой
(например, пустая строка `""`) →
`Error("Invalid config: plugin entry 'ref' must be a non-empty string or absent.")`.

6.2.3a. Значение `path` не является непустой строкой,
начинается с `/` или содержит `..` →
`Error("Invalid config: plugin entry 'path' must be a relative path without '..' components.")`.

**Изменения в результате:**

К существующему результату добавляется (расширяет изменения
из `docs/specs/plugin-loading.md`):

- `pluginEntries` (array\<ParsedPluginEntry> | null) — список
  разобранных записей плагинов из конфига, или `null`
  если поле `plugins` отсутствует. Заменяет `pluginPaths`
  из `docs/specs/plugin-loading.md`.

## Глобальный кеш

### Расположение кеша

Кеш git-плагинов расположен в `~/.agloom/cache/plugins/`.
Директория создаётся автоматически при первом обращении.
Кеш является глобальным — разделяется между всеми проектами
на машине.

### Структура кеша

```text
~/.agloom/cache/plugins/
  <url-hash>/
    refs.yml
    <resolved-sha>/
      <содержимое репозитория>
```

- `url-hash` — SHA-256 хеш git URL, усечённый до первых
  16 hex-символов. Обеспечивает безопасные имена директорий
  без спецсимволов.
- `refs.yml` — метаданные разрешённых refs (см. § Метаданные refs).
- `resolved-sha` — полный commit SHA (40 hex-символов),
  на который разрешён ref.

### Алгоритм хеширования URL

URL ТРЕБУЕТСЯ нормализовать перед хешированием:

1. Удалить trailing `/` если присутствует.
2. Удалить суффикс `.git` если присутствует.
3. Привести к нижнему регистру.
4. Вычислить SHA-256 от нормализованной строки (UTF-8).
5. Взять первые 16 hex-символов результата.

Нормализация обеспечивает единый хеш для эквивалентных URL
(например, `https://github.com/org/repo` и
`https://github.com/org/repo.git`).

### Метаданные refs

Файл `~/.agloom/cache/plugins/<url-hash>/refs.yml` содержит
метаданные разрешённых refs для конкретного репозитория.
Формат — YAML:

```yaml
refs:
  main:
    sha: abc123def456789012345678901234567890abcd
    resolvedAt: "2026-04-02T10:30:00Z"
    mutable: true
  HEAD:
    sha: abc123def456789012345678901234567890abcd
    resolvedAt: "2026-04-02T10:30:00Z"
    mutable: true
  v1.0.0:
    sha: def456789012345678901234567890abcdef1234
    resolvedAt: "2026-04-01T08:00:00Z"
    mutable: false
```

Каждая запись содержит:

- `sha` (string) — полный commit SHA (40 hex-символов).
- `resolvedAt` (string) — ISO 8601 timestamp момента разрешения.
- `mutable` (boolean) — `true` для веток и HEAD, `false` для тегов
  и commit SHA. HEAD всегда является mutable ref.

Файл `refs.yml` создаётся при первом обращении к репозиторию
и обновляется при каждом разрешении ref.

### Настройка TTL

Файл `~/.agloom/settings.yml` содержит глобальные настройки Agloom.
Формат:

```yaml
cache:
  ttl: 24h
```

- `cache.ttl` (string, опционально, default: `"24h"`) — время жизни
  кеша для mutable refs. Формат: число с суффиксом
  (`h` — часы, `m` — минуты, `s` — секунды). Значение `"0"` —
  всегда выполнять re-resolve для mutable refs.

Если файл `~/.agloom/settings.yml` отсутствует — используется
значение по умолчанию `"24h"`.

## Процедура Resolve Git Ref (cli:procedure)

Разрешение Git ref в commit SHA с учётом кеша и TTL.

**Вход:**

- `gitUrl` (string, обязательно) — URL git-репозитория.
- `ref` (string | null, обязательно) — Git ref (тег, ветка,
  commit SHA или `null`). При `null` — разрешается в HEAD
  (default branch).
- `forceRefresh` (boolean, обязательно) — принудительное обновление
  mutable refs (игнорировать TTL).

**Поведение:**

1. Вычислить `urlHash` по алгоритму хеширования URL
   (см. § Алгоритм хеширования URL).
   1b. Если `ref` равен `null` — установить `ref` = `"HEAD"`.
2. Определить тип ref:
   2.1. Если `ref` является полным commit SHA (40 hex-символов,
   regex `^[0-9a-f]{40}$`) — классифицировать как immutable.
   Установить `resolvedSha` = `ref`.
   2.2. Иначе — перейти к шагу 3.
3. Прочитать файл `~/.agloom/cache/plugins/<urlHash>/refs.yml`.
4. Если `refs.yml` содержит запись для `ref`:
   4.1. Если запись имеет `mutable: false` — извлечь `resolvedSha`
   из записи. Перейти к шагу 7.
   4.2. Если запись имеет `mutable: true` и `forceRefresh` равен `false`:
   загрузить TTL из `~/.agloom/settings.yml`.
   4.3. Если `resolvedAt + TTL > now` — извлечь `resolvedSha`
   из записи. Перейти к шагу 7.
   4.4. Иначе — TTL истёк, перейти к шагу 5.
5. Выполнить `git ls-remote <gitUrl> <ref>`.
6. Определить mutability по результату ls-remote:
   6.1. Если вывод содержит строку с `refs/tags/<ref>` —
   классифицировать как immutable (`mutable: false`).
   6.2. Иначе — классифицировать как mutable (`mutable: true`).
   6.3. Извлечь `resolvedSha` из первого столбца вывода.
   6.4. Записать (или обновить) запись в `refs.yml`:
   `{ sha: resolvedSha, resolvedAt: now, mutable: <значение> }`.
7. Проверить наличие директории кеша
   `~/.agloom/cache/plugins/<urlHash>/<resolvedSha>/`.
8. Если директория кеша существует — вернуть `resolvedSha`
   и путь к кешу.
9. Выполнить процедуру Clone Git Repository
   (см. § Процедура Clone Git Repository) с `gitUrl`,
   `resolvedSha`, `ref`, `urlHash`.
10. Вернуть `resolvedSha` и путь к кешу.

**Расширения:**

3a. Файл `refs.yml` не существует — перейти к шагу 5.

5a. Команда `git ls-remote` завершилась с ненулевым exit code →
`Error("Authentication failed for '<gitUrl>': <stderr>")` если
stderr содержит сообщение об аутентификации;
иначе `Error("Failed to resolve ref '<ref>' for '<gitUrl>': <stderr>")`.

5b. Вывод `git ls-remote` не содержит строки с указанным ref →
`Error("Ref '<ref>' not found in '<gitUrl>': <stderr>")`.

**Результат:**

- `resolvedSha` (string) — полный commit SHA (40 hex-символов).
- `cachePath` (string) — абсолютный путь к директории кеша
  с содержимым репозитория.

## Процедура Clone Git Repository (cli:procedure)

Клонирование git-репозитория в кеш.

**Вход:**

- `gitUrl` (string, обязательно) — URL git-репозитория.
- `resolvedSha` (string, обязательно) — commit SHA для checkout.
- `ref` (string, обязательно) — исходный ref (после нормализации:
  `"HEAD"` если исходный ref был `null`).
- `urlHash` (string, обязательно) — хеш URL для структуры кеша.

**Поведение:**

1. Определить целевой путь кеша:
   `~/.agloom/cache/plugins/<urlHash>/<resolvedSha>/`.
2. Если целевой путь уже существует — вернуть путь (кеш hit).
3. Создать временную директорию для клонирования.
4. Определить стратегию клонирования по типу ref:
   4.1. Если `ref` равен `"HEAD"` — выполнить
   `git clone --depth 1 <gitUrl> <tmpDir>` (без `--branch`,
   клонирует default branch). Перейти к шагу 6.
   4.2. Если `ref` НЕ является полным commit SHA
   (40 hex-символов) и НЕ равен `"HEAD"` — выполнить
   `git clone --depth 1 --branch <ref> <gitUrl> <tmpDir>`.
   Перейти к шагу 6.
   4.3. Если `ref` является полным commit SHA — выполнить
   `git clone --filter=blob:none <gitUrl> <tmpDir>`.
5. Выполнить `git -C <tmpDir> checkout <resolvedSha>`.
6. Создать промежуточные каталоги для целевого пути кеша.
7. Переместить содержимое `<tmpDir>` в целевой путь кеша.
8. Удалить временную директорию.

**Расширения:**

4.1a. Команда `git clone --depth 1` (без `--branch`)
завершилась с ненулевым exit code → удалить временную директорию;
`Error("Failed to clone '<gitUrl>': <stderr>")`.

4.2a. Команда `git clone --depth 1 --branch` завершилась
с ненулевым exit code → удалить временную директорию;
`Error("Failed to clone '<gitUrl>': <stderr>")`.

4.3a. Команда `git clone --filter=blob:none` завершилась
с ненулевым exit code → выполнить fallback:
удалить временную директорию, выполнить
`git clone <gitUrl> <tmpDir>`,
выполнить `git -C <tmpDir> checkout <resolvedSha>`.
Перейти к шагу 6.

4.3a.1. Команда `git clone` (fallback) завершилась
с ненулевым exit code → удалить временную директорию;
`Error("Failed to clone '<gitUrl>': <stderr>")`.

4.3a.2. Команда `git checkout` (после fallback clone)
завершилась с ненулевым exit code → удалить временную
директорию;
`Error("Failed to checkout '<resolvedSha>' from '<gitUrl>': <stderr>")`.

5a. Команда `git checkout` завершилась с ненулевым exit code →
удалить временную директорию;
`Error("Failed to checkout '<resolvedSha>' from '<gitUrl>': <stderr>")`.

**Результат:**

- `cachePath` (string) — абсолютный путь к директории кеша.

## Расширение процедуры Resolve Plugins

Процедура Resolve Plugins (см. `docs/specs/plugin-loading.md`
§ Процедура Resolve Plugins) расширяется обработкой git-плагинов.

**Изменения во входных параметрах:**

Параметр `pluginPaths` (array\<string>) заменяется на:

- `pluginEntries` (array\<ParsedPluginEntry>, обязательно) —
  список разобранных записей плагинов из конфигурационного файла.
- `forceRefresh` (boolean, обязательно) — передаётся
  в Resolve Git Ref.

Параметр `projectRoot` (string, обязательно) — без изменений.

**Изменения в поведении:**

Шаг 2 изменяется. Для каждого `entry` из `pluginEntries`
в порядке объявления:

2.0. Определить тип записи по полю `type`:
2.0a. Если `entry.type === "local"` — обработать как локальный
плагин (шаги 2.1–2.9 без изменений,
см. `docs/specs/plugin-loading.md`).
2.0b. Если `entry.type === "git"` — обработать
как git-плагин (шаги 2.10–2.15).

Новые шаги для git-плагинов:

2.10. Выполнить процедуру Resolve Git Ref
(см. § Процедура Resolve Git Ref) с `entry.url`,
`entry.ref`, `forceRefresh`.
2.11. Определить корень плагина: если `entry.path` указан —
`<cachePath>/<entry.path>`, иначе — `cachePath`.
2.12. Проверить, что корень плагина существует и является
директорией.
2.13. Прочитать и валидировать `plugin.yml` из корня плагина
(шаги 2.3–2.5 из `docs/specs/plugin-loading.md`).
2.14. Проверить уникальность имени (шаги 2.6–2.8
из `docs/specs/plugin-loading.md`).
2.15. Добавить `ResolvedPlugin` с `name`, `path` (корень плагина),
`manifest`, `resolvedSha`, `gitUrl` и `gitRef` в массив `resolved`.

**Новые расширения:**

2.10a. Resolve Git Ref вернул ошибку → пробросить ошибку
(fail-fast, уровень 1).

2.12a. Корень плагина (с учётом `path`) не существует →
`Error("Plugin subpath '<entry.path>' not found in repository '<entry.url>' at ref '<entry.ref>'.")`.

2.12b. Корень плагина существует, но не является директорией →
`Error("Plugin subpath '<entry.path>' is not a directory in repository '<entry.url>'.")`.

## Расширение типа ResolvedPlugin

Тип `ResolvedPlugin` (см. `docs/specs/plugin-loading.md`
§ Тип ResolvedPlugin) расширяется опциональными полями для
git-плагинов:

- `resolvedSha` (string | null) — полный commit SHA для git-плагинов,
  `null` для локальных плагинов.
- `gitUrl` (string | null) — URL git-репозитория для git-плагинов,
  `null` для локальных плагинов.
- `gitRef` (string | null) — исходный ref из конфига для git-плагинов,
  `null` для локальных плагинов.

## Авторизация Git

Авторизация для git-операций (clone, ls-remote) ДОЛЖНА
делегироваться стандартным механизмам Git. Agloom НЕ ДОЛЖЕН
реализовывать собственную логику авторизации.

### Переменные окружения при git-операциях

При выполнении любой git-команды (clone, ls-remote) Agloom
ДОЛЖЕН устанавливать переменную окружения `GIT_TERMINAL_PROMPT=0`
для подавления интерактивного ввода.

### SSH

SSH-авторизация обрабатывается Git через стандартные механизмы:
ssh-agent, `~/.ssh/config`, `~/.ssh/known_hosts`. Agloom
НЕ ДОЛЖЕН модифицировать SSH-конфигурацию.

### HTTPS

HTTPS-авторизация обрабатывается Git через стандартные механизмы:
git credential helpers. Agloom НЕ ДОЛЖЕН передавать
credentials в git URL.

### Переменная окружения AGLOOM_GIT_TOKEN

Переменная `AGLOOM_GIT_TOKEN` подхватывается из `.env`
(см. commit 454c753 — dotenv loading уже реализован).

Если переменная окружения `AGLOOM_GIT_TOKEN` установлена —
Agloom ДОЛЖЕН передать её значение через механизм
`GIT_ASKPASS` при выполнении git-команд с HTTPS URL.
`GIT_ASKPASS` ДОЛЖЕН указывать на скрипт, возвращающий
значение `AGLOOM_GIT_TOKEN`. Если `AGLOOM_GIT_TOKEN`
не установлена — git-команды выполняются без модификации
`GIT_ASKPASS`.

### Хранение credentials

Credentials (токены, пароли, SSH-ключи) ЗАПРЕЩАЕТСЯ хранить
в `config.yml` или любых файлах проекта,
управляемых Agloom.

### Ошибки авторизации

При ошибке авторизации (git-команда завершилась с ошибкой,
stderr содержит сообщение об аутентификации) Agloom ДОЛЖЕН
завершиться с ошибкой уровня 1 (fail-fast). Формат сообщения
определён в расширении 5a процедуры Resolve Git Ref
(см. § Процедура Resolve Git Ref).

Сообщение об ошибке ДОЛЖНО содержать только описание проблемы
и stderr git-команды. Сообщение НЕ ДОЛЖНО содержать подсказок
по действиям (рекомендаций по исправлению).

## Команда `agloom cache clean` (cli:command)

`agloom cache clean` — удаляет глобальный кеш git-плагинов.

**Аргументы:**

Нет аргументов.

**Поведение:**

1. Определить путь к кешу: `~/.agloom/cache/plugins/`.
2. Проверить существование директории.
3. Рекурсивно удалить директорию и всё её содержимое.

**Расширения:**

2a. Директория не существует → вывести сообщение
«Cache directory does not exist. Nothing to clean.»;
exit code 0.

3a. Ошибка удаления (EACCES и т.п.) →
`Error("Failed to clean cache: <errorMessage>")`; exit code 1.

**Вывод:**

При отсутствии кеша:

```text
Cache directory does not exist. Nothing to clean.
```

При успехе:

```text
Cache cleaned: ~/.agloom/cache/plugins/
```

**Exit codes:**

- `0` — кеш успешно удалён или директория не существовала.
- `1` — ошибка удаления.

## Расширение команды transpile (cli:command-ext)

Команда `transpile` (см. `docs/specs/cli.md` § Команда transpile,
`docs/specs/plugin-loading.md` § Расширение команды transpile)
расширяется флагом `--refresh` и обработкой git-плагинов.

**Новые аргументы:**

- `--refresh` (boolean, опционально, default: `false`) —
  принудительное обновление mutable refs (игнорировать TTL).

**Изменения в шаге 3.1:**

Шаг 3.1 (извлечение `pluginPaths` из конфига) изменяется:
извлечь `pluginEntries` из результата Load Config.

**Изменения в шаге 3.2:**

Шаг 3.2 (вызов Resolve Plugins) ТРЕБУЕТСЯ вызывать
с параметрами `pluginEntries`, `projectRoot`
и `forceRefresh` = значение флага `--refresh`.

**Новые расширения:**

Нет новых расширений (ошибки git-плагинов обрабатываются
процедурой Resolve Plugins и её расширениями).

## Стратегия обработки ошибок

Ошибки git-плагинов ДОЛЖНЫ обрабатываться как ошибки уровня 1
(fail-fast), наравне с ошибками локальных плагинов
(см. `docs/specs/plugin-loading.md` § Стратегия обработки ошибок,
Уровень 1). Обоснование: пользователь явно объявил git-плагин
в `config.yml`, невозможность его загрузки — конфигурационная ошибка.

К ошибкам уровня 1 для git-плагинов относятся:

- Git URL невалиден (расширение 6.2.1a процедуры Load Config).
- Ref не найден (расширение 5b процедуры Resolve Git Ref).
- Clone завершился с ошибкой (расширения 4.1a, 4.2a, 4.3a.1
  процедуры Clone Git Repository).
- Checkout завершился с ошибкой (расширения 5a, 4.3a.2 процедуры
  Clone Git Repository).
- Ошибка авторизации (см. § Ошибки авторизации).
- Подпапка `path` не существует в репозитории (расширение 2.12a
  процедуры Resolve Plugins).
- `plugin.yml` не найден в целевой директории (расширение 2.3a
  из `docs/specs/plugin-loading.md`).

## Обратная совместимость

При отсутствии git-плагинов в массиве `plugins` (все элементы —
локальные пути) поведение ДОЛЖНО быть идентично текущей реализации
(см. `docs/specs/plugin-loading.md` § Обратная совместимость).

## Вне scope

Следующие аспекты НЕ ВХОДЯТ в scope данной спецификации:

- Формат манифеста плагина (`plugin.yml`) —
  см. `docs/specs/plugin-manifest.md`.
- Стратегии слияния файлов (deep merge, override) —
  см. `docs/specs/layer-model.md`.
- Зависимости между плагинами — итерация 3.
- Централизованный реестр плагинов.
- Автоматическое обновление git-плагинов (команда `agloom update`).
- Поддержка shallow-submodules в git-плагинах.
- Очистка устаревших записей кеша (GC).
- Версионный диапазон в ref (semver ranges).
- Провайдерные shorthand (`github:`, `gitlab:` и т.п.).
