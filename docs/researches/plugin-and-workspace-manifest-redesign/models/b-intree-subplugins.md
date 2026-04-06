---
type: research
summary: Модель B — Дихотомия config.yml/plugin.yml + in-tree подплагины
description: >-
  Сохранение существующей дихотомии config.yml и plugin.yml
  с добавлением возможности размещать плагины внутри основного
  репо в поддиректориях `.agloom/plugins/<name>/`.
relates:
  - docs/researches/plugin-and-workspace-manifest-redesign/RESEARCH.md
---

# Модель B — In-tree subplugins

## Описание

Дихотомия `config.yml` (манифест consumer) и `plugin.yml`
(манифест producer) сохраняется. Добавляется возможность
размещать плагины внутри основного репо в поддиректориях
`.agloom/plugins/<name>/`, каждая со своим `plugin.yml`.
Подплагины подключаются через относительный путь в
`config.yml`.

Пример структуры:

```text
<repo>/
  .agloom/
    config.yml              # manifest проекта (consumer)
    AGLOOM.md
    skills/                 # skills самого проекта
    agents/                 # agents самого проекта
    plugins/
      team-rules/
        plugin.yml          # manifest подплагина (producer)
        skills/
        agents/
        overlays/claude/
      ci-rules/
        plugin.yml
        overlays/claude/
```

`config.yml`:

```yaml
adapters: [claude, opencode]
plugins:
  - ./.agloom/plugins/team-rules
  - ./.agloom/plugins/ci-rules
```

Второй проект того же автора подключает те же подплагины
через git-ref:

```yaml
# other-repo/.agloom/config.yml
plugins:
  - git: git@github.com:me/main-repo
    path: .agloom/plugins/team-rules
  - git: git@github.com:me/main-repo
    path: .agloom/plugins/ci-rules
```

Дополнения к модели (часть рекомендации в RESEARCH.md):

1. Снять запрет на `config.yml` в директории плагина
   (dogfooding).
2. Добавить опциональное `targets:` в `plugin.yml` (warning
   при пустом пересечении с `config.adapters`).
3. Добавить опциональное `plugins:` в `plugin.yml` для
   транзитивных зависимостей.

## Плюсы

- **B+1**. Решает primary use case напрямую: никаких
  отдельных репозиториев, никакого релизного цикла. Shareable
  rules живут рядом с проектом, который ими пользуется.
- **B+2**. Identity-поля существуют только в `plugin.yml`
  подплагина — файл физически отделён от `config.yml` живого
  репо и принадлежит «донорской» роли. Нет мёртвого груза
  в consumer-манифесте.
- **B+3**. Secondary use case работает через существующий
  git-плагин механизм с полем `path:` — никаких изменений
  в `git-plugin-loading.md`.
- **B+4**. Разделение ролей чёткое: `config.yml` = consumer,
  `plugin.yml` = producer. SRP соблюдён.
- **B+5**. Совместимо с dogfooding после снятия запрета
  `config.yml` в плагине.
- **B+6**. Аддитивно к существующей реализации: относительные
  пути в `plugins:` уже работают (см.
  `docs/specs/plugin-loading.md` § Процедура Resolve Plugins,
  шаг 2.1).

## Минусы

- **B-1**. Концепция «плагин внутри проекта» непривычна
  для пользователей, знакомых только с npm/cargo. Требует
  однократного объяснения в guide.
- **B-2**. Дублирование структуры: `.agloom/skills/`
  и `.agloom/plugins/<name>/skills/` живут рядом. Граница
  «что выносить в подплагин, что оставить локально» —
  subjective call автора.
- **B-3**. `version:` подплагина в in-tree сценарии
  фактически не используется, но остаётся обязательным
  по semver-валидации (см. `plugin-manifest.md` § Валидация
  версии). Это lesser-evil относительно модели A:
  неиспользуемое поле локализовано в одном файле одного
  подплагина, не контаминирует весь живой репо.
- **B-4**. При транзитивных deps относительные пути
  должны разрешаться относительно родительского плагина,
  а top-level — относительно projectRoot. Асимметрия
  в алгоритме resolve (см. RESEARCH.md § Вопрос 3).

## Контекст применимости

- **Оправдано, если**: автор поддерживает >= 2 проектов
  с общими правилами и не хочет релизного цикла для них.
- **Оправдано, если**: в репо уже есть доменная граница
  между «это specific to this repo» и «это shareable».
- **Не оправдано, если**: у автора ровно один проект —
  тогда подплагин избыточен.
- **Не оправдано, если**: правила нужно распространять
  независимо от основного репо через публичный реестр
  (тогда отдельный репо плагина естественнее).

## Оценка по критериям

| K   | Значение | Обоснование                                  |
| --- | -------- | -------------------------------------------- |
| K1  | high     | напрямую решает primary use case             |
| K2  | high     | git-ref + path работает без изменений        |
| K3  | yes      | identity изолированы в plugin.yml подплагина |
| K4  | high     | чёткое разделение ролей consumer/producer    |
| K5  | yes      | после снятия запрета config.yml в плагине    |
| K6  | small    | относительные пути уже работают              |
| K7  | medium   | минимальные изменения в 2–3 спеках           |
| K8  | high     | порядок слоёв совпадает с текущим            |
| K9  | medium   | «плагин в проекте» требует объяснения        |
| K10 | easy     | `plugins:` в plugin.yml ложится естественно  |

## Вердикт

**Рекомендована** как основная модель (см. RESEARCH.md § 6).
Выигрывает по K1, K3, K4, K5, K8 и имеет самую низкую стоимость
реализации по K6.
