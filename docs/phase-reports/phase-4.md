## Status
COMPLETE

## Checks
| Command | Exit code | Pass / fail / skip counts |
|---|---|---|
| `npm run typecheck` / `npm run lint` | 0 / 0 | 1 / 0 / 0 each; no lint warnings |
| `npm test` (JSON evidence) | 0 | 167 / 0 / 0; 18 files |
| `npm run test:race:native` | 0 | 50 / 0 / 0; disposable PostgreSQL 16.11 |
| `npm run build` | 0 | 1 / 0 / 0; Next 16.4.4, Workflow 5.3.0 compiles |
| `npm run db:migrate` / `npm run db:seed:local` | 0 / 0 | 1 / 0 / 0 each; local PGlite, 20 eligible assets |
| `npx tsx scripts/phase4-live-smoke.ts` | 0 | 1 / 0 / 0; dry run only |
| `npm run check:secrets` / `git diff --cached --check` | 0 / 0 | 1 / 0 / 0 each |

## Acceptance tests
| T-ID | PASS / FAIL / NOT RUN | Test file path | Evidence or reason |
|---|---|---|---|
| T4 / T5 (API) | PASS | [pipelineApi.test.ts](E:/AIgnite-Lab/signbridge/tests/contract/pipelineApi.test.ts) | Upload→draft→job→manifest; supported fixture ready, three critical-gap fixtures blocked. |
| T6 | PASS | [pipelineApi.test.ts](E:/AIgnite-Lab/signbridge/tests/contract/pipelineApi.test.ts) | Held old reply resumes after newer job publishes; old work is fenced and current identity stays unchanged. |
| T8 | PASS | [pipelineApi.test.ts](E:/AIgnite-Lab/signbridge/tests/contract/pipelineApi.test.ts) | Crash after reply/settlement before insert; two replays leave one stage pair, one track and one current artifact. |
| T13 (route) | PASS | [pipelineApi.test.ts](E:/AIgnite-Lab/signbridge/tests/contract/pipelineApi.test.ts) | One-cent remaining cap returns 402 spend_cap; saved manifest remains readable without model calls. |
| T17 | PASS | [pipelineApi.test.ts](E:/AIgnite-Lab/signbridge/tests/contract/pipelineApi.test.ts) | A→B→A tracks remain distinct, third uses cached stages; re-attach and source checks preserve manifestHash. |
| T18 (Phase 4 scope) | PASS | [pipelineApi.test.ts](E:/AIgnite-Lab/signbridge/tests/contract/pipelineApi.test.ts) | Strong ETag/private revalidation, Cookie variation, no-store pointer/media; foreign/deleting 404 precedes 304. Sharing is Phase 6. |
| P4-SDK / limits | PASS | [openaiTransport.test.ts](E:/AIgnite-Lab/signbridge/tests/contract/openaiTransport.test.ts) | Real SDK with mock fetch: one send, strict schema, no tools/store, AbortSignal, incomplete usage; API tests cover retries/limits. |
| Live smoke | NOT RUN | [phase4-live-smoke.ts](E:/AIgnite-Lab/signbridge/scripts/phase4-live-smoke.ts) | No key configured or use approved; two-segment script enforces USD 0.20 caps and records tokens/cost when authorized. |

## Deviations
- 2026-11-03 · phase 4 · §C.2 / §G.1 / §G.4 · Add `api_requests`, `rate_windows`, `ops_settings` and nullable transcript request identity columns through an additive migration · The specification requires durable create/edit idempotency, SQL rate limits and a database kill switch but C.2 has no persistence for them · `0003_salty_goliath.sql`, independent `tests/fixtures/phase-4-schema.sql`, API idempotency/CAS/rate/kill-switch tests and all original catalog constraints.
- 2026-11-03 · phase 4 · §G.3 · Re-init makes an older pending upload rejected but retains its charge until the existing upload lease plus grace ends · Immediately releasing it would reopen the late-upload accounting hole documented in Phase 3; only one pending upload remains, while superseded reservations stay tracked for safe cleanup · `reserveMedia`, `sweepStorage`, native ledger regression and signed-upload tests.
- 2026-11-03 · phase 4 · §G.4 (SDK dependencies) · Override transitive Zod to the existing 4.6.7 and Undici 7.30.0 to 7.30.1 · Current Workflow 5.3.0 / Blob 2.8.2 dependencies include vulnerable older versions; these compatible updates remove the reported high-severity advisories without downgrading the required SDK APIs · `package.json`, `package-lock.json`, `npm audit`; https://github.com/advisories/GHSA-mrhx-c7xc-m3w5 and https://github.com/advisories/GHSA-2m5v-pch6-74hx . Moderate upstream advisories remain recorded in the phase evidence.

