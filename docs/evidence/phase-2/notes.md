# Phase 2 technical evidence — 2026-11-03 (Asia/Dhaka)

The full public IsharaKotha v2 release was downloadable without credentials. All 3,990 manifest entries are represented by 3,108 downloaded, size/hash-verified distinct byte sequences. Raw originals are cached under ignored `.data/corpus/raw`; source URLs, original byte hashes and attribution are retained in the generated artifacts.

Import: 2,934 accepted distinct assets, 5,037 animation units, 5,908 normalized filename/label aliases. Quarantine: 174 distinct hashes covering 245 source paths. Of these, 131 use nonmanual elements outside the exact design whitelist (`hnm_head`, `hnm_mouthpicture`, etc.); 43 fail other XML/root/ASCII checks. No whitelist expansion or motion repair was performed. The full reasons are in `import.json`, and all accepted data plus seed SQL are committed under `data/corpus`.

The 20 supplied sample hashes correspond to 29 source paths in the full release. Tests retain these paths to exercise real deduplication. The probe runs each distinct sample asset once, using generation-tagged lowercase gloss IDs in the existing opaque-origin renderer. It checks unit count, nonzero frames/frame events, ordered IDs, an active-to-idle animation, and absence of CSP violations. Each check is bound to asset ID, derived bytes and renderer profile. Successful checks are used to regenerate the seed; all other assets remain ineligible.

`asset_render_checks` is the JSON evidence collection in `asset-render-checks.json`. Its records are embedded in `sign_assets.render_evidence` by the existing-schema SQL seed. No table or application transaction is added in this phase.

The full seed is applied to empty PGlite and applied again to verify idempotence. Pure domain/contracts modules are lint-restricted from filesystem, environment, network, database, player and SDK access; CPU hashing via `node:crypto` is permitted.

Caption parsing is line-oriented with a 64-KB UTF-8 cap, 300-cue cap and 90-second boundary. Errors carry a code, 1-based source line and 0-based cue index. Known caption formatting is stripped; unknown tags including script remain literal text. Pasted input closes each cue at the next timestamp and takes the last end from the caller's clip duration (90 seconds is the bounded default).

Segmentation closes the current group before adding a cue that would exceed the 12-second/25-word cap. An oversize single cue remains intact; cues are never split. The context window contains only up to two preceding and one following source texts and the source-form title.

M1 compares model surfaces after NFC/whitespace only. M2 forces all six protected roles critical. M3 requests repair on independent detector disagreement, then adds blocking evidence on the final validation path. P3 uses the documented candidate-provenance alternative or exact label equality, avoiding direct use of lossy retrieval forms for validation. Manifest presentation puts the blocking card before all timeline assets, forces captions and excludes blocked segments from ready counts. No routes, model client, scheduler or business transaction is implemented.

Official references checked:

- OpenAI Structured Outputs: https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses — Zod 4.6.7 generated schema contracts; offline checks only, no API request or credential.
- XML parser: https://github.com/NaturalIntelligence/fast-xml-parser — 5.11.2; `processEntities:false`, declarations rejected before parsing, whitelist and derived-attribute checks, lexical gloss replacement preserves motion bytes.
- Corpus/CC BY 4.0: https://data.mendeley.com/datasets/6ykgx65ks5/2 .
- CWASA vhg2026 hooks: https://vh.cmp.uea.ac.uk/index.php/Logging_and_Event_Hooks — unmodified remote engine, Anna, existing sandbox wrapper.

Rendering is technical evidence only. No BdSL correctness, qualified review, comprehension, mobile-hardware compatibility or live OpenAI acceptance is claimed. The Phase 1 missing official sticker and unavailable authenticated Vercel deployment remain outside this phase's scope.
