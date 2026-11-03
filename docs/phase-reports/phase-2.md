## Status
COMPLETE

## Checks
| Command | Exit code | Pass / fail / skip counts |
|---|---|---|
| `npm run typecheck` | 0 | 1 / 0 / 0 |
| `npm run lint` | 0 | 1 / 0 / 0; no warnings |
| `npm test -- --reporter=default --reporter=json --outputFile=docs/evidence/phase-2/vitest-results.json` | 0 | 99 / 0 / 0; 15 files |
| `npm run check:secrets` | 0 | 1 / 0 / 0; existing exact nonsecret-line exceptions only |
| `node scripts/download-corpus.mjs` | 0 | 3108 / 0 / 0 distinct hashes verified; all 3990 public file entries accounted for |
| `npm run corpus:import -- --checks docs/evidence/phase-2/asset-render-checks.json` | 0 | 1 / 0 / 0; 2934 accepted, 174 explicitly quarantined |
| `npm run corpus:probe` | 0 | 20 / 0 / 0; headless Edge, remote unmodified CWASA, software WebGL |

## Acceptance tests
| T-ID | PASS / FAIL / NOT RUN | Test file path | Evidence or reason |
|---|---|---|---|
| T4 | PASS | [validationManifest.test.ts](E:/AIgnite-Lab/signbridge/tests/unit/validationManifest.test.ts) | Fully supported fixture becomes ready, without gap cards; embedded units/ranges and source bindings verified. |
| T5 | PASS | [validationManifest.test.ts](E:/AIgnite-Lab/signbridge/tests/unit/validationManifest.test.ts) | Unsupported negation, number and noun block; gap card precedes signing, captions stay visible, ready count excludes it; M3 catches forgotten negation. |
| T11 | PASS | [structuredOutputs.test.ts](E:/AIgnite-Lab/signbridge/tests/contract/structuredOutputs.test.ts) | All generated schemas satisfy offline strict-shape/budget checks; dynamic candidate enum capped at 150; no live API claim. |
| T12 (parser/XML) | PASS | [captions.test.ts](E:/AIgnite-Lab/signbridge/tests/unit/captions.test.ts), [retrievalSigml.test.ts](E:/AIgnite-Lab/signbridge/tests/unit/retrievalSigml.test.ts) | Script markup stays literal; 10 MB/1000 cues rejected with codes; DOCTYPE/unsafe XML rejected. Owner/share route tests are outside Phase 2. |
| T14 (20 samples) | PASS | [corpus.test.ts](E:/AIgnite-Lab/signbridge/tests/contract/corpus.test.ts) | 20/20 distinct samples render with matching ordered IDs and unit counts; only matching successful evidence makes assets eligible. |
| T15 | PASS | [fingerprints.test.ts](E:/AIgnite-Lab/signbridge/tests/unit/fingerprints.test.ts), [retrievalSigml.test.ts](E:/AIgnite-Lab/signbridge/tests/unit/retrievalSigml.test.ts) | All three source/phrase pairs and previous/next neighbours remain distinct; statements never exact-match question assets. |
| P2-CORPUS | PASS | [corpus.test.ts](E:/AIgnite-Lab/signbridge/tests/contract/corpus.test.ts) | 3990 files/3108 hashes produce 2934 assets, 5908 aliases and 5037 units; 174 hashes quarantined; real seed applied twice to empty PGlite. |
| P2-PURE | PASS | [textFormsSegmentation.test.ts](E:/AIgnite-Lab/signbridge/tests/unit/textFormsSegmentation.test.ts), [ownership.test.ts](E:/AIgnite-Lab/signbridge/tests/unit/ownership.test.ts) | Deterministic text forms, cue bounds and context; domain/contracts barred from filesystem, network, environment and adapter access. |
| P2-SIGML | PASS | [retrievalSigml.test.ts](E:/AIgnite-Lab/signbridge/tests/unit/retrievalSigml.test.ts) | Motion bytes preserved apart from gloss values; lowercase generation IDs, multi-unit ranges and byte hashes verified. |

## Deviations
- 2026-11-03 · phase 2 · §D.4 / §G.4 · Import 2,934 assets from 3,108 verified distinct hashes rather than admitting every distinct hash; quarantine 174 hashes (245 file paths) with reasons · The full public release contains 131 hashes with nonmanual elements outside the mandated whitelist and 43 other structural/ASCII failures; the whitelist is not widened and motion is not repaired · `docs/evidence/phase-2/download.json`, `docs/evidence/phase-2/import.json`, `tests/contract/corpus.test.ts`; parser fast-xml-parser 5.11.2, https://github.com/NaturalIntelligence/fast-xml-parser ; public release https://data.mendeley.com/datasets/6ykgx65ks5/2 .
- 2026-11-03 · phase 2 · §C.3 (Structured Outputs limits) · Validate the current 120,000-character aggregate schema-string limit; retain the 1,000-enum, 10-level and 150-candidate caps and the 15,000-character single-enum rule when over 250 values · The current official docs distinguish aggregate string size from the older design's 15,000-character shorthand; generated schemas remain below both budgets · Zod 4.6.7, `tests/contract/structuredOutputs.test.ts`, https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses .

