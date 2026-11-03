# Limitations

Experimental · not reviewed by a BdSL signer.

- Technical renderability is the only evidence category evaluated in phase 1. No qualified BdSL reviewer has assessed the fixture and no user comprehension study has been conducted.
- The unrelated corpus entries in the fixture do not form a claimed translation.
- Software WebGL on a Windows host does not establish performance or compatibility on mobile hardware.
- UEA serves the remote, unmodified renderer with no availability warranty. The host reports loading until `avatarready`; a missing engine never establishes completed signing.
- Phase 2 has pure domain logic and corpus artifacts, but no real model calls, upload flow, scheduling, durable production workflow, business routes, sharing implementation or review UI. The in-process dispatcher exercises an injected SQL outbox/claim boundary only; crash recovery orchestration belongs to phase 4.
- PGlite files are local development storage, not durable Vercel storage. Production requires an owner-approved Neon configuration. `/api/health` checks DB connectivity; it does not claim that migrations have been applied, signing is correct, or production processing is enabled.
- The official event sticker is missing. The banner's explicit placeholder will load `/event-sticker.png` once the official asset is supplied.
- The fixed XML whitelist excludes 131 distinct full-release files with nonmanual elements outside that whitelist, alongside 43 other rejected hashes. Their source paths and reasons remain in the import evidence. These exclusions limit coverage; no motion or nonmanual content was silently removed to make an asset pass.
- Only the 20 supplied sample assets have been render-probed and made eligible. Accepted-but-untested assets remain ineligible. Curated-subset testing belongs to phase 7.
- Retrieval stemming and independent Bangla detectors are deliberately coarse. Ambiguous words and suffixes can produce conservative blocking; they do not validate BdSL semantics. P3 checks candidate provenance or exact labels, and never uses lossy retrieval text directly as proof.
- Strict schema tests are offline contract checks against the published OpenAI subset. They do not claim a live API accepted a schema, model accuracy, or translation accuracy.
