---
type: research
summary: Карта возможностей целевых AI-агентов для CLI
description: >
  Систематический анализ возможностей project-level конфигурации четырёх целевых
  AI-агентов (Claude Code, Codex CLI, Gemini CLI, OpenCode) для проектирования
  канонического формата Agent SDS.
relates:
  - .claude/docs/cycling/agent-protocol.md
  - docs/specs/instructions-transpiler.md
---

# Исследование: карта возможностей целевых AI-агентов для CLI

**Дата:** 2026-03-25

## Контекст исследования

### Проблема

Разработчики, использующие несколько AI-агентов для CLI (Claude Code, Codex CLI,
Gemini CLI, OpenCode/KiloCode), вынуждены поддерживать независимые конфигурации
для каждого инструмента. Каждый агент определяет собственные форматы, соглашения об
именовании файлов и структуру каталогов. Это приводит к дублированию инструкций,
рассогласованности настроек между агентами и увеличению стоимости онбординга.

### Мотивация

Agent SDS — CLI-инструмент (Node.js/TypeScript/Ink), предоставляющий единый
канонический формат для конфигурации AI-агентов. Канонический формат транслируется
в agent-specific конфигурации через систему адаптеров. Для проектирования этого
формата необходима точная карта возможностей каждого целевого агента.

### Цель

Получить актуальную карту возможностей каждого целевого агента по следующим аспектам:
структура конфигурации, инструкции, команды, навыки, суб-агенты и MCP-интеграция.
На основе карты — сформулировать рекомендации для канонического формата и определить
список агентов, прошедших минимальный порог для MVP.

### Границы

- **В scope**: project-level конфигурация (файлы в репозитории).
- **Вне scope**: глобальные настройки (`~/.claude/`, `~/.codex/`, `~/.gemini/`,
  `~/.config/opencode/`), executable hooks, tool permissions, IDE-специфичные интеграции.
- **Вне scope**: KiloCode VS Code extension рассматривается только в части CLI-интерфейса,
  который основан на OpenCode.

## Критерии оценки

Критерии определены до начала анализа объектов (защита от anchoring bias).

| #   | Критерий                | Определение                                                                            |
| --- | ----------------------- | -------------------------------------------------------------------------------------- |
| C1  | Конфигурационная модель | Наличие project-level каталога, формат файлов, иерархия (project → directory)          |
| C2  | Инструкции агенту       | Поддержка markdown-инструкций, иерархическая загрузка, модульность (import/rules)      |
| C3  | Команды                 | Определение пользовательских slash-команд на уровне проекта                            |
| C4  | Навыки (Skills)         | Определение переиспользуемых поведенческих паттернов с SKILL.md                        |
| C5  | Суб-агенты              | Определение специализированных агентов с изолированным контекстом и ограничением tools |
| C6  | MCP-интеграция          | Конфигурация MCP-серверов на уровне проекта                                            |
| C7  | Расширяемость           | Наличие механизмов для agent-specific расширений (extensions, plugins, profiles)       |
| C8  | Зрелость экосистемы     | Документированность, стабильность API, активность сообщества, количество пользователей |

## Объекты анализа

### 1. Claude Code (Anthropic)

#### Общая характеристика

Claude Code — CLI-агент от Anthropic, устанавливаемый через `npm install -g @anthropic-ai/claude-code`.
Использует модели Claude (Sonnet, Opus, Haiku). По состоянию на март 2026 занимает
лидирующую позицию на SWE-bench Verified (80.8% с Opus 4.6).

#### C1. Конфигурационная модель

Project-level каталог `.claude/` содержит полную структуру конфигурации:

```text
project-root/
├── CLAUDE.md                    # Shared project instructions (git-tracked)
├── CLAUDE.local.md              # Personal instructions (.gitignore)
├── .mcp.json                    # Shared MCP config (git-tracked)
└── .claude/
    ├── settings.json            # Project shared settings (git-tracked)
    ├── settings.local.json      # Project personal settings (.gitignore)
    ├── rules/                   # Modular rules (git-tracked)
    │   └── *.md
    ├── commands/                # Custom slash commands (git-tracked)
    │   └── *.md
    ├── skills/                  # Reusable skills (git-tracked)
    │   └── <name>/SKILL.md
    └── agents/                  # Sub-agent definitions (git-tracked)
        └── *.md
```

Формат конфигурации: JSON для `settings.json` и `.mcp.json`, Markdown для всех
остальных компонентов. Разделение на shared (git-tracked) и local (.gitignore)
файлы встроено в архитектуру.

#### C2. Инструкции агенту

Основной файл — `CLAUDE.md` в корне проекта. При отсутствии `CLAUDE.md`
читается `AGENTS.md` как fallback. Иерархия загрузки:

1. `~/.claude/CLAUDE.md` — глобальные инструкции.
2. `CLAUDE.md` (или `.claude/CLAUDE.md`) — project-level инструкции.
3. Directory-level `CLAUDE.md` — загружаются on demand при работе с файлами
   в соответствующих каталогах (lazy loading).

Модульность реализована через `.claude/rules/*.md`. Правила поддерживают
path-scoping через frontmatter:

