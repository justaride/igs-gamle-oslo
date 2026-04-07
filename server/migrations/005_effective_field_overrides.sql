ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS manual_ownership TEXT,
  ADD COLUMN IF NOT EXISTS manual_access_control TEXT,
  ADD COLUMN IF NOT EXISTS manual_access_description TEXT,
  ADD COLUMN IF NOT EXISTS manual_natural_barrier TEXT,
  ADD COLUMN IF NOT EXISTS manual_maintenance TEXT,
  ADD COLUMN IF NOT EXISTS manual_maintenance_frequency TEXT,
  ADD COLUMN IF NOT EXISTS manual_prox_housing BOOLEAN,
  ADD COLUMN IF NOT EXISTS manual_hidden_gem BOOLEAN,
  ADD COLUMN IF NOT EXISTS manual_dangerous BOOLEAN,
  ADD COLUMN IF NOT EXISTS manual_noisy BOOLEAN,
  ADD COLUMN IF NOT EXISTS manual_too_small BOOLEAN,
  ADD COLUMN IF NOT EXISTS manual_notes TEXT,
  ADD COLUMN IF NOT EXISTS manual_buried_river BOOLEAN,
  ADD COLUMN IF NOT EXISTS manual_community_activity_potential TEXT,
  ADD COLUMN IF NOT EXISTS manual_biodiversity_potential TEXT;

ALTER TABLE sites
  DROP CONSTRAINT IF EXISTS sites_manual_ownership_check;

ALTER TABLE sites
  ADD CONSTRAINT sites_manual_ownership_check
  CHECK (
    manual_ownership IS NULL
    OR manual_ownership IN ('PUB', 'PRI', 'UNK')
  );

ALTER TABLE sites
  DROP CONSTRAINT IF EXISTS sites_manual_access_control_check;

ALTER TABLE sites
  ADD CONSTRAINT sites_manual_access_control_check
  CHECK (
    manual_access_control IS NULL
    OR manual_access_control IN ('O', 'P', 'C')
  );

ALTER TABLE sites
  DROP CONSTRAINT IF EXISTS sites_manual_maintenance_check;

ALTER TABLE sites
  ADD CONSTRAINT sites_manual_maintenance_check
  CHECK (
    manual_maintenance IS NULL
    OR manual_maintenance IN ('FM', 'IM', 'NM')
  );

ALTER TABLE sites
  DROP CONSTRAINT IF EXISTS sites_manual_maintenance_frequency_check;

ALTER TABLE sites
  ADD CONSTRAINT sites_manual_maintenance_frequency_check
  CHECK (
    manual_maintenance_frequency IS NULL
    OR manual_maintenance_frequency IN ('W', 'M', 'S', 'U', 'VL')
  );

UPDATE sites
SET manual_notes = editor_notes,
    manual_override = TRUE,
    updated_at = NOW()
WHERE manual_notes IS NULL
  AND editor_notes IS NOT NULL;
