## Status
COMPLETE — Phase 6 revalidated on the current build; P0-1…P0-10 DONE.

## Checks

| Command | Exit code | Pass / fail / skip counts |
|---|---|---|
| `npm run typecheck` / `npm run lint` | 0 / 0 | 1 / 0 / 0 each |
| `npm test` | 0 | 194 / 0 / 0 |
| `npm run test:race:native` | 0 | 51 / 0 / 0; disposable PostgreSQL cluster |
| `SIGNBRIDGE_EVIDENCE_PHASE=6 npm run test:product` | 0 | 16 / 0 / 0; Chromium/Edge, isolated fake processing |
| `SIGNBRIDGE_EVIDENCE_PHASE=6 npm run test:e2e` | 0 | 4 / 0 / 0; includes real opaque CWASA integration and production build |
| Public read check / historical evidence hash comparison | 0 / 0 | 4 GET checks pass; original phase evidence bytes preserved |
| `npm run check:secrets` / exact-value scan / staged diff check | 0 each | No credentials or whitespace errors; immutable design hash unchanged |

## Acceptance tests

| T-ID | PASS / FAIL / NOT RUN | Test file path | Evidence or reason |
|---|---|---|---|
| T2 (local) | PASS | tests/browser/product.spec.ts; tests/contract/pipelineApi.test.ts | Owner/shared reload: same manifest hash and unchanged attempts/budgets; model key unset. |
| T10 | PASS | tests/browser/product.spec.ts; tests/unit/scheduler.test.ts | UEA block/retry, disabled WebGL, API throttling, readable captions/gaps, telemetry and 5/15/45 s backoff pass. |
| T12 (full) | PASS | tests/contract/pipelineApi.test.ts; tests/browser/product.spec.ts | Foreign owner/share rejected on owner mutations; hostile markup literal; nonce CSP enforced. |
| T6 / P0-6 | PASS | tests/browser/product.spec.ts; tests/contract/pipelineApi.test.ts | Edit stops stale playback before response; replacement hash and CAS draft recovery pass. |
| T18 / T24 | PASS | tests/contract/pipelineApi.test.ts; tests/browser/product.spec.ts | Revocation overrides cached access; delete 202 hides reads; purge respects lease grace and preserves spend. |
| P0-9 | PASS | tests/e2e/foundation.spec.ts; docs/evidence/rechecks/phase-6-2026-11-04/public-readcheck.json | Official sticker visible locally; public home/About/health 200 and served original PNG bytes match. |
| Earlier phase regression | PASS | tests; docs/evidence/rechecks/phase-6-2026-11-04/checks.json | 194 default + 51 native + 16 product + 4 foundation checks pass; original evidence preserved. |
| H.2 physical devices | NOT RUN | docs/MOBILE-TEST.md | Desktop software WebGL/portrait checks do not establish physical Android/iPhone behavior. |

## Deviations
- 2026-11-04 · phase 6 · repeat execution / end-of-phase history · Revalidate the current post-Phase-8 build and record a dated supplemental report/tag, with its file diff based on phase-8; preserve the original phase-6 report and tag · Phase 6 was already committed at 093afbf and its former sticker blocker was resolved in Phase 8. Moving old tags or rewriting historical evidence would destroy the requested per-phase gates. Existing test output paths are snapshotted, their new results relocated, and original bytes restored · docs/evidence/rechecks/phase-6-2026-11-04/checks.json and preservation.json; docs/phase-reports/phase-6-recheck-2026-11-04.md; tag phase-6-recheck-2026-11-04.

## Risks / open questions

- P0-1 DONE; P0-2 DONE; P0-3 DONE; P0-4 DONE; P0-5 DONE; P0-6 DONE; P0-7 DONE; P0-8 DONE; P0-9 DONE; P0-10 DONE. P0-3 real-provider evidence remains Phase 7; P0-9's former sticker blocker was resolved in Phase 8.
- CUT: O1 anchors, O2 learner pace presets, O3 simultaneous mode, O4 embeddings, O5 ASR; reason: P0 feature freeze. No feature scope added in this recheck.
- No blocking questions. Physical devices NOT RUN; linguistic correctness NONE; user comprehension NONE. UEA/WebGL remain runtime dependencies. No new model-credit consumption or deployment/environment changes.
- Original phase-6 tag 093afbf and all phase-1…phase-8 reports/tags are preserved. This dated supplement uses tag phase-6-recheck-2026-11-04, based on phase-8, so per-phase diffs retain their historical meaning.

