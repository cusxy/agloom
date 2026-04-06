---
type: research
summary: Модель A — Unified manifest (отвергнута)
description: >-
  Анализ unified-модели: один файл-манифест на оба назначения
  (config.yml и plugin.yml), как package.json в npm.
relates:
  - docs/researches/plugin-and-workspace-manifest-redesign/RESEARCH.md
---

# Модель A — Unified manifest

## Описание

Один файл-манифест `.agloom/config.yml` обслуживает оба назначения.
Наличие identity-полей (`name`, `version`, `author`) является
маркером «этот config.yml является одновременно манифестом
распространяемого плагина». Аналог: `package.json` в npm,
`Cargo.toml` в Rust.

Пример:

```yaml
# .agloom/config.yml — локальный проект
adapters: [claude, opencode]
plugins:
  - git: git@github.com:cusxy/skill-cycling
variables:
  team: "platform"

# .agloom/config.yml — проект, который ALSO publishable
name: my-rules
version: 1.0.0
description: "Shared rules for my team"
author:
  name: "Me"
  email: "me@example.com"
adapters: [claude]
variables:
  team:
    description: "Team name"
    required: true
```

## Плюсы

- **A+1**. Один файл — одна ментальная модель. Любой проект
  может стать плагином, добавив identity-поля.
- **A+2**. Нет нового «где разместить плагин» вопроса —
  плагин = проект.
- **A+3**. Естественное dogfooding: автор плагина разрабатывает
  его как обычный agloom-проект.
- **A+4**. Унификация типа `PluginEntry` и типа локального
  config'а — проще в коде.

## Минусы

- **A-1 (fatal)**. Identity-поля в живом основном репо —
  мёртвый груз. Поле `version` никогда не бампается, `description`
  устаревает, `author` меняется при смене команды. Это
  использованный прямой довод от пользователя (см. § 1.2
  индекса).
- **A-2 (fatal)**. Маркер «я плагин» через наличие
  identity-полей нестабилен: удаление поля `name` превращает
  проект из плагина в не-плагин молча. Нет явного контракта
  «это намеренно публикуется».
- **A-3**. Конфликт `adapters:` — в consumer роли это «что
  генерировать», в producer роли это «для каких адаптеров
  пригодно». Одно поле, два смысла — когнитивно тяжело.
- **A-4**. Transitive deps через `plugins:` в том же файле,
  где и `plugins:` consumer-а — неоднозначно. Пользователь,
  глядя на `plugins:`, не может понять, это зависимости для
  распространения или для собственного проекта.
- **A-5**. `variables:` тоже двусмысленно: декларации для
  consumer-проекта против экспортируемых деклараций плагина.
  Сегодня эти два случая уже разделены семантически (см.
  `plugin-values.md`: `values:` передаётся в plugin entry,
  а `variables:` в config — это local-values); в unified модели
  разделение ломается.

## Контекст применимости

- **Оправдано, если**: проекты редко мутируют, identity-поля
  поддерживаются дисциплинированно (пример: npm-пакеты с
  релизным циклом).
- **Не оправдано, если**: use case — живые внутренние проекты
  команд без релизного цикла (это primary use case agloom).

## Оценка по критериям

| K   | Значение | Обоснование                                       |
| --- | -------- | ------------------------------------------------- |
| K1  | medium   | технически работает, но мёртвый груз демотивирует |
| K2  | high     | естественная модель для distribution              |
| K3  | **no**   | identity-поля в живом репо — мёртвый груз         |
| K4  | low      | один файл с двумя ролями — противоречит SRP       |
| K5  | yes      | dogfooding естественен                            |
| K6  | large    | переделка типов Parse/Resolve, унификация схем    |
| K7  | large    | переписать config.md, plugin-manifest.md          |
| K8  | medium   | слои работают, но ролевая модель размыта          |
| K9  | low      | «когда я consumer, когда producer?»               |
| K10 | easy     | plugins:/deps ложатся легко                       |

## Вердикт

**Отвергнута.** Модель проваливает ключевые критерии K3, K4, K9
из-за несоответствия primary use case (живые внутренние репо).
Упоминается в исследовании для полноты и в качестве baseline
сравнения.
