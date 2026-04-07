CREATE TABLE IF NOT EXISTS review_queue_cache_meta (
  cache_key TEXT PRIMARY KEY,
  is_stale BOOLEAN NOT NULL DEFAULT TRUE,
  stale_reason TEXT,
  stale_since TIMESTAMPTZ,
  last_refresh_started_at TIMESTAMPTZ,
  last_refreshed_at TIMESTAMPTZ,
  last_error TEXT,
  last_error_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO review_queue_cache_meta (
  cache_key,
  is_stale,
  stale_reason,
  stale_since,
  last_refreshed_at,
  updated_at
)
SELECT
  'default',
  NOT EXISTS (SELECT 1 FROM review_queue_cache),
  CASE
    WHEN EXISTS (SELECT 1 FROM review_queue_cache) THEN NULL
    ELSE 'cache_not_initialized'
  END,
  CASE
    WHEN EXISTS (SELECT 1 FROM review_queue_cache) THEN NULL
    ELSE NOW()
  END,
  CASE
    WHEN EXISTS (SELECT 1 FROM review_queue_cache) THEN NOW()
    ELSE NULL
  END,
  NOW()
ON CONFLICT (cache_key) DO NOTHING;
