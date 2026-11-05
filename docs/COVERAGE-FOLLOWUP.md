# Coverage and submission follow-up — 5 November 2026

**Status: PARTIAL — technical coverage improved; ordinary-video signing still has critical gaps. The engineering release is live and verified; the submission publication state is recorded below.**

The live services are real. This report does not certify general BdSL translation, language correctness or comprehension. The [initial normal-video failure](NORMAL-VIDEO-TEST.md) remains part of the evidence.

## Normal-video comparison

The same 28.763-second Wikitongues Bengali interview and the same eight published caption cues were used again. No caption wording was simplified, no plan was hand-edited and no source speech was replaced with isolated words. The clip/caption adaptation remains CC BY-SA 4.0, credited to Wikitongues / Hardeep Singh. [Source and original attribution](evidence/normal-video-2026-11-05/source.json).

| Observation | Initial release | Follow-up |
|---|---|---|
| Segments | 4 | 4 |
| Generated signing units | 0 | 9: 1 / 1 / 2 / 5 |
| Segment states | 4 `no_signing` | 4 `partial_blocked` |
| Available units actually played | None available | All 9, in exact expected order |
| Fully signed segments | 0 | 0 |
| Critical gaps visible / captions retained | Yes | Yes |
| Saved reload preserves manifest | Yes | Yes |
| New stage-attempt rows | 12 | 10 |
| New counted model cost | USD 0.131478 | USD 0.102916 |
| Outstanding reservations | 0 | 0 |

[Follow-up result and playback observations](evidence/coverage-2026-11-05/normal-video/result.json). The result is a real Workflow/OpenAI artifact, model `gpt-6.1-sol`, meaning prompt `meaning-v2`, plan prompt `plan-v1`, validator `validator-v2`. Generation and playback were checked on staged production configuration before promotion. Repeating playback/checkpoint recovery requested no new model job.

The completion counter stayed zero after all available signs played. Missing pronouns, names, quantities, context and other meaning still prevent complete coverage. Nine units are a technical observation, not nine correct translations or an accuracy score.

## Fixes and corpus evidence

- Numeric ranges such as `৭০-৮০` retain positive endpoints. Actual signed values such as `−২.৫` remain negative. Missing endpoints still trigger M3.
- Bounded whole-word exceptions prevent `পানি`, common pronouns and other explicitly covered words from fabricating a negative suffix. Genuine tested negative verbs still require negation. The detector remains coarse and is not a complete Bangla morphology system.
- Meaning prompt v2 clarifies exact current-segment surfaces, literal names, previous-context references and numeric endpoints. Validator and retrieval versions invalidate affected old stage caches. Old saved manifests keep their original provenance.
- Lexical filenames such as `বলি_Say` preserve their original provenance and gain the explicit Bangla label `বলি`. No hidden per-video synonym or motion edit was added. Sentence labels are preserved.
- All **2,934 accepted hashes** were rendered through unmodified remote CWASA / Anna / speed 0. **2,927 passed** exact loaded-unit, ordered-gloss and actual-frame checks. **Seven failed**, including on a separate single-worker recheck, and remain ineligible. The sweep/recheck correctly exit 1; no failing asset is represented as passing. The original **174 XML quarantines** remain excluded.

[Complete sweep](evidence/coverage-2026-11-05/asset-render-checks.json), [failed-asset rechecks](evidence/coverage-2026-11-05/failed-asset-rechecks.json), [motion/history preservation](evidence/coverage-2026-11-05/preservation.json).

Production and preview each now enable 2,927 hash-matched successful assets. Existing preview tracks (2) and production tracks (5) kept their hashes during the atomic seed. Budget ledgers were unchanged. The local default fixture keeps its historical 20-asset admission gate; broader production evidence is separate. [Production seed verification](evidence/coverage-2026-11-05/database-production.json).

## Database bottleneck

The expanded preview inventory exposed an all-motion fetch on every planning stage. Retrieval now reads metadata; publication hydrates only selected eligible XML, bounded to 480 unique IDs across 20 segments × 24 steps. Empty selections issue no hydration query. Contract tests retain identical retrieval fingerprints and exact selected motion bytes.

