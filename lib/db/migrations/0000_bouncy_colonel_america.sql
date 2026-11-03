CREATE TYPE "public"."alias_source" AS ENUM('filename', 'corpus_metadata', 'curated_manual');--> statement-breakpoint
CREATE TYPE "public"."asset_kind" AS ENUM('lexical', 'sentence');--> statement-breakpoint
CREATE TYPE "public"."dispatch_state" AS ENUM('pending', 'started');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'succeeded', 'partial', 'failed', 'cancelled', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."media_status" AS ENUM('pending_upload', 'ready', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('active', 'deleting');--> statement-breakpoint
CREATE TYPE "public"."render_state" AS ENUM('untested', 'rendered_ok', 'render_failed');--> statement-breakpoint
CREATE TYPE "public"."reservation_state" AS ENUM('reserved', 'settled', 'held_uncertain', 'released');--> statement-breakpoint
CREATE TYPE "public"."review_verdict" AS ENUM('reviewed_acceptable', 'reviewed_needs_changes', 'reviewed_unacceptable');--> statement-breakpoint
CREATE TYPE "public"."reviewer_kind" AS ENUM('qualified_bdsl_reviewer');--> statement-breakpoint
CREATE TYPE "public"."source_check" AS ENUM('unconfirmed', 'creator_confirmed');--> statement-breakpoint
CREATE TYPE "public"."stage_kind" AS ENUM('meaning', 'plan');--> statement-breakpoint
CREATE TYPE "public"."track_tech" AS ENUM('complete', 'partial', 'failed');--> statement-breakpoint
CREATE TYPE "public"."transcript_source" AS ENUM('srt', 'vtt', 'pasted', 'asr_draft');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('private', 'unlisted');--> statement-breakpoint
CREATE TABLE "asset_aliases" (
	"alias_norm" text NOT NULL,
	"asset_id" text NOT NULL,
	"source" "alias_source" NOT NULL,
	CONSTRAINT "asset_aliases_alias_norm_asset_id_pk" PRIMARY KEY("alias_norm","asset_id")
);
--> statement-breakpoint
CREATE TABLE "corpus_releases" (
	"id" text PRIMARY KEY NOT NULL,
	"doi" text NOT NULL,
	"license" text NOT NULL,
	"attribution" text NOT NULL,
	"manifest_sha256" text NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"transcript_version_id" uuid NOT NULL,
	"processing_epoch" bigint NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"cancel_requested" boolean DEFAULT false NOT NULL,
	"dispatch_state" "dispatch_state" DEFAULT 'pending' NOT NULL,
	"dispatch_attempts" integer DEFAULT 0 NOT NULL,
	"workflow_run_id" text,
	"run_claim" text,
	"heartbeat_at" timestamp with time zone,
	"driver" text DEFAULT 'workflows' NOT NULL,
	"lease_owner" text,
	"lease_expires_at" timestamp with time zone,
	"lease_epoch" bigint DEFAULT 0 NOT NULL,
	"progress" jsonb DEFAULT '{}' NOT NULL,
	"model_profile" text NOT NULL,
	"last_error" jsonb,
	"result_track_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "jobs_project_id_idempotency_key_unique" UNIQUE("project_id","idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"blob_pathname" text NOT NULL,
	"content_type" text NOT NULL,
	"declared_bytes" integer NOT NULL,
	"size_bytes" integer,
	"client_sha256" text NOT NULL,
	"client_duration_ms" integer NOT NULL,
	"width" integer,
	"height" integer,
	"status" "media_status" DEFAULT 'pending_upload' NOT NULL,
	"reservation_expires_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_blob_pathname_unique" UNIQUE("blob_pathname"),
	CONSTRAINT "media_content_type_check" CHECK ("media"."content_type" IN ('video/mp4','video/webm')),
	CONSTRAINT "media_declared_bytes_check" CHECK ("media"."declared_bytes" BETWEEN 1 AND 15728640),
	CONSTRAINT "media_client_duration_ms_check" CHECK ("media"."client_duration_ms" <= 90000)
);
--> statement-breakpoint
CREATE TABLE "owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "owners_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"status" "project_status" DEFAULT 'active' NOT NULL,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"share_token_hash" "bytea",
	"share_created_at" timestamp with time zone,
	"rights_attested_at" timestamp with time zone NOT NULL,
	"current_transcript_version_id" uuid,
	"current_track_version_id" uuid,
	"active_job_id" uuid,
	"processing_epoch" bigint DEFAULT 0 NOT NULL,
	"lock_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_share_token_hash_unique" UNIQUE("share_token_hash"),
	CONSTRAINT "projects_title_check" CHECK (length("projects"."title") <= 120)
);
--> statement-breakpoint
CREATE TABLE "render_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"track_version_id" uuid,
	"segment_idx" integer,
	"kind" text NOT NULL,
	"detail" jsonb,
	"ua_class" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_version_id" uuid NOT NULL,
	"manifest_hash" text NOT NULL,
	"renderer_profile" text NOT NULL,
	"segment_idx" integer,
	"reviewer_ref" text NOT NULL,
	"verdict" "review_verdict" NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transcript_version_id" uuid NOT NULL,
	"idx" integer NOT NULL,
	"start_ms" integer NOT NULL,
	"end_ms" integer NOT NULL,
	"cue_from" integer NOT NULL,
	"cue_to" integer NOT NULL,
	"source_text" text NOT NULL,
	"retrieval_text" text NOT NULL,
	"segment_key" text NOT NULL,
	"source_check" "source_check" DEFAULT 'unconfirmed' NOT NULL,
	CONSTRAINT "segments_transcript_version_id_idx_unique" UNIQUE("transcript_version_id","idx"),
	CONSTRAINT "segments_end_ms_check" CHECK ("segments"."end_ms" > "segments"."start_ms")
);
--> statement-breakpoint
CREATE TABLE "sign_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"corpus_release_id" text NOT NULL,
	"kind" "asset_kind" NOT NULL,
	"label_bn" text NOT NULL,
	"label_phrase_form" text NOT NULL,
	"source_paths" text[] NOT NULL,
	"original_sha256" text NOT NULL,
	"derived_sha256" text NOT NULL,
	"derived_sigml" text NOT NULL,
	"unit_count" integer NOT NULL,
	"units" jsonb NOT NULL,
	"derivation_version" text NOT NULL,
	"render_state" "render_state" DEFAULT 'untested' NOT NULL,
	"render_evidence" jsonb,
	"eligible" boolean DEFAULT false NOT NULL,
	CONSTRAINT "sign_assets_original_sha256_unique" UNIQUE("original_sha256"),
	CONSTRAINT "sign_assets_unit_count_check" CHECK ("sign_assets"."unit_count" >= 1)
);
--> statement-breakpoint
CREATE TABLE "spend_budgets" (
	"scope" text PRIMARY KEY NOT NULL,
	"cap_micros" bigint NOT NULL,
	"reserved_micros" bigint DEFAULT 0 NOT NULL,
	"spent_micros" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spend_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_key" text NOT NULL,
	"day_scope" text NOT NULL,
	"amount_micros" bigint NOT NULL,
	"actual_micros" bigint,
	"state" "reservation_state" DEFAULT 'reserved' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "spend_reservations_attempt_key_unique" UNIQUE("attempt_key")
);
--> statement-breakpoint
CREATE TABLE "stage_attempts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"job_id" uuid NOT NULL,
	"segment_idx" integer NOT NULL,
	"stage" "stage_kind" NOT NULL,
	"cache_key" text NOT NULL,
	"attempt_no" integer NOT NULL,
	"outcome" text NOT NULL,
	"error_code" text,
	"latency_ms" integer,
	"input_tokens" integer,
	"output_tokens" integer,
	"reasoning_tokens" integer,
	"reservation_id" uuid,
	"cost_usd_micros" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stage_attempts_job_id_segment_idx_stage_attempt_no_unique" UNIQUE("job_id","segment_idx","stage","attempt_no"),
	CONSTRAINT "stage_attempts_attempt_no_check" CHECK ("stage_attempts"."attempt_no" BETWEEN 1 AND 4)
);
--> statement-breakpoint
CREATE TABLE "stage_result_refs" (
	"project_id" uuid NOT NULL,
	"cache_key" text NOT NULL,
	CONSTRAINT "stage_result_refs_project_id_cache_key_pk" PRIMARY KEY("project_id","cache_key")
);
--> statement-breakpoint
CREATE TABLE "stage_results" (
	"cache_key" text PRIMARY KEY NOT NULL,
	"stage" "stage_kind" NOT NULL,
	"schema_version" text NOT NULL,
	"model_id" text NOT NULL,
	"prompt_version" text NOT NULL,
	"output" jsonb NOT NULL,
	"output_hash" text NOT NULL,
	"validation" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storage_ledger" (
	"id" smallint PRIMARY KEY NOT NULL,
	"cap_bytes" bigint NOT NULL,
	"committed_bytes" bigint DEFAULT 0 NOT NULL,
	"pending_bytes" bigint DEFAULT 0 NOT NULL,
	"est_transfer_bytes" bigint DEFAULT 0 NOT NULL,
	"transfer_cap_bytes" bigint NOT NULL,
	CONSTRAINT "storage_ledger_id_check" CHECK ("storage_ledger"."id" = 1),
	CONSTRAINT "storage_ledger_check" CHECK ("storage_ledger"."committed_bytes" >= 0 AND "storage_ledger"."pending_bytes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "track_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"transcript_version_id" uuid NOT NULL,
	"media_content_sha256" text NOT NULL,
	"track_fingerprint" text NOT NULL,
	"manifest" jsonb NOT NULL,
	"manifest_hash" text NOT NULL,
	"technical_status" "track_tech" NOT NULL,
	"created_by_job_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "track_versions_project_id_track_fingerprint_unique" UNIQUE("project_id","track_fingerprint")
);
--> statement-breakpoint
CREATE TABLE "transcript_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"version_no" integer NOT NULL,
	"parent_version_id" uuid,
	"source" "transcript_source" NOT NULL,
	"cues" jsonb NOT NULL,
	"edit_summary" jsonb,
	"segmenter_version" text NOT NULL,
	"source_form_version" text NOT NULL,
	"text_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transcript_versions_project_id_version_no_unique" UNIQUE("project_id","version_no")
);
--> statement-breakpoint
CREATE TABLE "visual_anchors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"media_content_sha256" text NOT NULL,
	"frame_ms" integer NOT NULL,
	"image_pathname" text NOT NULL,
	"label_bn" text,
	"segment_start_ms" integer NOT NULL,
	"segment_end_ms" integer NOT NULL,
	"confirmed_by" text DEFAULT 'creator' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visual_anchors_label_bn_check" CHECK (length("visual_anchors"."label_bn") <= 80)
);
--> statement-breakpoint
ALTER TABLE "asset_aliases" ADD CONSTRAINT "asset_aliases_asset_id_sign_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."sign_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_transcript_version_id_transcript_versions_id_fk" FOREIGN KEY ("transcript_version_id") REFERENCES "public"."transcript_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_current_transcript_version_id_transcript_versions_id_fk" FOREIGN KEY ("current_transcript_version_id") REFERENCES "public"."transcript_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_current_track_version_id_track_versions_id_fk" FOREIGN KEY ("current_track_version_id") REFERENCES "public"."track_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_active_job_id_jobs_id_fk" FOREIGN KEY ("active_job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "render_events" ADD CONSTRAINT "render_events_track_version_id_track_versions_id_fk" FOREIGN KEY ("track_version_id") REFERENCES "public"."track_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_track_version_id_track_versions_id_fk" FOREIGN KEY ("track_version_id") REFERENCES "public"."track_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segments" ADD CONSTRAINT "segments_transcript_version_id_transcript_versions_id_fk" FOREIGN KEY ("transcript_version_id") REFERENCES "public"."transcript_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sign_assets" ADD CONSTRAINT "sign_assets_corpus_release_id_corpus_releases_id_fk" FOREIGN KEY ("corpus_release_id") REFERENCES "public"."corpus_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_attempts" ADD CONSTRAINT "stage_attempts_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_result_refs" ADD CONSTRAINT "stage_result_refs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_result_refs" ADD CONSTRAINT "stage_result_refs_cache_key_stage_results_cache_key_fk" FOREIGN KEY ("cache_key") REFERENCES "public"."stage_results"("cache_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_versions" ADD CONSTRAINT "track_versions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_versions" ADD CONSTRAINT "track_versions_transcript_version_id_transcript_versions_id_fk" FOREIGN KEY ("transcript_version_id") REFERENCES "public"."transcript_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_versions" ADD CONSTRAINT "track_versions_created_by_job_id_jobs_id_fk" FOREIGN KEY ("created_by_job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_versions" ADD CONSTRAINT "transcript_versions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_versions" ADD CONSTRAINT "transcript_versions_parent_version_id_transcript_versions_id_fk" FOREIGN KEY ("parent_version_id") REFERENCES "public"."transcript_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visual_anchors" ADD CONSTRAINT "visual_anchors_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jobs_active" ON "jobs" USING btree ("project_id") WHERE "jobs"."status" IN ('queued','running');--> statement-breakpoint
CREATE INDEX "jobs_dispatch" ON "jobs" USING btree ("created_at") WHERE "jobs"."dispatch_state" = 'pending';