// docs-build.spec.ts
//
// Smoke-тесты сайта документации docs.agloom.sh. По образцу
// landing-build.spec.ts — запускают реальный docusaurus build
// через `pnpm --filter @agloom/website run build:site`, читают
// артефакты из website/build/ и проверяют:
//   1. Сборка завершается успешно в обеих ветках (с токеном / без).
//   2. Ключевые output-файлы существуют (index.html, favicon, llms.txt).
//   3. Cloudflare Web Analytics beacon присутствует СТРОГО при заданном
//      CF_ANALYTICS_TOKEN_DOCS и отсутствует без него.
//
// Acc на уровне HTML-структуры, OG-тегов и прочего не проверяется — это
// гарантируется самим Docusaurus'ом, дублировать нет смысла. Фокус
// именно на agloom-специфичных штуках (beacon gating, llms артефакты
// от нашего inline-plugin, favicon из static/img/).
//
// Choices:
// - C1: Файл лежит в src/docs-smoke/__tests__/, потому что vitest.config.ts
//       включает только src/**/*.spec.ts. Повторяет паттерн landing-smoke/.
//       Confidence: high.
// - C2: Два describe-блока, каждый со своей сборкой через beforeAll, чтобы
//       смена env var давала честный изолированный build. Docusaurus build
//       дольше Astro (~10–15s каждый), поэтому 180_000 timeout. Confidence: high.

import { describe, it, expect, beforeAll } from "vitest";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");
const WEBSITE_DIR = path.join(REPO_ROOT, "website");
const BUILD_DIR = path.join(WEBSITE_DIR, "build");
const INDEX_HTML = path.join(BUILD_DIR, "index.html");

interface BuildResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: string;
}

function runBuild(env: NodeJS.ProcessEnv = {}): BuildResult {
  try {
    const result = spawnSync("pnpm", ["--filter", "@agloom/website", "run", "build:site"], {
      cwd: REPO_ROOT,
      env: { ...process.env, ...env },
      encoding: "utf-8",
      timeout: 180_000,
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

describe("Docs — сборка без аналитики (CF_ANALYTICS_TOKEN_DOCS не задан)", () => {
  let buildResult: BuildResult;
  let html: string | null;
  let llmsTxt: string | null;
  let llmsFullTxt: string | null;

  beforeAll(() => {
    if (fs.existsSync(BUILD_DIR)) {
      fs.rmSync(BUILD_DIR, { recursive: true, force: true });
    }
    const env = { ...process.env };
    delete env.CF_ANALYTICS_TOKEN_DOCS;
    buildResult = runBuild({ CF_ANALYTICS_TOKEN_DOCS: "" });
    html = readIfExists(INDEX_HTML);
    llmsTxt = readIfExists(path.join(BUILD_DIR, "llms.txt"));
    llmsFullTxt = readIfExists(path.join(BUILD_DIR, "llms-full.txt"));
  }, 240_000);

  // === § Сборка ===

  it("сборка завершается с кодом выхода 0 и пакет @agloom/website найден", () => {
    const combined = `${buildResult.stdout}\n${buildResult.stderr}`;
    expect(combined).not.toContain("No projects matched the filters");
    expect(buildResult.status).toBe(0);
  });

  it("после сборки существует website/build/index.html", () => {
    expect(fs.existsSync(INDEX_HTML)).toBe(true);
  });

  // === § Agloom-специфичные артефакты ===

  // Наш inline-plugin agloom-llms должен писать llms.txt и llms-full.txt
  // из docs/guide/ и docs/reference/, plus raw .md рядом.
  it("agloom-llms плагин записал llms.txt с заголовком", () => {
    expect(llmsTxt).not.toBeNull();
    expect(llmsTxt ?? "").toContain("# Agloom");
  });

  it("agloom-llms плагин записал llms-full.txt", () => {
    expect(llmsFullTxt).not.toBeNull();
    expect(llmsFullTxt ?? "").toContain("# Agloom — full documentation");
  });

  // Favicon в тёплом цвете из img/ — см. website/static/img/favicon.svg.
  it("после сборки существует website/build/img/favicon.svg", () => {
    expect(fs.existsSync(path.join(BUILD_DIR, "img", "favicon.svg"))).toBe(true);
  });

  // Search-local plugin строит индекс в search-index.json на этапе билда.
  it("после сборки существует search-index.json", () => {
    expect(fs.existsSync(path.join(BUILD_DIR, "search-index.json"))).toBe(true);
  });

  // === § Cloudflare Web Analytics — критерий 1 ===

  it("без CF_ANALYTICS_TOKEN_DOCS скрипт cloudflareinsights отсутствует", () => {
    expect(html).not.toBeNull();
    expect(html ?? "").not.toContain("cloudflareinsights.com");
    expect(html ?? "").not.toContain("data-cf-beacon");
  });
});

describe("Docs — сборка с CF_ANALYTICS_TOKEN_DOCS=docs-test-token", () => {
  let buildResult: BuildResult;
  let html: string | null;

  beforeAll(() => {
    if (fs.existsSync(BUILD_DIR)) {
      fs.rmSync(BUILD_DIR, { recursive: true, force: true });
    }
    buildResult = runBuild({ CF_ANALYTICS_TOKEN_DOCS: "docs-test-token" });
    html = readIfExists(INDEX_HTML);
  }, 240_000);

  it("сборка с токеном завершается успешно (пакет @agloom/website найден)", () => {
    const combined = `${buildResult.stdout}\n${buildResult.stderr}`;
    expect(combined).not.toContain("No projects matched the filters");
    expect(buildResult.status).toBe(0);
  });

  // === § Cloudflare Web Analytics — критерий 2 ===

  it("при заданном CF_ANALYTICS_TOKEN_DOCS HTML содержит data-cf-beacon и токен", () => {
    expect(html).not.toBeNull();
    expect(html ?? "").toContain("data-cf-beacon");
    expect(html ?? "").toContain("cloudflareinsights.com/beacon.min.js");
    expect(html ?? "").toContain("docs-test-token");
  });
});
