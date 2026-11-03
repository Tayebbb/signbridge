# SignBridge

Experimental · not reviewed by BdSL signers.

Phase 1 provides a Next.js App Router foundation, the v1.1 database schema, local adapters, anonymous capability helpers, and an opaque-origin CWASA rendering experiment. No translation, parsing, uploads, AI calls, player scheduler, review results, or comprehension results are implemented.

Requires Node 24 and npm.

```powershell
npm ci
npm run db:migrate
npm run dev
```

`DATABASE_URL` unset selects filesystem-backed PGlite at `.data/postgres`; unit tests use isolated in-memory databases. A configured URL selects a Neon WebSocket pool. Ask the owner before using any real secret. `.env.example` documents configuration. Next.js uses its standard environment-file handling; the migration script uses exported variables and does not load `.env.local` itself.

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run check:secrets
npx playwright install chromium
npm run test:e2e
```

Stage files before running `check:secrets` because it checks tracked files. It rejects the forbidden credential prefix except the exact documented instructional and registry URL lines recorded in `scripts/secret-scan-baseline.json` (see `docs/DEVIATIONS.md`).

`test:e2e` starts a dedicated server at `127.0.0.1:43181`. Chromium always runs; Microsoft Edge also runs when its standard Windows installation is available. T23 needs network access to UEA and WebGL; this host uses SwiftShader. A local forwarding server captures the frame's health request headers, preserving real cookies and CORS behavior. It records presence of a synthetic cookie, never a real credential.

On hosts with a full system drive, point `TEMP`, `TMP` and `PLAYWRIGHT_BROWSERS_PATH` to a writable local directory before installation/testing. This checkout keeps the npm cache in ignored `.data/npm-cache`. Tests use one worker to limit memory usage.

Open `/renderer-spike` for the technical experiment, `/about` for limitations and credits, and `/api/health` for a DB round trip. Processing remains disabled in phase 1. The remote engine is never loaded into the parent page.

The official event sticker is missing. The top banner displays an explicit placeholder until `/public/event-sticker.png` is supplied. No replacement or imitation was created.

See `docs/phase-reports/phase-1.md` for measured results, deployment status, and blockers. `SYSTEM-DESIGN.md` is the immutable specification.
