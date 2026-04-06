---
type: research
summary: Редизайн манифестов agloom — выбор модели для config.yml и plugin.yml
description: >-
  Сравнительный анализ моделей унификации/разделения config.yml и plugin.yml
  в свете use case переиспользования правил между проектами одного автора,
  с ответами на 7 конкретных вопросов и деревом последующих spec-cycles.
relates:
  - docs/specs/plugin-manifest.md
  - docs/specs/plugin-loading.md
  - docs/specs/plugin-values.md
  - docs/specs/config.md
  - docs/specs/layer-model.md
  - docs/specs/git-plugin-loading.md
  - docs/specs/skills-transpiler.md
  - docs/specs/agents-transpiler.md
---

# Исследование: редизайн манифестов agloom

Дата: 2026-04-06.

## 1. Контекст и проблема

### 1.1. Ситуация

Agloom использует два конфигурационных файла:

- `.agloom/config.yml` — манифест проекта-потребителя: `adapters`,
  `plugins`, `variables`.
- `plugin.yml` — манифест распространяемого плагина: обязательные
  identity-поля (`name`, `version`, `description`, `author`),
  опциональные `license`, `homepage`, `keywords`, `variables`.

Текущая спецификация `plugin-manifest.md` явно запрещает
`config.yml` в директории плагина, что исключает dogfooding:
автор плагина не может использовать agloom внутри репо плагина.

### 1.2. Use case и приоритеты

- **Primary**: переиспользование правил между двумя проектами
  одного автора без релизного цикла и без выноса в отдельный
  репозиторий.
- **Secondary**: distribution через git-ref сторонним пользователям
  (единственный известный внешний плагин — `cusxy/skill-cycling`,
  упоминается в `docs/reference/config.md:168` и
  `docs/specs/plugin-values.md:214`).

Ключевая проблема primary use case: текущая модель требует
вынести shareable rules в отдельный репозиторий и дать ему
identity-поля (`name`, `version`), которые в живом основном
репо никто не будет поддерживать.

### 1.3. Поправки к утверждениям из обсуждения (findings)

Источник истины — код и спецификации, не диалог.

- **F1** — «Адаптеры выводятся из структуры (`skills/<adapter>/`)»:
  неверно. Skills/agents плоские; по адаптерам делятся только
  `overlays/<adapterId>/`. Источник: `skills-transpiler.md`,
  `agents-transpiler.md`, `plugin-manifest.md`.
- **F2** — «В `config.yml` shorthand variables не поддерживается»:
  неверно. Поддерживаются обе формы (shorthand и объектный
  `VariableDeclaration`); `description` опционален. Источник:
  `src/cli/config.ts:204-278`, `plugin-values.md`.
- **F3** — «Identity-поля плагина совместимы с жизнью внутри
  основного репо»: конфликт. `plugin.yml` требует их,
  `config.yml` в плагине запрещён. Легального пути для
  in-tree shareable rules нет.
- **F4** — «Транзитивные зависимости уже реализованы»: неверно;
  «итерация 2» по `plugin-manifest.md` § Вне scope.
- **F5** — «Двойной смысл `adapters:` уже разведён»: в
  `config.yml` = consumer-side; в `plugin.yml` поле отсутствует.
  Конфликта имён нет, декларации тоже нет.
- **F6** — «Unified — приемлемый кандидат»: отвергнуто use case
  (мёртвый груз identity). См. [models/a-unified.md](models/a-unified.md).

## 2. Текущее состояние

**`config.yml`** (см. `config.md`, `plugin-values.md`,
`git-plugin-loading.md`):

- `adapters: array<string>` — опционально, непустой.
- `plugins: array<string | LocalPluginEntry | GitPluginEntry>` —
  опционально; строковая форма автодетектирует local/git.
- `variables: object` — опционально; значение = строка
  (shorthand) или объектный `VariableDeclaration`.

**`plugin.yml`** (см. `plugin-manifest.md`):

- Обязательны: `name`, `version` (semver), `description`,
  `author: { name, email, url? }`.
- Опциональны: `license`, `homepage`, `keywords`, `variables`.
- НЕТ полей `adapters`, `plugins`, `dependencies` (F4, F5).

**Структура плагина** повторяет `.agloom/` без префикса:
`AGLOOM.md`, `overlays/<adapterId>/`, `skills/`, `agents/`.
Skills и agents плоские (F1); адаптер-специфичные артефакты
только в `overlays/`.

**Layer model** (`layer-model.md` § Порядок): per-adapter
`Плагин A → Плагин B → ... → Локальный проект`. Локальный —
наивысший приоритет. Merge-eligible (`.json`, `.yaml`, `.toml`) —
deep merge; остальное — last-writer-wins. Транзитивные deps
не реализованы.

## 3. Критерии оценки моделей

Критерии сформулированы до анализа моделей (фаза 2 методологии),
для защиты от anchoring bias.

