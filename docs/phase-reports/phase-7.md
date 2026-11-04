## Status
PARTIAL — T1/T2/T9/T14 PASS; official sticker missing; physical-device observations pending.

## Checks

| Command | Exit code | Pass / fail / skip counts |
|---|---|---|
| `npm run typecheck` / `npm run lint` | 0 / 0 | 1 / 0 / 0 each |
| `npm test` / `npm run test:race:native` | 0 / 0 | 192 / 0 / 0; 51 / 0 / 0 |
| `SIGNBRIDGE_EVIDENCE_PHASE=7 npm run test:product` | 0 | 16 / 0 / 0; Chromium/Edge |
| Remote preview / production / no-key replay browser checks | 0 each | 4 / 0 / 0 each; Chrome/Edge |
| `npm run build` / `node scripts/check-workflow-build.mjs` | 0 | 21 steps / 1 workflow; all 4 application steps registered |
| Curated probe, local demo, twice-applied seed, managed migrations/seed | 0 each | 12/12 render checks; isolated Neon targets; raw results archived |
| Same-run T9 recheck / deployed operations / public demos | 0 each | one publication; health/admin/cron/HEAD 200; desktop/portrait and both public views pass |
| `npm run check:secrets`, actual-value scan, staged diff check | 0 each | no credentials; 69 ZIP entries verified losslessly |

## Acceptance tests

| T-ID | PASS / FAIL / NOT RUN | Test file path | Evidence or reason |
|---|---|---|---|
| T1 | PASS | tests/production/saved-demo.spec.ts | Production A: 45 s, 6 ready segments, 12 calls, no repairs; full Chrome/Edge playback. B blocks unsupported negation. |
| T2 | PASS | tests/production/saved-demo.spec.ts | Same reload/share hash, zero new calls; no-key/processing-disabled preview; Range 206 and ETag 304. |
| T9 | PASS | scripts/recheck-deployment-durability.ts; tests/race/native/deployment.native.ts | Actual cutover while running; same Workflow run publishes once; initial checker read race fixed and same run rechecked without more processing. |
| T14 | PASS | scripts/corpus-render-probe.cjs | 12/12 curated UEA renders; only matching rendered_ok hashes eligible. |
| Operations / public demos | PASS | scripts/verify-deployed-operations.ts; scripts/check-public-demos.ts | Authenticated admin/cron and curl HEAD pass; public health and both read-only samples need no credential. |
| H.2 physical devices | NOT RUN | docs/MOBILE-TEST.md | Checklist supplied; desktop portrait layout is not a physical Android/iPhone result. |

