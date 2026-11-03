# Phase 3 — State authority, ledgers, reconciler

Read `AGENTS.md`, then `SYSTEM-DESIGN.md` §C.1, §C.2, §F.3, §F.3a, §F.4, §F.5, §F.6, §F.7, §F.8, §G.3, §A.5 (budget and storage controls), §H.1 rows T13, T16, T19, T20, T21, T24.

## Goal
Every state transition as a tested SQL transaction in `lib/db/queries`, plus the reconciler. This is the correctness core; it runs entirely against PGlite.

## Build
1. Project authority (§F.3 table): `startJob`, `cancelJob`, `retryJob`, `submitTranscriptVersion` (edit → supersede), `deleteProject` (fence), `stallFence`. Each locks the project row, sets/clears `active_job_id`, and bumps `processing_epoch` exactly as specified. At most one active job per project.
2. Outbox + run claim (§F.3a): `dispatch_state`, `run_claim`, `lease_epoch`; the first step's claim makes duplicate runs no-ops.
3. Fenced publish (§F.4): the publish transaction checks active job + epoch + current transcript; idempotent for the same job (returns the same track id); `track_versions` unique on `(project_id, track_fingerprint)`.
4. Idempotent stage writes (§F.5): `INSERT … ON CONFLICT DO NOTHING` on content-addressed keys; `stage_result_refs`.
5. Spend (§F.7, `lib/ai/spend.ts` calling `lib/db/queries`): lifetime (USD 19) + Asia/Dhaka day (USD 5) budgets; reserve an upper bound on both before each call; settle from usage; uncertain billing keeps the full bound as spent; attempt cap per (job, segment, stage) ≤ 4; 80 % → Terra downgrade signal; per-owner quotas.
6. Storage (§G.3): atomic `storage_ledger` admission, finalize moves pending→committed with the real size, expiry releases, transfer gate for non-pinned media.
7. Deletion purge (§F.6): two-phase; shared stage results kept, exclusive ones removed, Blob paths deleted via the `BlobStore` adapter, ledger bytes released, rerun is a no-op.
8. `lib/ops/reconcile.ts`: outbox redispatch, stalled-job fence, orphan spend reservations, expired storage reservations, retention sweep (≤5 per opportunistic call), purge continuation. Returns the counters in §G.1 `/api/cron/reconcile`.
9. Race harness in `tests/race/`: real concurrent transactions against PGlite (or a disposable Postgres if PGlite serialises too much to prove anything — say which, and why, in the report).

## Tests
- **T16** full fencing matrix (actions × timing) — old job never publishes; ≤1 active job; epoch strictly increases; duplicate winning publish returns the same id.
- **T19** dispatch crash windows; **T20** spend settlement incl. concurrent reservations at the cap boundary, never `spent+reserved > cap`; **T21** 60 concurrent 15 MB inits vs 800 MB, abandoned reservation release, smaller finalize; **T13** cap $0.01 → `spend_cap` (DB level; route level in phase 4); **T24** deletion purge incl. interruption midway.

## Out of scope
Routes, OpenAI client, Workflows, UI.

## Done when
All listed tests green with the matrix sizes stated in the report. End-of-phase steps per `AGENTS.md`.
