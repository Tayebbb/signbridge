# Phase 2 — Pure domain logic and corpus import

Read `AGENTS.md`, then `SYSTEM-DESIGN.md` §C.3, §C.4, §C.6, §D.1–D.7, §E.3, §F.1, §F.2a, §F.2b, §G.4 (caption parsing, SiGML handling), §H.1 rows T4, T5, T11, T12, T14, T15. Data reference: `E:\AIgnite-Lab\research\2026-11-03-signbridge\` (`data-audit.md`, `isharakotha-v2-public-file-manifest.json`, `isharakotha-samples\`, `canonical-id-derived.sigml`, `render-corpus-probe.cjs`).

## Goal
All pure, I/O-free logic in `lib/domain` + `lib/contracts`, fully unit-tested, plus a corpus import that seeds real assets.

## Build
1. `lib/contracts/*`: Zod schemas + TS types for `meaning-v2`, `plan-v2` (§C.3, no `segmentIdx`), `manifest-v2` and `CurrentTrackResponse` (§C.4), `JobProgress` (§C.5), API errors (§G.1). Export OpenAI-strict JSON Schemas generated from them. **T11**: a test asserts strict-mode constraints (all properties required, `additionalProperties:false`, no `allOf`/`if`/`oneOf` beyond what OpenAI allows, enum budget). Check the current OpenAI Structured Outputs docs for the exact list.
2. `lib/domain/captions/`: `parseSrt`, `parseVtt`, `parsePasted` — line-oriented, length-limited, no regex backtracking on unbounded input; limits ≤64 KB, ≤300 cues, last cue ≤90 s; errors report line/cue. `textForms.ts` implementing `sourceForm` / `phraseForm` / `retrievalForm` exactly as §F.2a, including its counterexample table.
3. `segmentation.ts` (`segmenter-v1`, §D.2), context window (§D.3).
4. `fingerprints.ts`: `canonicalJson` (§F.1) and every key in §F.2b (`s2`, `m2`, `c1`, `p2`, `t2`). **T15**: all counterexample pairs from H.1 (punctuation, negation, numbers, and as neighbours in the window) give distinct keys and distinct `phraseForm`; a statement never exact-matches a question asset.
5. `validators.ts` (M1–M3, P1–P5, Bangla negation/number/question detectors), `retrieval.ts` (§D.4), `sigmlBuilder.ts` (concatenation, lowercase generation-tagged gloss IDs, unit ranges, §E.3), `manifest.ts` (`buildManifest`, status derivation, gap cards, §C.4/§C.6/§D.7).
   - **T4/T5 (domain level)**: fixtures for a fully supported segment → `ready`; unsupported negation/number/noun → `partial_blocked` with a gap card ordered before signing; a mocked plan that "forgets" a negation is caught by M3.
6. `scripts/corpus-import.ts`: read IsharaKotha v2 (download from the public release referenced in the manifest JSON if network allows; otherwise use `isharakotha-samples\` and say so). XML parsing per §G.4: reject `<!DOCTYPE>`, no entity expansion, element whitelist, ASCII check after deriving lowercase ASCII glosses. Dedupe, derive `derived_sigml`, emit seed SQL/JSON + corpus manifest hash, keep attribution fields. Seed into PGlite in tests.
7. `scripts/corpus-render-probe.cjs` (evolved from the research probe): renders a list of assets headless and writes `asset_render_checks`. **T14**: run it on the 20 samples now (network required); curated-subset run happens in phase 7.
8. **T12 (parser part)**: `<script>` in SRT stays plain text, 10 MB caption and 1,000 cues rejected with the right codes, DOCTYPE SiGML rejected.

## Out of scope
DB transactions, routes, AI client, player.

## Done when
All listed tests green; corpus import runs on at least the 20 samples (full corpus if downloadable) with counts in the report; T14 sample result recorded. End-of-phase steps per `AGENTS.md`.
