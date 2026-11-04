# Operating SignBridge

Updated 5 November 2026. Keep this procedure alongside the immutable design and the deployment runbook.

## Release gates

Run `npm ci`, typecheck, lint, default tests, production dependency audit, native PostgreSQL checks, product/foundation browser checks, production build and the secret scan against one isolated candidate. Do not skip a failing gate. Apply additive migrations to preview first and smoke there before migrating/staging production. Never promote a preview build containing preview credentials to production.

The additive hardening migration adds nullable owner-recovery hashes and query indexes. Existing owners and older deployments remain compatible with those additions. The new deployment's health check rejects an incompatible schema or missing production adapter configuration. Real-provider reachability requires an explicit smoke; health does not make a paid model call.

## Monitoring and bounded recovery

`scripts/monitor-production.mjs` checks health, runs authenticated reconciliation and examines authenticated alerts without logging credentials or content. The public GitHub Actions workflow schedules it every five minutes. GitHub scheduling can be delayed and is not an SLA; Vercel's daily cron remains an independent fallback. Enable workflow-failure notifications for the responsible repository operator.

Required GitHub configuration: `SIGNBRIDGE_URL` repository variable; `SIGNBRIDGE_CRON_SECRET` and `SIGNBRIDGE_ADMIN_TOKEN` Actions secrets. Set them through an approved authenticated channel. Fork pull-request quality checks use fake/local providers and receive no production secrets. Do not expose operational secrets through workflow outputs or artifacts.

Initial dispatch also retries after 1, 5, 15 and 45 seconds inside the bounded server continuation, so closing the creator tab does not cancel those attempts. SQL run claims/epochs still fence duplicates. Five failed dispatch attempts terminate an unclaimed job with `dispatch_exhausted`; the creator can explicitly retry. A confirmed run is not discarded just because its acknowledgement was lost. Total platform outages still depend on a subsequent independent trigger.

## Model failures and budgets

The administrator's processing switch is persistent. The automatic circuit is separate: at least five recent real-provider attempts, at least three errors, and more than 20% failures open a ten-minute cooldown. Old failure history ages out; the circuit cannot reverse a manual stop. Admin enable explicitly acknowledges old errors and clears the circuit. Saved replay remains model-free.

Hard spend reservations still govern every real attempt, including repairs and uncertain billing. Do not raise caps, purchase credits or retry a failed paid job automatically. Inspect held-uncertain reservations before further processing. Current approved scope remains existing OpenAI credits capped at USD 4 total, minimum practical usage, and free infrastructure plans.

The 6 GB monthly transfer gate now includes pinned video reads. Pointer/manifest polling never debits video bytes. Every actual upstream video read reserves the full object's size as a conservative upper bound, including range/cancelled reads. This can overcount, but a reusable public Blob URL cannot bypass admission. Other provider traffic, account-level usage and platform allowances still need observation.

## Incident actions

| Signal | First action |
|---|---|
| Health/schema/configuration failure | Keep traffic on the last verified deployment; inspect the candidate and additive migration result. |
| Stalled or exhausted dispatch | Run authenticated reconciliation; inspect job/run ownership; explicitly retry only terminal, authorized work. |
| Model circuit / provider errors | Check provider status and spend uncertainty. Wait for cooldown or deliberately acknowledge; do not bypass hard budgets. |
| Blob cleanup failures | Keep failed objects charged, retry removal and check storage headroom; unrelated admissions remain possible when capacity exists. |
| Renderer outage | Keep captions and gap markers available; retry with existing backoff. Never relabel incomplete playback as completed signing. |
| Spend/transfer/storage warning | Reduce or stop new work; never silently expand the free/credit limits. |

## Rollback and restore

Retain the prior verified Vercel deployment. Roll back code by restoring its production alias rather than dropping the additive migration. Workflows can continue on their originating deployment; preserve SQL fencing and monitor terminal publication. A rollback to the older client can reintroduce the audited defects, so use it only to contain a worse incident and retain the hardening candidate for repair.

For database recovery use [DATA-LIFECYCLE.md](DATA-LIFECYCLE.md). Restore privately and paused, apply newer revocations, preserve accounting and verify saved hashes before reopening. The local restore drill and local load evidence establish bounded engineering behavior, not a hosted uptime or language-quality guarantee.
