# Production hardening — 5 November 2026

**Status: PARTIAL — engineering fixes are live and automated production playback passes; qualified BdSL/comprehension review and physical-device validation remain unavailable.**

This release addresses the [4 November audit](audits/production-readiness-2026-11-04/REPORT.md). It is a connected technical application with real production providers, with limited signing coverage and experimental output. It is not certified as a general BdSL translation service.

## Acceptance tests

| ID | Result | Evidence / remaining boundary |
|---|---|---|
| R01 | PASS | Refresh generations reject delayed pointers/manifests and stale 404s; unit regressions. |
| R02 | PASS | Metadata polling makes no Blob GET or transfer debit; production saved replay preserves accounting. |
| R03 | PASS | A failed object cleanup remains charged without blocking unrelated admissions; zero-progress reconciliation stops. |
| R04 | PASS, bounded | Product touch regressions plus live Chromium mobile emulation: 420 avatar pixels visible during signing. No physical phone claim. |
| R05 | PASS | Separate manual stop and ten-minute circuit, minimum five attempts/three errors; every attempt observes both. Smaller configured daily limits persist. |
| R06 | PASS | Idle visibility preserves Ready/completion; unit and live public-browser checks. |
| R07 | NOT RUN | Qualified BdSL correctness and comprehension evidence remain NONE. Owner cannot arrange reviewers; automation cannot supply this evidence. |
| R08 | PASS | 180-day owner cookie, hashed downloadable recovery keys, replacement and session rotation; API/browser recovery regressions. Save creator URLs too. |
| R09 | PASS, bounded | Read admission and full-object upper-bound transfer reservation on actual reads, including pins. Local 20-viewer/200-request/10,000-row load passes; no hosted capacity guarantee. |
| R10 | PASS | Eight indexes migrated in preview/production; independent schema/catalog fixtures and representative-volume EXPLAIN. |
| R11 | PASS | Unchanged official PNG, CSP-compatible responsive delivery; live optimized responses 8,746 bytes desktop / 3,324 mobile. |
| R12 | PASS | One idle renderer iframe, standby delayed until signing; real public-browser checks and ownership tests. |
| R13 | PASS | Bounded server dispatch retries, terminal exhausted unclaimed dispatch and independent scheduled reconciliation. Live reconciliation passes. |
| R14 | PASS, bounded | Release CI and five-minute best-effort monitoring configured; successful hosted monitoring; isolated logical restore drill. Provider outage SLA/PITR is unverified. |
| R15 | PARTIAL | Keyboard bypass, responsive/recovery flows and selected axe checks pass. Opaque frame excluded; incomplete rules retained. Physical phones, actual Safari and screen-reader qualification NOT RUN. |
| R16 | PASS | Workflow 5.3.0 retained with compatible minimatch override; production audit zero vulnerabilities, build discovers all four required application steps. |
| R17 | PASS | Bounded diagnostics, coarse device/browser categories, delivery counters and request IDs. Publication/history/startup-bundle scans find no configured credential. |
| R18 | PASS, bounded | Retention/recovery policy and isolated restored-snapshot quarantine revoke stale access, fence jobs, pause processing and remove spend headroom; not Neon PITR certification. |

## Checks

