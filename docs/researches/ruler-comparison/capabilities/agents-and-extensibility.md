---
type: research
summary: >-
  Сравнение поддержки агентов и расширяемости: 31+ агент в Ruler vs 6
  в Agloom, strategy pattern vs adapter registry.
description: >-
  Детальный анализ двух возможностей: количество поддерживаемых агентов
  и архитектурный подход к добавлению новых. Сравнение IAgent interface
  (Ruler) с adapter registry (Agloom), оценка трудозатрат на добавление
  агента.
relates:
  - docs/researches/ruler-comparison/RESEARCH.md
---

# Агенты и расширяемость

## 4. Поддержка агентов

### Ruler (31+ агент)

Ruler поддерживает: Claude Code, Copilot, Cursor, Windsurf, Cline,
Codex CLI, Aider, Gemini CLI, OpenCode, KiloCode, Roo Code, Goose,
Amp, Junie, Jules, Pi, Antigravity, AugmentCode, Amazon Q CLI,
Firebase Studio, OpenHands, Crush, Warp, Zed, Firebender,
Factory Droid, Mistral Vibe, Trae, Qwen Code, Kiro, JetBrains AI.

Большинство агентов пишут в `AGENTS.md` (стандарт de facto). Ряд агентов
имеет уникальные output-форматы: `.clinerules` (Cline), `.goosehints`
(Goose), `.idx/airules.md` (Firebase), `.openhands/microagents/repo.md`
(OpenHands).

### Agloom (6 адаптеров)

Claude, OpenCode, AGENTS.md, KiloCode, Codex, Gemini. OpenCode и KiloCode
зависят от agentsmd (`dependsOn: ["agentsmd"]`).

### Плюсы Ruler

- Покрытие: практически каждый популярный AI-агент поддерживается.
- Community adoption: больше пользователей = больше контрибьюций.
- Агенты с нестандартными форматами (Cline, Goose, Firebase) покрыты.

### Минусы Ruler

- Модель конкатенации: все агенты получают одинаковый текст, нет
  возможности адаптировать инструкции под специфику агента.
- Поддержка 31 агента при любом изменении формата = потенциально
  31 point of failure.

### Плюсы Agloom

- Per-agent content: каждый агент получает оптимизированные инструкции.
- Качество над количеством: 6 хорошо поддерживаемых адаптеров.

### Минусы Agloom

- Gap: пользователи Cursor, Windsurf, Cline, Copilot не могут
  использовать Agloom.
- Низкое покрытие снижает adoption.

## 5. Расширяемость (добавление нового агента)

### Ruler: Strategy pattern (IAgent)

Для добавления агента в Ruler необходимо создать один файл --
реализацию `IAgent` interface (или наследника `AbstractAgent`).

Пример (ClaudeAgent.ts, 31 строка):

```typescript
export class ClaudeAgent extends AbstractAgent {
  getIdentifier(): string {
    return "claude";
  }
  getName(): string {
    return "Claude Code";
  }
  getDefaultOutputPath(projectRoot: string): string {
    return path.join(projectRoot, "CLAUDE.md");
  }
  supportsMcpStdio(): boolean {
    return true;
  }
  supportsMcpRemote(): boolean {
    return true;
  }
  supportsNativeSkills(): boolean {
    return true;
  }
}
```

Для агентов с нестандартным форматом (Aider, OpenHands) переопределяется
`applyRulerConfig()`. MCP-capabilities декларируются через boolean-методы.
Добавление агента -- ~30 строк + регистрация в `index.ts`.

**Трудозатраты**: ~30 минут на типичный агент (AGENTS.md output).

### Agloom: Adapter registry

Для добавления агента в Agloom необходимо:

1. Создать instructions adapter (transpile AGLOOM.md -> agent format).
2. Создать skills adapter (если агент поддерживает skills).
3. Создать agents adapter (если агент поддерживает sub-agents).
4. Создать commands adapter (если агент поддерживает commands).
5. Создать MCP adapter (если агент поддерживает MCP).
6. Создать permissions adapter (если агент поддерживает permissions).
7. Добавить entry в `adapterRegistry` с описанием, paths, targetFiles.

Пример entry (Claude, ~25 строк в registry):

```typescript
{
  id: "claude",
  description: "Claude Code",
  instructions: new ClaudeAdapter(allowedAgentIds),
  skills: new ClaudeSkillAdapter(),
  agents: new ClaudeAgentAdapter(),
  commands: new ClaudeCommandAdapter(),
  mcp: new ClaudeMcpAdapter(),
  permissions: new ClaudePermissionsAdapter(),
  targetFiles: ["CLAUDE.md", ".mcp.json"],
  paths: { skills: ".claude/skills", agents: ".claude/agents", ... },
}
```

**Трудозатраты**: ~2-4 часа (6 адаптеров + registry entry + тесты).

### Плюсы Ruler

- Низкий барьер: 1 файл, 30 строк, 30 минут.
- Community-friendly: контрибьюторам легко добавить агента.
- Объясняет, почему 31+ агент уже поддерживается.

### Минусы Ruler

- Нет гранулярности: нет отдельных адаптеров для skills, MCP, permissions.
  Вся логика в одном классе или в shared utilities.
- MCP-обработка вынесена в `apply-engine.ts` с agent-specific ветвлениями
  (`if (agent.getIdentifier() === 'openhands')`) -- код не масштабируется.
- Skills propagation -- копипаста: каждый агент = отдельная функция
  `propagateSkillsFor<Agent>` с идентичным телом (1400+ строк дублирования).

### Плюсы Agloom

- SRP: каждый адаптер отвечает за один аспект (instructions, skills, MCP).
- Нет дублирования: generic pipeline обрабатывает все адаптеры одинаково.
- Тестируемость: каждый адаптер тестируется изолированно.

### Минусы Agloom

- Высокий барьер: 6 файлов + registry entry + тесты = несколько часов.
- Overengineering для агентов с простым output (AGENTS.md + ничего).
- Сдерживает рост числа поддерживаемых агентов.

## Рекомендации

- **Приоритетные агенты для добавления**: Cursor, Windsurf, Copilot, Cline.
  Cursor и Windsurf читают AGENTS.md (уже покрыты через agentsmd), но
  имеют уникальные MCP-пути (`.cursor/mcp.json`, `.windsurf/mcp_config.json`).
- **Снижение барьера**: рассмотреть lightweight-адаптер для агентов, которым
  нужен только AGENTS.md output без собственных skills/MCP/permissions.
  Это позволит добавлять такие агенты через 1 registry entry без создания
  N файлов-адаптеров.
