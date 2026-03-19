#!/usr/bin/env python3
"""
IGS Gamle Oslo — geodata pipeline
Fetches OSM data, detects IGS candidates, loads into PostGIS.
"""
import sys
import argparse

sys.stdout.reconfigure(line_buffering=True)

from config import require_env

DATABASE_URL = require_env('DATABASE_URL')

def main():
    parser = argparse.ArgumentParser(description='IGS detection pipeline')
    parser.add_argument('--skip-elevation', action='store_true',
                        help='Skip elevation/slope analysis (faster)')
    parser.add_argument('--skip-species', action='store_true',
                        help='Skip GBIF species fetch')
    parser.add_argument('--dry-run', action='store_true',
                        help='Detect IGS but do not seed database')
    parser.add_argument('--output', type=str, default=None,
                        help='Save GeoJSON output to file')
    args = parser.parse_args()

    print('=== IGS Gamle Oslo Pipeline ===\n')

    print('Step 1: Fetching OSM data...')
    from fetch_osm import fetch_all
    data = fetch_all()
    print()

    steep_slopes = None
    if not args.skip_elevation:
        print('Step 2: Fetching elevation data...')
        from fetch_elevation import fetch_steep_slopes
        try:
            steep_slopes = fetch_steep_slopes()
        except Exception as e:
            print(f'  Elevation fetch failed: {e}')
            print('  Continuing without slope data...')
        print()
    else:
        print('Step 2: Skipping elevation (--skip-elevation)\n')

    print('Step 3: Detecting IGS candidates...')
    from detect_igs import detect_all
    igs = detect_all(data, steep_slopes)
    print()

    print('Step 4: Building context layers...')
    from build_context_layers import build_context_layers
    context_layers = build_context_layers(data, steep_slopes)
    print(f'Built {len(context_layers)} context layers\n')

    if args.output:
        igs_wgs = igs.to_crs('EPSG:4326')
        igs_wgs.to_file(args.output, driver='GeoJSON')
        print(f'Saved to {args.output}\n')

    if args.dry_run:
        print('Dry run — skipping database seed')
        return

    print('Step 5: Seeding database...')
    from seed_db import seed_sites, seed_parks, seed_species, seed_context_layers
    seed_sites(igs)
    seed_parks(data['parks'])
    seed_context_layers(context_layers)
    print()

    if not args.skip_species:
        print('Step 6: Fetching species data...')
        from fetch_species import fetch_species_for_sites

        from sqlalchemy import create_engine, text
        engine = create_engine(DATABASE_URL)
        with engine.connect() as conn:
            result = conn.execute(text(
                '''
                SELECT
                    id,
                    ST_AsText(COALESCE(manual_geometry, geom)) AS wkt
                FROM sites
                WHERE source_present = TRUE
                   OR manual_override = TRUE
                   OR COALESCE(manual_status, status) <> 'candidate'
                '''
            ))
            rows = result.fetchall()

        import geopandas as gpd
        from shapely import wkt
        sites_for_species = gpd.GeoDataFrame(
            [{'site_id': r[0], 'geometry': wkt.loads(r[1])} for r in rows],
            crs='EPSG:4326'
        )

        species = fetch_species_for_sites(sites_for_species)
        seed_species(species)
        print()
    else:
        print('Step 6: Skipping species (--skip-species)\n')

    print('=== Pipeline complete ===')

if __name__ == '__main__':
    main()