## Risks / open questions
- No secret use, Vercel setting, real OpenAI call or production adapter request occurred. Workflow redeploy/private Blob/Neon behavior and model capabilities still require Phase 7 verification.
- Informational dependency audit exits 1: 42 moderate upstream advisories (esbuild/minimatch), zero high/critical after compatible overrides; exact report retained. No forced incompatible major downgrade was applied.
- Technical evidence only; no BdSL correctness, qualified review or comprehension claim. Official sticker remains missing; browser/player, sharing and lease-driver checks are outside this phase.
- [Evidence and official SDK references](E:/AIgnite-Lab/signbridge/docs/evidence/phase-4/notes.md). SYSTEM-DESIGN.md is unchanged.

## Files
Output of `git diff --stat phase-3 phase-4`:

```text
 .env.example                                       |   20 +-
 .gitignore                                         |    2 +
 README.md                                          |    6 +
 app/api/admin/kill-switch/route.ts                 |    4 +
 app/api/admin/status/route.ts                      |    4 +
 app/api/cron/reconcile/route.ts                    |    4 +
 app/api/jobs/[jobId]/cancel/route.ts               |    4 +
 app/api/jobs/[jobId]/retry/route.ts                |    4 +
 app/api/jobs/[jobId]/route.ts                      |    4 +
 app/api/local-blob/route.ts                        |    2 +
 app/api/projects/[projectId]/jobs/route.ts         |    4 +
 .../projects/[projectId]/media/finalize/route.ts   |    4 +
 app/api/projects/[projectId]/media/init/route.ts   |    4 +
 app/api/projects/[projectId]/media/url/route.ts    |    4 +
 app/api/projects/[projectId]/route.ts              |    4 +
 .../segments/[idx]/source-check/route.ts           |    4 +
 app/api/projects/[projectId]/track/route.ts        |    4 +
 app/api/projects/[projectId]/transcripts/route.ts  |    4 +
 app/api/projects/route.ts                          |    4 +
 app/api/telemetry/render/route.ts                  |    4 +
 app/api/tracks/[trackId]/manifest/route.ts         |    4 +
 docs/DEVIATIONS.md                                 |    3 +
 docs/LIMITATIONS.md                                |    2 +-
 docs/evidence/phase-4/dependency-audit.json        |  886 +++
 docs/evidence/phase-4/live-smoke.json              |    9 +
 docs/evidence/phase-4/native-results.json          |    1 +
 docs/evidence/phase-4/notes.md                     |   20 +
 docs/evidence/phase-4/vitest-results.json          |    1 +
 docs/phase-reports/phase-4.md                      |  118 +
 eslint.config.mjs                                  |    3 +-
 lib/ai/client.ts                                   |   50 +-
 lib/ai/fakeFixtures.ts                             |   16 +
 lib/ai/models.ts                                   |   10 +-
 lib/ai/prompts/meaning.v1.md                       |    3 +-
 lib/ai/prompts/plan.v1.md                          |    3 +-
 lib/ai/protocol.ts                                 |   12 +
 lib/ai/runStage.ts                                 |   58 +
 lib/auth/rateLimit.ts                              |    3 +-
 lib/db/client.ts                                   |    1 +
 lib/db/migrations/0003_salty_goliath.sql           |   25 +
 lib/db/migrations/meta/0003_snapshot.json          | 2325 ++++++
 lib/db/migrations/meta/_journal.json               |    7 +
 lib/db/queries/admission.ts                        |    9 +
 lib/db/queries/api.ts                              |   72 +
 lib/db/queries/authority.ts                        |   16 +-
 lib/db/queries/corpusSeed.ts                       |    8 +
 lib/db/queries/execution.ts                        |    6 +
 lib/db/queries/health.ts                           |    3 +-
 lib/db/queries/publish.ts                          |    2 +
 lib/db/queries/storage.ts                          |    1 +
 lib/db/schema.ts                                   |   10 +-
 lib/domain/transcriptEdits.ts                      |   30 +
 lib/jobs/buildTrack.workflow.ts                    |   14 +-
 lib/jobs/leaseDriver.ts                            |    2 +-
 lib/jobs/localDispatcher.ts                        |   11 +
 lib/jobs/productionDispatcher.ts                   |   10 +
 lib/jobs/runtime.ts                                |   13 +
 lib/jobs/steps.ts                                  |   55 +-
 lib/jobs/workflowSteps.ts                          |    7 +
 lib/server/api.ts                                  |  131 +
 lib/server/localBlob.ts                            |   18 +
 lib/server/route.ts                                |   13 +
 lib/storage/blob.ts                                |    5 +-
 lib/storage/urls.ts                                |   30 +
 lib/storage/vercel.ts                              |   17 +
 next.config.ts                                     |    3 +-
 package-lock.json                                  | 7545 +++++++++++++++++---
 package.json                                       |   10 +-
 scripts/phase4-live-smoke.ts                       |   35 +
 scripts/seed-local.ts                              |    7 +
 tests/contract/openaiTransport.test.ts             |   17 +
 tests/contract/pipelineApi.test.ts                 |  136 +
 tests/contract/schema.test.ts                      |    3 +-
 tests/fixtures/phase-4-schema.sql                  |   13 +
 tests/unit/ownership.test.ts                       |    7 +
 75 files changed, 10790 insertions(+), 1123 deletions(-)
```
