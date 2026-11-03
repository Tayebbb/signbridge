# Phase 7 — Production deploy, demo content, production verification

Read `AGENTS.md`, then `SYSTEM-DESIGN.md` §A.2, §A.5, §A.6, §H.1 rows T1, T2, T9, T14, §H.2, §H.6, §H.7. Inputs: `.env.local`, `demo-input\` (clips + SRT), `assets\event-sticker.png`.

## Goal
The public production URL processes a real clip and replays saved tracks; demo projects are pre-processed and pinned; results are recorded honestly.

## Build / do
1. Production config: Vercel project env vars (names from `.env.example`; ask me before setting any secret value), Neon production DB + a preview **branch** for smoke tests, private Blob store, cron, `JOB_DRIVER=workflows`. Run migrations (additive only).
2. Corpus: choose the curated subset covering the demo clips' vocabulary plus common words; run `corpus-render-probe` on it (**T14**: only `rendered_ok` assets eligible); seed production.
3. `scripts/seed-demo.ts`: upload the demo clips, process once with real OpenAI (spends budget once; log cost), pin media, record project ids. Include one deliberately unsupported segment (§H.6). **Do not hand-edit plans**; any alias added goes into the corpus alias table and is logged.
4. Deploy preview → run T1/T2 smoke against the preview branch → promote to production.
5. Production checks:
   - **T1**: fresh upload of a demo clip on production → manifest published, statuses valid, `stage_attempts` = 2 per segment (+≤1 repair), playback end to end on desktop Edge/Chrome.
   - **T2**: reload + shared link → same `manifestHash`, zero new model calls.
   - **T9**: start a job, redeploy mid-run → job completes (else switch to `JOB_DRIVER=lease`, record it).
   - `/api/health`, `/api/admin/status`, cron invocation logged, caching headers re-checked with `curl -I`.
6. Mobile (§H.2): write `docs/MOBILE-TEST.md` checklist for me to run on real devices; I will paste results back. Do not invent results.
7. Record a dated screen capture plan for the UEA-outage fallback (§H.6).

## Done when
Production URL, demo project links, and spend so far are in the report; T1/T2/T9/T14 PASS or FAIL with evidence. End-of-phase steps per `AGENTS.md`.