## Risks / open questions
- Technical rendering only; no BdSL correctness, qualified review or comprehension claim. Only 20 assets are eligible; curated-subset probing remains Phase 7.
- Fixed whitelist excludes 131 hashes with nonmanual elements; 43 additional hashes fail other checks. No widening, annotation stripping or silent repair was performed.
- Bangla detectors/stemming are coarse and may conservatively block ambiguous words/suffixes. They cannot establish signing semantics.
- No model call, secret use, Vercel environment setting, route, scheduler, AI-client or application-transaction work occurred. Phase 1's missing official sticker and logged-out deployment remain outside this phase.
- Specification unchanged: SHA-256 `ad91e87cde437b3cd430ef7102d51d9c7e7093875d68faf24369330aba307e4d`. Raw downloads stay in ignored `.data`; derived licensed assets, attribution, seed and evidence are committed.

## Files
Output of `git diff --stat phase-1 phase-2`:

```text
 README.md                                      |     17 +-
 data/corpus/assets.json                        | 140303 ++++++++++++++++++++++
 data/corpus/sample-probe.json                  |    142 +
 data/corpus/seed.sql                           |   8843 ++
 docs/ATTRIBUTION.md                            |      4 +
 docs/DEVIATIONS.md                             |      2 +
 docs/LIMITATIONS.md                            |      6 +-
 docs/evidence/phase-2/asset-render-checks.json |    434 +
 docs/evidence/phase-2/corpus-1.png             |    Bin 0 -> 90325 bytes
 docs/evidence/phase-2/corpus-20.png            |    Bin 0 -> 89108 bytes
 docs/evidence/phase-2/download.json            |      7 +
 docs/evidence/phase-2/import.json              |   1300 +
 docs/evidence/phase-2/notes.md                 |     26 +
 docs/evidence/phase-2/vitest-results.json      |      1 +
 docs/phase-reports/phase-2.md                  |     95 +
 eslint.config.mjs                              |      9 +
 lib/contracts/api.ts                           |      7 +-
 lib/contracts/common.ts                        |      6 +
 lib/contracts/jsonSchema.ts                    |     11 +
 lib/contracts/manifest.ts                      |     30 +-
 lib/contracts/meaning.ts                       |     17 +-
 lib/contracts/plan.ts                          |     16 +-
 lib/contracts/progress.ts                      |     10 +-
 lib/domain/captions/parsePasted.ts             |     17 +-
 lib/domain/captions/parseSrt.ts                |      4 +-
 lib/domain/captions/parseVtt.ts                |      4 +-
 lib/domain/captions/shared.ts                  |     52 +
 lib/domain/captions/textForms.ts               |     21 +-
 lib/domain/detectors.ts                        |     14 +
 lib/domain/fingerprints.ts                     |     39 +-
 lib/domain/manifest.ts                         |     35 +-
 lib/domain/retrieval.ts                        |     38 +-
 lib/domain/segmentation.ts                     |     23 +-
 lib/domain/sigml.ts                            |     51 +
 lib/domain/sigmlBuilder.ts                     |     27 +-
 lib/domain/validators.ts                       |     83 +-
 package-lock.json                              |    121 +
 package.json                                   |      6 +-
 scripts/corpus-import.ts                       |     73 +-
 scripts/corpus-render-probe.cjs                |     59 +-
 scripts/download-corpus.mjs                    |     33 +
 tests/contract/corpus.test.ts                  |     51 +
 tests/contract/structuredOutputs.test.ts       |     44 +
 tests/fixtures/corpus-samples.json             |    234 +
 tests/fixtures/domain.ts                       |     18 +
 tests/unit/captions.test.ts                    |     47 +
 tests/unit/fingerprints.test.ts                |     45 +
 tests/unit/ownership.test.ts                   |      8 +
 tests/unit/retrievalSigml.test.ts              |     43 +
 tests/unit/textFormsSegmentation.test.ts       |     36 +
 tests/unit/validationManifest.test.ts          |    100 +
 51 files changed, 152575 insertions(+), 37 deletions(-)
```
