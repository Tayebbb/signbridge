# SignBridge

## Tagline
A saved signing companion for short Bangla clips, with visible gaps and source-timed replay.

## Description
SignBridge is an experimental prototype for short videos with supplied Bangla captions. Its intended users are Deaf and hard-of-hearing viewers and video creators; that audience hypothesis has not been validated through participant research.

Creators upload a permitted MP4/WebM and captions, inspect the source text, and build a saved companion track. The source plays first and holds while corpus-based signs play. An unresolved critical concept creates a blocking gap card. Captions remain visible. New compositions are labelled **Experimental - not reviewed by a BdSL signer**.

Saved tracks can be replayed and shared without another model call. A source-caption correction invalidates affected work; stale replies cannot replace the current track. Completion requires the expected ordered sign-unit callbacks. Timeouts, skips and incomplete playback do not count as completed signing.

## How we built it
The solo build uses Next.js App Router, TypeScript, React, Zod and Drizzle. Production runs on Vercel Hobby with two isolated Neon Free databases and private Vercel Blob. Vercel Workflows dispatches meaning and asset-planning stages through OpenAI Responses with strict output schemas. SQL owns authority, outbox recovery, cached stages, publication, spend reservations and the kill switch. Local development substitutes PGlite, filesystem storage, a deterministic labelled fake model and an in-process dispatcher.

Plans reference actual eligible IsharaKotha asset IDs. The app derives lowercase ASCII gloss IDs while preserving motion XML, embeds SiGML and provenance in a versioned manifest, and plays it through the unmodified remote UEA CWASA renderer in an isolated iframe. Separate source/avatar clocks and disposable renderer instances prevent stale animation callbacks from advancing playback.

## Challenges
The corpus has incomplete coverage and cannot establish sentence-level signing quality. We quarantined 174 of 3,108 distinct input hashes rather than widening the XML whitelist. Only 12 curated assets with matching successful render evidence are eligible in the production demo.

Real deployment checks found two integration defects: inline Workflow directives were missing from the built step registry, and edge compression changed strong ETags to weak validators. We fixed both and added regression checks. A further verification race mixed rows from before and after atomic publication; a forced native PostgreSQL race now protects the verifier. The same real Workflow survived a production cutover and published once.

## Evidence and limits
1. **Technical renderability:** 20/20 sampled assets in Phase 2 and 12/12 curated assets in Phase 7, on one Windows host with software WebGL. These sets are not claimed as 32 unique assets. Production sample A is a 45-second, six-segment original synthetic clip; all six segments played in Chrome and Edge after 12 model calls. Sample B deliberately has unsupported negation. No plans were hand-edited. Reload/share retained the manifest hash with zero additional calls; a no-key preview also replayed saved tracks.
2. **Linguistic correctness:** none. No qualified BdSL signer has assessed these exact rendered versions.
3. **User comprehension:** none. No evaluation using tasks with Deaf/BdSL users has been performed.

The release reports record 194 default tests, 51 native PostgreSQL tests and 16 local browser regressions. The dated Phase 7 recheck repeats full Chrome/Edge production playback and verifies existing real-processing and redeploy evidence without claiming a new upload or cutover. Technical checks do not establish that signing is acceptable or usable for the intended audience. Real Android/iPhone results are still NOT RUN. UEA availability and WebGL remain runtime dependencies. The owner supplied the official event sticker, used unchanged in the app's top banner.

Measured build verification used USD 0.101634 of existing OpenAI credits, against an approved USD 4 ceiling. Phase 8 replay checks request no additional model processing. This is metered usage, not a provider invoice. Infrastructure uses free plans; no purchases, upgrades or billing changes were made.

## Prior work and differentiation
SignOLight already documents video-to-avatar workflows. IsharaKotha is prior text-to-avatar research and the source of the corpus assets. SignBridge does not claim to invent either category. The contribution demonstrated here is a working combination of sequential source-frame holds, durable source-caption edits, saved replay, and visible unsupported spans. We do not infer that other projects lack those features from an incomplete public inspection.

## What's next
Co-design consented formative evaluation with qualified Deaf/BdSL reviewers, assess specific rendered versions, then run separate comprehension tasks with Deaf/BdSL users. Publish failures and participant counts before making outcome claims. Validate real mobile memory/performance and improve vocabulary coverage without silent semantic substitution. No outreach or evaluation is claimed as completed.

## Built with
Next.js; React; TypeScript; Node.js 24; npm; Zod; Drizzle ORM; Neon PostgreSQL; PGlite; Vercel Workflows; Vercel private Blob; OpenAI Responses API; IsharaKotha SiGML; UEA CWASA; Vitest; Playwright.

## Attribution
IsharaKotha V2: MD. Ashikul Islam, Prato Dewan, Md Fuadul Islam, Md Ataullha Saim and M Shahidur Rahman, DOI [10.17632/6ykgx65ks5.2](https://data.mendeley.com/datasets/6ykgx65ks5/2), CC BY 4.0. Gloss identifiers were derived as lowercase ASCII; motion XML is unchanged. Dataset-level review is not inherited as review of SignBridge tracks.

Renderer: remote, unmodified [UEA CWASA/JASigning vhg2026](https://vhg.cmp.uea.ac.uk/tech/jas/vhg2026/), Anna avatar. Original synthetic source clips/captions were generated for this project under CC0-1.0; they contain no external footage, voices or signer performance.

Prior work: [SignOLight original writeup](https://www.kaggle.com/competitions/build-with-gemma-ml-ai-deep-learning-nlp-communityofficial/writeups/signolight); [IsharaKotha paper](https://arxiv.org/html/2511.16896v1). Our evidence is in the phase reports, not inferred from their evaluation results.

## Production and demos
- [Public application](https://signbridge-mdtayebibne-4755s-projects.vercel.app).
- [Play covered sample](https://signbridge-mdtayebibne-4755s-projects.vercel.app/s/b0a2b6b2-fbab-4936-829e-620b0a937ed4?s=8EdVJxY2BO-DDccdy6bQu-M7r5Oq5aSyH4ma9NaE6Fg) - intentionally public, read-only original synthetic sample.
- [See unsupported sample](https://signbridge-mdtayebibne-4755s-projects.vercel.app/s/1ad052e9-bb09-4132-a98a-995917bfb86b?s=v-7iWygWd90ePqFdKQV4ZLu_9NGMwYCB9f-3bsllpVs) - intentionally public, read-only original synthetic sample.
- Source of technical claims: `docs/phase-reports/phase-2.md`, `phase-3.md`, `phase-5.md`, `phase-6.md`, `phase-7.md`, `phase-6-recheck-2026-11-04.md`, `phase-7-recheck-2026-11-04.md`; refreshed route/replay evidence is `docs/evidence/final/recheck-2026-11-04/`.
