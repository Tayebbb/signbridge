# SignBridge

Experimental · not reviewed by BdSL signers.

Phase 2 adds pure caption parsers, text forms, segmentation/context windows, versioned fingerprints, strict Zod/JSON contracts, deterministic validators, retrieval, SiGML assembly and manifest construction to the Phase 1 foundation. Public IsharaKotha data is hash-verified and checked against the XML policy. Upload flows, model calls, business routes and the player scheduler remain later-phase work.

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

Corpus commands (the supplied research reference directory is the default; pass `--research PATH` to download/import to change it):

```powershell
npm run corpus:download
npm run corpus:import
npm run corpus:probe
npm run corpus:import -- --checks docs/evidence/phase-2/asset-render-checks.json
```

The import emits `data/corpus/assets.json` and `data/corpus/seed.sql`; contract tests apply the real seed to an empty PGlite database twice. `--samples` imports the supplied sample files instead. Only assets with matching successful render evidence become eligible. `asset_render_checks` is a JSON evidence collection, persisted in the existing schema's `sign_assets.render_evidence` field by the seed; no new table is introduced.

Measured full-release import: 3,990 file entries, 3,108 verified distinct byte hashes, 2,934 accepted assets and 174 quarantined hashes. The design's fixed XML whitelist is retained; 131 rejected hashes use nonmanual elements outside it. These are not vocabulary or correctness counts. All 20 supplied technical samples render successfully; other accepted assets remain ineligible until probed.

See `docs/phase-reports/phase-1.md` and `docs/phase-reports/phase-2.md` for per-phase results. `SYSTEM-DESIGN.md` is the immutable specification.
