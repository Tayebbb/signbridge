# Normal Bangla video test — 5 November 2026

**Later follow-up:** the same source/captions produced nine playable units after the coverage fixes, while all four segments remained blocked and the completion count stayed zero. See [COVERAGE-FOLLOWUP.md](COVERAGE-FOLLOWUP.md). The initial failure and accounting below are preserved.

**Status: FAIL for ordinary-video signing — zero of four segments produced any signing. Browser upload was repaired and verified live.**

The owner requested an internet-downloaded normal video. This test used actual human speech and the original published Bengali caption wording, with real production services. It did not substitute isolated words, fake the model/renderer or edit the resulting plan.

## Source

- [WIKITONGUES: Pradeep speaking Bengali](https://commons.wikimedia.org/wiki/File:WIKITONGUES-_Pradeep_speaking_Bengali.webm), credited to **Wikitongues / Hardeep Singh**, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- [Published Bangla subtitles](https://commons.wikimedia.org/wiki/TimedText:WIKITONGUES-_Pradeep_speaking_Bengali.webm.bn.srt). The first eight cues were retained verbatim; no automatic transcription or caption correction was performed.
- Changes to the video: first 28.76 seconds, resized to 640×360 and transcoded to H.264/AAC. Measured duration 28,763 ms; size 780,825 bytes. These changes do not imply endorsement by the source contributors.
- Attribution, source links and derived-file hash: [source.json](evidence/normal-video-2026-11-05/source.json). The adapted source/caption material retains CC BY-SA 4.0 terms. The original full video is 77 seconds and exceeds the app's 15 MB upload limit, so a short excerpt was used.

## Actual results

| Check | Result | Evidence |
|---|---|---|
| Initial production browser upload | FAIL | Upload initialization returned 200, but CSP blocked the presigned PUT to `https://vercel.com/api/blob/`; the UI showed “Failed to fetch.” [Redacted diagnostic](evidence/normal-video-2026-11-05/upload-csp-before.json). |
| Repair regression | PASS | Browser CSP test failed before the fix (expected HTTP 201, received 0); passed in Chromium and Edge afterward. Unrelated Vercel API paths remain blocked. Six foundation checks pass. |
| Fresh staged browser upload | PASS | Real Blob PUT and finalize returned 200; all eight cues yielded four preview segments. No model job was created. [Evidence](evidence/normal-video-2026-11-05/upload-fixed-staged.json). |
| Fresh public browser upload after promotion | PASS | Same result without a protection bypass on the public URL. [Evidence](evidence/normal-video-2026-11-05/upload-fixed.json). |
| Real processing | PARTIAL | The first project's file was uploaded through the real API after the browser failure; the UI started its real Workflow/OpenAI job. The saved manifest uses `gpt-6.1-sol`. This is not claimed as a successful initial browser upload. |
| Normal speech signing coverage | FAIL | Four segments, all `no_signing`, zero SiGML units. No avatar signing sequence could play. [Result metadata](evidence/normal-video-2026-11-05/result.json). |
| Source playback and gap handling | PASS | All four source segments played, retained their captions and showed blocking gaps. Skipping never incremented the completion counter. |
| Saved result / reload | PASS | Reload retained the same manifest hash; no new model job was submitted. |
| Qualified BdSL / comprehension review | NOT RUN | No signer or participant evaluation is available. Zero generated signing is an observed coverage failure, not an accuracy percentage. |

| Segment | Source interval | Technical result | Signing units |
|---|---|---|---|
| 1 | 0.000–3.318 s | no_signing | 0 |
| 2 | 3.320–14.171 s | no_signing | 0 |
| 3 | 14.175–25.119 s | no_signing | 0 |
| 4 | 25.120–28.759 s | no_signing | 0 |

The manifest contains 36 `no_candidate` gap entries and 10 `ambiguous_source` entries; these are entries, not distinct concept counts. Even the introductory pronoun and speech action have no eligible candidates in the currently enabled inventory. Production has only 12 technically probed, hash-matched sign assets. Connecting a real model does not supply the missing motion assets or establish BdSL grammar.

The test also exposed a quantity-validation limitation: `-৮০` was flagged inside the published `৭০-৮০` range, and referent/source-fragment checks produced additional blocking messages. These are retained in the evidence. Caption segmentation, quantity detection and language coverage require further work; no detector was disabled to force a passing result.

## Repair and validation

Upload repair: `f27ac08`, deployment `dpl_SQncTxqg7feLWpCGpArrFbJbnQcB`, promoted to production. Only the required Blob endpoint was added to `connect-src`; script nonces and iframe isolation remain unchanged.

[Hosted quality run](https://github.com/Tayebbb/signbridge/actions/runs/41913635514) passed typecheck, lint, 214 default tests, 53 PostgreSQL tests, production audit/secret scan, 22 product-browser checks and three Chromium foundation checks. Local foundation checks total six across Chromium/Edge. A subsequently corrected test assertion waits for the original stale-message threshold after React updates; targeted Chromium/Edge checks pass. The latest report commit's gate is visible under [Release checks](https://github.com/Tayebbb/signbridge/actions/workflows/quality.yml).

The broad test setup had already validated saved browser replay and server-side real uploads; those checks missed the browser-to-presigned-URL boundary. The new regression exercises that exact boundary under the real document CSP, with only the external transport intercepted in local CI. Final live upload evidence uses actual private Blob storage.

Original phase and hardening evidence is preserved. New foundation and targeted test artifacts are in this report's dated evidence directory. No previous phase tags were moved, and the immutable system design was not edited.

## Cost and remaining limits

The real speech job added USD **0.131478** in counted usage and 12 stage-attempt rows. Combined counted usage is USD **0.235702**, with zero outstanding reservations, below the approved USD 4 ceiling. Fresh upload verification created no additional model job. [Accounting](evidence/normal-video-2026-11-05/spend.json).

The app currently consumes supplied captions; it does not transcribe the video's audio. The normal footage was not pinned and follows the normal 72-hour video lifetime. The unlisted result link was provided to the owner without publishing creator cookies or upload credentials.

The upload repair is live, but this test does **not** support claiming that the app can translate normal Bangla videos into usable BdSL. Broader eligible vocabulary, natural-sentence handling and qualified language/comprehension evaluation remain necessary.