## Files

`git diff --stat phase-8 phase-6-recheck-2026-11-04`:

```text
 docs/DEVIATIONS.md                                 |    1 +
 .../phase-6-2026-11-04/browser-results.json        |  742 +++++++++
 .../rechecks/phase-6-2026-11-04/checks.json        |   54 +
 .../phase-6-2026-11-04/corrected-chromium.png      |  Bin 0 -> 129961 bytes
 .../phase-6-2026-11-04/corrected-msedge.png        |  Bin 0 -> 129961 bytes
 .../phase-6-2026-11-04/deleted-chromium.png        |  Bin 0 -> 53922 bytes
 .../rechecks/phase-6-2026-11-04/deleted-msedge.png |  Bin 0 -> 53922 bytes
 .../foundation-browser-results.json                |  348 +++++
 .../foundation-t23-chromium.json                   | 1629 ++++++++++++++++++++
 .../phase-6-2026-11-04/foundation-t23-chromium.png |  Bin 0 -> 174976 bytes
 .../phase-6-2026-11-04/foundation-t23-msedge.json  | 1573 +++++++++++++++++++
 .../phase-6-2026-11-04/foundation-t23-msedge.png   |  Bin 0 -> 174976 bytes
 .../rechecks/phase-6-2026-11-04/foundation.log     |   65 +
 .../phase-6-2026-11-04/gap-card-chromium.png       |  Bin 0 -> 131167 bytes
 .../phase-6-2026-11-04/gap-card-msedge.png         |  Bin 0 -> 129114 bytes
 .../phase-6-2026-11-04/incomplete-chromium.png     |  Bin 0 -> 127325 bytes
 .../phase-6-2026-11-04/incomplete-msedge.png       |  Bin 0 -> 127325 bytes
 docs/evidence/rechecks/phase-6-2026-11-04/lint.log |    3 +
 .../rechecks/phase-6-2026-11-04/live-chromium.json |   25 +
 .../rechecks/phase-6-2026-11-04/live-chromium.png  |  Bin 0 -> 181580 bytes
 .../rechecks/phase-6-2026-11-04/live-msedge.json   |   25 +
 .../rechecks/phase-6-2026-11-04/live-msedge.png    |  Bin 0 -> 107408 bytes
 .../phase-6-2026-11-04/native-environment.json     |    8 +
 .../phase-6-2026-11-04/native-results.json         |    1 +
 .../rechecks/phase-6-2026-11-04/native.log         |    5 +
 docs/evidence/rechecks/phase-6-2026-11-04/notes.md |   17 +
 .../rechecks/phase-6-2026-11-04/preservation.json  |  139 ++
 .../rechecks/phase-6-2026-11-04/product.log        |   85 +
 .../phase-6-2026-11-04/public-readcheck.json       |   33 +
 .../rechecks/phase-6-2026-11-04/ready-chromium.png |  Bin 0 -> 109886 bytes
 .../rechecks/phase-6-2026-11-04/ready-msedge.png   |  Bin 0 -> 108073 bytes
 .../phase-6-2026-11-04/ready-portrait-layout.png   |  Bin 0 -> 87162 bytes
 .../phase-6-2026-11-04/recovered-chromium.png      |  Bin 0 -> 109566 bytes
 .../phase-6-2026-11-04/recovered-msedge.png        |  Bin 0 -> 107698 bytes
 .../rechecks/phase-6-2026-11-04/typecheck.log      |    3 +
 docs/evidence/rechecks/phase-6-2026-11-04/unit.log |    5 +
 .../phase-6-2026-11-04/vitest-results.json         |    1 +
 .../phase-6-2026-11-04/webgl-disabled-chromium.png |  Bin 0 -> 117852 bytes
 .../phase-6-2026-11-04/webgl-disabled-msedge.png   |  Bin 0 -> 117852 bytes
 docs/phase-reports/phase-6-recheck-2026-11-04.md   |   85 +
 40 files changed, 4847 insertions(+)
```
