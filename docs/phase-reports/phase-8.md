## Status
COMPLETE — Phase 8 submission package and final production smoke pass; official sticker blocker resolved.

## Checks

| Command | Exit code | Pass / fail / skip counts |
|---|---|---|
| `npm run typecheck` / `npm run lint` | 0 / 0 | 1 / 0 / 0 each |
| `npm test` | 0 | 194 / 0 / 0; includes binary credential detection and unchanged text restrictions |
| `SIGNBRIDGE_EVIDENCE_PHASE=8 npm run test:e2e` | 0 | 2 / 0 / 0; Chromium/Edge; build registers 21 steps, including 4 application steps |
| `npx tsx scripts/final-smoke.ts --live` | 0 | 8 route/layout captures; health, saved replay, gap and controlled retry pass; 0 model calls |
| Python deck export / `pdftoppm` / visual review | 0 / 0 | 5 / 0 / 0 pages; structural and full-page visual checks pass |
| Claims grep / manual review | 0 | 21 files; 20 justified hits; 0 unresolved; supplemental lib/app TS/JS grep has no hits |
| `npm run check:secrets` / actual-value scan / staged diff check | 0 each | No credentials or whitespace errors; immutable design hash unchanged |

## Acceptance tests

| T-ID | PASS / FAIL / NOT RUN | Test file path | Evidence or reason |
|---|---|---|---|
| P8-DECK | PASS | scripts/export-submission-deck.py; submission/deck.pdf | Five slides with production captures, architecture, exactly three evidence categories, candid prior art and planned evaluation; all pages visually reviewed. |
| P8-TEXT | PASS | submission/devpost.md; README.md; submission/HANDOFF.md | Required draft sections, public app/demo links, local commands, attribution and traceable limits supplied. |
| P8-SCRIPT | PASS | submission/demo-video-script.md | English 2:45 target; fresh-run recording instructions, gap, controlled recovery, saved replay and limits; owner records optional video. |
| P8-SMOKE / T1 / T2 | PASS | scripts/final-smoke.ts; docs/evidence/final/smoke.json | Official sticker on all page families plus 404/portrait and both shares (8 captures); byte-identical original; health 200, A segment replay, B gap, same hash, zero new calls. |
| T22 controlled recovery | PASS | scripts/final-smoke.ts | Explicit browser-only dropped callback yields Incomplete; Retry completes. Real saved plan/animation unchanged; not a production incident. |
| P8-CLAIMS | PASS | scripts/audit-submission-claims.mjs; docs/evidence/final/claims-audit.json | Every grep hit reviewed below against §0.3/H.3; no positive language-quality or comprehension claim. |
| H.2 physical devices | NOT RUN | docs/MOBILE-TEST.md | No physical Android/iPhone observation; portrait screenshot is a desktop layout check. |

Claims audit (all 20 occurrences; line excerpts and file hashes in final/claims-audit.json):

| Copy file | Hits / term | Justification |
|---|---|---|
| README.md | 1 / correct | Linguistic correctness explicitly None. |
| app/about/page.tsx | 2 / correct | Rendering does not establish quality; linguistic evidence explicitly None. |
| app/components/Workspace.tsx | 3 / correct | Controls describe editing source captions, not signing quality. |
| app/layout.tsx | 1 / correct | Metadata explicitly denies quality/comprehension evidence. |
| app/page.tsx | 1 / correct | Renderability does not establish quality/comprehension. |
| app/renderer-spike/page.tsx | 1 / translat | Explicitly denies treating fixture as a translation. |
| docs/ATTRIBUTION.md | 2 / correct | Corpus rendering/reuse does not confer BdSL quality or comprehension. |
| docs/LIMITATIONS.md | 4 / correct, translat | None/negative quality statements; source-caption editing; fixture is not a translation. |
| submission/HANDOFF.md | 1 / correct | Quality and comprehension have no evidence. |
| submission/deck.md | 1 / correct | Exact evidence category, explicitly None. |
| submission/demo-video-script.md | 1 / correct | Narration explicitly says linguistic evidence None. |
| submission/devpost.md | 2 / correct | Source-caption editing and linguistic evidence None. |
| All audited copy | 0 / accurate, understand, interpreter | No matches; no inference of positive capability. |

## Deviations
- 2026-11-04 · phase 8 · §H.6 / final sticker smoke · Resolve the inherited sticker blocker using the owner's newly supplied official organizer PNG and associated aspect-ratio/banner/test edits; retain the original image bytes · The owner explicitly confirmed in chat that public/event-sticker.png is the official organizer asset. No sticker was generated or imitated · docs/evidence/final/sticker-provenance.json records its SHA-256 and 2000×710 dimensions; final smoke requires the served bytes to match.
- 2026-11-04 · phase 8 · §H.6 / demo recovery evidence · Label a browser-only suppressed completion callback as a controlled fault and record incomplete/retry recovery from the real saved production track · A repeatable technical failure/recovery demonstration must not be misrepresented as a natural production incident or a newly processed clip · scripts/final-smoke.ts, final smoke metadata and explicitly named controlled-fault screenshots; no saved plan or motion is edited and no model processing is requested.
- 2026-11-04 · phase 8 · end-of-phase evidence / prior phase gates · Preserve a pre-existing sticker foundation rerun report under final evidence and restore the earlier phase's tracked artifact; route new foundation results to final/ with isolated local fake adapters · The shared checkout acquired the owner-supplied sticker edits and a default-path test report during submission preparation; earlier evidence must retain its historical meaning · docs/evidence/final/owner-foundation-results.json preserves the rerun bytes, playwright.config.ts isolates the new checks, and previous reports/tags remain unchanged.
- 2026-11-04 · phase 8 · end-of-phase checks / binary artifacts · Declare PDF/PNG binary for Git; retain strict marker scanning for text and scan binary bytes for credential-shaped tokens instead of treating compressed bytes as UTF-8 text · A rendered PNG contained the three-byte marker by chance, and Git reported PDF format whitespace as text errors. No credential was present; the separate exact-value scan covers every tracked byte and archived artifact · tests/unit/secretScanner.test.ts adds binary credential detection and text-baseline regressions; actual-value scan and final repository checks must pass.

