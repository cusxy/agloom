---
summary: Агентский пайплайн как программа
description: >-
  Исследование структурных аналогий между системой агентов spec-cycle
  и программной инженерией, обзор индустриального ландшафта
blueprint: schemas/draft/research.schema.yml
relates:
  - .agloom/docs/agent-sop-patterns.md
  - .agloom/docs/dor-dod-criteria.md
  - .agloom/skills/spec-cycle/SKILL.md
---

# Исследование: агентский пайплайн как программа

Дата: 2026-03-15

## Контекст исследования

Система spec-cycle (`.agloom/skills/spec-cycle/`) оркестрирует 6 агентов в цикле specify -> test -> implement
с quality gates между фазами. В процессе развития системы обнаружено, что её структура воспроизводит паттерны
программной инженерии: SKILL.md = main loop, агенты = классы с конструкторами и контрактами, документация = shared
libraries. Исследование анализирует точность этих аналогий, сопоставляет с индустриальным ландшафтом и определяет
недостающие компоненты для перехода к валидируемой системе.

## Часть 1. Маппинг аналогий

### 1.1. Точные аналогии

| Концепция SE           | Реализация в spec-cycle                                                          | Обоснование                                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `main()` + event loop  | SKILL.md (оркестратор)                                                           | Цикл: читает состояние -> решает какой агент запустить -> интерпретирует результат -> переходит к следующему шагу |
| Design by Contract     | DoR = preconditions, DoD = postconditions, findings = exception specification    | Паттерн Бертрана Мейера. Агент не запускается при нарушении DoR, не завершается при нарушении DoD                 |
| Type signature         | Структурированный вход (scope+context) -> выход (verdict+artifacts+findings+...) | Все агенты реализуют один интерфейс (agent-protocol.md). JSON-блок выхода — возвращаемый тип                      |
| Interface segregation  | Единый протокол + agent-specific finding types                                   | Общий интерфейс с полиморфными деталями (type finding зависит от агента)                                          |
| Separation of concerns | Запрет на редактирование артефактов чужой фазы                                   | Enforcement of module boundaries: test-deriver не правит specs, spec-implementer не правит тесты                  |
| Composition            | Агент = собственная логика + общие документы (spec-format.md, agent-protocol.md) | Агент «импортирует» общие знания, аналог `extends`/`implements`                                                   |
| Pipeline pattern       | Валидация: format -> build -> lint -> test                                       | CI/CD pipeline для кода-артефактов                                                                                |
| Chain of custody       | spec -> test -> impl с запретом обратных модификаций                             | Трассируемость: каждый артефакт создан определённым агентом, изменения ведут к полному replay от точки возврата   |

### 1.2. Частичные аналогии

| Концепция SE    | Реализация                                 | Ограничение                                                                                           |
| --------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Shared library  | docs/, agent-protocol.md, spec-format.md   | Скорее header files — определяют vocabulary и конвенции, но не содержат исполняемой логики            |
| Static analysis | dor-dod-criteria.md (мета-линтинг DoR/DoD) | Выполняется вручную, не автоматизировано; критерии ISO 29148 определены, но не применяются программно |

### 1.3. Где аналогия ломается

**Недетерминизм.** Один и тот же агент с одним и тем же входом может дать разный результат.
В программировании `f(x) = y` всегда. У агентов `agent(scope, context) ~ result` — приблизительно.
Это исключает классическое equality-based unit-тестирование и требует property-based подходов.

**Отсутствие compile-time.** Markdown-инструкции не транслируются в промежуточное представление —
они интерпретируются LLM при каждом запуске заново. Система ближе к динамически типизированному
интерпретируемому языку (Python), чем к компилируемому (Rust). «Компилятор» в строгом смысле
невозможен — возможен linter (статический анализ до запуска) + runtime validator (проверка
свойств выхода после запуска).

**Семантическая неточность контрактов.** `scope: path[]` — структурно точен. `context: string` —
семантически размыт. Контракт гарантирует форму, но не содержание. Два отчёта reviewer'а формально
оба `string`, но семантически несопоставимы.

### 1.4. Уточнённая модель

Система spec-cycle — **интерпретируемая программа**, не компилируемая.

Следствия:

- «Компилятор» невозможен. Возможен **linter** + **runtime validator**.
- «Линкер» невозможен. Возможен **dependency graph validator**.
- «Тесты» возможны на уровне **свойств** (property-based), не на уровне значений (equality).

Лучшая аналогия: не C/C++ toolchain (compiler -> linker -> executable),
а **Python/JS ecosystem** (interpreter + linter + type checker + test runner + formatter).

## Часть 2. Индустриальный ландшафт

### 2.1. DSPy (Stanford) — промпты как программы

DSPy явно применяет SE-концепции к LLM-пайплайнам:

