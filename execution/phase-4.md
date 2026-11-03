# Phase 4 — AI pipeline, durable jobs, API routes, uploads

Read `AGENTS.md`, then `SYSTEM-DESIGN.md` §A2, §B.2, §B.3, §C.4, §C.5, §D.1–D.7, §F.7, §F.9, §G.1, §G.3, §G.4, §H.1 rows T6, T8, T13, T17, T18. Re-check current official docs for: Vercel Workflow SDK (`'use workflow'`/`'use step'`, Next.js integration), `@vercel/blob` private stores + presigned PUT/GET, OpenAI Responses API structured outputs, `store:false`, `safety_identifier`, `max_output_tokens`, usage on `incomplete`.

## Goal
Upload → transcript → job → published manifest works end to end locally with the fake model, and against OpenAI when a key is present — with every route from §G.1 except share, anchors and the lease driver.

## Build
1. `lib/ai`: `models.ts` (Sol primary, Terra fallback, prices), prompts `meaning.v1.md` / `plan.v1.md` (captions only in a JSON data field; no tools), `client.ts` (≤90 s timeout, SDK `maxRetries: 0`, our own retry policy, spend reserve/settle around every call, `store:false`). Fake model implements the same interface with controllable delays/failures.
2. `lib/jobs`: `steps.ts` (claim → per-segment meaning → retrieval → plan → validate → build manifest → fenced publish), `buildTrack.workflow.ts` (production dispatcher), in-process dispatcher for local/tests. Steps are idempotent and reuse cached stage results by key.
3. Production adapters: Neon (already), Vercel Blob private (`BlobStore`), Workflows (`Dispatcher`), OpenAI (`ModelClient`). Selected by env; local defaults unchanged.
4. Routes (§G.1, Zod-validated, `{error:{code,message,retryable}}`): projects create/get, media init/finalize/url, transcripts (create + edits/merge/split), source-check, jobs start/get (ETag/304)/retry/cancel, `GET /api/projects/:id/track`, `GET /api/tracks/:id/manifest`, `GET /api/cron/reconcile` (`CRON_SECRET`), telemetry, admin status/kill-switch. Origin check on mutations (reject `Origin: null`), rate limits, `Idempotency-Key`, 404-not-403 for no access.
5. Caching exactly per §F.9 / §C.4: track route `no-store`; manifest route `private, no-cache`, strong `ETag: "<manifestHash>"`, `Vary: Cookie`; no `immutable` anywhere; no presigned URL inside a cacheable body.
6. Upload per §G.3: server-chosen path, type/size-restricted presigned PUT, `head()` re-check on finalize, storage ledger admission, opportunistic retention sweep.

## Tests
- **T6** edit race via API with the fake model (J1 publishes after J2 → J1 fenced, never returned as current).
- **T8** kill step after model returns, before insert; re-run twice → one stage result, one track, one pointer update.
- **T13** route level: 402 `spend_cap`, replay unaffected. **T17** manifest identity A→B→A, re-attach, source-check overlay only. **T18** caching headers incl. revoked/deleted → 404 on revalidation.
- **T4/T5 end-to-end** with the fake model through the routes.
- One **live smoke** with the real OpenAI key on a 2-segment fixture (≤ USD 0.20): records model, tokens, cost; marks NOT RUN if no key.

## Out of scope
Player UI, share links, edits UI, anchors, lease driver.

## Done when
All listed tests green; live smoke recorded. End-of-phase steps per `AGENTS.md`.
