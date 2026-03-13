CREATE TABLE IF NOT EXISTS context_layers (
  layer_key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  geojson JSONB NOT NULL DEFAULT '{"type":"FeatureCollection","features":[]}'::jsonb,
  feature_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT context_layers_category_check CHECK (category IN ('reference', 'qa'))
);

CREATE INDEX IF NOT EXISTS idx_context_layers_category ON context_layers (category);
