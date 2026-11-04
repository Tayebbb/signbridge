## Status
COMPLETE — Existing Phase 7 release verified; original T1/T9 evidence retained, fresh playback/T2/T14/operations pass.

## Checks

| Command | Exit code | Pass / fail / skip counts |
|---|---|---|
| `npm run typecheck` / `npm run lint` (detached c051eeb) | 0 / 0 | 1 / 0 / 0 each; concurrent edits excluded |
| `npm test` (detached c051eeb) | 0 | 194 / 0 / 0; shared-checkout 195-test run retained separately |
| `corpus-render-probe.cjs` (curated input) | 0 | 12 / 0 / 0; real UEA; both databases match successful hashes |
| Existing-release live check | 0 | Production Chrome/Edge: 6 segments each; keyless preview Chrome: 1; all three scenarios pass |
| Health / admin / cron / `curl -I` | 0 | 200 each; Range 206 and ETag 304; no model calls or share rotation |
| Original archive / T9 SQL / Vercel configuration reads | 0 | 69 hashes; one original publication; READY/Hobby and preview key absent |
| `npm run check:secrets` / exact-value scan / staged diff check | 0 each | No credentials or whitespace errors; design and prior reports/tags unchanged |

## Acceptance tests

| T-ID | PASS / FAIL / NOT RUN | Test file path | Evidence or reason |
|---|---|---|---|
| T1 | PASS | tests/production/saved-demo.spec.ts; docs/evidence/rechecks/phase-7-2026-11-04/production-chrome.json | Original fresh 45 s/six-segment upload and 12 real calls retained; fresh full Chrome/Edge replay passes. No new upload claimed. |
| T2 | PASS | docs/evidence/rechecks/phase-7-2026-11-04/production-msedge.json; preview-chrome.json | Same owner/shared hash; zero new calls; keyless processing-disabled preview replays; Range 206, ETag 304. |
| T9 | PASS | docs/evidence/rechecks/phase-7-2026-11-04/durability-recheck.json | Original actual mid-job cutover revalidated against unchanged Workflow/job/track/attempt rows; one publication. No new redeploy claimed. |
| T14 | PASS | scripts/corpus-render-probe.cjs; docs/evidence/rechecks/phase-7-2026-11-04/probe/asset-render-checks.json | Fresh 12/12 renders; all 12 eligible assets have hash-matched successful evidence on both databases. |
| Operations / demos / sticker | PASS | docs/evidence/rechecks/phase-7-2026-11-04/operations.json; configuration.json | Public health, authenticated admin/cron, HEAD and unchanged public samples pass; official PNG matches original; Hobby/READY confirmed. |
| Dated fallback evidence | PASS | docs/evidence/rechecks/phase-7-2026-11-04/archive-verification.json; docs/UEA-FALLBACK-CAPTURE.md | All 69 archived entries match hashes, including original dated production recordings; no new recording claimed. |
| H.2 physical devices | NOT RUN | docs/MOBILE-TEST.md | Owner checklist supplied; no physical Android/iPhone results; desktop software WebGL does not qualify. |

## Deviations
- 2026-11-04 · phase 7 · repeat execution / §H.1 T1/T9 / end-of-phase history · Recheck unchanged deployed app code, existing real-provider rows and actual redeploy chronology without a new paid job or redeployment; add fresh saved-playback, asset-probe and operations evidence under a dated supplemental report/tag based on phase-6-recheck-2026-11-04 · Original T1/T2/T9/T14 already passed. The owner requested minimum credit use, and existing public share links must remain valid. Preserve phase-1 through phase-8 tags/reports and label retained versus fresh evidence explicitly · docs/evidence/rechecks/phase-7-2026-11-04/; docs/phase-reports/phase-7-recheck-2026-11-04.md; tag phase-7-recheck-2026-11-04. No new fresh upload or in-flight redeploy is claimed.
- 2026-11-04 · phase 7 · concurrent checkout / verification scope · Run release quality checks in a detached c051eeb worktree and exclude concurrent scheduler/test/browser-evidence edits from this commit and deployment · The owner explicitly chose "Verify the existing release; preserve the concurrent edits" after those edits appeared during verification. The initial shared 195-test run is retained separately; release claims use the isolated 194-test result. Installed dependencies are shared; generated route declarations were copied for unchanged routes · docs/evidence/rechecks/phase-7-2026-11-04/release-quality.json and concurrent-edits.json; original phase tags/reports and the other task's working files remain intact.

## Risks / open questions