```yaml
---
paths:
  - "src/api/**/*.ts"
---
# API-specific rules loaded only when working with matching files
```

Поддержка импорта через `@path/to/file` синтаксис (максимальная глубина — 5 уровней).
Личные инструкции — `CLAUDE.local.md`.

#### C3. Команды

Пользовательские slash-команды определяются как Markdown-файлы:

- **Project-level**: `.claude/commands/*.md` → `/project:<name>`.
- **Personal**: `~/.claude/commands/*.md` → `/user:<name>`.

Команды поддерживают параметры: `$ARGUMENTS` (все аргументы), `$ARGUMENTS[N]`
или `$N` (позиционные, 0-based). Динамическая инъекция через `` !`command` ``
(выполнение shell-команды). Официально commands объединены со Skills — файл в
`.claude/commands/deploy.md` и skill в `.claude/skills/deploy/SKILL.md` оба создают
`/deploy` (skill имеет приоритет при совпадении имён).

#### C4. Навыки (Skills)

Skills определяются в `.claude/skills/<name>/SKILL.md` с YAML frontmatter:

```yaml
---
name: skill-name
description: When to trigger this skill
context: fork # optional: isolated execution
agent: general-purpose # optional: specific subagent type
---
Instructions for the skill...
```

Ключевые особенности:

- Автоматическая активация на основе описания (description matching).
- Поддержка `context: fork` для выполнения в изолированном контексте.
- Skills — это пакеты с поддержкой вложенных файлов (через `@reference` синтаксис).
- Унификация с commands: `.claude/commands/deploy.md` и `.claude/skills/deploy/SKILL.md`
  оба создают команду `/deploy`.

#### C5. Суб-агенты

Определяются в `.claude/agents/*.md` с YAML frontmatter:

```yaml
---
name: code-reviewer
model: sonnet
description: Reviews code for best practices
tools:
  - Read
  - Grep
  - Glob
---
System prompt for the agent...
```

Каждый агент работает в изолированном контексте. Ключевые поля frontmatter:

| Поле              | Описание                                          |
| ----------------- | ------------------------------------------------- |
| `name`            | Уникальный идентификатор                          |
| `description`     | Когда делегировать задачу этому агенту            |
| `model`           | `sonnet`, `opus`, `haiku` или полный ID модели    |
| `tools`           | Allowlist инструментов (по умолчанию — все)       |
| `disallowedTools` | Denylist (удаляет из inherited/specified)         |
| `permissionMode`  | `default`, `acceptEdits`, `dontAsk`, `plan`       |
| `maxTurns`        | Лимит агентных итераций                           |
| `mcpServers`      | Inline MCP-серверы, доступные только этому агенту |
| `skills`          | Предзагруженные skills                            |
| `memory`          | Persistent memory: `user`, `project`, `local`     |
| `isolation`       | `worktree` — выполнение в отдельном git worktree  |

#### C6. MCP-интеграция

Конфигурируется в `.mcp.json` в корне проекта (git-tracked):

```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@example/mcp-server"],
      "env": { "API_KEY": "..." }
    }
  }
}
```

Поддерживает stdio и HTTP транспорты (SSE — deprecated). Environment variable
expansion: `${VAR}` или `${VAR:-default}`. Inline MCP-серверы могут быть
определены в frontmatter суб-агентов.

#### C7. Расширяемость

Встроенная система правил (`.claude/rules/`), поддержка множественных skills и agents.
Нет формального понятия extensions или plugins. Расширение происходит через
добавление файлов в соответствующие каталоги.

#### C8. Зрелость экосистемы

Высокая зрелость: обширная документация, стабильный API конфигурации,
многомиллионная пользовательская база. Формат SKILL.md стал де-факто стандартом,
принятым другими агентами. Подписочная модель обеспечивает предсказуемые расходы.

#### Плюсы

- Наиболее полная и структурированная система project-level конфигурации.
- Чёткое разделение shared/local файлов на уровне архитектуры.
- Формат SKILL.md стал отраслевым стандартом (принят Codex CLI, Gemini CLI, OpenCode).
- Богатая система суб-агентов с изоляцией контекста и ограничением инструментов.

#### Минусы

- Основной файл инструкций — `CLAUDE.md` (проприетарное имя); `AGENTS.md`
  поддерживается только как fallback при отсутствии `CLAUDE.md`.
- MCP-конфигурация вынесена в отдельный файл (`.mcp.json`), а не интегрирована
  в общий settings.
- Отсутствие формального extension/plugin механизма — расширение только через
  файловую систему.
- Привязка к экосистеме Anthropic (модели Claude).

---

### 2. Codex CLI (OpenAI)

#### Общая характеристика

Codex CLI — open-source CLI-агент от OpenAI, устанавливаемый через
`npm install -g @openai/codex`. Использует модели GPT/Codex (GPT-5-Codex, GPT-4.1).
Строгая песочница по умолчанию. Требует платный аккаунт OpenAI с верификацией.

#### C1. Конфигурационная модель

Project-level каталог `.codex/` с TOML-конфигурацией:

