# Phase 6 revalidation — 4 November 2026, Asia/Dhaka

Requested again after the Phase 8 completion commit 3b0813165c80a20a920247ac10eebf7e3da1a982. The original phase-6 tag (093afbf) and report remain historical records. This run validates the current app, adds no product capability, and does not move an existing tag.

- Current checks: 194 default tests, 51 real PostgreSQL tests, 16 product/browser tests and 4 foundation/renderer tests, all passing with no skips. The default suite includes every existing earlier automated T-ID; native tests use a disposable loopback PostgreSQL cluster.
- Local jobs explicitly use fake fixtures, PGlite and filesystem storage. OPENAI_API_KEY is empty. No real model processing, Vercel setting change, deployment or account change is requested.
- T2: owner/shared reload preserves manifest identity and stage-attempt/budget counts. T12: registered foreign owners and valid share capabilities cannot mutate another project; hostile captions remain literal; CSP is checked.
- T10: UEA blocking/unblocking, disabled WebGL and controlled API throttling retain readable captions/gaps and recover through Retry; failure telemetry is asserted. This is desktop fault injection, not evidence of a real mobile network or language quality.
- T6: editing stops obsolete signing before the held server response; regeneration publishes a replacement hash; CAS conflict keeps the draft and reload/regenerate recovers.
- T18/T24: revocation beats cached access; deleting returns 202, hides reads, and purges after upload-lease grace while preserving budget history.
- Renderer regression: real unmodified remote CWASA plays the cross-file fixture on Chromium and Edge. Separate opaque-origin tests check hooks, CSP and absence of the owner cookie. Technical rendering only.
- Bounded visual review: corrected/stale and WebGL-failure desktop screenshots plus the 390px portrait layout were inspected. Captions, gaps, warnings and the official sticker are readable; portrait remains a layout observation, not physical-device evidence.
- P0-1 through P0-10 are DONE on the current build. P0-3 real-provider deployment evidence is inherited unchanged from Phase 7. P0-9 was resolved in Phase 8 by the owner-supplied official sticker and public deployment; current public GET checks confirm home/About/health 200 and byte-identical official PNG. Local foundation checks require its visibility on all tested page families.
- O1 anchors, O2 pace presets, O3 simultaneous mode, O4 embeddings and O5 ASR remain CUT to preserve P0 scope. No lease fallback is claimed.
- Physical Android/iPhone tests remain NOT RUN. Linguistic correctness NONE; user comprehension NONE. No user study or signer review occurred.
- Existing hard-coded test output paths were snapshotted first. New results were captured here, and historical phase-3/phase-6 bytes were restored exactly; preservation.json lists hashes and paths. Tests were not weakened or skipped.
- Official CWASA release checked before real renderer use: https://vhg.cmp.uea.ac.uk/tech/jas/vhg2026/ (vhg2026). No API assumption changed. The original phase-6 design/specification remains unedited.
