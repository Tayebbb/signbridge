# Phase 6 — Product completion (P0 feature freeze at the end)

Read `AGENTS.md`, then `SYSTEM-DESIGN.md` §0.3, §A.3 (P0-1…P0-10), §B.3, §E.9, §G.1 (share, delete, visibility semantics), §G.4, §H.1 rows T2, T10, T12, §H.3, §H.5 cut lines, §H.7.

## Goal
Every P0 requirement is usable in the UI. After this phase only fixes, deployment, and content are allowed.

## Build (in this order; if time runs out, apply the §H.5 cut lines and record what was cut)
1. Transcript correction after processing (P0-6, §B.3): edit/merge/split, immediate stale marking, stop obsolete signing, regenerate affected segments, CAS conflict UI.
2. Saved replay (P0-7): reopen from stored manifest with zero model calls; lint rule proving replay routes cannot import `lib/ai`.
3. Share links (`POST /api/projects/:id/share`, `app/s/[projectId]/page.tsx`): unlisted, view-only, revocable, "Shared view · experimental · not reviewed".
4. Delete project UI + route (`202 deleting`, purge completed by reconciler).
5. Failure UX (§E.9): UEA unreachable, WebGL missing, slow network, media expired + re-attach, processing disabled, spend cap; captions + gap cards stay usable.
6. `app/about/page.tsx`: limitations, the three evidence categories with current evidence exactly as §H.3, attribution (IsharaKotha CC BY 4.0 authors, UEA CWASA credit and terms), personal-data note (captions sent to OpenAI). `docs/ATTRIBUTION.md`, `docs/LIMITATIONS.md`.
7. Ops: `/api/admin/status` metrics from §H.7, kill switch (env + DB), structured JSON logs (no caption text beyond 40-char previews), security headers + CSP (strict on app pages; renderer frame CSP from the phase-1 measurement).
8. `vercel.json` cron for `/api/cron/reconcile` (daily on Hobby) and function config.

## Tests
- **T2 (local)**: reload project and shared link → identical `manifestHash`, zero new `stage_attempts`, works with `OPENAI_API_KEY` unset.
- **T10**: Playwright with UEA blocked, WebGL disabled, throttled network → correct messages, captions/gap cards usable, retry recovers, telemetry rows written.
- **T12 (full)**: foreign owner cookie and share token on mutating routes rejected; markup never rendered.
- Re-run the full suite (all earlier T-IDs) as a regression.

## Done when
All P0-1…P0-10 marked in the report as DONE / CUT (with reason); full suite green. End-of-phase steps per `AGENTS.md`.
