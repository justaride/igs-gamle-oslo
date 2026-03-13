#!/usr/bin/env python3
import sys
import time
import os

sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

from sqlalchemy import create_engine, text
from shapely import wkt
from pygbif import occurrences

DB_URL = os.environ.get(
    'DATABASE_URL',
    'postgresql://igs:dfEZ8bj3HkO2D2sfwZBExUXw@localhost:15432/igs'
)

GBIF_LIMIT = 300
DELAY_BETWEEN_CALLS = 2.0
MAX_RETRIES = 5
BATCH_DB_SIZE = 50


def log(msg):
    print(msg, flush=True)


def fetch_for_envelope(geom):
    query_geom = geom.envelope
    for attempt in range(MAX_RETRIES):
        try:
            resp = occurrences.search(
                geometry=query_geom.wkt,
                limit=GBIF_LIMIT,
                hasCoordinate=True,
                country='NO',
            )
            species_map = {}
            for occ in resp.get('results', []):
                key = occ.get('species') or occ.get('scientificName')
                if not key:
                    continue
                if key not in species_map:
                    species_map[key] = {
                        'scientific_name': occ.get('scientificName', key),
                        'vernacular_name': occ.get('vernacularName'),
                        'red_list_category': occ.get('iucnRedListCategory'),
                        'is_alien': occ.get('establishmentMeans') == 'INTRODUCED',
                        'count': 0,
                        'lat': occ.get('decimalLatitude'),
                        'lon': occ.get('decimalLongitude'),
                    }
                species_map[key]['count'] += 1
            return list(species_map.values())
        except Exception as e:
            err_str = str(e)
            if '429' in err_str:
                wait = 5 * (2 ** attempt)
                log(f'  429 rate limited, waiting {wait}s (attempt {attempt+1}/{MAX_RETRIES})')
                time.sleep(wait)
            else:
                log(f'  GBIF error: {e}')
                return []
    log(f'  Max retries exceeded')
    return []


def insert_batch(engine, batch):
    if not batch:
        return 0
    inserted = 0
    with engine.begin() as conn:
        for sp in batch:
            if sp.get('lat') is None or sp.get('lon') is None:
                continue
            conn.execute(text('''
                INSERT INTO species_observations
                (site_id, scientific_name, vernacular_name, red_list_category,
                 is_alien, observation_count, geom)
                VALUES (
                    :site_id, :scientific_name, :vernacular_name, :red_list_category,
                    :is_alien, :count,
                    ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)
                )
            '''), {
                'site_id': sp['site_id'],
                'scientific_name': sp['scientific_name'],
                'vernacular_name': sp.get('vernacular_name'),
                'red_list_category': sp.get('red_list_category'),
                'is_alien': sp.get('is_alien', False),
                'count': sp.get('count', 1),
                'lon': sp['lon'],
                'lat': sp['lat'],
            })
            inserted += 1
    return inserted


def main():
    engine = create_engine(DB_URL)

    log('Loading sites from DB...')
    with engine.connect() as conn:
        existing = conn.execute(text('SELECT COUNT(*) FROM species_observations')).scalar()
        if existing > 0:
            log(f'Found {existing} existing observations, clearing...')
            conn.execute(text('DELETE FROM species_observations'))
            conn.connection.commit()

        rows = conn.execute(text(
            'SELECT id, ST_AsText(geom) as wkt FROM sites ORDER BY id'
        )).fetchall()
    log(f'Loaded {len(rows)} sites')

    total_inserted = 0
    pending_batch = []
    errors = 0
    sites_with_species = 0
    start = time.time()

    for i, r in enumerate(rows):
        site_id, geom_wkt = r
        geom = wkt.loads(geom_wkt)
        species = fetch_for_envelope(geom)

        for sp in species:
            sp['site_id'] = site_id
        pending_batch.extend(species)

        if species:
            sites_with_species += 1

        if len(pending_batch) >= BATCH_DB_SIZE or (i + 1) == len(rows):
            inserted = insert_batch(engine, pending_batch)
            total_inserted += inserted
            pending_batch = []

        if (i + 1) % 50 == 0 or (i + 1) == len(rows):
            elapsed = time.time() - start
            rate = (i + 1) / elapsed if elapsed > 0 else 0
            eta = (len(rows) - i - 1) / rate if rate > 0 else 0
            log(
                f'[{i+1}/{len(rows)}] '
                f'inserted={total_inserted} '
                f'sites_w_data={sites_with_species} '
                f'errors={errors} '
                f'rate={rate:.1f}/s '
                f'ETA={eta/60:.1f}min'
            )

        time.sleep(DELAY_BETWEEN_CALLS)

    log(f'\nDone! Inserted {total_inserted} species observations')
    log(f'Sites with species data: {sites_with_species}/{len(rows)}')


if __name__ == '__main__':
    main()
