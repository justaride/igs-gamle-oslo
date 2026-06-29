ALTER TABLE species_observations
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'imported',
  ADD COLUMN IF NOT EXISTS created_by TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE species_observations
  DROP CONSTRAINT IF EXISTS species_observations_source_check;

ALTER TABLE species_observations
  ADD CONSTRAINT species_observations_source_check
  CHECK (source IN ('imported', 'manual'));

CREATE INDEX IF NOT EXISTS idx_species_observations_source
  ON species_observations (source);

CREATE INDEX IF NOT EXISTS idx_species_observations_created_at
  ON species_observations (created_at);
