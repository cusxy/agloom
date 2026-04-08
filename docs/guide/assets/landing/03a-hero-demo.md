# 03a — Hero Demo (interactive file-tree)

<!--
Отдельный блок, идущий после Early Adopters strip, который, в свою очередь,
стоит сразу под Hero. Никакого отдельного заголовка/eyebrow у демо нет —
визуально это просто три панели и caption под ними. Заголовки сделали бы
секцию тяжёлой; контекст задан Hero'ем.

Раньше в центре между inputs и output был декоративный pill "agloom transpile →".
Мы его убрали — он ничего не добавлял кроме шума. Связь между inputs и output
считывается позиционно: слева — исходники, справа — результат с табами адаптеров.
-->

## Layout

**Desktop:** двухколоночный CSS grid `1fr | 1.25fr`. Слева — две вертикально
сложенные панели (Project + Plugin), справа — одна большая панель Output с табами
адаптеров.

**Mobile (≤900px):** колонки схлопываются в одну вертикаль — Project → Plugin → Output.

Никакого центрального pill'а, никакого eyebrow/H2 над блоком.

## Panels

### Project (local)

```
~/your-project/
├─ .agloom/
│  ├─ agents/
│  │  └─ reviewer.md
│  ├─ commands/
│  │  └─ test.md
│  ├─ docs/
│  │  └─ codestyle.md
│  ├─ overlays/
│  │  └─ claude/
│  │     └─ commands/
│  │        └─ deploy.md
│  ├─ config.yml
│  ├─ mcp.yml
│  └─ permissions.yml
└─ AGLOOM.md
```

Отражает реальный канонический layout:

- `AGLOOM.md` лежит в корне проекта, не внутри `.agloom/`.
- `.agloom/` содержит директории (`agents/`, `commands/`, `docs/`, `overlays/`), затем файлы конфигурации
  (`config.yml`, `mcp.yml`, `permissions.yml`) в алфавитном порядке.
- `commands/` — канонические slash-команды. Agloom раскладывает каждую в
  native-формат адаптера (см. Output ниже). Для Codex команды конвертируются
  в skills, потому что native-слота для команд у Codex нет.
- `docs/` — произвольные markdown-документы, которые Agloom копирует в
  `<.adapter>/docs/` каждого адаптера. Project контрибьютит `codestyle.md`,
  а плагин (см. Plugin panel ниже) — `architecture.md`; на выходе оба файла
  сосуществуют в `docs/` каждого адаптера, покрашенные разными цветами по
  источнику. Внутри canonical-файлов на них можно ссылаться через
  `${agloom:DOCS_DIR}`, который раскрывается адаптер-специфично
  (`.claude/docs`, `.codex/docs`, …).
- `mcp.yml` и `permissions.yml` — канонические источники для MCP-серверов и
  permission-политик, из которых Agloom генерирует нативные файлы для адаптеров.
- `overlays/<adapter>/…` — raw-файлы, которые Agloom копирует «как есть» в
  целевую директорию адаптера, не трогая их содержимое. В примере
  `.agloom/overlays/claude/commands/deploy.md` превращается в
  `.claude/commands/deploy.md` только в Claude-табе — это отличный способ
  показать, что overlays scoped по адаптеру.

### Plugin (git)

```
git:acme/agloom-team-base
├─ agents/
│  └─ architect.md
├─ docs/
│  └─ architecture.md
├─ skills/
│  └─ git-commit/
│     └─ SKILL.md
└─ plugin.yml
```

**Важно:** в плагине **нет** `AGLOOM.md` — плагин контрибьютит только sub-агентов,
docs, skills и манифест `plugin.yml`. Shared instructions остаются в локальном
`AGLOOM.md` проекта. В `docs/` плагин отдаёт `architecture.md`, который
дополняет локальный `codestyle.md` из project. Сортировка: директории первыми
(`agents/`, `docs/`, `skills/`), затем файлы (`plugin.yml`).

### Output (tab-switchable)

Табы `[Claude] [Codex] [Gemini] [OpenCode]`, по умолчанию активен Claude.
Смена — 260ms crossfade тела.

**Claude tab:**

