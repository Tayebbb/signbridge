-- Independent expected extension: recovery hashes are nullable so existing owners continue working.
ALTER TABLE owners ADD COLUMN recovery_hash bytea;
ALTER TABLE owners ADD CONSTRAINT owners_recovery_hash_unique UNIQUE(recovery_hash);
CREATE INDEX media_project_ready ON media(project_id,status,client_sha256,created_at,id);
CREATE INDEX media_cleanup ON media(status,expires_at);
CREATE INDEX render_events_kind_time ON render_events(kind,created_at);
CREATE INDEX render_events_time ON render_events(created_at);
CREATE INDEX render_events_track ON render_events(track_version_id);
CREATE INDEX spend_reservations_state_time ON spend_reservations(state,created_at);
CREATE INDEX stage_attempts_provider_time ON stage_attempts(provider,created_at);
CREATE INDEX stage_refs_cache_key ON stage_result_refs(cache_key);
