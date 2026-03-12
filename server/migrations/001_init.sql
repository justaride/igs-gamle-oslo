CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS sites (
  id SERIAL PRIMARY KEY,
  site_number VARCHAR(10) UNIQUE NOT NULL,
  geom GEOMETRY(MultiPolygon, 4326) NOT NULL,
  igs_type TEXT NOT NULL,
  subtype TEXT,
  status TEXT DEFAULT 'candidate',
  name TEXT,
  ownership TEXT DEFAULT 'UNK',
  access_control TEXT DEFAULT 'O',
  access_description TEXT,
  natural_barrier TEXT,
  maintenance TEXT,
  maintenance_frequency TEXT,
  prox_housing BOOLEAN,
  hidden_gem BOOLEAN,
  dangerous BOOLEAN,
  noisy BOOLEAN,
  too_small BOOLEAN,
  notes TEXT,
  area_m2 FLOAT,
  good_opportunity BOOLEAN GENERATED ALWAYS AS (
    (ownership IN ('PUB','UNK'))
    AND (access_control IN ('O','P'))
    AND (NOT COALESCE(dangerous, false))
    AND (NOT COALESCE(noisy, false))
    AND (NOT COALESCE(too_small, false))
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS species_observations (
  id SERIAL PRIMARY KEY,
  site_id INT REFERENCES sites(id) ON DELETE CASCADE,
  scientific_name TEXT,
  vernacular_name TEXT,
  red_list_category TEXT,
  is_alien BOOLEAN DEFAULT false,
  observation_count INT,
  geom GEOMETRY(Point, 4326)
);

CREATE TABLE IF NOT EXISTS parks (
  id SERIAL PRIMARY KEY,
  name TEXT,
  geom GEOMETRY(MultiPolygon, 4326) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sites_geom ON sites USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_species_geom ON species_observations USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_parks_geom ON parks USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_species_site_id ON species_observations (site_id);
