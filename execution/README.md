# SignBridge — execution plan (Codex build, Copilot review)

Deadline: **5 Nov 2026 22:00 +06** (Devpost header; treat 20:00 as the target). Now: 3 Nov ~12:00.
Deliverables (rules): public web app, ≤5 slides, official sticker visible near the top. Optional: English demo video, repo.

## Workflow (token-efficient)

1. You do **phase 0** by hand (accounts, keys, files).
2. For each phase N: open Codex in `E:\AIgnite-Lab\signbridge`, paste `phase-N.md`. Codex auto-loads `AGENTS.md` (standing rules), so prompts stay short and point at design sections instead of copying them.
3. **Gate after each phase** (not only at the end — errors compound): tell me `verify phase N`. I read `docs/phase-reports/phase-N.md`, re-run the checks, and spot-read only the risky files via `git diff phase-(N-1) phase-N`. I return a short numbered fix list.
4. Paste my fix list into Codex as-is; it fixes, re-runs, amends the report, re-tags.
5. Light gates (report-only skim, no re-run): phases 1, 6, 8. Full gates: 2, 3, 4, 5, 7.

## Phases

| # | Phase | Main T-IDs | Target window | Cut if late? |
|---|---|---|---|---|
| 0 | Prerequisites (manual) | — | 3 Nov, 30 min | no |
| 1 | Foundation + renderer-sandbox spike + first deploy | T23 spike | 3 Nov 12–15 | no |
| 2 | Pure domain + corpus import | T4, T5 (domain), T11, T12 (parser), T14, T15 | 3 Nov 15–21 | no |
| 3 | State authority, ledgers, reconciler | T13, T16, T19, T20, T21, T24 | 3 Nov 21 – 4 Nov 02 | no |
| 4 | AI pipeline, jobs, API routes, uploads | T6, T8, T17, T18, T4/T5 (end-to-end with fake) | 4 Nov 08–13 | no |
| 5 | Player: renderer host + scheduler + workspace UI | T3, T7, T22, T23 | 4 Nov 13–19 | no |
| 6 | Product completion: edits, share, delete, failure UX, ops, pages | T2 (local), T10, T12 (full) | 4 Nov 19–22 (**P0 freeze 22:00**) | cut lines §H.5 |
| 7 | Production deploy, demo content, prod verification, mobile | T1, T2, T9, T14 (curated), H.2 | 5 Nov 08–13 | no |
| 8 | Submission package | — | 5 Nov 13–18, submit by 20:00 | no |

Optional O1 (anchors) only if phase 7 is fully green before 5 Nov 12:00.

## What to send me at a gate
Just: `verify phase N`. I will read the report and repo directly. If Codex could not finish, also paste its last message.
