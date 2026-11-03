## Status
PARTIAL (official sticker missing; preview deployment NOT RUN: Vercel logged out).

## Checks
| Command | Exit code | Pass / fail / skip counts |
|---|---|---|
| `npm run typecheck` | 0 | 1 / 0 / 0 |
| `npm run lint` | 0 | 1 / 0 / 0; no warnings |
| `npm test -- --reporter=default --reporter=json --outputFile=docs/evidence/vitest-results.json` | 0 | 22 / 0 / 0; 8 files |
| `npm run build` | 0 | 1 / 0 / 0; production build |
| `npm run db:generate` | 0 | 1 / 0 / 0; 19 tables, no drift |
| `npm run db:migrate` | 0 | 1 / 0 / 0; local PGlite |
| `npm run test:e2e` | 0 | 4 / 0 / 0; Chromium + msedge, production server |
| `npm run check:secrets` | 0 | 1 / 0 / 0; exact documented nonsecret-line exceptions |
| `npx --yes vercel@latest whoami` | 1 | 0 / 0 / 1; logged out, preview NOT RUN |

## Acceptance tests
| T-ID | PASS / FAIL / NOT RUN | Test file path | Evidence or reason |
|---|---|---|---|
| P1-FOUNDATION | PASS | [foundation.spec.ts](E:/AIgnite-Lab/signbridge/tests/e2e/foundation.spec.ts) | Production build; global banner, placeholder and attribution verified in both browsers. |
| P1-SCHEMA | PASS | [schema.test.ts](E:/AIgnite-Lab/signbridge/tests/contract/schema.test.ts) | All 19 tables, columns/defaults, enums, constraints and indexes match §C.2; cascade/SET NULL and repeat migrations pass. |
| P1-ADAPTERS | PASS | [adapters.test.ts](E:/AIgnite-Lab/signbridge/tests/unit/adapters.test.ts), [dispatcher.test.ts](E:/AIgnite-Lab/signbridge/tests/contract/dispatcher.test.ts) | Filesystem round trip/path confinement, deterministic fake and one SQL run claim under duplicate dispatch. |
| P1-COOKIE | PASS | [ownerCookie.test.ts](E:/AIgnite-Lab/signbridge/tests/unit/ownerCookie.test.ts) | 256-bit capabilities, SHA-256 digest, validation and HttpOnly/Secure/SameSite=Lax flags. |
| P1-BOUNDARIES | PASS | [ownership.test.ts](E:/AIgnite-Lab/signbridge/tests/unit/ownership.test.ts), [secretScanner.test.ts](E:/AIgnite-Lab/signbridge/tests/unit/secretScanner.test.ts) | Invalid ownership imports/transitions and new credential markers are rejected. |
| P1-HEALTH | PASS | [health.test.ts](E:/AIgnite-Lab/signbridge/tests/contract/health.test.ts), [foundation.spec.ts](E:/AIgnite-Lab/signbridge/tests/e2e/foundation.spec.ts) | Live DB round trip; §G.1 response, disabled processing and sanitized 503 behavior. |
| T23 | PASS | [renderer.spec.ts](E:/AIgnite-Lab/signbridge/tests/e2e/renderer.spec.ts) | Both browsers: 5 units/164 frames, instance hooks, Origin:null/no cookie; zero final CSP violations. Screenshots: docs/evidence/t23-{chromium,msedge}.png. |
| P1-STICKER | NOT RUN | [foundation.spec.ts](E:/AIgnite-Lab/signbridge/tests/e2e/foundation.spec.ts) | Official sticker missing (blocker); owner-approved labelled placeholder passes. No imitation created. |
| P1-PREVIEW | NOT RUN | — | Vercel CLI 65.10.0 is logged out; no preview URL or deployed health check. |

