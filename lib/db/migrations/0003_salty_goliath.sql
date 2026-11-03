CREATE TABLE "api_requests" (
	"scope" text NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_requests_scope_key_pk" PRIMARY KEY("scope","key")
);
--> statement-breakpoint
CREATE TABLE "ops_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_windows" (
	"scope" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "rate_windows_scope_window_start_pk" PRIMARY KEY("scope","window_start"),
	CONSTRAINT "rate_count_check" CHECK ("rate_windows"."count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "transcript_versions" ADD COLUMN "request_key" text;--> statement-breakpoint
ALTER TABLE "transcript_versions" ADD COLUMN "request_hash" text;--> statement-breakpoint
ALTER TABLE "transcript_versions" ADD CONSTRAINT "transcript_versions_project_id_request_key_unique" UNIQUE("project_id","request_key");