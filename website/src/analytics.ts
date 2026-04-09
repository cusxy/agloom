/**
 * Cloudflare Web Analytics beacon injection for the docs site.
 *
 * Returns a Docusaurus `scripts` entry that loads the Cloudflare beacon
 * when a site token is provided via `CF_ANALYTICS_TOKEN_DOCS`, and an
 * empty array otherwise. Keeping this as a pure function (rather than
 * inlining the ternary in `docusaurus.config.ts`) lets the smoke tests
 * exercise the gating logic in milliseconds without spinning up a full
 * `docusaurus build`.
 */

/**
 * A single entry suitable for Docusaurus's `scripts` config field. The
 * `data-cf-beacon` attribute is a JSON string per Cloudflare's own
 * installation snippet; we encode it with `JSON.stringify` to survive
 * quoting edge cases in tokens.
 */
export interface BeaconScript {
  src: string;
  defer: true;
  "data-cf-beacon": string;
}

/**
 * Produce the `scripts` array tail for Cloudflare Web Analytics.
 *
 * @param token Raw token string, typically `process.env.CF_ANALYTICS_TOKEN_DOCS`.
 *              `undefined`, empty string, or whitespace-only values disable
 *              injection — the caller receives an empty array and the final
 *              site ships script-free.
 * @returns     Array with zero or one beacon script entry.
 */
export function cloudflareBeaconScripts(
  token: string | undefined,
): BeaconScript[] {
  if (typeof token !== "string") return [];
  const trimmed = token.trim();
  if (trimmed.length === 0) return [];
  return [
    {
      src: "https://static.cloudflareinsights.com/beacon.min.js",
      defer: true,
      "data-cf-beacon": JSON.stringify({ token: trimmed }),
    },
  ];
}
