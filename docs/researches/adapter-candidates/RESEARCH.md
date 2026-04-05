---
type: research
summary: Кандидаты для адаптеров Agloom --- анализ 10 AI coding tools
description: >
  Систематический анализ project-level конфигурации 10 AI coding tools
  для определения потребности в новых адаптерах Agloom. Критерии C1-C10:
  instructions, rules, commands, skills, agents, MCP, hooks, LSP,
  уникальные возможности, adapter verdict. Индексный документ со
  сравнительными таблицами и рекомендациями.
relates:
  - docs/researches/agent-capabilities-map/RESEARCH.md
  - docs/researches/adapter-candidates/tools/codex-cli.md
  - docs/researches/adapter-candidates/tools/gemini-cli.md
  - docs/researches/adapter-candidates/tools/android-studio-gemini.md
  - docs/researches/adapter-candidates/tools/kilocode.md
  - docs/researches/adapter-candidates/tools/github-copilot.md
  - docs/researches/adapter-candidates/tools/cursor.md
  - docs/researches/adapter-candidates/tools/cline.md
  - docs/researches/adapter-candidates/tools/continue-dev.md
  - docs/researches/adapter-candidates/tools/goose.md
  - docs/researches/adapter-candidates/tools/aider.md
---

# Исследование: кандидаты для адаптеров Agloom

**Дата:** 2026-04-03

## Контекст исследования

### Проблема

Agloom поддерживает три адаптера: `claude`, `opencode` (через agentsmd),
`agentsmd`. Рынок AI coding tools расширился до десятков инструментов с
различными форматами конфигурации. Необходимо определить, какие инструменты
требуют новых адаптеров, какие покрываются существующими, и каков приоритет
разработки.

### Цель

Оценить 10 AI coding tools по 10 критериям (C1-C10) и сформулировать
рекомендации: какие адаптеры создавать, в каком порядке, какие компоненты
включать.

### Границы

- **В scope**: project-level конфигурация (файлы в репозитории), формат
  инструкций, rules, commands, skills, agents, MCP, hooks.
- **Вне scope**: глобальные настройки, IDE UI, pricing, model quality,
  hands-on тестирование.

## Критерии оценки

Критерии определены до начала анализа (защита от anchoring bias).

| #   | Критерий        | Определение                                   |
| --- | --------------- | --------------------------------------------- |
| C1  | Instructions    | Файл инструкций, иерархия, формат             |
| C2  | Rules           | Модульные правила, директория, glob-паттерны  |
| C3  | Commands        | Slash-команды, директория, формат             |
| C4  | Skills          | SKILL.md, директория, auto-invocation         |
| C5  | Agents          | Суб-агенты, формат, tool restrictions         |
| C6  | MCP             | Конфигурация MCP-серверов, формат, размещение |
| C7  | Hooks           | Хуки на события, формат конфигурации          |
| C8  | LSP             | Конфигурация LSP-серверов                     |
| C9  | Other           | Уникальные возможности                        |
| C10 | Adapter verdict | Нужен ли адаптер, какие компоненты            |

## Объекты анализа

Детальный анализ каждого инструмента по C1-C10 --- в per-object файлах:

- [Codex CLI](tools/codex-cli.md) --- OpenAI. AGENTS.md, TOML config, `.codex/`.
- [Gemini CLI](tools/gemini-cli.md) --- Google. GEMINI.md, JSON, `.gemini/`,
  extensions.
- [Android Studio Gemini](tools/android-studio-gemini.md) --- Google IDE.
  AGENTS.md + GEMINI.md fallback, `.idea/` rules.
- [KiloCode](tools/kilocode.md) --- VS Code + CLI. AGENTS.md, JSONC,
  `.kilo/`, форк OpenCode.
- [GitHub Copilot](tools/github-copilot.md) --- Microsoft. `.github/`,
  `.agent.md`, `.instructions.md`.
- [Cursor](tools/cursor.md) --- Anysphere IDE. `.cursor/rules/*.mdc`,
  hooks, subagents.
- [Cline](tools/cline.md) --- VS Code. `.clinerules/`, `.cline/skills/`.
- [Continue Dev](tools/continue-dev.md) --- VS Code / JetBrains.
  `config.yaml`, Hub-based rules.
- [Goose](tools/goose.md) --- Block. `.goosehints`, recipes, delegate.
- [Aider](tools/aider.md) --- CLI. `CONVENTIONS.md`, `.aider.conf.yml`.

## Сравнительные таблицы

### C1-C3: Instructions, Rules, Commands

