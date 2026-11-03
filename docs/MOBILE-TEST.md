# Real-device verification — Phase 7

Status: NOT RUN. No physical Android or iPhone result has been supplied. Desktop emulation and software WebGL do not satisfy this checklist. Technical rendering is separate from linguistic correctness and comprehension, both unevaluated.

Run on one physically available mid-range Android with Chrome and one iPhone with Safari. Record unavailable hardware as NOT RUN, with the reason. Use the production URL and pinned covered/unsupported demos after the production gate is ready.

For each device, paste back this record (no owner cookie, signed video URL or admin token):

| Field | Result |
|---|---|
| Capture date/time and timezone | NOT RUN |
| Device model / OS / browser version | NOT RUN |
| Production URL / deployment / track ID / manifest hash | NOT RUN |
| Network type and approximate signal | NOT RUN |
| Cold engine + avatar load time / warm load time | NOT RUN |
| WebGL available? Tab crash, reload or memory warning? | NOT RUN |
| `avatarfps` observations during a full replay | NOT RUN |
| Ordered unit hooks and completion count match expected IDs? | NOT RUN |
| Portrait S / M / L: face, both hands, signing space visible? | NOT RUN |
| Video starts after explicit tap; autoplay denial has a usable recovery? | NOT RUN |
| Pause/resume restarts signing from its first sign? | NOT RUN |
| App switch and screen lock discard old renderer; return recovers? | NOT RUN |
| Source seeking works; Range request returns 206/Content-Range? | NOT RUN |
| Saved reload and share retain hash with no new model attempts? | NOT RUN |
| Unsupported demo gap card precedes playback; captions remain visible? | NOT RUN |
| Blocked UEA / disabled WebGL where possible: explanation and captions usable? | NOT RUN |
| Data usage for one full cold/warm replay | NOT RUN |
| Screenshot/video evidence path (redact private capabilities) | NOT RUN |

Use device developer tools or remote inspection for hooks, FPS and Range evidence; if a measurement cannot be observed, mark that cell NOT RUN. Record layout visibility as a visual observation. Do not interpret it as proof of legibility, comfortable pacing, correct BdSL or Deaf-user comprehension. Send exact failures and recovery steps rather than an overall optimistic score.
