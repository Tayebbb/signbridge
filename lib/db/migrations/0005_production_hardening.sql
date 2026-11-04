ALTER TABLE "owners" ADD COLUMN "recovery_hash" "bytea";--> statement-breakpoint
CREATE INDEX "media_project_ready" ON "media" USING btree ("project_id","status","client_sha256","created_at","id");--> statement-breakpoint
CREATE INDEX "media_cleanup" ON "media" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "render_events_kind_time" ON "render_events" USING btree ("kind","created_at");--> statement-breakpoint
CREATE INDEX "render_events_time" ON "render_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "render_events_track" ON "render_events" USING btree ("track_version_id");--> statement-breakpoint
CREATE INDEX "spend_reservations_state_time" ON "spend_reservations" USING btree ("state","created_at");--> statement-breakpoint
CREATE INDEX "stage_attempts_provider_time" ON "stage_attempts" USING btree ("provider","created_at");--> statement-breakpoint
CREATE INDEX "stage_refs_cache_key" ON "stage_result_refs" USING btree ("cache_key");--> statement-breakpoint
ALTER TABLE "owners" ADD CONSTRAINT "owners_recovery_hash_unique" UNIQUE("recovery_hash");