# Limitations

Experimental · not reviewed by a BdSL signer.

- Technical renderability is the only evaluated evidence category: 20/20 sampled corpus files on one Windows host in headless Edge with software WebGL, plus the five-unit Chromium/Edge application fixture. Linguistic correctness: none. User comprehension: none.
- The unrelated corpus entries in the fixture do not form a claimed translation.
- Software WebGL on a Windows host does not establish performance or compatibility on mobile hardware.
- UEA serves the remote, unmodified renderer with no availability warranty. The host reports loading until `avatarready`; a missing engine never establishes completed signing.
- Phase 4 adds the upload/API/job pipeline and production SDK adapters. Local tests use explicit fake-model fixtures; no real model call or managed production adapter has been exercised. The local player/workspace, corrections, sharing and deletion UI are implemented. There is no qualified review UI or claimed language-quality result.
- PGlite files are local development storage, not durable Vercel storage. Production requires an owner-approved Neon configuration. `/api/health` checks DB connectivity; it does not claim that migrations have been applied, signing is correct, or production processing is enabled.
- The official event sticker is missing. The banner's explicit placeholder will load `/event-sticker.png` once the official asset is supplied.
- The fixed XML whitelist excludes 131 distinct full-release files with nonmanual elements outside that whitelist, alongside 43 other rejected hashes. Their source paths and reasons remain in the import evidence. These exclusions limit coverage; no motion or nonmanual content was silently removed to make an asset pass.
- Only the 20 supplied sample assets have been render-probed and made eligible. Accepted-but-untested assets remain ineligible. Curated-subset testing belongs to phase 7.
- Retrieval stemming and independent Bangla detectors are deliberately coarse. Ambiguous words and suffixes can produce conservative blocking; they do not validate BdSL semantics. P3 checks candidate provenance or exact labels, and never uses lossy retrieval text directly as proof.
- Strict schema tests are offline contract checks against the published OpenAI subset. They do not claim a live API accepted a schema, model accuracy, or translation accuracy.
- Race evidence covers PGlite and a disposable local PostgreSQL 16.11 server, not a live Neon database or Vercel deployment. PGlite serializes transactions; PostgreSQL tests explicitly observe blocked sessions before releasing project/cache locks.
- Logical project deletion hides data immediately. Physical cleanup can wait up to the upload lease's remaining 15-minute reservation window; this prevents late uploads from escaping purge. Reconciliation must continue running, with at least daily full retention sweeps for the 96-hour cleanup target. Hobby cron jitter and outages can exceed that target; no fixed deletion deadline is guaranteed.
- Dispatch failures stop after five attempts. A still-queued job can be cancelled and retried; no external scheduler recovery is implemented in this phase. The in-process adapter is a development transport, not a durable managed workflow service.
- Shared links grant anyone holding the URL read access. Revocation stops subsequent authorized reads, while source URLs already issued may last 15 minutes. Shared views cannot mutate the project. Browser owner cookies are the only creator recovery mechanism in this scope.
- Real processing sends captions, context and title to OpenAI, potentially including personal data. Requests set `store:false`; this does not establish zero provider retention. Upload only permitted material.
- A high recent real-model error rate automatically stops processing. Saved replay remains available; the remote avatar service and WebGL remain runtime dependencies. Fake fixtures are excluded from real OpenAI error metrics.
- Optional anchors, learner pace presets, simultaneous overlay, embeddings and ASR are cut at the feature freeze. Public deployment, real devices, broader curated coverage and demonstration content remain Phase 7 gates.
