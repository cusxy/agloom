# 06 — For Teams

<!--
Якорная секция для primary audience. Размещается после Fragmentation Tax, до deep-dives (Plugins, Formatting).

Layout desktop: 2 колонки.
  - Left: eyebrow + H2 + body + три нумерованных пункта
  - Right: plugin layering visual (static SVG)
Mobile: текст сверху, визуализация снизу.
-->

## Content (left column)

**Eyebrow:** `FOR TEAMS`

**H2:** Built around the reality that organisations have fleets of repos, not one.

**Body:**

> Agloom was designed around the assumption that engineering organisations don't have one repo — they have dozens, sometimes hundreds. Each with its own stack, its own contributors, its own AI-agent setup. The plugin system turns shared conventions into a versioned dependency you publish once, pin per repo, and roll out across your fleet.

### Three team benefits

1. **One canonical source per repo.** Every developer on the team sees the same instructions, skills, and sub-agents — no matter which assistant they happen to be running today. Drift between `CLAUDE.md` and `AGENTS.md` becomes structurally impossible because both files are generated from the same source.

2. **Reusable plugins across the fleet.** Publish your team's coding conventions, review checklists, and deployment skills as a plugin. Reference it from `config.yml` in every project. Update the plugin, tag a release, and every project picks it up on its next transpile. Pin individual repos to older versions during migrations.

3. **Project-scoped, never machine-scoped.** Agloom only reads from and writes to your project directory. It never touches `~/.claude/`, `~/.codex/`, or any global config. Your team's setup is reproducible across developer machines, CI runners, and contractor laptops, with zero surprises from someone's personal preferences.

<!--
Третий пункт — критичен для enterprise. Compliance, audit, reproducibility. Оставляем его именно так, без скромности.
-->

---

## Right column — plugin layering visual

<!--
Static SVG (не interactive). Горизонтальные слои, уложенные как стек карт:

      ┌─────────────────────────────────────┐
      │ 4. Local project (AGLOOM.md,        │  ← highest priority
      │    .agloom/)                        │
      ├─────────────────────────────────────┤
      │ 3. plugin: acme/android-stack @main │
      ├─────────────────────────────────────┤
      │ 2. plugin: acme/conventions @v1.2.0 │
      ├─────────────────────────────────────┤
      │ 1. plugin: acme/base @v3.1.0        │  ← lowest priority
      └─────────────────────────────────────┘
                      │
                      ▼
            agloom transpile
                      │
                      ▼
      CLAUDE.md  ·  AGENTS.md  ·  GEMINI.md  ·  …

Цветовая логика: слои одного семейства (слегка отличающиеся тональности foggy-oo), стрелки accent. Стиль плоский, без 3D-изометрии.

Подпись под диаграммой (small text):
"Plugins listed first have lowest priority. Later plugins and the local project override earlier ones."
-->
