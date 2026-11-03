## Status
COMPLETE

## Checks
| Command | Exit code | Pass / fail / skip counts |
|---|---|---|
| `npm run typecheck` | 0 | 1 / 0 / 0 |
| `npm run lint` | 0 | 1 / 0 / 0; no warnings |
| `npm test` (JSON evidence) | 0 | 149 / 0 / 0; 99 prior tests and 50 state tests |
| `npm run test:race:native` (JSON evidence) | 0 | 50 / 0 / 0; disposable PostgreSQL 16.11, independent sessions |
| `npm run db:generate` | 0 | 1 / 0 / 0; no schema drift |
| `npm run db:migrate` | 0 | 1 / 0 / 0; local PGlite |
| `npm run check:secrets` | 0 | 1 / 0 / 0; exact existing nonsecret baseline |
| `git diff --cached --check` | 0 | 1 / 0 / 0 |

## Acceptance tests
| T-ID | PASS / FAIL / NOT RUN | Test file path | Evidence or reason |
|---|---|---|---|
| T13 (DB) | PASS | [suite.ts](E:/AIgnite-Lab/signbridge/tests/race/suite.ts) | One-cent cap rejects a 20,000-micro reservation with spend_cap; saved replay remains readable. |
| T16 | PASS | [suite.ts](E:/AIgnite-Lab/signbridge/tests/race/suite.ts) | 6 actions × 3 timings × 2 backends = 36 cases; exact epoch increment, old publisher fenced, at most one active job, duplicate winning publish stable. |
| T19 | PASS | [suite.ts](E:/AIgnite-Lab/signbridge/tests/race/suite.ts) | Commit/start and lost-ack crash windows recover; 12 duplicate claims have one winner; stopped heartbeat fenced; dispatch capped at five attempts. |
| T20 | PASS | [suite.ts](E:/AIgnite-Lab/signbridge/tests/race/suite.ts) | Five settlement modes; 30 concurrent boundary reservations admit exactly five; both budgets checked after every result; day rollover and 3+1 cap verified. |
| T21 | PASS | [suite.ts](E:/AIgnite-Lab/signbridge/tests/race/suite.ts) | 60 maximum-size admissions accept 50 under 800 MB; smaller finalize, abandonment, retention, pinned media, monthly transfer and anchors verified. |
| T24 | PASS | [suite.ts](E:/AIgnite-Lab/signbridge/tests/race/suite.ts) | Four purge interruption points, late uploads and concurrent shared-cache references; reruns release once, retain spend/shared content and hide deleting projects. |
| P3-LOCKS | PASS | [state.native.ts](E:/AIgnite-Lab/signbridge/tests/race/native/state.native.ts) | Seven explicit PostgreSQL Lock waiters observed; stale lease cannot reserve, settle, write or publish. PGlite serializes its single connection. |
| P3-SCHEMA | PASS | [schema.test.ts](E:/AIgnite-Lab/signbridge/tests/contract/schema.test.ts) | Independent catalog checks retain all original constraints and check additive ledger journals; 21 tables. |

## Deviations
- 2026-11-03 · phase 3 · §C.2 / §A.5 / §G.3 · Add `owner_daily_quotas`, `anchor_storage`, `storage_ledger.transfer_month` and `media.storage_charge` through additive migrations · The original schema cannot retain owner quota counts after project purge, represent anchor reservations, reset transfer monthly exactly once or durably distinguish released media charges; these journals are needed for the specified crash-safe ledgers · `0001_dear_lord_hawal.sql`, `0002_vengeful_mindworm.sql`, `tests/fixtures/phase-3-schema.sql`; catalog tests still compare every original constraint and independently check the additions; quota deletion/rollover, anchor accounting, monthly transfer and interrupted-purge races pass on PGlite and PostgreSQL 16.11.
- 2026-11-03 · phase 3 · §F.6 / §G.3 · Physical project purge and rejected-upload cleanup wait until issued upload leases plus the existing five-minute grace expire; logical deletion hides reads and revokes sharing immediately · Deleting objects or freeing their quota while a prior upload can still finish could leave an untracked late object; the deleting project and ledger remain durable until cleanup is safe · `purgeSnapshot`, `storageCleanupCandidates`, T24 late-upload and interruption cases; maximum ordinary upload reservation is 15 minutes, and reconciliation completes purge afterward.