- Public production: https://signbridge-mdtayebibne-4755s-projects.vercel.app. [Play covered sample](https://signbridge-mdtayebibne-4755s-projects.vercel.app/s/b0a2b6b2-fbab-4936-829e-620b0a937ed4?s=8EdVJxY2BO-DDccdy6bQu-M7r5Oq5aSyH4ma9NaE6Fg) · [See unsupported sample](https://signbridge-mdtayebibne-4755s-projects.vercel.app/s/1ad052e9-bb09-4132-a98a-995917bfb86b?s=v-7iWygWd90ePqFdKQV4ZLu_9NGMwYCB9f-3bsllpVs). Only the original synthetic read-only demo capabilities are intentionally public.
- Measured use USD 0.101634; reserved USD 0; new calls 0; approved USD 4 existing credits. SQL caps remain USD 0.30 preview + USD 0.70 production. No purchases/upgrades, migration/seed, deployment or environment changes.
- Owner chose existing-release verification. Concurrent scheduler/test/browser-evidence edits remain outside this commit/deployment; their release is a separate task. Original phase-1…phase-8 reports/tags remain intact; dated tag phase-7-recheck-2026-11-04 records this supplement.
- No blocking questions. Physical devices NOT RUN; linguistic correctness NONE; user comprehension NONE. UEA/WebGL remain runtime dependencies. Real fresh processing and redeploy were not repeated; retained original gate evidence is labelled explicitly.

## Files

`git diff --stat phase-6-recheck-2026-11-04 phase-7-recheck-2026-11-04`:

```text
 docs/DEVIATIONS.md                                 |   2 +
 docs/PRODUCTION-RUNBOOK.md                         |  12 +-
 .../phase-7-2026-11-04/archive-verification.json   |   7 +
 .../rechecks/phase-7-2026-11-04/checks.json        |  40 ++++
 .../phase-7-2026-11-04/concurrent-edits.json       |  65 ++++++
 .../rechecks/phase-7-2026-11-04/configuration.json |  15 ++
 .../phase-7-2026-11-04/corpus-databases.json       |  24 ++
 .../rechecks/phase-7-2026-11-04/curated-probe.log  |  12 +
 .../phase-7-2026-11-04/durability-recheck.json     |  13 ++
 docs/evidence/rechecks/phase-7-2026-11-04/lint.log |   3 +
 docs/evidence/rechecks/phase-7-2026-11-04/live.log |   4 +
 docs/evidence/rechecks/phase-7-2026-11-04/notes.md |  15 ++
 .../rechecks/phase-7-2026-11-04/operations.json    |  85 +++++++
 .../phase-7-2026-11-04/preview-chrome-covered.png  | Bin 0 -> 94986 bytes
 .../preview-chrome-unsupported.png                 | Bin 0 -> 121062 bytes
 .../phase-7-2026-11-04/preview-chrome.json         |  35 +++
 .../probe/asset-render-checks.json                 | 244 +++++++++++++++++++++
 .../rechecks/phase-7-2026-11-04/probe/corpus-1.png | Bin 0 -> 114516 bytes
 .../phase-7-2026-11-04/probe/corpus-12.png         | Bin 0 -> 120682 bytes
 .../production-chrome-covered.png                  | Bin 0 -> 191914 bytes
 .../production-chrome-unsupported.png              | Bin 0 -> 171643 bytes
 .../phase-7-2026-11-04/production-chrome.json      |  80 +++++++
 .../production-msedge-covered.png                  | Bin 0 -> 191914 bytes
 .../production-msedge-unsupported.png              | Bin 0 -> 142117 bytes
 .../phase-7-2026-11-04/production-msedge.json      |  80 +++++++
 .../rechecks/phase-7-2026-11-04/release-lint.log   |   9 +
 .../phase-7-2026-11-04/release-quality.json        |  33 +++
 .../phase-7-2026-11-04/release-typecheck.log       |   9 +
 .../rechecks/phase-7-2026-11-04/release-unit.log   |   5 +
 .../phase-7-2026-11-04/release-vitest-results.json |   1 +
 .../rechecks/phase-7-2026-11-04/typecheck.log      |   3 +
 docs/evidence/rechecks/phase-7-2026-11-04/unit.log |   5 +
 .../phase-7-2026-11-04/vitest-results.json         |   1 +
 docs/phase-reports/phase-7-recheck-2026-11-04.md   |  79 +++++++
 34 files changed, 878 insertions(+), 3 deletions(-)
```
