# SignBridge

Experimental · not reviewed by BdSL signers.

The local product supports uploads, caption correction, fenced processing, sequential playback, saved replay, unlisted revocable sharing and deletion. Production adapters are implemented but have not been deployed or exercised with approved credentials. The official event sticker is missing. Phase reports distinguish local evidence from production and device gates.

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

Open `/renderer-spike` for the technical experiment, `/about` for limitations and credits, and `/api/health` for a DB round trip. Processing defaults to disabled. The remote engine is never loaded into the parent page.

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

The Phase 3 default suite runs all prior checks plus 50 shared state tests on PGlite. Independent row-lock contention is verified with the same 50 tests on a disposable PostgreSQL cluster:

```powershell
npm run test:race:native
```

Native tests require PostgreSQL binaries (`C:/Program Files/PostgreSQL/16/bin` by default; override their directory with `PG_TEST_BIN`). The harness creates its own loopback-only cluster and database, uses empty-password trust authentication for synthetic fixtures, and stops/removes that cluster after the suite. It never uses `DATABASE_URL` or an existing database credential. PostgreSQL 16.11 was used here with a 20-connection pool; PGlite itself has only one connection.

Run `npm run db:migrate` for the two additive Phase 3 migrations in the local database. As always, ask before supplying or using a real database secret. The schema additions and upload-lease cleanup guard are recorded in `docs/DEVIATIONS.md`. All application transitions stay in `lib/db/queries`; the client bridge only adapts driver results, and the reconciler orchestrates those queries and the BlobStore.

See `docs/phase-reports/phase-1.md`, `docs/phase-reports/phase-2.md` and `docs/phase-reports/phase-3.md` for per-phase results. `SYSTEM-DESIGN.md` is the immutable specification.

## Phase 4 local pipeline

After `npm run db:migrate` and `npm run db:seed:local`, set the nonsecret local `PROCESSING_ENABLED=true` and run `npm run dev`. The route pipeline defaults to a deterministic fake; manifests and cache keys say `fake/…`. Never use a real key without approval. Production requires explicit Neon, private Blob, OpenAI and Workflow adapters; it fails closed if these are absent. The creator workspace is available locally.

Run `npm test`, `npm run test:race:native`, `npm run typecheck`, `npm run lint` and `npm run build`. `npx tsx scripts/phase4-live-smoke.ts` prints the dry-run contract; the real two-segment smoke needs approval, a locally configured key and `--live`, with a USD 0.20 cap. See [Phase 4 evidence](docs/evidence/phase-4/notes.md).

## Creator workspace and player

Create a project on `/`, upload a short MP4/WebM and paste SRT/VTT or timestamped captions, preview/merge/split, then build the companion. The workspace shows technical, source-confirmation and review states separately. Signing waits for each source segment; critical gaps block before play, and incomplete/skip outcomes never count as complete. Pause discards the renderer and Resume starts signing at the first sign. UEA remains a remote runtime dependency.

`npm run test:workspace` runs the dedicated, isolated fake-model browser harness plus real CWASA technical rendering in Chromium/Edge. `npm test` includes the 1,000-interleaving scheduler matrix. See [Phase 5 evidence](docs/evidence/phase-5/notes.md). Verified synthetic sample projects are now linked from the production home page.

## Product freeze (Phase 6)

Corrections stop affected signing before the request and preserve drafts on version conflicts. Source confirmations show their own timestamp. Share links are view-only and revocable; signed video URLs already issued can last another 15 minutes. Delete hides the project immediately; the reconciler purges after outstanding upload leases expire. Saved replay works without a model key and while processing is disabled. WebGL/renderer failures preserve captions and gap cards.

`npm run test:product` runs all workspace regressions plus sharing, correction, outage, throttled API, WebGL and markup/CSP checks on headless Chromium/Edge. It resets only the dedicated browser-fixture database. Synthetic fixture authorization is never a production credential. `SIGNBRIDGE_EVIDENCE_PHASE=6 npm run test:e2e` routes foundation evidence to Phase 6 instead of overwriting earlier evidence.

`/api/admin/status` exposes SQL metrics behind admin authorization. The environment flag and DB kill switch stop new processing; >20% real OpenAI errors over 10 minutes automatically turn off the DB switch. Re-enabling acknowledges prior errors. Fake attempts are labelled and excluded from real OpenAI rates. Structured logs omit captions. Daily reconciliation is configured in `vercel.json`; Hobby scheduling can be late, so 96-hour cleanup is a target conditional on daily execution, not a guaranteed deadline.

Evidence categories: technical renderability = 20/20 sampled files on one Windows host in headless Edge with software WebGL, plus the documented multi-unit Chromium/Edge fixture. Linguistic correctness = none. User comprehension = none. Captions, context and title go to OpenAI for real processing; `store:false` does not mean no provider retention.

Feature freeze cuts optional anchors, learner pace presets, simultaneous overlay, embeddings and ASR. Deployment/content and fixes remain; the sticker is blocked, not cut. See `docs/phase-reports/phase-6.md` and `docs/DEVIATIONS.md`.

## Production (Phase 7)

[Open SignBridge](https://signbridge-mdtayebibne-4755s-projects.vercel.app). [Play covered sample](https://signbridge-mdtayebibne-4755s-projects.vercel.app/s/b0a2b6b2-fbab-4936-829e-620b0a937ed4?s=8EdVJxY2BO-DDccdy6bQu-M7r5Oq5aSyH4ma9NaE6Fg) · [See unsupported sample](https://signbridge-mdtayebibne-4755s-projects.vercel.app/s/1ad052e9-bb09-4132-a98a-995917bfb86b?s=v-7iWygWd90ePqFdKQV4ZLu_9NGMwYCB9f-3bsllpVs). These are original silent synthetic source fixtures, not language-quality evidence. A is 45 seconds / six technically ready segments; B has deliberate unsupported negation. The links are intentionally public and read-only. Owner/admin/database/model credentials are never published.

T1/T2/T9/T14 passed. Measured OpenAI usage is USD 0.101634 from existing credits; the approved ceiling is USD 4. SQL lifetime/day caps remain USD 0.30 preview plus USD 0.70 production, with no automatic increase. Infrastructure stays on free plans. See docs/phase-reports/phase-7.md and docs/evidence/phase-7/gates.json for actual browser versions, checks and limitations. Official sticker missing; physical-device tests await owner observations. Linguistic correctness and comprehension remain unevaluated.

The preview database is a separate Neon Free project rather than a branch; this deviation is logged. The no-key preview replays saved tracks with processing disabled. Workflows remains the production driver and survived an actual production cutover; no lease fallback is claimed. See docs/PRODUCTION-RUNBOOK.md for maintenance, docs/MOBILE-TEST.md for real devices, and docs/UEA-FALLBACK-CAPTURE.md for dated source recordings.

Use the dry-first seed/probe tools only with explicitly approved credentials and bounded budgets. Private durable checkpoints remain in ignored .data/. The curated import and raw verification artifacts preserve their provenance; verification-artifacts.json indexes the lossless archive.