| Инструмент     | Instructions file       | Иерархия                  | Rules каталог                | Glob | Commands             |
| -------------- | ----------------------- | ------------------------- | ---------------------------- | ---- | -------------------- |
| Codex CLI      | `AGENTS.md`             | global->project           | `.codex/rules/` (cmd policy) | нет  | нет (через Skills)   |
| Gemini CLI     | `GEMINI.md`             | global->proj->sub         | `@import` синтаксис          | нет  | `.gemini/commands/`  |
| AS Gemini      | `AGENTS.md`/`GEMINI.md` | directory walkup          | `.idea/` (IDE)               | нет  | нет                  |
| KiloCode       | `AGENTS.md`             | global->project           | `.kilo/rules/`               | нет  | нет                  |
| GitHub Copilot | `.github/copilot-*.md`  | personal->org->repo->path | `.github/instructions/`      | да   | `.github/chatmodes/` |
| Cursor         | `AGENTS.md`             | directory walkup          | `.cursor/rules/*.mdc`        | да   | нет                  |
| Cline          | (через UI/rules)        | нет                       | `.clinerules/`               | да   | нет                  |
| Continue Dev   | (через config.yaml)     | нет                       | config.yaml rules            | нет  | prompt files         |
| Goose          | `.goosehints`           | nested subdirs            | нет                          | нет  | нет                  |
| Aider          | `CONVENTIONS.md`        | home->git->CWD            | нет                          | нет  | нет                  |

### C4-C6: Skills, Agents, MCP

| Инструмент     | SKILL.md | Skills path        | Agents format       | Agents path       | MCP config file             |
| -------------- | -------- | ------------------ | ------------------- | ----------------- | --------------------------- |
| Codex CLI      | да       | `.agents/skills/`  | TOML                | `.codex/agents/`  | `config.toml`               |
| Gemini CLI     | да       | `.gemini/skills/`  | MD+YAML FM          | `.gemini/agents/` | `.gemini/settings.json`     |
| AS Gemini      | да?      | `.gemini/skills/`? | нет                 | ---               | `.gemini/settings.json`?    |
| KiloCode       | да       | `.kilo/skills/`    | Markdown            | Settings UI       | `kilo.jsonc`                |
| GitHub Copilot | нет      | ---                | MD+YAML FM          | `.github/agents/` | repo settings / `.agent.md` |
| Cursor         | да?      | не документирован  | custom subagents    | не документирован | `.cursor/mcp.json`          |
| Cline          | да       | `.cline/skills/`   | read-only subagents | ---               | `mcp_settings.json`         |
| Continue Dev   | нет      | ---                | config.yaml         | ---               | `.continue/mcpServers/`     |
| Goose          | да       | `.goose/skills/`   | delegate()          | config.yaml       | `config.yaml` extensions    |
| Aider          | нет      | ---                | нет                 | ---               | нет (MCP server only)       |

### C7-C8: Hooks, LSP

| Инструмент     | Hooks                                 | LSP config |
| -------------- | ------------------------------------- | ---------- |
| Codex CLI      | нет                                   | нет        |
| Gemini CLI     | через extensions                      | нет        |
| AS Gemini      | нет                                   | IDE        |
| KiloCode       | нет                                   | нет        |
| GitHub Copilot | preview (JetBrains)                   | нет        |
| Cursor         | да (pre/post tool, MCP, prompt, stop) | нет        |
| Cline          | нет                                   | нет        |
| Continue Dev   | нет                                   | нет        |
| Goose          | нет                                   | нет        |
| Aider          | нет (lint/test cmd)                   | нет        |

### C10: Adapter verdict --- сводка

| Инструмент     | Адаптер                | Приоритет | Компоненты                                  |
| -------------- | ---------------------- | --------- | ------------------------------------------- |
| Codex CLI      | расширить agentsmd     | средний   | skills, agents (TOML), cmd policy           |
| Gemini CLI     | новый `gemini`         | высокий   | instructions, skills, agents, commands, MCP |
| AS Gemini      | покрыт gemini/agentsmd | низкий    | ---                                         |
| KiloCode       | расширить opencode     | средний   | .kilo/ paths, kilo.jsonc                    |
| GitHub Copilot | новый `copilot`        | высокий   | instructions, agents, chatmodes, rules      |
| Cursor         | новый `cursor`         | высокий   | rules (.mdc), MCP, hooks                    |
| Cline          | новый `cline`          | средний   | rules, skills, MCP                          |
| Continue Dev   | новый `continue`       | низкий    | config.yaml, MCP                            |
| Goose          | новый `goose`          | низкий    | .goosehints, skills, MCP                    |
| Aider          | не требуется           | ---       | CONVENTIONS.md (минимальный ROI)            |

