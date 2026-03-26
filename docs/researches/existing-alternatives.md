---
type: research
summary: Существующие альтернативы Agent SDS — инструменты и подходы к унификации конфигураций AI-агентов
description: >
  Систематический анализ существующих инструментов, стандартов и подходов
  к унификации, синхронизации и дистрибуции конфигураций AI-агентов для CLI.
  Охватывает прямых конкурентов, смежные решения, отраслевые стандарты
  и DIY-подходы. Содержит рекомендацию build vs join vs adapt.
relates:
  - docs/researches/agent-capabilities-map.md
  - docs/specs/instructions-transpiler.md
---

# Исследование: существующие альтернативы Agent SDS

**Дата:** 2026-03-25

## Контекст исследования

### Проблема

Разработчики, использующие несколько AI-агентов для CLI (Claude Code, Codex CLI,
Gemini CLI, OpenCode/KiloCode), вынуждены поддерживать независимые конфигурации
для каждого инструмента. Исследование «Карта возможностей целевых AI-агентов»
зафиксировало расхождения в форматах конфигурации (JSON vs TOML vs YAML),
именах файлов инструкций (`CLAUDE.md` vs `AGENTS.md` vs `GEMINI.md`),
форматах команд (Markdown vs TOML vs JSON) и размещении MCP-конфигурации.

### Мотивация

Agent SDS позиционируется как «OpenTelemetry для агентных конфигов» — CLI-инструмент
с единым каноническим форматом, транслируемым в agent-specific конфигурации через
систему адаптеров (plugin architecture). Перед началом разработки необходимо
установить, существуют ли решения, полностью или частично закрывающие эту задачу.

### Цель

1. Определить, существуют ли прямые конкуренты Agent SDS.
2. Оценить зрелость и ограничения найденных решений.
3. Сформулировать рекомендацию: build (создавать с нуля), join (присоединиться
   к существующему проекту) или adapt (адаптировать существующий инструмент).

### Границы

- **В scope**: инструменты для project-level конфигурации AI-агентов, стандарты
  и инициативы по унификации агентных конфигов, DIY-подходы разработчиков.
- **Вне scope**: глобальные dotfiles-менеджеры рассматриваются только как
  потенциальная основа для адаптации. IDE-специфичные плагины (Cursor, VS Code
  extensions) не анализируются.
- **Вне scope**: инструменты оркестрации агентов (LangGraph, CrewAI, AutoGen),
  протоколы межагентного взаимодействия (A2A, AGNTCY).

## Критерии оценки

Критерии определены до начала анализа объектов (защита от anchoring bias).

| #   | Критерий            | Определение                                                                                  |
| --- | ------------------- | -------------------------------------------------------------------------------------------- |
| C1  | Scope конфигурации  | Какие аспекты агентной конфигурации покрывает: инструкции, команды, skills, агенты, MCP      |
| C2  | Трансформация       | Способность преобразовывать между форматами (JSON ↔ TOML ↔ YAML ↔ Markdown) vs копирование   |
| C3  | Покрытие агентов    | Количество поддерживаемых AI-агентов и наличие целевых агентов Agent SDS                     |
| C4  | Расширяемость       | Наличие plugin/adapter архитектуры для добавления новых агентов                              |
| C5  | Валидация           | Проверка корректности генерируемых конфигураций (schema validation, type checking)           |
| C6  | Project-level фокус | Ориентированность на project-level конфигурацию (в репозитории), а не на глобальные dotfiles |
| C7  | Зрелость            | Stars, downloads, частота обновлений, документация, стабильность API                         |
| C8  | Каноническая модель | Наличие единого формата-источника с детерминированной трансляцией в целевые форматы          |

## Объекты анализа

### 1. Ruler

#### Общая характеристика

Ruler — CLI-инструмент (TypeScript, MIT), разработанный Eleanor Berger
(@intellectronica). Хранит инструкции в каталоге `.ruler/` как Markdown-файлы,
конфигурация агентов — в `ruler.toml`. Команда `ruler apply` генерирует
agent-specific файлы конфигурации для 30+ AI-агентов.

