---
type: research
summary: Карта возможностей целевых AI-агентов для CLI
description: >
  Систематический анализ возможностей project-level конфигурации четырёх целевых
  AI-агентов (Claude Code, Codex CLI, Gemini CLI, OpenCode) для проектирования
  канонического формата Agloom. Индексный документ со сравнительными таблицами
  и рекомендациями.
relates:
  - .claude/docs/cycling/agent-protocol.md
  - docs/specs/instructions-transpiler.md
  - docs/researches/agent-capabilities-map/agents/claude-code.md
  - docs/researches/agent-capabilities-map/agents/codex-cli.md
  - docs/researches/agent-capabilities-map/agents/gemini-cli.md
  - docs/researches/agent-capabilities-map/agents/opencode.md
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

Agloom — CLI-инструмент (Node.js/TypeScript/Ink), предоставляющий единый
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

Детальный анализ каждого агента по критериям C1–C8 — в отдельном документе:

- [Claude Code](agents/claude-code.md) — CLI-агент Anthropic. `.claude/`, `CLAUDE.md`, JSON.
  Наиболее зрелая экосистема, автор формата SKILL.md.
- [Codex CLI](agents/codex-cli.md) — CLI-агент OpenAI. `.codex/`, `AGENTS.md`, TOML.
  Строгая trust model, profiles, admin-level ограничения.
- [Gemini CLI](agents/gemini-cli.md) — CLI-агент Google. `.gemini/`, `GEMINI.md`, JSON.
  Развитая система extensions, lazy-loading skills, 1M контекст.
- [OpenCode / KiloCode](agents/opencode.md) — Open-source CLI-агент. `.opencode/`, `AGENTS.md`, JSON.
  Multi-provider, наиболее широкая файловая структура.

## Сравнительная таблица

### Матрица возможностей (feature x agent)

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

| Критерий MVP               | Claude Code | Codex CLI | Gemini CLI | OpenCode/KiloCode |
| -------------------------- | :---------: | :-------: | :--------: | :---------------: |
| Commands (или эквивалент)  |     да      |  Skills   |     да     |        да         |
| MCP project-level          |     да      |    да     |     да     |        да         |
| Agents (суб-агенты)        |     да      |    да     |  preview   |        да         |
| Skills (SKILL.md)          |     да      |    да     |     да     |        да         |
| AGENTS.md (или эквивалент) |  CLAUDE.md  |    да     | GEMINI.md  |        да         |
| **Проходит MVP?**          |   **да**    |  **да**   |   **да**   |      **да**       |

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
   три разных основных имени для одной концепции.

2. **Формат конфигурации**: JSON (Claude Code, Gemini CLI, OpenCode) vs TOML
   (Codex CLI) vs YAML (KiloCode modes).

3. **Формат команд**: Markdown (Claude Code) vs TOML (Gemini CLI) vs JSON template
   (OpenCode) — нет единого стандарта.

4. **MCP-размещение**: отдельный файл (`.mcp.json` — Claude Code) vs внутри общего
   конфига (Codex CLI, Gemini CLI, OpenCode).

### Архитектурные паттерны для канонического формата

1. **Dot-directory pattern**: все агенты используют `.<agent>/` каталог в корне
   проекта. Канонический формат СЛЕДУЕТ использовать аналогичный паттерн
   (например, `.agloom/` или `.agents/`).

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

6. **Структура каталогов**: канонический каталог (например, `.agloom/`)
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
  vs через конфигурацию (Gemini CLI). Agloom потребуется генерировать
  agent-specific файлы (`CLAUDE.md`, `GEMINI.md`) параллельно с `AGENTS.md`.

## Источники

### Стандарты и спецификации

- [AGENTS.md — Official specification](https://agents.md/)
- [AGENTS.md — GitHub repository](https://github.com/agentsmd/agents.md)
- [Model Context Protocol — Official site](https://modelcontextprotocol.io/)

### Аналитические материалы

- [The 2026 Guide to Coding CLI Tools — Tembo](https://www.tembo.io/blog/coding-cli-tools-comparison)
- [Comparing Codex CLI vs Claude Code vs Gemini CLI — Medium](https://medium.com/@dorangao/comparing-codex-cli-vs-claude-code-vs-gemini-cli-ai-coding-tools-in-your-terminal-1a238c329cbe)
- [How to write a great agents.md — GitHub Blog](https://github.blog/ai-and-ml/github-copilot/how-to-write-a-great-agents-md-lessons-from-over-2500-repositories/)
- [AGENTS.md Emerges as Open Standard — InfoQ](https://www.infoq.com/news/2025/08/agents-md/)