## Ключевые паттерны

### Конвергенция стандартов

1. **AGENTS.md** --- поддерживается 7 из 10 инструментов (Codex CLI,
   AS Gemini, KiloCode, GitHub Copilot, Cursor + Gemini CLI через
   `context.fileName`, Goose через `.goosehints` fallback). Адаптер `agentsmd`
   покрывает базовый уровень инструкций.

2. **SKILL.md** --- поддерживается 7 из 10 (Codex CLI, Gemini CLI, KiloCode,
   Cline, Cursor, Goose + AS Gemini предположительно). GitHub Copilot, Continue
   Dev и Aider не поддерживают.

3. **MCP** --- поддерживается 9 из 10 (кроме Aider как клиент). Формат
   конфигурации различается: JSON (Cursor, Cline, Continue), TOML (Codex),
   JSONC (KiloCode), YAML (Goose), settings.json (Gemini).

### Расхождения

1. **Формат rules**: `.mdc` с frontmatter (Cursor), `.md` в каталоге
   (KiloCode), `.rules` cmd policy (Codex), `.md`/`.txt` с YAML paths (Cline),
   `.instructions.md` с `applyTo` (Copilot), `@import` (Gemini),
   config.yaml (Continue).

2. **Agents format**: TOML (Codex), MD+YAML FM (Gemini, Copilot, KiloCode),
   `.mdc` (Cursor), config.yaml (Continue, Goose) --- нет единого стандарта.

3. **Hooks**: только Cursor имеет зрелую систему. Gemini --- через extensions.
   Copilot --- в preview. Остальные --- отсутствуют.

4. **LSP**: ни один инструмент не поддерживает project-level LSP конфигурацию.

## Заключение

### Рекомендации по приоритетам адаптеров

**Высокий приоритет** (уникальная экосистема, широкая аудитория):

1. **`gemini`** --- проприетарный формат (GEMINI.md, settings.json,
   TOML-команды, extensions). Gemini CLI --- второй по популярности CLI-агент.
   Компоненты: instructions, skills, agents, commands, MCP.

2. **`copilot`** --- наиболее гранулярная система инструкций (.github/,
   `.agent.md`, `.instructions.md`, chatmodes). Наибольшая установленная база
   пользователей. Компоненты: instructions, agents, chatmodes, rules.

3. **`cursor`** --- уникальная система rules (.mdc с globs), hooks, MCP.
   Один из лидеров рынка AI IDE. Компоненты: rules, MCP, hooks.

**Средний приоритет** (расширение существующих адаптеров):

4. **Расширить `agentsmd`/`opencode`** для KiloCode (`.kilo/` paths,
   `kilo.jsonc`) и Codex CLI (`.codex/agents/` TOML, cmd policy rules).

5. **`cline`** --- отдельный адаптер для rules (`.clinerules/` с conditional
   paths), skills (`.cline/skills/`), MCP (`mcp_settings.json`).

**Низкий приоритет**:

6. **`continue`** --- уникальный config.yaml, но нет поддержки стандартов
   (AGENTS.md, SKILL.md). Hub-based система ограничивает портабельность.

7. **`goose`** --- `.goosehints` + recipes. Ограниченная project-level
   конфигурация. Recipes не транспилируемы из канонического формата.

8. **Android Studio Gemini** --- покрывается адаптерами `gemini` + `agentsmd`.

9. **Aider** --- минимальная конфигурация. ROI адаптера не оправдан.

### Риски

- **API нестабильность**: Gemini CLI agents (preview), Cline skills
  (experimental), Copilot hooks (preview), Cursor skills (не документированы).
- **Divergence formats**: каждый инструмент развивает собственный формат rules
  --- канонический формат Agloom потребует трансляции для каждого.
- **MCP placement**: 6 разных способов размещения MCP-конфигурации --- адаптеры
  MCP должны быть отдельным модулем, переиспользуемым между адаптерами.

## Источники

### Стандарты

- [AGENTS.md --- Official specification](https://agents.md/)
- [Model Context Protocol](https://modelcontextprotocol.io/)

### Аналитические материалы

- [CLI AI Assistants Compared 2026](https://sanj.dev/post/comparing-ai-cli-coding-assistants)
- [Cursor Beta Features 2026](https://markaicode.com/cursor-beta-features-2026/)
- [Goose AI Review 2026](https://aitoolanalysis.com/goose-ai-review/)