## Deviations
- 2026-11-03 · phase 7 · phase-7 production gate / end-of-phase report · Keep an interim PARTIAL report and defer the phase-7 tag and Phase 8 until production verification can run · `.env.local`, `demo-input/` and the official sticker are absent; the owner requires approval before any secret or Vercel value is used · Phase 6 is committed/tagged; Phase 7 preparations are local only, and T1/T2/T9/T14 are NOT RUN rather than invented PASS/FAIL results. The interim Files section uses the preparation commit instead of a nonexistent phase-7 tag.
- 2026-11-03 · phase 7 · §A.5 / real-model production gates · Apply an owner-directed USD 0 spending ceiling; leave real OpenAI checks NOT RUN and retain labelled local fake fixtures · Owner answered "do erverything for free" and does not know the demo directory; this does not authorize paid calls or silently replacing the specified production model · Workspace media inventory found only tests/fixtures/clip.mp4, with no SRT/VTT/demo-input; Phase 4 revalidation passes 190 default tests, 50 native race tests, typecheck, lint and build without credentials.
- 2026-11-04 · phase 7 · §A.5 / §H.7 · Supersede the earlier USD 0 restriction with explicitly approved existing-credit use capped at USD 4 total; retain free infrastructure only and no purchases/upgrades/billing changes · Owner approved this in chat and requested minimal credit use, then approved new free projects and the runbook's environment settings · Four real model smoke calls cost USD 0.018616 from returned usage; separate preview/production SQL caps initially total USD 1; docs/evidence/phase-7/credit-usage.json.
- 2026-11-04 · phase 7 · §A.2 / phase-7 production config · Use a separate Neon Free preview project instead of a branch of production · Both browser runtimes fail with kernel-assets path errors; current Vercel CLI 65.11.0 native Neon integration cannot configure automatic branch actions. Separate projects preserve actual data isolation · Production-only signbridge-db and preview-only signbridge-preview-db, free_v3/iad1; docs/evidence/phase-7/database-isolation.json; https://neon.com/docs/guides/vercel-managed-integration .
- 2026-11-04 · phase 7 · §H.6 · Generate original, silent, explicitly synthetic source text-card clips/captions instead of unavailable owner footage; use দুধ in the covered source while retaining পানি in the common-word corpus · Owner did not know an input directory. Conservative suffix detection treats পানি as negation; the detector and plans remain unchanged · scripts/prepare-demo-inputs.ts, measured demo-inputs.json, curated-selection.json and local-demo-check.json; 45-second/six-segment A and deliberately unsupported B, source provenance retained privately; no linguistic or comprehension evidence.
- 2026-11-04 · phase 7 · §A.2 / corpus seed transport · Batch at most 100 adjacent generated INSERT rows with identical columns/conflict policy, retaining one atomic SQL transaction and original row ordering · Individual remote round trips made the full seed impractical on Neon; interrupted the new database's seed transaction before retrying · lib/db/queries/corpusSeed.ts and the twice-applied full curated PGlite seed check; no HTTP/model SQL is admitted.
- 2026-11-04 · phase 7 · §G.4 / deployment inputs · Add explicit .vercelignore exclusions for local credentials/state, demo inputs and test evidence · Vercel CLI 65.11.0 dry inspection included Git-ignored .data files; no upload was performed with those inputs · Deployment is blocked until a second dry inspection confirms exclusions and scans the actual upload files for approved secret values.
- 2026-11-04 · phase 7 · §A.2 / §H.1 T1 · Put every Workflow step directive on its own line and gate builds on all four registered application step IDs · Workflow 5.3.0 / @workflow/next 5.0.7 uses a line-anchored discovery regex; inline directives produced a successful build with 17 built-ins but zero application steps. The first preview run failed before claiming SQL authority or making model calls · scripts/check-workflow-build.mjs reproduced FAIL for all four missing steps; private runtime logs identify unregistered claimWorkflow; https://workflow-sdk.dev/getting-started/next .
- 2026-11-04 · phase 7 · §H.1 T2 / ETag handling · Compare the exact SHA entity identifier while allowing the HTTP weak-validator prefix; accept weak If-None-Match lists on GET/HEAD · Vercel Brotli compression changed the manifest response to W/"hash", causing the client to reject saved tracks. Wrong or malformed hashes still fail · Four remote browser failures and scripts/recheck-deployed-track.ts reproduce the rejection; tests/unit/trackStore.test.ts failed before the fix and preserves identity across weak/strong revalidation; tests/unit/entityTag.test.ts covers mismatch rejection.
- 2026-11-04 · phase 7 · §A.2 / public deployment · Limit the new project's Vercel Authentication scope to preview deployments · CLI 65.11.0 created it with all_except_custom_domains, which also redirected the promoted free vercel.app production URL to sign-in; the requested public production app requires anonymous frontend/API access while application owner/share authorization remains enforced · Newly created signbridge project only; public JSON health is checked without any bypass credential; https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication .
- 2026-11-04 · phase 7 · §H.6 / public sample links · Intentionally publish only the read-only sharing capabilities for the two original synthetic pinned demos and replace the landing-page sample placeholder with those links · Public demonstration links are part of the phase goal; these CC0 source fixtures contain no private footage or user data. Owner/admin/cron/database/model credentials remain private · lib/domain/publicDemoCatalog.ts; production desktop playback and unsupported-gap checks pass before link publication; no editing or administrative capability is published.
- 2026-11-04 · phase 7 · §H.1 T9 · Hold only the new verification project's SQL row after a real model stage reservation, through actual production cutover, then release; read verification rows in one repeatable-read snapshot · Short original inputs otherwise finish before the build. The Workflow did survive and publish, but the initial checker read the project before publication and job/track after it, causing a false mismatch. Recheck the same run without spending again · scripts/recheck-deployment-durability.ts validates deployment-created/ready/cutover-observed times between job creation/finish, one bound publication and settled usage; tests/race/native/deployment.native.ts forces publication between reads to prevent a mixed snapshot. No lease fallback or artificial runtime pause feature is used.

## Risks / open questions