```text
project-root/
├── AGENTS.md                    # Project instructions (git-tracked)
├── AGENTS.override.md           # Instruction overrides
└── .codex/
    ├── config.toml              # Project configuration (trusted only)
    ├── AGENTS.md                # Alternative location for instructions
    ├── agents/                  # Sub-agent definitions
    │   └── *.toml
    └── rules/                   # Custom rules
        └── *.md
```

Формат конфигурации: TOML для `config.toml` и определений агентов, Markdown
для инструкций и правил. Codex загружает project config только для доверенных
проектов (trust model). Поддерживается walkup-поиск: от текущей директории
к корню проекта, ближайший файл побеждает.

#### C2. Инструкции агенту

Основной файл — `AGENTS.md` в корне проекта (стандарт, принятый индустрией).
Система приоритетов:

1. `~/.codex/AGENTS.md` — глобальные инструкции.
2. `~/.codex/AGENTS.override.md` — приоритет над AGENTS.md.
3. `AGENTS.md` или `.codex/AGENTS.md` — project-level.
4. Конфигурируемые fallback-имена через `project_doc_fallback_filenames`.

Поддержка `model_instructions_file` в config.toml для полной замены встроенного
поведения. Настраиваемый лимит размера через `project_doc_max_bytes`.

#### C3. Команды

Встроенные slash-команды: `/model`, `/review`, `/diff`, `/agent`, `/tools`,
`/permissions`, `/fast`, `/status`. Пользовательские project-level
slash-команды не поддерживаются как отдельная система файлов.
Функциональность пользовательских команд покрывается через Skills.

#### C4. Навыки (Skills)

Codex принял формат SKILL.md, идентичный Claude Code. Функциональность
доступна через feature flag (`codex --enable skills`).

Project-level размещение — **`.agents/skills/`** (cross-agent portable path):

```text
.agents/skills/<name>/SKILL.md    # project-level (primary)
~/.agents/skills/<name>/SKILL.md  # personal user skills
/etc/codex/skills/<name>/SKILL.md # system admin skills
```

Скан по нескольким путям с приоритетом (CWD → parent → repo root → user → admin → system).
Поддержка опционального `agents/openai.yaml` для UI-метаданных и зависимостей.
Включение/отключение через config.toml: `[[skills.config]]`.

#### C5. Суб-агенты

Определяются в `.codex/agents/*.toml` (TOML-формат, в отличие от Markdown у Claude Code):

```toml
name = "security-auditor"
description = "Audits code for security vulnerabilities"
developer_instructions = """
You are a security auditor. Focus on:
- SQL injection
- XSS vulnerabilities
- Authentication bypass
"""

# Optional overrides
model = "gpt-4.1"
sandbox_mode = "read-only"
nickname_candidates = ["sec-bot", "auditor"]
```

Глобальные настройки агентов:

```toml
[agents]
max_threads = 6        # Concurrent agent limit
max_depth = 1          # Nesting depth
job_max_runtime_seconds = 1800
```

Поддержка переопределения MCP-серверов и skills на уровне агента.

#### C6. MCP-интеграция

Конфигурируется в `config.toml` (как в global, так и в project-scoped):

```toml
[mcp_servers.jira]
command = "npx"
args = ["-y", "@example/mcp-jira"]
env = { JIRA_TOKEN = "..." }
enabled = true
startup_timeout_sec = 10
tool_timeout_sec = 60
enabled_tools = ["search_issues", "create_issue"]
disabled_tools = ["delete_issue"]
```

Поддерживает фильтрацию инструментов (`enabled_tools` / `disabled_tools`),
таймауты, и опцию `required = false` для необязательных серверов.

#### C7. Расширяемость

Profiles: `[profiles.<name>]` в config.toml позволяют переключаться между
конфигурациями (`codex --profile <name>`). Admin-level `requirements.toml`
для ограничений на уровне организации. Feature flags через `[features]`.

#### C8. Зрелость экосистемы

Open-source (GitHub). Документация на developers.openai.com — обширная и структурированная.
TOML-формат обеспечивает строгую типизацию конфигурации с JSON Schema валидацией.
Привязка к экосистеме OpenAI (модели GPT/Codex). Верификация аккаунта (ID + facial
recognition) — барьер для входа.

#### Плюсы

- Поддержка стандарта `AGENTS.md` из коробки.
- Строгая trust model: project config загружается только для доверенных проектов.
- TOML-конфигурация с JSON Schema — строгая типизация и валидация.
- Granular MCP control: `enabled_tools`, `disabled_tools`, таймауты, `required` flag.
- Profiles для переключения между конфигурациями.
- Admin-level `requirements.toml` для корпоративных ограничений.

#### Минусы

- Нет нативных project-level slash-команд (покрывается через Skills).
- TOML-формат для агентов отличается от Markdown-стандарта (Claude Code, Gemini CLI, OpenCode).
- Высокий барьер входа: верификация аккаунта, предоплата credits.
- Менее зрелая система skills по сравнению с Claude Code (принято позже).

---

### 3. Gemini CLI (Google)

#### Общая характеристика

Gemini CLI — open-source CLI-агент от Google (`google-gemini/gemini-cli` на GitHub).
Использует модели Gemini (Pro, Flash). Контекстное окно до 1M токенов.
Более миллиона разработчиков по состоянию на начало 2026.

