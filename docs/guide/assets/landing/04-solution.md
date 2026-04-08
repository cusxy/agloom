# 04 — Solution: One File, Three Namespaces of Interpolation

<!--
Второй interactive demo. Если Hero показывает "один source проекта → разные output деревья", то Solution показывает "один canonical файл → разные rendered версии".

В центре этой секции — интерполяция. Пользователь должен уйти со страницы, понимая, что Agloom умеет подставлять значения из трёх namespace'ов (env, agloom, values) и уметь переключать agent-specific блоки. Это главная "магия" инструмента после самого transpile.

Layout desktop: 2 колонки. Слева — eyebrow + H2 + короткий параграф. Справа — interactive single-file demo.
Mobile: текст сверху, demo снизу, полная ширина.

Компонент симметричен Hero (left text + right interactive demo), но показывает другой уровень зума: вместо структуры проекта — содержимое одного файла.
-->

## Content (left column)

**Eyebrow:** `INTERPOLATION`

**H2:** One canonical file. Values resolved per agent at transpile time.

**Body:**

> Agloom gives you three namespaces of interpolation inside canonical files. `${env:VAR}` pulls from your `.env` and process environment. `${agloom:VAR}` expands to agent-aware paths — `SKILLS_DIR` becomes `.claude/skills` when transpiling for Claude, `.opencode/skills` when transpiling for OpenCode. `${values:VAR}` reaches into plugin and project variables declared in `config.yml`. Pick a target on the right and watch the same `AGLOOM.md` render into four different instruction files.

**Link (end of left column):**

> Learn how interpolation works end-to-end in the [variables guide →](/docs/variables).

---

## Solution visual — interactive single-file demo

<!--
КОМПОНЕНТ B — "single AGLOOM.md file → adapter tabs".

Layout внутри компонента (desktop, 2 колонки, gutter ~32px):

  ┌─────────────────────────────┐    ┌──────────────────────────────────┐
  │ CANONICAL                   │    │ OUTPUT                           │
  │ ~/your-project/AGLOOM.md    │    │ [Claude][Codex][Gemini][OpenCode] │
  │                             │    │ ─────────────────────────────── │
  │ <canonical file content>    │ →  │ <transpiled content>             │
  │                             │    │ (breadcrumb shows output path)   │
  └─────────────────────────────┘    └──────────────────────────────────┘

Left panel: static. Shows the single canonical AGLOOM.md file.
Right panel: tabs [Claude] [Codex] [Gemini] [OpenCode], each with pre-computed output.
No hover interactions. No content-editor. Just static text in two code blocks, one side switchable by tabs.

Both panels are code editors in a dark theme with syntax highlighting (Shiki preferred for tree-shaking). Height ~560px, vertical scroll inside each panel. Breadcrumb above each panel shows the file path.

File path shown above the canonical panel: ~/your-project/AGLOOM.md
File path shown above the output panel (changes per tab):
  Claude:   ~/your-project/CLAUDE.md
  Codex:    ~/your-project/AGENTS.md
  Gemini:   ~/your-project/GEMINI.md
  OpenCode: ~/your-project/AGENTS.md

IMPORTANT: AGLOOM.md and the generated instruction files ALL live at the PROJECT ROOT, not inside .agloom/. This matches Agloom's actual file layout and avoids confusing users.

