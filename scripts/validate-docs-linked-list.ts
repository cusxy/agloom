/**
 * Validates the doubly-linked list ordering of docs/guide/ and docs/reference/ files.
 * Spec: docs/specs/help-command.md § Валидация linked list
 *
 * Checks per category:
 *   5a. Multiple heads (more than one file without `prev`)
 *   5b. Non-existent slug references (`prev`/`next` pointing to missing files)
 *   5c. Broken back-references (A.next=B but B.prev!=A, or A.prev=B but B.next!=A)
 *   5d. Cycles (walking `next` from head revisits a slug)
 *   5e. Orphaned files (not reachable from head via `next` chain)
 *
 * Usage: npx tsx scripts/validate-docs-linked-list.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import matter from "gray-matter";

interface DocEntry {
  slug: string;
  prev: string | undefined;
  next: string | undefined;
}

const CATEGORIES = ["guide", "reference"];

export function validateDocsLinkedList(baseDocsDir: string): {
  success: boolean;
  errors: string[];
} {
  const allErrors: string[] = [];

  for (const category of CATEGORIES) {
    const categoryDir = path.join(baseDocsDir, category);

    // Extension 2a: directory does not exist -> skip
    let dirEntries: string[];
    try {
      dirEntries = fs.readdirSync(categoryDir);
    } catch {
      continue;
    }

    const mdFiles = dirEntries.filter((f) => f.endsWith(".md"));
    if (mdFiles.length === 0) continue;

    // Parse frontmatter for each file
    const entries: DocEntry[] = [];
    const slugSet = new Set<string>();
    let hasParseError = false;

    for (const file of mdFiles) {
      const slug = file.slice(0, -3);
      const filePath = path.join(categoryDir, file);
      const content = fs.readFileSync(filePath, "utf-8");

      // Extension 3a: invalid frontmatter -> error
      const parsed = matter(content);
      if (!parsed.data || Object.keys(parsed.data).length === 0) {
        allErrors.push(`${category}: ${slug} has invalid frontmatter`);
        hasParseError = true;
        continue;
      }

      slugSet.add(slug);
      entries.push({
        slug,
        prev: typeof parsed.data.prev === "string" ? parsed.data.prev : undefined,
        next: typeof parsed.data.next === "string" ? parsed.data.next : undefined,
      });
    }

    if (entries.length === 0) continue;

    const bySlug = new Map<string, DocEntry>();
    for (const e of entries) {
      bySlug.set(e.slug, e);
    }

    // 5a. Multiple heads
    const heads = entries.filter((e) => e.prev === undefined);
    if (heads.length > 1) {
      const slugs = heads
        .map((h) => h.slug)
        .sort()
        .join(", ");
      allErrors.push(`${category}: multiple heads: ${slugs}`);
    }

    // 5b. Non-existent slug references
    for (const e of entries) {
      if (e.next !== undefined && !slugSet.has(e.next)) {
        allErrors.push(`${category}: ${e.slug}.next references non-existent slug "${e.next}"`);
      }
      if (e.prev !== undefined && !slugSet.has(e.prev)) {
        allErrors.push(`${category}: ${e.slug}.prev references non-existent slug "${e.prev}"`);
      }
    }

    // 5c. Broken back-references
    for (const e of entries) {
      if (e.next !== undefined) {
        const target = bySlug.get(e.next);
        if (target && target.prev !== e.slug) {
          const actual = target.prev === undefined ? "undefined" : target.prev;
          allErrors.push(
            `${category}: broken back-reference: ${e.slug}.next = ${e.next}, but ${e.next}.prev = ${actual}`,
          );
        }
      }
      if (e.prev !== undefined) {
        const target = bySlug.get(e.prev);
        if (target && target.next !== e.slug) {
          const actual = target.next === undefined ? "undefined" : target.next;
          allErrors.push(
            `${category}: broken back-reference: ${e.slug}.prev = ${e.prev}, but ${e.prev}.next = ${actual}`,
          );
        }
      }
    }

    // 5d. Cycles — walk next from head
    if (heads.length >= 1 && !hasParseError) {
      const head = heads.length === 1 ? heads[0] : heads.sort((a, b) => a.slug.localeCompare(b.slug))[0];
      const visited: string[] = [];
      const visitedSet = new Set<string>();
      let current: DocEntry | undefined = head;

      while (current) {
        if (visitedSet.has(current.slug)) {
          // Cycle detected
          visited.push(current.slug);
          const cycleStart = visited.indexOf(current.slug);
          const cyclePath = visited.slice(cycleStart).join(" -> ");
          allErrors.push(`${category}: cycle detected: ${cyclePath}`);
          break;
        }
        visited.push(current.slug);
        visitedSet.add(current.slug);
        if (current.next === undefined || !bySlug.has(current.next)) break;
        current = bySlug.get(current.next);
      }

      // 5e. Orphaned files
      const orphans = entries.filter((e) => !visitedSet.has(e.slug)).map((e) => e.slug);
      if (orphans.length > 0) {
        allErrors.push(`${category}: orphaned files: ${orphans.sort().join(", ")}`);
      }
    }
  }

  return {
    success: allErrors.length === 0,
    errors: allErrors,
  };
}

/**
 * Computes and writes `sidebar_position` into frontmatter of all doc files.
 * Spec: docs/specs/help-command.md § Вычисление sidebar_position, § Запись sidebar_position в frontmatter
 *
 * MUST be called only after successful validation (validateDocsLinkedList returned success: true).
 */
