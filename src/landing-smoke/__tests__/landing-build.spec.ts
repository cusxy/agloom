// landing-build.spec.ts
//
// Smoke-тесты лендинга agloom.sh. Тесты запускают реальный Astro-build из
// подпапки landing/ через `pnpm --filter @agloom/landing build`, читают
// артефакты из landing/dist/ и проверяют структуру и meta. На фазе Test
// директории landing/ ещё не существует, поэтому все тесты ОБЯЗАНЫ падать
// (TDD red phase).
//
// Choices:
// - C1: Тесты размещены в src/landing-smoke/__tests__/, потому что vitest.config.ts
//       включает только src/**/*.spec.ts. Это позволяет запускать их через корневой
//       `pnpm run test` без модификации pnpm-workspace.yaml. Confidence: high.
// - C2: HTML-парсер — vanilla regex с флагом `s` (dotAll). Структурные assertions
//       (один <h1>, 4–6 feature-элементов) выражаются регулярками без cheerio.
//       Дополнительная dep избыточна для smoke-теста. Confidence: medium.
// - C3: Cloudflare Analytics — два раздельных describe-блока в одном файле.
//       Каждый запускает build с собственным окружением и читает свой index.html.
//       Один файл проще в навигации, чем два почти идентичных spec'а. Confidence: high.

import { describe, it, expect, beforeAll } from "vitest";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");
const LANDING_DIR = path.join(REPO_ROOT, "landing");
const DIST_DIR = path.join(LANDING_DIR, "dist");
const INDEX_HTML = path.join(DIST_DIR, "index.html");

interface BuildResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: string;
}

function runBuild(env: NodeJS.ProcessEnv = {}): BuildResult {
  try {
    const result = spawnSync("pnpm", ["--filter", "@agloom/landing", "build"], {
      cwd: REPO_ROOT,
      env: { ...process.env, ...env },
      encoding: "utf-8",
      timeout: 120_000,
    });
    return {
      status: result.status,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  } catch (e) {
    return {
      status: null,
      stdout: "",
      stderr: "",
      error: (e as Error).message,
    };
  }
}

function readIfExists(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function readDistCss(): string {
  if (!fs.existsSync(DIST_DIR)) return "";
  const cssFiles: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith(".css")) {
        cssFiles.push(fs.readFileSync(full, "utf-8"));
      }
    }
  };
  walk(DIST_DIR);
  return cssFiles.join("\n");
}

