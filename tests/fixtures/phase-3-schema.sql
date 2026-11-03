ALTER TABLE storage_ledger ADD COLUMN transfer_month text NOT NULL DEFAULT '1970-01';
ALTER TABLE media ADD COLUMN storage_charge text NOT NULL DEFAULT 'pending' CHECK(storage_charge IN ('pending','committed','released'));
CREATE TABLE owner_daily_quotas (
  owner_id uuid NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  day_scope text NOT NULL,
  fresh_clips integer NOT NULL DEFAULT 0 CHECK(fresh_clips BETWEEN 0 AND 3),
  replanned_segments integer NOT NULL DEFAULT 0 CHECK(replanned_segments BETWEEN 0 AND 10),
  PRIMARY KEY(owner_id,day_scope)
);
CREATE TABLE anchor_storage (
  anchor_id uuid PRIMARY KEY REFERENCES visual_anchors(id) ON DELETE CASCADE,
  declared_bytes integer NOT NULL CHECK(declared_bytes BETWEEN 1 AND 300000),
  size_bytes integer CHECK(size_bytes IS NULL OR size_bytes BETWEEN 1 AND declared_bytes),
  state text NOT NULL DEFAULT 'pending_upload' CHECK(state IN ('pending_upload','ready','deleting')),
  reservation_expires_at timestamptz NOT NULL
);
