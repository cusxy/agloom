---
summary: Манифест плагина (plugin.yml) — формат, валидация и структура директории плагина
description: >
  Определяет формат манифеста плагина (plugin.yml), структуру директории
  плагина, правила валидации полей (name, version, author)
  и процедуру загрузки манифеста.
type: spec
status: implemented
relates:
  - docs/specs/layer-model.md
  - docs/specs/config.md
  - docs/specs/provider-overlay.md
  - docs/specs/adapter-registry-ext.md
  - docs/specs/plugin-loading.md
  - docs/specs/plugin-values.md
maps_to:
  - src/cli/
---

# Манифест плагина

Ключевые слова «ТРЕБУЕТСЯ», «ЗАПРЕЩАЕТСЯ», «ДОЛЖЕН», «НЕ ДОЛЖЕН», «СЛЕДУЕТ»,
«НЕ СЛЕДУЕТ», «МОЖЕТ» и «НЕОБЯЗАТЕЛЬНО» в этом документе толкуются
в соответствии с [RFC 2119](https://tools.ietf.org/html/rfc2119).

Данная спецификация определяет формат манифеста плагина (`plugin.yml`),
структуру директории плагина и процедуру загрузки манифеста. Плагин
представляет собой директорию с манифестом и набором файлов, аналогичных
по структуре директории `.agloom/` локального проекта
(см. `docs/specs/provider-overlay.md`, `docs/specs/layer-model.md`).
Плагин участвует в модели слоёв как отдельный слой
(см. `docs/specs/layer-model.md` § Порядок применения слоёв).

## Терминология

- **Плагин (plugin)** — директория, содержащая файл `plugin.yml`
  в корне. Плагин является единицей расширения конфигурации agloom.
- **Манифест (manifest)** — файл `plugin.yml` в корне директории
  плагина. Содержит метаданные плагина: имя, версию, описание,
  лицензию и информацию об авторе.
- **Корень плагина (plugin root)** — директория, содержащая
  файл `plugin.yml`.

## Структура директории плагина

Директория плагина ДОЛЖНА содержать файл `plugin.yml` в корне.
Остальные файлы и директории НЕОБЯЗАТЕЛЬНЫ.

```text
<plugin-root>/
├── plugin.yml          # Манифест (обязательно)
├── AGLOOM.md           # Инструкции плагина (опционально)
├── AGLOOM.local.md     # Локальные инструкции плагина (опционально)
├── overlays/           # Overlay-файлы per-adapter (опционально)
│   ├── claude/
│   └── opencode/
├── skills/             # Skills плагина (опционально)
└── agents/             # Agents плагина (опционально)
```

### Описание элементов

- `plugin.yml` — манифест плагина (см. § Формат манифеста).
  Файл ДОЛЖЕН располагаться в корне директории плагина.
  Размещение манифеста в поддиректории ЗАПРЕЩАЕТСЯ.
- `AGLOOM.md` — файл инструкций плагина. Формат идентичен
  файлу `.agloom/AGLOOM.md` локального проекта
  (см. `docs/specs/instructions-transpiler.md`).
- `AGLOOM.local.md` — файл локальных инструкций плагина.
  Формат идентичен `.agloom/AGLOOM.local.md` локального проекта.
- `overlays/` — директория overlay-файлов. Структура идентична
  `.agloom/overlays/` (см. `docs/specs/provider-overlay.md`
  § Структура директории overlays/). Поддиректории именуются
  по идентификатору адаптера из реестра
  (см. `docs/specs/adapter-registry-ext.md`).
- `skills/` — директория skills плагина. Структура идентична
  `.agloom/skills/` (см. `docs/specs/skills-transpiler.md`).
- `agents/` — директория agents плагина. Структура идентична
  `.agloom/agents/` (см. `docs/specs/agents-transpiler.md`).

### Соответствие структуре .agloom/

Директория плагина является аналогом директории `.agloom/`
локального проекта. Соответствие путей:

| Путь в `.agloom/`         | Путь в плагине             |
| ------------------------- | -------------------------- |
| `.agloom/AGLOOM.md`       | `<plugin>/AGLOOM.md`       |
| `.agloom/AGLOOM.local.md` | `<plugin>/AGLOOM.local.md` |
| `.agloom/overlays/`       | `<plugin>/overlays/`       |
| `.agloom/skills/`         | `<plugin>/skills/`         |
| `.agloom/agents/`         | `<plugin>/agents/`         |

Файл `config.yml` НЕ ДОЛЖЕН присутствовать в директории плагина.
Конфигурация адаптеров определяется только в локальном проекте
(см. `docs/specs/config.md`).

## Формат манифеста

Файл `plugin.yml` ДОЛЖЕН быть валидным YAML-документом.

### Обязательные поля

- `name` (string, обязательно) — уникальный идентификатор плагина.
  Правила валидации описаны в § Валидация имени плагина.
- `version` (string, обязательно) — версия плагина в формате semver.
  Правила валидации описаны в § Валидация версии.
- `description` (string, обязательно) — описание плагина
  в свободной форме. ДОЛЖНО быть непустой строкой.
- `author` (object, обязательно) — информация об авторе.
  Структура описана в § Поле author.

### Опциональные поля

- `license` (string, опционально) — идентификатор лицензии
  в формате SPDX (например, `"MIT"`, `"Apache-2.0"`, `"GPL-3.0-only"`).
  Если указан, ДОЛЖЕН быть непустой строкой. Отсутствие поля
  допускается (например, для приватных плагинов).
- `homepage` (string, опционально) — URL домашней страницы плагина.
  ДОЛЖЕН быть валидным URL (parseable конструктором `URL`).
- `keywords` (array\<string>, опционально, default: `[]`) —
  массив ключевых слов для поиска плагина. Каждый элемент
  ДОЛЖЕН быть непустой строкой.

### Поле author

Поле `author` ДОЛЖНО быть объектом со следующими полями:

- `name` (string, обязательно) — имя автора. ДОЛЖНО быть
  непустой строкой.
- `email` (string, обязательно) — email автора. ДОЛЖЕН быть
  непустой строкой.
- `url` (string, опционально) — URL автора. Если указан,
  ДОЛЖЕН быть валидным URL (parseable конструктором `URL`).

### Пример манифеста

```yaml
name: my-eslint-config
version: 1.0.0
description: "Shared ESLint configuration for agloom projects"
license: MIT
author:
  name: "John Doe"
  email: "john@example.com"
  url: "https://example.com"
homepage: "https://github.com/example/my-eslint-config"
keywords:
  - eslint
  - config
```

## Валидация имени плагина

Имя плагина (`name`) ДОЛЖНО соответствовать следующим правилам:

1. Содержать только строчные латинские буквы (`a-z`), цифры (`0-9`)
   и дефисы (`-`).
2. Начинаться со строчной латинской буквы (`a-z`).
3. Заканчиваться строчной латинской буквой (`a-z`) или цифрой (`0-9`).
4. Иметь длину от 1 до 214 символов включительно.
5. НЕ ДОЛЖНО содержать последовательных дефисов (`--`).

Регулярное выражение для валидации:
`^[a-z]([a-z0-9]|(-(?!-)))*[a-z0-9]$|^[a-z]$`.

Примеры валидных имён: `my-plugin`, `eslint-config`, `a`, `plugin1`.

Примеры невалидных имён: `My-Plugin` (заглавные буквы),
`-plugin` (начинается с дефиса), `plugin-` (заканчивается дефисом),
`my--plugin` (последовательные дефисы), `my plugin` (пробел),
`my_plugin` (подчёркивание).

## Валидация версии

Поле `version` ДОЛЖНО соответствовать формату Semantic Versioning 2.0.0
(https://semver.org/). Валидация ТРЕБУЕТСЯ выполнять с использованием
библиотеки `semver` (функция `semver.valid()`). Строка версии
ДОЛЖНА возвращать не-`null` результат при вызове `semver.valid(version)`.

Примеры валидных версий: `1.0.0`, `0.1.0`, `1.2.3-beta.1`,
`1.0.0+build.123`.

Примеры невалидных версий: `1.0` (неполный формат), `v1.0.0`
(префикс `v`), `1.0.0.0` (лишний компонент).

## Обнаружение плагина

Директория является плагином agloom тогда и только тогда, когда
она содержит файл `plugin.yml` в корне. Проверка выполняется
по наличию файла, без анализа его содержимого. Валидация содержимого
манифеста выполняется отдельно (см. § Процедура Load Plugin Manifest).

## Процедура Load Plugin Manifest (cli:procedure)

Загрузка, парсинг и валидация манифеста плагина из указанной
директории.

**Вход:**

- `pluginDir` (string, обязательно) — абсолютный путь к корню
  директории плагина.

**Поведение:**

1. Определить путь к манифесту как `<pluginDir>/plugin.yml`.
2. Прочитать содержимое файла манифеста.
3. Распарсить содержимое как YAML.
4. Проверить наличие обязательного поля `name` и его соответствие
   правилам валидации имени (см. § Валидация имени плагина).
5. Проверить наличие обязательного поля `version` и его соответствие
   формату semver (см. § Валидация версии).
6. Проверить наличие обязательного поля `description`
   и его соответствие типу (непустая строка).
7. Проверить наличие обязательного поля `author`
   и его соответствие структуре (объект с обязательными полями
   `name` и `email`, оба — непустые строки).
8. Если поле `author.url` присутствует — проверить,
   что значение является валидным URL.
9. Если поле `license` присутствует — проверить,
   что значение является непустой строкой.
10. Если поле `homepage` присутствует — проверить,
    что значение является валидным URL.
11. Если поле `keywords` присутствует — проверить,
    что значение является массивом непустых строк.

**Расширения:**

2a. Файл `plugin.yml` не существует →
`Error("Plugin manifest not found: <pluginDir>/plugin.yml")`.

3a. Содержимое не является валидным YAML →
`Error("Invalid plugin manifest: <причина парсинга>")`.

4a. Поле `name` отсутствует →
`Error("Invalid plugin manifest: 'name' is required.")`.

4b. Значение `name` не соответствует правилам валидации →
`Error("Invalid plugin manifest: 'name' must contain only lowercase letters, digits, and hyphens, start with a letter, end with a letter or digit, and not contain consecutive hyphens.")`.

5a. Поле `version` отсутствует →
`Error("Invalid plugin manifest: 'version' is required.")`.

5b. Значение `version` не является валидной semver-строкой →
`Error("Invalid plugin manifest: 'version' must be a valid semver string.")`.

6a. Поле `description` отсутствует →
`Error("Invalid plugin manifest: 'description' is required.")`.

6b. Значение `description` не является непустой строкой →
`Error("Invalid plugin manifest: 'description' must be a non-empty string.")`.

7a. Поле `author` отсутствует →
`Error("Invalid plugin manifest: 'author' is required.")`.

7b. Значение `author` не является объектом →
`Error("Invalid plugin manifest: 'author' must be an object.")`.

7c. Поле `author.name` отсутствует или не является непустой строкой →
`Error("Invalid plugin manifest: 'author.name' must be a non-empty string.")`.

7d. Поле `author.email` отсутствует или не является непустой строкой →
`Error("Invalid plugin manifest: 'author.email' must be a non-empty string.")`.

8a. Значение `author.url` не является валидным URL →
`Error("Invalid plugin manifest: 'author.url' must be a valid URL.")`.

9a. Значение `license` присутствует, но не является непустой строкой →
`Error("Invalid plugin manifest: 'license' must be a non-empty string.")`.

10a. Значение `homepage` не является валидным URL →
`Error("Invalid plugin manifest: 'homepage' must be a valid URL.")`.

11a. Значение `keywords` не является массивом →
`Error("Invalid plugin manifest: 'keywords' must be an array of strings.")`.

11b. Массив `keywords` содержит элемент, который не является
непустой строкой →
`Error("Invalid plugin manifest: each keyword must be a non-empty string.")`.

**Результат:**

- `manifest` (PluginManifest) — валидированный манифест плагина.

## Тип PluginManifest

Результат процедуры Load Plugin Manifest:

- `name` (string) — имя плагина.
- `version` (string) — версия плагина (semver).
- `description` (string) — описание плагина.
- `license` (string | null) — SPDX-идентификатор лицензии
  (`null` если не указан).
- `author` (PluginAuthor) — информация об авторе.
- `homepage` (string | null) — URL домашней страницы
  (`null` если не указан).
- `keywords` (array\<string>) — массив ключевых слов
  (пустой массив если не указан).

## Тип PluginAuthor

- `name` (string) — имя автора.
- `email` (string) — email автора.
- `url` (string | null) — URL автора (`null` если не указан).

## Вне scope

Следующие аспекты НЕ ВХОДЯТ в scope данной спецификации:

- Механизм загрузки и обнаружения плагинов
  (конфигурация `plugins` в `config.yml`, резолвинг путей) —
  отдельная спецификация `plugin-loading`.
- Загрузка плагинов из Git-репозиториев — итерация 2.
- Зависимости между плагинами (`dependencies`/`peerDependencies`) —
  итерация 2.
- Централизованный реестр плагинов.
- Валидация SPDX-идентификатора лицензии по реестру SPDX
  (поле `license`, если указано, проверяется только как непустая строка).
- Валидация формата email (поле `author.email` проверяется
  только как непустая строка).