```
~/your-project/
├─ .agloom/
├─ .claude/
│  ├─ agents/
│  │  ├─ architect.md        (from plugin)
│  │  └─ reviewer.md         (local)
│  ├─ commands/
│  │  ├─ deploy.md           (overlay — copied verbatim)
│  │  └─ test.md             (local — from .agloom/commands/test.md)
│  ├─ docs/
│  │  ├─ architecture.md     (from plugin)
│  │  └─ codestyle.md        (local — from .agloom/docs/codestyle.md)
│  ├─ skills/
│  │  └─ git-commit/
│  │     └─ SKILL.md         (from plugin)
│  └─ settings.json          (generated from permissions.yml)
├─ .mcp.json                 (generated from mcp.yml)
├─ AGLOOM.md
└─ CLAUDE.md                 (generated from AGLOOM.md + plugin)
```

**Codex tab:** тот же layout под `.codex/`. Под ним — `agents/`, `docs/`,
`rules/`, `skills/` (директории, алфавитно), затем файл `config.toml`
(generated из `mcp.yml`). В `docs/` — `architecture.md` (plugin) и `codestyle.md` (local), в `rules/` — `permissions.rules` (generated из
`permissions.yml`). В `skills/` — `git-commit/` (from plugin) и `test/`
(local, сконвертированная slash-команда — у Codex нет native-слота для
команд, поэтому Agloom превращает каждую команду в skill). Корневые файлы
проекта: `AGENTS.md` (generated), `AGLOOM.md` (local).

**Gemini tab:** под `.gemini/` — `agents/`, `commands/`, `docs/`, `policies/`,
`skills/` (директории, алфавитно), затем файл `settings.json` (generated из
`mcp.yml`). В `commands/` живёт `test.toml` (local — Gemini ожидает slash-команды
в TOML), в `docs/` — `architecture.md` (local), в `policies/` —
`permissions.toml` (generated из `permissions.yml`). Корневые файлы:
`AGLOOM.md` (local), `GEMINI.md` (generated).

**OpenCode tab:** под `.opencode/` — `agents/`, `commands/` (с `test.md`),
`docs/` (с `architecture.md`), `skills/`. Корневые файлы: `AGENTS.md`
(generated), `AGLOOM.md` (local), `opencode.json` (generated из `mcp.yml`
+ `permissions.yml`).

Во всех табах порядок строк: директории первыми (алфавитно), затем файлы
(алфавитно, case-insensitive, `.` трактуется как буква).

## Visual treatment

Три цветовых кода — по первоисточнику **файла** (директории никогда не подсвечиваются,
подсветка по назначению информативна только для листовых узлов дерева):

- **Project-owned content** (foggy-blue, цвет `--color-accent-hover`):
  - Файлы, которые написал автор (`AGLOOM.md`, `mcp.yml`, `permissions.yml`, локальные sub-агенты).
  - Файлы, которые Agloom **генерирует из project-источника** — `CLAUDE.md`, `.mcp.json`, `.claude/settings.json`, `opencode.json`, и т. п. Они считаются «продолжением» project-контента, поэтому красятся тем же синим.
- **Plugin-sourced files** (foggy-violet, цвет `--color-spark`):
  - Файлы, пришедшие из плагина: `agents/architect.md`, `skills/git-commit/SKILL.md`, `plugin.yml`.
  - Папки из плагина (`agents/`, `skills/`, `git-commit/`) **не подсвечиваются** — только их файлы.
- **Overlay files** (warm-amber, цвет `--color-warm`):
  - Raw-файлы из `.agloom/overlays/<adapter>/…`, которые Agloom копирует «как есть». В демо показан один такой файл: `deploy.md`, который оказывается в `.claude/commands/deploy.md` только в Claude-табе.
- **Dim rows** (muted цвет, без фона):
  - Корневые директории (`~/your-project/`, `.agloom/`, `.claude/` и т. п.) и все промежуточные папки (`agents/`, `skills/`, `commands/`, `git-commit/`, `overlays/`, `claude/`).
  - `config.yml` намеренно не подсвечивается — он конфигурирует пайплайн, но ничего не генерирует напрямую.

Без inline-аннотаций `← from plugin`/`← generated` — цветовое кодирование
достаточно информативно в компактном формате.

## Caption

Под блоком — одна центрированная строка:

> See how every canonical file maps to its native slot — [project structure guide →](https://docs.agloom.sh/docs/guide/project-structure).

## Accessibility

- Табы: `role="tablist"`, кнопки с `role="tab"` и `aria-selected`.
- `aria-controls` связывает таб с панелью.
- `prefers-reduced-motion`: отключить 260ms crossfade, swap мгновенный.
