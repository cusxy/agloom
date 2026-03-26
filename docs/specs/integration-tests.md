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
maps_to:
  - src/instructions-transpiler/__tests__/
  - src/skills-transpiler/__tests__/
  - src/agents-transpiler/__tests__/
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

## Instructions Transpiler Integration

Полный pipeline интеграционного теста для instructions-transpiler.
Публичный API: `createInstructionsTranspiler`
(см. `docs/specs/instructions-transpiler.md`).

### IT-INSTR-01: Pipeline с Claude адаптером

Проверяет, что канонические файлы всех четырёх типов корректно
транспилируются и записываются для Claude.

**Вход:**

- `tmpDir` содержит:
  - `AGENTS.md` с содержимым `"root instructions"`.
  - `AGENTS.local.md` с содержимым `"local instructions"`.
  - `src/module/AGENTS.md` с содержимым `"directory instructions"`.
  - `src/module/AGENTS.local.md` с содержимым `"directory-local instructions"`.
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

### IT-INSTR-02: Pipeline с OpenCode адаптером (no-op)

Проверяет, что OpenCode адаптер не создаёт файлов.

**Вход:**

- `tmpDir` содержит:
  - `AGENTS.md` с содержимым `"root instructions"`.
  - `AGENTS.local.md` с содержимым `"local instructions"`.
- Адаптеры: `[OpenCodeAdapter]`.

**Поведение:**

1. Создать экземпляр транспилера через `createInstructionsTranspiler`.
2. Вызвать `transpiler.transpile()`.
3. Вызвать `transpiler.writeResults(results)`.
4. Проверить, что `writeResult.errors` — пустой массив.
5. Проверить, что `writeResult.written` — пустой массив.
6. Проверить, что файл `CLAUDE.md` НЕ существует в `tmpDir`.
7. Проверить, что файл `CLAUDE.local.md` НЕ существует в `tmpDir`.

**Расширения:**

Нет расширений.

**Результат:**

`writeResult.written` — пустой массив; никакие agent-specific файлы
не созданы на диске.

### IT-INSTR-03: Pipeline с обоими адаптерами одновременно

Проверяет, что оба адаптера обрабатываются за один вызов `transpile()`
и `writeResults()`.

**Вход:**

- `tmpDir` содержит:
  - `AGENTS.md` с содержимым `"shared instructions"`.
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

**Расширения:**

Нет расширений.

**Результат:**

`writeResult.written` содержит `"CLAUDE.md"` (Claude адаптер создал файл);
OpenCode адаптер не создал файлов.

### IT-INSTR-04: Pipeline при отсутствии канонических файлов

Проверяет, что pipeline корректно завершается при пустом `tmpDir`
(без канонических файлов).

**Вход:**

- `tmpDir` — пустая директория (без файлов `AGENTS.md`
  и `AGENTS.local.md`).
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
  - `.agents/skills/my-skill/SKILL.md` с содержимым `"---\nname: my-skill\n---\nSkill body"`.
  - `.agents/skills/my-skill/helpers/util.ts` с содержимым `"export const x = 1;"`.
- Адаптеры: `[ClaudeSkillAdapter]`.

**Поведение:**

1. Создать экземпляр транспилера через `createSkillsTranspiler`.
2. Вызвать `transpiler.transpile()`.
3. Вызвать `transpiler.writeResults(results)`.
4. Проверить, что `writeResult.errors` — пустой массив.
5. Прочитать файл `.claude/skills/my-skill/SKILL.md` из `tmpDir`.
6. Проверить, что содержимое файла `.claude/skills/my-skill/SKILL.md`
   побайтово совпадает с содержимым `.agents/skills/my-skill/SKILL.md`.
7. Прочитать файл `.claude/skills/my-skill/helpers/util.ts` из `tmpDir`.
8. Проверить, что содержимое файла `.claude/skills/my-skill/helpers/util.ts`
   побайтово совпадает с содержимым `.agents/skills/my-skill/helpers/util.ts`.

**Расширения:**

Нет расширений.

**Результат:**

