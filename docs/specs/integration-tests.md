---
summary: Integration Tests — интеграционные тесты полного pipeline транспилеров
description: >
  Спецификация интеграционных тестов для каждого транспилера (instructions, skills, agents).
  Каждый тест проверяет полный цикл createTranspiler → transpile → writeResults
  на реальной файловой системе без моков.
type: spec
status: implemented
relates:
  - docs/specs/instructions-transpiler.md
  - docs/specs/skills-transpiler.md
  - docs/specs/agents-transpiler.md
  - docs/specs/docs-transpiler.md
  - docs/specs/interpolation.md
  - docs/specs/plugin-loading.md
maps_to:
  - src/instructions-transpiler/__tests__/
  - src/skills-transpiler/__tests__/
  - src/agents-transpiler/__tests__/
  - src/docs-transpiler/__tests__/
---

# Integration Tests

Ключевые слова «ТРЕБУЕТСЯ», «ЗАПРЕЩАЕТСЯ», «ДОЛЖЕН», «НЕ ДОЛЖЕН», «СЛЕДУЕТ»,
«НЕ СЛЕДУЕТ», «МОЖЕТ» и «НЕОБЯЗАТЕЛЬНО» в этом документе толкуются
в соответствии с [RFC 2119](https://tools.ietf.org/html/rfc2119).

Интеграционные тесты для полного pipeline каждого транспилера:
createTranspiler → transpile → writeResults. Тесты работают на реальной
файловой системе (tmpDir) без моков. Каждый тест проверяет, что канонические
файлы, созданные на диске, корректно обнаруживаются, транспилируются
и записываются в целевые пути.

## Общие правила

### Паттерн тестирования

Каждый интеграционный тест ДОЛЖЕН следовать паттерну:

1. Создать временную директорию (`tmpDir`) через `fs.mkdtempSync`.
2. Создать каноническую структуру файлов внутри `tmpDir`.
3. Вызвать factory function транспилера с `projectRoot = tmpDir`
   и массивом адаптеров (один или несколько).
4. Вызвать `transpiler.transpile()`.
5. Вызвать `transpiler.writeResults(results)`.
6. Прочитать целевые файлы с диска и проверить их наличие и содержимое.

### Очистка

Каждый тестовый набор ДОЛЖЕН удалять `tmpDir` в `afterEach` через
`fs.rmSync(tmpDir, { recursive: true, force: true })`.

### Ограничение scope

Интеграционные тесты ДОЛЖНЫ покрывать только happy path pipeline.
Error paths (ошибки доступа, невалидная конфигурация, повреждённые файлы)
являются ответственностью unit-тестов соответствующих модулей
(см. `docs/specs/instructions-transpiler.md`,
`docs/specs/skills-transpiler.md`,
`docs/specs/agents-transpiler.md`).

### Моки

Использование моков, стабов и шпионов для внутренних модулей транспилеров
в интеграционных тестах ЗАПРЕЩАЕТСЯ, потому что цель интеграционного теста —
проверить взаимодействие реальных компонентов.

### Структура файлов

Интеграционные тесты ДОЛЖНЫ располагаться в каталогах `__tests__/`
соответствующих транспилеров:

- `src/instructions-transpiler/__tests__/integration.spec.ts`
- `src/skills-transpiler/__tests__/integration.spec.ts`
- `src/agents-transpiler/__tests__/integration.spec.ts`
- `src/docs-transpiler/__tests__/integration.spec.ts`

## Instructions Transpiler Integration

Полный pipeline интеграционного теста для instructions-transpiler.
Публичный API: `createInstructionsTranspiler`
(см. `docs/specs/instructions-transpiler.md`).

### IT-INSTR-01: Pipeline с Claude адаптером

Проверяет, что канонические файлы всех четырёх типов корректно
транспилируются и записываются для Claude.

**Вход:**

- `tmpDir` содержит:
  - `AGLOOM.md` с содержимым `"root instructions"`.
  - `AGLOOM.local.md` с содержимым `"local instructions"`.
  - `src/module/AGLOOM.md` с содержимым `"directory instructions"`.
  - `src/module/AGLOOM.local.md` с содержимым `"directory-local instructions"`.
- Адаптеры: `[ClaudeAdapter]`.

**Поведение:**

1. Создать экземпляр транспилера через `createInstructionsTranspiler`.
2. Вызвать `transpiler.transpile()`.
3. Вызвать `transpiler.writeResults(results)`.
4. Проверить, что `writeResult.errors` — пустой массив.
5. Прочитать файл `CLAUDE.md` из `tmpDir`.
6. Проверить, что содержимое файла `CLAUDE.md` равно `"root instructions"`.
7. Прочитать файл `CLAUDE.local.md` из `tmpDir`.
8. Проверить, что содержимое файла `CLAUDE.local.md` равно `"local instructions"`.
9. Прочитать файл `src/module/CLAUDE.md` из `tmpDir`.
10. Проверить, что содержимое файла `src/module/CLAUDE.md` равно `"directory instructions"`.
11. Прочитать файл `src/module/CLAUDE.local.md` из `tmpDir`.
12. Проверить, что содержимое файла `src/module/CLAUDE.local.md` равно `"directory-local instructions"`.

**Расширения:**

Нет расширений.

**Результат:**

`writeResult.written` содержит четыре пути: `"CLAUDE.md"`,
`"CLAUDE.local.md"`, `"src/module/CLAUDE.md"`,
`"src/module/CLAUDE.local.md"`.

### IT-INSTR-02: Pipeline с OpenCode адаптером

Проверяет, что OpenCode адаптер генерирует `AGENTS.md`
из канонического `AGLOOM.md`.

**Вход:**

- `tmpDir` содержит:
  - `AGLOOM.md` с содержимым `"root instructions"`.
  - `AGLOOM.local.md` с содержимым `"local instructions"`.
- Адаптеры: `[OpenCodeAdapter]`.

**Поведение:**

1. Создать экземпляр транспилера через `createInstructionsTranspiler`.
2. Вызвать `transpiler.transpile()`.
3. Вызвать `transpiler.writeResults(results)`.
4. Проверить, что `writeResult.errors` — пустой массив.
5. Прочитать файл `AGENTS.md` из `tmpDir`.
6. Проверить, что содержимое файла `AGENTS.md` равно `"root instructions"`.
7. Проверить, что файл `CLAUDE.md` НЕ существует в `tmpDir`.
8. Проверить, что файл `CLAUDE.local.md` НЕ существует в `tmpDir`.

**Расширения:**

Нет расширений.

**Результат:**

`writeResult.written` содержит `"AGENTS.md"`;
local и directory-level файлы не создаются (OpenCode их не поддерживает).

### IT-INSTR-03: Pipeline с обоими адаптерами одновременно

Проверяет, что оба адаптера обрабатываются за один вызов `transpile()`
и `writeResults()`.

**Вход:**

- `tmpDir` содержит:
  - `AGLOOM.md` с содержимым `"shared instructions"`.
- Адаптеры: `[ClaudeAdapter, OpenCodeAdapter]`.

**Поведение:**

1. Создать экземпляр транспилера через `createInstructionsTranspiler`.
2. Вызвать `transpiler.transpile()`.
3. Проверить, что `results` содержит два элемента `TranspileResult`
   (один с `agentId = "claude"`, другой с `agentId = "opencode"`).
4. Вызвать `transpiler.writeResults(results)`.
5. Проверить, что `writeResult.errors` — пустой массив.
6. Прочитать файл `CLAUDE.md` из `tmpDir`.
7. Проверить, что содержимое файла `CLAUDE.md` равно `"shared instructions"`.
8. Прочитать файл `AGENTS.md` из `tmpDir`.
9. Проверить, что содержимое файла `AGENTS.md` равно `"shared instructions"`.

**Расширения:**

Нет расширений.

**Результат:**

`writeResult.written` содержит `"CLAUDE.md"` и `"AGENTS.md"`.

### IT-INSTR-04: Pipeline при отсутствии канонических файлов

Проверяет, что pipeline корректно завершается при пустом `tmpDir`
(без канонических файлов).

**Вход:**

- `tmpDir` — пустая директория (без файлов `AGLOOM.md`
  и `AGLOOM.local.md`).
- Адаптеры: `[ClaudeAdapter]`.

**Поведение:**

1. Создать экземпляр транспилера через `createInstructionsTranspiler`.
2. Вызвать `transpiler.transpile()`.
3. Проверить, что `results` — пустой массив.
4. Вызвать `transpiler.writeResults(results)`.
5. Проверить, что `writeResult.errors` — пустой массив.
6. Проверить, что `writeResult.written` — пустой массив.

**Расширения:**

Нет расширений.

**Результат:**

`writeResult.written` — пустой массив; никакие файлы не созданы.

## Skills Transpiler Integration

Полный pipeline интеграционного теста для skills-transpiler.
Публичный API: `createSkillsTranspiler`
(см. `docs/specs/skills-transpiler.md`).

### IT-SKILL-01: Pipeline с Claude адаптером

Проверяет, что skill-пакеты корректно обнаруживаются, транспилируются
и копируются в целевой каталог Claude.

**Вход:**

- `tmpDir` содержит:
  - `.agloom/skills/my-skill/SKILL.md` с содержимым `"---\nname: my-skill\n---\nSkill body"`.
  - `.agloom/skills/my-skill/helpers/util.ts` с содержимым `"export const x = 1;"`.
- Адаптеры: `[ClaudeSkillAdapter]`.

**Поведение:**

1. Создать экземпляр транспилера через `createSkillsTranspiler`.
2. Вызвать `transpiler.transpile()`.
3. Вызвать `transpiler.writeResults(results)`.
4. Проверить, что `writeResult.errors` — пустой массив.
5. Прочитать файл `.claude/skills/my-skill/SKILL.md` из `tmpDir`.
6. Проверить, что содержимое файла `.claude/skills/my-skill/SKILL.md`
   побайтово совпадает с содержимым `.agloom/skills/my-skill/SKILL.md`.
7. Прочитать файл `.claude/skills/my-skill/helpers/util.ts` из `tmpDir`.
8. Проверить, что содержимое файла `.claude/skills/my-skill/helpers/util.ts`
   побайтово совпадает с содержимым `.agloom/skills/my-skill/helpers/util.ts`.

**Расширения:**

Нет расширений.

**Результат:**

`writeResult.written` содержит `".claude/skills/my-skill/SKILL.md"`
и `".claude/skills/my-skill/helpers/util.ts"`.

### IT-SKILL-02: Pipeline с несколькими skill-пакетами

Проверяет, что несколько skill-пакетов обрабатываются за один вызов.

**Вход:**

- `tmpDir` содержит:
  - `.agloom/skills/alpha/SKILL.md` с содержимым `"alpha skill"`.
  - `.agloom/skills/beta/SKILL.md` с содержимым `"beta skill"`.
- Адаптеры: `[ClaudeSkillAdapter]`.

**Поведение:**

1. Создать экземпляр транспилера через `createSkillsTranspiler`.
2. Вызвать `transpiler.transpile()`.
3. Вызвать `transpiler.writeResults(results)`.
4. Проверить, что `writeResult.errors` — пустой массив.
5. Прочитать файл `.claude/skills/alpha/SKILL.md` из `tmpDir`.
6. Проверить, что содержимое файла `.claude/skills/alpha/SKILL.md`
   побайтово совпадает с содержимым `.agloom/skills/alpha/SKILL.md`.
7. Прочитать файл `.claude/skills/beta/SKILL.md` из `tmpDir`.
8. Проверить, что содержимое файла `.claude/skills/beta/SKILL.md`
   побайтово совпадает с содержимым `.agloom/skills/beta/SKILL.md`.

**Расширения:**

Нет расширений.

**Результат:**

`writeResult.written` содержит `".claude/skills/alpha/SKILL.md"`
и `".claude/skills/beta/SKILL.md"`.

### IT-SKILL-03: Pipeline с OpenCode адаптером

Проверяет, что OpenCode адаптер генерирует файлы в `.opencode/skills/`
из канонического `.agloom/skills/`.

**Вход:**

- `tmpDir` содержит:
  - `.agloom/skills/my-skill/SKILL.md` с содержимым `"skill content"`.
- Адаптеры: `[OpenCodeSkillAdapter]`.

**Поведение:**

1. Создать экземпляр транспилера через `createSkillsTranspiler`.
2. Вызвать `transpiler.transpile()`.
3. Вызвать `transpiler.writeResults(results)`.
4. Проверить, что `writeResult.errors` — пустой массив.
5. Прочитать файл `.opencode/skills/my-skill/SKILL.md` из `tmpDir`.
6. Проверить, что содержимое файла `.opencode/skills/my-skill/SKILL.md`
   побайтово совпадает с содержимым `.agloom/skills/my-skill/SKILL.md`.

**Расширения:**

Нет расширений.

**Результат:**

`writeResult.written` содержит `".opencode/skills/my-skill/SKILL.md"`.

### IT-SKILL-04: Pipeline при отсутствии каталога .agloom/skills/

Проверяет, что pipeline корректно завершается при отсутствии
каталога `.agloom/skills/`.

**Вход:**

- `tmpDir` — пустая директория (каталог `.agloom/skills/`
  не существует).
- Адаптеры: `[ClaudeSkillAdapter]`.

**Поведение:**

1. Создать экземпляр транспилера через `createSkillsTranspiler`.
2. Вызвать `transpiler.transpile()`.
3. Проверить, что `results` — пустой массив.
4. Вызвать `transpiler.writeResults(results)`.
5. Проверить, что `writeResult.errors` — пустой массив.
6. Проверить, что `writeResult.written` — пустой массив.

**Расширения:**

Нет расширений.

**Результат:**

`writeResult.written` — пустой массив; никакие файлы не созданы.

## Agents Transpiler Integration

Полный pipeline интеграционного теста для agents-transpiler.
Публичный API: `createAgentsTranspiler`
(см. `docs/specs/agents-transpiler.md`).

### IT-AGENT-01: Pipeline с Claude адаптером — override и agent-specific секции

Проверяет, что frontmatter override применяется, ключ `override`
удаляется, agent-specific секции фильтруются, и результат записывается
в целевой каталог Claude.

**Вход:**

- `tmpDir` содержит:
  - `.agloom/agents/reviewer.md` со следующим содержимым:

    ```
    ---
    name: reviewer
    model: sonnet
    override:
      claude:
        permissionMode: plan
      opencode:
        model: anthropic/claude-sonnet-4-5
    ---
    General instructions.

    <!-- agent:claude -->
    Claude-specific instructions.
    <!-- /agent:claude -->

    <!-- agent:opencode -->
    OpenCode-specific instructions.
    <!-- /agent:opencode -->

    Shared footer.
    ```

- Адаптеры: `[ClaudeAgentAdapter]`.

**Поведение:**

1. Создать экземпляр транспилера через `createAgentsTranspiler`.
2. Вызвать `transpiler.transpile()`.
3. Вызвать `transpiler.writeResults(results)`.
4. Проверить, что `writeResult.errors` — пустой массив.
5. Прочитать файл `.claude/agents/reviewer.md` из `tmpDir`.
6. Выполнить парсинг frontmatter из прочитанного файла.
7. Проверить, что frontmatter содержит `name: "reviewer"`.
8. Проверить, что frontmatter содержит `model: "sonnet"`.
9. Проверить, что frontmatter содержит `permissionMode: "plan"`.
10. Проверить, что frontmatter НЕ содержит ключ `override`.
11. Проверить, что body содержит строку `"General instructions."`.
12. Проверить, что body содержит строку `"Claude-specific instructions."`.
13. Проверить, что body НЕ содержит строку `"OpenCode-specific instructions."`.
14. Проверить, что body НЕ содержит строку `"<!-- agent:"`.
15. Проверить, что body содержит строку `"Shared footer."`.

**Расширения:**

Нет расширений.

**Результат:**

`writeResult.written` содержит `".claude/agents/reviewer.md"`.

### IT-AGENT-02: Pipeline с OpenCode адаптером — override и agent-specific секции

Проверяет, что frontmatter override применяется для OpenCode,
ключ `override` удаляется, agent-specific секции фильтруются,
и результат записывается в целевой каталог OpenCode.

**Вход:**

- `tmpDir` содержит:
  - `.agloom/agents/reviewer.md` — тот же файл, что в IT-AGENT-01.
- Адаптеры: `[OpenCodeAgentAdapter]`.

**Поведение:**

1. Создать экземпляр транспилера через `createAgentsTranspiler`.
2. Вызвать `transpiler.transpile()`.
3. Вызвать `transpiler.writeResults(results)`.
4. Проверить, что `writeResult.errors` — пустой массив.
5. Прочитать файл `.opencode/agents/reviewer.md` из `tmpDir`.
6. Выполнить парсинг frontmatter из прочитанного файла.
7. Проверить, что frontmatter содержит `name: "reviewer"`.
8. Проверить, что frontmatter содержит `model: "anthropic/claude-sonnet-4-5"`.
9. Проверить, что frontmatter НЕ содержит ключ `override`.
10. Проверить, что body содержит строку `"General instructions."`.
11. Проверить, что body НЕ содержит строку `"Claude-specific instructions."`.
12. Проверить, что body содержит строку `"OpenCode-specific instructions."`.
13. Проверить, что body НЕ содержит строку `"<!-- agent:"`.
14. Проверить, что body содержит строку `"Shared footer."`.

**Расширения:**

Нет расширений.

**Результат:**

`writeResult.written` содержит `".opencode/agents/reviewer.md"`.

### IT-AGENT-03: Pipeline с обоими адаптерами одновременно

Проверяет, что оба адаптера обрабатываются за один вызов,
и каждый создаёт свой целевой файл с корректной трансформацией.

**Вход:**

- `tmpDir` содержит:
  - `.agloom/agents/reviewer.md` — тот же файл, что в IT-AGENT-01.
- Адаптеры: `[ClaudeAgentAdapter, OpenCodeAgentAdapter]`.

**Поведение:**

1. Создать экземпляр транспилера через `createAgentsTranspiler`.
2. Вызвать `transpiler.transpile()`.
3. Проверить, что `results` содержит два элемента `AgentTranspileResult`
   (один с `agentId = "claude"`, другой с `agentId = "opencode"`).
4. Вызвать `transpiler.writeResults(results)`.
5. Проверить, что `writeResult.errors` — пустой массив.
6. Проверить, что файл `.claude/agents/reviewer.md` существует в `tmpDir`.
7. Проверить, что файл `.opencode/agents/reviewer.md` существует в `tmpDir`.
8. Прочитать файл `.claude/agents/reviewer.md`.
9. Проверить, что body содержит строку `"Claude-specific instructions."`.
10. Проверить, что body НЕ содержит строку `"OpenCode-specific instructions."`.
11. Прочитать файл `.opencode/agents/reviewer.md`.
12. Проверить, что body НЕ содержит строку `"Claude-specific instructions."`.
13. Проверить, что body содержит строку `"OpenCode-specific instructions."`.

**Расширения:**

Нет расширений.

**Результат:**

`writeResult.written` содержит `".claude/agents/reviewer.md"`
и `".opencode/agents/reviewer.md"`.

### IT-AGENT-04: Pipeline с несколькими определениями агентов

Проверяет, что несколько `.md` файлов из `.agloom/agents/`
обрабатываются за один вызов.

**Вход:**

- `tmpDir` содержит:
  - `.agloom/agents/reviewer.md` со следующим содержимым:
    ```
    ---
    name: reviewer
    model: sonnet
    ---
    Reviewer instructions.
    ```
  - `.agloom/agents/coder.md` со следующим содержимым:
    ```
    ---
    name: coder
    model: opus
    ---
    Coder instructions.
    ```
- Адаптеры: `[ClaudeAgentAdapter]`.

**Поведение:**

1. Создать экземпляр транспилера через `createAgentsTranspiler`.
2. Вызвать `transpiler.transpile()`.
3. Вызвать `transpiler.writeResults(results)`.
4. Проверить, что `writeResult.errors` — пустой массив.
5. Прочитать файл `.claude/agents/reviewer.md` из `tmpDir`.
6. Проверить, что body содержит строку `"Reviewer instructions."`.
7. Прочитать файл `.claude/agents/coder.md` из `tmpDir`.
8. Проверить, что body содержит строку `"Coder instructions."`.

**Расширения:**

Нет расширений.

**Результат:**

`writeResult.written` содержит `".claude/agents/reviewer.md"`
и `".claude/agents/coder.md"`.

### IT-AGENT-05: Pipeline при отсутствии каталога .agloom/agents/

Проверяет, что pipeline корректно завершается при отсутствии
каталога `.agloom/agents/`.

**Вход:**

- `tmpDir` — пустая директория (каталог `.agloom/agents/`
  не существует).
- Адаптеры: `[ClaudeAgentAdapter]`.

**Поведение:**

1. Создать экземпляр транспилера через `createAgentsTranspiler`.
2. Вызвать `transpiler.transpile()`.
3. Проверить, что `results` — пустой массив.
4. Вызвать `transpiler.writeResults(results)`.
5. Проверить, что `writeResult.errors` — пустой массив.
6. Проверить, что `writeResult.written` — пустой массив.

**Расширения:**

Нет расширений.

**Результат:**

`writeResult.written` — пустой массив; никакие файлы не созданы.

### IT-AGENT-06: Pipeline без override и без agent-specific секций

Проверяет, что файл без `override` и без agent-specific секций
проходит pipeline без трансформации body и с удалением только
ключа `override` (который отсутствует).

**Вход:**

- `tmpDir` содержит:
  - `.agloom/agents/simple.md` со следующим содержимым:
    ```
    ---
    name: simple
    model: sonnet
    ---
    Plain instructions without any special sections.
    ```
- Адаптеры: `[ClaudeAgentAdapter]`.

**Поведение:**

1. Создать экземпляр транспилера через `createAgentsTranspiler`.
2. Вызвать `transpiler.transpile()`.
3. Вызвать `transpiler.writeResults(results)`.
4. Проверить, что `writeResult.errors` — пустой массив.
5. Прочитать файл `.claude/agents/simple.md` из `tmpDir`.
6. Выполнить парсинг frontmatter из прочитанного файла.
7. Проверить, что frontmatter содержит `name: "simple"`.
8. Проверить, что frontmatter содержит `model: "sonnet"`.
9. Проверить, что body содержит строку
   `"Plain instructions without any special sections."`.

**Расширения:**

Нет расширений.

**Результат:**

`writeResult.written` содержит `".claude/agents/simple.md"`.

## Docs Transpiler Integration

Полный pipeline интеграционного теста для docs-transpiler.
Публичный API: `createResourceTranspiler`
(см. `docs/specs/docs-transpiler.md`).

### IT-DOCS-01: Pipeline с Claude адаптером (docs)

Проверяет, что файлы из `.agloom/docs/` корректно обнаруживаются,
транспилируются и копируются в целевой каталог Claude.

**Вход:**

- `tmpDir` содержит:
  - `.agloom/docs/cycling/agent-protocol.md` с содержимым `"agent protocol content"`.
  - `.agloom/docs/overview.md` с содержимым `"overview content"`.
- Адаптеры: `[{ agentId: "claude", targetDir: ".claude/docs" }]`.
- `resourceType`: `"docs"`.

**Поведение:**

1. Создать экземпляр транспилера через `createResourceTranspiler`.
2. Вызвать `transpiler.transpile()`.
3. Вызвать `transpiler.writeResults(results)`.
4. Проверить, что `writeResult.errors` — пустой массив.
5. Прочитать файл `.claude/docs/cycling/agent-protocol.md` из `tmpDir`.
6. Проверить, что содержимое файла `.claude/docs/cycling/agent-protocol.md`
   побайтово совпадает с содержимым `.agloom/docs/cycling/agent-protocol.md`.
7. Прочитать файл `.claude/docs/overview.md` из `tmpDir`.
8. Проверить, что содержимое файла `.claude/docs/overview.md`
   побайтово совпадает с содержимым `.agloom/docs/overview.md`.

**Расширения:**

Нет расширений.

**Результат:**

`writeResult.written` содержит `".claude/docs/cycling/agent-protocol.md"`
и `".claude/docs/overview.md"`.

### IT-DOCS-02: Pipeline с Claude адаптером (schemas)

Проверяет, что файлы из `.agloom/schemas/` корректно обнаруживаются,
транспилируются и копируются в целевой каталог Claude.

**Вход:**

- `tmpDir` содержит:
  - `.agloom/schemas/spec.schema.yml` с содержимым `"spec schema content"`.
  - `.agloom/schemas/draft/agent.schema.yml` с содержимым `"agent schema content"`.
- Адаптеры: `[{ agentId: "claude", targetDir: ".claude/schemas" }]`.
- `resourceType`: `"schemas"`.

**Поведение:**

1. Создать экземпляр транспилера через `createResourceTranspiler`.
2. Вызвать `transpiler.transpile()`.
3. Вызвать `transpiler.writeResults(results)`.
4. Проверить, что `writeResult.errors` — пустой массив.
5. Прочитать файл `.claude/schemas/spec.schema.yml` из `tmpDir`.
6. Проверить, что содержимое файла `.claude/schemas/spec.schema.yml`
   побайтово совпадает с содержимым `.agloom/schemas/spec.schema.yml`.
7. Прочитать файл `.claude/schemas/draft/agent.schema.yml` из `tmpDir`.
8. Проверить, что содержимое файла `.claude/schemas/draft/agent.schema.yml`
   побайтово совпадает с содержимым `.agloom/schemas/draft/agent.schema.yml`.

**Расширения:**

Нет расширений.

**Результат:**

`writeResult.written` содержит `".claude/schemas/spec.schema.yml"`
и `".claude/schemas/draft/agent.schema.yml"`.

### IT-DOCS-03: Pipeline при отсутствии каталога .agloom/docs/

Проверяет, что pipeline корректно завершается при отсутствии
каталога `.agloom/docs/`.

**Вход:**

- `tmpDir` — пустая директория (каталог `.agloom/docs/`
  не существует).
- Адаптеры: `[{ agentId: "claude", targetDir: ".claude/docs" }]`.
- `resourceType`: `"docs"`.

**Поведение:**

1. Создать экземпляр транспилера через `createResourceTranspiler`.
2. Вызвать `transpiler.transpile()`.
3. Проверить, что `results` — пустой массив.
4. Вызвать `transpiler.writeResults(results)`.
5. Проверить, что `writeResult.errors` — пустой массив.
6. Проверить, что `writeResult.written` — пустой массив.

**Расширения:**

Нет расширений.

**Результат:**

`writeResult.written` — пустой массив; никакие файлы не созданы.

### IT-DOCS-04: Pipeline с интерполяцией .md файлов

Проверяет, что `.md` файлы интерполируются при передаче
`variablesByAgentId`, а файлы с другими расширениями
копируются побайтово.

**Вход:**

- `tmpDir` содержит:
  - `.agloom/docs/guide.md` с содержимым `"Skills dir: ${agloom:SKILLS_DIR}"`.
  - `.agloom/docs/data.yml` с содержимым `"raw: ${agloom:SKILLS_DIR}"`.
- Адаптеры: `[{ agentId: "claude", targetDir: ".claude/docs" }]`.
- `resourceType`: `"docs"`.
- `variablesByAgentId`: `{ "claude": { "SKILLS_DIR": ".claude/skills" } }`.

**Поведение:**

1. Создать экземпляр транспилера через `createResourceTranspiler`.
2. Вызвать `transpiler.transpile()`.
3. Вызвать `transpiler.writeResults(results, { variablesByAgentId })`.
4. Проверить, что `writeResult.errors` — пустой массив.
5. Прочитать файл `.claude/docs/guide.md` из `tmpDir`.
6. Проверить, что содержимое файла `.claude/docs/guide.md`
   равно `"Skills dir: .claude/skills"`.
7. Прочитать файл `.claude/docs/data.yml` из `tmpDir`.
8. Проверить, что содержимое файла `.claude/docs/data.yml`
   побайтово совпадает с содержимым `.agloom/docs/data.yml`
   (интерполяция НЕ выполняется для `.yml` файлов).

**Расширения:**

Нет расширений.

**Результат:**

`writeResult.written` содержит `".claude/docs/guide.md"`
и `".claude/docs/data.yml"`.

## Skills Transpiler — agloomDir

Интеграционные тесты для skills-transpiler с параметром `agloomDir`
и расширенным `writeResults` (plugin-подобные сценарии).
Публичный API: `createSkillsTranspiler`
(см. `docs/specs/skills-transpiler.md`).

### IT-SKILL-05: Pipeline с agloomDir="."

Проверяет, что skills-transpiler обнаруживает skill-пакеты
в `<projectRoot>/skills/` при `agloomDir = "."` (структура плагина).

**Вход:**

- `tmpDir` содержит:
  - `skills/my-skill/SKILL.md` с содержимым `"plugin skill body"`.
  - `skills/my-skill/docs/readme.md` с содержимым `"plugin readme"`.
- Конфигурация транспилера:
  - `projectRoot`: `tmpDir`.
  - `agloomDir`: `"."`.
  - Адаптеры: `[ClaudeSkillAdapter]`.

**Поведение:**

1. Создать экземпляр транспилера через `createSkillsTranspiler`
   с `agloomDir: "."`.
2. Вызвать `transpiler.transpile()`.
3. Вызвать `transpiler.writeResults(results)`.
4. Проверить, что `writeResult.errors` — пустой массив.
5. Прочитать файл `.claude/skills/my-skill/SKILL.md` из `tmpDir`.
6. Проверить, что содержимое файла `.claude/skills/my-skill/SKILL.md`
   побайтово совпадает с содержимым `skills/my-skill/SKILL.md`.
7. Прочитать файл `.claude/skills/my-skill/docs/readme.md` из `tmpDir`.
8. Проверить, что содержимое файла `.claude/skills/my-skill/docs/readme.md`
   побайтово совпадает с содержимым `skills/my-skill/docs/readme.md`.

**Расширения:**

Нет расширений.

**Результат:**

`writeResult.written` содержит `".claude/skills/my-skill/SKILL.md"`
и `".claude/skills/my-skill/docs/readme.md"`.

### IT-SKILL-06: Pipeline с writeResults targetRoot

Проверяет, что `writeResults` записывает файлы в `targetRoot`
(отличный от `projectRoot` транспилера), сохраняя discover
из `projectRoot`.

**Вход:**

- `sourceDir` (отдельная tmpDir) содержит:
  - `skills/my-skill/SKILL.md` с содержимым `"source skill body"`.
- `targetDir` (отдельная tmpDir) — пустая директория.
- Конфигурация транспилера:
  - `projectRoot`: `sourceDir`.
  - `agloomDir`: `"."`.
  - Адаптеры: `[ClaudeSkillAdapter]`.

**Поведение:**

1. Создать экземпляр транспилера через `createSkillsTranspiler`
   с `projectRoot: sourceDir` и `agloomDir: "."`.
2. Вызвать `transpiler.transpile()`.
3. Вызвать `transpiler.writeResults(results, { targetRoot: targetDir })`.
4. Проверить, что `writeResult.errors` — пустой массив.
5. Прочитать файл `.claude/skills/my-skill/SKILL.md` из `targetDir`.
6. Проверить, что содержимое файла `.claude/skills/my-skill/SKILL.md`
   из `targetDir` побайтово совпадает с содержимым
   `skills/my-skill/SKILL.md` из `sourceDir`.
7. Проверить, что файл `.claude/skills/my-skill/SKILL.md`
   НЕ существует в `sourceDir`.

**Расширения:**

Нет расширений.

**Результат:**

`writeResult.written` содержит `".claude/skills/my-skill/SKILL.md"`.
Файлы записаны в `targetDir`, а не в `sourceDir`.

### IT-SKILL-07: Pipeline с writeResults { targetRoot, variablesByAgentId }

Проверяет, что `writeResults` одновременно записывает файлы
в `targetRoot` и интерполирует `.md` файлы с использованием
`variablesByAgentId`.

**Вход:**

- `sourceDir` (отдельная tmpDir) содержит:
  - `skills/my-skill/SKILL.md` с содержимым `"Root: ${agloom:ROOT_DIR}"`.
  - `skills/my-skill/helpers/util.ts` с содержимым `"export const x = 1;"`.
- `targetDir` (отдельная tmpDir) — пустая директория.
- Конфигурация транспилера:
  - `projectRoot`: `sourceDir`.
  - `agloomDir`: `"."`.
  - Адаптеры: `[ClaudeSkillAdapter]`.
- `variablesByAgentId`: `{ "claude": { "ROOT_DIR": ".claude" } }`.

**Поведение:**

1. Создать экземпляр транспилера через `createSkillsTranspiler`
   с `projectRoot: sourceDir` и `agloomDir: "."`.
2. Вызвать `transpiler.transpile()`.
3. Вызвать `transpiler.writeResults(results, { targetRoot: targetDir, variablesByAgentId })`.
4. Проверить, что `writeResult.errors` — пустой массив.
5. Прочитать файл `.claude/skills/my-skill/SKILL.md` из `targetDir`.
6. Проверить, что содержимое файла `.claude/skills/my-skill/SKILL.md`
   равно `"Root: .claude"` (интерполяция выполнена).
7. Прочитать файл `.claude/skills/my-skill/helpers/util.ts` из `targetDir`.
8. Проверить, что содержимое файла `.claude/skills/my-skill/helpers/util.ts`
   побайтово совпадает с содержимым `skills/my-skill/helpers/util.ts`
   из `sourceDir` (`.ts` файл скопирован побайтово).

**Расширения:**

Нет расширений.

**Результат:**

`writeResult.written` содержит `".claude/skills/my-skill/SKILL.md"`
и `".claude/skills/my-skill/helpers/util.ts"`.

### IT-SKILL-08: Pipeline с variablesByAgentId — интерполяция .md и побайтовое копирование .ts

Проверяет, что при передаче `variablesByAgentId` файлы `.md`
интерполируются, а файлы с другими расширениями (`.ts`)
копируются побайтово без интерполяции.

**Вход:**

- `tmpDir` содержит:
  - `.agloom/skills/my-skill/SKILL.md` с содержимым `"Agents: ${agloom:AGENTS_DIR}"`.
  - `.agloom/skills/my-skill/helpers/util.ts` с содержимым `"// ${agloom:AGENTS_DIR}"`.
- Адаптеры: `[ClaudeSkillAdapter]`.
- `variablesByAgentId`: `{ "claude": { "AGENTS_DIR": ".claude/agents" } }`.

**Поведение:**

1. Создать экземпляр транспилера через `createSkillsTranspiler`.
2. Вызвать `transpiler.transpile()`.
3. Вызвать `transpiler.writeResults(results, { variablesByAgentId })`.
4. Проверить, что `writeResult.errors` — пустой массив.
5. Прочитать файл `.claude/skills/my-skill/SKILL.md` из `tmpDir`.
6. Проверить, что содержимое файла `.claude/skills/my-skill/SKILL.md`
   равно `"Agents: .claude/agents"` (интерполяция выполнена).
7. Прочитать файл `.claude/skills/my-skill/helpers/util.ts` из `tmpDir`.
8. Проверить, что содержимое файла `.claude/skills/my-skill/helpers/util.ts`
   побайтово совпадает с содержимым `.agloom/skills/my-skill/helpers/util.ts`
   (`.ts` файл содержит литеральную строку `"// ${agloom:AGENTS_DIR}"`
   без интерполяции).

**Расширения:**

Нет расширений.

**Результат:**

`writeResult.written` содержит `".claude/skills/my-skill/SKILL.md"`
и `".claude/skills/my-skill/helpers/util.ts"`.

## Agents Transpiler — agloomDir

Интеграционные тесты для agents-transpiler с параметром `agloomDir`
и расширенным `writeResults` (plugin-подобные сценарии).
Публичный API: `createAgentsTranspiler`
(см. `docs/specs/agents-transpiler.md`).

### IT-AGENT-07: Pipeline с agloomDir="."

Проверяет, что agents-transpiler обнаруживает определения агентов
в `<projectRoot>/agents/` при `agloomDir = "."` (структура плагина).

**Вход:**

- `tmpDir` содержит:
  - `agents/reviewer.md` со следующим содержимым:
    ```
    ---
    name: reviewer
    model: sonnet
    ---
    Plugin agent instructions.
    ```
- Конфигурация транспилера:
  - `projectRoot`: `tmpDir`.
  - `agloomDir`: `"."`.
  - Адаптеры: `[ClaudeAgentAdapter]`.

**Поведение:**

1. Создать экземпляр транспилера через `createAgentsTranspiler`
   с `agloomDir: "."`.
2. Вызвать `transpiler.transpile()`.
3. Вызвать `transpiler.writeResults(results)`.
4. Проверить, что `writeResult.errors` — пустой массив.
5. Прочитать файл `.claude/agents/reviewer.md` из `tmpDir`.
6. Выполнить парсинг frontmatter из прочитанного файла.
7. Проверить, что frontmatter содержит `name: "reviewer"`.
8. Проверить, что frontmatter содержит `model: "sonnet"`.
9. Проверить, что body содержит строку `"Plugin agent instructions."`.

**Расширения:**

Нет расширений.

**Результат:**

`writeResult.written` содержит `".claude/agents/reviewer.md"`.

### IT-AGENT-08: Pipeline с writeResults targetRoot

Проверяет, что `writeResults` записывает файлы в `targetRoot`
(отличный от `projectRoot` транспилера), сохраняя discover
и transform из `projectRoot`.

**Вход:**

- `sourceDir` (отдельная tmpDir) содержит:
  - `agents/coder.md` со следующим содержимым:
    ```
    ---
    name: coder
    model: opus
    override:
      claude:
        permissionMode: plan
    ---
    Source agent instructions.
    ```
- `targetDir` (отдельная tmpDir) — пустая директория.
- Конфигурация транспилера:
  - `projectRoot`: `sourceDir`.
  - `agloomDir`: `"."`.
  - Адаптеры: `[ClaudeAgentAdapter]`.

**Поведение:**

1. Создать экземпляр транспилера через `createAgentsTranspiler`
   с `projectRoot: sourceDir` и `agloomDir: "."`.
2. Вызвать `transpiler.transpile()`.
3. Вызвать `transpiler.writeResults(results, { targetRoot: targetDir })`.
4. Проверить, что `writeResult.errors` — пустой массив.
5. Прочитать файл `.claude/agents/coder.md` из `targetDir`.
6. Выполнить парсинг frontmatter из прочитанного файла.
7. Проверить, что frontmatter содержит `name: "coder"`.
8. Проверить, что frontmatter содержит `permissionMode: "plan"`.
9. Проверить, что frontmatter НЕ содержит ключ `override`.
10. Проверить, что body содержит строку `"Source agent instructions."`.
11. Проверить, что файл `.claude/agents/coder.md`
    НЕ существует в `sourceDir`.

**Расширения:**

Нет расширений.

**Результат:**

`writeResult.written` содержит `".claude/agents/coder.md"`.
Файл записан в `targetDir`, а не в `sourceDir`.

### IT-AGENT-09: Pipeline с agloomDir="." — ремаппинг relativePath

Проверяет, что при `agloomDir = "."` транспилер выполняет ремаппинг
`relativePath` из `./agents/` в `<adapter.targetDir>/`. Ремаппинг
выполняется транспилером (см. `docs/specs/agents-transpiler.md`
§ Транспиляция, шаг 3), а не адаптером.

**Вход:**

- `tmpDir` содержит:
  - `agents/deep/nested-agent.md` со следующим содержимым:
    ```
    ---
    name: nested-agent
    model: sonnet
    ---
    Nested agent instructions.
    ```
- Конфигурация транспилера:
  - `projectRoot`: `tmpDir`.
  - `agloomDir`: `"."`.
  - Адаптеры: `[ClaudeAgentAdapter]`.

**Поведение:**

1. Создать экземпляр транспилера через `createAgentsTranspiler`
   с `agloomDir: "."`.
2. Вызвать `transpiler.transpile()`.
3. Проверить, что `results[0].files[0].relativePath` равен
   `".claude/agents/deep/nested-agent.md"` (ремаппинг выполнен
   транспилером: префикс `./agents/` заменён на `.claude/agents/`).
4. Вызвать `transpiler.writeResults(results)`.
5. Проверить, что `writeResult.errors` — пустой массив.
6. Прочитать файл `.claude/agents/deep/nested-agent.md` из `tmpDir`.
7. Проверить, что body содержит строку `"Nested agent instructions."`.

**Расширения:**

Нет расширений.

**Результат:**

`writeResult.written` содержит `".claude/agents/deep/nested-agent.md"`.

## Вне scope

Следующие аспекты НЕ ВХОДЯТ в scope данной спецификации:

- E2E тесты CLI (тестирование бинарника через shell).
- Тесты error paths (покрыты unit-тестами соответствующих модулей).
- Performance тесты и бенчмарки.
- Тесты watch mode.
- Тесты конкурентного доступа к файловой системе.
