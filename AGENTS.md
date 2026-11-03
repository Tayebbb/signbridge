# AGENTS.md — standing rules for every SignBridge phase

These rules apply to every phase prompt. Phase prompts do not repeat them.

## Source of truth
- `SYSTEM-DESIGN.md` (v1.1) in this folder is the specification. Read the sections each phase names. Do not edit it.
- If you must deviate (an API differs from the design, a limit is different, a test is impossible), append an entry to `docs/DEVIATIONS.md`: `date · phase · design §ref · what changed · why · evidence`. Never deviate silently.
- The §0.3 honesty rules apply to code, UI copy, README, deck and demo. Nothing may claim correct BdSL, translation accuracy, review, or comprehension. Technical rendering is the only evidence category this project can produce without Deaf/BdSL reviewers (§H.3).

## Stack (fixed)
- Next.js App Router + TypeScript `strict`, Node 24, **npm** (no pnpm/yarn), Drizzle ORM + drizzle-kit, Zod, Vitest, Playwright.
- Adapters (§H.8): Postgres = Neon in production / PGlite locally and in tests; Blob = Vercel Blob (private) in production / filesystem locally; Model = OpenAI Responses API / deterministic fake; Dispatcher = Vercel Workflows in production / in-process runner obeying the same outbox + run-claim contract locally. All correctness lives in `lib/domain` and SQL, never in adapters.
- Ownership rules of §G.2 are enforced: only `lib/ai` imports `openai`; only `lib/db/queries` performs state transitions; only `lib/player` touches CWASA; route handlers are glue. Add ESLint `no-restricted-imports` rules for these.
- Before using any third-party API (Vercel Workflow SDK, `@vercel/blob`, OpenAI Responses + Structured Outputs, CWASA), check its **current official docs**, and record the package version and doc URL in `docs/DEVIATIONS.md` if the design's assumption differs.

## Quality bar
- Tests must exercise real behaviour. Never weaken, skip, or `.only` a test to make a phase pass. A check that cannot run in this environment is reported as `NOT RUN` with the reason (e.g. "needs network", "needs real device").
- No secrets in the repo. `.env.local` is git-ignored; keep `.env.example` current with every variable and a one-line comment.
- Keep scope to the current phase. Do not start later phases' work; leave a `TODO(phase-N)` only where an interface is needed.
- Use lowercase gloss IDs everywhere (`g{gen}_s…a…u…`), per §E.3.

## End of every phase (mandatory)
1. Run: `npm run typecheck`, `npm run lint`, `npm test` (plus any phase-specific commands). All must pass.
2. Commit with message `phase N: <summary>` and tag `phase-N` (git is initialised in phase 1).
3. Write `docs/phase-reports/phase-N.md`, **≤120 lines**, exactly these sections:
   - `## Status` — one line: COMPLETE / PARTIAL (what is missing).
   - `## Checks` — table: command · exit code · pass/fail/skip counts.
   - `## Acceptance tests` — table: T-ID · PASS / FAIL / NOT RUN · test file path · one-line evidence or reason.
   - `## Deviations` — bullets copied from this phase's `docs/DEVIATIONS.md` entries (or "none").
   - `## Risks / open questions` — bullets for the reviewer.
   - `## Files` — output of `git diff --stat phase-(N-1) phase-N` (phase 1: `git show --stat`).
   The report is what the reviewer reads first; it must be accurate, not optimistic.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