`writeResult.written` содержит `".claude/skills/my-skill/SKILL.md"`
и `".claude/skills/my-skill/helpers/util.ts"`.

### IT-SKILL-02: Pipeline с несколькими skill-пакетами

Проверяет, что несколько skill-пакетов обрабатываются за один вызов.

**Вход:**

- `tmpDir` содержит:
  - `.agents/skills/alpha/SKILL.md` с содержимым `"alpha skill"`.
  - `.agents/skills/beta/SKILL.md` с содержимым `"beta skill"`.
- Адаптеры: `[ClaudeSkillAdapter]`.

**Поведение:**

1. Создать экземпляр транспилера через `createSkillsTranspiler`.
2. Вызвать `transpiler.transpile()`.
3. Вызвать `transpiler.writeResults(results)`.
4. Проверить, что `writeResult.errors` — пустой массив.
5. Прочитать файл `.claude/skills/alpha/SKILL.md` из `tmpDir`.
6. Проверить, что содержимое файла `.claude/skills/alpha/SKILL.md`
   побайтово совпадает с содержимым `.agents/skills/alpha/SKILL.md`.
7. Прочитать файл `.claude/skills/beta/SKILL.md` из `tmpDir`.
8. Проверить, что содержимое файла `.claude/skills/beta/SKILL.md`
   побайтово совпадает с содержимым `.agents/skills/beta/SKILL.md`.

**Расширения:**

Нет расширений.

**Результат:**

`writeResult.written` содержит `".claude/skills/alpha/SKILL.md"`
и `".claude/skills/beta/SKILL.md"`.

### IT-SKILL-03: Pipeline с OpenCode адаптером (no-op)

Проверяет, что OpenCode адаптер не создаёт файлов для skills.

**Вход:**

- `tmpDir` содержит:
  - `.agents/skills/my-skill/SKILL.md` с содержимым `"skill content"`.
- Адаптеры: `[OpenCodeSkillAdapter]`.

**Поведение:**

1. Создать экземпляр транспилера через `createSkillsTranspiler`.
2. Вызвать `transpiler.transpile()`.
3. Вызвать `transpiler.writeResults(results)`.
4. Проверить, что `writeResult.errors` — пустой массив.
5. Проверить, что `writeResult.written` — пустой массив.
6. Проверить, что каталог `.claude/skills/` НЕ существует в `tmpDir`.

**Расширения:**

Нет расширений.

**Результат:**

`writeResult.written` — пустой массив; никакие agent-specific файлы
не созданы на диске.

### IT-SKILL-04: Pipeline при отсутствии каталога .agents/skills/

Проверяет, что pipeline корректно завершается при отсутствии
каталога `.agents/skills/`.

**Вход:**

- `tmpDir` — пустая директория (каталог `.agents/skills/`
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
  - `.agents/agents/reviewer.md` со следующим содержимым:

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
  - `.agents/agents/reviewer.md` — тот же файл, что в IT-AGENT-01.
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
  - `.agents/agents/reviewer.md` — тот же файл, что в IT-AGENT-01.
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

Проверяет, что несколько `.md` файлов из `.agents/agents/`
обрабатываются за один вызов.

**Вход:**

- `tmpDir` содержит:
  - `.agents/agents/reviewer.md` со следующим содержимым:
    ```
    ---
    name: reviewer
    model: sonnet
    ---
    Reviewer instructions.
    ```
  - `.agents/agents/coder.md` со следующим содержимым:
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

### IT-AGENT-05: Pipeline при отсутствии каталога .agents/agents/

Проверяет, что pipeline корректно завершается при отсутствии
каталога `.agents/agents/`.

**Вход:**

- `tmpDir` — пустая директория (каталог `.agents/agents/`
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
  - `.agents/agents/simple.md` со следующим содержимым:
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

## Вне scope

Следующие аспекты НЕ ВХОДЯТ в scope данной спецификации:

- E2E тесты CLI (тестирование бинарника через shell).
- Тесты error paths (покрыты unit-тестами соответствующих модулей).
- Performance тесты и бенчмарки.
- Тесты watch mode.
- Тесты конкурентного доступа к файловой системе.
