---
summary: Skills Transpiler — библиотека транспиляции skills из .agloom/skills/ в agent-specific каталоги
description: >
  Библиотека для транспиляции skill-пакетов из канонического каталога
  .agloom/skills/ в agent-specific каталоги. Копирует директории целиком
  без валидации и трансформации содержимого. Расширяется через адаптеры.
type: spec
status: implemented
relates:
  - docs/specs/instructions-transpiler.md
  - docs/specs/agents-transpiler.md
  - docs/specs/interpolation.md
  - docs/specs/cli.md
  - docs/specs/integration-tests.md
  - docs/specs/docs-transpiler.md
  - docs/researches/agent-capabilities-map/RESEARCH.md
maps_to:
  - src/skills-transpiler/
---

# Skills Transpiler

Ключевые слова «ТРЕБУЕТСЯ», «ЗАПРЕЩАЕТСЯ», «ДОЛЖЕН», «НЕ ДОЛЖЕН», «СЛЕДУЕТ»,
«НЕ СЛЕДУЕТ», «МОЖЕТ» и «НЕОБЯЗАТЕЛЬНО» в этом документе толкуются
в соответствии с [RFC 2119](https://tools.ietf.org/html/rfc2119).

Библиотека для транспиляции skill-пакетов из канонического каталога
`.agloom/skills/` в agent-specific каталоги. Канонический каталог является
единственным источником истины (single source of truth); agent-specific файлы —
производные артефакты, генерируемые при каждом запуске транспиляции.

Архитектура аналогична `instructions-transpiler`
(см. `docs/specs/instructions-transpiler.md`): factory function, адаптеры,
обнаружение, запись результатов.

## Канонический формат

Skill — директория (пакет) в `.agloom/skills/<name>/`, содержащая файл
`SKILL.md` и произвольное количество вспомогательных файлов. Формат `SKILL.md`:
YAML frontmatter + Markdown body.

Библиотека ЗАПРЕЩАЕТ валидацию содержимого и frontmatter файлов skill-пакета,
потому что транспилер отвечает только за копирование файлов, а валидация
является ответственностью отдельного модуля.

Библиотека ЗАПРЕЩАЕТ трансформацию содержимого файлов skill-пакета, потому что
формат SKILL.md стандартизирован между всеми целевыми агентами и не требует
преобразования.

## Типы данных

### SkillPackage

Обнаруженный skill-пакет.

- `name` (string) — имя skill (имя директории).
- `directoryPath` (string) — путь к директории skill относительно `projectRoot`
  (например, `".agloom/skills/my-skill"`).
- `files` (array\<string>) — пути файлов пакета относительно `projectRoot`
  (например, `[".agloom/skills/my-skill/SKILL.md", ".agloom/skills/my-skill/helpers/util.ts"]`).

### SkillOutputFile

Файл для записи в целевой каталог.

- `relativePath` (string) — путь назначения относительно `projectRoot`.
- `sourcePath` (string) — путь исходного файла относительно `projectRoot`.

### SkillTranspileResult

Результат транспиляции для одного адаптера.

- `agentId` (string) — идентификатор агента.
- `files` (array\<SkillOutputFile>) — список файлов для записи.
- `errors` (array\<SkillTranspileError>) — ошибки, возникшие при транспиляции
  данного адаптера.

### SkillTranspileError

Ошибка транспиляции адаптера.

- `agentId` (string) — идентификатор адаптера, при транспиляции которого
  произошла ошибка.
- `message` (string) — описание ошибки.
- `cause` (Error) — исходное исключение адаптера.

### SkillWriteResult

Результат записи файлов.

- `written` (array\<string>) — относительные пути успешно записанных файлов.
- `errors` (array\<SkillWriteError>) — ошибки записи.

### Классы ошибок

- `SkillConfigError` (extends Error) — ошибка конфигурации транспилера.
- `SkillDiscoverError` (extends Error) — ошибка обнаружения skill-пакетов.
- `SkillWriteError` (extends Error) — ошибка записи файла.

## Инициализация

`createSkillsTranspiler(config)`.

**Вход:**

- `config` (object, обязательно) — конфигурация транспилера.
  - `projectRoot` (string, обязательно) — абсолютный путь к корню проекта.
  - `adapters` (array\<SkillAdapter>, обязательно) — массив адаптеров
    для целевых агентов.
  - `agloomDir` (string, опционально, default: `".agloom"`) — путь
    к каталогу agloom относительно `projectRoot`.

**Поведение:**

1. Валидировать, что `projectRoot` является абсолютным путём.
2. Валидировать, что массив `adapters` содержит хотя бы один элемент.
3. Валидировать, что все элементы `adapters` реализуют интерфейс `SkillAdapter`
   (см. «Интерфейс адаптера»).
4. Валидировать, что значения `agentId` всех адаптеров уникальны.
5. Сохранить конфигурацию в экземпляре.

**Расширения:**

1a. `projectRoot` не является абсолютным путём →
`SkillConfigError("projectRoot must be an absolute path")`.

2a. Массив `adapters` пуст →
`SkillConfigError("At least one adapter is required")`.

3a. Элемент `adapters` не реализует интерфейс `SkillAdapter` →
`SkillConfigError("Adapter at index {i} does not implement SkillAdapter interface")`.

4a. Обнаружены адаптеры с одинаковым `agentId` →
`SkillConfigError("Duplicate agentId: {id}")`.

**Результат:**

Экземпляр `SkillsTranspiler`.

## Обнаружение skill-пакетов

`transpiler.discover()` — обнаруживает все skill-пакеты в проекте.

**Вход:**

Нет входных параметров.

**Поведение:**

1. Определить путь к каталогу skills как
   `<projectRoot>/<agloomDir>/skills/`.
2. Проверить наличие каталога skills.
3. Получить список прямых подкаталогов каталога skills.
4. Для каждого подкаталога проверить наличие файла `SKILL.md`.
5. Для каждого подкаталога, содержащего `SKILL.md`, рекурсивно получить
   список всех файлов в подкаталоге.
6. Сформировать массив `SkillPackage`.

**Расширения:**

2a. Каталог skills не существует → вернуть пустой массив
`SkillPackage[]` (не является ошибкой).

3a. Ошибка доступа к каталогу skills (EACCES) →
`SkillDiscoverError("Failed to scan directory {dirPath}: {причина}")`.

4a. Подкаталог не содержит `SKILL.md` → пропустить подкаталог
(не включать в результат, не является ошибкой).

5a. Ошибка доступа при рекурсивном сканировании файлов подкаталога
(EACCES, ENOENT) →
`SkillDiscoverError("Failed to scan skill directory {directoryPath}: {причина}")`.

**Результат:**

`SkillPackage[]`.

## Транспиляция

`transpiler.transpile()` — выполняет полный цикл транспиляции для всех
зарегистрированных адаптеров.

**Вход:**

Нет входных параметров.

**Поведение:**

1. Обнаружить skill-пакеты в `projectRoot`
   (см. «Обнаружение skill-пакетов»).
2. Для каждого зарегистрированного адаптера выполнить маппинг путей:
   для каждого `SkillPackage` из обнаруженных пакетов, для каждого файла
   из `package.files` — заменить префикс `<agloomDir>/skills/`
   на `<adapter.targetDir>/`, сформировав `SkillOutputFile`
   с вычисленным `relativePath` и исходным путём файла
   в качестве `sourcePath`. Структура вложенных каталогов
   внутри skill-пакета сохраняется.
3. Собрать результаты всех адаптеров в единый массив
   `SkillTranspileResult`.

**Расширения:**

1a. Ни одного skill-пакета не обнаружено → вернуть пустой массив
`SkillTranspileResult[]` (не является ошибкой).

1b. `discover()` выбрасывает `SkillDiscoverError` →
пробросить к вызывающему коду.

**Результат:**

`SkillTranspileResult[]`.

## Интерфейс адаптера

Каждый адаптер ДОЛЖЕН реализовать следующий интерфейс:

- `agentId` (string, readonly) — уникальный идентификатор агента
  (например, `"claude"`, `"opencode"`).
- `targetDir` (string, readonly) — путь к целевому каталогу
  относительно `projectRoot` (например, `".claude/skills"`,
  `".opencode/skills"`).

Адаптер не содержит метода `transpile`, потому что транспиляция
сводится к замене префикса пути и не требует agent-specific логики.
Маппинг путей выполняется транспилером на основе `targetDir`
(см. «Транспиляция»). Подход аналогичен docs-transpiler
(см. `docs/specs/docs-transpiler.md` § Интерфейс адаптера).

## Claude Code адаптер

Адаптер для Claude Code.

- `agentId`: `"claude"`.
- `targetDir`: `".claude/skills"`.

## OpenCode адаптер

Адаптер для OpenCode.

- `agentId`: `"opencode"`.
- `targetDir`: `".opencode/skills"`.

OpenCode нативно читает `.opencode/skills/`
(см. `docs/researches/agent-capabilities-map/agents/opencode.md` § C4. Навыки).

## KiloCode адаптер

Адаптер для KiloCode.

- `agentId`: `"kilocode"`.
- `targetDir`: `".kilo/skills"`.

## Codex адаптер

Адаптер для Codex.

- `agentId`: `"codex"`.
- `targetDir`: `".agents/skills"`.

Codex использует каталог `.agents/skills/` (НЕ `.codex/skills/`)
для хранения skill-пакетов.

## Gemini адаптер

Адаптер для Gemini.

- `agentId`: `"gemini"`.
- `targetDir`: `".gemini/skills"`.

## Запись результатов

`transpiler.writeResults(results, options?)` — записывает результаты
транспиляции в файловую систему, копируя файлы из исходных путей в целевые
с интерполяцией для `.md` файлов.

**Вход:**

- `results` (array\<SkillTranspileResult>, обязательно) — результаты
  транспиляции, полученные из `transpile()`.
- `options` (object, опционально) — дополнительные параметры записи.
  - `targetRoot` (string, опционально, default: значение `projectRoot`
    из конфигурации транспилера) — абсолютный путь к корню целевого
    проекта. Используется при записи файлов плагинов
    в локальный проект.
  - `variablesByAgentId` (Record\<string, Record\<string, string>>,
    опционально) — карта agloom-переменных, индексированная по `agentId`.
    Если параметр передан, интерполяция выполняется для `.md` файлов
    (см. `docs/specs/interpolation.md` § Расширение writeResults
    Skills Transpiler). Если не передан, все файлы копируются побайтово
    (обратная совместимость).

**Поведение:**

1. Для каждого `SkillTranspileResult` проверить, что массив `errors` пуст.
2. Определить `effectiveRoot` как `options.targetRoot` (если передан)
   или `projectRoot` из конфигурации транспилера.
3. Для каждого `SkillOutputFile` из `files`:
   - Если `variablesByAgentId` передан И расширение файла `sourcePath`
     равно `.md` (case-insensitive) — прочитать содержимое
     `projectRoot / sourcePath` с кодировкой UTF-8,
     вызвать `interpolate(content, variablesByAgentId[agentId])`
     (см. `docs/specs/interpolation.md` § Интерполяция контента),
     записать результат в `effectiveRoot / relativePath`
     с кодировкой UTF-8, создавая промежуточные каталоги
     при необходимости.
   - Иначе — побайтово скопировать файл из `projectRoot / sourcePath`
     в `effectiveRoot / relativePath`, создавая промежуточные каталоги
     при необходимости.
4. Вернуть `SkillWriteResult`.

**Расширения:**

1a. `SkillTranspileResult` содержит непустой `errors` — пропустить запись
всех `files` данного адаптера; для каждого элемента массива `errors`
создать `SkillWriteError` с сообщением из элемента и добавить
в `SkillWriteResult.errors`.

3a. Исходный файл (`sourcePath`) не существует или недоступен для чтения →
`SkillWriteError("Failed to read source {sourcePath}: {причина}")`.

3b. Ошибка записи целевого файла или создания каталога (нет прав,
диск полон) →
`SkillWriteError("Failed to write {relativePath}: {причина}")`.

3c. `variablesByAgentId` передан, но ключ `agentId` текущего
`SkillTranspileResult` отсутствует в `variablesByAgentId` →
`SkillWriteError("No interpolation variables for adapter: {agentId}")`.

3d. `interpolate` выбрасывает `InterpolationError` →
`SkillWriteError("Interpolation failed for {sourcePath}: {причина}")`.

**Результат:**

`SkillWriteResult`.

## Вне scope

Следующие аспекты НЕ ВХОДЯТ в scope данной спецификации:

- Создание и scaffolding новых skills.
- Валидация формата и frontmatter файла SKILL.md.
- Трансляция frontmatter между агентами.
- Watch mode (отслеживание изменений skill-пакетов).
- CLI-интерфейс (отдельная спецификация).
- Очистка устаревших agent-specific файлов при удалении skill-пакетов.
- Автоматическое обновление `.gitignore`.