| ID  | Критерий                                                                    |
| --- | --------------------------------------------------------------------------- |
| K1  | Поддержка primary use case (переиспользование без релизного цикла)          |
| K2  | Поддержка secondary use case (git-ref distribution)                         |
| K3  | Отсутствие «мёртвого груза» — полей, которые в живом репо не поддерживаются |
| K4  | Эстетика семантики: имена файлов/полей точно отражают роль                  |
| K5  | Совместимость с dogfooding (agloom внутри репо плагина)                     |
| K6  | Объём изменений в коде                                                      |
| K7  | Объём изменений в спецификациях                                             |
| K8  | Согласованность с layer model и текущим алгоритмом resolve                  |
| K9  | Прозрачность ментальной модели для нового пользователя                      |
| K10 | Расширяемость до транзитивных зависимостей плагинов                         |

## 4. Сравнительный анализ моделей

Детали каждой модели — в отдельных файлах:

- [A — Unified manifest (отвергнута)](models/a-unified.md)
- [B — Дихотомия + in-tree подплагины в `.agloom/plugins/`](models/b-intree-subplugins.md)
- [C1 — Manifest-only (только дихотомия)](models/c1-manifest-only.md)
- [C2 — Includes (composition без плагинов)](models/c2-includes.md)
- [C3 — Гибрид B+C1 с явным `kind:`](models/c3-hybrid.md)

### 4.1. Сравнительная таблица

| Критерий      | A      | B      | C1     | C2     | C3     |
| ------------- | ------ | ------ | ------ | ------ | ------ |
| K1 primary    | medium | high   | low    | high   | high   |
| K2 secondary  | high   | high   | high   | low    | high   |
| K3 без груза  | no     | yes    | yes    | yes    | yes    |
| K4 семантика  | low    | high   | medium | medium | high   |
| K5 dogfooding | yes    | yes    | no     | yes    | yes    |
| K6 код        | large  | small  | small  | medium | small  |
| K7 спеки      | large  | medium | small  | large  | medium |
| K8 слои       | medium | high   | high   | low    | high   |
| K9 ментальная | low    | high   | high   | medium | medium |
| K10 deps      | easy   | easy   | medium | hard   | easy   |

## 5. Ответы на вопросы

Детальные ответы на семь вопросов из context вынесены
в [questions.md](questions.md). Краткая сводка:

- **Q1. Модели** — рассмотрено пять (A–C3). Отвергнуты A, C1, C2;
  рекомендована B; C3 — резервный вариант.
- **Q2. Переименование `config.yml`** — нет кандидата, который
  однозначно превосходит. Сохранить `config.yml`.
- **Q3. Транзитивные deps** — поле `plugins:` в `plugin.yml`,
  DFS post-order, three-color обнаружение циклов, first-wins
  для транзитивных появлений, относительные пути от родителя.
- **Q4. Декларация адаптеров** — опциональное `targets:`
  (информативное, warning при пустом пересечении).
- **Q5. `variables` в `config.yml`** — полный формат уже
  поддерживается (F2); требуется cross-reference в `config.md`.
- **Q6. Миграция** — аддитивна; `cusxy/skill-cycling` не
  требует изменений.
- **Q7. Двойной смысл `adapters`** — конфликта имён нет;
  решается введением `targets:` в plugin.yml.

## 6. Рекомендованная модель

**Модель B — in-tree подплагины** с дополнениями:

1. Снять запрет `config.yml` в директории плагина.
2. Добавить опциональное `targets:` в `plugin.yml`.
3. Добавить опциональное `plugins:` в `plugin.yml` (транзитивные
   deps; DFS, first-wins, обнаружение циклов).
4. `config.yml` НЕ переименовывается.
5. `variables:` в `config.yml` остаётся как есть.

Обоснование — в [models/b-intree-subplugins.md](models/b-intree-subplugins.md).
B выигрывает по K1 (решает primary use case), K3 (identity
изолированы в `plugin.yml` подплагина), K4 (чёткое разделение
consumer/producer), K5 (dogfooding после снятия запрета), K8
(порядок слоёв без изменений) и имеет наименьшую стоимость
реализации (K6).

## 7. Дерево spec-cycles и открытые вопросы

Последовательность spec-cycles для реализации модели B
и открытые вопросы для решения пользователем — в
[next-steps.md](next-steps.md).

Вкратце: шесть spec-cycles (1 — снять запрет `config.yml`
в плагине; 2 — конвенция `.agloom/plugins/`; 3 — поле
`targets:`; 4 — variables cross-reference; 5 — транзитивные
deps; 6 — docs). Шаги 1/2/4 параллельны; 3 зависит от 1, 2;
5 зависит от 1, 2, 3; 6 — последний.

## 9. Источники

- `docs/specs/plugin-manifest.md` — формат `plugin.yml`.
- `docs/specs/plugin-loading.md` — Resolve Plugins, layer
  integration.
- `docs/specs/plugin-values.md` — variables/values система.
- `docs/specs/config.md` — формат `config.yml`.
- `docs/specs/git-plugin-loading.md` — git-плагины и формат
  `PluginEntry`.
- `docs/specs/layer-model.md` — модель слоёв и порядок
  применения.
- `docs/specs/skills-transpiler.md` — структура
  `<plugin>/skills/` (источник F1).
- `docs/specs/agents-transpiler.md` — структура
  `<plugin>/agents/` (источник F1).
- `src/cli/config.ts:204-278` — фактическая реализация
  `variables` в `config.yml` (источник F2).
- `.agloom/config.yml` — минимальный пример в текущем репо.
