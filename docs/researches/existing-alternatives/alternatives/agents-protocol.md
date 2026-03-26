---
type: research
summary: ".agents/ Protocol и agentsfolder — спецификации единого каталога для конфигурации AI-агентов"
relates:
  - docs/researches/existing-alternatives/RESEARCH.md
---

# .agents/ Protocol и agentsfolder

## Общая характеристика

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

## Анализ по критериям

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
deterministic resolution — архитектурно наиболее близка к Agloom.

## Плюсы

- Наиболее полный scope конфигурации (MCP, instructions, skills, agents,
  tasks, memories).
- Формальная спецификация (agentsfolder AGENTS-1) — единственное решение
  со спецификацией канонической модели.
- `.agents/skills/` уже поддерживается несколькими агентами.
- Архитектурно наиболее близка к видению Agloom.

## Минусы

- **Критически низкая зрелость**: DRAFT-спецификации, incomplete references,
  минимальная adoption.
- Нет корпоративной поддержки (не под AAIF, в отличие от AGENTS.md и SKILL.md).
- agentsfolder CLI написан на Rust — несовместим с TypeScript-экосистемой
  Agloom.
- Ни один агент не поддерживает `.agents/` как единый каталог нативно —
  агенты читают собственные каталоги (`.claude/`, `.codex/`, `.gemini/`,
  `.opencode/`).
- Спецификация без работающего инструмента и community — риск abandonware.

## Контекст применимости

.agents/ Protocol и agentsfolder представляют перспективное направление
стандартизации, но не готовы к production-использованию. Могут стать основой
для будущего стандарта, если получат поддержку AAIF или major vendors.

## Источники

- [agentsfolder/spec — GitHub](https://github.com/agentsfolder/spec)
- [.agents/ Protocol — Official Site](https://dotagentsprotocol.com)
