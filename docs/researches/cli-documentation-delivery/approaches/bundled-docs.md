---
relates:
  - docs/researches/cli-documentation-delivery/RESEARCH.md
---

# A3: Bundled Markdown Documentation

## Описание

Пакет содержит полную документацию в виде Markdown-файлов, встроенных
в `dist/docs/`. AI-агенты и пользователи читают их напрямую
из `node_modules/`. AGENTS.md в корне проекта направляет агентов
к bundled docs.

## Кто использует

**Next.js (с версии 16.2)** — единственный крупный пакет, реализовавший
этот подход. Данные:

- 391 Markdown-файл в `dist/docs/` (~2.5 MB).
- Структура зеркалирует docs website:
  `dist/docs/01-app/01-getting-started/`, `02-guides/`, `03-api-reference/`.
- Пакет: 154 MB total (docs составляют ~1.6% от размера).

```text
node_modules/next/dist/docs/
  01-app/
    01-getting-started/
    02-guides/
    03-api-reference/
  02-pages/
  03-architecture/
  index.mdx
```

### Интеграция с AI-инструментами

Next.js генерирует AGENTS.md с директивой:
«Before any Next.js work, find and read the relevant doc
in `node_modules/next/dist/docs/`.»

CLAUDE.md использует `@` import syntax для включения AGENTS.md.
`@next/codemod agents-md` — CLI-команда для генерации docs index.

### Marker comments для managed sections

```markdown
<!-- BEGIN:nextjs-agent-rules -->

...managed content...

<!-- END:nextjs-agent-rules -->
```

Пользователь добавляет свои инструкции за пределами markers.

## Оценка по критериям

### C1: Zero-config доступность — High

После `npm install next`, вся документация доступна локально
в `node_modules/next/dist/docs/`. Не требуется интернет, не требуется
отдельный `npm install -g`.

### C2: AI-совместимость — High

Markdown — идеальный формат для AI-инструментов. AGENTS.md направляет
агентов к правильным файлам. Version-matched: документация всегда
соответствует установленной версии пакета.

### C3: Maintenance burden — Medium

Документация должна собираться в `dist/docs/` при build.
Next.js зеркалирует website docs → пакет, что требует build pipeline.
Однако источник один — website documentation.

### C4: Package size impact — +1-3 MB

Next.js: 2.5 MB docs при 154 MB total. Для agloom: ожидаемо
~100-300 KB (значительно меньше контента).

### C5: Discoverability — High

Документация находится в предсказуемом месте (`node_modules/<pkg>/dist/docs/`).
AI-агенты находят её через AGENTS.md. Пользователи — через AGENTS.md
или README.

### C6: Single-source потенциал — No

Bundled docs — это копия website docs, не source. Они не генерируют
man pages или `--help`.

## Плюсы

- **Version-matched**: документация гарантированно соответствует
  установленной версии. Решает проблему stale training data у AI.
- **Offline доступность**: работает без интернета.
- **AI-первый подход**: Markdown + AGENTS.md обеспечивают максимальную
  полезность для AI-инструментов.
- **Единственный production-пример** — Next.js 16.2 установил стандарт.

## Минусы

- **Значительный overhead по размеру** для пакетов с объёмной документацией.
  Next.js может позволить +2.5 MB при 154 MB total; для agloom (текущий
  dist < 1 MB) это может удвоить размер пакета.
- **Дублирование**: те же docs на website и в пакете.
- **Не заменяет `--help`**: пользователь не может набрать
  `agloom help transpile` — нужна отдельная реализация help subcommand.
- **Молодой pattern**: Next.js — единственный adopter. Нет устоявшихся
  conventions.
- **Не покрывает man pages**: Unix-пользователи всё ещё не получают `man`.

## Контекст применимости

**Оправдан**, когда: пакет — фреймворк/библиотека, используемая AI-агентами
для генерации кода; документация объёмная и часто меняется между версиями;
точность version-matched docs критична.

**Не оправдан**, когда: CLI-инструмент небольшой (< 10 страниц docs);
размер пакета критичен; документация стабильна между версиями.
