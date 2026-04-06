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

## Patched dependencies

- `ink@6.8.0` — tracked patch in `patches/ink@6.8.0.patch`, registered via
  `patchedDependencies` in `pnpm-workspace.yaml`. Fixes a `debug`+`is-in-ci`
  interaction in `unmount()` that wrote `'\n'` over the final frame and
  broke every `lastFrame()` assertion in ink-testing-library under `CI=1`.
  The patch only affects the `debug: true` code path (used exclusively by
  ink-testing-library), production CLI behavior is unchanged.

  Upstream status: fixed in master by PR [vadimdemedes/ink#888][ink-888]
  (commit `02490f6`, 3 Mar 2026), which replaced the `isInCi` branching
  with a new `interactive` option. As a side effect, `onRender`'s debug
  branch now updates `this.lastOutput` and `unmount` writes just `'\n'`
  in debug mode instead of `this.lastOutput + '\n'`. Not yet released —
  6.8.0 is still the latest on npm as of this writing. When a version
  newer than 6.8.0 is published, bump ink and remove this patch entirely
  (update `pnpm-workspace.yaml`, delete `patches/ink@6.8.0.patch`, run
  the full integration suite under `CI=1` to confirm).

  [ink-888]: https://github.com/vadimdemedes/ink/pull/888

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
