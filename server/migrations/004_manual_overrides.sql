ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS source_run_id TEXT,
  ADD COLUMN IF NOT EXISTS source_feature_hash TEXT,
  ADD COLUMN IF NOT EXISTS source_present BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS manual_geometry GEOMETRY(MultiPolygon, 4326),
  ADD COLUMN IF NOT EXISTS manual_igs_type TEXT,
  ADD COLUMN IF NOT EXISTS manual_subtype TEXT,
  ADD COLUMN IF NOT EXISTS manual_name TEXT,
  ADD COLUMN IF NOT EXISTS manual_status TEXT,
  ADD COLUMN IF NOT EXISTS manual_override BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS buried_river BOOLEAN,
  ADD COLUMN IF NOT EXISTS community_activity_potential TEXT,
  ADD COLUMN IF NOT EXISTS biodiversity_potential TEXT,
  ADD COLUMN IF NOT EXISTS editor_notes TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_sites_manual_geometry
  ON sites USING GIST (manual_geometry);

CREATE INDEX IF NOT EXISTS idx_sites_source_feature_hash
  ON sites (source_feature_hash);

ALTER TABLE sites
  DROP CONSTRAINT IF EXISTS sites_manual_status_check;

ALTER TABLE sites
  ADD CONSTRAINT sites_manual_status_check
  CHECK (
    manual_status IS NULL
    OR manual_status IN ('candidate', 'validated', 'rejected')
  );
