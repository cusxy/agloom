---
type: research
summary: Анализ Android Studio Gemini как кандидата для адаптера Agloom
description: >
  Детальный анализ project-level конфигурации Android Studio Gemini
  (Agent Mode) по критериям C1-C10. Часть исследования adapter-candidates.
relates:
  - docs/researches/adapter-candidates/RESEARCH.md
---

# Android Studio Gemini (Google)

Критерии оценки --- см.
[RESEARCH.md](../RESEARCH.md) SS Критерии оценки.

## Общая характеристика

Android Studio Gemini --- IDE-интегрированный агент в Android Studio. Agent
Mode позволяет выполнять многоэтапные задачи: сборка, деплой на устройство,
скриншоты, Logcat, adb-взаимодействие. Поддерживает модели Gemini (Pro, Flash)
и локальные модели.

## C1. Instructions

Поддерживает `AGENTS.md` (и `AGENT.md` для совместимости с Narwhal 3).
Файл размещается в любом месте файловой системы проекта. Gemini сканирует
текущую директорию и все родительские директории. При отсутствии открытого
файла используется `AGENTS.md` в корне проекта. Формат --- Markdown.

**Fallback**: если в одной директории существуют и `GEMINI.md`, и `AGENTS.md`,
приоритет имеет `GEMINI.md`.

Поддержка модуляризации через `@`-ссылки на другие Markdown-файлы
(`@./file.md`, `@../file.md`, `@/absolute/path.md`).

## C2. Rules

Rules настраиваются через IDE: **Settings -> Tools -> AI -> Prompt Library**.
Хранятся в `/.idea/project.prompts.xml` (project-level) или на уровне IDE
(personal). Rules добавляются как преамбула к каждому промпту. Можно отключить
для конкретного запроса через меню Context.

Rules --- IDE-специфичный механизм (IntelliJ), не переносимый между
инструментами. Для командного использования рекомендуется `AGENTS.md`.

## C3. Commands

Нативные project-level slash-команды не документированы. Взаимодействие
происходит через Agent tab в IDE с естественным языком.

## C4. Skills

Документация указывает на поддержку skills ("Extend Agent Mode with skills"),
однако формат и размещение на уровне проекта не детализированы. Предположительно
совместимы с `.gemini/skills/` (по аналогии с Gemini CLI).

## C5. Agents

Не документированы как project-level суб-агенты. Agent Mode --- единственный
агент, управляемый через IDE UI.

## C6. MCP

Поддерживается. Документация ссылается на "Add an MCP server" для расширения
инструментов агента. Формат конфигурации предположительно совпадает с
`.gemini/settings.json`.

## C7. Hooks

Не документированы.

## C8. LSP

Не применимо --- Android Studio предоставляет собственные Language Services.

## C9. Other

- **Android-специфичные инструменты**: Build, Deploy, Screenshot, Logcat,
  adb shell input, Search Android Docs, Fetch Android Docs.
- **Auto-approve**: опция автоматического одобрения изменений.
- **Context drawer**: UI для управления загруженными AGENTS.md файлами.
- **Local models**: поддержка локальных моделей.

## C10. Adapter verdict

Android Studio Gemini **частично покрывается адаптером `gemini`** (при его
создании). Файл инструкций --- `AGENTS.md` с fallback на `GEMINI.md`, что
совместимо с обоими адаптерами. Специфика IDE (rules в `.idea/`, Android-tools)
выходит за scope Agloom. **Отдельный адаптер не требуется** --- достаточно
генерации `AGENTS.md` (через `agentsmd`) и опционально `GEMINI.md`
(через адаптер `gemini`).

## Плюсы

- Нативная поддержка AGENTS.md с иерархическим сканированием.
- Модуляризация через `@`-ссылки на внешние Markdown-файлы.
- Android-специфичные инструменты (устройство, Logcat, adb).
- Совместимость с форматом Gemini CLI (`.gemini/` структура).

## Минусы

- Rules хранятся в IDE-специфичном формате (`.idea/project.prompts.xml`),
  не переносимы.
- Skills и MCP документированы поверхностно --- детали формата отсутствуют.
- Нет project-level суб-агентов и slash-команд.
- Привязка к Android Studio --- не универсальный инструмент.

## Источники

- [Agent Mode](https://developer.android.com/studio/gemini/agent-mode)
- [AGENTS.md files](https://developer.android.com/studio/gemini/agent-files)
- [Rules](https://developer.android.com/studio/gemini/rules)
- [Best practices](https://developer.android.com/studio/gemini/best-practices)
- [Gemini features](https://developer.android.com/studio/gemini/features)
