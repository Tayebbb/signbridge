# SignBridge design review — 3 November 2026

## Decision

**Keep the proposed stack and product scope, but correct the contracts below before implementing them literally.** A single region is a reasonable deadline trade-off. The more immediate risks are incorrect cache reuse, cancelled jobs publishing, stale renderer callbacks, and reporting incomplete signing as completed.

The document's **7/8 → 9/10** is a checklist-coverage score. It is not evidence that its SQL, playback algorithm, spending limits, or translation work. There is no deployed application, API-backed pipeline, linguistic validation, or comprehension evidence from this review.

Reviewed source: [SYSTEM-DESIGN.md](SYSTEM-DESIGN.md), 1,469 lines. Its contents were left unchanged. SHA-256: `63085c54cd774ecce098f2ae1c98d8ddc2c1d2319a1d350fc88fb19ec8ff37aa`.

Evidence labels here: **Executed** means an isolated local probe actually ran; **Static finding** means a counterexample to the proposed contracts, not an executed production failure; **Docs verified** means current primary documentation was checked.

## Experiments completed

### Cross-file SiGML: motion plays; identifiers need a correction

**Executed:** joined real licensed corpus units from different files into four synthetic sequences. These are unrelated dictionary entries used to exercise the renderer, not translated BdSL sentences. Cases contain 3+1+1, 1+3+1, 2+3, and three repetitions of a 1-unit asset.

All four initial runs loaded the expected units, progressed through frames, and completed. However, CWASA returned **lowercase gloss IDs**: input `g1_S0A0U0` became `g1_s0a0u0`. All four failed exact identifier matching. This is a concrete problem with the design's uppercase `S/A/U` convention in §E.3 and T3.

**Executed correction:** reran all four using lowercase canonical IDs throughout. **4/4 passed** exact identifier matching, unit counts, nonzero frames, and completion. Frame counts were 164, 164, 149, and 202 respectively. The renderer also repeated the final sign label: five units produced six raw sign events, and three units produced four. T3 must compare ordered distinct expected unit IDs and completion, rather than require exactly one raw callback per unit.

The first `avatarsign` arrived at frame 0. Seeing a unit's identifier is therefore not proof that it has finished. Asset-boundary resume logic must not treat a sign-start event as completion.

Environment: one Windows host, isolated headless Edge, software WebGL, unmodified remote UEA CWASA vhg2026, Anna avatar. No browser page errors were recorded. These tests do not establish natural transitions, correct handshapes, grammar, comprehension, or mobile support.

- [Probe script](../research/2026-11-03-signbridge/system-design-review/review-probes.cjs)
- [Initial results, including ID mismatch](../research/2026-11-03-signbridge/system-design-review/probe-results.json)
- [Lowercase rerun results and provenance](../research/2026-11-03-signbridge/system-design-review/probe-results-lowercase.json)

### Mermaid: two original diagrams fail; corrected copies render

**Executed:** rendered all four Mermaid blocks using Mermaid's documented browser module route. The component and state diagrams rendered. Both sequence diagrams failed because semicolons in message text were interpreted as statement separators.