#### C1. Конфигурационная модель

Project-level каталог `.gemini/` с JSON-конфигурацией:

```text
project-root/
├── GEMINI.md                    # Project context (git-tracked)
└── .gemini/
    ├── settings.json            # Project settings (git-tracked)
    ├── commands/                # Custom slash commands
    │   └── *.toml
    ├── skills/                  # Agent skills
    │   └── <name>/SKILL.md
    ├── agents/                  # Sub-agents (experimental)
    │   └── *.md
    └── sandbox.Dockerfile       # Custom sandbox image
```

Расширения (extensions) устанавливаются в `~/.gemini/extensions/` и могут содержать
commands, skills, agents, MCP servers, hooks, policies и themes.

Иерархия настроек (от низшего к высшему приоритету): defaults → system defaults →
user settings → project settings → system settings → env vars → CLI args.

#### C2. Инструкции агенту

Основной файл — `GEMINI.md` (имя конфигурируемо через `context.fileName`).
Иерархическая загрузка:

1. `~/.gemini/GEMINI.md` — глобальный контекст.
2. Ancestor directories — от текущей директории к корню проекта.
3. Subdirectories — сканирование подкаталогов (лимит — 200, конфигурируемо).

Поддержка импорта через `@path/to/file.md` синтаксис для модуляризации.
Команды `/memory show` и `/memory refresh` для управления загруженным контекстом.
Команда `/init` для генерации начального `GEMINI.md`.

#### C3. Команды

Пользовательские slash-команды определяются как TOML-файлы:

- **Project-level**: `.gemini/commands/*.toml`.
- **Extension-level**: `extensions/<name>/commands/*.toml`.
- **Nested**: вложенные каталоги определяют namespace (`commands/gcs/sync.toml` → `/gcs:sync`).

Приоритет: project commands > user commands > extension commands (при конфликте
extension command получает префикс `/extension-name.command-name`).

#### C4. Навыки (Skills)

Принят формат SKILL.md, совместимый с Claude Code и Codex CLI:

```text
.gemini/skills/<name>/SKILL.md
.agents/skills/<name>/SKILL.md    # cross-agent portable path
~/.gemini/skills/<name>/SKILL.md  # personal
```

Lazy-loading: при старте загружаются только `name` и `description` из frontmatter.
Полные инструкции загружаются в контекст только при активации (`activate_skill` tool).
Это экономит токены и улучшает точность ответов.

Skills также могут быть частью extensions, устанавливаемых через
`gemini extensions install`.

#### C5. Суб-агенты

Статус: **экспериментальный (preview)**. Определяются в `.gemini/agents/*.md`:

```yaml
---
name: security-reviewer
description: Reviews code for security issues
model: gemini-2.5-pro
tools:
  - read_file
  - search_code
  - mcp_* # wildcard: all MCP tools
---
System prompt for the agent...
```

Поддержка wildcard-синтаксиса для tools (`*`, `mcp_*`, `mcp_server-name_*`).
Вызов через `@agent-name` синтаксис или автоматическая делегация.

#### C6. MCP-интеграция

Конфигурируется в `.gemini/settings.json` под ключом `mcpServers`:

```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@example/mcp-server"],
      "env": { "API_KEY": "..." },
      "trust": true,
      "includeTools": ["tool1"],
      "excludeTools": ["tool2"],
      "timeout": 30000
    }
  }
}
```

Поддерживает stdio, SSE (`url`), и HTTP streaming (`httpUrl`) транспорты.
Фильтрация инструментов через `includeTools`/`excludeTools`. Опция `trust`
для bypass подтверждений.

#### C7. Расширяемость

**Extensions** — ключевое отличие Gemini CLI. Каждый extension — пакет
с `gemini-extension.json`, объединяющий commands, MCP servers, context,
skills, agents, hooks, policies и themes.

Установка: `gemini extensions install <github-url>`. Более 70 extensions доступны
в галерее, включая интеграции от Figma, Shopify, Stripe и других.

Variable substitution: `${extensionPath}`, `${workspacePath}`, `${/}`.

#### C8. Зрелость экосистемы

Open-source (GitHub: `google-gemini/gemini-cli`). Активная экосистема extensions.
Бесплатный tier с Google аккаунтом. Суб-агенты в статусе preview — API может измениться.
Gemini CLI v0.23.0 (январь 2026) — обновлённый формат settings.json.

#### Плюсы

- Наиболее развитая система extensions — модульные пакеты с commands, MCP, skills,
  agents, hooks, policies и themes.
- Конфигурируемое имя файла инструкций (`context.fileName`) — гибкость адаптации.
- Импорт-синтаксис (`@path/to/file.md`) для модуляризации контекста.
- Lazy-loading skills — оптимизация расхода токенов.
- Бесплатный tier и наибольшее контекстное окно (1M токенов).

#### Минусы

- Суб-агенты в статусе **experimental/preview** — API нестабилен.
- Проприетарное имя файла инструкций (`GEMINI.md`) вместо стандарта `AGENTS.md`.
- Команды в формате TOML, а не Markdown — несовместимы с Claude Code/Codex CLI.
- Extensions — только на уровне пользователя (`~/.gemini/extensions/`),
  нет project-level extensions.
