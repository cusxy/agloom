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
  - docs/specs/cli.md
  - docs/specs/integration-tests.md
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

1. Проверить наличие каталога `.agloom/skills/` в `projectRoot`.
2. Получить список прямых подкаталогов `.agloom/skills/`.
3. Для каждого подкаталога проверить наличие файла `SKILL.md`.
4. Для каждого подкаталога, содержащего `SKILL.md`, рекурсивно получить
   список всех файлов в подкаталоге.
5. Сформировать массив `SkillPackage`.

**Расширения:**

1a. Каталог `.agloom/skills/` не существует → вернуть пустой массив
`SkillPackage[]` (не является ошибкой).

2a. Ошибка доступа к каталогу `.agloom/skills/` (EACCES) →
`SkillDiscoverError("Failed to scan directory .agloom/skills/: {причина}")`.

3a. Подкаталог не содержит `SKILL.md` → пропустить подкаталог
(не включать в результат, не является ошибкой).

4a. Ошибка доступа при рекурсивном сканировании файлов подкаталога
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
2. Для каждого зарегистрированного адаптера вызвать
   `adapter.transpile(packages)`.
3. Собрать результаты всех адаптеров в единый массив
   `SkillTranspileResult`.

**Расширения:**

1a. Ни одного skill-пакета не обнаружено → вернуть пустой массив
`SkillTranspileResult[]` (не является ошибкой).

1b. `discover()` выбрасывает `SkillDiscoverError` →
пробросить к вызывающему коду.

2a. Адаптер выбрасывает исключение → создать `SkillTranspileResult`
с `agentId` адаптера, пустым массивом `files` и одним элементом в `errors`
(`SkillTranspileError` с указанием `agentId` и исходной ошибки);
продолжить выполнение остальных адаптеров.

**Результат:**

`SkillTranspileResult[]`.

## Интерфейс адаптера

Каждый адаптер ДОЛЖЕН реализовать следующий интерфейс:

- `agentId` (string, readonly) — уникальный идентификатор агента
  (например, `"claude"`, `"opencode"`).
- `transpile(packages)` — метод транспиляции (см. ниже).

### transpile

`adapter.transpile(packages)` — генерирует список файлов для записи
в agent-specific каталоги.

**Вход:**

- `packages` (array\<SkillPackage>, обязательно) — массив обнаруженных
  skill-пакетов.

**Поведение:**

Определяется конкретным адаптером (см. «Claude Code адаптер»,
«OpenCode адаптер»).

**Расширения:**

Определяются конкретным адаптером.

**Результат:**

`SkillOutputFile[]`.

## Claude Code адаптер

Адаптер для Claude Code. `agentId`: `"claude"`.

### Правила генерации

Для каждого обнаруженного skill-пакета адаптер генерирует соответствующие
файлы по следующим правилам:

| Исходный путь                         | Целевой путь                          | Условие |
| ------------------------------------- | ------------------------------------- | ------- |
| `.agloom/skills/<name>/<любой файл>` | `.claude/skills/<name>/<тот же файл>` | Всегда  |

Адаптер копирует все файлы skill-пакета, заменяя префикс `.agloom/skills/`
на `.claude/skills/`. Структура вложенных каталогов внутри skill-пакета
сохраняется.

### transpile

`claudeSkillAdapter.transpile(packages)`.

**Вход:**

- `packages` (array\<SkillPackage>, обязательно) — массив обнаруженных
  skill-пакетов.

**Поведение:**

1. Для каждого пакета из `packages` получить список файлов из `package.files`.
2. Для каждого файла заменить префикс `.agloom/skills/` на `.claude/skills/`
   в пути, сформировав `relativePath`.
3. Сформировать `SkillOutputFile` с вычисленным `relativePath` и исходным
   путём файла в качестве `sourcePath`.

**Расширения:**

Нет расширений.

**Результат:**

`SkillOutputFile[]`.

## OpenCode адаптер

Адаптер для OpenCode. `agentId`: `"opencode"`.

### Правила генерации

OpenCode нативно читает `.opencode/skills/`
(см. `docs/researches/agent-capabilities-map/agents/opencode.md` § C4. Навыки).
Адаптер генерирует файлы в `.opencode/skills/` из канонического каталога
`.agloom/skills/` для обеспечения совместимости.

| Исходный путь                         | Целевой путь                             | Условие |
| ------------------------------------- | ---------------------------------------- | ------- |
| `.agloom/skills/<name>/<любой файл>` | `.opencode/skills/<name>/<тот же файл>` | Всегда  |

Адаптер копирует все файлы skill-пакета, заменяя префикс `.agloom/skills/`
на `.opencode/skills/`. Структура вложенных каталогов внутри skill-пакета
сохраняется.

### transpile

`opencodeSkillAdapter.transpile(packages)`.

**Вход:**

- `packages` (array\<SkillPackage>, обязательно) — массив обнаруженных
  skill-пакетов.

**Поведение:**

1. Для каждого пакета из `packages` получить список файлов из `package.files`.
2. Для каждого файла заменить префикс `.agloom/skills/` на `.opencode/skills/`
   в пути, сформировав `relativePath`.
3. Сформировать `SkillOutputFile` с вычисленным `relativePath` и исходным
   путём файла в качестве `sourcePath`.

**Расширения:**

Нет расширений.

**Результат:**

`SkillOutputFile[]`.

## Запись результатов

`transpiler.writeResults(results)` — записывает результаты транспиляции
в файловую систему, копируя файлы из исходных путей в целевые.

**Вход:**

- `results` (array\<SkillTranspileResult>, обязательно) — результаты
  транспиляции, полученные из `transpile()`.

**Поведение:**

1. Для каждого `SkillTranspileResult` проверить, что массив `errors` пуст.
2. Для каждого `SkillOutputFile` из `files` побайтово скопировать файл из
   `projectRoot / sourcePath` в `projectRoot / relativePath`, создавая
   промежуточные каталоги при необходимости.
3. Вернуть `SkillWriteResult`.

**Расширения:**

1a. `SkillTranspileResult` содержит непустой `errors` — пропустить запись
всех `files` данного адаптера; создать один `SkillWriteError` с сообщением
`"Skipped {agentId}: transpile errors present"` и добавить его
в `SkillWriteResult.errors`.

2a. Исходный файл (`sourcePath`) не существует или недоступен для чтения →
`SkillWriteError("Failed to read source {sourcePath}: {причина}")`.

2b. Ошибка записи целевого файла или создания каталога (нет прав,
диск полон) →
`SkillWriteError("Failed to write {relativePath}: {причина}")`.

**Результат:**

`SkillWriteResult`.

## Вне scope

Следующие аспекты НЕ ВХОДЯТ в scope данной спецификации:

- Создание и scaffolding новых skills.
- Валидация формата и frontmatter файла SKILL.md.
- Трансляция frontmatter между агентами.
- Watch mode (отслеживание изменений skill-пакетов).
- Адаптеры для Codex CLI и Gemini CLI (отдельные спецификации).
- CLI-интерфейс (отдельная спецификация).
- Очистка устаревших agent-specific файлов при удалении skill-пакетов.
- Автоматическое обновление `.gitignore`.
