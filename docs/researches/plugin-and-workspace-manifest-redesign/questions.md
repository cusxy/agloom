---
type: research
summary: Ответы на семь вопросов редизайна манифестов agloom
description: >-
  Развёрнутые ответы на семь вопросов из context исследования
  редизайна config.yml и plugin.yml — модели, имя файла,
  транзитивные зависимости, декларация адаптеров, variables,
  миграция, двойной смысл adapters.
relates:
  - docs/researches/plugin-and-workspace-manifest-redesign/RESEARCH.md
---

# Ответы на вопросы

## Вопрос 1. Принципиально возможные модели

Рассмотрено пять моделей; вердикты — в файлах `models/`:

- **A unified** — отвергнута (K3/K4/K9, мёртвый груз identity).
  См. [models/a-unified.md](models/a-unified.md).
- **B in-tree subplugins** — рекомендована (K1/K3/K4/K5/K8).
  См. [models/b-intree-subplugins.md](models/b-intree-subplugins.md).
- **C1 manifest-only** — отвергнута (K1/K5, принуждает
  к отдельному репо). См. [models/c1-manifest-only.md](models/c1-manifest-only.md).
- **C2 includes** — отвергнута (K2/K8/K10, ломает distribution).
  См. [models/c2-includes.md](models/c2-includes.md).
- **C3 hybrid** — резервный, избыточен на v1.
  См. [models/c3-hybrid.md](models/c3-hybrid.md).

## Вопрос 2. Переименование `config.yml`

Критерии хорошего имени: **N1** нет конфликта с pnpm/yarn
workspaces; **N2** нет намёка на корневой repo-манифест;
**N3** отражает роль consumer внутри `.agloom/`;
**N4** не конфликтует с `config.yaml`, `settings.yml`,
`Chart.yaml`; **N5** короткое.

| Кандидат        | N1  | N2  | N3     | N4  | N5  | Вердикт                        |
| --------------- | --- | --- | ------ | --- | --- | ------------------------------ |
| `config.yml`    | yes | yes | low    | hit | yes | сохранить                      |
| `workspace.yml` | NO  | yes | low    | yes | yes | отвергнут (pnpm collision)     |
| `project.yml`   | yes | NO  | low    | yes | yes | отвергнут (корневой)           |
| `agloom.yml`    | yes | yes | medium | yes | yes | tautology внутри `.agloom/`    |
| `manifest.yml`  | yes | yes | medium | hit | yes | не отличает от plugin manifest |
| `consumer.yml`  | yes | yes | high   | yes | yes | точно по роли, но непривычно   |

**Вывод.** Нет кандидата, который однозначно превосходит
`config.yml`. `config.yml` сохраняется. Переименование не даёт
измеримой пользы — валидный результат по критериям.

## Вопрос 3. Транзитивная загрузка плагинов

Минимальный дизайн v1:

- **Источник deps**: опциональное поле `plugins:` в `plugin.yml`
  с тем же типом `PluginEntry`, что и в `config.yml`.
- **Обход**: DFS, post-order flattening — зависимости попадают
  в layer-model раньше зависящего плагина.
- **Циклы**: three-color (white/gray/black); при gray-вершине —
  `Error("Plugin dependency cycle: A -> B -> A")`.
- **Конфликт версий**: first-wins по имени с warning и цепочкой
  источников ТОЛЬКО для транзитивных появлений. Дубликат
  на top-level остаётся fail-fast (шаг 2.7a существующей
  процедуры Resolve Plugins).
- **Относительные пути**: разрешаются относительно `pluginRoot`
  родителя (асимметрия с top-level, где `projectRoot`). Иначе
  плагин не может переносимо ссылаться на внутренние подплагины.
- **peerDependencies**: отложить в v2 — нет use case.
- **Git-кеш**: существующий `~/.agloom/cache/plugins/` без изменений.

## Вопрос 4. Декларация поддерживаемых адаптеров

С учётом F1 (структура плоская), рекомендуется
**информативная декларация**: опциональное поле
`targets: [adapter-id, ...]` в `plugin.yml`. При отсутствии —
текущее поведение. При наличии — warning (не fail-fast),
если пересечение с `config.adapters` пусто: plugin с overlay
для пяти адаптеров и проект с одним — валидный сценарий.

Имя `targets:` (не `adapters:`) разносит семантику: «для чего
пригодно» (producer) vs «что генерировать» (consumer).
Strict-валидация отвергнута — противоречит partial-success
стратегии layer model.

## Вопрос 5. Расширение `variables` в `config.yml`

Фактическое состояние (F2): полный объектный формат уже
поддерживается. Изменений в коде не требуется. Действие —
документационная правка: cross-reference на тип
`VariableDeclaration` в `config.md` (сейчас контракт описан
только в `plugin-values.md`).

## Вопрос 6. Migration (модель B)

Изменения в спецификациях:

1. `plugin-manifest.md` — снять запрет `config.yml` в плагине;
   добавить опциональные `targets:` и `plugins:`.
2. `plugin-loading.md` — описать процедуру Resolve Transitive
   Plugins (DFS, циклы, first-wins); описать `.agloom/plugins/`
   как рекомендуемую конвенцию.
3. `config.md` — добавить cross-reference на `VariableDeclaration`.
4. `layer-model.md` — обновить § Порядок применения слоёв
   с учётом транзитивных слоёв.
5. `git-plugin-loading.md` — без изменений.

Существующие плагины: `cusxy/skill-cycling@v2.0.1` не требует
изменений — модель B аддитивна.

Шаги для репо пользователя:

1. Создать `.agloom/plugins/<rule-name>/`.
2. Поместить `plugin.yml` (имя, `version: 0.0.0` как соглашение
   non-bumped, `description`, `author`).
3. Перенести skills/agents/overlays в подплагин.
4. В `config.yml`: `plugins: [./.agloom/plugins/<rule-name>]`.
5. В другом проекте:
   `plugins: [{ git: "...main-repo", path: ".agloom/plugins/<rule-name>" }]`.

## Вопрос 7. Двойной смысл `adapters`

Объективная фиксация (F5): конфликта имён нет. В `config.yml`
`adapters:` = consumer-side; в `plugin.yml` поле отсутствует.

Решение по вопросу 4 вводит `targets:` (не `adapters:`), что
лексически разносит семантику. Использование `adapters:`
в обоих файлах с разной семантикой отвергается — противоречит K9.
