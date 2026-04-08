# Agloom Landing — Page Map

> Content-spec лендинга `agloom.sh`, итерация v3. Каждый блок — отдельный файл в этой папке. Файлы пронумерованы в порядке вертикальной подачи на mobile. На desktop часть секций двухколоночные (указано в каждом файле).

## Ordering

| # | File | Purpose |
|---|------|---------|
| 01 | [header.md](./01-header.md) | Non-sticky header: wordmark + GitHub + Getting Started |
| 02 | [hero.md](./03-hero.md) | Manifesto: H1, subheadline, two actions, install window |
| 03 | [early-adopters.md](./02-early-adopters.md) | Thin strip: "we're collecting stories" + mailto |
| 04 | [hero-demo.md](./03a-hero-demo.md) | Interactive demo: project + git plugin → output tabs |
| 05 | [for-teams.md](./06-for-teams.md) | Philosophy + plugin layering visual |
| 06 | [solution.md](./04-solution.md) | Interactive demo: AGLOOM.md + interpolation → output tabs |
| 07 | [fragmentation-tax.md](./05-fragmentation-tax.md) | Matrix: features × agents, Agloom first column |
| 08 | [plugins.md](./07-plugins.md) | Small static before → after (config.yml → tree) |
| 09 | [formatting.md](./08-formatting.md) | Small static before → after (ugly → pretty) |
| 10 | [when-it-fits.md](./09-when-it-fits.md) | Use when / Skip when (two columns) |
| 11 | [faq.md](./10-faq.md) | Two vetted questions |
| 12 | [cta.md](./11-cta.md) | Install chip + Docs + GitHub |
| 13 | [footer.md](./12-footer.md) | One-line footer |

> Note: File name prefixes reflect the original numbering; the table column `#` above reflects the current render order. Hero now precedes the Early Adopters strip, so the strip sits between Hero and the interactive demo.

## Audience

**Primary.** Engineering teams and tech leads standardising AI-agent configuration across multi-assistant codebases.

**Secondary.** Individual developers running 2+ assistants, or reusing the same conventions across several of their own projects. Both cases are served by the same plugin mechanism.

## Tone

Technical-but-friendly. Concrete code examples, zero marketing fluff, honest about the tool's limits.

## Supported adapters in live examples

Four adapters are shown in the interactive demos: `claude`, `codex`, `gemini`, `opencode`. The full list of supported adapters grows over time and lives in `docs/reference/adapters`.

## Design non-goals (v1)

- No alternating section backgrounds. Background stays consistent; spacing and headings carry the visual rhythm.
- No sticky header.
- No duplicate primary CTA. The single `Get Started →` lives in Hero; the final CTA block reuses the install chip but is worded differently.
- No testimonials, logo strips, or "trusted by" sections. The Early Adopters strip is our honest placeholder until real stories arrive.

## Deferred to v2 of the landing

See `../landing-spec-v2.md` Appendix B for the full backlog (SEO meta, responsive breakpoints, animation polish, adapter scaling strategy, analytics, fonts, i18n).