| Check | Result | Evidence |
|---|---|---|
| Typecheck / lint / production build | PASS | Clean local checks; 21 registered SDK steps include all four required application steps. |
| Default tests | 214 PASS, 0 fail/skip | [unit-contract-results.json](evidence/hardening-2026-11-05/unit-contract-results.json) |
| Native PostgreSQL | 53 PASS, 0 fail/skip | [native-results.json](evidence/hardening-2026-11-05/native-results.json) |
| Product browsers | 22 PASS, 0 fail/skip | 11 Chromium + 11 Edge; [browser-runs.json](evidence/hardening-2026-11-05/browser-runs.json) |
| Real opaque renderer foundation | 4 PASS | Windows Chromium/Edge; [foundation results](evidence/hardening-2026-11-05/foundation/playwright-results.json) |
| Production dependency audit | PASS, 0 vulnerabilities | `npm audit --omit=dev --audit-level=moderate` |
| Preview and production migration | PASS | Additive migration 0005, eight indexes; accounting unchanged. |
| Staged real processing | PASS | Private video upload → Neon → Vercel Workflow → two OpenAI stages → ready saved segment; [staged smoke](evidence/hardening-2026-11-05/staged-production-smoke.json). |
| Promoted public API and media | PASS | Health enabled, same canary manifest, range HTTP 206/16 bytes, no new model work or idle transfer; [production smoke](evidence/hardening-2026-11-05/production-smoke.json). |
| Public real browser | PASS | Six desktop segments and one mobile touch segment; exact expected/seen unit order, reload identity, idle visibility. [Hosted run](https://github.com/Tayebbb/signbridge/actions/runs/41907191325), [results](evidence/hardening-2026-11-05/public-browser.json). |
| Hosted live monitoring | PASS | Health, authenticated reconciliation and status: no alerts. [Run](https://github.com/Tayebbb/signbridge/actions/runs/41907181923). |
| Final commit hosted quality gate | REQUIRED before release publication | [Release checks](https://github.com/Tayebbb/signbridge/actions/workflows/quality.yml). Final run result is attached to the dated release; this committed report predates that run. |
| Spend | PASS | USD 0.002590 new; USD 0.104224 combined counted usage; zero reservations, below USD 4 approval. [spend.json](evidence/hardening-2026-11-05/spend.json) |
| Secret/history/client-bundle scan | PASS before commit | Configured private values, key-shaped tokens, binary assets and 17 startup bundles scanned. Final scan attached to the dated release. |

The first hosted quality attempt failed to start its disposable PostgreSQL instance on Linux; setup disables Unix sockets through the fixture configuration and keeps TCP loopback. A later hosted run passed all 53 assertions but caught six unhandled teardown errors: pg-pool ended before its clients' sockets closed, and forced database deletion terminated those closing connections. The fixture now awaits actual client end events for both data/admin pools and uses ordinary database deletion. No error is suppressed and no test is skipped. Duplicate/cancelled attempts are not counted as passing hosted gates. The release must not be published until the corrected hosted gate succeeds.

A parallel local run exhausted shared-host memory; heavy checks passed sequentially with bounded build workers. The later staged local browser attempt did not provide a complete result. The public GitHub-hosted browser run supplies final live playback evidence instead. Mobile results are emulation, not physical hardware. Selected axe checks found no violations but retain incomplete ARIA/video checks and exclude the opaque frame; this is not WCAG certification.

## Release and evidence

- [Public repository](https://github.com/Tayebbb/signbridge) · [Live application](https://signbridge-mdtayebibne-4755s-projects.vercel.app) · [Dated release and final gate artifacts](https://github.com/Tayebbb/signbridge/releases/tag/hardening-2026-11-05).
- Production deployment: `dpl_5jS4t8MUoREJwR7UPhgssCNsKVn5`; preview: `dpl_yp5xfAu288iTWKTHz7xb5GwKXhVt`. Production build was staged and paid-tested before promotion. Public API and real browser checks passed after promotion.
- The requested initial publication is divided into twenty sequential atomic pushes, preserving all original commits, `phase-1`…`phase-8` tags and dated rechecks. A necessary twenty-first corrective push fixes the subsequently discovered Linux teardown race; leaving CI broken or rewriting the published history would hide that failure. This deviation is recorded. The confirmed full push ledger is a release asset rather than a self-referential committed file.
- The release's final hosted-gate attestation similarly records its exact final SHA after this report is committed. It supplements this report without changing its historical bytes.
- Original phase evidence is preserved. New browser/migration/spend/load/restore evidence is under `docs/evidence/hardening-2026-11-05/`; local fixtures and production observations are labelled separately.
- `SYSTEM-DESIGN.md` SHA-256 remains `AD91E87CDE437B3CD430EF7102D51D9C7E7093875D68FAF24369330ABA307E4D`. Deviations are in [DEVIATIONS.md](DEVIATIONS.md). Concurrent main-checkout work was preserved using an isolated worktree.

## Remaining limits and operations

Twelve hash-matched, technically probed assets are enabled. Unsupported concepts and nonmanual features can block output; successful animation is not proof of correct language. No human review or participant results were invented. The requested automated substitutes cover technical behavior only.

Free infrastructure, the 6 GB monthly transfer allowance, conservative full-object read reservations and small spend allocations bound capacity. UEA availability/WebGL and all configured providers remain dependencies. A runtime XSLT deprecation warning is observed; no future browser compatibility is promised. Saved replay does not consume model credits. Videos normally expire after 72 hours; saved captions/manifests remain until deletion.

Follow [OPERATIONS.md](OPERATIONS.md), [DATA-LIFECYCLE.md](DATA-LIFECYCLE.md) and [LIMITATIONS.md](LIMITATIONS.md). GitHub scheduling is best effort; operator failure notifications and incident response remain necessary. Local logical restore and load fixtures establish bounded behavior, not a hosted availability guarantee. No infrastructure purchases, plan upgrades or billing changes were made.
