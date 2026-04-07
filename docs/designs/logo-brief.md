---
type: design-brief
name: agloom logo
status: decided
---

# agloom — Logo Design Brief

> **Decision (HITL):** Concept B — "Foggy double-o" — accepted as the primary
> mark. Strategy: **mark-only, no SVG lockup.** The header, hero, and README
> banner all use the mark alongside HTML/CSS text for the word "agloom",
> not a fused `<svg>` wordmark. See sections 5–6 for the updated plan.

## 1. Brand concept

**agloom** is a CLI tool that transpiles a canonical `AGLOOM.md` configuration into the dialects of various AI coding assistants (Claude Code, AGENTS.md, OpenCode, and others). It lives in the terminal, sits between an author and a swarm of agents, and is the "single source of truth" in a codebase that would otherwise drift across half a dozen tool-specific files.

The name is the pun: `agloom` reads as **"a gloom"** — dusk, sea fog, the half-hour before sunrise, the haze a candle throws on a dark wall. The product brand leans into that reading. The marketing site is **dark-only**: no light theme, ever. The palette is built from deep blue-violet shadows, cold mid-tones, and one warm pinprick of light. The mood we are going for is **calm, quiet, slightly atmospheric, technically precise** — a professional dev tool that happens to enjoy its own name.

What the logo **must** evoke: night sky before dawn, sea mist, a warm lamp in a dark room, silhouettes of mountains in twilight, noctilucent clouds, the moment fog starts to lift. What the logo **must not** evoke: Halloween, vampires, hooded figures, skulls, tears, graveyards, pentagrams, anything goth or horror-coded. The play here is on _weather_, not _death_.

Tone of voice in the mark: technical, minimal, lowercase, a little playful — never decorative, never spooky.

## 2. Competitive research

Survey of how comparable JS/TS dev tooling brands handle their marks. Source links below the table.

