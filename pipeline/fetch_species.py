import hashlib
import json
import os
import time
from pathlib import Path

import geopandas as gpd
from pygbif import occurrences
from shapely.geometry import Point, box

from config import BBOX, CRS_UTM, CRS_WGS84

RED_LIST_CATEGORIES = {'CR', 'EN', 'VU', 'NT'}
DEFAULT_CACHE_DIR = Path(os.environ.get('TMPDIR', '/tmp')) / 'igs-species-cache'
CACHE_DIR = Path(os.environ.get('SPECIES_CACHE_DIR', str(DEFAULT_CACHE_DIR)))


def env_int(name, default):
    value = os.environ.get(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def env_float(name, default):
    value = os.environ.get(name)
    if value is None:
        return default
    try:
        return float(value)
    except ValueError:
        return default


def env_bool(name, default):
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() not in {'0', 'false', 'no', 'off'}


GBIF_PAGE_LIMIT = env_int('SPECIES_PAGE_LIMIT', 300)
MAX_RETRIES = env_int('SPECIES_MAX_RETRIES', 5)
DELAY_BETWEEN_CALLS = env_float('SPECIES_DELAY_S', 0.2)
MAX_RECORDS_PER_TILE = env_int('SPECIES_MAX_RECORDS_PER_TILE', 3000)
TILE_SIZE_M = env_int('SPECIES_TILE_SIZE_M', 500)
USE_CACHE = env_bool('SPECIES_USE_CACHE', True)


def log(message):
    print(message)


def occurrence_identity(occ):
    return str(occ.get('key') or (
        f"{occ.get('decimalLatitude')}|"
        f"{occ.get('decimalLongitude')}|"
        f"{occ.get('species') or occ.get('scientificName') or occ.get('scientific_name')}"
    ))


def normalize_occurrence(occ):
    lat = occ.get('decimalLatitude')
    lon = occ.get('decimalLongitude')
    species_key = occ.get('species') or occ.get('scientificName')

    if lat is None or lon is None or not species_key:
        return None

    return {
        'key': occ.get('key'),
        'species': occ.get('species'),
        'scientific_name': occ.get('scientificName', species_key),
        'vernacular_name': occ.get('vernacularName'),
        'red_list_category': occ.get('iucnRedListCategory'),
        'is_alien': occ.get('establishmentMeans') == 'INTRODUCED',
        'lat': lat,
        'lon': lon,
    }


def get_cache_path(geometry_wkt):
    cache_key = hashlib.sha1(json.dumps({
        'geometry_wkt': geometry_wkt,
        'country': 'NO',
        'limit': GBIF_PAGE_LIMIT,
        'version': 1,
    }, sort_keys=True).encode('utf-8')).hexdigest()
    return CACHE_DIR / f'{cache_key}.json'


def load_cached_occurrences(geometry_wkt):
    if not USE_CACHE:
        return None

    cache_path = get_cache_path(geometry_wkt)
    if not cache_path.exists():
        return None

    return json.loads(cache_path.read_text())


def save_cached_occurrences(geometry_wkt, records):
    if not USE_CACHE:
        return

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    get_cache_path(geometry_wkt).write_text(json.dumps(records))


def fetch_occurrences_for_geometry(geometry_wkt, label='query'):
    cached = load_cached_occurrences(geometry_wkt)
    if cached is not None:
        log(f'  {label}: cache hit ({len(cached)} occurrences)')
        return cached

    results = {}
    offset = 0

    while offset < MAX_RECORDS_PER_TILE:
        page = None
        for attempt in range(MAX_RETRIES):
            try:
                page = occurrences.search(
                    geometry=geometry_wkt,
                    limit=GBIF_PAGE_LIMIT,
                    offset=offset,
                    hasCoordinate=True,
                    country='NO',
                )
                break
            except Exception as e:
                err_str = str(e)
                if '429' in err_str:
                    wait = max(1.0, DELAY_BETWEEN_CALLS) * (2 ** attempt)
                    log(f'  {label}: rate limited, waiting {wait:.1f}s')
                    time.sleep(wait)
                    continue
                if attempt == MAX_RETRIES - 1:
                    log(f'  {label}: GBIF error: {e}')
                else:
                    time.sleep(0.5)

        if page is None:
            break

        raw_results = page.get('results', [])
        if not raw_results:
            break

        for raw in raw_results:
            occ = normalize_occurrence(raw)
            if occ is None:
                continue
            results[occurrence_identity(occ)] = occ

        offset += len(raw_results)
        if page.get('endOfRecords') or len(raw_results) < GBIF_PAGE_LIMIT:
            break

        time.sleep(DELAY_BETWEEN_CALLS)

    if offset >= MAX_RECORDS_PER_TILE:
        log(f'  {label}: stopped at max tile record budget ({MAX_RECORDS_PER_TILE})')

    records = list(results.values())
    save_cached_occurrences(geometry_wkt, records)
    log(f'  {label}: fetched {len(records)} unique occurrences')
    return records


def aggregate_occurrences(records):
    species_map = {}
    for occ in records:
        key = occ.get('species') or occ.get('scientific_name')
        if not key:
            continue

        if key not in species_map:
            species_map[key] = {
                'scientific_name': occ.get('scientific_name', key),
                'vernacular_name': occ.get('vernacular_name'),
                'red_list_category': occ.get('red_list_category'),
                'is_alien': occ.get('is_alien', False),
                'count': 0,
                'lat': occ.get('lat'),
                'lon': occ.get('lon'),
            }
        species_map[key]['count'] += 1

    return list(species_map.values())


def build_query_tiles(sites_gdf):
    if len(sites_gdf) == 0:
        return []

    sites_utm = sites_gdf.to_crs(CRS_UTM)
    bounds = sites_utm.total_bounds
    spatial_index = sites_utm.sindex
    tiles = []

    x = bounds[0]
    while x < bounds[2]:
        y = bounds[1]
        while y < bounds[3]:
            tile = box(
                x,
                y,
                min(x + TILE_SIZE_M, bounds[2]),
                min(y + TILE_SIZE_M, bounds[3]),
            )
            if len(spatial_index.query(tile, predicate='intersects')) > 0:
                tiles.append(tile)
            y += TILE_SIZE_M
        x += TILE_SIZE_M

    return tiles


def fetch_species_for_polygon(polygon_wgs84):
    records = fetch_occurrences_for_geometry(polygon_wgs84.wkt, label='polygon')
    return aggregate_occurrences(records)


def fetch_species_for_sites(sites_gdf):
    if sites_gdf is None or len(sites_gdf) == 0:
        log('No sites provided for species fetch')
        return []

    if 'site_id' not in sites_gdf.columns:
        sites_gdf = sites_gdf.copy()
        sites_gdf['site_id'] = sites_gdf.index

    sites_wgs = sites_gdf[['site_id', 'geometry']].copy().to_crs(CRS_WGS84)
    tiles_utm = build_query_tiles(sites_wgs)
    log(f'Fetching species using {len(tiles_utm)} tiles (~{TILE_SIZE_M} m)')

    all_occurrences = {}
    for idx, tile_utm in enumerate(tiles_utm, start=1):
        tile_wgs = gpd.GeoSeries([tile_utm], crs=CRS_UTM).to_crs(CRS_WGS84).iloc[0]
        records = fetch_occurrences_for_geometry(tile_wgs.envelope.wkt, label=f'tile {idx}/{len(tiles_utm)}')
        for occ in records:
            all_occurrences[occurrence_identity(occ)] = occ

    if not all_occurrences:
        log('No GBIF occurrences fetched for study tiles')
        return []

    occurrence_rows = list(all_occurrences.values())
    occurrence_gdf = gpd.GeoDataFrame(
        occurrence_rows,
        geometry=gpd.points_from_xy(
            [row['lon'] for row in occurrence_rows],
            [row['lat'] for row in occurrence_rows],
        ),
        crs=CRS_WGS84,
    )

    joined = gpd.sjoin(
        occurrence_gdf,
        sites_wgs,
        how='inner',
        predicate='within',
    )

    species_map = {}
    for _, row in joined.iterrows():
        species_key = row.get('species') or row.get('scientific_name')
        if not species_key:
            continue

        aggregate_key = (row['site_id'], species_key)
        if aggregate_key not in species_map:
            species_map[aggregate_key] = {
                'site_id': row['site_id'],
                'scientific_name': row.get('scientific_name', species_key),
                'vernacular_name': row.get('vernacular_name'),
                'red_list_category': row.get('red_list_category'),
                'is_alien': row.get('is_alien', False),
                'count': 0,
                'lat': row.get('lat'),
                'lon': row.get('lon'),
            }
        species_map[aggregate_key]['count'] += 1

    log(
        f'Matched {len(joined)} occurrences to '
        f'{len({sp["site_id"] for sp in species_map.values()})} sites'
    )
    return list(species_map.values())


if __name__ == '__main__':
    test_poly = box(BBOX['west'], BBOX['south'], BBOX['east'], BBOX['north'])
    species = fetch_species_for_polygon(test_poly)
    print(f'Found {len(species)} species in study area')
    red_listed = [s for s in species if s['red_list_category'] in RED_LIST_CATEGORIES]
    print(f'Red-listed: {len(red_listed)}')
