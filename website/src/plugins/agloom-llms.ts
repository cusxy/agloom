import type { Plugin } from "@docusaurus/types";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SITE_URL = "https://agloom.sh";
const DOCS_SOURCE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "docs",
);
const DOCS_INCLUDE_DIRS = ["guide", "reference"] as const;

interface DocPage {
  /** Relative path inside docs/, e.g. "guide/getting-started.md" */
  relPath: string;
  /** Public URL on the site, e.g. "https://agloom.sh/docs/guide/getting-started" */
  url: string;
  /** Public URL of the raw .md file */
  rawUrl: string;
  title: string;
  description: string;
  /** Raw markdown body without frontmatter */
  body: string;
}

/** Tiny YAML frontmatter parser — only handles `key: value` lines, no nesting. */
function parseFrontmatter(source: string): {
  data: Record<string, string>;
  body: string;
} {
  if (!source.startsWith("---\n")) return { data: {}, body: source };
  const end = source.indexOf("\n---\n", 4);
  if (end === -1) return { data: {}, body: source };
  const block = source.slice(4, end);
  const body = source.slice(end + 5);
  const data: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!m) continue;
    let value = m[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    data[m[1]] = value;
  }
  return { data, body };
}

async function collectDocs(): Promise<DocPage[]> {
  const pages: DocPage[] = [];
  for (const sub of DOCS_INCLUDE_DIRS) {
    const dir = path.join(DOCS_SOURCE_DIR, sub);
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const relPath = `${sub}/${entry.name}`;
      const source = await fs.readFile(path.join(dir, entry.name), "utf8");
      const { data, body } = parseFrontmatter(source);
      const slug = entry.name.replace(/\.md$/, "");
      pages.push({
        relPath,
        url: `${SITE_URL}/docs/${sub}/${slug}`,
        rawUrl: `${SITE_URL}/docs/${relPath}`,
        title: data.title || slug,
        description: data.description || "",
        body: body.trimStart(),
      });
    }
  }
  pages.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return pages;
}

function renderLlmsTxt(pages: DocPage[]): string {
  const lines: string[] = [
    "# Agloom",
    "",
    "> Transpile canonical agent configurations across AI coding assistants",
    "",
    "This file follows the llms.txt convention (https://llmstxt.org).",
    "Each link points to the raw markdown source of a documentation page.",
    "For the full text of all pages in a single file, see /llms-full.txt.",
    "",
  ];
  const groups = new Map<string, DocPage[]>();
  for (const page of pages) {
    const group = page.relPath.split("/")[0];
    const list = groups.get(group) ?? [];
    list.push(page);
    groups.set(group, list);
  }
  for (const [group, list] of groups) {
    lines.push(`## ${group[0].toUpperCase()}${group.slice(1)}`);
    lines.push("");
    for (const page of list) {
      const desc = page.description ? `: ${page.description}` : "";
      lines.push(`- [${page.title}](${page.rawUrl})${desc}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function renderLlmsFullTxt(pages: DocPage[]): string {
  const parts: string[] = [
    "# Agloom — full documentation",
    "",
    "> Transpile canonical agent configurations across AI coding assistants",
    "",
    "This file concatenates the full text of all documentation pages,",
    "intended for ingestion by LLMs. See /llms.txt for an indexed version.",
    "",
  ];
  for (const page of pages) {
    parts.push("---");
    parts.push("");
    parts.push(`# ${page.title}`);
    parts.push("");
    parts.push(`Source: ${page.url}`);
    if (page.description) {
      parts.push("");
      parts.push(`> ${page.description}`);
    }
    parts.push("");
    parts.push(page.body.trimEnd());
    parts.push("");
  }
  return parts.join("\n");
}

/**
 * Inline plugin that publishes documentation in LLM-friendly formats:
 *  - /llms.txt — index per llmstxt.org convention
 *  - /llms-full.txt — full text dump for direct LLM ingestion
 *  - /docs/<group>/<slug>.md — raw markdown source for each doc page
 */
export default function agloomLlmsPlugin(): Plugin {
  return {
    name: "agloom-llms",
    async postBuild({ outDir }) {
      const pages = await collectDocs();
      await fs.writeFile(path.join(outDir, "llms.txt"), renderLlmsTxt(pages));
      await fs.writeFile(
        path.join(outDir, "llms-full.txt"),
        renderLlmsFullTxt(pages),
      );
      for (const page of pages) {
        const dest = path.join(outDir, "docs", page.relPath);
        await fs.mkdir(path.dirname(dest), { recursive: true });
        const src = path.join(DOCS_SOURCE_DIR, page.relPath);
        await fs.copyFile(src, dest);
      }
      console.log(
        `[agloom-llms] wrote llms.txt, llms-full.txt and ${pages.length} raw .md files`,
      );
    },
  };
}
