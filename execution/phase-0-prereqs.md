# Phase 0 — prerequisites (you, by hand, ~30 min)

Not a Codex prompt. Do these before phase 1; anything missing becomes a phase-7 blocker.

- [ ] **Vercel** account (Hobby). Install nothing globally; Codex will use `npx vercel`. Run `npx vercel login` once yourself.
- [ ] **Neon** Postgres via Vercel Marketplace (region us-east-1, next to `iad1`). Keep the pooled and direct URLs.
- [ ] **Vercel Blob** store, **private**. Note the store is linked to the project (OIDC) — `BLOB_READ_WRITE_TOKEN` for local only.
- [ ] **OpenAI** API key in a dedicated project; set the project budget limit in the dashboard if offered (§A.5 outer guard). Confirm `gpt-6.1-sol` and `gpt-6.1-terra` are listed for the key.
- [ ] Put secrets in `E:\AIgnite-Lab\signbridge\.env.local` (never in chat): `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BLOB_READ_WRITE_TOKEN`, `OPENAI_API_KEY`, `ADMIN_TOKEN` (random 32+ bytes), `CRON_SECRET` (random).
- [ ] **Official event sticker** image saved as `E:\AIgnite-Lab\signbridge\assets\event-sticker.png` (from the Devpost/organiser kit).
- [ ] **Demo clips**: 2–3 short (≤60 s, ≤15 MB) Bangla MP4s you own or have rights to, each with an SRT. Choose content inside a small everyday vocabulary (§H.6), plus one sentence with a negation or number you expect to be unsupported. Save to `E:\AIgnite-Lab\signbridge\demo-input\`.
- [ ] A GitHub repo (optional; private is fine until submission).
- [ ] Decide: are you on Vercel Hobby or Pro? (Hobby assumed; cron is then daily.)
