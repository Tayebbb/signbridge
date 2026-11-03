# Phase 4 evidence — 2026-11-03 (Asia/Dhaka)

The API tests invoke the same Request/Response controller used by the thin App Router handlers. They use real migrated PGlite and filesystem objects, with deterministic, explicitly labelled fake-model fixtures. They are not HTTP browser playback tests; those belong to Phase 5. No credentials were used and no Vercel values were set.

The workflow compiles to one durable workflow with independently persisted meaning and plan step boundaries, at most four concurrent segments. First-run claims, content cache keys, attempt numbers, budgets and publication authority remain SQL-owned. SDK automatic retries are disabled. A mock fetch exercises the real OpenAI SDK's HTTP serialization and incomplete usage handling without contacting OpenAI. Sol HTTP 404/503 failures select Terra for subsequent recovery jobs; the sticky availability flag is an operations setting, not an assertion that Terra is linguistically preferable.

API coverage includes supported and three missing-critical-content fixtures; edit while the old model reply is held; crash after reply/settlement before cache insertion followed by two replays; 402 at a one-cent remaining cap with saved replay unaffected; A→B→A identity with stage reuse; content-identical media re-attachment; live source-confirmation overlays; strong ETags, private revalidation and no-store media; no-access/deleting 404 before ETag evaluation; owner/origin/admin/rate boundaries; durable create/edit/job idempotency; merge/split cue partitions and CAS conflict responses. Revocable sharing is deliberately Phase 6.

Upload transport tests cover type/size/expiry/path signatures, concurrent no-overwrite PUTs and ranged private reads. Filesystem `head()` retains its Phase 1 shape; the signed-upload subclass supplies MIME metadata. Re-init/rejected objects retain their reservations through upload grace to prevent late writes escaping accounting. Local signatures are ephemeral: a server restart requires a fresh media URL.

Current official references checked before SDK implementation:

- Workflow 5.3.0: https://workflow-sdk.dev/docs/getting-started/next ; https://workflow-sdk.dev/docs/api-reference/workflow-api/start ; https://workflow-sdk.dev/docs/api-reference/workflow/get-workflow-metadata . `withWorkflow` generates ignored `.well-known/workflow` files during build.
- Vercel Blob 2.8.2: https://vercel.com/docs/vercel-blob/private-storage ; https://vercel.com/docs/vercel-blob/vercel-signed-urls . Private OIDC access and path/type/size-restricted signed PUT/GET match the design; no production request was made.
- OpenAI 7.47.0: https://github.com/openai/openai-node ; https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses ; https://developers.openai.com/api/reference/resources/responses/methods/create . Strict `text.format`, `store:false`, hashed `safety_identifier`, bounded output and usage on incomplete are exercised offline. Model capabilities and prices still require the approved live deployment smoke.
- Relevant installed Next.js 16.4.4 route guide read from `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`.

The real OpenAI smoke is NOT RUN: no key is configured locally and its use has not been approved. `npx tsx scripts/phase4-live-smoke.ts` is a nonsecret dry run. With owner approval and a locally configured key, adding `--live` runs only two synthetic caption segments in isolated PGlite with both spend caps set to USD 0.20, and writes model, tokens, outcomes and cost evidence. It does not claim valid video playback or language quality.

Dependency audit after compatible overrides reports zero high/critical and 42 moderate advisories; the exact machine report is `dependency-audit.json`. No forced major downgrade was applied. Production service behavior, redeploy durability and private-store access still need Phase 7 verification.
