import { sql } from "drizzle-orm";
import { pgTable, pgEnum, uuid, text, timestamp, integer, smallint, bigint, bigserial, boolean, jsonb, customType, check, unique, index, primaryKey, type AnyPgColumn } from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });
const time = (name: string) => timestamp(name, { withTimezone: true });
const big = (name: string) => bigint(name, { mode: "bigint" });
export const projectStatus = pgEnum("project_status", ["active", "deleting"]);
export const visibility = pgEnum("visibility", ["private", "unlisted"]);
export const mediaStatus = pgEnum("media_status", ["pending_upload", "ready", "rejected", "expired"]);
export const transcriptSource = pgEnum("transcript_source", ["srt", "vtt", "pasted", "asr_draft"]);
export const sourceCheck = pgEnum("source_check", ["unconfirmed", "creator_confirmed"]);
export const assetKind = pgEnum("asset_kind", ["lexical", "sentence"]);
export const renderState = pgEnum("render_state", ["untested", "rendered_ok", "render_failed"]);
export const aliasSource = pgEnum("alias_source", ["filename", "corpus_metadata", "curated_manual"]);
export const jobStatus = pgEnum("job_status", ["queued", "running", "succeeded", "partial", "failed", "cancelled", "superseded"]);
export const dispatchState = pgEnum("dispatch_state", ["pending", "started"]);
export const stageKind = pgEnum("stage_kind", ["meaning", "plan"]);
export const reservationState = pgEnum("reservation_state", ["reserved", "settled", "held_uncertain", "released"]);
export const trackTech = pgEnum("track_tech", ["complete", "partial", "failed"]);
export const reviewerKind = pgEnum("reviewer_kind", ["qualified_bdsl_reviewer"]);
export const reviewVerdict = pgEnum("review_verdict", ["reviewed_acceptable", "reviewed_needs_changes", "reviewed_unacceptable"]);

