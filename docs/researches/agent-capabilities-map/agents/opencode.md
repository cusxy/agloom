---
type: research
summary: Возможности OpenCode / KiloCode для Agent SDS
description: >
  Детальный анализ project-level конфигурации OpenCode и KiloCode CLI
  по критериям C1–C8. Часть исследования agent-capabilities-map.
relates:
  - docs/researches/agent-capabilities-map/RESEARCH.md
---

# OpenCode / KiloCode

Критерии оценки — см. `docs/researches/agent-capabilities-map/RESEARCH.md` § Критерии оценки.

## Общая характеристика

OpenCode — open-source Go-based CLI-агент с TUI-интерфейсом
(`anomalyco/opencode` на GitHub, 130 000+ stars, 650 000+ MAU).
KiloCode — VS Code extension (эволюция Roo Code / Cline), CLI-версия которого
является форком OpenCode. 1.5M+ пользователей KiloCode. Поддерживает множество
провайдеров: OpenAI, Anthropic, Google, AWS Bedrock, Groq, Azure OpenAI, OpenRouter.

Для целей данного исследования OpenCode и KiloCode CLI рассматриваются как единая
экосистема, поскольку KiloCode CLI использует OpenCode в качестве runtime.

## C1. Конфигурационная модель

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

## C2. Инструкции агенту

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

## C3. Команды

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

## C4. Навыки (Skills)

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

## C5. Суб-агенты

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

## C6. MCP-интеграция

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

## C7. Расширяемость

- **Plugins**: конфигурируются через `plugin` массив в opencode.json.
- **Modes**: `.opencode/modes/` или `.kilocodemodes`.
- **Themes**: `.opencode/themes/`.
- **Tools**: `.opencode/tools/` — кастомные инструменты.
- **Variable substitution**: `{env:VAR_NAME}`, `{file:path/to/file}`.
- **Multi-provider**: поддержка любого LLM провайдера через единый конфиг.

## C8. Зрелость экосистемы

Open-source (MIT License). Активное развитие, большое сообщество.
Multi-provider архитектура — не привязан к одному вендору. KiloCode CLI
наследует возможности OpenCode. Однако KiloCode CLI имеет известные проблемы:
custom modes из `.kilocodemodes` не сканируются для rule directories (hardcoded
`KNOWN_MODES` list), mode-specific rules применяются ко всем агентам.

## Плюсы

- Поддержка стандарта `AGENTS.md` из коробки.
- Multi-provider: единственный агент, не привязанный к конкретному LLM-вендору.
- Два формата определения агентов (Markdown и JSON) — гибкость.
- Granular permissions с glob-паттернами для bash-команд.
- Наиболее широкая файловая структура: agents, commands, skills, modes, plugins,
  tools, themes.
- Open-source MIT License — нет вендорного lock-in.

## Минусы

- Экосистема менее зрелая, чем у Claude Code или Gemini CLI.
- Известные баги в KiloCode: mode-specific rules применяются ко всем агентам,
  custom modes не интегрированы с rule discovery.
- Конфигурация разделена между `opencode.json` (JSON) и `.kilocodemodes` (YAML) —
  два формата для одного проекта.
- Документация фрагментирована между OpenCode и KiloCode (два сайта, частичное
  перекрытие).

## Источники

- [OpenCode — Configuration](https://opencode.ai/docs/config/)
- [OpenCode — Agents](https://opencode.ai/docs/agents/)
- [KiloCode — Custom Rules](https://kilo.ai/docs/advanced-usage/custom-rules)
- [KiloCode — Custom Modes](https://kilo.ai/docs/agent-behavior/custom-modes)
- [KiloCode — AGENTS.md](https://kilo.ai/docs/customize/agents-md)
- [KiloCode — CLI](https://kilo.ai/docs/code-with-ai/platforms/cli)
