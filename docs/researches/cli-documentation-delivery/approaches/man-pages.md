---
relates:
  - docs/researches/cli-documentation-delivery/RESEARCH.md
---

# A2: Man Pages + In-Package Documentation

## Описание

Пакет содержит man pages в roff формате (через `man` field в package.json),
а также Markdown и/или HTML документацию для встроенного `help` subcommand.
Единственный production-пример в Node.js экосистеме — npm.

## Кто использует

**Только npm** из 10 исследованных CLI. npm поставляет:

- 89 man pages (roff): 70 в man1, 8 в man5, 11 в man7 (~641 KB).
- 87 Markdown файлов в `docs/content/` (commands, configuring-npm, using-npm).
- 89 HTML файлов в `docs/output/` (пре-рендер для `npm help`).
- Shell completions: bash, fish.

```json
{
  "man": ["man/man1/npm-install.1", "...89 entries..."],
  "directories": { "doc": "./doc", "man": "./man" }
}
```

## Инструменты генерации

| Инструмент | Input      | Output | npm-native   | Статус           |
| ---------- | ---------- | ------ | ------------ | ---------------- |
| marked-man | Markdown   | roff   | Yes          | v2.1.0, Apr 2024 |
| remark-man | Markdown   | roff   | Yes (API)    | v9.0.0, Sep 2023 |
| Pandoc     | Markdown   | roff   | No (Haskell) | Active           |
| scdoc      | Custom DSL | roff   | No (C)       | Active           |

npm использует **marked-man** в своём `docs` workspace через `prepack` script.

## Реализация `npm help`

Три режима отображения, управляемые конфигом `viewer`:

- `man` (default POSIX): `spawn("man", [path])` — системный man viewer.
- `browser` (default Windows): `openUrl(htmlManPath)` — браузер.
- `stdout`: raw markdown в консоль (undocumented, для CI).

## Оценка по критериям

### C1: Zero-config доступность — High (POSIX) / Low (Windows)

После `npm install -g` команда `man npm-install` работает на macOS/Linux
без дополнительных шагов. На Windows man pages бесполезны.

### C2: AI-совместимость — Low

Man pages в roff формате нечитаемы для AI-инструментов. Markdown-исходники
в `docs/content/` читаемы, но AI-агенты не знают, где их искать
без AGENTS.md.

### C3: Maintenance burden — Medium

Требуется build step (markdown -> roff). npm использует custom docs workspace
с `marked-man`. Добавляет devDependency и npm script.

### C4: Package size impact — +0.5-1 MB

npm: 89 man pages = ~641 KB roff. С Markdown и HTML — дополнительно ~2 MB.
Для agloom (4-5 commands): ожидаемо ~50-100 KB roff.

### C5: Discoverability — High

Man pages — стандартный механизм Unix. `man <tool>` — первое, что пробует
опытный пользователь. `npm help <topic>` — дополнительная точка входа.

### C6: Single-source потенциал — Partial

Markdown -> roff (marked-man) + Markdown -> HTML (marked). Два формата
из одного источника, но AI-файлы не генерируются.

## Плюсы

- Соответствие Unix conventions — `man` работает без дополнительной настройки.
- Excellent reading UX: paging, search (`/`), cross-references.
- Markdown source пригоден для website и human reading.
- npm сам использует этот подход — проверен временем.

## Минусы

- **Единственный пользователь в Node.js экосистеме** — ни один другой
  major CLI не поставляет man pages. Это сигнал о низком ROI.
- Windows: man pages не работают (нет системного `man`).
- AI-инструменты не читают roff.
- `directories.man` в package.json имеет известные баги.
- marked-man: нишевый пакет, умеренное поддержание.

## Контекст применимости

**Оправдан**, когда: CLI рассчитан на Unix system administrators;
команд >= 10 с развитой системой опций; проект стремится к Unix-like polish.

**Не оправдан**, когда: целевая аудитория — web-разработчики
с AI-инструментами; пакет компактный (< 5 commands); Windows — значимая
платформа.
