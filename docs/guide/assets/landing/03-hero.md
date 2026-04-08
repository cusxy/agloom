# 03 — Hero

<!--
Above the fold. Двухколоночный layout: текстовой манифест слева, окно установки справа.

Интерактивное демо живёт в отдельной секции ниже — см. [03a-hero-demo.md](./03a-hero-demo.md).
Hero сознательно «плоский» манифест: headline, короткий параграф, две ссылки-кнопки и
install-окно. Никакого eyebrow, никакого primary CTA с отдельной стилистикой — обе ссылки
равноправны по визуальному весу (первая чуть выделена как accent).

Desktop layout: 2 колонки (6fr / 6fr), gutter ~48px, align-items: center.
  - Left: H1 → subheadline → две кнопки в ряд
  - Right: install-окно с macOS chrome и footer
Mobile (≤1020px): одна колонка. Текст сверху, install-окно снизу, полная ширина.
-->

## Content (left column)

**Headline (H1):**

> Write once.
> Ship to every agent.

H1 разбит на две строки принудительным `<br />`. Используется display-serif
(`Fraunces`), вес 500, `clamp(2.5rem, 5vw, 4.25rem)`, line-height 1.02.
Никакого eyebrow над headline — в текущей итерации первая строка сразу
утверждение.

**Subheadline:**

> Agloom transpiles a single canonical `.agloom/` directory into the exact config files every AI coding assistant in your team expects. Edit in one place. Regenerate on demand.

Моноширинный, muted цвет, line-height 1.7, max-width ~56ch. `.agloom/` — inline
code с цветом foreground (не muted), чтобы путь визуально «прыгнул» наружу.

**Actions (две ссылки-кнопки в ряд):**

1. `Source on GitHub` — `btn btn--ghost` стиль (прозрачный фон, neutral border) с
   иконкой octocat слева.
   URL: `https://github.com/cusxy/agloom`. Открывается в новой вкладке.
2. `Read the docs →` — `btn btn--primary` стиль (foggy-violet градиент, accent border).
   URL: `https://docs.agloom.sh/`. Открывается в новой вкладке.

Первой идёт GitHub-кнопка как ghost-вариант, затем — primary `Read the docs →`.
Порядок «ghost → primary» даёт естественный визуальный градиент слева направо.

Обе кнопки обёрнуты `target="_blank"` + `rel="noopener noreferrer"`.

## Content (right column) — install window

<!--
macOS-терминальное окно, большое (высота ~260px на desktop):
  - Chrome bar сверху: три dot'а слева (#ed6a5e / #f4bf4f / #61c554), подпись справа.
  - Body: большой `$ npm install -g agloom` — font-size text-base, padding ~48px vertical.
  - Footer bar снизу: поддерживаемые платформы слева, Copy-кнопка справа.
-->

**Chrome bar:**

- Three dots слева: красный `#ed6a5e`, жёлтый `#f4bf4f`, зелёный `#61c554`. Каждый dot с тонким внутренним border для «стеклянного» эффекта.
- Title справа: `~/your-project` (mono, xxs, uppercase, muted).

**Body:**

```bash
$ npm install -g agloom
```

Font-size `text-base`, padding `var(--space-8) var(--space-6)`. Prompt `$` — warm (`--color-warm`), команда — spark (`--color-spark`).

**Footer bar:**

- Слева: `macOS · Linux · Windows · Node ≥ 20` (mono, xxs, uppercase, muted).
- Справа: кнопка `Copy` в стиле tag-chip (прозрачный фон, border, xxs label). При клике копирует команду в clipboard и на 1.5s меняет текст на `Copied`.

## Interactive demo

Интерактивное демо вынесено в отдельный блок ниже Hero — см.
[03a-hero-demo.md](./03a-hero-demo.md). Hero остаётся «плоским»
манифестом, а демонстрация идёт следующим шагом.