- Сложность настройки для Google Workspace аккаунтов (GCP, API keys).

---

### 4. OpenCode / KiloCode

#### Общая характеристика

OpenCode — open-source Go-based CLI-агент с TUI-интерфейсом
(`anomalyco/opencode` на GitHub, 130 000+ stars, 650 000+ MAU).
KiloCode — VS Code extension (эволюция Roo Code / Cline), CLI-версия которого
является форком OpenCode. 1.5M+ пользователей KiloCode. Поддерживает множество
провайдеров: OpenAI, Anthropic, Google, AWS Bedrock, Groq, Azure OpenAI, OpenRouter.

Для целей данного исследования OpenCode и KiloCode CLI рассматриваются как единая
экосистема, поскольку KiloCode CLI использует OpenCode в качестве runtime.

#### C1. Конфигурационная модель

Project-level конфигурация через `opencode.json` и `.opencode/` каталог:

```text
project-root/
├── AGENTS.md                    # Project instructions (git-tracked)
├── opencode.json                # Project configuration
└── .opencode/
    ├── agents/                  # Agent definitions
    │   └── *.md
    ├── commands/                # Custom commands
    ├── skills/                  # Agent skills
    │   └── <name>/SKILL.md
    ├── modes/                   # Modes
    ├── plugins/                 # Plugins
    ├── tools/                   # Custom tools
    └── themes/                  # UI themes
```

Для KiloCode CLI: `~/.config/kilo/opencode.json` (глобальный),
`./opencode.json` (проект). Дополнительно KiloCode использует:

- `.kilocode/rules/*.md` — правила проекта.
- `.kilocodemodes` (YAML/JSON) — определения пользовательских режимов.
- `.kilocode/rules-{mode}/` — mode-specific правила.

Формат: JSON/JSONC для конфигурации, Markdown для агентов/skills/инструкций,
YAML для режимов KiloCode.

#### C2. Инструкции агенту

Основной файл — `AGENTS.md` в корне проекта (стандарт). При отсутствии —
fallback на `CLAUDE.md` (кросс-совместимость с Claude Code, отключается
через `OPENCODE_DISABLE_CLAUDE_CODE_PROMPT`).

Дополнительные инструкции конфигурируются через массив `instructions` в opencode.json
с поддержкой glob-паттернов и remote URLs:

```json
{
  "instructions": [
    "CONTRIBUTING.md",
    "docs/guidelines.md",
    ".cursor/rules/*.md",
    "https://raw.githubusercontent.com/org/shared-rules/main/style.md"
  ]
}
```

KiloCode дополнительно поддерживает:

- `.kilocode/rules/*.md` — правила проекта (рекомендуемый подход).
- `.kilocode/rules-{mode}/` — mode-specific правила.
- `~/.kilocode/rules/` — глобальные правила.
- Приоритет (от высшего к низшему): mode-specific rules → custom rules → AGENTS.md
  → global rules → IDE custom instructions.

Команда `/init` генерирует начальный `AGENTS.md` на основе анализа кодовой базы.

#### C3. Команды

Два механизма определения:

1. **Markdown-файлы** в `.opencode/commands/*.md` (project) с YAML frontmatter
   и плейсхолдерами (`$ARGUMENTS`, `$1`–`$9`, `` !`command` ``, `@filename`).
2. **JSON** в `opencode.json` под ключом `command`:

```json
{
  "command": {
    "test": {
      "template": "Run the full test suite and report results",
      "description": "Run tests with coverage",
      "agent": "build",
      "model": "anthropic/claude-haiku-4-5"
    }
  }
}
```

KiloCode использует отдельный каталог `.kilocode/workflows/*.md` для команд.

#### C4. Навыки (Skills)

Принят формат SKILL.md, совместимый с другими агентами:

```text
.opencode/skills/<name>/SKILL.md   # OpenCode project-level
.agents/skills/<name>/SKILL.md     # cross-agent portable path
.kilocode/skills/<name>/SKILL.md   # KiloCode project-level
.kilocode/skills-{mode}/<name>/    # KiloCode mode-specific skills
```

Skills загружаются on-demand: при старте в контекст попадают только `name`
и `description`, полные инструкции загружаются при активации (аналогично
lazy-loading в Gemini CLI). OpenCode также сканирует `.claude/skills/`
для кросс-совместимости.

#### C5. Суб-агенты

Определяются в `.opencode/agents/*.md` (Markdown) или в `opencode.json` (JSON):

**Markdown-формат** (`.opencode/agents/code-reviewer.md`):

```yaml
---
description: Reviews code for best practices
mode: subagent
model: anthropic/claude-sonnet-4-5
temperature: 0.1
---
System prompt for the agent...
```

**JSON-формат** (в `opencode.json`):

```json
{
  "agent": {
    "code-reviewer": {
      "mode": "primary|subagent",
      "description": "Reviews code for best practices",
      "model": "anthropic/claude-sonnet-4-5",
      "temperature": 0.1,
      "prompt": "{file:./prompts/reviewer.txt}",
      "permission": {
        "edit": "deny",
        "bash": "ask"
      }
    }
  }
}
```

