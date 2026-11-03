# Limitations

Experimental · not reviewed by a BdSL signer.

- Technical renderability is the only evidence category evaluated in phase 1. No qualified BdSL reviewer has assessed the fixture and no user comprehension study has been conducted.
- The unrelated corpus entries in the fixture do not form a claimed translation.
- Software WebGL on a Windows host does not establish performance or compatibility on mobile hardware.
- UEA serves the remote, unmodified renderer with no availability warranty. The host reports loading until `avatarready`; a missing engine never establishes completed signing.
- Phase 1 has no parsers, real model calls, upload flow, scheduling, durable production workflow, business processing, sharing implementation or review UI. The in-process dispatcher exercises an injected SQL outbox/claim boundary only; crash recovery orchestration belongs to phase 4.
- PGlite files are local development storage, not durable Vercel storage. Production requires an owner-approved Neon configuration. `/api/health` checks DB connectivity; it does not claim that migrations have been applied, signing is correct, or production processing is enabled.
- The official event sticker is missing. The banner's explicit placeholder will load `/event-sticker.png` once the official asset is supplied.