export const owners = pgTable("owners", {
  recoveryHash:bytea("recovery_hash").unique(),
  id: uuid("id").primaryKey().defaultRandom(), tokenHash: bytea("token_hash").notNull().unique(),
  createdAt: time("created_at").notNull().defaultNow(), lastSeenAt: time("last_seen_at").notNull().defaultNow(),
});
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(), ownerId: uuid("owner_id").notNull().references(() => owners.id, { onDelete: "cascade" }),
  title: text("title").notNull(), status: projectStatus("status").notNull().default("active"), visibility: visibility("visibility").notNull().default("private"),
  shareTokenHash: bytea("share_token_hash").unique(), shareCreatedAt: time("share_created_at"), rightsAttestedAt: time("rights_attested_at").notNull(),
  currentTranscriptVersionId: uuid("current_transcript_version_id").references((): AnyPgColumn => transcriptVersions.id, { onDelete: "set null" }),
  currentTrackVersionId: uuid("current_track_version_id").references((): AnyPgColumn => trackVersions.id, { onDelete: "set null" }),
  activeJobId: uuid("active_job_id").references((): AnyPgColumn => jobs.id, { onDelete: "set null" }),
  processingEpoch: big("processing_epoch").notNull().default(sql`0`), lockVersion: integer("lock_version").notNull().default(0), createdAt: time("created_at").notNull().defaultNow(),
}, t => [check("projects_title_check", sql`length(${t.title}) <= 120`)]);
export const media = pgTable("media", {
  storageCharge:text("storage_charge").notNull().default("pending"),
  id: uuid("id").primaryKey().defaultRandom(), projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  blobPathname: text("blob_pathname").notNull().unique(), contentType: text("content_type").notNull(), declaredBytes: integer("declared_bytes").notNull(),
  sizeBytes: integer("size_bytes"), clientSha256: text("client_sha256").notNull(), clientDurationMs: integer("client_duration_ms").notNull(), width: integer("width"), height: integer("height"),
  status: mediaStatus("status").notNull().default("pending_upload"), reservationExpiresAt: time("reservation_expires_at").notNull(), expiresAt: time("expires_at").notNull(),
  pinned: boolean("pinned").notNull().default(false), createdAt: time("created_at").notNull().defaultNow(),
}, t => [index("media_project_ready").on(t.projectId,t.status,t.clientSha256,t.createdAt,t.id),index("media_cleanup").on(t.status,t.expiresAt),check("media_storage_charge_check",sql`${t.storageCharge} IN ('pending','committed','released')`),check("media_content_type_check", sql`${t.contentType} IN ('video/mp4','video/webm')`), check("media_declared_bytes_check", sql`${t.declaredBytes} BETWEEN 1 AND 15728640`), check("media_client_duration_ms_check", sql`${t.clientDurationMs} <= 90000`)]);
export const storageLedger = pgTable("storage_ledger", {
  transferMonth:text("transfer_month").notNull().default("1970-01"),
  id: smallint("id").primaryKey(), capBytes: big("cap_bytes").notNull(), committedBytes: big("committed_bytes").notNull().default(sql`0`), pendingBytes: big("pending_bytes").notNull().default(sql`0`),
  estTransferBytes: big("est_transfer_bytes").notNull().default(sql`0`), transferCapBytes: big("transfer_cap_bytes").notNull(),
}, t => [check("storage_ledger_id_check", sql`${t.id} = 1`), check("storage_ledger_check", sql`${t.committedBytes} >= 0 AND ${t.pendingBytes} >= 0`)]);
export const transcriptVersions = pgTable("transcript_versions", {
  requestKey:text("request_key"),requestHash:text("request_hash"),
  id: uuid("id").primaryKey().defaultRandom(), projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }), versionNo: integer("version_no").notNull(),
  parentVersionId: uuid("parent_version_id").references((): AnyPgColumn => transcriptVersions.id, { onDelete: "set null" }), source: transcriptSource("source").notNull(),
  cues: jsonb("cues").notNull(), editSummary: jsonb("edit_summary"), segmenterVersion: text("segmenter_version").notNull(), sourceFormVersion: text("source_form_version").notNull(),
  textHash: text("text_hash").notNull(), createdAt: time("created_at").notNull().defaultNow(),
}, t => [unique().on(t.projectId, t.versionNo),unique().on(t.projectId,t.requestKey)]);
export const segments = pgTable("segments", {
  id: uuid("id").primaryKey().defaultRandom(), transcriptVersionId: uuid("transcript_version_id").notNull().references(() => transcriptVersions.id, { onDelete: "cascade" }), idx: integer("idx").notNull(),
  startMs: integer("start_ms").notNull(), endMs: integer("end_ms").notNull(), cueFrom: integer("cue_from").notNull(), cueTo: integer("cue_to").notNull(),
  sourceText: text("source_text").notNull(), retrievalText: text("retrieval_text").notNull(), segmentKey: text("segment_key").notNull(), sourceCheck: sourceCheck("source_check").notNull().default("unconfirmed"),
}, t => [check("segments_end_ms_check", sql`${t.endMs} > ${t.startMs}`), unique().on(t.transcriptVersionId, t.idx)]);
export const corpusReleases = pgTable("corpus_releases", {
  id: text("id").primaryKey(), doi: text("doi").notNull(), license: text("license").notNull(), attribution: text("attribution").notNull(), manifestSha256: text("manifest_sha256").notNull(), importedAt: time("imported_at").notNull().defaultNow(),
});
export const signAssets = pgTable("sign_assets", {
  id: text("id").primaryKey(), corpusReleaseId: text("corpus_release_id").notNull().references(() => corpusReleases.id), kind: assetKind("kind").notNull(), labelBn: text("label_bn").notNull(),
  labelPhraseForm: text("label_phrase_form").notNull(), sourcePaths: text("source_paths").array().notNull(), originalSha256: text("original_sha256").notNull().unique(),
  derivedSha256: text("derived_sha256").notNull(), derivedSigml: text("derived_sigml").notNull(), unitCount: integer("unit_count").notNull(), units: jsonb("units").notNull(),
  derivationVersion: text("derivation_version").notNull(), renderState: renderState("render_state").notNull().default("untested"), renderEvidence: jsonb("render_evidence"), eligible: boolean("eligible").notNull().default(false),
}, t => [check("sign_assets_unit_count_check", sql`${t.unitCount} >= 1`)]);
export const assetAliases = pgTable("asset_aliases", {
  aliasNorm: text("alias_norm").notNull(), assetId: text("asset_id").notNull().references(() => signAssets.id), source: aliasSource("source").notNull(),
}, t => [primaryKey({ columns: [t.aliasNorm, t.assetId] })]);
export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(), projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  transcriptVersionId: uuid("transcript_version_id").notNull().references(() => transcriptVersions.id, { onDelete: "cascade" }), processingEpoch: big("processing_epoch").notNull(),
  idempotencyKey: text("idempotency_key").notNull(), status: jobStatus("status").notNull().default("queued"), cancelRequested: boolean("cancel_requested").notNull().default(false),
  dispatchState: dispatchState("dispatch_state").notNull().default("pending"), dispatchAttempts: integer("dispatch_attempts").notNull().default(0), workflowRunId: text("workflow_run_id"),
  runClaim: text("run_claim"), heartbeatAt: time("heartbeat_at"), driver: text("driver").notNull().default("workflows"), leaseOwner: text("lease_owner"), leaseExpiresAt: time("lease_expires_at"),
  leaseEpoch: big("lease_epoch").notNull().default(sql`0`), progress: jsonb("progress").notNull().default(sql`'{}'`), modelProfile: text("model_profile").notNull(), lastError: jsonb("last_error"),
  resultTrackVersionId: uuid("result_track_version_id"), createdAt: time("created_at").notNull().defaultNow(), updatedAt: time("updated_at").notNull().defaultNow(), finishedAt: time("finished_at"),
}, t => [unique().on(t.projectId, t.idempotencyKey), index("jobs_active").on(t.projectId).where(sql`${t.status} IN ('queued','running')`), index("jobs_dispatch").on(t.createdAt).where(sql`${t.dispatchState} = 'pending'`)]);
export const stageResults = pgTable("stage_results", {
  cacheKey: text("cache_key").primaryKey(), stage: stageKind("stage").notNull(), schemaVersion: text("schema_version").notNull(), modelId: text("model_id").notNull(), promptVersion: text("prompt_version").notNull(),
  output: jsonb("output").notNull(), outputHash: text("output_hash").notNull(), validation: jsonb("validation").notNull(), createdAt: time("created_at").notNull().defaultNow(),
});
export const stageResultRefs = pgTable("stage_result_refs", {
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }), cacheKey: text("cache_key").notNull().references(() => stageResults.cacheKey, { onDelete: "cascade" }),
}, t => [primaryKey({ columns: [t.projectId, t.cacheKey] }),index("stage_refs_cache_key").on(t.cacheKey)]);
export const stageAttempts = pgTable("stage_attempts", {
  provider:text("provider").notNull().default("unknown"),
  id: bigserial("id", { mode: "bigint" }).primaryKey(), jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }), segmentIdx: integer("segment_idx").notNull(),
  stage: stageKind("stage").notNull(), cacheKey: text("cache_key").notNull(), attemptNo: integer("attempt_no").notNull(), outcome: text("outcome").notNull(), errorCode: text("error_code"), latencyMs: integer("latency_ms"),
  inputTokens: integer("input_tokens"), outputTokens: integer("output_tokens"), reasoningTokens: integer("reasoning_tokens"), reservationId: uuid("reservation_id"), costUsdMicros: big("cost_usd_micros").notNull().default(sql`0`), createdAt: time("created_at").notNull().defaultNow(),
}, t => [index("stage_attempts_provider_time").on(t.provider,t.createdAt),check("stage_provider_check",sql`${t.provider} IN ('unknown','openai','fake')`),check("stage_attempts_attempt_no_check", sql`${t.attemptNo} BETWEEN 1 AND 4`), unique().on(t.jobId, t.segmentIdx, t.stage, t.attemptNo)]);
export const spendBudgets = pgTable("spend_budgets", {
  scope: text("scope").primaryKey(), capMicros: big("cap_micros").notNull(), reservedMicros: big("reserved_micros").notNull().default(sql`0`), spentMicros: big("spent_micros").notNull().default(sql`0`),
});
export const spendReservations = pgTable("spend_reservations", {
  id: uuid("id").primaryKey().defaultRandom(), attemptKey: text("attempt_key").notNull().unique(), dayScope: text("day_scope").notNull(), amountMicros: big("amount_micros").notNull(),
  actualMicros: big("actual_micros"), state: reservationState("state").notNull().default("reserved"), createdAt: time("created_at").notNull().defaultNow(), resolvedAt: time("resolved_at"),
},t=>[index("spend_reservations_state_time").on(t.state,t.createdAt)]);
export const trackVersions = pgTable("track_versions", {
  id: uuid("id").primaryKey(), projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }), transcriptVersionId: uuid("transcript_version_id").notNull().references(() => transcriptVersions.id, { onDelete: "cascade" }),
  mediaContentSha256: text("media_content_sha256").notNull(), trackFingerprint: text("track_fingerprint").notNull(), manifest: jsonb("manifest").notNull(), manifestHash: text("manifest_hash").notNull(), technicalStatus: trackTech("technical_status").notNull(),
  createdByJobId: uuid("created_by_job_id").references(() => jobs.id, { onDelete: "set null" }), createdAt: time("created_at").notNull().defaultNow(),
}, t => [unique().on(t.projectId, t.trackFingerprint)]);
export const visualAnchors = pgTable("visual_anchors", {
  id: uuid("id").primaryKey().defaultRandom(), projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }), mediaContentSha256: text("media_content_sha256").notNull(), frameMs: integer("frame_ms").notNull(),
  imagePathname: text("image_pathname").notNull(), labelBn: text("label_bn"), segmentStartMs: integer("segment_start_ms").notNull(), segmentEndMs: integer("segment_end_ms").notNull(), confirmedBy: text("confirmed_by").notNull().default("creator"), createdAt: time("created_at").notNull().defaultNow(),
}, t => [check("visual_anchors_label_bn_check", sql`length(${t.labelBn}) <= 80`)]);
export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(), trackVersionId: uuid("track_version_id").notNull().references(() => trackVersions.id, { onDelete: "cascade" }), manifestHash: text("manifest_hash").notNull(), rendererProfile: text("renderer_profile").notNull(),
  segmentIdx: integer("segment_idx"), reviewerRef: text("reviewer_ref").notNull(), verdict: reviewVerdict("verdict").notNull(), notes: text("notes"), createdAt: time("created_at").notNull().defaultNow(),
});
// Phase 3 additive journals; original C.2 constraints remain unchanged.
export const ownerDailyQuotas=pgTable("owner_daily_quotas",{
  ownerId:uuid("owner_id").notNull().references(()=>owners.id,{onDelete:"cascade"}),dayScope:text("day_scope").notNull(),freshClips:integer("fresh_clips").notNull().default(0),replannedSegments:integer("replanned_segments").notNull().default(0),
},t=>[primaryKey({columns:[t.ownerId,t.dayScope]}),check("owner_quota_fresh_check",sql`${t.freshClips} BETWEEN 0 AND 3`),check("owner_quota_replan_check",sql`${t.replannedSegments} BETWEEN 0 AND 10`)]);
export const anchorStorage=pgTable("anchor_storage",{
  anchorId:uuid("anchor_id").primaryKey().references(()=>visualAnchors.id,{onDelete:"cascade"}),declaredBytes:integer("declared_bytes").notNull(),sizeBytes:integer("size_bytes"),state:text("state").notNull().default("pending_upload"),reservationExpiresAt:time("reservation_expires_at").notNull(),
},t=>[check("anchor_declared_bytes_check",sql`${t.declaredBytes} BETWEEN 1 AND 300000`),check("anchor_size_bytes_check",sql`${t.sizeBytes} IS NULL OR ${t.sizeBytes} BETWEEN 1 AND ${t.declaredBytes}`),check("anchor_state_check",sql`${t.state} IN ('pending_upload','ready','deleting')`)]);
export const renderEvents = pgTable("render_events", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(), trackVersionId: uuid("track_version_id").references(() => trackVersions.id, { onDelete: "cascade" }), segmentIdx: integer("segment_idx"), kind: text("kind").notNull(), detail: jsonb("detail"), uaClass: text("ua_class"), createdAt: time("created_at").notNull().defaultNow(),
},t=>[index("render_events_kind_time").on(t.kind,t.createdAt),index("render_events_time").on(t.createdAt),index("render_events_track").on(t.trackVersionId)]);
export const apiRequests=pgTable("api_requests",{
  scope:text("scope").notNull(),key:text("key").notNull(),requestHash:text("request_hash").notNull(),response:jsonb("response").notNull(),createdAt:time("created_at").notNull().defaultNow(),
},t=>[primaryKey({columns:[t.scope,t.key]})]);
export const rateWindows=pgTable("rate_windows",{
  scope:text("scope").notNull(),windowStart:time("window_start").notNull(),count:integer("count").notNull(),
},t=>[primaryKey({columns:[t.scope,t.windowStart]}),check("rate_count_check",sql`${t.count} >= 0`)]);
export const opsSettings=pgTable("ops_settings",{key:text("key").primaryKey(),value:jsonb("value").notNull()});