Встроенные агенты: **build** (full access), **plan** (read-only),
**general** (subagent, full access), **explore** (subagent, read-only).

Вызов: Tab для переключения primary agents, `@agent-name` для subagents.
Интерактивное создание: `opencode agent create`.

KiloCode дополнительно поддерживает **Custom Modes** в `.kilocodemodes` (YAML):

```yaml
- slug: docs-writer
  name: "Documentation Writer"
  description: "Writes technical documentation"
  roleDefinition: "You are a technical writer..."
  groups:
    - read
    - - edit
      - fileRegex: \.(md|mdx)$
    - browser
```

#### C6. MCP-интеграция

Конфигурируется в `opencode.json` под ключом `mcp`:

```json
{
  "mcp": {
    "jira": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@example/mcp-jira"],
      "env": { "JIRA_TOKEN": "..." }
    },
    "remote-service": {
      "type": "remote",
      "url": "https://service.example.com/mcp",
      "enabled": true
    }
  }
}
```

Поддерживает stdio и remote (SSE/HTTP) транспорты.

#### C7. Расширяемость

- **Plugins**: конфигурируются через `plugin` массив в opencode.json.
- **Modes**: `.opencode/modes/` или `.kilocodemodes`.
- **Themes**: `.opencode/themes/`.
- **Tools**: `.opencode/tools/` — кастомные инструменты.
- **Variable substitution**: `{env:VAR_NAME}`, `{file:path/to/file}`.
- **Multi-provider**: поддержка любого LLM провайдера через единый конфиг.

#### C8. Зрелость экосистемы

Open-source (MIT License). Активное развитие, большое сообщество.
Multi-provider архитектура — не привязан к одному вендору. KiloCode CLI
наследует возможности OpenCode. Однако KiloCode CLI имеет известные проблемы:
custom modes из `.kilocodemodes` не сканируются для rule directories (hardcoded
`KNOWN_MODES` list), mode-specific rules применяются ко всем агентам.

#### Плюсы

- Поддержка стандарта `AGENTS.md` из коробки.
- Multi-provider: единственный агент, не привязанный к конкретному LLM-вендору.
- Два формата определения агентов (Markdown и JSON) — гибкость.
- Granular permissions с glob-паттернами для bash-команд.
- Наиболее широкая файловая структура: agents, commands, skills, modes, plugins,
  tools, themes.
- Open-source MIT License — нет вендорного lock-in.

#### Минусы

- Экосистема менее зрелая, чем у Claude Code или Gemini CLI.
- Известные баги в KiloCode: mode-specific rules применяются ко всем агентам,
  custom modes не интегрированы с rule discovery.
- Конфигурация разделена между `opencode.json` (JSON) и `.kilocodemodes` (YAML) —
  два формата для одного проекта.
- Документация фрагментирована между OpenCode и KiloCode (два сайта, частичное
  перекрытие).

---

## Сравнительная таблица

### Матрица возможностей (feature × agent)

| Возможность                    | Claude Code         | Codex CLI            | Gemini CLI               | OpenCode/KiloCode     |
| ------------------------------ | ------------------- | -------------------- | ------------------------ | --------------------- |
| **Project-level каталог**      | `.claude/`          | `.codex/`            | `.gemini/`               | `.opencode/`          |
| **Формат конфигурации**        | JSON                | TOML                 | JSON                     | JSON/JSONC            |
| **Инструкции (файл)**          | `CLAUDE.md`         | `AGENTS.md`          | `GEMINI.md`              | `AGENTS.md`           |
| **Иерархия инструкций**        | global→project→dir  | global→project       | global→project→subdir    | global→project        |
| **Модульные правила**          | `.claude/rules/`    | `.codex/rules/`      | `@import` синтаксис      | `.kilocode/rules/`    |
| **Slash-команды (project)**    | `.claude/commands/` | нет (через Skills)   | `.gemini/commands/`      | `opencode.json`       |
| **Формат команд**              | Markdown            | —                    | TOML                     | JSON template         |
| **Skills (SKILL.md)**          | `.claude/skills/`   | `.agents/skills/`    | `.gemini/skills/`        | `.opencode/skills/`   |
| **Auto-invocation skills**     | да                  | да                   | да (lazy-loading)        | да                    |
| **Суб-агенты**                 | `.claude/agents/`   | `.codex/agents/`     | `.gemini/agents/`        | `.opencode/agents/`   |
| **Формат агентов**             | Markdown+YAML FM    | TOML                 | Markdown+YAML FM         | Markdown+YAML FM/JSON |
| **Статус суб-агентов**         | стабильный          | GA (март 2026)       | experimental/preview     | стабильный            |
| **Tool restrictions (agents)** | список tools        | наследует config     | wildcards (`mcp_*`)      | permission object     |
| **MCP project-level**          | `.mcp.json`         | `.codex/config.toml` | `.gemini/settings.json`  | `opencode.json`       |
| **MCP tool filtering**         | нет                 | enabled/disabled     | include/exclude          | нет                   |
| **Extensions/Plugins**         | нет                 | profiles             | extensions (70+)         | plugins               |
| **Trust model**                | нет                 | да (trust/untrust)   | folder trust             | нет                   |
| **Multi-provider**             | нет (Claude only)   | нет (OpenAI only)    | нет (Gemini only)        | да (любой провайдер)  |
| **AGENTS.md стандарт**         | fallback            | да                   | через `context.fileName` | да                    |
| **Cross-agent portable path**  | нет                 | `.agents/skills/`    | `.agents/skills/`        | `.agents/skills/`     |
| **Лицензия**                   | проприетарный       | open-source          | open-source              | MIT                   |

