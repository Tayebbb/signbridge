# YouTube upload metadata

Published on 5 November 2026: **https://youtu.be/goRXOQeq9lQ**, **Unlisted**. YouTube displayed “Video published” and its automated copyright check reported “No issues found.” This is a platform-check result, not a language-quality assessment.

File supplied by the owner: `ad/signbridge-explainer-voiced.mp4`.

Verified: 1920×1080 H.264, AAC mono audio, 304.900 seconds, 34,558,638 bytes. SHA-256: `476b08479e96cbd72dee410c75327599e4428ba29f6214c152ab9f20bcc0610e`.

Visibility: **Unlisted**, accessible to judges through its link. Audience: general product/technical presentation, not made specifically for children.

Saved attributes: English; Science & Technology; no paid promotion; AI use disclosed; embedding allowed; subscriber notification disabled; remixing disabled. The six topic tags identify the project, Bangla Sign Language/BdSL, accessibility and the buildathon. The owner expressly approved the required YouTube Terms/Guidelines acknowledgment.

## Title

SignBridge | Bangla Video Signing Companion | YUNet AIgnite 2026

## Description

SignBridge is an experimental web app that pairs a short video and Bangla captions with a saved avatar-signing track. Each video segment plays first, then pauses while its available avatar signs play. The captions remain visible.

Try the live app: https://signbridge-sable-sigma.vercel.app
Source code: https://github.com/Tayebbb/signbridge
Current results and limitations: https://github.com/Tayebbb/signbridge/blob/main/docs/COVERAGE-FOLLOWUP.md
Devpost project: https://devpost.com/software/signbridge-6pw9f7

HOW TO USE IT
1. Upload a permitted MP4/WebM video and Bangla SRT, WebVTT or timestamped captions. Videos can be up to 90 seconds and 15 MB.
2. Preview the caption segments and correct the text if needed.
3. Generate a signing track from the available sign-animation library.
4. Watch the original video and avatar signs in sequence. Replay or share the saved result without another AI request.

WHEN SIGNS ARE MISSING
The app shows a warning before partial signing can play. You can read the caption, choose to play the available signs, or skip the segment. A segment with missing critical meaning stays incomplete, even after its animations finish. Captions are required; automatic audio transcription is not included.

WHAT IS WORKING
The live app uses real Next.js/Vercel hosting, Neon PostgreSQL, private Vercel Blob storage, Vercel Workflows and OpenAI Responses. Uploads, caption editing, background processing, saved playback, creator recovery and revocable sharing are implemented. The avatar uses existing IsharaKotha sign animations through UEA CWASA / Anna.

CURRENT LIMITS
Signing is experimental and unreviewed. SignBridge is not a validated Bangla Sign Language translator. Animated output may omit or misrepresent meaning. In a real 29-second Bengali interview test, nine animation units played in order, but all four segments retained critical gaps and zero counted as fully signed. No qualified BdSL review or Deaf-user comprehension study has been completed. Physical Android/iPhone testing is also still pending.

ABOUT THIS VIDEO
This English narrated explainer was made for Ostad Presents YUNet AIgnite Buildathon 2026. It combines illustrations and earlier technical captures. The test, corpus and spending figures shown in the video are an earlier snapshot; use the current-results link above for the latest evidence.

CREDITS
IsharaKotha v2 sign data: MD. Ashikul Islam, Prato Dewan, Md Fuadul Islam, Md Ataullha Saim and M Shahidur Rahman. DOI: https://doi.org/10.17632/6ykgx65ks5.2 . License: CC BY 4.0. Gloss identifiers were adapted for the app; source motion XML is unchanged.

Renderer: the unmodified remote University of East Anglia CWASA / Anna engine, under its conditions of use: https://vh.cmp.uea.ac.uk/index.php/CWASA_Conditions_of_Use . Related work, including SignOLight, is credited in the repository.

Built with AI coding assistance. No claim of being the first video-to-avatar tool.