## Risks / open questions
- Technical rendering evidence only; no BdSL correctness, qualified review or comprehension claims.
- The native harness requires local PostgreSQL binaries; it creates only a disposable loopback trust-authenticated cluster with synthetic data, no existing credentials. Production Neon remains untested.
- Physical cleanup waits for outstanding upload leases plus grace (normally at most 15 minutes); logical visibility and sharing are fenced immediately.
- Routes, OpenAI calls, production Blob, Workflows and UI are outside Phase 3. The official sticker and deployment remain unresolved from Phase 1.
- [Detailed matrices and primary sources](E:/AIgnite-Lab/signbridge/docs/evidence/phase-3/notes.md); machine results in the same directory. Specification SHA-256 remains ad91e87cde437b3cd430ef7102d51d9c7e7093875d68faf24369330aba307e4d.

## Files
Output of `git diff --stat phase-2 phase-3`:

```text
 .env.example                                  |    2 +
 README.md                                     |   14 +-
 docs/DEVIATIONS.md                            |    2 +
 docs/LIMITATIONS.md                           |    5 +-
 docs/evidence/phase-3/native-environment.json |    8 +
 docs/evidence/phase-3/native-results.json     |    1 +
 docs/evidence/phase-3/notes.md                |   33 +
 docs/evidence/phase-3/vitest-results.json     |    1 +
 docs/phase-reports/phase-3.md                 |   90 +
 lib/ai/spend.ts                               |   13 +-
 lib/db/client.ts                              |    7 +-
 lib/db/migrations/0001_dear_lord_hawal.sql    |   24 +
 lib/db/migrations/0002_vengeful_mindworm.sql  |    2 +
 lib/db/migrations/meta/0001_snapshot.json     | 2173 ++++++++++++++++++++++++
 lib/db/migrations/meta/0002_snapshot.json     | 2184 +++++++++++++++++++++++++
 lib/db/migrations/meta/_journal.json          |   14 +
 lib/db/queries/authority.ts                   |   86 +
 lib/db/queries/common.ts                      |   20 +
 lib/db/queries/dispatch.ts                    |   16 +-
 lib/db/queries/execution.ts                   |   30 +
 lib/db/queries/maintenance.ts                 |    3 +
 lib/db/queries/publish.ts                     |   24 +
 lib/db/queries/purge.ts                       |   24 +
 lib/db/queries/spend.ts                       |   56 +
 lib/db/queries/stages.ts                      |   20 +
 lib/db/queries/storage.ts                     |   70 +
 lib/db/schema.ts                              |   11 +-
 lib/db/session.ts                             |    7 +
 lib/domain/fingerprints.ts                    |    2 +
 lib/domain/limits.ts                          |   18 +
 lib/ops/purge.ts                              |   12 +
 lib/ops/reconcile.ts                          |   27 +-
 lib/ops/storage.ts                            |    9 +
 lib/storage/blob.ts                           |   11 +-
 package-lock.json                             |  180 +-
 package.json                                  |    5 +-
 tests/contract/dispatcher.test.ts             |    3 +-
 tests/contract/schema.test.ts                 |    5 +-
 tests/fixtures/phase-3-schema.sql             |   16 +
 tests/race/native/backend.ts                  |   17 +
 tests/race/native/setup.ts                    |   23 +
 tests/race/native/state.native.ts             |    3 +
 tests/race/state.test.ts                      |    3 +
 tests/race/suite.ts                           |  247 +++
 tests/race/support.ts                         |   40 +
 vitest.native.config.ts                       |    3 +
 46 files changed, 5537 insertions(+), 27 deletions(-)
```
