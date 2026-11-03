CREATE TABLE "anchor_storage" (
	"anchor_id" uuid PRIMARY KEY NOT NULL,
	"declared_bytes" integer NOT NULL,
	"size_bytes" integer,
	"state" text DEFAULT 'pending_upload' NOT NULL,
	"reservation_expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "anchor_declared_bytes_check" CHECK ("anchor_storage"."declared_bytes" BETWEEN 1 AND 300000),
	CONSTRAINT "anchor_size_bytes_check" CHECK ("anchor_storage"."size_bytes" IS NULL OR "anchor_storage"."size_bytes" BETWEEN 1 AND "anchor_storage"."declared_bytes"),
	CONSTRAINT "anchor_state_check" CHECK ("anchor_storage"."state" IN ('pending_upload','ready','deleting'))
);
--> statement-breakpoint
CREATE TABLE "owner_daily_quotas" (
	"owner_id" uuid NOT NULL,
	"day_scope" text NOT NULL,
	"fresh_clips" integer DEFAULT 0 NOT NULL,
	"replanned_segments" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "owner_daily_quotas_owner_id_day_scope_pk" PRIMARY KEY("owner_id","day_scope"),
	CONSTRAINT "owner_quota_fresh_check" CHECK ("owner_daily_quotas"."fresh_clips" BETWEEN 0 AND 3),
	CONSTRAINT "owner_quota_replan_check" CHECK ("owner_daily_quotas"."replanned_segments" BETWEEN 0 AND 10)
);
--> statement-breakpoint
ALTER TABLE "storage_ledger" ADD COLUMN "transfer_month" text DEFAULT '1970-01' NOT NULL;--> statement-breakpoint
ALTER TABLE "anchor_storage" ADD CONSTRAINT "anchor_storage_anchor_id_visual_anchors_id_fk" FOREIGN KEY ("anchor_id") REFERENCES "public"."visual_anchors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owner_daily_quotas" ADD CONSTRAINT "owner_daily_quotas_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;