### Матрица MVP-критериев

| Критерий MVP               | Claude Code  | Codex CLI |  Gemini CLI  | OpenCode/KiloCode |
| -------------------------- | :----------: | :-------: | :----------: | :---------------: |
| Commands (или эквивалент)  |      ✅      | ⚠️ Skills |      ✅      |        ✅         |
| MCP project-level          |      ✅      |    ✅     |      ✅      |        ✅         |
| Agents (суб-агенты)        |      ✅      |    ✅     |  ⚠️ preview  |        ✅         |
| Skills (SKILL.md)          |      ✅      |    ✅     |      ✅      |        ✅         |
| AGENTS.md (или эквивалент) | ✅ CLAUDE.md |    ✅     | ✅ GEMINI.md |        ✅         |
| **Проходит MVP?**          |    **да**    |  **да**   |    **да**    |      **да**       |

## Ключевые паттерны

### Конвергенция форматов

Индустрия демонстрирует конвергенцию к общим форматам:

1. **SKILL.md** — формат, предложенный Anthropic (конец 2025), принят всеми
   четырьмя агентами. YAML frontmatter (`name`, `description`) + Markdown body.
   Cross-agent portable path: `.agents/skills/`.

2. **AGENTS.md** — стандарт, предложенный Sourcegraph/Amp (июль 2025), принят
   Codex CLI, OpenCode, KiloCode как основной файл. Claude Code поддерживает
   `AGENTS.md` как fallback при отсутствии `CLAUDE.md`. Gemini CLI позволяет
   настроить чтение `AGENTS.md` через `context.fileName`. Формат (plain Markdown)
   идентичен у всех агентов.

3. **Markdown + YAML frontmatter** — де-факто стандарт для определения агентов
   (Claude Code, Gemini CLI, OpenCode). Codex CLI — исключение (TOML).

### Расхождения

1. **Имя файла инструкций**: `CLAUDE.md` vs `AGENTS.md` vs `GEMINI.md` —
   три разных основных имени для одной концепции. Все агенты способны читать
   `AGENTS.md` (как основной, fallback или через конфигурацию), однако
   предпочтительный файл различается.

2. **Формат конфигурации**: JSON (Claude Code, Gemini CLI, OpenCode) vs TOML
   (Codex CLI) vs YAML (KiloCode modes).

3. **Формат команд**: Markdown (Claude Code) vs TOML (Gemini CLI) vs JSON template
   (OpenCode) — нет единого стандарта.

4. **MCP-размещение**: отдельный файл (`.mcp.json` — Claude Code) vs внутри общего
   конфига (Codex CLI, Gemini CLI, OpenCode).

### Архитектурные паттерны для канонического формата

1. **Dot-directory pattern**: все агенты используют `.<agent>/` каталог в корне
   проекта. Канонический формат СЛЕДУЕТ использовать аналогичный паттерн
   (например, `.agent-sds/` или `.agents/`).

2. **Shared / Local separation**: Claude Code чётко разделяет `settings.json` /
   `settings.local.json` и `CLAUDE.md` / `CLAUDE.local.md`. Этот паттерн
   СЛЕДУЕТ воспроизвести в каноническом формате.

3. **Hierarchical context loading**: Claude Code и Gemini CLI поддерживают
   directory-level инструкции. Канонический формат МОЖЕТ поддерживать
   hierarchical loading, но это увеличивает сложность трансляции.

4. **Cross-agent portable paths**: `.agents/skills/` уже используется как
   межагентный путь для skills. Канонический формат СЛЕДУЕТ использовать
   `.agents/` как portable namespace.

## Заключение

### Все четыре агента проходят MVP-порог

Все четыре целевых агента (Claude Code, Codex CLI, Gemini CLI, OpenCode/KiloCode)
поддерживают минимальный набор возможностей для включения в MVP: инструкции
на уровне проекта, MCP-интеграцию, суб-агентов и skills. Codex CLI компенсирует
отсутствие нативных project-level команд через Skills. Gemini CLI имеет суб-агентов
в статусе preview, однако формат определения стабилен и совместим с другими агентами.

### Рекомендации по каноническому формату

