---
summary: Interpolation — система интерполяции переменных при транспиляции
description: >
  Библиотека интерполяции переменных с namespace-prefix синтаксисом
  (${agloom:VAR}, ${env:VAR}) для подстановки адаптер-зависимых путей
  и значений окружения при транспиляции canonical файлов в agent-specific.
  Расширяет AdapterRegistryEntry полем paths. Интегрируется с instructions,
  agents и skills транспилерами.
type: spec
status: implemented
relates:
  - docs/specs/skills-transpiler.md
  - docs/specs/agents-transpiler.md
  - docs/specs/instructions-transpiler.md
  - docs/specs/adapter-registry-ext.md
  - docs/specs/cli.md
maps_to:
  - src/interpolation/
---

# Interpolation

Ключевые слова «ТРЕБУЕТСЯ», «ЗАПРЕЩАЕТСЯ», «ДОЛЖЕН», «НЕ ДОЛЖЕН», «СЛЕДУЕТ»,
«НЕ СЛЕДУЕТ», «МОЖЕТ» и «НЕОБЯЗАТЕЛЬНО» в этом документе толкуются
в соответствии с [RFC 2119](https://tools.ietf.org/html/rfc2119).

Система интерполяции переменных для подстановки адаптер-зависимых путей
и значений окружения при транспиляции canonical файлов в agent-specific.
Canonical файлы используют абстрактные ссылки вида `${agloom:AGENTS_DIR}`,
которые при транспиляции заменяются конкретными путями целевого адаптера
(например, `.claude/agents`).

Библиотека предоставляет два публичных метода: `buildVariables`
для построения карты переменных и `interpolate` для подстановки
значений в текстовом содержимом. Интерполяция интегрируется
в существующие транспилеры через расширение их операций
(см. «Интеграция с транспилерами»).

## Расширение AdapterRegistryEntry

К существующему типу `AdapterRegistryEntry`
(см. `docs/specs/adapter-registry-ext.md` § Расширение AdapterRegistryEntry)
ТРЕБУЕТСЯ добавить поле:

- `paths` (object, обязательно) — пути к agent-specific каталогам.
  Объект МОЖЕТ быть пустым. Все подполя опциональны:
  - `skills` (string, опционально) — путь к каталогу skills
    относительно корня проекта.
  - `agents` (string, опционально) — путь к каталогу agents
    относительно корня проекта.
  - `docs` (string, опционально) — путь к каталогу docs
    относительно корня проекта.
  - `schemas` (string, опционально) — путь к каталогу schemas
    относительно корня проекта.

Значения полей `paths` НЕ ДОЛЖНЫ автоматически деривироваться из `targetRoot`.
Каждый адаптер полностью контролирует свои пути. Например, будущий адаптер
codex МОЖЕТ иметь `targetRoot: ".codex"`, но `paths.skills: ".agents/skills"`.

### Обновление реестра адаптеров

В реестр адаптеров ТРЕБУЕТСЯ добавить поле `paths` для каждой записи:

| `id`         | `paths.skills`       | `paths.agents`       | `paths.docs`       | `paths.schemas`       |
| ------------ | -------------------- | -------------------- | ------------------ | --------------------- |
| `"claude"`   | `".claude/skills"`   | `".claude/agents"`   | `".claude/docs"`   | `".claude/schemas"`   |
| `"opencode"` | `".opencode/skills"` | `".opencode/agents"` | `".opencode/docs"` | `".opencode/schemas"` |
| `"agentsmd"` | _(не определено)_    | _(не определено)_    | _(не определено)_  | _(не определено)_     |

Запись `"agentsmd"` ДОЛЖНА иметь пустой объект `paths: {}`, потому что
адаптер agentsmd отвечает только за файл `AGENTS.md` и не имеет
собственных каталогов skills, agents, docs, schemas.

## Синтаксис переменных

Интерполяция поддерживает два namespace с prefix-синтаксисом:

- `${agloom:NAME}` — подстановка предзаданной agloom-переменной.
- `${env:NAME}` — подстановка переменной окружения из `process.env`.
- `\${agloom:NAME}` — escape: заменяется на литерал `${agloom:NAME}`
  (backslash перед `$` потребляется, интерполяция не выполняется).
- `\${env:NAME}` — escape: заменяется на литерал `${env:NAME}`
  (backslash перед `$` потребляется, интерполяция не выполняется).

`NAME` — один или более символов, не содержащих `}`.

Текст, не соответствующий ни одному из вышеуказанных паттернов,
ДОЛЖЕН сохраняться без изменений. Паттерны с другими namespace
(например, `${foo:bar}`) НЕ ДОЛЖНЫ обрабатываться и ДОЛЖНЫ
сохраняться как литеральный текст.

## Группы переменных agloom

Переменные namespace `agloom` разделены на три группы.
Все переменные формируются функцией `buildVariables`
(см. «Построение карты переменных»).

### Канонические (фиксированные)

Значения фиксированы и не зависят от адаптера.

| Переменная           | Значение          |
| -------------------- | ----------------- |
| `PROJECT_DIR`        | значение параметра `projectRoot` |
| `AGLOOM_DIR`         | `.agloom`         |
| `AGLOOM_SKILLS_DIR`  | `.agloom/skills`  |
| `AGLOOM_AGENTS_DIR`  | `.agloom/agents`  |
| `AGLOOM_DOCS_DIR`    | `.agloom/docs`    |
| `AGLOOM_SCHEMAS_DIR` | `.agloom/schemas` |

`PROJECT_DIR` — единственная каноническая переменная, содержащая
абсолютный путь. Все остальные канонические переменные содержат
относительные пути. Пользователь МОЖЕТ компоновать абсолютные пути
к любому каталогу: `${agloom:PROJECT_DIR}/${agloom:AGLOOM_DIR}`
раскроется в `<projectRoot>/.agloom`.

### Динамические (per-current-adapter)

Значения зависят от текущего адаптера, для которого выполняется
транспиляция. Источник значений — поля `targetRoot` и `paths`
текущего адаптера (`currentAdapter`).

| Переменная    | Источник                       |
| ------------- | ------------------------------ |
| `ROOT_DIR`    | `currentAdapter.targetRoot`    |
| `SKILLS_DIR`  | `currentAdapter.paths.skills`  |
| `AGENTS_DIR`  | `currentAdapter.paths.agents`  |
| `DOCS_DIR`    | `currentAdapter.paths.docs`    |
| `SCHEMAS_DIR` | `currentAdapter.paths.schemas` |

Переменная `ROOT_DIR` ДОЛЖНА присутствовать всегда, потому что
`targetRoot` является обязательным полем `AdapterRegistryEntry`.

Динамическая переменная (`SKILLS_DIR`, `AGENTS_DIR`, `DOCS_DIR`,
`SCHEMAS_DIR`) ДОЛЖНА присутствовать в карте только если
соответствующее поле `paths` определено у текущего адаптера.
Если поле не определено, переменная НЕ ДОЛЖНА присутствовать в карте.

### Статические (per-adapter)

Для каждого адаптера из `allAdapters`, у которого объект `paths`
содержит хотя бы одно определённое поле, генерируются переменные
с префиксом, равным `adapter.id.toUpperCase()`.

| Шаблон переменной      | Источник                |
| ---------------------- | ----------------------- |
| `{PREFIX}_DIR`         | `adapter.targetRoot`    |
| `{PREFIX}_SKILLS_DIR`  | `adapter.paths.skills`  |
| `{PREFIX}_AGENTS_DIR`  | `adapter.paths.agents`  |
| `{PREFIX}_DOCS_DIR`    | `adapter.paths.docs`    |
| `{PREFIX}_SCHEMAS_DIR` | `adapter.paths.schemas` |

Где `{PREFIX}` = `adapter.id.toUpperCase()`.

Переменная `{PREFIX}_DIR` ДОЛЖНА генерироваться всегда для адаптера,
у которого генерируются per-adapter переменные.

Переменная `{PREFIX}_SKILLS_DIR` ДОЛЖНА генерироваться только если
`adapter.paths.skills` определено. Аналогично для `agents`, `docs`,
`schemas`.

Для адаптера с пустым объектом `paths`
(`Object.keys(adapter.paths).length === 0`) per-adapter переменные
НЕ ДОЛЖНЫ генерироваться (включая `{PREFIX}_DIR`).

#### Пример

При текущей конфигурации реестра (claude, opencode, agentsmd)
per-adapter переменные генерируются для `claude` и `opencode`:

- `CLAUDE_DIR` → `.claude`
- `CLAUDE_SKILLS_DIR` → `.claude/skills`
- `CLAUDE_AGENTS_DIR` → `.claude/agents`
- `CLAUDE_DOCS_DIR` → `.claude/docs`
- `CLAUDE_SCHEMAS_DIR` → `.claude/schemas`
- `OPENCODE_DIR` → `.opencode`
- `OPENCODE_SKILLS_DIR` → `.opencode/skills`
- `OPENCODE_AGENTS_DIR` → `.opencode/agents`
- `OPENCODE_DOCS_DIR` → `.opencode/docs`
- `OPENCODE_SCHEMAS_DIR` → `.opencode/schemas`

Для `agentsmd` (пустой `paths`) переменные не генерируются.

## Классы ошибок

- `InterpolationError` (extends Error) — ошибка интерполяции
  (неизвестная agloom-переменная, неопределённая переменная окружения).

## Построение карты переменных

`buildVariables(currentAdapter, allAdapters, projectRoot)` — строит карту
agloom-переменных для указанного текущего адаптера.

**Вход:**

- `currentAdapter` (AdapterRegistryEntry, обязательно) — запись текущего
  адаптера, для которого выполняется транспиляция.
- `allAdapters` (array\<AdapterRegistryEntry>, обязательно) — все записи
  реестра адаптеров.
- `projectRoot` (string, обязательно) — абсолютный путь к корню проекта.

**Поведение:**

1. Создать пустую карту `Record<string, string>`.
2. Добавить `PROJECT_DIR` со значением `projectRoot`.
3. Добавить остальные канонические переменные
   (см. «Канонические (фиксированные)»).
4. Добавить `ROOT_DIR` со значением `currentAdapter.targetRoot`.
5. Для каждого определённого поля из `currentAdapter.paths` добавить
   соответствующую динамическую переменную
   (см. «Динамические (per-current-adapter)»).
6. Для каждого адаптера из `allAdapters`, у которого
   `Object.keys(adapter.paths).length > 0` —
   вычислить префикс `adapter.id.toUpperCase()`.
7. Добавить `{PREFIX}_DIR` со значением `adapter.targetRoot`.
8. Для каждого определённого поля из `adapter.paths` добавить
   соответствующую per-adapter переменную
   (см. «Статические (per-adapter)»).

**Расширения:**

Нет расширений.

**Результат:**

`Record<string, string>` — карта имён переменных к их значениям.

## Интерполяция контента

`interpolate(content, variables, env?)` — выполняет подстановку
переменных в текстовом содержимом за один проход.

**Вход:**

- `content` (string, обязательно) — текст для интерполяции
  (многострочный, может содержать frontmatter и body).
- `variables` (Record\<string, string>, обязательно) — карта
  agloom-переменных (результат `buildVariables`).
- `env` (Record\<string, string | undefined>, опционально,
  default: `process.env`) — объект окружения для разрешения `${env:VAR}`.

**Поведение:**

1. Обработать `content` в один проход.
2. Для каждого вхождения `\${agloom:NAME}` — заменить на литерал
   `${agloom:NAME}` (потребить backslash).
3. Для каждого вхождения `\${env:NAME}` — заменить на литерал
   `${env:NAME}` (потребить backslash).
4. Для каждого вхождения `${agloom:NAME}` (без предшествующего `\`) —
   найти `NAME` в `variables`, подставить значение.
5. Для каждого вхождения `${env:NAME}` (без предшествующего `\`) —
   найти `NAME` в `env`, подставить значение.
6. Текст, не соответствующий вышеуказанным паттернам, — сохранить
   без изменений.
7. Вернуть результат.

**Расширения:**

4a. `NAME` не найден в `variables` →
`InterpolationError("Unknown agloom variable: {NAME}")`.

5a. `NAME` не найден в `env` или значение `undefined` →
`InterpolationError("Undefined environment variable: {NAME}")`.

**Результат:**

`string` — текст с выполненными подстановками.

## Интеграция с транспилерами

Расширения операций library-методов и CLI-команд в данной секции
используют адаптированный формат `cli:command-ext`
(см. `.claude/skills/spec-cycle/docs/types/cli.md` § cli:command-ext):
секции «Новые параметры», «Новые шаги», «Изменения в поведении»,
«Новые расширения». Формальный тип `library:method-ext` отсутствует
в `spec-format.md`; `cli:command-ext` применяется по аналогии.

### Расширение transformContent Instructions Transpiler

Операция `transformContent`
(см. `docs/specs/instructions-transpiler.md` § Трансформация контента)
расширяется шагом интерполяции.

**Новые параметры:**

- `variables` (Record\<string, string>, опционально) — карта
  agloom-переменных. Если параметр передан, интерполяция выполняется.
  Если не передан, шаг интерполяции пропускается
  (обратная совместимость).

**Новые шаги:**

После шага 10 (присоединение body к frontmatter):

11\. Если `variables` передан — вызвать `interpolate(result, variables)`
на результате шагов 9–10 (или на результате расширения 9a).

**Новые расширения:**

11a. `interpolate` выбрасывает `InterpolationError` →
`TransformError("Interpolation failed: {причина}")`.

### Расширение transformContent Agents Transpiler

Операция `transformContent`
(см. `docs/specs/agents-transpiler.md` § Трансформация контента)
расширяется шагом интерполяции.

**Новые параметры:**

- `variables` (Record\<string, string>, опционально) — карта
  agloom-переменных. Если параметр передан, интерполяция выполняется.
  Если не передан, шаг интерполяции пропускается
  (обратная совместимость).

**Новые шаги:**

После шага 10 (присоединение body к frontmatter):

11\. Если `variables` передан — вызвать `interpolate(result, variables)`
на результате шагов 9–10 (или на результате расширения 9a).

**Новые расширения:**

11a. `interpolate` выбрасывает `InterpolationError` →
`AgentTransformError("Interpolation failed: {причина}")`.

### Расширение writeResults Skills Transpiler

Операция `writeResults`
(см. `docs/specs/skills-transpiler.md` § Запись результатов)
расширяется интерполяцией для `.md` файлов.

**Новые параметры:**

- `variablesByAgentId` (Record\<string, Record\<string, string>>,
  опционально) — карта agloom-переменных, индексированная по `agentId`.
  Если параметр передан, интерполяция выполняется для `.md` файлов.
  Если не передан, все файлы копируются побайтово
  (обратная совместимость).

**Изменения в поведении:**

Шаг 2 (побайтовое копирование) ЗАМЕНЯЕТСЯ на:

2\. Для каждого `SkillOutputFile` из `files`:

- Если `variablesByAgentId` передан И расширение файла `sourcePath`
  равно `.md` (case-insensitive) — прочитать содержимое
  `projectRoot / sourcePath` с кодировкой UTF-8,
  вызвать `interpolate(content, variablesByAgentId[agentId])`,
  записать результат в `projectRoot / relativePath`
  с кодировкой UTF-8, создавая промежуточные каталоги
  при необходимости.
- Иначе — побайтово скопировать файл из `projectRoot / sourcePath`
  в `projectRoot / relativePath`, создавая промежуточные каталоги
  при необходимости.

**Новые расширения:**

2c. `variablesByAgentId` передан, но ключ `agentId` текущего
`SkillTranspileResult` отсутствует в `variablesByAgentId` →
`SkillWriteError("No interpolation variables for adapter: {agentId}")`.

2d. `interpolate` выбрасывает `InterpolationError` →
`SkillWriteError("Interpolation failed for {sourcePath}: {причина}")`.

### Расширение команды transpile

Команда `transpile` (см. `docs/specs/cli.md` § Команда transpile)
расширяется построением переменных интерполяции.

**Новые шаги:**

В цикле шага 4, после подшага 4.1 (отображение заголовка)
и перед подшагом 4.2 (Instructions):

Построить карту переменных для текущей записи:
`buildVariables(entry, adapterRegistry, projectRoot)`, где
`adapterRegistry` — полный реестр адаптеров (не только разрешённые
записи), `projectRoot` — абсолютный путь к корню проекта
(определён на шаге 2 команды transpile).

**Изменения в поведении:**

Шаги 4.2–4.4 ДОЛЖНЫ обеспечить передачу построенной карты переменных
в соответствующие операции транспиляции:

- Instructions (шаг 4.2): `transformContent` вызывается с `variables`.
- Skills (шаг 4.3): `writeResults` вызывается с `variablesByAgentId`,
  содержащим карту переменных для текущего `entry.id`.
- Agents (шаг 4.4): `transformContent` вызывается с `variables`.

## Пример трансформации

Canonical содержимое:

```text
| agent-protocol | `${agloom:AGLOOM_DIR}/docs/cycling/agent-protocol.md` |
| spec-writer | `${agloom:AGENTS_DIR}/spec-writer/spec-writer.md` |
| skills-abs | `${agloom:PROJECT_DIR}/${agloom:SKILLS_DIR}` |
Env: ${env:PROJECT_NAME}
Escaped: \${env:HOME}
```

После интерполяции для адаптера `claude`
(при `projectRoot=/home/user/myapp`, `PROJECT_NAME=myapp` в окружении):

```text
| agent-protocol | `.agloom/docs/cycling/agent-protocol.md` |
| spec-writer | `.claude/agents/spec-writer/spec-writer.md` |
| skills-abs | `/home/user/myapp/.claude/skills` |
Env: myapp
Escaped: ${env:HOME}
```

После интерполяции для адаптера `opencode`
(при `projectRoot=/home/user/myapp`, `PROJECT_NAME=myapp` в окружении):

```text
| agent-protocol | `.agloom/docs/cycling/agent-protocol.md` |
| spec-writer | `.opencode/agents/spec-writer/spec-writer.md` |
| skills-abs | `/home/user/myapp/.opencode/skills` |
Env: myapp
Escaped: ${env:HOME}
```

## Вне scope

Следующие аспекты НЕ ВХОДЯТ в scope данной спецификации:

- Вложенная интерполяция (`${agloom:${env:X}}`).
- Рекурсивная интерполяция (значение подставленной переменной
  содержит `${...}` — повторная подстановка не выполняется).
- Namespace кроме `agloom` и `env`.
- Пользовательские переменные (определяемые в конфигурации проекта).
- Интерполяция в бинарных файлах (skills-transpiler обрабатывает
  только `.md` файлы).
- Watch mode (отслеживание изменений при интерполяции).
- Escape-последовательность `\\$` (двойной backslash перед `$`
  не имеет специальной обработки).