| Tool      | Logo type              | Notable features                                                                               | Source                                                                      |
| --------- | ---------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Bun       | Mascot icon + wordmark | Cartoon bun face, warm beige palette (`#fbf0df`), playful and anthropomorphic                  | [bun.sh](https://bun.sh)                                                    |
| Biome     | Wordmark               | Lowercase wordmark, dual light/dark SVGs, clean geometric letterforms, no mascot               | [biomejs.dev](https://biomejs.dev)                                          |
| Drizzle   | Wordmark + leaf glyph  | Vibrant lime green (`#c5f74f`) accent on near-black, lowercase, modern minimal                 | [orm.drizzle.team](https://orm.drizzle.team)                                |
| Hono      | Icon + wordmark        | Stylised flame ("hono" = flame in Japanese), warm orange/red, curved single-stroke mark        | [hono.dev](https://hono.dev)                                                |
| Vite      | Abstract mark          | Lightning bolt geometry, yellow→purple gradient, viewBox `0 0 23 14`, sharp angular forms      | [vite.dev](https://vite.dev)                                                |
| Deno      | Mascot                 | Friendly sauropod silhouette in a circle, minimal black-and-white, community artwork ecosystem | [deno.com/artwork](https://deno.com/artwork)                                |
| Turborepo | Abstract mark          | Concentric arrows / chevron geometry, magenta-to-blue gradient, dark backgrounds dominant      | [turborepo.com](https://turborepo.com)                                      |
| Tauri     | Abstract mark          | Geometric "T" with custom letterform, context-sensitive monochrome (WCAG AAA), Rubik wordmark  | [tauri.app brand guidelines](https://tauri.app/assets/brand_guidelines.pdf) |
| Astro     | Abstract mark          | Rocket/triangle silhouette, deep purple gradient, dark-mode-first                              | [astro.build](https://astro.build)                                          |

**What dominates the niche.** Lowercase wordmarks are the default — Biome, Drizzle, Vite, Bun, Hono and Astro all read in lowercase. Almost every tool ships at least two SVG variants (light + dark). About half have an abstract geometric mark that doubles as a favicon; the other half lean on a mascot (Bun, Deno) or pure typography (Biome). Gradients are popular (Vite, Turborepo, Astro) but always restrained — a single 2-stop diagonal, never rainbow. A warm-on-cool accent is a surprisingly common pattern (Vite's yellow on purple; Astro's white on near-black).

**Fresh approaches worth borrowing.** All-lowercase, generously-spaced, custom-lettered wordmarks (per 2026 trend reports). Adaptive systems where the same primitive can be a favicon, a header lockup, and an OG image without redrawing. One signature accent colour rather than a palette. Pixel-sharp construction that holds up at 16px.

**Clichés to avoid.** Terminal chrome with a `>_` prompt — done to death (literally every yak-shaving CLI from 2018–2022). Brackets `<>` or curly braces. A hexagon containing a glyph (npm-package-template energy). A chat bubble with a sparkle (the AI-product cliché of 2024). A lightning bolt (already Vite's). A face/mascot — too crowded a category and pulls focus from the wordmark.

**On the word itself.** "agloom" has six letters and a strong rhythm: lowercase `a`, then a compact `gl`, then a wide-open double-`o`, closed by `m`. The lowercase `a` is round and inviting and reads even at favicon size. The double-`o` is the most distinctive feature and is the obvious place to put a visual idea — it looks like two moons, or two lanterns, or two eyes peering out of fog. The `-loom` ending carries a useful double meaning: a _loom_ (warp and weft, threads woven together — almost literally what a transpiler does to multiple agent files) and the verb _to loom_ (a shape emerging from haze). Both readings reinforce the brand.

## 3. Design constraints

- **Monochrome first.** The primary mark must read at 16–24px in a single ink. Colour and gradient are secondary applications.
- **Dark-background-first.** Header, hero, OG image, and favicon all live on a deep blue-violet ground. A light-background variant exists only for GitHub READMEs and printed material.
- **No gradients in the primary mark.** A "secondary" gradient version is allowed for hero placements only.
- **SVG, inline-friendly.** Designed to drop into an `.astro` or `.tsx` component as raw markup.
- **`currentColor`.** All fills/strokes use `currentColor` so that CSS `color` switches the mark.
- **Grids.** Favicon mark on a 32×32 grid (with 2px clear-space). OG mark on a 120×120 grid centred in 1200×630. **No SVG lockup canvas** — header/hero compose the mark with HTML/CSS text for "agloom" rather than a baked-in wordmark.
- **No raster effects** (`filter: drop-shadow`, `feGaussianBlur`, etc.) in the primary mark. They alias badly under 32px and break monochrome printing.
- **Minimal paths.** Every concept below resolves to ≤6 path/shape elements so the SVG stays tiny and legible.
- **No JS, no external fonts, no external images.** Wordmark letters are drawn as paths or shapes; if a typeface is referenced it is documented as "outline before shipping".

## 4. Concept directions

Three concepts, in order of how strongly they commit to the "a gloom" pun.

---

### Concept A — "Moonrise a"

**Rationale.** This is the most direct read of "a gloom": a horizon, a sky, and a single moon coming up over it. The concept hides the visual inside the _first letter of the wordmark_ — the bowl of the lowercase `a` doubles as the moon, and the baseline doubles as the horizon line. Recognisable, weather-themed, not goth, and the puzzle pays off the second a viewer notices it.

**Description.** A heavy lowercase `a` set on a 32×32 grid. The bowl of the `a` is a perfect circle (the moon). A horizontal rule sits at the baseline of the `a` and extends past it on both sides — that is the horizon. A second, smaller circle in the upper-right corner is a single star/planet, which also visually balances the stem of the `a`. In monochrome the whole composition is one ink. On dark backgrounds the horizon line gets a subtle 1-stop gradient fade at its outer edges to imply fog (only in the hero variant).

**Mark (32×32, monochrome, favicon-grade):**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-label="agloom">
  <!-- horizon -->
  <line x1="3" y1="22" x2="29" y2="22" />
  <!-- moon (bowl of the 'a') -->
  <circle cx="14" cy="16" r="6" />
  <!-- stem of the 'a' -->
  <line x1="20" y1="10" x2="20" y2="22" />
  <!-- distant star -->
  <circle cx="26" cy="9" r="1.25" fill="currentColor" stroke="none" />
</svg>
```

**Lockup.** Dropped. Fallback concept only — header and hero would compose the mark with HTML/CSS text for "agloom" if this concept were ever promoted.

**Usage notes (fallback only).** Mark alone for the favicon, the GitHub social card, the macOS dock icon, and any avatar surface.

**Variations.** (i) Monochrome white on `#0b0b14` for the header; (ii) monochrome ink on cream for printed/light READMEs; (iii) "moonlit" version where only the moon circle is filled in `#e8d4a2` (warm lamp accent) and everything else stays in `currentColor` — used only on OG images.

---

### Concept B — "Foggy double-o"

**Rationale.** The most distinctive feature of the word "agloom" is the double-`o` in the middle. Two stacked or side-by-side circles are inherently a "pair of moons / pair of lanterns peering out of the fog" image. This concept turns the `oo` into the entire mark. It is _typographic_, which lines up with the 2026 wordmark-first trend (Biome, Drizzle), and it works at any size because two circles never break.

**Description.** A pair of equally-sized circles, side by side, with a thin horizontal "fog bank" passing through their lower third. The fog line breaks where it crosses the circles (so they read as foreground objects looming through it). The circles are outlined, not filled — they are "lanterns" or "moons", not solid disks. In the wordmark lockup, these two circles literally are the `oo` in `agloom`, which means the favicon and the header mark share the same primitive.

**Mark (32×32, monochrome):**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-label="agloom">
  <!-- fog band, broken where it crosses the circles -->
  <line x1="2" y1="20" x2="8" y2="20" />
  <line x1="14" y1="20" x2="18" y2="20" />
  <line x1="24" y1="20" x2="30" y2="20" />
  <!-- the two 'o's -->
  <circle cx="11" cy="16" r="5" />
  <circle cx="21" cy="16" r="5" />
</svg>
```

**Lockup.** Dropped. The mark is used on its own and the word "agloom" is always rendered as HTML/CSS text next to it (see section 5 — "Composition strategy"). The two-circle mark stands alone as favicon, OG, avatar, and header icon.

**Usage notes.** Favicon, apple-touch-icon, GitHub avatar, OG image centrepiece, and the small icon to the left of the HTML wordmark in the site header. In motion the fog band can drift left-to-right on hover (CSS, not in the SVG).

**Variations.** (i) Filled "lantern" version where both circles get a 1px-inset solid fill in a warm cream (`#e8d4a2`) — for OG images; (ii) single-`o` micro-favicon for sub-16px contexts (e.g. tab favicon at retina-half); (iii) all-stroke version vs. one-circle-filled-one-circle-stroked, to imply "near vs. far" depth.

---

### Concept C — "Loom thread"

**Rationale.** This concept follows the _other_ meaning of `-loom`: a loom, the device that weaves many threads into one cloth. That metaphor is unusually literal for what agloom does — it takes a single canonical input and weaves it into multiple agent-specific outputs. The mark is more abstract than A and B, and reads less obviously as "gloom-the-weather", but it captures the _function_ of the tool more precisely than either of the others.

**Description.** Three vertical lines (warp threads) crossed by a single horizontal line that curves gently as it passes — a single weft thread being drawn through. Underneath, a fourth horizontal line at the very bottom acts as a visual baseline / horizon, tying the loom metaphor back to the "horizon at dusk" mood. Geometric, calm, monospaced-feeling.

**Mark (32×32, monochrome):**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-label="agloom">
  <!-- warp threads -->
  <line x1="9"  y1="5" x2="9"  y2="23" />
  <line x1="16" y1="5" x2="16" y2="23" />
  <line x1="23" y1="5" x2="23" y2="23" />
  <!-- weft thread weaving through -->
  <path d="M4 14 Q9 11 16 14 T28 14" />
  <!-- horizon -->
  <line x1="4" y1="27" x2="28" y2="27" />
</svg>
```

**Lockup.** Dropped. Fallback concept only — header/hero composition, if ever switched to this concept, would rely on HTML/CSS text beside the mark.

**Usage notes (fallback only).** Best paired with a neighbouring HTML wordmark at header scale, because the abstract loom primitive reads less obviously at favicon size than concepts A and B.

**Variations.** (i) Animated weft thread that completes a sine curve on page-load (CSS, not in the SVG); (ii) two-tone version where the weft thread is drawn in a warm accent (`#e8d4a2`) and the warp + horizon stay in `currentColor`; (iii) a "lifting fog" variant where the bottom horizon line is drawn dashed.

## 5. Decision — Concept B, mark-only

**Concept B — "Foggy double-o" — accepted as the primary mark.** The initial
recommendation was Concept A, but user review preferred the readability and
visual weight of the two-circle mark. Concepts A and C remain documented above
as fallbacks only.

### Composition strategy: no SVG lockup

The mark is **always used on its own**. Whenever "agloom" needs to appear next
to the mark — site header, hero, README banner — the word is rendered as
**plain HTML text** in the same monospace font stack used by the rest of the
landing, not as a baked-in SVG wordmark.

Reasons:

1. **No outlining work.** A fused `<svg>` lockup would require redrawing
   "agloom" as outlined paths in Figma/Illustrator so the file does not depend
   on any installed font. HTML text sidesteps that entirely: the browser
   renders it in whatever the CSS `font-family` resolves to, identical to the
   rest of the page copy.
2. **Accessibility.** Real text is readable by screen readers, selectable,
   copy-pasteable, and indexable by search engines. A text-as-path SVG is none
   of those.
3. **CSS control.** Color, size, letter-spacing, hover states, and theme
   reactivity (`currentColor`) all work on HTML text out of the box. A baked
   wordmark would require a parallel set of SVG variants.
4. **The pun still lands.** The two circles read as "oo" because the word
   "agloom" sits a few pixels to their right in the same monospace. The brain
   completes the pattern. An embedded SVG wordmark is not necessary for
   recognition.
5. **Fewer assets to maintain.** One `logo-mark.svg` instead of a mark plus
   light/dark lockup variants plus outlined-path wordmarks.

### Where the mark appears

| Surface             | Implementation                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| Favicon             | `favicon.svg` (mark, `currentColor`) + generated `.ico` fallback                                            |
| Apple touch icon    | `apple-touch-icon.png` — mark rendered on `#0b0b14` ground at 180×180                                       |
| Site header         | Inline `<svg>` mark (≈32×32) + `<span>agloom</span>` in monospace, `color: currentColor`                    |
| Hero                | Large `<h1>agloom</h1>` in CSS, mark positioned independently (above or inline, TBD during layout)          |
| OG image (1200×630) | Mark centred, tagline typeset in the same monospace via the image rendering pipeline (separate design task) |
| README banner       | Static PNG rendered from an HTML/CSS template, not from a stored lockup SVG (separate design task)          |
| GitHub avatar       | Mark only on `#0b0b14` ground at 460×460                                                                    |

Concepts A and C remain valid **fallbacks**: A if the brand later wants to
pivot to the single-moon/horizon visual, C if the messaging pivots from "mood
of dusk" to "function of weaving".

## 6. Next steps

With Concept B accepted and the mark-only composition strategy locked in:

1. **Ship the mark as-is.** The SVG at `docs/designs/assets/foggy-oo-mark.svg`
   is production-ready: six shapes, `currentColor`, no raster effects, no JS,
   no external fonts. No outlining step is required because there is no
   embedded wordmark.
2. **Create the asset set in `landing/`** (handled by the landing spec/impl
   cycle, not in this brief):
   - `landing/public/favicon.svg` — copy of the mark, 32×32, `currentColor`.
   - `landing/public/favicon.ico` — multi-resolution fallback (16/32/48),
     generated from the SVG during build or committed as a static asset.
   - `landing/public/apple-touch-icon.png` — 180×180, mark rendered on
     `#0b0b14` ground.
   - `landing/src/assets/logo-mark.svg` — same mark, importable as an Astro
     component so it can inherit the page's `color` via CSS.
3. **Header brand component.** In `landing/src/components/Header.astro` (or
   equivalent): inline the mark SVG next to a `<span>agloom</span>` typeset
   in the landing's monospace stack. No `logo-lockup.svg`, no
   `logo-lockup-light.svg`.
4. **OG image (1200×630)** — separate design task. Compose the mark centrally
   with the tagline typeset in the same monospace. Render to PNG via an
   HTML/CSS → PNG pipeline (Playwright, Satori, or a hand-authored HTML
   template), **not** from a stored lockup SVG.
5. **README banner (1280×320)** — separate design task. Mark left-aligned,
   tagline ("a single source of truth for your AI agents" or similar)
   right-aligned. Rendered to PNG from an HTML template.
6. **GitHub organisation avatar** — 460×460, mark only on `#0b0b14` ground.
   Generated from the same `foggy-oo-mark.svg` via `rsvg-convert`.
7. **Decide on the dark-background hex.** The brief assumes `#0b0b14`
   (near-black with a violet bias). The landing's full palette is being
   locked in by the landing spec cycle (see `docs/specs/landing/SPEC.md`),
   and the mark must be visually checked against the finalised surface
   colour before any asset is committed.
8. **Optional professional polish (later)** — a designer could iterate on
   (i) a tuned warm accent colour for the "lantern" variation, replacing
   the placeholder `#e8d4a2`, and (ii) motion guidelines for the fog-band
   drift. Not a blocker for launch.