- **Signatures** = type signatures для I/O (`"question -> answer"`)
- **Modules** = composable units (аналог классов: `dspy.ChainOfThought`, `dspy.ReAct`)
- **Compilers/Optimizers** (MIPROv2, GEPA) = автоматическая оптимизация промптов
- **Assertions** (arXiv 2312.13382):
  - `dspy.Assert` = hard constraint, останавливает pipeline после N ретраев (аналог DoR)
  - `dspy.Suggest` = soft constraint, логирует и продолжает
  - Оба поддерживают **backtracking с инъекцией ошибки** — при провале pipeline ретраит с feedback
  - Результат: +164% compliance с ограничениями
- Парадигма: **"define-compile-evaluate"** вместо "write-test-repeat"

Отличие от spec-cycle: DSPy работает на уровне отдельных LLM-вызовов (prompt-уровень),
spec-cycle оркестрирует агентов (workflow-уровень). Разные уровни абстракции, та же идея.

Зрелость: production. Релевантность: высокая концептуально (паттерн Assert/Suggest
напрямую применим к DoR/DoD).

Источники:

- [DSPy](https://dspy.ai/)
- [DSPy Assertions (arXiv 2312.13382)](https://arxiv.org/abs/2312.13382)
- [DSPy GitHub](https://github.com/stanfordnlp/dspy)

### 2.2. CodeSpeak (Kotlin team) — спецификации как исходный код

CodeSpeak — programming language, где structured English specifications — исходный код.
LLM компилирует specs в Python/Go/TS/etc. Создатель: Andrey Breslav (Kotlin).

Ключевые SE-концепции:

- **Компилятор с разрешением неоднозначностей** — если spec допускает >1 интерпретацию,
  компилятор спрашивает автора. Это аналог «линтера для спецификаций».
- **Инкрементальная компиляция** — хранит сгенерированный код рядом со spec, делает
  инкрементальные изменения (компенсация недетерминизма LLM).
- **Mixed-mode** — часть кода вручную, часть из спецификаций.
- **Bidirectional sync** — конвертация кода обратно в спецификации.

Ключевое отличие: CodeSpeak компилирует specs в **код**; spec-cycle использует specs
для **управления процессом** создания кода агентами.

Зрелость: alpha (март 2026). Релевантность: высокая концептуально.

Источники:

- [CodeSpeak](https://codespeak.dev/)
- [CodeSpeak Blog: Transition from Code to Specs](https://codespeak.dev/blog/codespeak-takeover-20260223)
- [Pragmatic Engineer: Language after Kotlin](https://newsletter.pragmaticengineer.com/p/the-programming-language-after-kotlin)

### 2.3. LangGraph — граф-компиляция

LangGraph моделирует агентов как directed graph (state machine):

- **Compilation step**: валидация связей, обнаружение циклов, оптимизация путей.
  Компилированный граф **immutable** — нельзя модифицировать в runtime.
- **Typed state** — shared memory object с типизированными полями.
- **Subgraphs** — модули: группы агентов как переиспользуемые компоненты.
- **Checkpoints** — persisted state snapshots для time-travel debugging.

Spec-cycle имеет аналогичный граф (spec-writer -> spec-reviewer -> ...),
но закодированный процедурно в SKILL.md, а не декларативно.

Зрелость: production. Релевантность: средне-высокая (паттерн compile-then-immutable
полезен, декларативный граф оправдан при >10-15 узлах).

Источники:

- [LangGraph](https://www.langchain.com/langgraph)
- [LangGraph 2025 Review](https://neurlcreators.substack.com/p/langgraph-agent-state-machine-review)

### 2.4. Agent Linting — статический анализ планов

- **plan-lint** (open-source): парсит machine-readable план агента, валидирует против
  схем, policy rules и эвристик, возвращает Pass/Fail с risk-score JSON.
  Есть VS Code extension, GitHub Action для CI/CD, custom rules через Python-модули.
- **PromptSage**: prompt builder, linter и sanitizer с guardrails.
- **CodeSpeak ambiguity detection**: линтер для спецификаций (см. выше).
- **Factory.ai linter-directed agents**: линтеры как направляющие для агентов в code generation.

Зрелость: prototype-to-early-production. Релевантность: высокая — паттерн
schema + policy + heuristics -> pass/fail + risk score прямо применим.

Источники:

- [plan-lint](https://github.com/cirbuk/plan-lint)
- [PromptSage](https://github.com/alexmavr/promptsage)
- [Factory.ai: Using Linters to Direct Agents](https://factory.ai/news/using-linters-to-direct-agents)

### 2.5. Agent Testing — пирамида тестирования для агентов

Статья Kohl et al. (arXiv 2601.18827, январь 2026) явно применяет SE testing pyramid к LLM-агентам:

- Используют OpenTelemetry traces для capture agent trajectories
- Мокируют LLM для воспроизводимости
- **Unit tests** для детерминистических компонентов (tools, memory)
- **Integration tests** для взаимодействий между компонентами
- **Acceptance tests** — полный прогон (дорого, стохастично)
- Отмечают: все коммерческие инструменты покрывают только acceptance-уровень

Ключевые фреймворки:

- **DeepEval** — «Pytest для LLM apps», CI/CD integration
- **Promptfoo** — declarative test configs, «test the system, not the model»
- **LangWatch** — Agent Simulation Engine, reproducible testing
- **Giskard** — автоматическая конвертация issues в regression test suites

Зрелость: research-to-prototype. Релевантность: очень высокая — структурная пирамида
напрямую применима к spec-cycle.

Источники:

- [Automated Structural Testing of LLM-Based Agents (arXiv 2601.18827)](https://arxiv.org/abs/2601.18827)
- [Promptfoo](https://github.com/promptfoo/promptfoo)
- [DeepEval](https://github.com/confident-ai/deepeval)

### 2.6. Observability

Стандарт де-факто: **OpenTelemetry** с nested spans для multi-step agent workflows.

- **OTel GenAI Semantic Conventions**: стандартные атрибуты для LLM-трейсинга.
  Новое расширение: `create_agent`, `invoke_agent` с `gen_ai.agent.name`.
- **Agentic Systems proposal** (GitHub issue #2664): атрибуты для tasks, actions,
  agents, teams, artifacts, memory.
- **Langfuse** (MIT, self-hosted, 19K+ stars): трейсинг, prompt versioning, evaluation.
  SDK v3 — OTel-native.
- **LangSmith** (commercial): глубокая интеграция с LangChain/LangGraph.

Зрелость: production. Релевантность: средняя (для однопользовательской системы
structured JSON log достаточен; OTel оправдан при масштабировании).

Источники:

- [OpenTelemetry GenAI Agent Spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/)
- [Langfuse](https://langfuse.com/)
- [LangSmith](https://www.langchain.com/langsmith/observability)

### 2.7. Формальная верификация workflow

- **StateFlow** (arXiv 2403.11322): LLM workflows как state machines. +13-28% success, 3-5x ниже стоимость.
- **NuSMV + Kripke structures** (arXiv 2510.03469): верификация LTL-свойств планов.
- **VeriPlan** (CHI 2025): model checking LLM-планов через Stormpy/PRISM.
- **TLA+/SPIN**: для критических подкомпонентов. LLM остаётся black box,
  но **окружающая логика** (переходы, маршрутизация) верифицируема.
- **Transactional integrity**: переход A -> B как атомарная операция;
  нарушение инварианта отклоняет переход. SMT solvers (Z3) для верификации.

Зрелость: research. Релевантность: низкая для MVP (граф из 6 узлов тривиален;
TLA+ оправдан при >15-20 узлах или критических требованиях к корректности).

Источники:

- [StateFlow (arXiv 2403.11322)](https://arxiv.org/html/2403.11322v1)
- [Bridging LLM Planning and Formal Methods (arXiv 2510.03469)](https://arxiv.org/html/2510.03469v1)
- [Trustworthy AI Agents: Formal Verification](https://www.sakurasky.com/blog/missing-primitives-for-trustworthy-ai-part-9/)

## Часть 3. Уровни зрелости системы

| Уровень       | Характеристика                                         | Аналогия               | Статус        |
| ------------- | ------------------------------------------------------ | ---------------------- | ------------- |
| 1. Ad-hoc     | Промпты в свободной форме, без структуры               | Bash-скрипты           | Пройден       |
| 2. Structured | Формализованные агенты, контракты, протоколы           | Модульная программа    | **Текущий**   |
| 3. Validated  | Автоматические проверки, тесты, observability          | Программа с CI/CD      | **Следующий** |
| 4. Optimized  | Автоматическая оптимизация агентов, A/B-тесты, метрики | Performance monitoring | Будущее       |

### Текущее покрытие (уровень 2)

| Свойство          | Определение                                                                    | Покрытие |
| ----------------- | ------------------------------------------------------------------------------ | -------- |
| Определённость    | Все компоненты, их связи и контракты описаны явно                              | ~80%     |
| Валидируемость    | Корректность проверяется до запуска (статически) и после запуска (динамически) | ~30%     |
| Воспроизводимость | Одинаковый вход даёт предсказуемый результат; отклонения обнаруживаемы         | ~20%     |
| Прозрачность      | Ход выполнения записывается и может быть проанализирован post-mortem           | ~10%     |

Подробный план перехода к уровню 3: [validated-level-plan.md](validated-level-plan.md).

## Заключение

| Решение                          | Выбор                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| Модель системы                   | Интерпретируемая программа (interpreter + linter + type checker + tests), не компилируемая |
| Ближайшие индустриальные аналоги | DSPy (signatures, assertions), CodeSpeak (spec compiler), LangGraph (graph compilation)    |
| Применимый паттерн тестирования  | Property-based testing pyramid (unit -> integration -> acceptance)                         |
| Применимый паттерн линтинга      | plan-lint: schema + policy + heuristics -> pass/fail                                       |
| Применимый паттерн observability | Structured JSON execution log (OTel — при масштабировании)                                 |
| Формальная верификация           | Не оправдана для MVP (6 узлов); пересмотреть при >15 узлах                                 |