describe("Landing — сборка без аналитики (CF_ANALYTICS_TOKEN_LANDING не задан)", () => {
  let buildResult: BuildResult;
  let html: string | null;
  let css: string;

  beforeAll(() => {
    // Удаляем dist/, чтобы тест видел свежий артефакт.
    if (fs.existsSync(DIST_DIR)) {
      fs.rmSync(DIST_DIR, { recursive: true, force: true });
    }
    // Гарантируем отсутствие токена.
    const env = { ...process.env };
    delete env.CF_ANALYTICS_TOKEN_LANDING;
    buildResult = runBuild({ CF_ANALYTICS_TOKEN_LANDING: "" });
    html = readIfExists(INDEX_HTML);
    css = readDistCss();
  }, 180_000);

  // === § Верифицируемые критерии — Сборка ===

  // Критерий «Сборка-1»: команда build завершается с кодом выхода 0.
  // Дополнительно проверяем, что pnpm нашёл пакет @agloom/landing — иначе
  // фильтр no-op'ит с кодом 0 и тест проходит ложноположительно.
  // Сообщение «No projects matched the filters» pnpm пишет в stdout, не stderr.
  it("сборка завершается с кодом выхода 0 и пакет @agloom/landing найден", () => {
    const combined = `${buildResult.stdout}\n${buildResult.stderr}`;
    expect(combined).not.toContain("No projects matched the filters");
    expect(buildResult.status).toBe(0);
  });

  // Критерий «Сборка-2»: существует landing/dist/index.html.
  it("после сборки существует landing/dist/index.html", () => {
    expect(fs.existsSync(INDEX_HTML)).toBe(true);
  });

  // Критерий «Сборка-3»: существует landing/dist/favicon.svg.
  it("после сборки существует landing/dist/favicon.svg", () => {
    expect(fs.existsSync(path.join(DIST_DIR, "favicon.svg"))).toBe(true);
  });

  // Критерий «Сборка-4»: существует landing/dist/og-image.png.
  it("после сборки существует landing/dist/og-image.png", () => {
    expect(fs.existsSync(path.join(DIST_DIR, "og-image.png"))).toBe(true);
  });

  // Критерий «Сборка-5»: существует landing/dist/robots.txt.
  it("после сборки существует landing/dist/robots.txt", () => {
    expect(fs.existsSync(path.join(DIST_DIR, "robots.txt"))).toBe(true);
  });

  // === § Верифицируемые критерии — HTML структура и meta ===

  // Критерий «HTML-meta-1»: <html lang="en">.
  it('корневой тег — <html lang="en">', () => {
    expect(html).not.toBeNull();
    expect(html ?? "").toMatch(/<html[^>]*\blang=["']en["']/i);
  });

  // Критерий «HTML-meta-2»: непустой <title> с каноническим значением.
  it("присутствует <title> со значением 'Agloom — One source of truth for every AI coding assistant'", () => {
    expect(html).not.toBeNull();
    const match = (html ?? "").match(/<title>([^<]*)<\/title>/i);
    expect(match).not.toBeNull();
    expect(match?.[1].trim()).toBe("Agloom — One source of truth for every AI coding assistant");
  });

  // Критерий «HTML-meta-3»: meta name="description" с непустым content.
  it('присутствует <meta name="description"> с непустым content', () => {
    expect(html).not.toBeNull();
    const match = (html ?? "").match(/<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
    expect(match).not.toBeNull();
    expect((match?.[1] ?? "").trim().length).toBeGreaterThan(0);
  });

  // Критерий «HTML-meta-4»: meta theme-color = #0a0b0f.
  it('присутствует <meta name="theme-color" content="#0a0b0f">', () => {
    expect(html ?? "").toMatch(/<meta\s+[^>]*name=["']theme-color["'][^>]*content=["']#0a0b0f["']/i);
  });

  // Критерий «HTML-meta-5»: meta color-scheme = dark.
  it('присутствует <meta name="color-scheme" content="dark">', () => {
    expect(html ?? "").toMatch(/<meta\s+[^>]*name=["']color-scheme["'][^>]*content=["']dark["']/i);
  });

  // Критерий «HTML-meta-6»: link canonical = https://agloom.sh/.
  it('присутствует <link rel="canonical" href="https://agloom.sh/">', () => {
    expect(html ?? "").toMatch(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']https:\/\/agloom\.sh\/["']/i);
  });

  // Критерий «HTML-meta-7a»: og:title.
  it("присутствует Open Graph тег og:title", () => {
    expect(html ?? "").toMatch(/<meta\s+[^>]*property=["']og:title["'][^>]*content=["'][^"']+["']/i);
  });

  // Критерий «HTML-meta-7b»: og:description.
  it("присутствует Open Graph тег og:description", () => {
    expect(html ?? "").toMatch(/<meta\s+[^>]*property=["']og:description["'][^>]*content=["'][^"']+["']/i);
  });

  // Критерий «HTML-meta-7c»: og:url.
  it("присутствует Open Graph тег og:url", () => {
    expect(html ?? "").toMatch(/<meta\s+[^>]*property=["']og:url["'][^>]*content=["'][^"']+["']/i);
  });

  // Критерий «HTML-meta-7d»: og:image.
  it("присутствует Open Graph тег og:image", () => {
    expect(html ?? "").toMatch(/<meta\s+[^>]*property=["']og:image["'][^>]*content=["'][^"']+["']/i);
  });

  // Критерий «HTML-meta-7e»: og:type=website.
  it("присутствует Open Graph тег og:type со значением website", () => {
    expect(html ?? "").toMatch(/<meta\s+[^>]*property=["']og:type["'][^>]*content=["']website["']/i);
  });

  // Критерий «HTML-meta-8»: twitter:card=summary_large_image.
  it('присутствует <meta name="twitter:card" content="summary_large_image">', () => {
    expect(html ?? "").toMatch(/<meta\s+[^>]*name=["']twitter:card["'][^>]*content=["']summary_large_image["']/i);
  });

  // Критерий «HTML-meta-9»: link rel=icon с типом svg.
  it('присутствует <link rel="icon" href="/favicon.svg" type="image/svg+xml">', () => {
    expect(html ?? "").toMatch(
      /<link\s+[^>]*rel=["']icon["'][^>]*href=["']\/favicon\.svg["'][^>]*type=["']image\/svg\+xml["']/i,
    );
  });

  // === § Верифицируемые критерии — HTML содержимое ===

  // Критерий «HTML-content-1»: ровно один <h1> с непустым текстом.
  it("присутствует ровно один <h1> с непустым текстом", () => {
    expect(html).not.toBeNull();
    const matches = [...(html ?? "").matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
    expect(matches).toHaveLength(1);
    const text = (matches[0]?.[1] ?? "").replace(/<[^>]+>/g, "").trim();
    expect(text.length).toBeGreaterThan(0);
  });

  // Критерий «HTML-content-5»: ссылка href="https://docs.agloom.sh/".
  it('присутствует ссылка <a href="https://docs.agloom.sh/">', () => {
    expect(html ?? "").toMatch(/<a\b[^>]*href=["']https:\/\/docs\.agloom\.sh\/["']/i);
  });

  // Критерий «HTML-content-6»: ссылка href="https://github.com/cusxy/agloom".
  it('присутствует ссылка <a href="https://github.com/cusxy/agloom">', () => {
    expect(html ?? "").toMatch(/<a\b[^>]*href=["']https:\/\/github\.com\/cusxy\/agloom["']/i);
  });

  // Критерий «HTML-content-7»: кнопка data-role="copy".
  it('присутствует кнопка data-role="copy"', () => {
    expect(html ?? "").toMatch(/<button\b[^>]*data-role=["']copy["']/i);
  });

  // === § Верифицируемые критерии — HTML отсутствие ===

  // Критерий «HTML-absent-1»: отсутствуют placeholder-маркеры.
  it("в HTML отсутствуют placeholder-токены (Lorem ipsum, TODO, FIXME, [NEEDS CLARIFICATION], PLACEHOLDER)", () => {
    expect(html).not.toBeNull();
    const lower = (html ?? "").toLowerCase();
    expect(lower).not.toContain("lorem ipsum");
    expect(lower).not.toContain("todo");
    expect(lower).not.toContain("fixme");
    expect(lower).not.toContain("[needs clarification]");
    expect(lower).not.toContain("placeholder");
  });

  // Критерий «HTML-absent-2»: отсутствует prefers-color-scheme в HTML и CSS dist/.
  it("в HTML и CSS из dist/ отсутствует подстрока 'prefers-color-scheme'", () => {
    expect(html).not.toBeNull();
    expect(html ?? "").not.toContain("prefers-color-scheme");
    expect(css).not.toContain("prefers-color-scheme");
  });

  // === § Cloudflare Web Analytics — критерий 1 ===

  // Критерий «CFA-1»: без переменной окружения скрипт аналитики отсутствует.
  it("без CF_ANALYTICS_TOKEN_LANDING скрипт cloudflareinsights отсутствует", () => {
    expect(html).not.toBeNull();
    expect(html ?? "").not.toContain("cloudflareinsights.com");
  });

  // === § Запреты на стек ===

  // Критерий «stack-1»: в dist/ отсутствуют файлы .tsx и .jsx.
  it("в landing/dist/ отсутствуют файлы .tsx и .jsx", () => {
    expect(fs.existsSync(DIST_DIR)).toBe(true);
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".jsx")) {
          offenders.push(full);
        }
      }
    };
    walk(DIST_DIR);
    expect(offenders).toEqual([]);
  });

  // Критерий «stack-2»: в landing/package.json нет запрещённых зависимостей.
  it("в landing/package.json отсутствуют зависимости tailwindcss, react, react-dom, vue, svelte", () => {
    const pkgPath = path.join(LANDING_DIR, "package.json");
    expect(fs.existsSync(pkgPath)).toBe(true);
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const all = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    };
    const forbidden = ["tailwindcss", "react", "react-dom", "vue", "svelte"];
    for (const name of forbidden) {
      expect(all, `forbidden dep: ${name}`).not.toHaveProperty(name);
    }
  });

  // === § Дизайн-токены (производные критерии из § Дизайн-токены spec) ===
  // Спецификация фиксирует значения в § Цветовая палитра как каноничные;
  // итоговый CSS должен содержать :root с этими custom properties.

  it("в итоговом CSS присутствует :root с --color-bg: #0a0b0f", () => {
    expect(css).toMatch(/:root[\s\S]*--color-bg\s*:\s*#0a0b0f/i);
  });

  it("в итоговом CSS присутствует --color-bg-elevated: #0e0f14", () => {
    expect(css).toMatch(/--color-bg-elevated\s*:\s*#0e0f14/i);
  });

  it("в итоговом CSS присутствует --color-fg: #c5c8d1", () => {
    expect(css).toMatch(/--color-fg\s*:\s*#c5c8d1/i);
  });

  it("в итоговом CSS присутствует --color-fg-muted: #7a7e8c", () => {
    expect(css).toMatch(/--color-fg-muted\s*:\s*#7a7e8c/i);
  });

  it("в итоговом CSS присутствует --color-accent: #6b8caf", () => {
    expect(css).toMatch(/--color-accent\s*:\s*#6b8caf/i);
  });

  it("в итоговом CSS присутствуют font-family токены --font-mono и --font-sans", () => {
    expect(css).toMatch(/--font-mono\s*:/);
    expect(css).toMatch(/--font-sans\s*:/);
  });
});

describe("Landing — сборка с CF_ANALYTICS_TOKEN_LANDING=test123", () => {
  let buildResult: BuildResult;
  let html: string | null;

  beforeAll(() => {
    if (fs.existsSync(DIST_DIR)) {
      fs.rmSync(DIST_DIR, { recursive: true, force: true });
    }
    buildResult = runBuild({ CF_ANALYTICS_TOKEN_LANDING: "test123" });
    html = readIfExists(INDEX_HTML);
  }, 180_000);

  // Критерий «CFA-2»: с заданным токеном — скрипт присутствует и содержит токен.
  it("сборка с токеном завершается успешно (пакет @agloom/landing найден)", () => {
    const combined = `${buildResult.stdout}\n${buildResult.stderr}`;
    expect(combined).not.toContain("No projects matched the filters");
    expect(buildResult.status).toBe(0);
  });

  it("при заданном CF_ANALYTICS_TOKEN_LANDING HTML содержит data-cf-beacon и токен", () => {
    expect(html).not.toBeNull();
    expect(html ?? "").toContain("data-cf-beacon");
    expect(html ?? "").toContain("test123");
  });
});