- Public production: https://signbridge-mdtayebibne-4755s-projects.vercel.app. [Play covered sample](https://signbridge-mdtayebibne-4755s-projects.vercel.app/s/b0a2b6b2-fbab-4936-829e-620b0a937ed4?s=8EdVJxY2BO-DDccdy6bQu-M7r5Oq5aSyH4ma9NaE6Fg) · [See unsupported sample](https://signbridge-mdtayebibne-4755s-projects.vercel.app/s/1ad052e9-bb09-4132-a98a-995917bfb86b?s=v-7iWygWd90ePqFdKQV4ZLu_9NGMwYCB9f-3bsllpVs). Only these original synthetic demo links are intentionally public.
- Measured OpenAI use USD 0.101634, reserved USD 0; approved USD 4 existing credits. SQL lifetime/day caps remain USD 0.30 preview + USD 0.70 production. Free infrastructure; no purchases/upgrades/billing changes.
- Official sticker missing; explicit placeholder retained. Physical devices NOT RUN; linguistic correctness NONE; comprehension NONE. Original dated production recordings and SHA hashes are archived; a recording does not establish current UEA availability.
- Full production gate passes; phase-7 is tagged with the commit. Raw checks/screenshots/recordings are in verification-artifacts.zip with a per-entry hash index. SYSTEM-DESIGN.md is unchanged; previous phase reports/evidence are preserved.

## Files

`git diff --stat phase-6 phase-7`:

```text
 .env.example                                      |    4 +
 .vercelignore                                     |   14 +
 README.md                                         |   12 +-
 app/page.tsx                                      |    5 +-
 demo-input.example.json                           |    7 +
 docs/DEVIATIONS.md                                |   12 +
 docs/MOBILE-TEST.md                               |   30 +
 docs/PRODUCTION-RUNBOOK.md                        |   47 +
 docs/UEA-FALLBACK-CAPTURE.md                      |   13 +
 docs/evidence/phase-7/asset-render-checks.json    |  244 ++++
 docs/evidence/phase-7/credit-usage.json           |   89 ++
 docs/evidence/phase-7/curated-import/import.json  | 1300 +++++++++++++++++++++
 docs/evidence/phase-7/curated-selection.json      |   35 +
 docs/evidence/phase-7/demo-inputs.json            |   32 +
 docs/evidence/phase-7/durability.json             |   73 ++
 docs/evidence/phase-7/gates.json                  |   88 ++
 docs/evidence/phase-7/live-smoke.json             |   63 +
 docs/evidence/phase-7/notes.md                    |   25 +
 docs/evidence/phase-7/operations.json             |  111 ++
 docs/evidence/phase-7/production-capture.json     |   31 +
 docs/evidence/phase-7/public-health.json          |   12 +
 docs/evidence/phase-7/replay-environment.json     |   19 +
 docs/evidence/phase-7/verification-artifacts.json |  422 +++++++
 docs/evidence/phase-7/verification-artifacts.zip  |  Bin 0 -> 7282819 bytes
 docs/evidence/phase-7/workflow-recovery.json      |   13 +
 docs/phase-reports/phase-7.md                     |  117 ++
 lib/db/queries/corpusSeed.ts                      |   16 +-
 lib/db/queries/demo.ts                            |   19 +
 lib/db/queries/deploymentVerification.ts          |   28 +
 lib/domain/entityTag.ts                           |    9 +
 lib/domain/publicDemoCatalog.ts                   |   15 +
 lib/jobs/workflowSteps.ts                         |   20 +-
 lib/player/store.ts                               |    7 +-
 lib/server/api.ts                                 |    5 +-
 package.json                                      |    2 +-
 playwright.product.config.ts                      |    5 +-
 playwright.production.config.ts                   |   12 +
 playwright.workspace.config.ts                    |    2 +-
 scripts/check-demo-local.ts                       |   42 +
 scripts/check-public-demos.ts                     |   20 +
 scripts/check-workflow-build.mjs                  |    8 +
 scripts/corpus-import.ts                          |   13 +-
 scripts/corpus-render-probe.cjs                   |    9 +-
 scripts/inspect-managed-verification.ts           |   20 +
 scripts/phase4-live-smoke.ts                      |    6 +-
 scripts/prepare-demo-inputs.ts                    |   49 +
 scripts/prepare-managed-database.ts               |   19 +
 scripts/recheck-deployed-track.ts                 |   19 +
 scripts/recheck-deployment-durability.ts          |   32 +
 scripts/seed-demo.ts                              |   77 +-
 scripts/verify-demo-corpus.ts                     |   17 +
 scripts/verify-deploy-durability.ts               |   72 ++
 scripts/verify-deployed-operations.ts             |   24 +
 tests/browser/product.spec.ts                     |    9 +-
 tests/browser/workspace.spec.ts                   |    2 +-
 tests/contract/pipelineApi.test.ts                |   14 +
 tests/production/saved-demo.spec.ts               |   74 ++
 tests/race/native/deployment.native.ts            |   23 +
 tests/unit/demoPreflight.test.ts                  |   17 +
 tests/unit/entityTag.test.ts                      |    8 +
 tests/unit/trackStore.test.ts                     |   14 +
 vercel.json                                       |    1 +
 62 files changed, 3511 insertions(+), 36 deletions(-)
```
