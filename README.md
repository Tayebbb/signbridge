# SignBridge

Experimental - not reviewed by a BdSL signer.

A companion for short Bangla clips with supplied captions: source playback holds for signing, critical gaps appear before play, and the saved track reopens without another model call. Source-caption edits fence stale work. This is an unreviewed prototype; its intended audience has not been validated with participants.

[Open the public application](https://signbridge-mdtayebibne-4755s-projects.vercel.app) · [Play covered sample](https://signbridge-mdtayebibne-4755s-projects.vercel.app/s/b0a2b6b2-fbab-4936-829e-620b0a937ed4?s=8EdVJxY2BO-DDccdy6bQu-M7r5Oq5aSyH4ma9NaE6Fg) · [See unsupported sample](https://signbridge-mdtayebibne-4755s-projects.vercel.app/s/1ad052e9-bb09-4132-a98a-995917bfb86b?s=v-7iWygWd90ePqFdKQV4ZLu_9NGMwYCB9f-3bsllpVs)

The two public samples use original silent synthetic source clips, not participant footage. A is 45 seconds with six technically ready segments; B deliberately contains unsupported negation. The owner supplied the official organizer sticker, used unchanged in the top banner.

## Evidence categories

| Category | Evidence |
|---|---|
| Technical renderability | Phase 2: 20/20 sampled corpus files. Phase 7: 12/12 curated assets and six production segments replayed in Chrome/Edge. One Windows host, software WebGL; these sets may overlap. |
| Linguistic correctness | None. No qualified BdSL signer assessed these exact rendered versions. |
| User comprehension | None. No evaluation using tasks with Deaf/BdSL users. |

[Phase reports](docs/phase-reports/) trace every engineering claim. The verified release has 194 default tests, 51 native PostgreSQL tests, 16 local browser regressions, and passing production T1/T2/T9/T14. The dated Phase 6/7 rechecks preserve the original gates and distinguish fresh playback from retained processing/deployment evidence. Counts overlap across backends and do not measure language quality. Physical Android/iPhone testing remains NOT RUN; [checklist](docs/MOBILE-TEST.md).

## Local development

Use Node 24 and npm. The local fake model is explicitly labelled in provenance.

```powershell
npm ci
npm run db:migrate
npm run db:seed:local
$env:PROCESSING_ENABLED = 'true'
npm run dev
```

With DATABASE_URL unset, local persistence uses PGlite under .data/. Blob uses the filesystem and jobs run in process. Unit tests use isolated databases. Configuration is documented in [.env.example](.env.example). The migration script uses exported variables and does not load .env.local itself. Use real secrets or Vercel settings only within the owner's approved scope; keep all credentials and owner/admin capabilities out of Git and logs.

## Checks

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run check:secrets
npm run test:race:native
npm run test:product
```

Native race tests need PostgreSQL binaries (PG_TEST_BIN); they create a disposable loopback-only cluster and never use the production database. Browser tests need Playwright Chromium, Edge where installed, WebGL and network access to UEA. Test-only evidence routing preserves earlier phase artifacts. Stage files before check:secrets; the scanner permits only exact documented pre-existing nonsecret lines.

## Architecture and recovery

[SYSTEM-DESIGN.md](SYSTEM-DESIGN.md) is the immutable architecture specification. Next.js routes coordinate domain validation, SQL transitions, storage, model and dispatcher adapters. Neon stores owners, transcript versions, outbox/run claims, content-addressed stages, epochs, spend reservations and immutable playback manifests. Vercel Workflows processes stages; private Blob holds signed source media. UEA CWASA runs remotely, unmodified, in an opaque sandboxed iframe.

Edits invalidate affected work. SQL checks active job/epoch on publication, so late replies cannot replace newer output. Disposable renderer instances and generation-tagged IDs reject stale callbacks. Exact ordered unit completion is required; missing callbacks, timeouts and skips do not count as completed signing. The final smoke includes an explicitly controlled dropped-callback/retry check, not a claimed production incident.

## Limits and operations

- Limited corpus coverage, conservative Bangla detectors and incomplete nonmanual grammar can block output or produce unsuitable signing. No accuracy or comprehension claim is made. Unsupported critical concepts remain visible.
- Source video/captions require permission. Real processing sends captions, title and context to OpenAI. store:false does not establish zero provider retention.
- The remote UEA service and WebGL are required for avatar replay. Saved captions and gaps remain available during renderer failure. Real mobile memory/performance is unverified.
- Public sample links are intentionally read-only. Other projects are private until sharing is enabled. Revocation stops future reads; signed source URLs can remain valid for 15 minutes. Owner-cookie loss has no account recovery in this scope.
- Non-pinned media expires after 72 hours. Cleanup targets 96 hours when daily reconciliation runs; jitter/outages can delay it. Upload leases delay safe physical purge. Pinned demos are excluded.
- OpenAI error-rate and budget gates can stop processing while preserving replay. Verification used USD 0.101634 of an approved USD 4 existing-credit ceiling; no new model calls are requested for Phase 8. SQL lifetime/day caps remain USD 0.30 preview and USD 0.70 production. Free infrastructure only; no purchases/upgrades/billing changes.
- Production uses Workflows; no lease fallback is claimed. Preview is a separate Neon Free project rather than a branch, as recorded in [deviations](docs/DEVIATIONS.md). Anchors, learner pace presets, simultaneous overlay, embeddings and ASR were cut at the feature freeze.

See [limitations](docs/LIMITATIONS.md), [production runbook](docs/PRODUCTION-RUNBOOK.md) and [dated fallback recordings](docs/UEA-FALLBACK-CAPTURE.md).

## Attribution and prior work

IsharaKotha V2, DOI [10.17632/6ykgx65ks5.2](https://data.mendeley.com/datasets/6ykgx65ks5/2), CC BY 4.0: MD. Ashikul Islam, Prato Dewan, Md Fuadul Islam, Md Ataullha Saim and M Shahidur Rahman. Only gloss identifiers are derived as lowercase ASCII; motion XML is retained. Renderer: remote unmodified [UEA CWASA vhg2026](https://vhg.cmp.uea.ac.uk/tech/jas/vhg2026/), Anna avatar; [conditions](https://vh.cmp.uea.ac.uk/index.php/CWASA_Conditions_of_Use). No engine/avatar redistribution is claimed.

SignOLight and IsharaKotha are prior video/text-to-avatar work. SignBridge claims the tested integration of source-frame holds, durable caption edits, saved replay and explicit gaps, not invention of those research categories. Corpus-level review does not establish quality of a newly composed track. Full [attribution](docs/ATTRIBUTION.md).

## Submission package

[Five-slide Markdown](submission/deck.md) · [PDF](submission/deck.pdf) · [Devpost draft](submission/devpost.md) · [English recording script](submission/demo-video-script.md) · [handoff](submission/HANDOFF.md). The owner records the optional video and submits; no Devpost publication or user study has been performed by this build.
