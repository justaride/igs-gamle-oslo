from shapely.geometry import MultiPolygon, mapping, shape
from shapely import wkb
from shapely.validation import make_valid
from sqlalchemy import create_engine, text
from config import CRS_WGS84, CRS_UTM, require_env
import json
import os
import requests
import hashlib
from datetime import datetime, timezone

DATABASE_URL = require_env('DATABASE_URL')
API_BASE_URL = os.environ.get('API_BASE_URL')

def ensure_multi(geom):
    if geom.geom_type == 'Polygon':
        return MultiPolygon([geom])
    return geom


def normalize_geometry(geom):
    normalized = ensure_multi(make_valid(geom))
    if hasattr(normalized, 'normalize'):
        normalized = normalized.normalize()
    return normalized


def compute_source_feature_hash(geom, igs_type, subtype):
    normalized = normalize_geometry(geom)
    payload = wkb.dumps(normalized, hex=False)

    digest = hashlib.sha1()
    digest.update(payload)
    digest.update(b'|')
    digest.update((igs_type or '').encode('utf-8'))
    digest.update(b'|')
    digest.update((subtype or '').encode('utf-8'))
    return digest.hexdigest()


def parse_site_number(site_number):
    if not site_number or not site_number.startswith('IGS-'):
        return None
    suffix = site_number[4:]
    if not suffix.isdigit():
        return None
    return int(suffix), len(suffix)


def format_site_number(number, width):
    return f'IGS-{number:0{width}d}'


def get_next_site_number_state(existing_sites):
    max_number = 0
    width = 3

    for site in existing_sites:
        parsed = parse_site_number(site['site_number'])
        if not parsed:
            continue
        number, digits = parsed
        max_number = max(max_number, number)
        width = max(width, digits)

    return {
        'next_number': max_number + 1,
        'width': max(width, len(str(max_number + 1))),
    }


def allocate_site_number(state):
    site_number = format_site_number(state['next_number'], state['width'])
    state['next_number'] += 1
    state['width'] = max(state['width'], len(str(state['next_number'])))
    return site_number


def load_existing_sites(conn):
    rows = conn.execute(text('''
        SELECT
            id,
            site_number,
            source_feature_hash,
            igs_type,
            subtype,
            source_present,
            manual_override,
            ST_AsGeoJSON(ST_Transform(geom, 25833)) AS geom_utm_geojson
        FROM sites
    ''')).mappings()

    existing = []
    for row in rows:
        geom = shape(json.loads(row['geom_utm_geojson'])) if row['geom_utm_geojson'] else None
        existing.append({
            'id': row['id'],
            'site_number': row['site_number'],
            'source_feature_hash': row['source_feature_hash'],
            'igs_type': row['igs_type'],
            'subtype': row['subtype'],
            'source_present': row['source_present'],
            'manual_override': row['manual_override'],
            'geom_utm': geom,
        })

    return existing


def get_match_metrics(incoming_geom, existing_geom):
    if incoming_geom is None or existing_geom is None or incoming_geom.is_empty or existing_geom.is_empty:
        return 0.0, float('inf'), 0.0

    centroid_distance = incoming_geom.centroid.distance(existing_geom.centroid)
    max_area = max(incoming_geom.area, existing_geom.area, 1)
    area_ratio = min(incoming_geom.area, existing_geom.area) / max_area

    if not incoming_geom.intersects(existing_geom):
        return 0.0, centroid_distance, area_ratio

    intersection_area = incoming_geom.intersection(existing_geom).area
    union_area = incoming_geom.union(existing_geom).area
    iou = intersection_area / union_area if union_area > 0 else 0.0
    return iou, centroid_distance, area_ratio


def find_best_existing_match(incoming_geom, igs_type, subtype, feature_hash, existing_sites, claimed_ids):
    for site in existing_sites:
        if site['id'] in claimed_ids:
            continue
        if site['source_feature_hash'] and site['source_feature_hash'] == feature_hash:
            return site, 'hash'

    best_site = None
    best_key = None

    for site in existing_sites:
        if site['id'] in claimed_ids:
            continue
        if site['igs_type'] != igs_type:
            continue

        iou, centroid_distance, area_ratio = get_match_metrics(incoming_geom, site['geom_utm'])
        subtype_match = 1 if (site['subtype'] or '') == (subtype or '') else 0

        acceptable = (
            iou >= 0.2
            or (iou >= 0.08 and centroid_distance <= 40 and area_ratio >= 0.35)
            or (subtype_match and centroid_distance <= 15 and area_ratio >= 0.6)
        )
        if not acceptable:
            continue

        candidate_key = (iou, area_ratio, subtype_match, -centroid_distance)
        if best_key is None or candidate_key > best_key:
            best_site = site
            best_key = candidate_key

    if best_site:
        return best_site, 'spatial'

    return None, None


def gdf_to_feature_collection(gdf):
    if gdf is None or len(gdf) == 0:
        return {'type': 'FeatureCollection', 'features': []}

    gdf_wgs = gdf.to_crs(CRS_WGS84) if gdf.crs and str(gdf.crs) != CRS_WGS84 else gdf.copy()
    return json.loads(gdf_wgs.to_json(drop_id=True))

