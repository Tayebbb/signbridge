## Status
COMPLETE — Phase 8 submission package refreshed and verified against the existing release; concurrent edits preserved.

## Checks

| Command | Exit code | Pass / fail / skip counts |
|---|---|---|
| `npm run typecheck` / `npm run lint` (isolated release + owned edits) | 0 / 0 | 1 / 0 / 0 each; concurrent scheduler changes excluded |
| `npm test` (isolated release + owned edits) | 0 | 194 / 0 / 0 |
| `final-smoke.ts --live --evidence-dir=…` | 0 | 8 captures; health, saved replay, gap and controlled retry pass; new model calls 0 |
| Python deck export / `pdftoppm` / visual review | 0 / 0 | 5 / 0 / 0 pages; fresh production images; all full-page renders inspected |
| Claims grep / manual review / submission validation | 0 | 21 files; 20 justified hits; 0 unresolved; five slides; English script target 165 s |
| Current spend / prior release gate | 0 | USD 0.101634; USD 0 reserved; Phase 7 full gate retains PASS |
| `npm run check:secrets` / exact-value scan / staged diff check | 0 each | No credentials/whitespace errors; immutable design and historical reports unchanged |

## Acceptance tests

| T-ID | PASS / FAIL / NOT RUN | Test file path | Evidence or reason |
|---|---|---|---|
| P8-DECK | PASS | scripts/export-submission-deck.py; submission/deck.pdf | Five slides; fresh production captures; architecture, exactly three evidence categories, prior art and planned evaluation; all pages visually reviewed. |
| P8-TEXT | PASS | submission/devpost.md; README.md; submission/HANDOFF.md | Required draft sections, demo links, local commands, attribution, latest verified counts and existing-release scope supplied. |
| P8-SCRIPT | PASS | submission/demo-video-script.md | English 2:45 target; fresh-run recording instructions, gap, labelled controlled recovery, replay and limits; owner records optional video. |
| P8-SMOKE / T1 / T2 | PASS | scripts/final-smoke.ts; docs/evidence/final/recheck-2026-11-04/smoke.json | Official sticker on 8 route/layout captures; original bytes match; health 200, A replay, B blocking gap, same hash and zero new calls. |
| T22 controlled recovery | PASS | scripts/final-smoke.ts | Browser-only dropped callback gives Incomplete; Retry completes. Saved plan/animation unchanged; no production incident claimed. |
| P8-CLAIMS | PASS | scripts/audit-submission-claims.mjs; docs/evidence/final/recheck-2026-11-04/claims-audit.json | Every matched occurrence reviewed against §0.3/H.3; all justified below. |
| H.2 physical devices | NOT RUN | docs/MOBILE-TEST.md | No physical Android/iPhone result; portrait capture is a desktop layout observation. |

Claims audit (all 20 occurrences; excerpts and file hashes retained in claims-audit.json):

| Copy file | Hits / term | Justification |
|---|---|---|
| README.md | 1 / correct | Linguistic evidence explicitly None. |
| app/about/page.tsx | 2 / correct | Rendering does not establish quality; evidence None. |
| app/components/Workspace.tsx | 3 / correct | Source-caption editing controls only. |
| app/layout.tsx | 1 / correct | Metadata denies quality/comprehension evidence. |
| app/page.tsx | 1 / correct | Renderability does not establish quality/comprehension. |
| app/renderer-spike/page.tsx | 1 / translat | Explicitly denies fixture translation. |
| docs/ATTRIBUTION.md | 2 / correct | Corpus reuse/rendering does not confer BdSL quality. |
| docs/LIMITATIONS.md | 4 / correct, translat | None/negative quality statements, source edits and fixture limitation. |
| submission/HANDOFF.md | 1 / correct | Quality/comprehension evidence absent. |
| submission/deck.md | 1 / correct | Exact evidence category, explicitly None. |
| submission/demo-video-script.md | 1 / correct | Narration explicitly says linguistic evidence None. |
| submission/devpost.md | 2 / correct | Source-caption edits and linguistic evidence None. |
| All audited copy | 0 / accurate, understand, interpreter | No matches; supplemental app/lib TS/JS scan also has no additional hits. |

## Deviations
- 2026-11-04 · phase 8 · repeat execution / end-of-phase history / existing-release scope · Refresh submission screenshots and the verified 194-test count; add validated evidence-directory arguments to the export, audit and final-smoke tools, then record a dated supplement based on phase-7-recheck-2026-11-04 · Phase 8 was already tagged. Original evidence/reports/tags must retain their historical meaning, and the owner explicitly requested existing-release verification while preserving concurrent scheduler work. Quality checks use detached bb75bb0 plus only this phase's utility/copy edits; no app change is deployed · docs/evidence/final/recheck-2026-11-04/; submission/deck.md and deck.pdf; docs/phase-reports/phase-8-recheck-2026-11-04.md; tag phase-8-recheck-2026-11-04. Real-device and linguistic/comprehension evidence remain absent; optional video recording and Devpost submission remain owner actions.

