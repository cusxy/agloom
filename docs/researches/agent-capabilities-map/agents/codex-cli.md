---
type: research
summary: Возможности Codex CLI для Agent SDS
description: >
  Детальный анализ project-level конфигурации Codex CLI (OpenAI)
  по критериям C1–C8. Часть исследования agent-capabilities-map.
relates:
  - docs/researches/agent-capabilities-map/RESEARCH.md
---

# Codex CLI (OpenAI)

Критерии оценки — см. `docs/researches/agent-capabilities-map/RESEARCH.md` § Критерии оценки.

## Общая характеристика

Codex CLI — open-source CLI-агент от OpenAI, устанавливаемый через
`npm install -g @openai/codex`. Использует модели GPT/Codex (GPT-5-Codex, GPT-4.1).
Строгая песочница по умолчанию. Требует платный аккаунт OpenAI с верификацией.

## C1. Конфигурационная модель

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

## C2. Инструкции агенту

Основной файл — `AGENTS.md` в корне проекта (стандарт, принятый индустрией).
Система приоритетов:

1. `~/.codex/AGENTS.md` — глобальные инструкции.
2. `~/.codex/AGENTS.override.md` — приоритет над AGENTS.md.
3. `AGENTS.md` или `.codex/AGENTS.md` — project-level.
4. Конфигурируемые fallback-имена через `project_doc_fallback_filenames`.

Поддержка `model_instructions_file` в config.toml для полной замены встроенного
поведения. Настраиваемый лимит размера через `project_doc_max_bytes`.

## C3. Команды

Встроенные slash-команды: `/model`, `/review`, `/diff`, `/agent`, `/tools`,
`/permissions`, `/fast`, `/status`. Пользовательские project-level
slash-команды не поддерживаются как отдельная система файлов.
Функциональность пользовательских команд покрывается через Skills.

## C4. Навыки (Skills)

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

## C5. Суб-агенты

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

## C6. MCP-интеграция

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

## C7. Расширяемость

Profiles: `[profiles.<name>]` в config.toml позволяют переключаться между
конфигурациями (`codex --profile <name>`). Admin-level `requirements.toml`
для ограничений на уровне организации. Feature flags через `[features]`.

## C8. Зрелость экосистемы

Open-source (GitHub). Документация на developers.openai.com — обширная и структурированная.
TOML-формат обеспечивает строгую типизацию конфигурации с JSON Schema валидацией.
Привязка к экосистеме OpenAI (модели GPT/Codex). Верификация аккаунта (ID + facial
recognition) — барьер для входа.

## Плюсы

- Поддержка стандарта `AGENTS.md` из коробки.
- Строгая trust model: project config загружается только для доверенных проектов.
- TOML-конфигурация с JSON Schema — строгая типизация и валидация.
- Granular MCP control: `enabled_tools`, `disabled_tools`, таймауты, `required` flag.
- Profiles для переключения между конфигурациями.
- Admin-level `requirements.toml` для корпоративных ограничений.

## Минусы

- Нет нативных project-level slash-команд (покрывается через Skills).
- TOML-формат для агентов отличается от Markdown-стандарта (Claude Code, Gemini CLI, OpenCode).
- Высокий барьер входа: верификация аккаунта, предоплата credits.
- Менее зрелая система skills по сравнению с Claude Code (принято позже).

## Источники

- [Codex CLI — Config basics](https://developers.openai.com/codex/config-basic)
- [Codex CLI — Configuration Reference](https://developers.openai.com/codex/config-reference)
- [Codex CLI — AGENTS.md](https://developers.openai.com/codex/guides/agents-md)
- [Codex CLI — Subagents](https://developers.openai.com/codex/subagents)
- [Codex CLI — Agent Skills](https://developers.openai.com/codex/skills)
