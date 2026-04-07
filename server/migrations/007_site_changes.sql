CREATE TABLE IF NOT EXISTS site_changes (
  id SERIAL PRIMARY KEY,
  site_id INT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by TEXT DEFAULT 'editor',
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_changes_site_id ON site_changes(site_id);
CREATE INDEX IF NOT EXISTS idx_site_changes_changed_at ON site_changes(changed_at);