Note about the canonical file: AGLOOM.md (an instructions file) legitimately supports <!-- agent:claude --> and <!-- agent:agentsmd --> blocks — this is documented in docs/guide/instructions.md. Sub-agent definition files (agents/*.md) are more restricted; for this reason the Solution demo uses AGLOOM.md specifically.

Config assumed by the demo (displayed as a small caption below the canonical panel):

  .agloom/config.yml:
    adapters: [claude, codex, gemini, opencode]
    variables:
      team_name: "platform"

  .env:
    PROJECT_NAME=billing-service

This caption is static text, not interactive. It exists so the reader can see WHERE ${env:PROJECT_NAME} and ${values:team_name} come from, without needing to read the docs first.
-->

### Canonical file (left panel, static)

```markdown
# ${env:PROJECT_NAME}

Shared conventions for the ${values:team_name} team.

## Stack

TypeScript, Next.js 14, Prisma, PostgreSQL.

## Conventions

- Server components by default.
- Review checklists live in `${agloom:SKILLS_DIR}/code-review/`.
- Architecture notes are at `${agloom:DOCS_DIR}/architecture.md`.
- All database queries go through Prisma — never write raw SQL.

<!-- agent:claude -->

## Claude Code workflow

Use the `Grep`, `Glob`, and `Read` tools for investigation. Prefer
them over shelling out to `grep` or `find`. Draft a plan with
`ExitPlanMode` before non-trivial changes.

<!-- /agent:claude -->

<!-- agent:agentsmd -->

## AGENTS.md workflow

Read each changed file fully before commenting on it — do not patch
based on a partial view. After every meaningful change, run
`pnpm run test` and address failures before moving on.

<!-- /agent:agentsmd -->

## Boundaries

- Never modify files in `generated/` — they are produced by codegen.
- Never skip TypeScript strict mode.
```

**Caption under canonical panel (small, monospace):**

```text
.agloom/config.yml:  variables: { team_name: "platform" }
.env:                PROJECT_NAME=billing-service
```

---

### Output (right panel, tab-switchable)

<!--
Только содержимое, общее для всех табов, показывать не нужно — я сознательно не дублирую все четыре варианта в тексте файла (как договорились). Вместо этого я описываю правила трансформации и даю один canonical example для таба Claude. Фронтенд компонента должен вычислить все четыре текста офлайн и положить в data bundle.
-->

Pre-computed outputs for each tab. The transformation rules per tab:

| Token                       | Claude               | Codex               | Gemini               | OpenCode              |
| --------------------------- | -------------------- | ------------------- | -------------------- | --------------------- |
| `${env:PROJECT_NAME}`       | `billing-service`    | `billing-service`   | `billing-service`    | `billing-service`     |
| `${values:team_name}`       | `platform`           | `platform`          | `platform`           | `platform`            |
| `${agloom:SKILLS_DIR}`      | `.claude/skills`     | `.agents/skills`    | `.gemini/skills`     | `.opencode/skills`    |
| `${agloom:DOCS_DIR}`        | `.claude/docs`       | `.codex/docs`       | `.gemini/docs`       | `.opencode/docs`      |
| `<!-- agent:claude -->`     | **kept**, unwrapped  | removed             | removed              | removed               |
| `<!-- agent:agentsmd -->`   | removed              | **kept**, unwrapped | removed              | **kept**, unwrapped   |
| Output file path            | `CLAUDE.md`          | `AGENTS.md`         | `GEMINI.md`          | `AGENTS.md`           |

**Example — `[Claude]` tab (default, displayed in the component):**

```markdown
# billing-service

Shared conventions for the platform team.

## Stack

TypeScript, Next.js 14, Prisma, PostgreSQL.

## Conventions

- Server components by default.
- Review checklists live in `.claude/skills/code-review/`.
- Architecture notes are at `.claude/docs/architecture.md`.
- All database queries go through Prisma — never write raw SQL.

## Claude Code workflow

Use the `Grep`, `Glob`, and `Read` tools for investigation. Prefer
them over shelling out to `grep` or `find`. Draft a plan with
`ExitPlanMode` before non-trivial changes.

## Boundaries

- Never modify files in `generated/` — they are produced by codegen.
- Never skip TypeScript strict mode.
```

<!--
For the Codex/Gemini/OpenCode tabs, the frontend component computes the output by applying the rules table above. The other three outputs differ only in:
  - Header path (CLAUDE.md vs AGENTS.md vs GEMINI.md vs AGENTS.md)
  - Which path variable (${agloom:*_DIR}) resolves to which adapter directory
  - Which agent-specific block is kept (claude block vs agentsmd block)

Codex and OpenCode both produce AGENTS.md — for these tabs we keep the agent:agentsmd block.
Gemini produces GEMINI.md — neither agent block is kept (Gemini is a standalone instruction file; if we want team-specific Gemini guidance we'd add <!-- agent:gemini --> block, not done in this example to keep the file short).
-->