| Read | Serialized bytes | Observed time |
|---|---|---|
| Previous complete inventory, preview | 4,076,918 | 20,350 ms |
| Metadata, preview | 975,035 | 1,597 ms |
| 24 selected signs, preview | 39,366 | 277 ms |
| Metadata, production | 975,035 | 8,284 ms |
| 24 selected signs, production | 39,366 | 502 ms |

These are individual observations with differing network/cache conditions, not latency or capacity guarantees. [Before](evidence/coverage-2026-11-05/database-preview-before-optimization.json), [preview after](evidence/coverage-2026-11-05/database-preview-optimized.json), [production](evidence/coverage-2026-11-05/database-production.json).

## Release checks

| Check | Result |
|---|---|
| Typecheck / lint / production build | PASS |
| Default tests | 234 PASS, 0 fail/skip |
| Native PostgreSQL tests | 53 PASS, 0 fail/skip |
| Product browsers | 22 PASS: 11 Chromium + 11 Edge |
| Initial foundation checks | 6 PASS |
| First-load hydration regressions | 2 reproduced failures; fixed foundation suite passes 10 checks across Chromium/Edge |
| Production dependency audit (`--omit=dev`) | 0 vulnerabilities |
| Configured-credential / history / startup-bundle scan | No findings before publication |
| Original design | SHA-256 unchanged: `AD91E87CDE437B3CD430EF7102D51D9C7E7093875D68FAF24369330ABA307E4D` |
| Qualified language / comprehension evaluation | NOT RUN; evidence NONE |
| Physical Android/iPhone | NOT RUN |

Core source commit: `ff4379fd948b1c09ac2cde8f350058e0d1336efe`. [Its exact-SHA hosted gate passed](https://github.com/Tayebbb/signbridge/actions/runs/41994741758). First-load controls were subsequently found clickable before JavaScript attached, causing a native GET. Creation/recovery now remain disabled until hydration, retain the existing layout and use POST as fallback. The final UI source is `30f00979a73e7df9d58cd570c1e1ef99b31a1690`; [its exact-SHA hosted gate passed](https://github.com/Tayebbb/signbridge/actions/runs/42026962791). Production deployment `dpl_wSuGqYthumvLFBSTCyyWFr7kHrco` is promoted to the public app. Fresh staged/public uploads and saved playback passed with zero additional model calls or ledger changes. [Release attestation](evidence/hydration-2026-11-05/release/attestation.json). A replay-harness attempt initially used the old deployment's host-only cookie on a new origin; the corrected harness maps the same approved creator credential only to the same project's tested origin. This was a harness authorization error, not a widened application permission.

Combined counted usage after this real job is **USD 0.338618**, with zero outstanding reservations, below the approved USD 4 ceiling. No purchases, plan upgrades, billing changes or allowance increases were made.

The hosted run passed 234 default, 53 native PostgreSQL and 22 product-browser checks. Its foundation configuration selected five Chromium checks on Ubuntu; all five also passed in Edge locally, giving ten local foundation checks. [Hosted summary](evidence/hydration-2026-11-05/release/hosted-summary.json). Browser emulation is not physical-phone evidence.

The final toolchain follow-up removes all 12 moderate development-tree audit entries through two narrowly scoped transitive overrides. The complete dependency audit now reports **zero vulnerabilities**, and the actual Drizzle schema loader generates successfully into a disposable local directory without accessing a database. CI now gates the complete audit and checks that loader. Foundation configuration also detects the installed Linux Edge binary, so its next hosted gate includes both browsers. [Before](evidence/hydration-2026-11-05/release/full-audit-before.json), [after](evidence/hydration-2026-11-05/release/full-audit-after.json), [loader check](evidence/hydration-2026-11-05/release/schema-tooling.json). The subsequent exact-source hosted result and deployment are recorded separately after completion.

## Submission state

The existing Devpost draft has its name/pitch, current story, technology tags, live/repository links, owner-supplied five-page PDF, participant name and organizer contact saved: **4/5 steps done**. Contact details are not published in this repository. The voiced English MP4 is published as Unlisted at https://youtu.be/goRXOQeq9lQ and its link is saved in both Devpost video fields. Its older on-screen counts are explicitly described as an earlier evidence snapshot.

The owner explicitly confirmed event eligibility and approved both sites' required legal acknowledgments at the action point. Final submission follows the completed release checks. [Requirements](../submission/REQUIREMENTS.md), [video metadata](../submission/youtube.md).