1. **Инструкции**: канонический формат СЛЕДУЕТ генерировать агент-специфичные
   файлы (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`) из единого источника.
   Источником СЛЕДУЕТ быть Markdown-файлу без привязки к имени конкретного агента.

2. **Skills**: формат SKILL.md уже стандартизирован между агентами.
   Канонический формат СЛЕДУЕТ использовать его as-is, транслируя только
   размещение (`.claude/skills/` vs `.codex/skills/` vs `.gemini/skills/`
   vs `.opencode/skills/`). Дополнительно СЛЕДУЕТ использовать `.agents/skills/`
   как cross-agent portable path.

3. **Суб-агенты**: Markdown + YAML frontmatter — доминирующий формат
   (3 из 4 агентов). Канонический формат СЛЕДУЕТ использовать Markdown для
   определения агентов, транслируя в TOML для Codex CLI.

4. **MCP**: все агенты поддерживают stdio-транспорт с идентичной базовой
   структурой (`command`, `args`, `env`). Канонический формат MCP-конфигурации
   СЛЕДУЕТ использовать эту общую структуру, транслируя в агент-специфичные
   файлы (`.mcp.json`, `config.toml`, `settings.json`, `opencode.json`).

5. **Команды**: формат команд различается между агентами (Markdown, TOML, JSON).
   Канонический формат СЛЕДУЕТ определить собственный формат и транслировать
   в каждый агент-специфичный формат.

6. **Структура каталогов**: канонический каталог (например, `.agent-sds/`)
   СЛЕДУЕТ содержать структуру, параллельную агент-специфичным каталогам:
   `instructions/`, `skills/`, `agents/`, `commands/`, `mcp.json`.

### Риски

- **Нестабильность API**: Gemini CLI agents в preview, KiloCode имеет
  known bugs в mode-specific rules. Адаптеры для этих агентов потребуют
  более частого обновления.
- **Divergence**: несмотря на конвергенцию SKILL.md, другие аспекты
  (commands, config format, MCP placement) расходятся. Канонический
  формат не сможет быть простым union — потребуется трансляция.
- **AGENTS.md adoption**: `AGENTS.md` поддерживается всеми агентами, но с разным
  приоритетом — основной файл (Codex CLI, OpenCode) vs fallback (Claude Code)
  vs через конфигурацию (Gemini CLI). Agent SDS потребуется генерировать
  agent-specific файлы (`CLAUDE.md`, `GEMINI.md`) параллельно с `AGENTS.md`.

## Источники

### Официальная документация

- [Claude Code — Skills](https://code.claude.com/docs/en/skills)
- [Claude Code — Memory (CLAUDE.md)](https://code.claude.com/docs/en/memory)
- [Claude Code — Sub-agents](https://code.claude.com/docs/en/sub-agents)
- [Claude Code — MCP](https://code.claude.com/docs/en/mcp)
- [Claude Code — Settings](https://code.claude.com/docs/en/settings)
- [Claude Code — .claude directory guide](https://computingforgeeks.com/claude-code-dot-claude-directory-guide/)
- [Codex CLI — Config basics](https://developers.openai.com/codex/config-basic)
- [Codex CLI — Configuration Reference](https://developers.openai.com/codex/config-reference)
- [Codex CLI — AGENTS.md](https://developers.openai.com/codex/guides/agents-md)
- [Codex CLI — Subagents](https://developers.openai.com/codex/subagents)
- [Codex CLI — Agent Skills](https://developers.openai.com/codex/skills)
- [Gemini CLI — Configuration](https://google-gemini.github.io/gemini-cli/docs/get-started/configuration.html)
- [Gemini CLI — Extensions](https://google-gemini.github.io/gemini-cli/docs/extensions/)
- [Gemini CLI — Agent Skills](https://geminicli.com/docs/cli/skills/)
- [Gemini CLI — Subagents (experimental)](https://geminicli.com/docs/core/subagents/)
- [OpenCode — Configuration](https://opencode.ai/docs/config/)
- [OpenCode — Agents](https://opencode.ai/docs/agents/)
- [KiloCode — Custom Rules](https://kilo.ai/docs/advanced-usage/custom-rules)
- [KiloCode — Custom Modes](https://kilo.ai/docs/agent-behavior/custom-modes)
- [KiloCode — AGENTS.md](https://kilo.ai/docs/customize/agents-md)
- [KiloCode — CLI](https://kilo.ai/docs/code-with-ai/platforms/cli)

### Стандарты и спецификации

- [AGENTS.md — Official specification](https://agents.md/)
- [AGENTS.md — GitHub repository](https://github.com/agentsmd/agents.md)
- [Model Context Protocol — Official site](https://modelcontextprotocol.io/)

### Аналитические материалы

- [The 2026 Guide to Coding CLI Tools — Tembo](https://www.tembo.io/blog/coding-cli-tools-comparison)
- [Comparing Codex CLI vs Claude Code vs Gemini CLI — Medium](https://medium.com/@dorangao/comparing-codex-cli-vs-claude-code-vs-gemini-cli-ai-coding-tools-in-your-terminal-1a238c329cbe)
- [How to write a great agents.md — GitHub Blog](https://github.blog/ai-and-ml/github-copilot/how-to-write-a-great-agents-md-lessons-from-over-2500-repositories/)
- [AGENTS.md Emerges as Open Standard — InfoQ](https://www.infoq.com/news/2025/08/agents-md/)
- [Claude Code Customization Guide — alexop.dev](https://alexop.dev/posts/claude-code-customization-guide-claudemd-skills-subagents/)
