#!/usr/bin/env python3
import sys

import geopandas as gpd
from shapely import wkt
from sqlalchemy import create_engine, text

from config import require_env
from fetch_species import fetch_species_for_sites
from seed_db import seed_species

sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

DB_URL = require_env('DATABASE_URL')


def log(msg):
    print(msg, flush=True)


def load_sites(engine):
    with engine.connect() as conn:
        rows = conn.execute(text(
            '''
            SELECT
                id AS site_id,
                ST_AsText(COALESCE(manual_geometry, geom)) AS wkt
            FROM sites
            WHERE source_present = TRUE
               OR manual_override = TRUE
               OR COALESCE(manual_status, status) <> 'candidate'
            ORDER BY id
            '''
        )).fetchall()

    return gpd.GeoDataFrame(
        [{'site_id': row.site_id, 'geometry': wkt.loads(row.wkt)} for row in rows],
        crs='EPSG:4326',
    )


def main():
    engine = create_engine(DB_URL)

    log('Loading active sites from DB...')
    sites_gdf = load_sites(engine)
    log(f'Loaded {len(sites_gdf)} sites')

    species = fetch_species_for_sites(sites_gdf)
    seed_species(species)
    log(f'Done! Inserted {len(species)} species observations')


if __name__ == '__main__':
    main()
