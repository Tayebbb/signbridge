# Phase 5 — Player: renderer host, scheduler, creator workspace

Read `AGENTS.md`, then `SYSTEM-DESIGN.md` §0.3, §C.4, §C.6, §D.7, §E.1–E.9 (all), §G.4 (third-party script, CSP), §H.1 rows T3, T7, T22, T23. Use the phase-1 spike results and `docs/DEVIATIONS.md`.

## Goal
A creator can upload a clip + captions, start processing, watch progress, and play the published track in signature mode with honest states — on desktop Chrome/Edge.

## Build
1. `lib/player/rendererHost.ts` (§E.3a): disposable sandboxed iframe instance per cancellation boundary, standby instance, `event.source` + `instanceId` filtering, WebGL check, engine-load timeout.
2. `lib/player/scheduler.ts`: state machine exactly as the §E.4 diagram and §E.5 pseudocode — separate clocks (§E.2), generation-tagged lowercase IDs, completion only on `animidle` **plus** the exact ordered-distinct ID sequence (§E.7), watchdog → `SignIncomplete` with Retry/Skip (never counts as complete), `GapBlocking` card shown **before** any play command with auto-advance held, `SegmentSkipped`, pause = restart segment (§E.6), speed presets limited to §E.6.
3. `lib/player/store.ts` + UI: manifest + stale map, current-track polling, header counts only `played_complete`.
4. Pages: `app/page.tsx` (landing, create project, "Try a sample" placeholder), `app/p/[projectId]/page.tsx` (upload with rights attestation and personal-data notice, transcript view with merge/split before processing, job progress polling 1.5 s→5 s with ETag, player). Layout §E.8: source video + signing panel S/M/L, caption toggle, prev/next/replay. Status dimensions shown separately (§C.1 / P0-8). All copy follows §0.3.
5. Fake CWASA engine for tests that emits **real unscoped payloads** (lowercase `avatarsign` at sign start, terminal duplicate, `sigmlloaded`, `animidle`), driven from the phase-1/review probe observations.

## Tests
- **T7**: 1,000 randomized interleavings of late events from removed instances and old generations → 0 stale transitions; dropped-message counter asserted.
- **T22**: injected silence, missing unit, ID mismatch, critical gap → correct states, `played_incomplete` telemetry, header counts.
- **T3** and **T23** live (network, headless Edge/Chromium with software WebGL): 3-unit + two 1-unit assets through the app's renderer frame → `sigmlloaded.s = 5`, ID sequence matches `unitGlossIds`; cookie-bearing fetch from the frame rejected; forged messages dropped.
- Playwright e2e (fake model, fake or live engine): upload → transcript → job → playback → reload plays the same `manifestHash`.

## Out of scope
Edits UI after processing, share view, delete UI, About page, mobile tuning.

## Done when
All listed tests green (live ones PASS or NOT RUN with reason); screenshots of ready / gap-card / incomplete states in `docs/evidence/`. End-of-phase steps per `AGENTS.md`.
