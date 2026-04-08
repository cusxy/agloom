# 10 — FAQ

<!--
Только два вопроса. Оба — закрывают реальные блокеры, которые может почувствовать team-lead, листая лендинг:
  1. "Это что-то заменяет? Или дополняет?"
  2. "Оно не полезет в мой глобальный конфиг?"

Формат: collapsible accordion, обе открытые по умолчанию (их всего две, нет смысла прятать).
Layout: одна колонка, max-width ~720px, центрированная.
-->

## Content

**Eyebrow:** `FAQ`

**H2:** Two questions we always get.

---

**Q: Does Agloom replace Claude Code, Codex, Gemini, or OpenCode?**

> No. Agloom only generates the config files those tools read. Each assistant runs exactly the same way it does without Agloom — Agloom just makes sure their config files stay in sync with one canonical source. Install Agloom, uninstall it, switch assistants freely. The generated files are standard native configs.

**Q: Does Agloom touch global config like `~/.claude/`, `~/.codex/`, or `~/.config/gemini/`?**

> Never. Agloom is strictly project-scoped. It only reads from and writes to your project directory. Your personal preferences, machine-wide tool settings, and home-directory configuration stay completely out of scope. Switching to Agloom in one project does not affect any other project or your global setup.