def seed_sites(igs_gdf):
    engine = create_engine(DATABASE_URL)

    igs_utm = igs_gdf.to_crs(CRS_UTM).copy()
    igs_utm['geometry'] = igs_utm.geometry.apply(normalize_geometry)
    igs_utm['area_m2'] = igs_utm.geometry.area

    igs_wgs = igs_utm.to_crs(CRS_WGS84)
    igs_wgs['geom_utm'] = list(igs_utm.geometry)
    igs_wgs['source_feature_hash'] = [
        compute_source_feature_hash(row.geometry, row['igs_type'], row.get('subtype'))
        for _, row in igs_wgs.iterrows()
    ]

    igs_wgs = igs_wgs.sort_values(
        by=['geometry'],
        key=lambda col: col.apply(lambda g: (g.centroid.x, -g.centroid.y))
    ).reset_index(drop=True)

    with engine.begin() as conn:
        existing_sites = load_existing_sites(conn)
        numbering_state = get_next_site_number_state(existing_sites)
        claimed_ids = set()
        matched_count = 0
        inserted_count = 0

        source_run_id = datetime.now(timezone.utc).isoformat()

        for idx, row in igs_wgs.iterrows():
            geom = normalize_geometry(row.geometry)
            geojson = json.dumps(mapping(geom))
            feature_hash = row['source_feature_hash']
            subtype = row.get('subtype')

            existing_site, match_method = find_best_existing_match(
                row['geom_utm'],
                row['igs_type'],
                subtype,
                feature_hash,
                existing_sites,
                claimed_ids,
            )

            if existing_site:
                conn.execute(text('''
                    UPDATE sites
                    SET
                        geom = ST_SetSRID(ST_GeomFromGeoJSON(:geojson), 4326),
                        igs_type = :igs_type,
                        subtype = :subtype,
                        area_m2 = :area_m2,
                        source_feature_hash = :source_feature_hash,
                        source_run_id = :source_run_id,
                        source_present = TRUE,
                        updated_at = NOW()
                    WHERE id = :site_id
                '''), {
                    'geojson': geojson,
                    'igs_type': row['igs_type'],
                    'subtype': subtype,
                    'area_m2': row['area_m2'],
                    'source_feature_hash': feature_hash,
                    'source_run_id': source_run_id,
                    'site_id': existing_site['id'],
                })
                claimed_ids.add(existing_site['id'])
                matched_count += 1
                continue

            site_number = allocate_site_number(numbering_state)
            conn.execute(text('''
                INSERT INTO sites (
                    site_number,
                    geom,
                    igs_type,
                    subtype,
                    area_m2,
                    source_feature_hash,
                    source_run_id,
                    source_present
                )
                VALUES (
                    :site_number,
                    ST_SetSRID(ST_GeomFromGeoJSON(:geojson), 4326),
                    :igs_type,
                    :subtype,
                    :area_m2,
                    :source_feature_hash,
                    :source_run_id,
                    TRUE
                )
            '''), {
                'site_number': site_number,
                'geojson': geojson,
                'igs_type': row['igs_type'],
                'subtype': subtype,
                'area_m2': row['area_m2'],
                'source_feature_hash': feature_hash,
                'source_run_id': source_run_id,
            })
            inserted_count += 1

        unmatched_existing_ids = [
            site['id']
            for site in existing_sites
            if site['id'] not in claimed_ids
        ]
        if unmatched_existing_ids:
            conn.execute(text('''
                UPDATE sites
                SET source_present = FALSE,
                    source_run_id = :source_run_id,
                    updated_at = NOW()
                WHERE id = ANY(:site_ids)
            '''), {
                'source_run_id': source_run_id,
                'site_ids': unmatched_existing_ids,
            })

        print(
            f'Seeded {len(igs_wgs)} sites '
            f'({matched_count} matched, {inserted_count} new, {len(unmatched_existing_ids)} marked inactive)'
        )

def seed_parks(parks_gdf):
    engine = create_engine(DATABASE_URL)
    parks_wgs = parks_gdf.to_crs(CRS_WGS84)

    with engine.begin() as conn:
        conn.execute(text('DELETE FROM parks'))

        for _, row in parks_wgs.iterrows():
            geom = ensure_multi(row.geometry)
            geojson = json.dumps(mapping(geom))
            name = row.get('name', None)

            conn.execute(text('''
                INSERT INTO parks (name, geom)
                VALUES (:name, ST_SetSRID(ST_GeomFromGeoJSON(:geojson), 4326))
            '''), {'name': name, 'geojson': geojson})

        print(f'Seeded {len(parks_wgs)} parks')

def seed_species(species_list):
    engine = create_engine(DATABASE_URL)

    with engine.begin() as conn:
        conn.execute(text('DELETE FROM species_observations'))

        for sp in species_list:
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

        print(f'Seeded {len(species_list)} species observations')


def seed_context_layers(context_layers):
    engine = create_engine(DATABASE_URL)

    with engine.begin() as conn:
        conn.execute(text('DELETE FROM context_layers'))

        for layer_key, spec in context_layers.items():
            feature_collection = gdf_to_feature_collection(spec.get('gdf'))
            feature_count = len(feature_collection.get('features', []))

            conn.execute(text('''
                INSERT INTO context_layers
                (layer_key, label, category, description, geojson, feature_count, updated_at)
                VALUES (
                    :layer_key,
                    :label,
                    :category,
                    :description,
                    CAST(:geojson AS jsonb),
                    :feature_count,
                    NOW()
                )
            '''), {
                'layer_key': layer_key,
                'label': spec['label'],
                'category': spec['category'],
                'description': spec.get('description'),
                'geojson': json.dumps(feature_collection),
                'feature_count': feature_count,
            })

        print(f'Seeded {len(context_layers)} context layers')

    if not API_BASE_URL:
        print('Skipping review queue refresh: API_BASE_URL is not set')
        return

    try:
        resp = requests.post(f'{API_BASE_URL}/api/context-layers/refresh-review-queue', timeout=120)
        resp.raise_for_status()
        print('Review queue cache refreshed after context layer update')
    except Exception as e:
        print(f'Warning: could not refresh review queue cache via API: {e}')
        print('Run POST /api/context-layers/refresh-review-queue manually when the server is up')