- **GitHub**: [intellectronica/ruler](https://github.com/intellectronica/ruler)
- **npm**: `@intellectronica/ruler`
- **Версия**: v0.2.10 (Beta Research Preview)
- **Stars**: ~2 500 | **Forks**: ~134 | **Commits**: ~830

#### Анализ по критериям

**C1. Scope конфигурации**: инструкции (rules), skills (SKILL.md), MCP-серверы
(propagation). Команды и суб-агенты — частично (через skills). Не покрывает
agent-specific settings (JSON/TOML конфиги).

**C2. Трансформация**: конкатенация Markdown-файлов и запись по целевым путям.
Трансформация между форматами (JSON → TOML) отсутствует — контент остаётся
Markdown. MCP-конфигурация пропагируется в формате каждого агента (JSON, TOML),
но scope ограничен.

**C3. Покрытие агентов**: 30+ агентов, включая все целевые Agent SDS
(Claude Code, Codex CLI, Gemini CLI, OpenCode). Наибольшее покрытие
среди всех найденных инструментов.

**C4. Расширяемость**: новые агенты добавляются через `ruler.toml` (declarative
config). Формального plugin API нет — добавление нового формата требует
изменения исходного кода.

**C5. Валидация**: отсутствует. Ruler не проверяет, что сгенерированные файлы
корректны для целевого агента.

**C6. Project-level фокус**: да. Каталог `.ruler/` размещается в корне проекта.
Поддержка вложенных `.ruler/` для монорепозиториев.

**C7. Зрелость**: наиболее зрелый инструмент в категории (2 500 stars).
Статус «Beta Research Preview» указывает на незавершённость API. Активное
развитие (830+ commits).

**C8. Каноническая модель**: `.ruler/AGENTS.md` + `.ruler/ruler.toml`
как источник истины. Генерация детерминирована, но ограничена конкатенацией.

#### Плюсы

- Наибольшее покрытие агентов (30+) среди всех найденных инструментов.
- Простая ментальная модель: Markdown-файлы + TOML-конфигурация → `ruler apply`.
- Поддержка MCP server propagation и skills.
- `.gitignore` automation для сгенерированных файлов.
- Активное развитие и растущее сообщество.

#### Минусы

- Конкатенация Markdown, а не семантическая трансляция — не различает структуру
  инструкций, команд и агентов как отдельные сущности.
- Не покрывает agent-specific settings (JSON/TOML конфиги типа `settings.json`,
  `config.toml`).
- Нет plugin API — добавление нового формата требует PR в репозиторий.
- Нет валидации выходных файлов.
- Статус «Beta Research Preview» — API может измениться.

#### Контекст применимости

Ruler оправдан для команд, которым достаточно синхронизировать текстовые
инструкции и skills между агентами. Не подходит, когда требуется трансформация
между структурированными форматами (JSON ↔ TOML) или валидация выходных файлов.

---

### 2. LNAI

#### Общая характеристика

LNAI — CLI-инструмент (TypeScript), определяющий конфигурации AI-агентов
в TypeScript с валидацией через Zod. Каталог `.ai/` содержит канонические
определения, команда `lnai sync` генерирует native-файлы для каждого агента.

- **Сайт**: [lnai.sh](https://lnai.sh/)
- **GitHub**: [KrystianJonca/lnai](https://github.com/KrystianJonca/lnai)
- **Hacker News**: [обсуждение (февраль 2026)](https://news.ycombinator.com/item?id=46868318)

#### Анализ по критериям

**C1. Scope конфигурации**: инструкции, правила. Scope ограничен текстовым
контентом (Markdown-инструкции). MCP, commands, agents — не документированы
как поддерживаемые.

**C2. Трансформация**: генерирует файлы из TypeScript-определений. Каноническое
определение (`defineContext()`) преобразуется в agent-specific форматы.
Уровень трансформации выше, чем у Ruler (TypeScript → Markdown), но ограничен
инструкциями.

**C3. Покрытие агентов**: Claude Code, Codex CLI, Cursor, Gemini CLI, OpenCode,
Windsurf, GitHub Copilot (7+ агентов). Все целевые агенты Agent SDS покрыты.

**C4. Расширяемость**: заявлена plugin-архитектура для добавления новых
инструментов. Зрелость plugin API не установлена.

**C5. Валидация**: Zod schema validation — ключевое отличие. Ошибки
в конфигурации обнаруживаются до генерации выходных файлов.

**C6. Project-level фокус**: да. Каталог `.ai/` в корне проекта.

**C7. Зрелость**: ранняя стадия. Проект молодой, community небольшое.
Попадание на главную страницу Hacker News (февраль 2026) — индикатор
интереса, но не зрелости.

**C8. Каноническая модель**: TypeScript-файлы в `.ai/` как источник истины.
Детерминированная генерация с автоматической очисткой orphaned-файлов.

#### Плюсы

- Zod-валидация — единственный инструмент с type-safe каноническим форматом.
- Plugin-архитектура (заявлена) для расширения поддержки агентов.
- Автоматическая очистка orphaned-файлов при изменении конфигурации.
- TypeScript как каноническое определение — знакомый язык для целевой аудитории.

#### Минусы

- Ранняя стадия разработки — небольшое community, незрелая документация.
- Scope ограничен инструкциями — MCP, skills, commands, agents как отдельные
  сущности не документированы.
- Зависимость от Node.js/TypeScript runtime для определения конфигурации.
- Зрелость plugin API не подтверждена.

#### Контекст применимости

LNAI оправдан для TypeScript-команд, которым важна type-safety конфигурации
и готовых инвестировать в TypeScript-определения. Не подходит для команд,
не использующих Node.js, или при необходимости покрытия полного scope
конфигурации (MCP, skills, agents).

---

### 3. dotagent (agentconfig)

#### Общая характеристика

dotagent — CLI и библиотека (TypeScript, MIT), созданная John Lindquist
(создатель egghead.io). Обеспечивает импорт конфигураций из любого
поддерживаемого формата в каноническую структуру `.agent/` и экспорт
обратно в 14+ agent-specific форматов.

- **GitHub**: [johnlindquist/dotagent](https://github.com/johnlindquist/dotagent)
- **npm**: `agentconfig` (v1.1.1) / `dotagent` (v2.10.0)
- **Stars**: ~120 | **Commits**: ~72

#### Анализ по критериям

**C1. Scope конфигурации**: правила и инструкции. Каждое правило —
`RuleBlock` с metadata (`id`, `alwaysApply`, `scope`, `triggers`, `priority`,
`description`) и `content`. MCP, skills, commands — не покрыты.

**C2. Трансформация**: **бидирекциональная** — уникальная особенность.
Импорт парсит существующие agent-specific файлы в каноническую модель,
экспорт генерирует из канонической модели в целевые форматы. Уровень
трансформации наиболее высокий среди найденных инструментов.

**C3. Покрытие агентов**: 14+ агентов (Copilot, Cursor, Cline, Windsurf,
Zed, Codex, Aider, Claude, Gemini, Qodo, Junie, Roo, OpenCode). Все целевые
агенты Agent SDS покрыты.

**C4. Расширяемость**: программный API (`importAll`, `exportToAgent`,
`exportAll`) позволяет интеграцию в другие инструменты. Формальной
plugin-архитектуры нет.

**C5. Валидация**: TypeScript-типизация модели `RuleBlock`. Schema validation
на уровне Zod не зафиксирована.

**C6. Project-level фокус**: да. Каталог `.agent/` в корне проекта.
Поддержка private/local rules (исключаются из экспорта и version control).

**C7. Зрелость**: ранняя стадия (120 stars, 72 commits). Автор (John Lindquist)
обладает высоким авторитетом в JavaScript-сообществе. Библиотека на npm
в версии 2.10.0.

**C8. Каноническая модель**: `.agent/` как каноническая директория.
Markdown + YAML frontmatter. Бидирекциональность позволяет начать
с существующих конфигураций (import), а не с нуля.

#### Плюсы

- Бидирекциональная конверсия (import + export) — уникальная возможность миграции
  с существующих конфигураций.
- Программный API для интеграции в CI/CD и другие инструменты.
- Поддержка private/local rules.
- Автор с высоким авторитетом в JavaScript-экосистеме.
- Структурированная модель правил (`RuleBlock`) с metadata.

#### Минусы

- Scope ограничен правилами/инструкциями — MCP, skills, commands не покрыты.
- Нет формальной plugin-архитектуры.
- Небольшое community (120 stars).
- Нет валидации выходных файлов против agent-specific schema.

#### Контекст применимости

dotagent оправдан для миграции: команды, уже имеющие конфигурации нескольких
агентов, могут импортировать их в единую модель. Не подходит для полного
управления конфигурацией (MCP, skills, agents) или для команд, начинающих
с нуля.

---

### 4. Symlink-based инструменты (Saddle, ai-rules-sync)

#### Общая характеристика

Категория инструментов, использующих symlinks для указания нескольких
agent-specific путей на один и тот же набор файлов. Два наиболее
зрелых представителя:

- **Saddle** ([saddle.sh](https://saddle.sh)): declarative YAML rules,
  auto-detection установленных инструментов, drift detection (`saddle --check`).
  npm: `saddle-cli` (v1.0.4, MIT).
- **ai-rules-sync** ([github.com/lbb00/ai-rules-sync](https://github.com/lbb00/ai-rules-sync)):
  symlink-sync из Git-репозиториев, multi-repo support для комбинирования
  корпоративных стандартов, community-коллекций и personal preferences.
  8 инструментов (Cursor, Claude Code, Copilot, OpenCode, Trae AI, Codex,
  Gemini CLI, Warp), v0.8.1, Unlicense.

#### Анализ по критериям

**C1. Scope конфигурации**: инструкции, правила, skills (через symlinks).
Saddle покрывает agents/, commands/, skills/, configurations/, rules/.
ai-rules-sync — rules, skills, commands, subagents.

**C2. Трансформация**: **отсутствует**. Symlinks указывают на один и тот же
файл — содержимое идентично для всех агентов. Если агент A ожидает JSON,
а агент B — TOML, symlinks не решают задачу.

**C3. Покрытие агентов**: Saddle — 6 агентов (Claude Code, Codex, Copilot,
Cursor, Gemini, OpenCode). ai-rules-sync — 8 инструментов.

**C4. Расширяемость**: Saddle — добавление агента через YAML-файл
(declarative). ai-rules-sync — конфигурация в YAML.

**C5. Валидация**: Saddle — drift detection (`--check` с exit code 0/1).
Не валидирует содержимое.

**C6. Project-level фокус**: да. Оба инструмента работают с файлами
в корне проекта.

**C7. Зрелость**: Saddle — v1.0 stable. ai-rules-sync — v0.8.1.
Небольшие community.

**C8. Каноническая модель**: каноническая директория → symlinks к целевым
путям. Простая модель, но без трансформации.

#### Плюсы

- Простейшая ментальная модель: один файл → несколько ссылок.
- Нулевые зависимости от runtime (symlinks — средство ОС).
- Saddle: drift detection для CI/CD.
- ai-rules-sync: multi-repo для корпоративных сценариев.
- Instant propagation: изменение в каноническом файле немедленно видно
  всем агентам (через symlink).

#### Минусы

- **Фундаментальное ограничение**: невозможность трансформации между форматами.
  Если Claude Code ожидает `CLAUDE.md`, а Codex — `AGENTS.md` с другим
  содержимым, symlinks бесполезны.
- Symlinks ломаются при замене файла агентом (overwrite вместо edit-in-place).
- Нет валидации содержимого.
- Не решают задачу MCP-конфигурации (JSON vs TOML).
- Ограниченное community.

#### Контекст применимости

Symlink-инструменты оправданы, когда все целевые агенты принимают идентичный
контент в идентичных файлах (например, `AGENTS.md` как единый стандарт).
Не подходят при наличии различий в форматах, именах файлов или структуре
конфигурации.

---

### 5. chezmoi (dotfiles manager как основа)

#### Общая характеристика

chezmoi — наиболее популярный dotfiles-менеджер (Go, MIT). Управляет файлами
через Go text templates с поддержкой шифрования (age/GPG), условной логики
по ОС/hostname, автоматического коммита и push в git.

- **Сайт**: [chezmoi.io](https://www.chezmoi.io/)
- **GitHub**: [twpayne/chezmoi](https://github.com/twpayne/chezmoi)
- **Stars**: ~18 500

Ряд разработчиков адаптировали chezmoi для управления конфигурациями
AI-агентов. Документированные кейсы: генерация MCP-конфигураций из единого
`servers.yaml`, синхронизация `CLAUDE.md`/`AGENTS.md` между машинами,
шифрование API-ключей.

#### Анализ по критериям

**C1. Scope конфигурации**: любые файлы (chezmoi — generic инструмент).
Для AI-конфигураций покрывает инструкции, MCP, settings через шаблонизацию.
Не имеет семантического понимания агентных конфигураций.

**C2. Трансформация**: Go text templates позволяют генерировать разные
форматы из одного источника. Теоретически возможна полная трансформация
(JSON → TOML → YAML). На практике требует ручного написания шаблонов
для каждого формата и агента.

**C3. Покрытие агентов**: не ограничено — chezmoi управляет произвольными
файлами. Но каждый агент требует ручного создания шаблона.

**C4. Расширяемость**: через Go text templates и external tool вызовы.
Нет agent-specific плагинов.

**C5. Валидация**: нет. chezmoi проверяет корректность шаблонов, но не
валидирует содержимое как agent config.

**C6. Project-level фокус**: **нет**. chezmoi спроектирован для глобальных
dotfiles (`~/.config/`, `~/.claude/`). Использование для project-level
конфигурации — anti-pattern: chezmoi управляет home directory, а не
файлами внутри git-репозитория.

**C7. Зрелость**: высокая (~18 500 stars, годы разработки, обширная
документация). Однако зрелость относится к dotfiles management,
а не к agent config management.

**C8. Каноническая модель**: chezmoi source directory как единый
источник истины. Детерминированная генерация через шаблоны.

#### Плюсы

- Наиболее зрелый generic инструмент для управления конфигурациями.
- Go text templates — мощный механизм условной генерации.
- Встроенное шифрование для API-ключей и чувствительных данных.
- Документированные кейсы использования для AI-агентов.
- Cross-machine синхронизация через git.

#### Минусы

- **Нет project-level фокуса**: спроектирован для home directory, не для
  файлов внутри проекта. Agent SDS работает на уровне проекта.
- Нет семантического понимания агентных конфигураций — оперирует файлами,
  а не правилами, skills, командами.
- Каждый агент требует ручного написания Go-шаблона — высокая стоимость
  начальной настройки и поддержки.
- Go text templates — менее знакомы целевой аудитории (TypeScript-разработчики),
  чем Markdown или TypeScript.
- Не решает задачу дистрибуции конфигураций в проект — решает задачу
  синхронизации dotfiles между машинами.

#### Контекст применимости

chezmoi оправдан для синхронизации глобальных настроек AI-агентов
(`~/.claude/`, `~/.codex/`) между машинами разработчика. Не подходит
как основа для project-level конфигурации внутри репозитория.

---

### 6. .agents/ Protocol и agentsfolder

#### Общая характеристика

Два связанных, но независимых проекта, объединённых идеей единого
каталога `.agents/`:

- **.agents/ Protocol** ([dotagentsprotocol.com](https://dotagentsprotocol.com)):
  community-driven спецификация (DRAFT, февраль 2026). Определяет структуру
  каталога `.agents/`, интегрирующего MCP (`mcp.json`), AGENTS.md, skills,
  sub-agents, tasks и memories.
- **agentsfolder** ([github.com/agentsfolder/spec](https://github.com/agentsfolder/spec)):
  формальная спецификация (AGENTS-1) и CLI (Rust, npm prebuilt binaries).
  Определяет каноническую модель с profiles, scopes, overlays, deterministic
  resolution и drift detection.

#### Анализ по критериям

**C1. Scope конфигурации**: наиболее полный scope среди найденных решений.
.agents/ Protocol интегрирует семь стандартов: MCP, AGENTS.md, Skills, ACP,
sub-agents, tasks, memories. agentsfolder определяет profiles, scopes, overlays.

**C2. Трансформация**: agentsfolder заявляет «materialize» backend —
проекцию канонической модели в agent-native поверхности. .agents/ Protocol —
спецификация каталога, не инструмент трансляции.

**C3. Покрытие агентов**: `.agents/skills/` уже поддерживается Codex CLI,
Gemini CLI, OpenCode. Полная поддержка `.agents/` как единого каталога —
ни один агент не реализует нативно.

**C4. Расширяемость**: agentsfolder — формальная спецификация, расширяемость
через соответствие спецификации. .agents/ Protocol — community-driven,
расширяемость через proposals.

**C5. Валидация**: agentsfolder — deterministic resolution algorithm
(специфицирован). .agents/ Protocol — нет.

**C6. Project-level фокус**: да. `.agents/` в корне проекта + `~/.agents/`
для глобального уровня.

**C7. Зрелость**: **очень ранняя стадия**. .agents/ Protocol — DRAFT.
agentsfolder spec помечена «TODO: fix references» в нескольких секциях.
Минимальная adoption. Нет корпоративной поддержки (в отличие от AGENTS.md
и SKILL.md, поддерживаемых AAIF).

**C8. Каноническая модель**: наиболее проработанная формальная модель
среди найденных решений (agentsfolder). Profiles, scopes, overlays,
deterministic resolution — архитектурно наиболее близка к Agent SDS.

#### Плюсы

- Наиболее полный scope конфигурации (MCP, instructions, skills, agents,
  tasks, memories).
- Формальная спецификация (agentsfolder AGENTS-1) — единственное решение
  со спецификацией канонической модели.
- `.agents/skills/` уже поддерживается несколькими агентами.
- Архитектурно наиболее близка к видению Agent SDS.

#### Минусы

- **Критически низкая зрелость**: DRAFT-спецификации, incomplete references,
  минимальная adoption.
- Нет корпоративной поддержки (не под AAIF, в отличие от AGENTS.md и SKILL.md).
- agentsfolder CLI написан на Rust — несовместим с TypeScript-экосистемой
  Agent SDS.
- Ни один агент не поддерживает `.agents/` как единый каталог нативно —
  агенты читают собственные каталоги (`.claude/`, `.codex/`, `.gemini/`,
  `.opencode/`).
- Спецификация без работающего инструмента и community — риск abandonware.

#### Контекст применимости

.agents/ Protocol и agentsfolder представляют перспективное направление
стандартизации, но не готовы к production-использованию. Могут стать основой
для будущего стандарта, если получат поддержку AAIF или major vendors.

---

### 7. Microsoft APM (Agent Package Manager)

#### Общая характеристика

APM — CLI-инструмент (Python/Go, MIT) от Microsoft, позиционируемый как
менеджер зависимостей для агентных конфигураций. Аналогия с npm/pip:
`apm.yml` объявляет зависимости проекта (skills, instructions, prompts,
agents, hooks, plugins, MCP-серверы), `apm install` разрешает зависимости
транзитивно и деплоит файлы в директории целевых агентов, `apm compile`
генерирует оптимизированные выходные файлы для каждого инструмента.

- **Сайт**: [microsoft.github.io/apm](https://microsoft.github.io/apm/)
- **GitHub**: [microsoft/apm](https://github.com/microsoft/apm)
- **GitHub Action**: [microsoft/apm-action](https://github.com/microsoft/apm-action)
- **Установка**: binary (macOS/Linux/Windows), `pip install apm-cli`, `scoop install apm`

#### Анализ по критериям

**C1. Scope конфигурации**: наиболее широкий scope среди найденных инструментов —
skills, instructions, prompts, agents, hooks, plugins, MCP-серверы. Покрывает
все аспекты агентной конфигурации, включая hooks (pre/post actions).

**C2. Трансформация**: `apm compile` генерирует оптимизированные выходные файлы
для каждого агента — `AGENTS.md` для Copilot/Cursor/Codex, `CLAUDE.md`
для Claude Code. Подход близок к трансляции, но ориентирован на Markdown-инструкции.
Structured config (JSON ↔ TOML) трансформация не документирована.

**C3. Покрытие агентов**: GitHub Copilot, Claude Code, Cursor, OpenCode (4 агента).
Не покрывает Codex CLI и Gemini CLI — два из четырёх целевых агентов Agent SDS.

**C4. Расширяемость**: package registry (`apm_modules/`) с транзитивным
dependency resolution. Новые агенты требуют изменения в core (формальный
plugin API для добавления агентов не документирован).

**C5. Валидация**: lockfile (`apm.lock.yaml`) с pinning к точным коммитам.
SARIF audit report для hidden Unicode scanning. Schema validation
канонической конфигурации не документирована.

**C6. Project-level фокус**: да. `apm.yml` в корне проекта. `apm_modules/`
как аналог `node_modules/`.

**C7. Зрелость**: ранняя стадия. Под организацией Microsoft на GitHub,
но создан и поддерживается одним разработчиком (@danielmeppiel).
Запрос на поддержку Dependabot (март 2026) — индикатор зарождающегося
community. Документация на отдельном сайте.

**C8. Каноническая модель**: `apm.yml` как манифест зависимостей + пакеты
в `apm_modules/`. Модель ближе к package manager (npm), чем к transpiler.
Lockfile обеспечивает воспроизводимость.

#### Плюсы

- Наиболее широкий scope конфигурации среди найденных инструментов (skills,
  agents, hooks, MCP, plugins).
- Dependency resolution с транзитивными зависимостями и lockfile — уникальная
  возможность для управления сложными деревьями зависимостей.
- `apm compile` для генерации оптимизированных файлов.
- GitHub Action для CI/CD интеграции.
- Pack & Distribute: portable артефакт без зависимости от APM/Python/сети.
- Под организацией Microsoft — потенциал роста adoption.

#### Минусы

- Не покрывает Codex CLI и Gemini CLI — два из четырёх целевых агентов Agent SDS.
- Зависимость от Python (`pip install apm-cli`) — несовместимость с
  TypeScript-экосистемой Agent SDS.
- Поддерживается одним разработчиком, несмотря на Microsoft org.
- Модель package manager (установка пакетов из registry) отличается от модели
  transpiler (трансляция единого формата) — APM управляет **распределением
  пакетов**, а не **трансляцией между форматами**.
- Ранняя стадия — API и модель могут измениться.

#### Контекст применимости

APM оправдан для команд, нуждающихся в dependency management для агентных
конфигураций (переиспользование skills и instructions между проектами как
npm-пакетов). Менее подходит для трансляции project-specific конфигурации
между форматами агентов. Комплементарен, но не заменяет Agent SDS: APM
решает задачу distribution пакетов, Agent SDS — трансляции канонического
формата.

---

### 8. getsentry/dotagents

#### Общая характеристика

dotagents — CLI-инструмент от Sentry (TypeScript, npm: `@sentry/dotagents`).
Использует `agents.toml` как манифест конфигурации и `agents.lock` с SHA-256
integrity hashes для воспроизводимых установок. Устанавливает skills из
Git-репозиториев, генерирует MCP и hook конфигурации для каждого агента.

- **Сайт**: [dotagents.sentry.dev](https://dotagents.sentry.dev/)
- **Документация**: [docs.sentry.io/ai/dotagents](https://docs.sentry.io/ai/dotagents/)
- **GitHub**: [getsentry/dotagents](https://github.com/getsentry/dotagents)

#### Анализ по критериям

**C1. Scope конфигурации**: skills, MCP-серверы, hooks. Skill sources —
Git-репозитории (GitHub, GitLab, произвольные хосты) и локальные пути.
Instructions — через SKILL.md. Slash commands и sub-agents — не документированы
как отдельные сущности.

**C2. Трансформация**: symlinks из `.agents/skills/` в agent-specific директории.
MCP и hook конфигурации генерируются в формате каждого агента. Уровень
трансформации промежуточный: skills — symlinks, MCP/hooks — генерация.

**C3. Покрытие агентов**: Claude Code, Cursor, Codex CLI, VS Code, OpenCode,
Pi (6 агентов). Gemini CLI не упомянут в документации.

**C4. Расширяемость**: конфигурация агентов через `agents` field в
`agents.toml`. Формального plugin API нет.

**C5. Валидация**: `agents.lock` с SHA-256 integrity hashes. `--frozen` flag
для CI (гарантирует идентичность установок). Не валидирует семантику
конфигурации.

**C6. Project-level фокус**: да. `agents.toml` в корне проекта.

**C7. Зрелость**: поддерживается Sentry (established company). Документация
на docs.sentry.io. Skills на AgentSkills.so и LobeHub. Конкретные данные
по stars/downloads не установлены.

**C8. Каноническая модель**: `agents.toml` как манифест + `agents.lock`
как lockfile. Модель ближе к package manager (skills из Git repos)
с элементами config generation (MCP, hooks).

#### Плюсы

- Поддержка Sentry — established company с ресурсами и community.
- SHA-256 integrity + lockfile — наиболее надёжная модель воспроизводимости
  среди найденных инструментов.
- `--frozen` mode для CI/CD — детерминированные установки.
- Генерация MCP и hook конфигураций для каждого агента.
- Multi-source skills (GitHub, GitLab, local, pinned refs).

#### Минусы

- Gemini CLI не поддерживается — один из целевых агентов Agent SDS.
- Scope ограничен skills + MCP + hooks. Slash commands и settings
  не покрыты.
- Модель package manager для skills — не решает задачу трансляции
  project-specific инструкций и команд.
- Skills деплоятся через symlinks — ограничение для агентов, не следующих
  symlinks.

#### Контекст применимости

getsentry/dotagents оправдан для команд, использующих Sentry-экосистему
и нуждающихся в воспроизводимом управлении skills с integrity verification.
Не подходит для полной трансляции канонической конфигурации между форматами
агентов. Комплементарен Agent SDS: dotagents управляет внешними skills,
Agent SDS — трансляцией проектной конфигурации.

---

## Дополнительные инструменты

Помимо основных объектов анализа, обнаружены следующие инструменты:

| Инструмент                   | Подход               | Агенты | Scope                        | Ссылка                                                                  |
| ---------------------------- | -------------------- | ------ | ---------------------------- | ----------------------------------------------------------------------- |
| **rulesync**                 | генерация            | 10+    | rules only                   | [GitHub](https://github.com/dyoshikawa/rulesync)                        |
| **contextai**                | TS `defineContext()` | 8+     | инструкции                   | [dev.to](https://dev.to/madeburo)                                        |
| **agents (amtiYo)**          | JSON sync            | 9      | MCP, skills, инструкции      | [GitHub](https://github.com/amtiYo/agents)                              |
| **agentsfolder**             | Rust CLI + spec      | 6+     | full (spec-driven)           | [GitHub](https://github.com/agentsfolder/spec)                          |
| **PRPM**                     | registry + install   | 12+    | rules, skills, agents        | [prpm.dev](https://prpm.dev/)                                           |
| **CC-Switch**                | desktop app          | 5      | provider mgmt, MCP, prompts  | [GitHub](https://github.com/farion1231/cc-switch)                       |
| **knowhub**                  | copy + HTTP plugins  | 13+    | rules only                   | [GitHub](https://github.com/yujiosaka/knowhub)                          |
| **apc-cli**                  | sync                 | 6      | configs, memory, MCP         | [GitHub](https://github.com/FZ2000/apc-cli)                             |
| **skillpm**                  | npm registry         | 6+     | skills only                  | [GitHub](https://github.com/sbroenne/skillpm)                           |
| **agent-command-sync**       | конвертер            | 3      | slash commands only           | [GitHub](https://github.com/hatappo/agent-command-sync)                 |
| **agent-config-adapter**     | AI-powered convert   | 3      | commands, MCP                | [GitHub](https://github.com/PrashamTrivedi/agent-config-adapter)        |
| **agent-sync**               | bidirectional sync   | 2      | agents, permissions, commands | [GitHub](https://github.com/ZacheryGlass/agent-sync)                    |
| **block/ai-rules**           | sync                 | 5+     | rules, commands, skills      | [GitHub](https://github.com/block/ai-rules)                             |
| **dotai**                    | генерация из `.ai/`  | 7+     | инструкции                   | [dotai.nullbrain.com](https://dotai.nullbrain.com/)                     |
| **x-cmd agent**              | setup helper         | 4      | prompts, skills              | [x-cmd.com](https://www.x-cmd.com/blog/260322/)                        |
| **code-aide (Dave Beckett)** | custom tooling       | 8      | guidelines, skills, commands | [Blog](https://www.dajobe.org/blog/2026/03/16/)                         |

## Ландшафт стандартов

Стандартизация агентных конфигураций происходит на нескольких уровнях:

### AAIF (Agentic AI Foundation)

Linux Foundation учредила AAIF (декабрь 2025) как зонтичную организацию
для стандартов в области AI-агентов. Платиновые участники: AWS, Anthropic,
Block, Bloomberg, Cloudflare, Google, Microsoft, OpenAI. Золотые участники
включают Cisco, Datadog, Docker, IBM, JetBrains, Oracle, Salesforce, SAP
и др. ([источник](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation)).

Founding donations (декабрь 2025):

- **MCP** — протокол доступа к инструментам (donated Anthropic).
- **AGENTS.md** — стандарт инструкций (donated OpenAI). 60 000+ проектов.
- **goose** — open-source AI agent framework (donated Block).

Agent Skills (SKILL.md) — стандарт skills, опубликованный Anthropic
(декабрь 2025), поддерживается множеством платформ
([источник](https://agentskills.io/specification)). Не входит в founding
donations AAIF, но является де-факто стандартом экосистемы.

### Ключевое наблюдение

AAIF стандартизирует **форматы** (как описать инструкции, skills, tools),
но **не адресует дистрибуцию** (как доставить конфигурации из единого
источника в agent-specific файлы). Этот разрыв между «что» и «как» —
ниша Agent SDS.

### Академическое подтверждение

Эмпирические исследования подтверждают проблему:

- Mohsenimofidi et al. (arXiv: 2510.21413) — scanning 10 000
  GitHub-репозиториев, substantive analysis 466 (5%): отсутствие структуры
  в конфигурационных файлах, высокая вариативность.
- arXiv: 2512.18925 — 28.7% строк в cursor rules — дубликаты из шаблонов.
- arXiv: 2602.14690 — «cross-tool perspective mapping configuration
  mechanisms» отмечено как research gap.

## Сравнительная таблица

### Основные объекты анализа × критерии

| Критерий                    | Ruler            | LNAI              | dotagent            | MS APM                     | getsentry/dotagents       | Symlink tools    | chezmoi             | .agents/ Protocol    |
| --------------------------- | ---------------- | ----------------- | ------------------- | -------------------------- | ------------------------- | ---------------- | ------------------- | -------------------- |
| **C1. Scope**               | rules, skills, MCP (partial) | rules | rules               | skills, agents, MCP, hooks | skills, MCP, hooks        | rules, skills    | любые файлы         | full (MCP, skills, agents, tasks) |
| **C2. Трансформация**       | конкатенация     | TS → Markdown     | бидирекциональная   | compile → agent files      | symlinks + MCP generation | нет (symlinks)   | Go templates        | materialize (заявлен) |
| **C3. Агенты**              | 30+              | 7+                | 14+                 | 4                          | 6                         | 6–8              | не ограничено       | концептуально все    |
| **C4. Plugin API**          | нет              | заявлен           | нет (программный API) | dependency resolution    | нет                       | YAML config      | нет                 | нет (спецификация)   |
| **C5. Валидация**           | нет              | Zod               | TypeScript types    | lockfile + SARIF audit     | SHA-256 lockfile          | drift detection  | нет                 | deterministic resolution |
| **C6. Project-level**       | да               | да                | да                  | да                         | да                        | да               | нет (home dir)      | да                   |
| **C7. Зрелость**            | средняя (2.5K ★) | ранняя            | ранняя (120 ★)      | ранняя (MS org)            | ранняя (Sentry)           | ранняя–средняя   | высокая (~18.5K ★)  | DRAFT                |
| **C8. Каноническая модель** | `.ruler/`        | `.ai/` (TypeScript) | `.agent/` (Markdown) | `apm.yml` + `apm_modules/` | `agents.toml` + `.agents/` | каноническая dir | source dir          | `.agents/` (формальная spec) |

### Покрытие целевых агентов Agent SDS

| Агент             | Ruler | LNAI | dotagent | MS APM | getsentry | Saddle | ai-rules-sync |
| ----------------- | :---: | :--: | :------: | :----: | :-------: | :----: | :-----------: |
| Claude Code       |  ✅   |  ✅  |    ✅    |   ✅   |    ✅     |   ✅   |      ✅       |
| Codex CLI         |  ✅   |  ✅  |    ✅    |   ❌   |    ✅     |   ✅   |      ✅       |
| Gemini CLI        |  ✅   |  ✅  |    ✅    |   ❌   |    ❌     |   ✅   |      ✅       |
| OpenCode/KiloCode |  ✅   |  ✅  |    ✅    |   ✅   |    ✅     |   ✅   |      ✅       |

## Ключевые паттерны

### 1. Рынок фрагментирован, но активен

Обнаружено 15+ инструментов, решающих варианты одной задачи. Ни один
не занимает доминирующую позицию. Ruler — лидер по adoption (2 500 stars),
но значительно уступает любому целевому агенту по size of community.
CC-Switch (~32 000 stars) решает другую задачу (provider management).

### 2. Конкатенация доминирует над трансляцией

Большинство инструментов используют одну из двух стратегий:

- **Symlinks**: один файл → несколько путей (Saddle, ai-rules-sync).
- **Конкатенация**: Markdown-файлы склеиваются и записываются по путям (Ruler, rulesync).

Семантическая трансляция (понимание структуры конфигурации и преобразование
между форматами) практически не реализована. dotagent приближается к этому
через бидирекциональный парсинг, но ограничен правилами.

### 3. Scope расширяется, но полноту не достиг ни один инструмент

Большинство инструментов покрывают текстовые инструкции. Microsoft APM
и getsentry/dotagents расширяют scope до skills, MCP, hooks и agents,
но ни один инструмент не покрывает полный набор (instructions + commands +
skills + agents + MCP + settings).

| Аспект конфигурации | Покрытие инструментами                       |
| ------------------- | -------------------------------------------- |
| Instructions/rules  | 15+ инструментов                             |
| Skills (SKILL.md)   | 7–9 инструментов (APM, getsentry, Ruler и др.) |
| MCP servers         | 3–4 инструмента (APM, getsentry, Ruler)      |
| Hooks               | 2 инструмента (APM, getsentry)               |
| Slash commands      | 1–2 инструмента                              |
| Sub-agents          | 1–2 инструмента (APM, agents)                |
| Agent settings      | 0 инструментов                               |

### 4. Валидация — неадресованная проблема

Только LNAI (Zod) предлагает type-safe валидацию канонической конфигурации.
Ни один инструмент не валидирует сгенерированные файлы против agent-specific
schema. Это означает, что ошибки обнаруживаются только при запуске агента.

### 5. Конвергенция стандартов снижает барьер входа

Принятие AGENTS.md (60 000+ проектов) и SKILL.md (широкая adoption) создаёт
общую основу, на которой инструменты дистрибуции могут строить.
Cross-agent portable path `.agents/skills/` поддерживается Codex CLI,
Gemini CLI и OpenCode. Эта конвергенция упрощает задачу Agent SDS:
для skills трансляция сводится к копированию в agent-specific paths.

### 6. Gemini CLI Discussion #1471 — артикуляция проблемы

В обсуждении [Gemini CLI #1471](https://github.com/google-gemini/gemini-cli/discussions/1471)
сообщество сформулировало: «стандартизация имени файла — лёгкая часть;
сложная часть — content schema с типизированными секциями». Это точно
описывает задачу Agent SDS: не просто синхронизация файлов, а семантическая
модель конфигурации с трансляцией.

## Заключение

### Ответ на главный вопрос: существует ли прямой конкурент Agent SDS?

**Значительные частичные конкуренты существуют, полного — нет.**

Microsoft APM и getsentry/dotagents покрывают широкий scope конфигурации
(skills, MCP, hooks, agents), но используют модель package manager
(установка пакетов из registry), а не transpiler (трансляция единого
канонического формата). Ruler, LNAI и dotagent решают подмножество задачи
(синхронизация инструкций). .agents/ Protocol архитектурно наиболее близок,
но находится в состоянии DRAFT.

Ни один найденный инструмент не реализует **совокупность** ключевых
характеристик Agent SDS:

1. **Каноническая модель** с формальной schema и валидацией — LNAI (Zod)
   ближе всего, но ограничена rules.
2. **Семантическая трансляция** между структурированными форматами
   (JSON ↔ TOML ↔ YAML ↔ Markdown) — не реализована ни одним инструментом.
   APM compile генерирует Markdown, но не транслирует structured configs.
3. **Полный scope конфигурации** (instructions + commands + skills + agents + MCP) —
   APM ближе всего, но не покрывает Codex CLI и Gemini CLI.
4. **Plugin/adapter архитектура** для добавления новых агентов — ни один
   инструмент не предоставляет формальный adapter API с integration tests.

### Рекомендация: build

Рекомендуется **build** (создание с нуля) по следующим основаниям:

1. **Разрыв в трансляции**: доминирующие подходы — конкатенация Markdown
   (Ruler), symlinks (Saddle, ai-rules-sync) или package management
   (APM, getsentry/dotagents). Ни один инструмент не реализует семантическую
   трансляцию между structured config форматами (JSON ↔ TOML ↔ YAML).
   Agent SDS требует transpiler, которого нет ни в одном существующем
   инструменте.

2. **Разрыв в архитектурной модели**: APM и getsentry/dotagents решают
   задачу *distribution* (установка пакетов из registry), Agent SDS —
   задачу *transpilation* (трансляция канонического формата в agent-specific).
   Это разные архитектурные модели, не адаптируемые друг к другу.

3. **Отсутствие plugin-архитектуры**: ни один инструмент не предоставляет
   формальный adapter API с integration tests per adapter. Agent SDS
   с plugin-архитектурой — дифференцирующий фактор.

4. **join нецелесообразен**: Microsoft APM (наиболее перспективный) использует
   Python/Go и package manager модель — несовместим с TypeScript-экосистемой
   и transpiler-архитектурой Agent SDS. Ruler (наиболее зрелый) архитектурно
   несовместим (конкатенация vs трансляция). agentsfolder (наиболее близкий
   по видению) — DRAFT без community.

5. **adapt нецелесообразен**: chezmoi решает другую задачу (dotfiles vs
   project configs). Существующие инструменты потребуют полной переработки
   для достижения целей Agent SDS — стоимость адаптации сопоставима
   с созданием с нуля, но с legacy constraints.

### Стратегические рекомендации

1. **Использовать AAIF-стандарты**: AGENTS.md и SKILL.md как опорные форматы
   канонической модели. Agent SDS должен быть совместим с этими стандартами,
   а не конкурировать.

2. **Учесть `.agents/` convention**: генерировать `.agents/skills/`
   как один из выходных путей (cross-agent portable).

3. **Отслеживать Microsoft APM и Ruler**: APM (Microsoft org, широкий scope,
   dependency resolution) и Ruler (2 500 stars, 30+ агентов) — наиболее
   вероятные кандидаты на расширение scope. Мониторинг roadmap рекомендуется.

4. **Рассмотреть совместимость с APM**: модели «transpiler» и «package manager»
   комплементарны — Agent SDS может транслировать каноническую конфигурацию,
   а APM — распределять переиспользуемые skills/agents как пакеты.
   СЛЕДУЕТ оценить возможность интеграции.

5. **Бидирекциональный import (от dotagent)**: возможность импорта
   существующих конфигураций снижает барьер входа для пользователей.
   СЛЕДУЕТ рассмотреть как feature для Agent SDS v2.

6. **Позиционирование**: «OpenTelemetry для агентных конфигов» — уникальное
   позиционирование, не используемое ни одним конкурентом. Акцент на canonical
   format + adapters + validation как ключевые дифференциаторы.

### Риски

- **Скорость рынка**: пространство активно и фрагментировано. Microsoft APM
  или Ruler может расширить scope быстрее, чем Agent SDS достигнет MVP.
  APM особенно опасен: поддержка Microsoft, широкий scope, dependency
  resolution.
- **Конвергенция стандартов**: если `.agents/` Protocol получит поддержку AAIF,
  каноническая модель Agent SDS может потребовать пересмотра.
- **AGENTS.md adoption**: если все агенты перейдут на `AGENTS.md` и `.agents/`
  как единый стандарт, потребность в трансляции файлов инструкций снизится
  (но трансляция settings, MCP, commands останется актуальной).
- **getsentry/dotagents adoption**: поддержка Sentry может привести к быстрому
  росту adoption в open-source community. Расширение scope dotagents
  на commands и settings сузит дифференциацию Agent SDS.

## Источники

### Официальные сайты и документация инструментов

- [Ruler — GitHub](https://github.com/intellectronica/ruler)
- [Ruler — npm](https://www.npmjs.com/package/@intellectronica/ruler)
- [LNAI — Official Site](https://lnai.sh/)
- [LNAI — GitHub](https://github.com/KrystianJonca/lnai)
- [dotagent — GitHub](https://github.com/johnlindquist/dotagent)
- [Saddle — Official Site](https://saddle.sh)
- [ai-rules-sync — GitHub](https://github.com/lbb00/ai-rules-sync)
- [chezmoi — Official Site](https://www.chezmoi.io/)
- [agentsfolder/spec — GitHub](https://github.com/agentsfolder/spec)
- [.agents/ Protocol — Official Site](https://dotagentsprotocol.com)
- [rulesync — GitHub](https://github.com/dyoshikawa/rulesync)
- [PRPM — Official Site](https://prpm.dev/)
- [CC-Switch — GitHub](https://github.com/farion1231/cc-switch)
- [knowhub — GitHub](https://github.com/yujiosaka/knowhub)
- [apc-cli — GitHub](https://github.com/FZ2000/apc-cli)
- [skillpm — GitHub](https://github.com/sbroenne/skillpm)
- [agent-command-sync — GitHub](https://github.com/hatappo/agent-command-sync)
- [agents (amtiYo) — GitHub](https://github.com/amtiYo/agents)
- [Microsoft APM — Official Site](https://microsoft.github.io/apm/)
- [Microsoft APM — GitHub](https://github.com/microsoft/apm)
- [Microsoft APM Action — GitHub](https://github.com/microsoft/apm-action)
- [getsentry/dotagents — GitHub](https://github.com/getsentry/dotagents)
- [getsentry/dotagents — Documentation](https://docs.sentry.io/ai/dotagents/)
- [getsentry/dotagents — Site](https://dotagents.sentry.dev/)
- [block/ai-rules — GitHub](https://github.com/block/ai-rules)
- [dotai — Official Site](https://dotai.nullbrain.com/)
- [agent-sync — GitHub](https://github.com/ZacheryGlass/agent-sync)

### Стандарты и спецификации

- [AGENTS.md — Official Specification](https://agents.md/)
- [AGENTS.md — GitHub Repository](https://github.com/agentsmd/agents.md)
- [Agent Skills Specification](https://agentskills.io/specification)
- [Agent Skills — Anthropic GitHub](https://github.com/anthropics/skills)
- [Model Context Protocol — Official Site](https://modelcontextprotocol.io/)
- [AAIF — Linux Foundation](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation)
- [NIST AI Agent Standards Initiative](https://www.nist.gov/caisi/ai-agent-standards-initiative)

### Блоги и обсуждения

- [Ruler — Unified Configuration Management (Medium)](https://addozhang.medium.com/ruler-unified-configuration-management-for-multiple-ai-coding-assistants-247df7d4754a)
- [LNAI — Hacker News Discussion](https://news.ycombinator.com/item?id=46868318)
- [Eight Coding LLM Tools, One Configuration (Dave Beckett)](https://www.dajobe.org/blog/2026/03/16/eight-coding-llm-tools-one-configuration/)
- [One Skills Brain with chezmoi (DEV Community)](https://dev.to/dotwee/one-skills-brain-for-codex-claude-cursor-and-copilot-with-chezmoi-2p3k)
- [Sync Claude Code with chezmoi and age](https://www.arun.blog/sync-claude-code-with-chezmoi-and-age/)
- [Dotfiles: Taming AI Coding Agents (Dr. Mowinckel)](https://drmowinckels.io/blog/2026/dotfiles-coding-agents/)
- [Dotfiles for AI-Assisted Development (Dylan Bochman)](https://dylanbochman.com/blog/2026-01-25-dotfiles-for-ai-assisted-development/)
- [Keep your AGENTS.md in sync (Kaushik Gopal)](https://kau.sh/blog/agents-md/)
- [Gemini CLI Discussion #1471 — AGENTS.md Thought Leadership](https://github.com/google-gemini/gemini-cli/discussions/1471)
- [AGENTS.md — Rise of an Open Standard (Tessl)](https://tessl.io/blog/the-rise-of-agents-md-an-open-standard-and-single-source-of-truth-for-ai-coding-agents/)
- [contextai — AI Context Management (DEV Community)](https://dev.to/madeburo/ai-context-management-across-claude-cursor-kiro-gemini-and-custom-agents-2n1f)
- [How to Write a Great agents.md (GitHub Blog)](https://github.blog/ai-and-ml/github-copilot/how-to-write-a-great-agents-md-lessons-from-over-2500-repositories/)

### Академические публикации

- [Context Engineering for AI Agents in OSS (arXiv: 2510.21413)](https://arxiv.org/abs/2510.21413)
- [Agent READMEs: Empirical Study (arXiv: 2511.12884)](https://arxiv.org/html/2511.12884)
- [Empirical Study of Developer-Provided Context (arXiv: 2512.18925)](https://arxiv.org/pdf/2512.18925)
- [Configuring Agentic AI Coding Tools (arXiv: 2602.14690)](https://arxiv.org/html/2602.14690)
- [Everything is Context: Agentic FS Abstraction (arXiv: 2512.05470)](https://arxiv.org/abs/2512.05470)
- [Codified Context: Infrastructure for AI Agents (arXiv: 2602.20478)](https://arxiv.org/html/2602.20478v1)
- [Orchestration of Multi-Agent Systems (arXiv: 2601.13671)](https://arxiv.org/html/2601.13671v1)
