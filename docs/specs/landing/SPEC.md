---
summary: Маркетинговый лендинг agloom.sh
description: >
  Спецификация одностраничного маркетингового лендинга Agloom на Astro 5.x,
  расположенного в подпапке landing/ монорепо и деплоящегося на agloom.sh
  через отдельный проект Cloudflare Pages. Включает структуру проекта,
  компоненты, контент, дизайн-токены, SEO-метаданные и критерии верификации.
type: spec
status: implemented
relates:
  - docs/researches/landing-stack.md
  - docs/specs/docusaurus-setup.md
  - docs/specs/ci-deploy.md
maps_to:
  - landing/
---

# Маркетинговый лендинг agloom.sh

Ключевые слова «ТРЕБУЕТСЯ», «ЗАПРЕЩАЕТСЯ», «ДОЛЖЕН», «НЕ ДОЛЖЕН», «СЛЕДУЕТ»,
«НЕ СЛЕДУЕТ», «МОЖЕТ» и «НЕОБЯЗАТЕЛЬНО» в этом документе толкуются
в соответствии с [RFC 2119](https://tools.ietf.org/html/rfc2119).

## Контекст и цель

Agloom — CLI-инструмент, транспилирующий канонические файлы `AGLOOM.md`
в форматы конкретных AI-агентов (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`
и другие). Документация уже размещена на `docs.agloom.sh` (Docusaurus,
директория `website/`).

Маркетинговый лендинг `agloom.sh` ТРЕБУЕТСЯ как самостоятельная
точка входа для нового пользователя: формирует первое впечатление,
доносит ценностное предложение и направляет на установку и документацию.
Лендинг ДОЛЖЕН быть полностью независимым от docs-сайта по сборке и
деплою.

Стек (Astro 5.x) и расположение (подпапка `landing/` рядом с `website/`)
обоснованы в [docs/researches/landing-stack.md](../../researches/landing-stack.md).

### Брендовая концепция

Название `agloom` обыгрывается как `a gloom` — мрак, сумерки, туман.
Эта концепция ДОЛЖНА быть центральной для визуального языка лендинга:
тёмное, слегка туманное пространство, оставаясь при этом
технически-профессиональным dev-tool сайтом. Готическая или хоррор-эстетика
ЗАПРЕЩЕНА. Светлая тема ЗАПРЕЩЕНА — лендинг ДОЛЖЕН быть строго dark-only,
это часть идентичности.

## Пользовательские сценарии

Сценарии описывают типичные пути посетителя по лендингу. Каждый сценарий
ДОЛЖЕН быть достижим без JavaScript на стороне клиента, за исключением
шагов, явно отмеченных как требующие JS.

### Сценарий 1: Новый посетитель узнаёт продукт

1. Посетитель открывает `https://agloom.sh/`.
2. Браузер отображает hero-блок с названием продукта `agloom`,
   tagline и кратким описанием (1–2 предложения).
3. Посетитель видит блок установки с одной командой.
4. Посетитель прокручивает страницу и видит сетку из 4–6 ключевых
   возможностей продукта.
5. Посетитель видит CTA-блок с двумя кнопками — переход в документацию
   и переход в репозиторий GitHub.
6. Посетитель видит footer со ссылкой на лицензию, copyright и GitHub.

### Сценарий 2: Посетитель копирует команду установки

1. Посетитель находит блок установки с командой `npm install -g agloom`.
2. Посетитель нажимает кнопку «Copy» рядом с командой.
3. Команда копируется в буфер обмена через Clipboard API. Этот шаг
   ТРЕБУЕТ JavaScript.
4. Кнопка отображает подтверждение копирования (например, текст «Copied»)
   на короткий промежуток времени.

### Сценарий 3: Посетитель переходит в документацию

1. Посетитель нажимает CTA-кнопку «Read the docs».
2. Браузер переходит по адресу `https://docs.agloom.sh/`.

### Сценарий 4: Посетитель переходит в репозиторий

1. Посетитель нажимает CTA-кнопку «View on GitHub» либо ссылку
   GitHub в footer.
2. Браузер переходит по адресу `https://github.com/cusxy/agloom`.

## Структура проекта `landing/`

Подпапка `landing/` ДОЛЖНА располагаться в корне монорепо рядом с
`website/`. Структура файлов:

```text
landing/
├── package.json
├── astro.config.mjs
├── tsconfig.json
├── README.md
├── public/
│   ├── favicon.svg
│   ├── og-image.png        (placeholder)
│   └── robots.txt
├── src/
│   ├── pages/
│   │   └── index.astro
│   ├── layouts/
│   │   └── BaseLayout.astro
│   ├── components/
│   │   ├── Hero.astro
│   │   ├── InstallSnippet.astro
│   │   ├── Features.astro
│   │   ├── CTA.astro
│   │   └── Footer.astro
│   ├── styles/
│   │   ├── tokens.css
│   │   └── global.css
│   └── assets/
│       └── logo.svg        (placeholder)
└── dist/                   (gitignored, build output)
```

### `package.json`

Файл `landing/package.json` ДОЛЖЕН содержать:

- `name` — `"@agloom/landing"`.
- `version` — `"0.0.0"`.
- `private` — `true`.
- `type` — `"module"`.
- `scripts.dev` — `"astro dev"`.
- `scripts.build` — `"astro build"`.
- `scripts.preview` — `"astro preview"`.
- `dependencies.astro` — версия `^5.0.0`.

Пакет ЗАПРЕЩАЕТСЯ публиковать в npm.

### `astro.config.mjs`

Конфигурация ДОЛЖНА содержать:

- `output: 'static'` — статический билд.
- `site: 'https://agloom.sh'` — для генерации canonical URL и sitemap.
- `outDir: './dist'` — директория артефактов.
- `compressHTML: true` — минификация HTML.

Сторонние интеграции (React, MDX, image-optimization) ЗАПРЕЩЕНЫ
в первой итерации.

### `tsconfig.json`

ДОЛЖЕН расширять `astro/tsconfigs/strict`. Никаких локальных
ослаблений строгости не вносится.

## Компоненты

### `BaseLayout.astro`

**Вход (props):**

- `title` (string, обязательно) — содержимое тега `<title>`.
- `description` (string, обязательно) — значение `meta name="description"`.
- `canonical` (string, опционально, default: `https://agloom.sh/`) —
  canonical URL.

**Поведение:**

1. Layout рендерит корневой `<!doctype html>`.
2. Layout рендерит `<html lang="en">`.
3. Layout рендерит `<head>` с `<meta charset="utf-8">`,
   `<meta name="viewport" content="width=device-width, initial-scale=1">`,
   `<title>{title}</title>`, `<meta name="description" content={description}>`,
   `<link rel="canonical" href={canonical}>`,
   `<meta name="theme-color" content="#0a0b0f">`,
   `<meta name="color-scheme" content="dark">`.
4. Layout рендерит Open Graph теги: `og:title`, `og:description`,
   `og:url`, `og:image` (значение — `https://agloom.sh/og-image.png`),
   `og:type` со значением `website`.
5. Layout рендерит Twitter Card теги: `twitter:card` со значением
   `summary_large_image`, `twitter:title`, `twitter:description`,
   `twitter:image`.
6. Layout рендерит `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`.
7. Layout импортирует `src/styles/tokens.css` и `src/styles/global.css`
   как глобальные стили.
8. Layout рендерит `<body>` со слотом для содержимого страницы.
9. Layout условно рендерит блок Cloudflare Web Analytics перед
   закрывающим `</body>` (см. расширение 9a).

**Расширения:**

- 9a. Если переменная окружения `PUBLIC_CF_ANALYTICS_TOKEN` пустая
  или не задана — блок аналитики НЕ ДОЛЖЕН вставляться. Билд
  ДОЛЖЕН завершаться успешно. Если переменная задана — Layout
  ДОЛЖЕН рендерить тег
  `<script defer src="https://static.cloudflareinsights.com/beacon.min.js"
data-cf-beacon='{"token": "<значение переменной>"}'></script>`.

**Результат:**

Корневой HTML-документ с заполненной head-секцией и пустым телом,
готовым принять компоненты страницы через слот.

### `Hero.astro`

**Вход:** props отсутствуют.

**Поведение:**

1. Компонент рендерит `<section data-section="hero">`.
2. Компонент рендерит wordmark `agloom` внутри тега `<h1>`.
   Класс `wordmark` ТРЕБУЕТСЯ. Тег `<h1>` ДОЛЖЕН быть единственным
   на странице.
3. Компонент рендерит tagline внутри тега `<p data-role="tagline">`.
4. Компонент рендерит описание (1–2 предложения) внутри
   `<p data-role="lede">`.
5. Компонент резервирует место для будущего SVG-логотипа размером
   около 32×32 в виде `<span data-role="logo-slot" aria-hidden="true">`.

**Расширения:** Нет расширений.

**Результат:** HTML-фрагмент hero-секции, готовый для вставки
в `index.astro`.

### `InstallSnippet.astro`

**Вход:** props отсутствуют.

**Поведение:**

1. Компонент рендерит `<section data-section="install">`.
2. Компонент рендерит подзаголовок «Install» внутри `<h2>`.
3. Компонент рендерит блок кода через Astro-компонент `<Code>`
   из `astro:components` с пропами `code="npm install -g agloom"`
   и `lang="bash"`.
4. Компонент рендерит кнопку `<button data-role="copy"
data-clipboard-text="npm install -g agloom" type="button">Copy</button>`.
5. Компонент включает inline-скрипт (Astro `<script>`), реализующий
   обработчик клика по кнопке: чтение `data-clipboard-text`,
   вызов `navigator.clipboard.writeText`, временную смену текста
   кнопки на «Copied» на 1500 миллисекунд.

**Расширения:**

- 5a. Если `navigator.clipboard` недоступен — обработчик ДОЛЖЕН
  не выбрасывать необработанное исключение. Команда ДОЛЖНА оставаться
  доступной для выделения и копирования вручную.

**Результат:** HTML-фрагмент с подсвеченной командой установки и
кнопкой копирования.

### `Features.astro`

**Вход:** props отсутствуют. Список фич ДОЛЖЕН быть статически
определён в шаблоне компонента.

**Поведение:**

1. Компонент рендерит `<section data-section="features">`.
2. Компонент рендерит подзаголовок секции внутри `<h2>`.
3. Компонент рендерит контейнер `<ul data-role="feature-grid">`.
4. Компонент рендерит от 4 до 6 элементов `<li data-role="feature">`,
   каждый из которых содержит `<h3>` с заголовком фичи и `<p>`
   с описанием в 1–2 предложения.

**Расширения:** Нет расширений.

**Результат:** HTML-фрагмент сетки возможностей.

### `CTA.astro`

**Вход:** props отсутствуют.

**Поведение:**

1. Компонент рендерит `<section data-section="cta">`.
2. Компонент рендерит призыв к действию внутри `<h2>`.
3. Компонент рендерит две ссылки рядом:
   - `<a href="https://docs.agloom.sh/" data-role="cta-docs">Read the docs</a>`.
   - `<a href="https://github.com/cusxy/agloom" data-role="cta-github"
rel="noopener">View on GitHub</a>`.

**Расширения:** Нет расширений.

**Результат:** HTML-фрагмент CTA-блока.

### `Footer.astro`

**Вход:** props отсутствуют.

**Поведение:**

1. Компонент рендерит `<footer data-section="footer">`.
2. Компонент рендерит строку copyright в формате
   `© <год> Nikita Gorbunov`.
3. Компонент рендерит ссылку на лицензию
   `<a href="https://github.com/cusxy/agloom/blob/main/LICENSE">Apache-2.0</a>`.
4. Компонент рендерит ссылку
   `<a href="https://github.com/cusxy/agloom" rel="noopener">GitHub</a>`.

**Расширения:** Нет расширений.

**Результат:** HTML-фрагмент footer.

### `index.astro`

**Вход:** props отсутствуют.

**Поведение:**

1. Страница импортирует `BaseLayout` и пять компонентов секций.
2. Страница рендерит `BaseLayout` со значениями `title="Agloom — Transpile
AI agent configurations"` и описанием из секции [Контент](#контент).
3. Внутри слота Layout страница рендерит компоненты в порядке:
   `Hero`, `InstallSnippet`, `Features`, `CTA`, `Footer`.

**Расширения:** Нет расширений.

**Результат:** Готовая страница `dist/index.html` после билда.

## Контент

Все тексты ниже — каноничные. Изменение требует обновления спецификации.

### Hero

- **Wordmark**: `agloom`.
- **Tagline**: `One source of truth for every AI coding assistant.`
- **Описание**: `Agloom transpiles canonical agent configurations into
the formats expected by Claude Code, OpenCode, Codex, Gemini, KiloCode
and Agents.md — from a single AGLOOM.md.`

### Install snippet

- **Подзаголовок**: `Install`.
- **Команда**: ровно одна строка — `npm install -g agloom`.

### Features

Список из пяти фич. Каждый элемент содержит точный заголовок и описание.
Источник — `docs/guide/getting-started.md` и фактическая функциональность
CLI, отражённая в `package.json` (`description`, `bin`).

1. **Заголовок**: `One canonical file`.
   **Описание**: `Write your project instructions once in AGLOOM.md and
generate CLAUDE.md, AGENTS.md, GEMINI.md and more from the same source.`
2. **Заголовок**: `Multi-agent adapters`.
   **Описание**: `Built-in adapters for Claude Code, OpenCode, Codex,
Gemini, KiloCode and the shared AGENTS.md format.`
3. **Заголовок**: `Skills, agents and commands`.
   **Описание**: `Author reusable skills, sub-agents and slash commands
in .agloom/ and ship them to every supported tool with one command.`
4. **Заголовок**: `Overlays preserve your existing setup`.
   **Описание**: `Existing CLAUDE.md, .claude/, AGENTS.md and similar
files are kept as overlays so adoption is non-destructive.`
5. **Заголовок**: `Format and lint built in`.
   **Описание**: `agloom format normalises Markdown, JSON, YAML and TOML
in your .agloom/ directory so canonical files stay clean.`

### CTA

- **Призыв**: `Get started in minutes.`
- **Кнопка 1**: `Read the docs` → `https://docs.agloom.sh/`.
- **Кнопка 2**: `View on GitHub` → `https://github.com/cusxy/agloom`.

### Footer

- **Copyright**: `© 2026 Nikita Gorbunov`.
- **Лицензия**: `Apache-2.0` → `https://github.com/cusxy/agloom/blob/main/LICENSE`.
- **GitHub**: `https://github.com/cusxy/agloom`.

### Отсутствующее содержимое

В итоговом HTML ЗАПРЕЩЕНО присутствие placeholder-токенов:
строки `Lorem ipsum`, `TODO`, `FIXME`, `[NEEDS CLARIFICATION]`,
`PLACEHOLDER` (без учёта регистра) НЕ ДОЛЖНЫ встречаться.

## Дизайн-токены

Файл `src/styles/tokens.css` ДОЛЖЕН определять CSS custom properties
на селекторе `:root`. Значения ниже каноничны и зафиксированы в `choices`
секции в конце документа.

### Цветовая палитра

```css
:root {
  --color-bg: #0a0b0f;
  --color-bg-elevated: #0e0f14;
  --color-fg: #c5c8d1;
  --color-fg-muted: #7a7e8c;
  --color-accent: #6b8caf;
  --color-accent-hover: #88a4c4;
  --color-border: #1c1e26;
  --color-code-bg: #11131a;
}
```

Светлая тема ЗАПРЕЩЕНА. Файл `tokens.css` НЕ ДОЛЖЕН содержать
блоков `@media (prefers-color-scheme: light)` или
`@media (prefers-color-scheme: dark)`.

### Типографика

```css
:root {
  --font-mono: ui-monospace, "SFMono-Regular", "JetBrains Mono", "Menlo", "Consolas", monospace;
  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Helvetica Neue", "Arial", sans-serif;

  --tracking-body: 0.01em;
  --tracking-display: 0.04em;
  --leading-body: 1.6;
  --leading-display: 1.15;
}
```

Шрифты подключаются исключительно через system-stack. Загрузка
веб-шрифтов через Google Fonts CDN или другие внешние сервисы
ЗАПРЕЩЕНА. Self-hosted веб-шрифты в первой итерации НЕ ТРЕБУЮТСЯ.

### Type scale

```css
:root {
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.5rem;
  --text-2xl: 2rem;
  --text-3xl: 3rem;
}
```

### Spacing scale

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
  --space-16: 64px;
}
```

### Breakpoints

- `mobile`: `< 640px` (значение по умолчанию, без media query).
- `tablet`: `>= 640px`.
- `desktop`: `>= 1024px`.

### Глобальные стили

`src/styles/global.css` ДОЛЖЕН:

1. Применять `box-sizing: border-box` ко всем элементам.
2. Устанавливать `background: var(--color-bg)` и
   `color: var(--color-fg)` на `body`.
3. Применять `font-family: var(--font-sans)` на `body` и
   `font-family: var(--font-mono)` на `.wordmark`, `code`, `pre`.
4. Применять очень слабый радиальный градиент на `body`:
   `radial-gradient(ellipse at center, #0e0f14 0%, #0a0b0f 70%)` —
   для эффекта затемнённых краёв. Тяжёлые иллюстрации, JS-анимации
   и параллакс ЗАПРЕЩЕНЫ.
5. Не содержать импортов внешних шрифтов.

## SEO и meta

Готовый `dist/index.html` ДОЛЖЕН содержать:

- `<html lang="en">`.
- Непустой `<title>` со значением `Agloom — Transpile AI agent configurations`.
- `<meta name="description">` с непустым значением.
- `<link rel="canonical" href="https://agloom.sh/">`.
- `<meta name="theme-color" content="#0a0b0f">`.
- `<meta name="color-scheme" content="dark">`.
- Open Graph: `og:title`, `og:description`, `og:url`, `og:image`,
  `og:type=website`.
- Twitter Card: `twitter:card=summary_large_image`, `twitter:title`,
  `twitter:description`, `twitter:image`.
- `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`.

Файл `public/robots.txt` ДОЛЖЕН содержать минимальный контент:

```text
User-agent: *
Allow: /
```

Sitemap в первой итерации НЕ ТРЕБУЕТСЯ — лендинг состоит из одной
страницы.

## Интеграция с Cloudflare Pages

Лендинг ДОЛЖЕН деплоиться через **отдельный** проект Cloudflare Pages,
независимый от существующего docs-проекта `website/`.

### Параметры проекта

- **Project name**: `agloom-landing` (или эквивалент).
- **Production branch**: `main`.
- **Root directory**: `landing`.
- **Build command**: `pnpm install --frozen-lockfile && pnpm --filter @agloom/landing build`.
- **Build output directory**: `dist` (относительно root directory,
  итоговый путь — `landing/dist`).
- **Node version**: `20`.
- **Custom domain**: `agloom.sh`.
- **Environment variables**:
  - `NODE_VERSION` = `20`.
  - `PUBLIC_CF_ANALYTICS_TOKEN` — опционально, токен Cloudflare
    Web Analytics. Если не задана — скрипт аналитики не вставляется
    (см. расширение 9a компонента `BaseLayout`).

SPA-fallback (`_redirects` с правилом `/* /index.html 200`)
НЕ ТРЕБУЕТСЯ — лендинг полностью статический.

## Монорепо-интеграция

### Изменения в `pnpm-workspace.yaml`

В существующий список `packages` ТРЕБУЕТСЯ добавить запись `landing`,
рядом с уже существующей `website`:

```yaml
packages:
  - "packages/*"
  - "website"
  - "landing"
```

Никакие другие изменения в `pnpm-workspace.yaml` не требуются.

### Корневой `package.json`

Корневой `package.json` ЗАПРЕЩАЕТСЯ менять в рамках данной спецификации.
Скрипты для лендинга вызываются через `pnpm --filter @agloom/landing <script>`.

### Публикация

Пакет `@agloom/landing` ДОЛЖЕН быть приватным (`private: true`)
и НЕ ДОЛЖЕН публиковаться в npm.

### CI

GitHub Actions workflow для лендинга ДОЛЖЕН быть отдельным от workflow
основного CLI и фильтровать триггеры по `paths: ['landing/**']`. Детали
CI вне scope данной спецификации — описываются отдельно при имплементации.

## Placeholder assets

На момент создания спецификации финальный логотип, фавикон и OG-image
отсутствуют. ТРЕБУЕТСЯ использовать placeholder-варианты:

- **Wordmark**: текст `agloom` моноширинным шрифтом из `--font-mono`.
  В `Hero.astro` зарезервирован `<span data-role="logo-slot">`
  для будущего SVG.
- **Favicon** (`public/favicon.svg`): минимальный inline SVG 32×32
  с буквой `a` цветом `--color-accent` на фоне `--color-bg`.
- **OG-image** (`public/og-image.png`): placeholder-изображение
  размером 1200×630 пикселей с тем же фоном и wordmark `agloom`
  по центру. Файл ТРЕБУЕТСЯ для существования референса
  `og:image`, его дизайн — временный.
- **Logo** (`src/assets/logo.svg`): placeholder, идентичный favicon
  по содержимому. Используется только если `Hero.astro` подключает
  его в будущей итерации.

### `landing/README.md`

`landing/README.md` ДОЛЖЕН содержать минимум три секции:

1. **Quick start** — команды `pnpm --filter @agloom/landing dev` и
   `pnpm --filter @agloom/landing build`.
2. **Replacing placeholder assets** — список путей, куда положить
   финальные ассеты:
   - `landing/src/assets/logo.svg` — финальный логотип.
   - `landing/public/favicon.svg` — финальный фавикон.
   - `landing/public/og-image.png` — финальное OG-изображение
     (1200×630 пикселей, PNG).
3. **Cloudflare Web Analytics activation** — инструкция: создать
   проект в Cloudflare dashboard, скопировать токен, задать
   переменную окружения `PUBLIC_CF_ANALYTICS_TOKEN` в настройках
   проекта Cloudflare Pages, повторить деплой.

## Верифицируемые критерии

Список критериев для test-deriver. Каждый пункт ДОЛЖЕН стать
автоматическим тестом.

### Сборка

1. Команда `pnpm --filter @agloom/landing build` завершается с кодом
   выхода `0`.
2. После сборки существует файл `landing/dist/index.html`.
3. После сборки существует файл `landing/dist/favicon.svg`.
4. После сборки существует файл `landing/dist/og-image.png`.
5. После сборки существует файл `landing/dist/robots.txt`.

### HTML — структура и meta

Все проверки выполняются на содержимом `landing/dist/index.html`.

1. Корневой тег — `<html lang="en">`.
2. Присутствует непустой `<title>` со значением
   `Agloom — Transpile AI agent configurations`.
3. Присутствует `<meta name="description">` с непустым атрибутом
   `content`.
4. Присутствует `<meta name="theme-color" content="#0a0b0f">`.
5. Присутствует `<meta name="color-scheme" content="dark">`.
6. Присутствует `<link rel="canonical" href="https://agloom.sh/">`.
7. Присутствуют OG-теги: `og:title`, `og:description`, `og:url`,
   `og:image`, `og:type` со значением `website`.
8. Присутствует `twitter:card` со значением `summary_large_image`.
9. Присутствует `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`.

### HTML — содержимое

1. Присутствует ровно один тег `<h1>`, и его текстовое содержимое
   содержит подстроку `agloom`.
2. Присутствует элемент со значением `data-section="install"`,
   содержащий точную строку `npm install -g agloom`.
3. Присутствует элемент со значением `data-section="features"`,
   содержащий не менее 4 и не более 6 потомков с `data-role="feature"`.
4. Каждый потомок `data-role="feature"` содержит непустой `<h3>`
   и непустой `<p>`.
5. Присутствует ссылка `<a>` с атрибутом `href="https://docs.agloom.sh/"`.
6. Присутствует ссылка `<a>` с атрибутом
   `href="https://github.com/cusxy/agloom"`.
7. Присутствует кнопка с атрибутом `data-role="copy"`.

### HTML — отсутствие

1. В `landing/dist/index.html` отсутствуют (без учёта регистра)
   подстроки `Lorem ipsum`, `TODO`, `FIXME`,
   `[NEEDS CLARIFICATION]`, `PLACEHOLDER`.
2. В содержимом `landing/dist/` (HTML и CSS) отсутствует строка
   `prefers-color-scheme`.

### Cloudflare Web Analytics

1. При сборке без переменной `PUBLIC_CF_ANALYTICS_TOKEN` в
   `landing/dist/index.html` отсутствует подстрока
   `cloudflareinsights.com`.
2. При сборке с заданной переменной `PUBLIC_CF_ANALYTICS_TOKEN=test123`
   в `landing/dist/index.html` присутствует подстрока
   `data-cf-beacon` и подстрока `test123`.

### Запреты на стек

1. В `landing/dist/` отсутствуют файлы с расширениями `.tsx` и `.jsx`
   среди исходников, попавших в бандл.
2. В `landing/package.json` отсутствуют зависимости `tailwindcss`,
   `react`, `react-dom`, `vue`, `svelte`.

## Ограничения

- ЗАПРЕЩАЕТСЯ использовать Tailwind CSS и любые CSS-фреймворки.
- ЗАПРЕЩАЕТСЯ подключать UI-фреймворки (React, Vue, Svelte, Solid)
  внутрь Astro-страницы. Только vanilla `.astro`-компоненты.
- ЗАПРЕЩАЕТСЯ светлая тема и любые `prefers-color-scheme` media
  queries.
- ЗАПРЕЩАЕТСЯ загрузка веб-шрифтов через CDN (Google Fonts и подобные).
- ЗАПРЕЩАЕТСЯ использование иконочных шрифтов.
- ЗАПРЕЩАЕТСЯ JS-анимация, scroll-параллакс, тяжёлые иллюстрации.
- ЗАПРЕЩАЕТСЯ модификация корневого `package.json` и директории
  `website/` в рамках данной спецификации.
- ЗАПРЕЩАЕТСЯ публикация пакета `@agloom/landing` в npm.

## Вне scope

Перечисленные пункты НЕ ТРЕБУЕТСЯ реализовывать в рамках данной
спецификации:

- Showcase-страница и любые дополнительные маршруты, кроме `/`.
- Блог, changelog, news.
- Финальный логотип — ожидает design brief
  (`docs/designs/logo-brief.md`).
- Финальное OG-изображение — используется placeholder.
- Альтернативные пакетные менеджеры в install snippet (pnpm, bun,
  yarn). На первой итерации — только `npm install -g agloom`.
- Светлая тема и переключатель тем.
- Self-hosted веб-шрифты.
- Sitemap.
- i18n.
- A/B тесты, формы, подписка на рассылку.
- Интеграция с docs-сайтом по navigation (общий header/footer).

## Choices

- **C1 — Список из пяти фич для feature grid.** Контекст: задача
  требует 4–6 ключевых возможностей CLI, источник — описания в
  `docs/guide/getting-started.md` и `package.json`. Анализ:
  выбраны фичи, отражающие фактическую функциональность (single
  source AGLOOM.md, multi-adapter, skills/agents/commands, overlays
  для non-destructive adoption, встроенный formatter). Альтернативы:
  меньше фич выглядит скудно, больше — размывает фокус.
  Confidence: **medium**. Требует валидации на HITL.
- **C2 — Цветовая палитра.** Контекст: пользователь зафиксировал
  тёмный, слегка синеватый/фиолетовый фон, приглушённый foreground,
  один холодный акцент. Анализ: подобраны hex-значения
  `#0a0b0f` (фон), `#c5c8d1` (текст), `#6b8caf` (туманно-голубой
  акцент). Подбор субъективен. Confidence: **medium**.
- **C3 — Font-stack: system-only.** Контекст: ограничение запрещает
  CDN-шрифты, self-hosted в первой итерации не требуется. Анализ:
  system stack даёт нулевой network cost, мгновенный first paint
  и предсказуемый рендеринг. Альтернатива (self-hosted JetBrains
  Mono / Inter) — отложена до первой итерации, где появится бюджет
  на ассеты. Confidence: **medium**.
- **C4 — Акцентный цвет: туманно-голубой `#6b8caf`.** Контекст:
  пользователь предложил выбор между туманно-голубым и бледно-фиолетовым.
  Анализ: голубой ассоциируется с туманом и «cold gloom»
  более прямо, чем фиолетовый, который ближе к мистике и может
  читаться как готика — что явно запрещено брендовым требованием.
  Confidence: **low**. Требует валидации на HITL.
- **C5 — Формат фавикона: SVG с буквой `a`.** Контекст: выбор
  между моноцветным SVG и emoji-фавиконом. Анализ: SVG с буквой
  даёт контроль над цветом (используется акцент палитры),
  совместим с темой и не зависит от рендеринга emoji в браузере.
  Emoji 🌫 рендерится по-разному в разных ОС и не передаёт бренд.
  Confidence: **medium**.
- **C6 — Браузерный copy-button реализован inline-скриптом, без
  Astro island.** Контекст: единственный JS на странице — обработчик
  кнопки «Copy». Анализ: подключение island ради 10 строк JS
  избыточно; обычный `<script>` в `.astro` даёт нулевую runtime-зависимость
  и сохраняет zero-bundle политику. Confidence: **high**.
- **C7 — Sitemap не включается в первую итерацию.** Контекст: лендинг
  состоит из одной страницы. Анализ: sitemap для одной страницы
  не даёт SEO-выгоды и добавляет интеграцию `@astrojs/sitemap`.
  Confidence: **high**.
- **C8 — Файл `og-image.png` обязателен как placeholder.** Контекст:
  Open Graph требует валидный URL изображения, иначе превью в
  социальных сетях и Telegram некорректно. Анализ: placeholder PNG
  лучше отсутствующего файла, потому что отсутствие приводит
  к 404 при предпросмотре. Confidence: **high**.
