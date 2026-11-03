CREATE TABLE api_requests (
  scope text NOT NULL, key text NOT NULL, request_hash text NOT NULL,
  response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(scope,key)
);
CREATE TABLE ops_settings (key text PRIMARY KEY, value jsonb NOT NULL);
CREATE TABLE rate_windows (
  scope text NOT NULL, window_start timestamptz NOT NULL, count integer NOT NULL CHECK(count>=0),
  PRIMARY KEY(scope,window_start)
);
ALTER TABLE transcript_versions ADD COLUMN request_key text;
ALTER TABLE transcript_versions ADD COLUMN request_hash text;
ALTER TABLE transcript_versions ADD UNIQUE(project_id,request_key);