## Risks / open questions

- No blocking questions. Optional video recording and actual Devpost submission remain owner actions. Eligibility/registration are not verified by this task; HANDOFF.md uses the earlier 5 November 22:00 +06 deadline because rules prose conflicts.
- Physical devices NOT RUN; linguistic correctness NONE; user comprehension NONE. No new model calls, deployment, environment change, purchase or upgrade; counted credit use remains USD 0.101634 of the approved USD 4.
- Owner-approved existing-release scope is retained; concurrent scheduler/test/browser-evidence files remain outside this commit/deployment. Original phase-1…phase-8 tags/reports and earlier evidence remain intact; dated tag phase-8-recheck-2026-11-04 records this supplement.

## Files

`git diff --stat phase-7-recheck-2026-11-04 phase-8-recheck-2026-11-04`:

```text
 README.md                                          |   2 +-
 docs/DEVIATIONS.md                                 |   1 +
 docs/evidence/final/recheck-2026-11-04/about.png   | Bin 0 -> 235367 bytes
 .../final/recheck-2026-11-04/claims-audit.json     | 386 +++++++++++++++++++++
 .../final/recheck-2026-11-04/concurrent-edits.json |  63 ++++
 docs/evidence/final/recheck-2026-11-04/creator.png | Bin 0 -> 100275 bytes
 .../final/recheck-2026-11-04/deck-slide-1.png      | Bin 0 -> 92096 bytes
 .../final/recheck-2026-11-04/deck-slide-2.png      | Bin 0 -> 146390 bytes
 .../final/recheck-2026-11-04/deck-slide-3.png      | Bin 0 -> 112401 bytes
 .../final/recheck-2026-11-04/deck-slide-4.png      | Bin 0 -> 132264 bytes
 .../final/recheck-2026-11-04/deck-slide-5.png      | Bin 0 -> 116400 bytes
 .../final/recheck-2026-11-04/deck-validation.json  |  20 ++
 .../evidence/final/recheck-2026-11-04/gap-card.png | Bin 0 -> 11205 bytes
 .../final/recheck-2026-11-04/home-portrait.png     | Bin 0 -> 76672 bytes
 docs/evidence/final/recheck-2026-11-04/home.png    | Bin 0 -> 107295 bytes
 .../recheck-2026-11-04/incomplete-controlled.png   | Bin 0 -> 175760 bytes
 docs/evidence/final/recheck-2026-11-04/lint.log    |   3 +
 .../final/recheck-2026-11-04/not-found.png         | Bin 0 -> 48518 bytes
 .../recheck-2026-11-04/recovered-controlled.png    | Bin 0 -> 191883 bytes
 .../final/recheck-2026-11-04/release-quality.json  |  34 ++
 .../final/recheck-2026-11-04/renderer-spike.png    | Bin 0 -> 75520 bytes
 .../evidence/final/recheck-2026-11-04/shared-a.png | Bin 0 -> 102399 bytes
 .../evidence/final/recheck-2026-11-04/shared-b.png | Bin 0 -> 107446 bytes
 .../final/recheck-2026-11-04/signing-source.png    | Bin 0 -> 100789 bytes
 docs/evidence/final/recheck-2026-11-04/smoke.json  | 100 ++++++
 docs/evidence/final/recheck-2026-11-04/spend.json  |  22 ++
 .../recheck-2026-11-04/submission-validation.json  |  75 ++++
 .../final/recheck-2026-11-04/typecheck.log         |   9 +
 docs/evidence/final/recheck-2026-11-04/unit.log    |   5 +
 .../final/recheck-2026-11-04/unsupported.png       | Bin 0 -> 178959 bytes
 .../final/recheck-2026-11-04/vitest-results.json   |   1 +
 docs/phase-reports/phase-8-recheck-2026-11-04.md   | 101 ++++++
 scripts/audit-submission-claims.mjs                |   7 +-
 scripts/export-submission-deck.py                  |  11 +-
 scripts/final-smoke.ts                             |   5 +-
 submission/HANDOFF.md                              |   2 +
 submission/deck.md                                 |  10 +-
 submission/deck.pdf                                | Bin 160574 -> 160588 bytes
 submission/demo-video-script.md                    |   2 +-
 submission/devpost.md                              |   4 +-
 40 files changed, 847 insertions(+), 16 deletions(-)
```
