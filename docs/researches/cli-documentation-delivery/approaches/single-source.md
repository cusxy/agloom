---
relates:
  - docs/researches/cli-documentation-delivery/RESEARCH.md
---

# A5: Single-Source Documentation Pipeline

## Описание

Единый источник (Markdown или KDL) генерирует все форматы документации:
man pages, `--help` output, shell completions, Markdown docs, website,
AI-native файлы. Build step при `prepublish` создаёт артефакты.

## Кто использует

### mise (usage-cli)

Наиболее зрелая single-source система в экосистеме CLI:

- **Источник**: `mise.usage.kdl` (KDL Document Language).
- **Генерирует**: shell completions (bash, zsh, fish, PowerShell, nushell),
  man pages (troff), Markdown docs, `--help` output, JSON, Fig specs.
- **Интеграция**: Clap (Rust), с другими фреймворками в разработке.
- **URL**: [usage.jdx.dev](https://usage.jdx.dev).

### npm (partial single-source)

- **Источник**: Markdown файлы в `docs/content/`.
- **Генерирует**: roff man pages (via marked-man), HTML (via marked).
- **Ограничение**: не генерирует AI-native файлы или shell completions.
- **Pipeline**: `prepack` script запускает docs workspace.

### marked (uses itself)

```json
{
  "scripts": {
    "build:man": "marked-man man/marked.1.md > man/marked.1"
  }
}
```

## Компоненты pipeline для Node.js/TypeScript

### Markdown -> Man Pages

| Инструмент | Тип     | Сильные стороны              | Слабые стороны              |
| ---------- | ------- | ---------------------------- | --------------------------- |
| marked-man | npm CLI | Simple, proven, npm uses it  | Limited table support       |
| remark-man | npm API | Unicode, tables, unified eco | No standalone CLI, ESM-only |
| Pandoc     | System  | Most powerful, multi-format  | External dep (Haskell)      |

### Markdown -> Terminal (--help rendering)

| Инструмент           | Weekly DL | Особенности                            |
| -------------------- | --------- | -------------------------------------- |
| marked-terminal      | High      | Tables, syntax highlight, configurable |
| cli-markdown         | Medium    | Simpler API, tables + highlight        |
| markdown-it-terminal | Low       | Plugin for markdown-it                 |

### Help subcommand patterns

| Pattern                    | Используют       | Подход                         |
| -------------------------- | ---------------- | ------------------------------ |
| Framework auto-generated   | eslint, prettier | Commander/yargs auto-help      |
| Static chalk text          | vercel           | Hand-written template literals |
| Structured data + renderer | pnpm             | `render-help` npm package      |
| Man page delegation        | npm              | `spawn("man", [path])`         |
| Ink/React components       | Prisma, Shopify  | `<Box>` + `<Text>` layout      |

## Проектируемый pipeline для agloom

```text
docs/usage/*.md (Markdown source)
  ├── marked-terminal ──→ `agloom help <topic>` (TUI rendering)
  ├── marked-man ───────→ man/agloom-*.1 (optional, future)
  ├── script ───────────→ AGENTS.md (generated summary)
  └── website build ────→ docs site (future)
```

### Пример build scripts

```json
{
  "scripts": {
    "build:help": "node scripts/build-help.js",
    "prepublish": "npm run build && npm run build:help"
  }
}
```

### Пример help subcommand (marked-terminal)

```typescript
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";
import { readFileSync } from "fs";
import { join } from "path";

marked.use(markedTerminal());

function showHelp(topic: string): void {
  const docPath = join(__dirname, "../docs/usage", `${topic}.md`);
  const content = readFileSync(docPath, "utf-8");
  console.log(marked(content));
}
```

## Оценка по критериям

### C1: Zero-config доступность — High

Man pages (если генерируются) + `help` subcommand + bundled Markdown.
Все форматы доступны после install.

### C2: AI-совместимость — High

Markdown source читаем для AI. AGENTS.md генерируется из того же source.
Version-matched.

### C3: Maintenance burden — High (setup) / Low (ongoing)

Начальная настройка pipeline требует effort. После настройки — один source
обновляется, все форматы перегенерируются автоматически.

### C4: Package size impact — +0.5-3 MB

Зависит от включённых форматов. Markdown only: ~50-200 KB.
С man pages: +100-500 KB. С HTML: +0.5-2 MB.

### C5: Discoverability — High

Покрывает все точки входа: `man`, `--help`, `node_modules/` docs, AGENTS.md.

### C6: Single-source потенциал — Full

По определению — это и есть single-source подход.

## Плюсы

- **Консистентность**: все форматы гарантированно синхронизированы.
- **Максимальное покрытие**: man + help + AI + web из одного источника.
- **Масштабируемость**: добавление нового формата = добавление build step.
- **Markdown как lingua franca**: читаем людьми, AI, и конвертируем в любой формат.

## Минусы

- **Высокая начальная стоимость**: настройка pipeline, devDependencies
  (marked, marked-terminal, marked-man), build scripts.
- **Зрелость tooling**: usage-cli поддерживает только Clap (Rust).
  Для Node.js/TypeScript нет готового single-source framework.
- **Over-engineering risk**: для CLI с 4 командами full pipeline может быть
  избыточен. Build complexity растёт с каждым форматом.
- **Gap в AI-генерации**: ни один существующий инструмент не генерирует
  AGENTS.md + llms.txt из Markdown source автоматически.

## Контекст применимости

**Оправдан**, когда: CLI имеет >= 10 commands; документация часто
обновляется; требуется покрытие всех каналов (man, help, web, AI);
команда готова к начальным инвестициям в pipeline.

**Не оправдан**, когда: CLI небольшой и стабильный; ресурсы ограничены;
достаточно AI-native файлов + простого `--help`.