## Deviations
- 2026-11-03 · phase 1 · §G.2 / phase-1 build 7 · The official event sticker is absent; render an explicitly labelled placeholder that loads `/event-sticker.png` when supplied · Owner instructed this fallback and required the missing official sticker to remain a report blocker; no asset was created or imitated · `assets/` absent at start, owner reply in this chat; `app/EventSticker.tsx` and browser foundation checks.
- 2026-11-03 · phase 1 · §G.4 / phase-1 build 3 · The secret scanner allows only hashes of exact pre-existing instructional lines and the generated queue-microtask 1.2.3 npm registry URL; every other occurrence of the forbidden prefix fails · A literal whole-repo scan would reject the required existing specification itself, including a natural-language word; those files must remain untouched · `scripts/secret-scan-baseline.json`, `tests/unit/secretScanner.test.ts`; three original matching lines across `SYSTEM-DESIGN.md` and `execution/phase-1.md`, plus the exact registry URL line in `package-lock.json`.
- 2026-11-03 · phase 1 · §G.4 (provisional renderer CSP) · Add `script-src-attr 'unsafe-inline'` exclusively to `/renderer.html`; script elements still require self or the UEA origin, with no inline-script or eval allowance · Unmodified CWASA vhg2026 generates GUI event attributes that trigger six CSP violations under the provisional script policy · `docs/evidence/t23-csp-initial.json`; current release https://vhg.cmp.uea.ac.uk/tech/jas/vhg2026/ and configuration https://vh.cmp.uea.ac.uk/index.php/Configuring_CWASA_for_HTML5_web_pages ; final browser evidence records the measured policy.

## Risks / open questions
- Blocker: official sticker missing. Owner instructed use of a labelled slot; supply `public/event-sticker.png` when available.
- Preview NOT RUN because Vercel is logged out. No secrets used or Vercel environment values set; future secret use requires approval.
- T23 covers one Windows host with software WebGL, technical rendering only. No BdSL review, comprehension evidence or mobile-hardware result.
- Local dispatcher implements the SQL outbox/claim transport boundary; production workflows and crash recovery remain phase 4. Scheduler/standby replacement remain phase 5.
- `SYSTEM-DESIGN.md` unchanged: SHA-256 `ad91e87cde437b3cd430ef7102d51d9c7e7093875d68faf24369330aba307e4d`.

## Files
Output of `git show --stat --format= --stat-count=35 --stat-width=100 phase-1`:

```text
 .env.example                          |   10 +
 .gitignore                            |   12 +
 .npmrc                                |    1 +
 .nvmrc                                |    1 +
 AGENTS.md                             |   42 ++
 README.md                             |   37 ++
 SYSTEM-DESIGN-REVIEW.md               |  127 ++++
 SYSTEM-DESIGN.md                      | 1662 +++++++++++++++++++++++++++++++++++++++++++++++++++++
 app/EventSticker.tsx                  |   10 +
 app/about/page.tsx                    |    3 +
 app/api/health/route.ts               |    7 +
 app/globals.css                       |    1 +
 app/layout.tsx                        |   12 +
 app/p/[projectId]/page.tsx            |    1 +
 app/page.tsx                          |    4 +
 app/renderer-spike/Spike.tsx          |   25 +
 app/renderer-spike/page.tsx           |    4 +
 app/s/[projectId]/page.tsx            |    1 +
 docs/ATTRIBUTION.md                   |    8 +
 docs/DEVIATIONS.md                    |    5 +
 docs/LIMITATIONS.md                   |   11 +
 docs/evidence/deployment.md           |   11 +
 docs/evidence/fixture-provenance.json |   28 +
 docs/evidence/official-docs.md        |   16 +
 docs/evidence/playwright-results.json |  337 +++++++++++
 docs/evidence/t23-chromium.json       | 1601 +++++++++++++++++++++++++++++++++++++++++++++++++++
 docs/evidence/t23-chromium.png        |  Bin 0 -> 135054 bytes
 docs/evidence/t23-csp-initial.json    | 1645 ++++++++++++++++++++++++++++++++++++++++++++++++++++
 docs/evidence/t23-msedge.json         | 1602 +++++++++++++++++++++++++++++++++++++++++++++++++++
 docs/evidence/t23-msedge.png          |  Bin 0 -> 135354 bytes
 docs/evidence/t23-summary.md          |   22 +
 docs/evidence/vitest-results.json     |    1 +
 docs/phase-reports/phase-1.md         |   83 +++
 drizzle.config.ts                     |    2 +
 eslint.config.mjs                     |   35 ++
 ...
 113 files changed, 19761 insertions(+)
```
