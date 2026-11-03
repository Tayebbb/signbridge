# Phase 1 — Foundation, renderer-sandbox spike, first deploy

Read `AGENTS.md`, then `SYSTEM-DESIGN.md` §0.3, §A.1, §A.2, §B.1, §C.2, §E.1, §E.3a, §G.2, §G.4 (secrets, third-party script), §H.7, §H.8.

## Goal
A Next.js app that builds, tests, and deploys, with the v1.1 schema migrated, and an early answer to the riskiest unknown: does CWASA run inside an opaque-origin sandboxed iframe (T23)?

## Build
1. `git init` (if absent), `.gitignore` (incl. `.env*.local`, `demo-input/`, `node_modules`, `.next`). Scaffold Next.js App Router + TS strict with npm into this folder, keeping `SYSTEM-DESIGN.md`, `AGENTS.md`, `execution/`, `assets/` untouched. Create the §G.2 folder skeleton (empty modules with exported types are fine).
2. Scripts: `typecheck`, `lint`, `test` (Vitest), `test:e2e` (Playwright, Chromium + `msedge` channel if available), `db:generate`, `db:migrate`.
3. ESLint ownership rules from `AGENTS.md`; a CI-style script `npm run check:secrets` that fails on `sk-` in tracked files.
4. Drizzle schema in `lib/db/schema.ts` mirroring §C.2 **exactly** (all tables, constraints, indexes, cascades, `SET NULL` pointers). Generate migrations. Adapter `lib/db/client.ts`: PGlite when `DATABASE_URL` is unset, Neon pool otherwise. A test that migrates PGlite from empty and asserts every §C.2 table and key constraint exists.
5. Adapters as interfaces + local implementations only: `BlobStore` (filesystem under `.data/blob`), `ModelClient` (fake, deterministic), `Dispatcher` (in-process). Production implementations come in phase 4.
6. Owner cookie (`lib/auth/ownerCookie.ts`, §A.1 identity): 256-bit token, store only SHA-256, `httpOnly; Secure; SameSite=Lax`. Unit tests.
7. `GET /api/health` per §G.1. `app/layout.tsx` shows `assets/event-sticker.png` (copy to `public/`) prominently in a top banner on every page, plus an "Experimental · not reviewed by BdSL signers" label and attribution footer (IsharaKotha CC BY 4.0, UEA CWASA).
8. **Renderer spike (T23, §E.3a):** `public/renderer.html` loads unmodified CWASA vhg2026 from UEA inside the page; a host test page embeds it with `sandbox="allow-scripts"` (no `allow-same-origin`). Use the research fixture `E:\AIgnite-Lab\research\2026-11-03-signbridge\system-design-review\cross-file-case-1.sigml` (and the probe `review-probes.cjs` there as reference for hooks/IDs). Playwright test (network required): engine loads, avatar animates the fixture, `postMessage` relay of hook events works with `instanceId`; from inside the frame a `fetch('/api/health', {credentials:'include'})` arrives with `Origin: null` and no cookie. Measure the CSP the engine needs (console violations) and record it.
   - If CWASA does **not** work sandboxed: record evidence in `docs/DEVIATIONS.md`, implement the documented fallback from §E.3a, and say so in the report. Do not hack around it.
9. Deploy: if `npx vercel whoami` succeeds, link the project, set env vars from `.env.local` names (ask me before pushing any value), deploy a preview, and run `/api/health` against it. If not logged in, mark NOT RUN.

## Out of scope
Business logic, parsers, AI, player scheduler, real uploads.

## Done when
typecheck/lint/test green; schema test green; T23 spike result recorded as PASS/FAIL with evidence (screenshot in `docs/evidence/`); preview URL in the report (or NOT RUN + reason). Follow the end-of-phase steps in `AGENTS.md`.
