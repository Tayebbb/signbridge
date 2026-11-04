# SignBridge production-readiness audit — 4 November 2026

**Status: NOT READY for general production. The current evidence supports a controlled, explicitly experimental demo.**

The application has substantial correctness and security safeguards, and its recorded phase gates pass. This wider audit nevertheless reproduced six engineering failures and identified twelve further readiness gaps. Passing the phase gates did not establish safe client response ordering, idle transfer accounting, usable mobile playback, service capacity, linguistic correctness, or comprehension.

## Scope and confidence

- Audited public deployment: [SignBridge](https://signbridge-mdtayebibne-4755s-projects.vercel.app), Vercel deployment `dpl_DaNDUZQ8KeS1qDsAh9rooxtioUXZ`, observed READY on Node 24.
- Source baseline: commit `a3e0a8dbc629a329c8bbb64fc9af24753dd309ff`. Local reproductions import the isolated `bb75bb0` release worktree, whose application/runtime source matches this baseline. File/line references below refer to this committed version, not the changing shared checkout.
- Concurrent scheduler, frontend, package and test edits were excluded and preserved. A working-copy fix is not evidence that the deployed release is fixed.
- Methods: graph-assisted source review; real application/API/SQL and player-store reproductions with controlled local fixtures; public browser playback; desktop and mobile emulation; synthesized touch; production PostgreSQL read-only catalog/statistics/EXPLAIN queries; dependency advisory review; exact-value checks of nine observed startup JavaScript bundles.
- No new model calls, deployment, environment changes, purchases, content edits, share-token rotations or destructive tests. Public playback can emit normal render telemetry. Local fault injections used synthetic data and made no remote writes.
- Not performed: physical Android/iPhone tests, Safari testing, qualified BdSL review, comprehension evaluation, sustained/concurrent load, exhaustive penetration testing, backup restore or outage exercises. Unproven risks are labelled as such.
- Immutable `SYSTEM-DESIGN.md` remains SHA-256 `AD91E87CDE437B3CD430EF7102D51D9C7E7093875D68FAF24369330ABA307E4D`. This audit makes no implementation or design change and is not another numbered build phase.

## Finding inventory

P1 means material work before an ordinary public release. P2 means a substantive improvement or bounded risk. A documented gap is not a reproduced incident. There are **18 findings: 0 P0, 11 P1, 7 P2, 0 P3**. These priorities apply to the proposed general-production use, rather than the narrower submission/demo gates.

| ID | Priority | Finding | Evidence class |
|---|---|---|---|
| R01 | P1 | Delayed refresh can replace a newer track and clear stale markers | Local reproduction with real TrackStore |
| R02 | P1 | Idle polling charges the entire video repeatedly without downloading it | Local reproduction with real API, SQL and TrackStore |
| R03 | P1 | One unrelated Blob-delete failure blocks a new upload despite spare storage | Local fault injection with real admission/cleanup |
| R04 | P1 | Mobile Play starts signing with the avatar completely outside the viewport | Live deployment; Chromium touch emulation |
| R05 | P1 | A single model failure can latch processing off for everyone | Local synthetic provider row + real SQL switch |
| R06 | P2 | Idle visibility change moves Ready to Paused | Live deployment; controlled visibility event |
| R07 | P1 | Language coverage, correctness and comprehension remain unestablished | Production corpus count and documented evaluation limits |
| R08 | P1 | Losing the owner session has no creator-access recovery path | Committed auth/UI design review |
| R09 | P1 | Public-read cost, transfer enforcement and multiuser capacity are unproven | Reproduction, source and tiny production dataset |
| R10 | P2 | Query/index shapes will become costly as history grows | Actual production index catalog + source; scale inference |
| R11 | P2 | The small banner image accounts for about 87% of initial home transfer | Live resource measurements |
| R12 | P2 | Two renderer instances impose a large cold-start cost | Live renderer/resource measurements |
| R13 | P1 | Failed job dispatch depends on viewer activity or a daily recovery job | Outbox/reconciliation source and deployed schedule |
| R14 | P1 | Release automation and operational recovery evidence are incomplete | Repository/runbook/config review |
| R15 | P1 | Device and manual accessibility qualification are incomplete | Explicit NOT RUN gates; bounded automated checks |
| R16 | P2 | Dependency tree has an unresolved moderate minimatch advisory | Current npm audit + upstream advisory |
| R17 | P2 | Telemetry loses device and failure information needed for diagnosis | Player/API/operations source review |
| R18 | P2 | Retention, recovery and deletion need a complete operational policy | Source/limitations/runbook review; no restore drill |

## Reproduced failures

### R01 [P1] Old responses can undo newer client state

**Location:** `lib/player/store.ts:9–22`; polling in `app/components/SharedView.tsx:8–10` and `Workspace.tsx`.

`refresh()` does not guard acceptance with a request generation or a single-flight rule. Periodic and action-triggered refreshes can overlap. The SQL publication fence protects database publication; it does not order already outstanding browser responses.

**Reproduction:** hold refresh A, finish refresh B with a newer manifest, mark segment 0 stale after a subsequent edit, then release A. The real TrackStore accepts A's older manifest and clears the stale set. All three assertions passed. This can reintroduce obsolete signing after a correction.

**Required change:** discard superseded responses, associate stale markers with the edit/version that created them, and handle deletion/revocation races consistently. Abort old requests as an optimization, with an acceptance-generation check for correctness.

**Release check:** deliberately reverse response order across an edit and a replacement publication; the older result must never replace the newer track or remove newer stale markers. Evidence: [local reproductions](evidence/local-reproductions.json), `staleResponseRace`.

### R02 [P1] Polling consumes the monthly transfer allowance without video transfer

**Location:** `lib/server/api.ts:120–125`; `lib/db/queries/storage.ts:35–39`; `lib/player/store.ts:20–22`; the 10-second UI polling loops.

Every current-track request admits another full-video transfer and signs a new URL. Meanwhile the client deliberately keeps the existing URL until it is near expiry. A manifest 304 does not avoid this admission.

**Reproduction:** four refreshes of a 12,000,000-byte non-pinned video charged **48,000,000 bytes**, issued four URLs, downloaded **zero blobs**, and retained the first URL. The two track/manifest requests used **56 SQL statements**, or **14 per refresh**, excluding transaction-control statements and the shared page's extra project-details request.

**Impact:** from an empty 6,000,000,000-byte allowance, one visible tab polling a 15,000,000-byte clip every 10 seconds would exhaust the global monthly estimate in about **66.7 minutes**; ten such tabs about **6.7 minutes**. These times are arithmetic projections, not a production saturation test. The pinned demos bypass this debit, which explains why demo replay checks did not catch it.

**Required change:** separate inexpensive track/overlay revalidation from media-URL issuance. Refresh the URL only when needed, and define accounting that corresponds to authorized transfer rather than every metadata poll.

**Release check:** an unchanged visible track can be polled for an hour without issuing redundant URLs or debiting video bytes; expiry renewal, revocation and real transfer limits must still work. Evidence: [local reproductions](evidence/local-reproductions.json), `pollingTransfer`.

### R03 [P1] Cleanup failures propagate into unrelated upload admission

**Location:** `lib/ops/storage.ts:4–9`; `lib/ops/reconcile.ts:21`.

`initMedia()` awaits a global cleanup sweep before reserving space. A single Blob removal exception aborts that sweep and the new request. It can also abort reconciliation before later purge/orphan work.

**Reproduction:** inject one failed DELETE for an expired 12 MB video, then request a 32-byte upload in another project. Admission throws although the 800 MB ledger cap has ample spare capacity.

**Required change:** isolate and report per-object cleanup failures, keep failed objects charged until deletion succeeds, and allow otherwise valid uploads when capacity is available. Retry cleanup separately with bounded work. Do not release storage charges before successful removal.

**Release check:** one failing object cannot block unrelated admissions or the remainder of maintenance; capacity invariants still hold. Evidence: [local reproductions](evidence/local-reproductions.json), `cleanupCoupling`. This is an exception-propagation failure, not an observed infinite cleanup loop.

### R04 [P1] Mobile controls start playback while the avatar is offscreen

**Category:** Responsive interaction. **Location:** `app/components/Player.tsx:27–45`; mobile ordering in `app/globals.css:3`.

The narrow layout places the avatar first, then the source section, then the controls. Tapping Play scrolls to the control but does not bring the avatar back into view.

**Live reproduction:** Chromium at 390×844 with synthesized touch, after tapping Play and reaching `SignPlaying`: renderer top **−651 px**, bottom **−231 px**, visible renderer area **0 pixels**. The Play control remained visible. The user must scroll back during a short animation and can miss the signing completely. Existing tests that explicitly scroll to the renderer do not establish usable product behavior.

**Required change:** keep playback controls near the avatar or deliberately reveal the active signing panel when playback begins, without breaking keyboard focus. Verify all segment sizes, gap/retry cards and source/sign transitions.

**Release check:** the normal touch path keeps the signing visible throughout playback on narrow screens. Then repeat on real phones. Evidence: [measured geometry](evidence/mobile-controls.json), [screenshot](evidence/mobile-after-play.png). This is browser emulation, not a physical-phone result. Suggested UI command: `$impeccable adapt`.

### R05 [P1] The global model circuit breaker has no minimum sample or recovery interval

**Location:** `lib/db/queries/operations.ts:25–32`; processing admission in `lib/server/api.ts`.

A greater-than-20% error rate over the recent window writes `processing=false`, even with just one qualifying attempt. That stored switch remains false after the error window clears, until an administrator acknowledges/resets it.

**Reproduction:** one synthetic `provider='openai'` error row disables processing globally; after eleven simulated minutes it is still disabled. No real model request was made. Fail-closed spend protection is intentional; its small-sample sensitivity and manual recovery are the operational problem.

**Required change:** define minimum evidence, cooldown, an explicit recovery/acknowledgement path and alert ownership. Any half-open recovery must retain hard budget ceilings and avoid uncontrolled retries.

**Release check:** a lone transient failure has the documented bounded effect, sustained failures stop processing, and recovery works without bypassing spend caps. Evidence: [local reproductions](evidence/local-reproductions.json), `circuitBreaker`.

### R06 [P2] A visibility event changes idle state

**Category:** Interaction reliability. **Location:** `lib/player/scheduler.ts:72–82`; `app/components/Player.tsx:16`.

After a segment completed and returned to Ready, a controlled hidden/visibility event on the deployed page changed it to Paused. Resume can then restart signing for the completed segment. The background hook calls `pause()` even when idle.

**Important boundary:** the automated test deliberately changed `document.hidden` and dispatched `visibilitychange`. Native headless tab switching did not change visibility, so native switching is NOT RUN. The state-machine fault is nevertheless reproduced through the real listener and player.

An uncommitted scheduler guard and regression test already exist in the shared checkout. They were preserved and excluded from the deployed-release audit; deployment and complete verification of that fix remain outstanding.

**Release check:** Ready, completed and skipped idle states survive visibility changes; source and signing playback still pause safely. Evidence: [browser audit](evidence/browser-audit.json), `idleVisibility`, and [capture](evidence/idle-tab-return.png). Suggested UI command: `$impeccable harden`.

## Further readiness gaps and bottlenecks

### R07 [P1] Language evidence and useful coverage are not established

Production has **12 eligible sign assets**. The successful public example is a silent synthetic 45-second clip containing six isolated nouns. A deliberately unsupported example proves blocking behavior for one important case. These are valuable technical tests, but do not establish coverage of natural lectures, grammar or meaning.

The Phase 2 and Phase 7 renderability sets are small, curated and must not be added as if independent linguistic trials. Correctness evidence is **NONE** and comprehension evidence is **NONE**, consistently disclosed in the app. There is no qualified-review workflow/evaluation result establishing suitability for dependent use. Conservative lexical checks also have documented false-positive boundaries; model/schema checks do not prove that every critical meaning was retained.

**Required gate:** qualified BdSL review tied to exact rendered versions; independently selected natural-caption cases; measured coverage and critical-gap false positives/negatives; then a consented comprehension evaluation. Keep unsupported/nonmanual assets quarantined until supported and reviewed. Do not increase apparent coverage by stripping meaningful features. Evidence: [production counts](evidence/database-readonly.json), `docs/LIMITATIONS.md`, and the existing phase reports.

### R08 [P1] Creator access is tied to a non-recoverable browser session

**Location:** `lib/auth/ownerCookie.ts:3–17`; creator workflow.

The owner capability uses secure cookie attributes but no `Expires` or `Max-Age`. It is a session cookie; browser session restoration behavior varies. Clearing or losing it leaves no account or recovery-token path to regain editing, share revocation or deletion. The project URL alone is not an owner credential; storing only the token hash correctly prevents reconstructing it from SQL.

**Required gate:** explicitly choose durable-session behavior and a safe creator recovery/export mechanism appropriate to this accountless scope. Explain loss/recovery before creation. Test expired/cleared cookies, another device and recovery/revocation. A full account system is not automatically required.

### R09 [P1] Read costs and real capacity have not been bounded

**Locations:** `lib/server/api.ts:49–55,120–125`; `lib/db/queries/storage.ts:7–12,35–39`; client polling.

- Application rate limits apply to mutations, not the ordinary GET paths. Public reads still do authorization, SQL and, on track requests, URL signing/admission work. Mutation/render limits are **120/60 per hour**, respectively, not per minute.
- Each visible shared page makes three GETs per polling cycle; six polling GETs were observed in 21 seconds. The track+manifest portion alone costs 14 SQL statements in the measured fixture. A conditional response does not remove authorization/DB work.
- All media admission touches one `storage_ledger` row with `FOR UPDATE`, including pinned reads. This is a serialization point; its contention limit is unmeasured.
- Pinned demo media is exempt from the estimated-transfer debit. A valid 15-minute signed URL can also be reused for multiple fetches. The ledger is therefore not a hard bound on actual provider egress. No abuse test was run.
- Actual production had just **3 projects, 3 media records, 20 stage attempts and 40 render events** at the read-only snapshot. No throughput, concurrency or soak limit can be inferred from those counts.
- The production lifetime/day cap is **USD 0.70**, with USD 0.046570 spent and no reservations at the snapshot. This is a deliberately small demo allocation, not evidence of capacity for general use. No automatic budget increase is recommended or authorized by this audit.

**Required gate:** define a supported workload and SLO, fix R02, make read revalidation cheaper, bound public-read pressure, and test representative concurrent viewers/uploads/jobs with fake/local providers. Measure query count, lock wait, function duration, CPU/memory, latency, queue age and real provider usage. Retain free-plan/budget constraints; treat plan changes as a separate decision.

### R10 [P2] Several hot query paths lack matching indexes

The **actual production catalog**, rather than schema assumptions, confirms:

| Table / access pattern | Missing leading index to evaluate |
|---|---|
| Latest ready media by project | `media(project_id, status, created_at, id)` shape |
| Renderer events by recent time/kind or track | Time/kind and track lookup shapes |
| Global model error/usage windows | `stage_attempts(provider, created_at)` shape |
| Spend reservation maintenance by state/time | `spend_reservations(state, created_at)` shape |
| Orphan stage cleanup referencing cache keys | `stage_result_refs(cache_key)` shape |

There are 37 indexes overall, mainly primary/unique indexes; useful partial job indexes already exist. Foreign keys do not automatically provide indexes on referencing columns, as the [PostgreSQL documentation](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK) explains.

**Do not misread the finding:** the current three-row media query took **0.049 ms** and a sequential scan is reasonable at that size. This is an inferred growth bottleneck, not a current slow-database incident. Choose exact column order/partial conditions after representative-volume EXPLAIN and delete/FK tests. Evidence: [catalog, statistics and plan](evidence/database-readonly.json).

### R11 [P2] The official sticker dominates initial transfer

**Category:** Performance. **Location:** banner image delivery in `app/layout.tsx` and `app/globals.css:1`.

The official PNG is 2,000 pixels wide and **1,118,328 bytes**, rendered about 218 px wide on desktop and 124 px on the emulated phone. Its response accounted for about **87%** of observed home-page transfer. On the controlled slow-network run the full page load took about **7.14 seconds**, despite early primary content.

**Required change:** preserve the organizer-supplied original and serve faithful optimized/responsive derivatives, subject to its usage terms. This is a delivery optimization, not permission to redraw or imitate the asset. Establish an image/route byte budget. Evidence: [browser measurements](evidence/browser-audit.json). Suggested UI command: `$impeccable optimize`.

### R12 [P2] Renderer cold starts and duplicate instances need profiling

**Category:** Performance. **Location:** `lib/player/rendererHost.ts:45–58`.

A separate new browser context took **10.44 seconds** from navigation to Ready. The active and standby iframes produced 20 UEA resource requests with **4,637,100 reported response-body bytes**, including two approximately 1.65 MB avatar responses and two approximately 544 KB engine scripts. These payload figures can include cached responses; they are **not an aggregate wire-byte measurement**. Physical GPU memory and sustained frame rate were not measured.

The disposable-instance barrier is important correctness protection. Do not remove it casually. Prioritize active initialization, evaluate lazy/bounded standby warming, profile memory/context churn on phones, and retain source/instance/generation isolation. External UEA availability remains a runtime dependency; hosting changes require checking licensing and official support. Evidence: [renderer measurements](evidence/renderer-resources.json). Suggested UI command: `$impeccable optimize`.

### R13 [P1] Outbox recovery has a long unattended path

**Location:** `lib/db/queries/execution.ts:22–25`; `lib/ops/reconcile.ts`; `vercel.json`.

Initial dispatch and owner polling can recover work, and run claims prevent duplicate authority. However, pending redispatch requires age over 30 seconds and stops after five dispatch attempts. With the owner tab closed and no other opportunistic trigger, the configured fallback reconciliation is only **once daily at 18:00 UTC**. Queued work is not given a short unattended recovery guarantee; exhausting attempts needs an explicit terminal/manual recovery path. Lease primitives exist, but no automatic dispatcher-to-lease failover was established.

**Required gate:** define maximum queue/recovery age, implement or configure a budget-compatible reliable trigger, give exhausted dispatches an actionable state and alert, and exercise dispatch outage with the tab closed. Keep existing claim/fencing guarantees.

### R14 [P1] Operational checks do not yet prove unattended readiness

There are manual quality checks, operational status queries, a runbook and a kill switch. The missing evidence is their reliable operation between developer sessions:

- No committed `.github` CI workflow at the audited revision. External CI was not inspected; automated required checks/branch protection are not established by this audit.
- Admin status computes alerts, but no active delivery/uptime-monitoring path was found in the audited implementation. An operator must inspect it. Responsibility and response time are not established.
- `lib/db/queries/health.ts:3–6` checks DB connectivity and processing state. It does not establish migration compatibility or Blob, Workflow, model or renderer readiness.
- No completed backup-restore exercise, recovery-time/recovery-point target, migration rollback drill or multi-provider outage exercise was found. Existing deployment/redeploy tests are useful but narrower.

**Required gate:** automate the real existing quality gates for isolated source; add R01–R06 regressions; define rollback/migration compatibility and restore drills; alert on queue age, cleanup failure, renderer failure, budgets and the latched switch. Do not expose credentials or make paid canaries necessary for every health request.

### R15 [P1] Device and accessibility qualification remain incomplete

**Category:** Accessibility / Responsive interaction. **Location:** player/create/shared flows; `docs/MOBILE-TEST.md`.

Axe-core 4.14.0 reported **zero automatic violations** on the selected desktop and emulated-mobile home/shared states. Both widths had no horizontal overflow. This does not establish WCAG conformance: incomplete ARIA checks remain, the video-caption rule needs manual context review, and the demonstration source is silent. The checkbox's 18 px input alone is not a proven target-size violation because its clickable label is larger.

Physical Android/iPhone, Safari/WebGL behavior, screen readers, 200–400% zoom, long/error copy, text scaling, focus through retry/replacement, and extended background/foreground sessions are not qualified. R04 demonstrates why viewport screenshots and successful desktop playback are insufficient.

**Required gate:** execute and record a real device/browser matrix and manual keyboard/screen-reader checks with visible signing, captions, gap and incomplete states. Distinguish emulated touch, real touch and physical-device observations. Suggested UI commands: `$impeccable adapt`, `$impeccable harden`.

### R16 [P2] One unresolved advisory propagates across 23 dependency entries

`npm audit --omit=dev` for the pinned release reports **23 moderate affected-package entries, zero high and zero critical**. These are the propagation of **one underlying minimatch advisory**, not 23 independent defects. The [upstream advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249) describes glob-pattern amplification and lists 11.0.1 as the patched version.

The affected tree includes Workflow/build/tooling dependencies. No public application path accepting attacker-controlled glob patterns was found; deployed exploitability is unproven. The automated fix suggestion includes a major Workflow version change/downgrade, so forcing it would be inappropriate.

**Required gate:** trace reachability and apply a compatible supported patch/override or document a time-bounded exception. Run workflow, build and deployment regressions. Evidence: [dependency audit summary](evidence/dependency-audit.json).

### R17 [P2] Operational telemetry hides useful distinctions

**Location:** `app/components/Player.tsx:13`; `lib/server/api.ts:138`; `lib/db/queries/operations.ts`.

The player sends `uaClass:"web"` for every device, so the existing UA grouping cannot distinguish iPhone/Safari failures from desktop. Telemetry non-OK responses are not inspected and network failures are silently ignored. Internal API logs contain only a general code/action and lack a request correlation identifier. Client-reported events are untrusted and can influence public warning counts.

**Required change:** a bounded privacy-preserving browser/device classification, typed/size-limited diagnostic fields, request/job correlation, a measurable telemetry acceptance/drop rate, and separation of client reports from authoritative model/job/storage metrics. Retain the existing exclusion of tokens, captions, URLs and model content from logs.

### R18 [P2] Data lifecycle needs recovery-aware policy and verification

The 72-hour non-pinned source-video lifetime is distinct from retention of transcripts, manifests and model-processing records. Losing a creator cookie can also remove the ordinary deletion control, as R08 explains. The project documents important limitations, but this audit did not establish an operational retention schedule for every durable record, provider-copy/backups treatment or a tested restore/deletion reconciliation procedure.

**Required gate:** make each data category's lifetime, recovery behavior and provider handling explicit; test failed deletion and subsequent retries, lost-owner requests, and restores without reviving revoked access or silently republishing deleted projects. Check applicable obligations against the intended users and actual service terms; this audit is not a legal-compliance determination.

## Measured performance and existing checks

These are individual controlled runs, not population Core Web Vitals or load-test percentiles.

| Observation | Desktop unthrottled | 390 px emulation: 1.6 Mbps, 150 ms latency, 4× CPU |
|---|---:|---:|
| Home LCP | 880 ms | 1,220 ms |
| Home TTFB | 173 ms | 237 ms |
| Home full load event | 842 ms | 7,137 ms |
| Home measured transfer | 1,281,438 bytes | 1,281,268 bytes |
| Home CLS | 0.0032 | 0 |
| Longest observed home task | 56 ms | 408 ms |
| Home/shared horizontal overflow | None observed | None observed |

The separate renderer cold-context result is 10.44 seconds; it should not be confused with homepage LCP or a real-phone measurement.

| Verification | Result | Boundary |
|---|---|---|
| Latest Phase 8 isolated typecheck/lint/default tests | PASS; 194 default tests | Existing dated gate evidence, not rerun against concurrent edits |
| Dated Phase 6 native PostgreSQL/product/foundation checks | PASS; 51 / 16 / 4 | Different suites, not independent end-user population samples |
| New local audit harness | Four scenarios reproduced with assertions | Poll debit, response race, cleanup coupling, latched switch |
| New production browser audit | Ready and saved playback observed; two further defects reproduced | Visibility event is controlled; touch is emulated |
| New selected axe checks | Zero automatic violations | Manual/device qualification incomplete |
| New dependency audit | Non-green: 23 moderate package entries | One advisory; runtime reachability unproven |
| Startup-bundle configured-secret comparison | Zero matches in 9 bundles | Observed startup chunks only |

Existing green checks remain meaningful. They are not invalidated by this audit; their coverage needs expanding. See the [Phase 8 recheck](../../phase-reports/phase-8-recheck-2026-11-04.md) and [Phase 6 recheck](../../phase-reports/phase-6-recheck-2026-11-04.md) for their original commands and evidence.

## Security and correctness strengths to retain

- Random 256-bit owner/share capabilities are stored as hashes. Owner cookies use Secure, HttpOnly, SameSite and the host-only prefix. Owner mutations and shared reads have distinct authority checks.
- Origin checks protect mutations. Structured validation and literal rendering guard hostile input. No successful authorization bypass or XSS was reproduced in this audit.
- A nonce-based application CSP, opaque script-only renderer sandbox, validated message source/instance/generation barriers, and `Referrer-Policy: no-referrer` reduce third-party renderer exposure. The referrer policy also addresses the suspected parent share-URL leakage path; that suspicion is not reported as a vulnerability.
- SQL authority fencing, compare-and-swap edits, immutable manifest identities, transactional spend reservations, private Blob storage and fail-closed critical-gap behavior are substantive safeguards.
- Vercel's handling of `x-forwarded-for` must be considered before alleging spoofable rate limits; its [official documentation](https://vercel.com/docs/headers/request-headers#x-forwarded-for) describes overwriting the external header. No spoofing bypass is claimed here.
- The official organizer sticker is present and the app correctly discloses absent linguistic/comprehension evidence. Preserve those disclosures during improvements.

## Bounded UI quality assessment

**Implementation integrity: PASS for a coherent, product-specific experimental interface.** Real captions, gap states and technical-evidence disclosures give it a specific purpose. The bundled detector found one desktop advisory about a one-word paragraph wrap and none at the mobile width; this cosmetic observation is not a release blocker. The larger failures above are interaction and resource-management failures.

These 0–4 scores follow the applied Impeccable audit rubric and are provisional UI heuristics, not security, WCAG or whole-product certification.

| Dimension | Score | Evidence / limit |
|---|---:|---|
| Accessibility | 2 | Useful labels/focus/captions and clean selected axe scans; manual qualification incomplete |
| Performance | 2 | Early content is quick; large banner, renderer startup and polling costs remain |
| Theming | 2 | Core tokens exist; many state colors remain literal; light theme only is intentional |
| Responsive design | 2 | Layout adapts without observed overflow; active mobile signing can be offscreen |
| Implementation integrity | 3 | Coherent product and honest evidence labels; isolated copy-wrap advisory |
| **Total** | **11/20** | **Acceptable UI foundation; significant work needed** |

For the UI portion: first `$impeccable adapt` for R04/R15, then `$impeccable harden` for state/focus recovery, `$impeccable optimize` for measured resource costs, and finally `$impeccable polish`. A visual redesign cannot repair the API/SQL defects. These commands may be run individually or together; rerun `$impeccable audit` after fixes.

## Release sequence and exit gates

1. **Correctness first:** fix R01–R05; finish and verify the concurrent R06 fix separately. Add targeted regressions for response order, unchanged polling, failed cleanup, narrow-screen playback, circuit-breaker sample/recovery behavior and visibility states.
2. **Repeat the real gates on one isolated candidate:** typecheck, lint, default tests, native PostgreSQL races, product/foundation browser tests, production build and secret checks. Deploy only the reviewed candidate through the established approval scope; don't fold in unrelated shared edits.
3. **Prove operation:** bounded fake-provider load/soak, unattended dispatch recovery, alerts, rollback and restore exercises; verify fixed allowance accounting against actual provider usage. Apply compatible dependency remediation.
4. **Prove user suitability:** real phone/Safari and manual accessibility matrix, qualified BdSL review and separately designed comprehension evidence. Expand corpus only with supported, reviewed assets and measured coverage.
5. **Choose the release label from evidence:** keep a restricted experimental demo while language/user evidence is absent. A general production accessibility claim needs those additional gates; deployment success and phase completion alone cannot supply them.

## Evidence and reproducibility

- [Local failure measurements](evidence/local-reproductions.json) and [local harness source](evidence/reproduce-local.ts.txt). From the repository root, copy the harness to `.data/audit-local.ts` and execute `node node_modules/tsx/dist/cli.mjs .data/audit-local.ts`. It expects the isolated `.data/phase8-release` checkout/dependencies described above, uses a local PGlite fixture and overwrites only its audit JSON. Do not point it at production credentials.
- [Browser measurements](evidence/browser-audit.json), [mobile playback geometry](evidence/mobile-controls.json), [renderer resources](evidence/renderer-resources.json).
- [Read-only production DB evidence](evidence/database-readonly.json), [dependency summary](evidence/dependency-audit.json), [startup-bundle scan result](evidence/bundle-secret-scan.json).
- [Desktop detector](evidence/ui-detector-desktop.json), [mobile detector](evidence/ui-detector-mobile.json), [scope and evidence hashes](evidence/scope.json).
- Captures: [desktop home](evidence/desktop-home.png), [mobile home](evidence/mobile-home.png), [desktop shared](evidence/desktop-shared.png), [mobile shared](evidence/mobile-shared.png), [offscreen avatar after Play](evidence/mobile-after-play.png), [controlled idle visibility](evidence/idle-tab-return.png).

The audit is a point-in-time assessment of the pinned release. The concurrently changing checkout and any later deployment require their own review. No finite audit can establish that every possible defect has been found.
