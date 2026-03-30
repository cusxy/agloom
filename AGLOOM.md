# Agloom

## Commands

- Build: `pnpm run build` (tsc)
- Test all: `pnpm run test` (vitest run, 310+ tests)
- Test single: `npx vitest run src/path/to/file.spec.ts`
- Lint: `pnpm run lint`
- Format: `pnpm run fmt:js`

## Stack

TypeScript (strict), Node.js, ES modules. Ink (React-based CLI framework).
Vitest for tests. gray-matter for YAML frontmatter parsing.

## Architecture

CLI tool that transpiles canonical AGLOOM.md files into agent-specific formats (CLAUDE.md, AGENTS.md, etc.).

Three transpiler modules with identical structure:
- `src/instructions-transpiler/` — AGLOOM.md → CLAUDE.md / AGENTS.md
- `src/skills-transpiler/` — .agloom/skills/ → .claude/skills/, etc.
- `src/agents-transpiler/` — .agloom/agents/ → .claude/agents/, etc.

Each transpiler has: discover → transform → write pipeline.
Adapter registry at `src/cli/adapter-registry.ts` — 3 adapters: claude, opencode, agentsmd.

<!-- agent:claude -->
## Specs

Specifications live in `docs/specs/`. You MUST read the relevant spec before modifying a module.

## Cycling System

This project uses spec-driven development with cycling agents.
Protocols: `.agloom/overlays/claude/docs/cycling/`.
Skills: spec-cycle, research-cycle, bugfix-cycle.
<!-- /agent:claude -->

## Conventions

- Functional style: pure functions, minimal classes (only for transpiler orchestrators).
- Errors: dedicated error classes per module (ConfigError, DiscoverError, TransformError, WriteError).
- Canonical files: AGLOOM.md/AGLOOM.local.md. Agent sections use `<!-- agent:id -->` / `<!-- /agent:id -->` HTML comments.
- Valid agent-ids for instructions: `claude`, `agentsmd`. NOT `opencode` (it uses AGENTS.md via agentsmd adapter).

## Testing

- Detroit-style: real objects, minimal mocks. Use `vol` from `memfs` for filesystem tests.
- Test file naming: `module-name.spec.ts` next to source, or in `__tests__/` directory.
- Each test MUST be independent — no shared mutable state between tests.

## Boundaries

- NEVER modify generated output files (CLAUDE.md, AGENTS.md) directly — edit AGLOOM.md and transpile.
- NEVER add agent-id `opencode` in instruction file sections — it does not have its own format.
- NEVER skip `--strict` TypeScript checks.
