# Official documentation checked — 2026-11-03

Versions installed are pinned exactly by `package-lock.json`.

| Component | Installed version | Official reference | Result |
|---|---|---|---|
| Next.js | 16.4.4 | https://nextjs.org/docs/app/getting-started/installation | App Router; manual scaffold preserves supplied files; separate lint/build commands. |
| Drizzle ORM / kit | 0.45.4 / 0.31.11 | https://orm.drizzle.team/docs/connect-pglite ; https://orm.drizzle.team/docs/connect-neon | PGlite local and Neon WebSocket Pool adapters as specified. |
| PGlite | 0.5.14 | https://pglite.dev/docs/ | Empty-database migrations and catalog comparison run against actual PostgreSQL in WASM. |
| Neon driver | 1.2.0 | https://orm.drizzle.team/docs/connect-neon | Pool configured with `ws`; no real URL or credential used. |
| CWASA | vhg2026 remote release | https://vhg.cmp.uea.ac.uk/tech/jas/vhg2026/ | Remote engine unmodified; standard Anna avatar only. |
| CWASA configuration | vhg2026 | https://vh.cmp.uea.ac.uk/index.php/Configuring_CWASA_for_HTML5_web_pages | `init`, `playSiGMLText`, `addHook` and the documented init configuration used. |
| CWASA hooks | vhg2026 | https://vh.cmp.uea.ac.uk/index.php/Logging_and_Event_Hooks | Hook payloads wrapped with instance identity; terminal duplicate sign event is not counted as another unit. |
| CWASA conditions | vhg2026 | https://vh.cmp.uea.ac.uk/index.php/CWASA_Conditions_of_Use | No engine modification, self-hosting, evaluation avatars or offline export. |

OpenAI, Vercel Blob and Workflow SDK are not installed or called in phase 1. Their current official docs must be checked before phase-4 implementation. No assumption about those APIs was implemented here.