export function fixSidebarPositions(baseDocsDir: string): {
  writtenCount: number;
  skippedCount: number;
} {
  let writtenCount = 0;
  let skippedCount = 0;

  for (const category of CATEGORIES) {
    const categoryDir = path.join(baseDocsDir, category);

    // Extension 3a: directory does not exist -> skip
    let dirEntries: string[];
    try {
      dirEntries = fs.readdirSync(categoryDir);
    } catch {
      continue;
    }

    const mdFiles = dirEntries.filter((f) => f.endsWith(".md"));
    if (mdFiles.length === 0) continue;

    // Parse frontmatter for each file
    const entries: DocEntry[] = [];
    for (const file of mdFiles) {
      const slug = file.slice(0, -3);
      const filePath = path.join(categoryDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const parsed = matter(content);
      if (!parsed.data || Object.keys(parsed.data).length === 0) continue;

      entries.push({
        slug,
        prev: typeof parsed.data.prev === "string" ? parsed.data.prev : undefined,
        next: typeof parsed.data.next === "string" ? parsed.data.next : undefined,
      });
    }

    if (entries.length === 0) continue;

    const bySlug = new Map<string, DocEntry>();
    for (const e of entries) {
      bySlug.set(e.slug, e);
    }

    // § Вычисление sidebar_position — шаг 1: find head
    const heads = entries.filter((e) => e.prev === undefined);
    const chain: string[] = [];

    if (heads.length >= 1) {
      const head = heads.length === 1 ? heads[0] : heads.sort((a, b) => a.slug.localeCompare(b.slug))[0];

      // § Вычисление sidebar_position — шаг 2: walk next
      let current: DocEntry | undefined = head;
      const visitedSet = new Set<string>();
      while (current) {
        if (visitedSet.has(current.slug)) break;
        chain.push(current.slug);
        visitedSet.add(current.slug);
        if (current.next === undefined || !bySlug.has(current.next)) break;
        current = bySlug.get(current.next);
      }
    }

    // § Вычисление sidebar_position — шаги 3-4: orphans sorted by slug
    const chainSet = new Set(chain);
    const orphans = entries
      .filter((e) => !chainSet.has(e.slug))
      .map((e) => e.slug)
      .sort();

    // § Вычисление sidebar_position — шаги 5-6: assign positions
    const positionMap = new Map<string, number>();
    for (let i = 0; i < chain.length; i++) {
      positionMap.set(chain[i], i + 1);
    }
    for (let i = 0; i < orphans.length; i++) {
      positionMap.set(orphans[i], chain.length + i + 1);
    }

    // § Запись sidebar_position в frontmatter
    for (const [slug, position] of positionMap) {
      const filePath = path.join(categoryDir, `${slug}.md`);
      const content = fs.readFileSync(filePath, "utf-8");

      // Find frontmatter boundaries
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!fmMatch) continue;

      const fmContent = fmMatch[1];
      const sidebarRegex = /^sidebar_position:\s*(\d+)\s*$/m;
      const existingMatch = fmContent.match(sidebarRegex);

      // § Запись — шаг 4: if value matches, skip
      if (existingMatch && Number(existingMatch[1]) === position) {
        skippedCount++;
        continue;
      }

      let newContent: string;
      if (existingMatch) {
        // § Запись — шаг 5: replace existing
        newContent = content.replace(sidebarRegex, `sidebar_position: ${position}`);
      } else {
        // § Запись — шаг 6: insert before closing ---
        const fmEnd = content.indexOf("\n---", 3);
        newContent = content.slice(0, fmEnd) + `\nsidebar_position: ${position}` + content.slice(fmEnd);
      }

      fs.writeFileSync(filePath, newContent, "utf-8");
      writtenCount++;
    }
  }

  return { writtenCount, skippedCount };
}

// CLI entry point
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename);
if (isMainModule) {
  const fix = process.argv.includes("--fix");
  const baseDocsDir = path.resolve(process.cwd(), "docs");
  const result = validateDocsLinkedList(baseDocsDir);

  if (!result.success) {
    process.stderr.write("docs-order: validation failed\n\n");
    for (const err of result.errors) {
      process.stderr.write(`  ${err}\n`);
    }
    process.exit(1);
  }

  process.stdout.write("docs-order: all checks passed\n");

  if (!fix) {
    process.exit(0);
  }

  const fixResult = fixSidebarPositions(baseDocsDir);
  process.stdout.write(
    `docs-order: wrote sidebar_position to ${fixResult.writtenCount} files (${fixResult.skippedCount} unchanged)\n`,
  );
  process.exit(0);
}
