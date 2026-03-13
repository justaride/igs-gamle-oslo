CREATE TABLE IF NOT EXISTS review_queue_cache (
  site_id INT PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
  site_number TEXT NOT NULL,
  igs_type TEXT NOT NULL,
  subtype TEXT,
  status TEXT NOT NULL,
  area_m2 DOUBLE PRECISION,
  good_opportunity BOOLEAN NOT NULL DEFAULT FALSE,
  hidden_gem BOOLEAN,
  dangerous BOOLEAN,
  noisy BOOLEAN,
  too_small BOOLEAN,
  score INT NOT NULL,
  signal_count INT NOT NULL,
  max_overlap_ratio DOUBLE PRECISION NOT NULL DEFAULT 0,
  overlap_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  reasons TEXT[] NOT NULL DEFAULT '{}'::text[],
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT review_queue_cache_status_check CHECK (status IN ('candidate', 'validated', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_review_queue_cache_score
  ON review_queue_cache (score DESC, signal_count DESC, max_overlap_ratio DESC);
