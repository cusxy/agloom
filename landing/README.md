# @agloom/landing

Marketing landing page for [agloom.sh](https://agloom.sh). Built with Astro 5,
deployed as a static site to Cloudflare Pages.

## Quick start

```bash
pnpm --filter @agloom/landing dev
pnpm --filter @agloom/landing build
```

The build output is written to `landing/dist/`.

## Replacing temporary assets

The first iteration ships with minimal stand-in assets that should be replaced
before launch:

- `landing/src/assets/logo.svg` — final logo SVG.
- `landing/public/favicon.svg` — final favicon SVG.
- `landing/public/og-image.png` — final Open Graph image (1200×630, PNG).

The current files reference `docs/designs/assets/foggy-oo-mark.svg` (Concept B,
"foggy double-o") and a 1×1 stand-in PNG that exists only so the `og:image`
meta tag resolves to a real URL.

## Cloudflare Web Analytics activation

The landing supports optional Cloudflare Web Analytics. The script is only
emitted when an environment variable is provided at build time, so the default
build is fully script-free.

1. Create a Web Analytics site in the Cloudflare dashboard for `agloom.sh`.
2. Copy the site token from the dashboard.
3. In the Cloudflare Pages project settings for `agloom-landing`, add an
   environment variable named `PUBLIC_CF_ANALYTICS_TOKEN` with the token as
   its value.
4. Trigger a redeploy. The resulting `index.html` will include the
   `static.cloudflareinsights.com/beacon.min.js` script with the configured
   token.
