# Production hardening — 5 November 2026

**Status: IN PROGRESS — engineering fixes deployed; hosted CI and public-browser verification pending. Language review and physical-device checks remain unavailable.**

This follow-up addresses the [4 November audit](audits/production-readiness-2026-11-04/REPORT.md) without rewriting the original phase reports, tags or immutable design. Implementation is isolated on `fix/production-readiness-2026-11-04`; concurrent main-checkout edits are preserved.

## Findings and disposition

| ID | Engineering change / remaining boundary |
|---|---|
| R01 | Refresh generations reject delayed pointers/manifests and stale 404s; edit markers cannot be cleared by superseded work. |
| R02 | Pointer/manifest polling performs no Blob GET or transfer debit. Actual reads use an authorized stream. |
| R03 | Per-object cleanup failures retain their charge and allow other work; cron stops on zero progress. |
| R04 | Narrow playback reveals the avatar; synthesized-touch regression checks visibility. Physical hardware remains unavailable. |
| R05 | Automatic cooldown has a minimum sample and expiry, separate from the manual stop; attempt admission observes both. |
| R06 | Idle visibility events preserve readiness/completion without replacing the renderer. |
| R07 | OPEN: qualified BdSL correctness and comprehension evidence remain NONE. Automated checks cannot provide these. |
| R08 | Persistent owner cookies, hashed/exportable recovery keys, key replacement and session rotation. |
| R09 | Bounded read admission, no idle debit, transfer admission for every actual upstream read including pins; local load evidence only, not a hosted capacity guarantee. |
| R10 | Eight query indexes and an independent schema/catalog reference; representative-volume EXPLAIN captured. |
| R11 | Responsive Next.js delivery of the unchanged official PNG. Original bytes/provenance retained. |
| R12 | No standby until first signing; at most active + standby thereafter, with ownership barriers retained. |
| R13 | Bounded initial server retries, terminal exhausted dispatch and prepared independent scheduled reconciliation. |
| R14 | CI/monitoring workflows and operations procedure prepared; local logical restore with fail-closed quarantine. Hosted recovery targets and provider outage behavior are not certified. |
| R15 | PARTIAL: automated WCAG checks, keyboard bypass, mobile interaction and recovery flows; no physical phones, screen-reader qualification or actual Safari result claimed. |
| R16 | Workflow 5.3.0 retained; compatible minimatch subtree pinned to 11.0.4. Production dependency audit must remain green. |
| R17 | Bounded telemetry fields, coarse browser/device groups, delivery counters and request correlation; remote error text is classified before logging. |
| R18 | Explicit retention/recovery policy and a restored-snapshot quarantine that revokes old access, pauses processing, fences jobs and removes spend headroom. |

## Verification

Local gates passed: 214 default tests, 53 native PostgreSQL tests, 22 product-browser checks (11 Chromium + 11 Edge), and four real-renderer foundation checks. Typecheck, lint, production build and the production dependency audit passed; the audit reports zero vulnerabilities. Failed attempts are not counted as passes. A parallel test run exhausted shared-host memory; sequential reruns passed with bounded build workers.

Preview and production migration 0005 passed without changing model accounting. A staged production upload ran through real private Blob storage, Neon, Vercel Workflows and two OpenAI stages: the job succeeded for one covered segment, costing USD 0.002590. Saved replay preserved the manifest and made no new model call; an actual authorized range read returned HTTP 206. The resulting production build was promoted on 5 November. Public health and responsive-image checks pass. Full public browser and hosted CI results will be added before closure.

The public repository is [Tayebbb/signbridge](https://github.com/Tayebbb/signbridge). Publication preserves original phase tags and uses sequential atomic pushes without rewriting published history. Release CI, five-minute best-effort recovery monitoring and a read-only public-browser workflow are included. Final run links and the twenty-push ledger will accompany the release.

The native load test uses 20 simulated viewers, 200 pointer requests and 10,000 media records. The restore drill uses two isolated PostgreSQL databases. Both are technical fixtures, not language or hosted-availability evidence. Evidence is retained under `docs/evidence/hardening-2026-11-05/`.

## Scope and remaining limits

- No invented human review, participant results or physical-device observations. The owner requested automated substitutes; accurate experimental/unreviewed disclosures remain.
- Real adapters remain production-only. Deterministic fakes are used only in clearly identified local/CI tests.
- Infrastructure stays on free plans. Existing OpenAI credits remain capped at USD 4 combined, with minimum practical consumption and no purchases or billing changes.
- Original `phase-1`…`phase-8` tags/reports retain their historical meaning. This hardening release gets a separate dated tag.