Replacing those literal semicolons with commas in separate copies produced **4/4 successful renders**. No original diagram or design text was overwritten. Rendering establishes syntax/layout generation; the sequence diagrams still need the behavioral fixes below. [Mermaid usage documentation](https://mermaid.js.org/config/usage.html).

Corrected sequence sources and rendered copies:

- [Fresh-processing sequence: Mermaid](../research/2026-11-03-signbridge/system-design-review/corrected-diagram-2.mmd), [SVG](../research/2026-11-03-signbridge/system-design-review/corrected-diagram-2.svg).
- [Edit-race sequence: Mermaid](../research/2026-11-03-signbridge/system-design-review/corrected-diagram-3.mmd), [SVG](../research/2026-11-03-signbridge/system-design-review/corrected-diagram-3.svg).
- [All corrected rendering results](../research/2026-11-03-signbridge/system-design-review/probe-results-diagram-fixes.json).

## Corrections required before implementation

### 1. Preserve source meaning in cache keys — P1

**Static finding; §D.4, §F.2, lines 888 and 1153.** `segmentKey` hashes `normalizedText`, defined as a retrieval form that removes punctuation and strips suffixes including `-নি`. A statement and question such as `তুমি আসবে।` and `তুমি আসবে?` can share a key even though Stage M receives different source text and must identify different clause types. Stripping negation is an additional risk. Exact-phrase matching must not use this lossy form either.

**Fix:** hash the exact model-visible source and context after conservative Unicode normalization. Preserve question punctuation, negation, quantities, and semantic distinctions. Use separate stem/alias forms only for candidate retrieval. Version normalization explicitly. Add positive/negative, statement/question, and number-change cache counterexamples.

Cached outputs also contain `segmentIdx`, although the key omits position. Repeated content or a merge/split can reuse an output containing an old index. Either make cached semantic results position-independent and bind positions afterward, or include every position-dependent input in the key.

### 2. Fence publication by the active job, not just transcript version — P1

**Static finding; §F.4–F.7, lines 1193–1236.** The project-pointer `UPDATE` checks transcript version and project status but not `cancel_requested`, job status, or the active processing generation. A cancelled job for the still-current transcript can therefore publish. A retry of the same transcript can race another job using a different model/profile. The later `UPDATE jobs ... WHERE status='running'` does not undo the project-pointer write.

**Fix:** add an active job ID or monotonic processing epoch to the project, separate from transcript version. Serialize cancel/start/retry/publish on the same project row. Publication must atomically verify project active, current transcript, active job/epoch, and job not cancelled. Cancellation must invalidate publication authority even when no transcript edit occurs.

Acceptance cases: cancellation immediately before publication; two jobs for one transcript; older retry finishing last; duplicate delivery after cancellation; deletion during publication. The existing v1-versus-v2 test alone is insufficient.

### 3. Keep manifest identity and mutable response data separate — P1

**Static finding; §C.4, §F.2/F.4, §G.1.** The unique fingerprint omits bindings that appear inside the immutable manifest, including transcript version ID, media identity, and source-confirmation state. An A→B→A transcript history can collide with the old fingerprint and return a track bound to the earlier transcript version. The same problem can occur when source confirmation changes. The SQL also does not explicitly insert the preallocated `trackVersionId` required inside the manifest.

**Fix:** define immutable artifact identity completely; allocate and explicitly insert its ID. Ensure deduplication cannot return a manifest with different source/provenance bindings. Choose whether source confirmation is versioned into the artifact or returned separately. Define reattachment against a stable media identity/content binding, rather than leaving the manifest pointing to an expired media row.

The current-track endpoint is mutable, yet the document describes a one-year `immutable` cache header. Use `no-store` or explicit revalidation for current pointers, permissions, review overlays, and temporary media URLs. Only an explicitly version-addressed immutable artifact should receive an immutable caching policy, with an intentional privacy/retention policy. Do not bundle expiring media links into that immutable response.

### 4. Correct renderer identifier and callback ownership contracts — P1

**Executed + static finding; §E.3/E.5, line 1112.** Use the tested lowercase IDs and tolerate the terminal duplicate. More fundamentally, stamping an unscoped callback with `activeGen` when it arrives does not prove which playback produced it. A late old `animidle` arriving after the new playback starts will be stamped with the new generation. Waiting 600 ms does not establish that no later callbacks exist.

**Fix:** choose and test a real ownership barrier: a verified engine stop acknowledgement and serialized execution, or isolated renderer instances across cancellation boundaries. Request-identifiable gloss progress can corroborate ownership; arbitrary delays cannot guarantee it. Fake-engine tests must emit actual unscoped `sigmlloaded`/`animidle` payloads, rather than inject a generation identity the real engine lacks.

For the deadline, restarting the whole signed segment after pause is a simpler honest behavior than claiming precisely completed asset boundaries before those are established.

### 5. Fail visibly on incomplete playback and honor blocking gaps — P1

**Static finding; §E.5/E.7, lines 1089 and 1123.** A watchdog calls `afterSigning`, which emits `played_ok` and advances. Unit mismatches also permit advance. A timeout is failure/uncertainty evidence, not evidence that the message finished.

**Fix:** stop, hold the source, enter a recoverable failure state, and offer Retry or explicit Skip. Keep skipped/failed separate from played-to-completion. Require validated completion conditions before success telemetry.

The prose places gap cards within the signing timeline, but the pseudocode concatenates all asset motion and displays all gaps afterward. A critical missing negation can therefore be revealed only after an affirmative-looking fragment plays. For P0, show a blocking gap before any partial signing and hold automatic progression; alternatively execute actual timeline chunks with gaps at their specified positions. Do not claim the current one-call pseudocode does this.

### 6. Close the database-to-workflow dispatch gap — P1

**Static finding; §F.3, line 1187.** The transaction commits a job before `start(buildTrack)` is called. A crash between those operations leaves a committed job with no workflow. Workflow durability only protects runs that were actually started. [Vercel documents resumable runs and retried steps](https://vercel.com/docs/workflows); that is not an atomic transaction with Neon.

**Fix:** specify recoverable dispatch, for example an outbox/pending-dispatch state plus an idempotent reconciler. Explain duplicate-start handling and what triggers reconciliation while the browser is closed. Test a crash immediately after DB commit and another after workflow start but before saving its run ID.

If the emergency browser-driven driver remains, its limitation is already disclosed, but its 60-second lease is shorter than a permitted 90-second call. Extend/renew it and fence stage ownership, or cut that second driver and focus on making the primary driver reliable.

### 7. Make the spend ceiling enforceable — P1

**Docs verified + static finding; §A.5/A2, §F.5/F.7.** Current official prices support the stated basic arithmetic: Sol $2 input/$10 output and Terra $1/$5 per million tokens. The estimate is approximately $0.576 per eight-segment clip including the assumed 25% overhead, not a measured bill. [Sol model documentation](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [Terra model documentation](https://developers.openai.com/api/docs/models/gpt-6.1-terra).

If $30 is the total budget, $5/day over a 14-day window still permits $70. Switching models at 80% does not impose a lifetime cap. Reserving an average estimate can also allow actual cost above the advertised cap. A crash after stage-result insertion but before settlement can leave an orphan reservation; a retry taking the cache-hit path does not resolve it.

**Fix:** atomic lifetime and daily budgets; identifiable per-attempt reservations; conservative request upper bounds; settlement/reconciliation on success, retry, timeout, cancellation, and crash. Retain an appropriate reservation where provider billing is uncertain. Bound SDK and workflow retry multiplication. OpenAI documents that `max_output_tokens` includes reasoning and that incomplete responses can still incur usage. [Official reasoning guide](https://developers.openai.com/api/docs/guides/reasoning).

### 8. Make storage admission and deletion match the stated limits — P1

**Docs verified + static finding; §A.5, §G.3/G.4.** Vercel documents Hobby Blob limits and loss of access when exceeded; the warning is real. Presigned private GET/PUT paths also exist. This review did not have a Blob store and did not test Range requests or video seeking. [Blob pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing), [signed URLs](https://vercel.com/docs/vercel-blob/vercel-signed-urls).

**Fix:** atomically reserve allowed upload bytes before issuing a token, counting pending uploads and anchors. Reconcile abandoned uploads; release reservations only after confirmation/expiry. Checking current live bytes alone races concurrent uploads. Specify the actual scheduled cleanup that enforces 72-hour retention. Direct signed media delivery also consumes transfer/operation allowances; a live-storage gate alone does not control them. Keep demo media available throughout judging.

### 9. Repair schema/deletion and data-lifecycle inconsistencies — P2

**Static finding; §C.2, §F.6.** The DDL has foreign keys without the `ON DELETE CASCADE` behavior promised in deletion prose, plus circular project→current-track/transcript pointers. Hard-deleting a row and then setting that row to `deleted` are different strategies. Global stage cache rows also hold derived caption content; hashing their keys does not make their contents non-personal.

**Fix:** choose soft deletion/tombstones plus an idempotent purge, or define the exact hard-delete order and constraints. Specify related stage-cache deletion/retention. Do not state that no personal data is sent merely because captions are creator-provided. Preserve the distinction between bounded public-demo functionality and an implemented deletion guarantee.

### 10. Correct the claimed third-party-script boundary — P2

**Static finding; §B.1/G.4.** A UEA script loaded into the app page executes with that page's origin. An httpOnly cookie prevents reading its value, but same-origin script can still initiate authenticated requests. A dedicated route and host-allowlisting CSP do not isolate it from owner authority.

**Fix:** either explicitly accept UEA as trusted same-origin executable code for this prototype, or use an actually isolated renderer origin/sandbox with a minimal validated message contract. Verify engine/CORS behavior in the chosen isolation; do not invent a tested isolation guarantee.

## Recommended next step

Keep Next.js + Neon + private Blob + one durable workflow driver. Keep supplied captions, experimental labeling, immutable saved signing data, and explicit unsupported states. Defer replicas and automatic provider failover.

First revise the contracts above, then build the smallest deployed path: **one owned clip + captions → fresh supported plan → source-hold/sign playback → saved replay without model calls**. Add edits only once callback ownership, publication fencing, and budgets are testable. Run private-Blob seek/expiry tests on the actual deployed store and mobile tests on actual phones before claiming them.

Copyable handoff to Claude:

> Read SYSTEM-DESIGN.md and SYSTEM-DESIGN-REVIEW.md. Revise the design in place, retaining evidence labels and the chosen small stack. Resolve findings 1–8 explicitly; fix or clearly defer 9–10 with honest guarantees. Use the new lowercase-ID and cross-file probe evidence, and the separately rendered Mermaid corrections. Add acceptance cases for same-version cancellation/retries, lossy-normalization collisions, mutable endpoint caching, dispatch crashes, and spend-reservation settlement. Do not count a watchdog as completed signing or attach current generations to unscoped old events as proof of ownership. Keep the original linguistic/comprehension limitations. Return a concise change log and a concrete first implementation slice; do not add scale infrastructure to improve the checklist score.
