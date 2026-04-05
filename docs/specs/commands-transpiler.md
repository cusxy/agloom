---
summary: Commands Transpiler — библиотека транспиляции команд из .agloom/commands/ в agent-specific каталоги
description: >
  Библиотека для транспиляции slash-команд из канонического каталога
  .agloom/commands/ в agent-specific каталоги. Выполняет трансформацию контента:
  парсинг YAML frontmatter, применение override-полей, фильтрацию agent-specific
  секций в body. Поддерживает subdirectories с flatten для агентов без поддержки
  вложенности. Расширяется через адаптеры.
type: spec
status: implemented
relates:
  - docs/specs/agents-transpiler.md
  - docs/specs/skills-transpiler.md
  - docs/specs/instructions-transpiler.md
  - docs/specs/interpolation.md
  - docs/specs/cli.md
  - docs/specs/adapter-registry-ext.md
  - docs/specs/integration-tests.md
  - docs/researches/agent-capabilities-map/RESEARCH.md
maps_to:
  - src/commands-transpiler/
---

# Commands Transpiler

Ключевые слова «ТРЕБУЕТСЯ», «ЗАПРЕЩАЕТСЯ», «ДОЛЖЕН», «НЕ ДОЛЖЕН», «СЛЕДУЕТ»,
«НЕ СЛЕДУЕТ», «МОЖЕТ» и «НЕОБЯЗАТЕЛЬНО» в этом документе толкуются
в соответствии с [RFC 2119](https://tools.ietf.org/html/rfc2119).

Библиотека для транспиляции slash-команд из канонического каталога
`.agloom/commands/` в agent-specific каталоги. Канонический каталог является
единственным источником истины (single source of truth); agent-specific файлы —
производные артефакты, генерируемые при каждом запуске транспиляции.

Архитектура аналогична `agents-transpiler`
(см. `docs/specs/agents-transpiler.md`): factory function, адаптеры с методом
`transpile`, трансформация контента (парсинг YAML frontmatter с применением
override-полей, фильтрация agent-specific секций в body), обнаружение, запись
результатов.

В отличие от `agents-transpiler`, commands-transpiler поддерживает
**рекурсивное сканирование подкаталогов** в каноническом каталоге
и предоставляет два режима обработки subdirectory structure:
сохранение (preserve) и выравнивание (flatten).

## Канонический формат

Команда — одиночный `.md` файл в `.agloom/commands/` (git-tracked).
Файлы МОГУТ располагаться в подкаталогах произвольной вложенности
(например, `.agloom/commands/git/commit.md`). Формат: YAML frontmatter +
Markdown body. Парсинг frontmatter выполняется библиотекой `gray-matter`.

Библиотека ЗАПРЕЩАЕТ валидацию семантики полей frontmatter (описание,
модели, аргументы и т.д.), потому что валидация является ответственностью
целевых агентов.

Библиотека ЗАПРЕЩАЕТ трансформацию синтаксиса аргументов (`$ARGUMENTS`,
`{{args}}` и т.д.), потому что пользователь использует agent-specific
синтаксис внутри `<!-- agent:id -->` блоков.

### Frontmatter и override

Канонический frontmatter содержит произвольные поля и опциональный блок
`override`:

```yaml
---
description: Run git commit with a message
override:
  gemini:
    description: Commit changes to git
  claude:
    argument-hint: "[message]"
---
```

Правила трансформации frontmatter идентичны `agents-transpiler`
(см. `docs/specs/agents-transpiler.md` § Трансформация контента).

### Синтаксис agent-specific секций

Body МОЖЕТ содержать agent-specific секции, ограниченные HTML-комментариями.
Синтаксис и правила идентичны `agents-transpiler`
(см. `docs/specs/agents-transpiler.md` § Синтаксис agent-specific секций).

### Именование команд

Имя команды определяется по пути файла относительно каталога commands:

- `.agloom/commands/deploy.md` → имя `"deploy"`.
- `.agloom/commands/git/commit.md` → имя `"git/commit"`.

Имя файла без расширения `.md` является именем команды. Для файлов в
подкаталогах имя включает путь подкаталога через `/`.

## Типы данных

### CommandDefinition

Обнаруженное определение команды.

- `name` (string) — имя команды (путь файла относительно каталога commands
  без расширения `.md`, например `"deploy"` или `"git/commit"`).
- `relativePath` (string) — путь к файлу относительно `projectRoot`
  (например, `".agloom/commands/git/commit.md"`).
- `rawContent` (string) — содержимое файла (raw Markdown с frontmatter).

### CommandOutputFile

Файл для записи в целевой каталог.

- `relativePath` (string) — путь назначения относительно `projectRoot`.
  Адаптер возвращает `relativePath` с исходным путём
  (`definition.relativePath`). Транспилер выполняет ремаппинг
  `relativePath` (замена `<agloomDir>/commands/` на `<adapter.targetDir>/`)
  в операции «Транспиляция», шаг 3. После ремаппинга `relativePath`
  содержит целевой путь (например, `".claude/commands/git/commit.md"`).
- `content` (string) — трансформированное содержимое файла.

### CommandTranspileResult

Результат транспиляции для одного адаптера.

- `agentId` (string) — идентификатор адаптера.
- `files` (array\<CommandOutputFile>) — список файлов для записи.
- `errors` (array\<CommandTranspileError>) — ошибки, возникшие при транспиляции
  данного адаптера.

### CommandTranspileError

Ошибка транспиляции адаптера.

- `agentId` (string) — идентификатор адаптера, при транспиляции которого
  произошла ошибка.
- `message` (string) — описание ошибки.
- `cause` (Error) — исходное исключение адаптера.

### CommandWriteResult

Результат записи файлов.

- `written` (array\<string>) — относительные пути успешно записанных файлов.
- `errors` (array\<CommandWriteError>) — ошибки записи.

### Классы ошибок

- `CommandConfigError` (extends Error) — ошибка конфигурации транспилера.
- `CommandDiscoverError` (extends Error) — ошибка обнаружения определений команд.
- `CommandTransformError` (extends Error) — ошибка трансформации контента
  (парсинг frontmatter, фильтрация body).
- `CommandWriteError` (extends Error) — ошибка записи файла.

## Инициализация

`createCommandsTranspiler(config)`.

**Вход:**

- `config` (object, обязательно) — конфигурация транспилера.
  - `projectRoot` (string, обязательно) — абсолютный путь к корню проекта.
  - `adapters` (array\<CommandAdapter>, обязательно) — массив адаптеров
    для целевых агентов.
  - `agloomDir` (string, опционально, default: `".agloom"`) — путь
    к каталогу agloom относительно `projectRoot`.

**Поведение:**

1. Валидировать, что `projectRoot` является абсолютным путём.
2. Валидировать, что массив `adapters` содержит хотя бы один элемент.
3. Валидировать, что все элементы `adapters` реализуют интерфейс `CommandAdapter`
   (см. «Интерфейс адаптера»).
4. Валидировать, что значения `agentId` всех адаптеров уникальны.
5. Сохранить конфигурацию в экземпляре.

**Расширения:**

1a. `projectRoot` не является абсолютным путём →
`CommandConfigError("projectRoot must be an absolute path")`.

2a. Массив `adapters` пуст →
`CommandConfigError("At least one adapter is required")`.

3a. Элемент `adapters` не реализует интерфейс `CommandAdapter` →
`CommandConfigError("Adapter at index {i} does not implement CommandAdapter interface")`.

4a. Обнаружены адаптеры с одинаковым `agentId` →
`CommandConfigError("Duplicate agentId: {id}")`.

**Результат:**

Экземпляр `CommandsTranspiler`.

## Обнаружение определений команд

`transpiler.discover()` — обнаруживает все определения команд в проекте.

**Вход:**

Нет входных параметров.

**Поведение:**

1. Определить путь к каталогу commands как
   `<projectRoot>/<agloomDir>/commands/`.
2. Проверить наличие каталога commands.
3. Рекурсивно получить список всех файлов в каталоге commands
   и его подкаталогах.
4. Отфильтровать файлы, оставив только файлы с расширением `.md`.
5. Прочитать содержимое каждого `.md` файла.
6. Сформировать массив `CommandDefinition`, где `name` — путь файла
   относительно каталога commands без расширения `.md`
   (например, для файла `<agloomDir>/commands/git/commit.md`
   name = `"git/commit"`).

**Расширения:**

2a. Каталог commands не существует → вернуть пустой массив
`CommandDefinition[]` (не является ошибкой).

3a. Ошибка доступа к каталогу commands (EACCES) →
`CommandDiscoverError("Failed to scan directory {dirPath}: {причина}")`.

5a. Ошибка чтения файла (EACCES, файл удалён между обнаружением и чтением) →
`CommandDiscoverError("Failed to read {relativePath}: {причина}")`.

**Результат:**

`CommandDefinition[]`.

## Транспиляция

`transpiler.transpile()` — выполняет полный цикл транспиляции для всех
зарегистрированных адаптеров.

**Вход:**

Нет входных параметров.

**Поведение:**

1. Обнаружить определения команд в `projectRoot`
   (см. «Обнаружение определений команд»).
2. Для каждого зарегистрированного адаптера вызвать
   `adapter.transpile(definitions)`.
3. Для каждого `CommandOutputFile` из результата `adapter.transpile`
   выполнить ремаппинг `relativePath`: заменить префикс
   `<agloomDir>/commands/` на `<adapter.targetDir>/`.
4. Собрать результаты всех адаптеров в единый массив
   `CommandTranspileResult`.

**Расширения:**

1a. Ни одного определения команды не обнаружено → вернуть пустой массив
`CommandTranspileResult[]` (не является ошибкой).

1b. `discover()` выбрасывает `CommandDiscoverError` →
пробросить к вызывающему коду.

2a. Адаптер выбрасывает исключение → создать `CommandTranspileResult`
с `agentId` адаптера, пустым массивом `files` и одним элементом в `errors`
(`CommandTranspileError` с указанием `agentId` и исходной ошибки);
продолжить выполнение остальных адаптеров.

**Результат:**

`CommandTranspileResult[]`.

## Интерфейс адаптера

Каждый адаптер ДОЛЖЕН реализовать следующий интерфейс:

- `agentId` (string, readonly) — уникальный идентификатор агента
  (например, `"claude"`, `"opencode"`).
- `targetDir` (string, readonly) — путь к целевому каталогу
  относительно `projectRoot` (например, `".claude/commands"`,
  `".opencode/commands"`).
- `transpile(definitions)` — метод транспиляции (см. ниже).

Метод `transpile` сохраняется в интерфейсе, потому что
commands-адаптер выполняет трансформацию содержимого
(см. «Трансформация контента»), а не только маппинг путей.
Маппинг `relativePath` из результата `transpile` выполняется
транспилером на основе `targetDir` (см. «Транспиляция»).

### transpile

`adapter.transpile(definitions)` — генерирует agent-specific файлы
из определений команд.

**Вход:**

- `definitions` (array\<CommandDefinition>, обязательно) — массив
  обнаруженных определений команд.

**Поведение:**

Определяется конкретным адаптером (см. описания адаптеров ниже).

**Расширения:**

Определяются конкретным адаптером.

**Результат:**

`CommandOutputFile[]`.

## Трансформация контента

Commands-transpiler переиспользует функции `transformContent` и `filterBody`
из модуля `agents-transpiler` (см. `docs/specs/agents-transpiler.md`
§ Трансформация контента, § Фильтрация body). Переиспользование
обеспечивается импортом из `agents-transpiler`.

Поведение, правила, расширения и примеры идентичны
`agents-transpiler`. Ошибки трансформации — `CommandTransformError`
(вместо `AgentTransformError`). Адаптеры ДОЛЖНЫ перехватывать
`AgentTransformError` из импортированных функций и оборачивать
в `CommandTransformError`.

## Режимы обработки subdirectories

Адаптеры используют два режима обработки subdirectory structure:

### Preserve (сохранение)

Subdirectory structure из канонического каталога сохраняется в целевом
каталоге. Используется адаптерами Claude и Gemini.

Пример: `.agloom/commands/git/commit.md` → `.claude/commands/git/commit.md`.

### Flatten (выравнивание)

Все файлы из подкаталогов копируются в корень целевого каталога.
Имя файла при flatten — имя файла без пути подкаталога.
Используется адаптерами OpenCode и KiloCode.

Пример: `.agloom/commands/git/commit.md` → `.opencode/commands/commit.md`.

Адаптер, использующий flatten, ДОЛЖЕН выполнить flatten в методе `transpile`
путём замены `relativePath`: удалить все сегменты пути между
`<agloomDir>/commands/` и именем файла.

При flatten МОЖЕТ возникнуть конфликт имён, если файлы из разных
подкаталогов имеют одинаковое имя (например, `git/status.md`
и `docker/status.md`). Адаптер ДОЛЖЕН обнаружить конфликт и выбросить
`CommandTransformError("Name conflict after flatten: '{name}' appears in multiple subdirectories")`.

## Claude Code адаптер

Адаптер для Claude Code.

- `agentId`: `"claude"`.
- `targetDir`: `".claude/commands"`.
- Subdirectories: **preserve**.

### transpile

`claudeCommandAdapter.transpile(definitions)`.

**Вход:**

- `definitions` (array\<CommandDefinition>, обязательно) — массив
  обнаруженных определений команд.

**Поведение:**

1. Для каждого определения из `definitions` вызвать
   `transformContent(definition.rawContent, "claude")`
   (см. «Трансформация контента»).
2. Сформировать `CommandOutputFile` с `definition.relativePath`
   в качестве `relativePath` и результатом `transformContent`
   в качестве `content`.

Ремаппинг `relativePath` (`<agloomDir>/commands/` → `<adapter.targetDir>/`)
выполняется транспилером после вызова `adapter.transpile`
(см. «Транспиляция», шаг 3).

**Расширения:**

1a. `transformContent` выбрасывает ошибку → обернуть
в `CommandTransformError` и пробросить к вызывающему коду.

**Результат:**

`CommandOutputFile[]`.

## OpenCode адаптер

Адаптер для OpenCode.

- `agentId`: `"opencode"`.
- `targetDir`: `".opencode/commands"`.
- Subdirectories: **flatten**.

### transpile

`opencodeCommandAdapter.transpile(definitions)`.

**Вход:**

- `definitions` (array\<CommandDefinition>, обязательно) — массив
  обнаруженных определений команд.

**Поведение:**

1. Для каждого определения из `definitions` вызвать
   `transformContent(definition.rawContent, "opencode")`
   (см. «Трансформация контента»).
2. Выполнить flatten `relativePath`: заменить путь на
   `<agloomDir>/commands/<filename>` (удалить сегменты подкаталога).
3. Проверить конфликты имён среди всех определений после flatten.
4. Сформировать `CommandOutputFile` с flatten `relativePath`
   в качестве `relativePath` и результатом `transformContent`
   в качестве `content`.

Ремаппинг `relativePath` (`<agloomDir>/commands/` → `<adapter.targetDir>/`)
выполняется транспилером после вызова `adapter.transpile`
(см. «Транспиляция», шаг 3).

**Расширения:**

1a. `transformContent` выбрасывает ошибку → обернуть
в `CommandTransformError` и пробросить к вызывающему коду.

3a. Обнаружен конфликт имён после flatten →
`CommandTransformError("Name conflict after flatten: '{name}' appears in multiple subdirectories")`.

**Результат:**

`CommandOutputFile[]`.

## KiloCode адаптер

Адаптер для KiloCode.

- `agentId`: `"kilocode"`.
- `targetDir`: `".kilo/commands"`.
- Subdirectories: **flatten**.

### transpile

`kilocodeCommandAdapter.transpile(definitions)`.

**Вход:**

- `definitions` (array\<CommandDefinition>, обязательно) — массив
  обнаруженных определений команд.

**Поведение:**

1. Для каждого определения из `definitions` вызвать
   `transformContent(definition.rawContent, "kilocode")`
   (см. «Трансформация контента»).
2. Выполнить flatten `relativePath`: заменить путь на
   `<agloomDir>/commands/<filename>` (удалить сегменты подкаталога).
3. Проверить конфликты имён среди всех определений после flatten.
4. Сформировать `CommandOutputFile` с flatten `relativePath`
   в качестве `relativePath` и результатом `transformContent`
   в качестве `content`.

Ремаппинг `relativePath` (`<agloomDir>/commands/` → `<adapter.targetDir>/`)
выполняется транспилером после вызова `adapter.transpile`
(см. «Транспиляция», шаг 3).

**Расширения:**

1a. `transformContent` выбрасывает ошибку → обернуть
в `CommandTransformError` и пробросить к вызывающему коду.

3a. Обнаружен конфликт имён после flatten →
`CommandTransformError("Name conflict after flatten: '{name}' appears in multiple subdirectories")`.

**Результат:**

`CommandOutputFile[]`.

## Gemini адаптер

Адаптер для Gemini.

- `agentId`: `"gemini"`.
- `targetDir`: `".gemini/commands"`.
- Subdirectories: **preserve**.

Gemini CLI использует формат TOML для определений команд. Адаптер
выполняет стандартную трансформацию через `transformContent`,
затем конвертирует результат из Markdown в TOML. Для сериализации TOML
ТРЕБУЕТСЯ использовать библиотеку `smol-toml` (уже присутствует
в зависимостях проекта).

### transpile

`geminiCommandAdapter.transpile(definitions)`.

**Вход:**

- `definitions` (array\<CommandDefinition>, обязательно) — массив
  обнаруженных определений команд.

**Поведение:**

1. Для каждого определения из `definitions` вызвать
   `transformContent(definition.rawContent, "gemini")`
   (см. «Трансформация контента»).
2. Выполнить парсинг результата `transformContent` библиотекой
   `gray-matter`, получив объект frontmatter (`data`) и тело
   документа (`content`).
3. Если `content` (после trim) не является пустой строкой —
   добавить ключ `prompt` в `data` со значением trimmed `content`.
4. Сериализовать `data` в формат TOML через `smol-toml`.
5. Сформировать `CommandOutputFile` с `definition.relativePath`
   (расширение `.md` заменяется на `.toml`) в качестве `relativePath`
   и результатом сериализации TOML в качестве `content`.

Ремаппинг `relativePath` (`<agloomDir>/commands/` → `<adapter.targetDir>/`)
выполняется транспилером после вызова `adapter.transpile`
(см. «Транспиляция», шаг 3).

**Расширения:**

1a. `transformContent` выбрасывает ошибку → обернуть
в `CommandTransformError` и пробросить к вызывающему коду.

2a. Библиотека `gray-matter` выбрасывает ошибку парсинга результата →
`CommandTransformError("Failed to parse transformed content for '{definition.name}': {причина}")`.

4a. `smol-toml` выбрасывает ошибку сериализации →
`CommandTransformError("Failed to serialize TOML for '{definition.name}': {причина}")`.

**Результат:**

`CommandOutputFile[]`.

### Правила конвертации в TOML

- `transformContent` выполняет парсинг frontmatter, override merge,
  удаление `override`, фильтрацию body и сериализацию обратно
  в Markdown. Gemini адаптер повторно парсит этот Markdown
  для извлечения финального frontmatter и body.
- Все top-level ключи из финального frontmatter становятся
  top-level ключами TOML.
- Body (после trim) становится значением ключа `prompt` (string).
- Если body пустое (после trim) — ключ `prompt`
  НЕ ВКЛЮЧАЕТСЯ в TOML.
- Расширение выходного файла — `.toml` (вместо `.md`).
- Типы значений frontmatter сохраняются: строки → TOML strings,
  числа → TOML integers/floats, массивы → TOML arrays,
  объекты → TOML tables.

### Пример конвертации

Входной файл `.agloom/commands/deploy.md`:

```markdown
---
description: Deploy to production
override:
  gemini:
    description: Deploy the app to production
---

Deploy the current branch to production environment.

<!-- agent:gemini -->

Use !{gcloud app deploy} to deploy.

<!-- /agent:gemini -->
```

Выходной файл `.gemini/commands/deploy.toml`:

```toml
description = "Deploy the app to production"
prompt = """
Deploy the current branch to production environment.

Use !{gcloud app deploy} to deploy."""
```

## Codex адаптер

Адаптер для Codex.

- `agentId`: `"codex"`.
- `targetDir`: `".agents/skills"`.
- Subdirectories: **flatten** (с hyphen-join для skill package name).

Codex не поддерживает project-level commands. Адаптер конвертирует
команды в skill packages, которые Codex загружает из `.agents/skills/`.
Skills из `skills-transpiler` имеют приоритет и перезаписывают
commands-generated skills (обеспечивается порядком transpile steps:
Commands выполняется ДО Skills).

### transpile

`codexCommandAdapter.transpile(definitions)`.

**Вход:**

- `definitions` (array\<CommandDefinition>, обязательно) — массив
  обнаруженных определений команд.

**Поведение:**

1. Для каждого определения из `definitions` вызвать
   `transformContent(definition.rawContent, "codex")`
   (см. «Трансформация контента»).
2. Определить имя skill package: заменить `/` на `-` в `definition.name`
   (например, `"git/commit"` → `"git-commit"`).
3. Проверить конфликты имён среди всех определений после преобразования.
4. Сформировать `CommandOutputFile`:
   - `relativePath`: `<agloomDir>/commands/<skill-package-name>/SKILL.md`
     (например, `.agloom/commands/git-commit/SKILL.md`).
     Путь формируется от `<agloomDir>/commands/` для последующего
     ремаппинга транспилером на `<adapter.targetDir>/`.
   - `content`: результат `transformContent`.

Ремаппинг `relativePath` (`<agloomDir>/commands/` → `<adapter.targetDir>/`)
выполняется транспилером после вызова `adapter.transpile`
(см. «Транспиляция», шаг 3). Итоговый путь:
`.agents/skills/git-commit/SKILL.md`.

**Расширения:**

1a. `transformContent` выбрасывает ошибку → обернуть
в `CommandTransformError` и пробросить к вызывающему коду.

3a. Обнаружен конфликт имён после преобразования →
`CommandTransformError("Name conflict after flatten: '{name}' appears in multiple subdirectories")`.

**Результат:**

`CommandOutputFile[]`.

### Пример конвертации

Входной файл `.agloom/commands/git/commit.md`:

```markdown
---
description: Create a git commit
---

Create a commit with a descriptive message.
```

Выходной файл `.agents/skills/git-commit/SKILL.md`:

```markdown
---
description: Create a git commit
---

Create a commit with a descriptive message.
```

## Запись результатов

`transpiler.writeResults(results, options?)` — записывает результаты
транспиляции в файловую систему.

**Вход:**

- `results` (array\<CommandTranspileResult>, обязательно) — результаты
  транспиляции, полученные из `transpile()`.
- `options` (object, опционально) — дополнительные параметры записи.
  - `targetRoot` (string, опционально, default: значение `projectRoot`
    из конфигурации транспилера) — абсолютный путь к корню целевого
    проекта. Используется при записи файлов плагинов
    в локальный проект.
  - `variablesByAgentId` (Record\<string, Record\<string, string>>,
    опционально) — карта agloom-переменных, индексированная по `agentId`.
    Если параметр передан, интерполяция выполняется для `.md` файлов
    (см. `docs/specs/interpolation.md` § Интерполяция контента). Если
    не передан, файлы записываются без интерполяции (обратная совместимость).

**Поведение:**

1. Для каждого `CommandTranspileResult` проверить, что массив `errors` пуст.
2. Определить `effectiveRoot` как `options.targetRoot` (если передан)
   или `projectRoot` из конфигурации транспилера.
3. Для каждого `CommandOutputFile` из `files`:
   - Если `variablesByAgentId` передан И расширение файла `relativePath`
     равно `.md` (case-insensitive) — вызвать
     `interpolate(content, variablesByAgentId[agentId])`
     (см. `docs/specs/interpolation.md` § Интерполяция контента),
     записать результат в `effectiveRoot / relativePath`
     с кодировкой UTF-8, создавая промежуточные каталоги
     при необходимости.
   - Иначе — записать `content` в `effectiveRoot / relativePath`
     с кодировкой UTF-8, создавая промежуточные каталоги
     при необходимости.
4. Вернуть `CommandWriteResult`.

**Расширения:**

1a. `CommandTranspileResult` содержит непустой `errors` — пропустить запись
всех `files` данного адаптера; для каждого элемента массива `errors`
создать `CommandWriteError` с сообщением из элемента и добавить
в `CommandWriteResult.errors`.

3a. Ошибка записи файла или создания каталога (нет прав, диск полон) →
`CommandWriteError("Failed to write {relativePath}: {причина}")`.

3b. `variablesByAgentId` передан, но ключ `agentId` текущего
`CommandTranspileResult` отсутствует в `variablesByAgentId` →
`CommandWriteError("No interpolation variables for adapter: {agentId}")`.

3c. `interpolate` выбрасывает `InterpolationError` →
`CommandWriteError("Interpolation failed for {relativePath}: {причина}")`.

**Результат:**

`CommandWriteResult`.

## Интеграция с CLI

### Расширение AdapterRegistryEntry

Интерфейс `AdapterRegistryEntry` (см. `docs/specs/cli.md` § Типы данных,
`docs/specs/adapter-registry-ext.md` § Обновление реестра адаптеров)
ТРЕБУЕТСЯ расширить:

- `commands` (CommandAdapter | null) — экземпляр адаптера для
  commands-transpiler (`null` если адаптер не поддерживает commands).

Объект `paths` ТРЕБУЕТСЯ расширить:

- `commands` (string, optional) — путь к каталогу commands
  относительно `projectRoot`.

### Расширение TranspilerStepOutcome

Union тип `TranspilerStepOutcome.name` ТРЕБУЕТСЯ расширить
значением `"Commands"`.

### Обновление реестра адаптеров

Реестр адаптеров (`src/cli/adapter-registry.ts`) ТРЕБУЕТСЯ обновить:

| Adapter   | commands                   | paths.commands       |
| --------- | -------------------------- | -------------------- |
| claude    | `ClaudeCommandAdapter`     | `".claude/commands"` |
| opencode  | `OpenCodeCommandAdapter`   | `".opencode/commands"` |
| agentsmd  | `null`                     | —                    | AGENTS.md не имеет эквивалента commands |
| kilocode  | `KiloCodeCommandAdapter`   | `".kilo/commands"`   |
| codex     | `CodexCommandAdapter`      | —                    |
| gemini    | `GeminiCommandAdapter`     | `".gemini/commands"` |

Codex адаптер НЕ ИМЕЕТ `paths.commands`, потому что его output
направляется в `.agents/skills/` (через `targetDir`), а не в
отдельный каталог commands.

### Порядок transpile steps

Transpile step "Commands" ТРЕБУЕТСЯ выполнять **после** "Instructions"
и **перед** "Skills". Порядок:

1. Instructions
2. **Commands**
3. Skills
4. Agents
5. MCP
6. Permissions
7. Docs
8. Schemas

Этот порядок обеспечивает приоритет skills над commands для Codex:
commands-generated skills записываются первыми, skills из
skills-transpiler перезаписывают их при совпадении имён.

### Поведение при конфликте имён Codex commands/skills

Если команда (`.agloom/commands/foo.md`) и skill (`.agloom/skills/foo/SKILL.md`)
имеют одинаковое имя, commands-transpiler запишет
`.agents/skills/foo/SKILL.md`, а skills-transpiler перезапишет этот файл
своей версией. Результат: skill побеждает (silent overwrite).

Конфликт НЕ ЯВЛЯЕТСЯ ошибкой. Commands-transpiler НЕ ДОЛЖЕН проверять
наличие одноимённых skills. Обнаружение конфликтов между транспилерами
выходит за scope данной спецификации.

## Вне scope

Следующие аспекты НЕ ВХОДЯТ в scope данной спецификации:

- Создание и scaffolding новых команд.
- Валидация семантики frontmatter (описания, модели, аргументы и т.д.).
- Трансформация синтаксиса аргументов (`$ARGUMENTS` ↔ `{{args}}`).
- Deep merge для override (только shallow merge top-level ключей).
- Watch mode (отслеживание изменений определений команд).
- CLI-интерфейс (отдельная спецификация).
- Очистка устаревших agent-specific файлов при удалении определений.
- Автоматическое обновление `.gitignore`.
- Markdown-aware парсинг (учёт code blocks при фильтрации секций).
