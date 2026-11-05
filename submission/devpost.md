## What SignBridge does

**SignBridge is an experimental web app that pairs a short video and Bangla captions with a saved avatar-signing track.** It plays one section of the original video, pauses the video, and then plays the available avatar signs for that section. The Bangla captions remain visible so viewers can refer to the original words.

Warnings identify detected gaps in the signing track. A segment marked as incomplete stays incomplete, even after its available animations have played.

## How to use it

1. **Upload your video and captions.** Use a permitted MP4 or WebM, up to 90 seconds and 15 MB. Supply Bangla SRT, WebVTT or timestamped captions. The app does not transcribe audio.
2. **Check the text.** Preview the caption segments and correct anything that needs changing.
3. **Build a signing track.** The app analyses the captions, selects from its available sign-animation library, and saves the resulting track.
4. **Watch each segment.** The original video plays first; the avatar signs afterward while the video holds. Captions stay visible during signing.
5. **Replay or share.** Replaying a saved track does not make another AI request. You can create a view-only link, revoke it, or correct captions and generate a new track.

When the app flags unsupported meaning in a segment, a warning appears before its available signs can play. Viewers can read the caption, choose to play the partial signs, or skip the segment. Partial signing never counts as fully signed.

## Inspiration

SignBridge explores an additional way to present Bangla video for Deaf and hard-of-hearing audiences. Its central design goal is to keep the source words available and make missing information visible. The intended accessibility benefit still needs evaluation with the people who would use it.

## How it is built

The live application connects real services:

- **Next.js, React and TypeScript on Vercel** provide the interface and server API.
- **Neon PostgreSQL with Drizzle** stores projects, captions, jobs, saved tracks and usage records.
- **Private Vercel Blob storage** holds uploaded videos. Authorization is checked before streaming.
- **OpenAI Responses and Vercel Workflows** analyse supplied captions and process plans in the background. Plans can reference only retrieved entries from the available animation library.
- **UEA CWASA with the Anna avatar** plays the selected IsharaKotha sign animations. Source motion is not modified to force a result.

Saved results retain the selected motion and its provenance. Caption edits produce a new result; an older job cannot replace newer work. Recovery keys allow creator access to be restored after losing the browser session.

## What has been verified

Upload, caption preview, real AI processing, database persistence, private video storage, saved playback and sharing have been exercised against the connected services.

- **Animation library:** 2,927 of 2,934 accepted entries passed technical rendering checks. The seven failures remain excluded. This establishes playback, not correct BdSL.
- **Ordinary-video test:** a real 29-second Bengali interview produced nine signing units, meaning nine pieces of avatar motion. All nine played in order. All four video segments still contained critical gaps, so **zero segments counted as fully signed**.
- **Software checks:** the verified release passed 234 default tests, 53 PostgreSQL tests and 32 browser checks across Chromium and Edge. The complete dependency audit reported zero vulnerabilities.

Exact results and known failures are recorded in the repository. The ordinary-video result shows both the functioning pipeline and the remaining coverage problem.

## Challenges and lessons

The difficult parts included caption edits during processing, delayed playback events, failed uploads, private video streaming and bounded AI usage. These needed explicit rules and regression tests.

The main lesson was that a working animation pipeline is only one part of a signing tool. Names, quantities, context and relationships may be missing from the available library. Those gaps must remain visible.

## Current limitations and next steps

**SignBridge is experimental and unreviewed. It is not a validated Bangla Sign Language translator.** Output may omit or misrepresent meaning even when the avatar animates successfully. No qualified BdSL review or Deaf-user comprehension study has been completed. Physical Android and iPhone testing is also still pending.

Next steps are to improve source-grounded vocabulary coverage, review specific outputs with qualified Deaf/BdSL reviewers, evaluate comprehension separately, and test physical mobile devices. The intended accessibility benefits are not claimed as proven.

## Try it and inspect the evidence

- [Open the live application](https://signbridge-sable-sigma.vercel.app)
- [View the source code](https://github.com/Tayebbb/signbridge)
- [Read current results and limitations](https://github.com/Tayebbb/signbridge/blob/main/docs/COVERAGE-FOLLOWUP.md)

The supplied five-slide deck and English narrated explainer include an earlier release snapshot. Their on-screen counts may differ from the current results linked above. The video combines illustrations and earlier technical captures.

## Credits

Sign data: **IsharaKotha v2**, by MD. Ashikul Islam, Prato Dewan, Md Fuadul Islam, Md Ataullha Saim and M Shahidur Rahman; [DOI 10.17632/6ykgx65ks5.2](https://doi.org/10.17632/6ykgx65ks5.2), **CC BY 4.0**. Gloss identifiers were adapted for the app; source motion XML is unchanged. Dataset-level review is not claimed as review of SignBridge's generated tracks.

Avatar renderer: the unmodified remote **University of East Anglia CWASA / Anna** engine, under its [conditions of use](https://vh.cmp.uea.ac.uk/index.php/CWASA_Conditions_of_Use). Related work, including SignOLight, is credited in the repository. Built with AI coding assistance; no claim to be the first video-to-avatar tool.
