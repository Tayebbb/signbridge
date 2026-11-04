# Data lifecycle and recovery

Updated 5 November 2026. This policy describes implemented behavior and operational limits; it does not promise zero provider retention.

| Data | Lifetime and control |
|---|---|
| Non-pinned source video | Becomes unavailable after 72 hours. Cleanup removes expired objects and releases the SQL charge only after successful deletion. Daily full reconciliation targets removal within 96 hours; outages/jitter can extend it. |
| Pinned public examples | Retained for reproducibility. Actual reads are now subject to the same monthly transfer allowance as other media. |
| Captions, saved manifests and source confirmations | Retained while their project exists, even after video expires. Creator deletion immediately hides the project and revokes its sharing authority. |
| Project-associated jobs, segments, assets references and render events | Purged with the project, after outstanding upload reservations can no longer recreate objects. Failed removal is retried; it does not free storage prematurely. |
| Shared stage-result cache | Removed when its last project reference disappears, or when an unreferenced entry is more than 30 days old. Another project's live reference prevents deletion. |
| Render telemetry | Retained for 14 days, subject to successful maintenance. It contains bounded technical event fields, not captions, source URLs or keys. Browser classification is coarse, without raw user-agent storage. |
| Rate-limit windows | Removed after two days by maintenance. IP addresses are hashed into scopes, not stored as raw addresses. |
| Spend reservations and budget totals | Retained as accounting records; deleting a project never refunds uncertain/settled provider spending. |
| Creator cookie | Secure, HttpOnly, SameSite=Lax, host-only, 180-day lifetime. Clearing it still removes browser access. |
| Recovery key | Only a hash is stored. Save the downloaded file privately. Creating a replacement revokes the old recovery key. Recovery rotates the creator cookie and invalidates other creator sessions. |

There is no identity-based support override. Without a current creator cookie or a saved recovery key, ownership cannot be established by knowing a project URL. Save both the recovery file and creator URLs before clearing browser data. Never post the recovery file to GitHub, issue trackers, chats or telemetry.

## Providers and exports

Real processing sends the supplied captions, relevant context and title to OpenAI, with `store:false`. This setting is not a guarantee about every category of provider retention. Vercel Blob holds videos privately; Neon holds application records; Workflow transports identifiers while durable stage data lives in SQL. Each provider's account terms, backups and incident controls apply separately. The remote UEA renderer receives the composed animation markup, not the owner/admin credentials; application referrers are suppressed.

Application deletion does not certify erasure from provider backups or previously downloaded copies. An authorized viewer can retain material already received. New source reads go through live owner/share checks; the application no longer exposes reusable Blob download URLs. An in-flight read can finish after revocation, but subsequent range requests are rejected.

## Backup and disaster recovery

1. Export backups only to private storage, with credentials supplied through an approved private environment file or process environment. Never upload an unencrypted database dump as a public Actions artifact.
2. Keep a separate, private record of project deletions/share revocations and owner/recovery-key rotations newer than the backup. A stale backup alone cannot establish the latest revocations.
3. Restore into an isolated database first. Keep processing disabled and public routing disconnected. Verify schema, immutable manifest hashes, spend records and object references.
4. Apply newer deletion/revocation records. If continuity cannot be established, run `quarantineRestoredDatabase` against the isolated restored database: it revokes all restored share links and creator/recovery capabilities, cancels active jobs, fences old runs and removes spend headroom. Never run this against the live service. Data recovery must not silently restore access that was revoked later.
5. Reconcile provider spending separately; never reset the budget ledger or resume paid work solely because an older snapshot reports a smaller balance.
6. Verify the candidate with key-free saved replay. Route traffic only after the recovery controls and remaining spend are established. Reissue creator access through a private, verified operator procedure if blanket revocation was required.

The automated drill uses two disposable local PostgreSQL databases and verifies a logical dump/restore followed by fail-closed quarantine of stale access and spending. It does not certify Neon point-in-time recovery, every stale-backup scenario or an uptime guarantee. RPO/RTO are operational goals to measure, not guarantees supplied by this implementation.