## Risks / open questions

- No blocking questions for Phase 8. Optional video recording and actual Devpost submission remain owner actions; verify existing registration/student eligibility. HANDOFF.md cites the earlier 5 November 22:00 +06 deadline because official prose conflicts.
- Physical devices NOT RUN; linguistic correctness NONE; user comprehension NONE. UEA and WebGL remain runtime dependencies; controlled recovery captures are labelled test injections.
- Existing-credit usage USD 0.101634; USD 0 reserved; Phase 8 model calls 0. Approved ceiling USD 4; free infrastructure only; no purchases/upgrades/billing changes or Phase 8 environment changes.
- Phase 1–7 reports/tags retain historical findings. Owner supplied and attested the official sticker; original SHA-256 matches production. SYSTEM-DESIGN.md unchanged. Submission assets and all final captures are below.

## Files

`git diff --stat phase-7 phase-8`:

```text
 .gitattributes                                     |   2 +
 .vercelignore                                      |   1 +
 README.md                                          | 105 +++---
 app/EventSticker.tsx                               |   2 +-
 app/about/page.tsx                                 |   2 +-
 app/globals.css                                    |   2 +-
 docs/DEVIATIONS.md                                 |   4 +
 docs/LIMITATIONS.md                                |  16 +-
 docs/evidence/final/about.png                      | Bin 0 -> 235367 bytes
 docs/evidence/final/checks.json                    |  45 +++
 docs/evidence/final/claims-audit.json              | 386 +++++++++++++++++++++
 docs/evidence/final/creator.png                    | Bin 0 -> 100275 bytes
 docs/evidence/final/deck-slide-1.png               | Bin 0 -> 92096 bytes
 docs/evidence/final/deck-slide-2.png               | Bin 0 -> 145760 bytes
 docs/evidence/final/deck-slide-3.png               | Bin 0 -> 112401 bytes
 docs/evidence/final/deck-slide-4.png               | Bin 0 -> 132212 bytes
 docs/evidence/final/deck-slide-5.png               | Bin 0 -> 116400 bytes
 docs/evidence/final/deck-validation.json           |  20 ++
 docs/evidence/final/deployment-inputs.json         |   8 +
 docs/evidence/final/deployment.json                |   9 +
 .../evidence/final/foundation-browser-results.json | 275 +++++++++++++++
 docs/evidence/final/gap-card.png                   | Bin 0 -> 11205 bytes
 docs/evidence/final/home-portrait.png              | Bin 0 -> 76672 bytes
 docs/evidence/final/home.png                       | Bin 0 -> 107295 bytes
 docs/evidence/final/incomplete-controlled.png      | Bin 0 -> 175760 bytes
 docs/evidence/final/not-found.png                  | Bin 0 -> 48518 bytes
 docs/evidence/final/owner-foundation-results.json  | 262 ++++++++++++++
 docs/evidence/final/recovered-controlled.png       | Bin 0 -> 117414 bytes
 docs/evidence/final/renderer-spike.png             | Bin 0 -> 75520 bytes
 docs/evidence/final/shared-a.png                   | Bin 0 -> 102399 bytes
 docs/evidence/final/shared-b.png                   | Bin 0 -> 107446 bytes
 docs/evidence/final/signing-source.png             | Bin 0 -> 100789 bytes
 docs/evidence/final/smoke.json                     | 100 ++++++
 docs/evidence/final/spend.json                     |  22 ++
 docs/evidence/final/sticker-provenance.json        |  10 +
 docs/evidence/final/unsupported.png                | Bin 0 -> 178959 bytes
 docs/evidence/final/vitest-results.json            |   1 +
 docs/phase-reports/phase-8.md                      | 116 +++++++
 playwright.config.ts                               |   4 +-
 public/event-sticker.png                           | Bin 0 -> 1118328 bytes
 scripts/audit-submission-claims.mjs                |  22 ++
 scripts/check-secrets.mjs                          |  12 +-
 scripts/export-submission-deck.py                  | 100 ++++++
 scripts/final-smoke.ts                             |  43 +++
 submission/HANDOFF.md                              |  11 +
 submission/deck.md                                 |  63 ++++
 submission/deck.pdf                                | Bin 0 -> 160574 bytes
 submission/demo-video-script.md                    |  17 +
 submission/devpost.md                              |  52 +++
 tests/e2e/foundation.spec.ts                       |   2 +-
 tests/unit/secretScanner.test.ts                   |  15 +-
 51 files changed, 1650 insertions(+), 79 deletions(-)
```
