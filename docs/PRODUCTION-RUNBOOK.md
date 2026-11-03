# Phase 7 deployment and verification

Prepared 2026-11-03, Asia/Dhaka. Status: BLOCKED pending owner approval and demo inputs. No credential, Vercel environment value, remote migration, model call or deployment has been used. Phase 6 is `093afbf`, tag `phase-6`; Phase 8 stays unstarted until this full gate passes.

## Required owner inputs

- Approve credential use and all named Vercel settings below; identify the Vercel account/team/project, Neon project and approved total OpenAI ceiling for preview + production + redeploy checks. Proposed combined Phase 7 ceiling: USD 4, within the design's USD 5/day and USD 19 lifetime caps. Branch ledgers are separate: keep an additional combined spend record; never treat two branch caps as one global cap.
- Supply a local directory of permitted MP4/WebM and matching SRT/VTT, plus rights attestation. `demo-input.example.json` is a schema example, not real content. Copy to ignored `demo-input/demo.json`, set measured video metadata and real relative filenames. Sample A for T1 must be 45 seconds / six deterministic segments. Include a second demo with a deliberately unsupported critical concept; no hand-edited plan.
- Official sticker remains missing by owner confirmation. Keep the explicit placeholder; install only the supplied official file at `public/event-sticker.png` when available. Do not synthesize or imitate it.

## Configuration to approve before any action

Use Node 24/npm, Next 16.4.4, Workflow 5.3.0 and private Blob 2.8.2 adapters. Functions in `iad1`; choose Neon primary in compatible us-east-1, plus a separate preview branch. Production and Preview `DATABASE_URL` must point to their respective branches. Private Blob store/OIDC access must be scoped to this project. Owner must approve any CLI login or use of an existing login.

| Vercel name | Preview / Production intent |
|---|---|
| DATABASE_URL | Secret; respective Neon branch URL |
| OPENAI_API_KEY | Secret; approved OpenAI project only; omit in the separate T2 replay preview |
| ADMIN_TOKEN / CRON_SECRET | Secrets; separate approved admin/cron authorization |
| PROCESSING_ENABLED | false for bootstrap/replay-only checks; true only for approved processing |
| MODEL_DRIVER / JOB_DRIVER / BLOB_DRIVER | openai / workflows / vercel |
| BLOB_STORE_ID | Approved private store; managed OIDC preferred |
| BLOB_READ_WRITE_TOKEN | Only if required and explicitly approved; avoid duplicate credential paths |
| APP_ORIGIN | Optional exact canonical HTTPS origin; leave unset for generated preview/staged hosts and use validated HTTP Host. A configured origin must match the URL being tested. |

Local-only PGLITE_DATA_DIR, LOCAL_BLOB_DIR, PG_TEST_BIN and test evidence routing do not belong in production. Never print a secret, signed upload URL or owner capability into tracked evidence. `seed-demo.ts` does not load `.env.local`; approved values must be supplied to its process safely.

## Execute after approval

1. Confirm plan quotas/current docs, link the approved Vercel project, provision the Neon branches and private Blob store. Keep processing disabled. Apply additive migrations on each approved branch via `npm run db:migrate`. Check the DB is the intended branch before seeding.
2. Validate real inputs with `npx tsx scripts/seed-demo.ts --config demo-input/demo.json` (dry; no model or database). Compare source metadata with a local video probe. Choose corpus IDs covering those captions plus common words, retaining hash/provenance and the unchanged XML policy. Prepare probe input in the existing `sample-probe.json` shape; run `corpus-render-probe.cjs` into Phase 7 evidence (do not overwrite Phase 2). Import only hash-matched successful checks as `rendered_ok`/eligible; failures stay ineligible. Seed the resulting corpus on each branch through `applyCorpusSeed`, then verify all eligible rows have successful matching evidence. Log every added alias for the whole corpus; no hidden per-demo alias or plan edit.
3. Initialize both SQL budget ledgers. Temporarily lower caps so remaining lifetime AND current-day allowance fit the approved per-branch allocation. Never raise a cap above USD 19 lifetime / USD 5 day, or count the same USD 4 allocation twice across branches. The seed tool refuses excessive remaining allowances and never raises/restores a cap, including after failure. Record before/after spent, held-uncertain and reserved amounts.
4. Deploy a preview against the preview branch and run T1/T2 there. Current Vercel CLI makes a new project's first deployment production even without `--prod`: bootstrap it with `--prod --skip-domain`, processing false, then create the preview. This is a staged bootstrap, not a public release. Run the production-target build with `--prod --skip-domain`; smoke its own production configuration before `vercel promote`. A promoted build keeps its environment: do not blindly promote a preview build wired to the preview DB.
5. Enable processing only after approval. Run `seed-demo.ts --apply --origin <approved HTTPS origin> --budget-micros <approved allocation>`. It uses real HTTP routes/Workflow jobs, records durable checkpoints and owner capability only in ignored `.data/phase7-demo-state.json`, resumes existing projects/jobs, refuses fake provenance and pins only current content with expected coverage. It logs project IDs, private creator URLs, manifest hashes and SQL spend. Keep that owner capability private; use the creator UI to issue judging share links and store any private link inventory outside Git. Do not automatically retry a failed paid job. Separate checkpoints are required for preview/production origins; keep backups under ignored `.data`.
6. T1 production: fresh owner/upload of sample A, six segments; inspect statuses, exactly two successful model calls per segment plus at most one repair; record any retry/failure honestly. Exercise full sequential playback on desktop Edge and Chrome, with real CWASA and device telemetry. Save model/profile/tokens/USD from actual rows. Fresh smoke tests use their own owner capability to avoid consuming demo-owner quotas.
7. T2: reload creator and fresh-context share; same manifest hash, unchanged stage attempts/cost. Repeat in a separate preview with OPENAI_API_KEY absent and processing disabled, using saved branch data. Re-check ETag, private no-cache and video Range behavior. API HEAD is not universally implemented; use an actual GET with headers as well as the requested `curl -I` and record any 405 honestly.
8. T9: start a real production Workflow job, record job/run/deployment IDs, redeploy mid-run, then verify completion/publication and spend settlement. Do not claim local dispatcher tests prove this. On failure stop and implement/test the specified lease fallback before proceeding; the lease transport is not currently implemented.
9. Record actual `/api/health`, authenticated admin metrics and authenticated daily cron invocation. Review spend, held-uncertain reservations, renderer failures, pending/running jobs, Blob usage and transfer estimates. Lower/disable processing if thresholds require it. Raise temporary caps back to policy limits only with budget authorization after all seed jobs are terminal and no unknown reservation remains.
10. Run real-device checklist in MOBILE-TEST.md; record unavailable hardware as NOT RUN. Capture the dated production fallback described in UEA-FALLBACK-CAPTURE.md. Complete the Phase 7 report with production URL, demo IDs/links and measured spend. Commit/tag `phase-7` only when the full production gate is closed; no Phase 8 work before that gate passes.

## Current official references checked without authentication

- [Vercel deploy / staged production](https://vercel.com/docs/cli/deploy), [promote](https://vercel.com/docs/cli/promote), [Workflows](https://vercel.com/docs/workflows), [Blob SDK](https://vercel.com/docs/vercel-blob/using-blob-sdk).
- [Neon branch management](https://neon.com/docs/manage/branches). Plan-specific limits still require account verification after approval.
- [Hobby cron](https://vercel.com/docs/cron-jobs/usage-and-pricing): daily with hourly precision; cleanup timing is a conditional target.
