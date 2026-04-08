# 09 — When Agloom Fits

<!--
Честный блок про границы. Эта секция — сигнал качества для tech-lead'ов, которые выбирают tooling для команды: инструмент, который честно говорит "нам не подходим" в определённых случаях, вызывает больше доверия.

Layout desktop: 2 колонки одинаковой ширины.
  - Left: "Use Agloom when" (accent заголовок)
  - Right: "Skip Agloom when" (neutral/muted заголовок)
Никакой красно-зелёной подсветки — "skip" не значит "плохо".
Mobile: вертикальное последование, use сверху, skip снизу.
-->

## Content

**Eyebrow:** `IS THIS FOR YOU?`

**H2:** Honest about the fit.

---

### Use Agloom when

- Your project (or your team's projects) uses **two or more** AI coding assistants.
- Your team wants to **standardise** instructions, skills, and conventions across agents.
- You have **reusable skills, sub-agents, or commands** that should be shared between projects.
- You want a **plugin system** to distribute team-wide configurations across your fleet.
- You need **reproducibility** across developer machines and CI without leaking personal preferences from `~/.claude/` or `~/.codex/`.

### Skip Agloom when

- Your project uses **only one** AI coding assistant and you're confident you won't add a second.
- You have no need for shared configurations across projects.
- Editing the tool's native files directly is fast enough for your workflow.

---

**Kicker (italic, centered below both columns):**

> Agloom is overhead in exchange for leverage. If you don't have the leverage to gain, the overhead isn't worth it.
