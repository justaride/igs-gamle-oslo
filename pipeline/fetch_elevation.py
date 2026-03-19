import hashlib
import json
import os
import threading
from pathlib import Path

import geopandas as gpd
import numpy as np
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from shapely.geometry import Point, box

from config import (
    BBOX,
    CRS_UTM,
    CRS_WGS84,
    ELEVATION_BATCH_SIZE,
    ELEVATION_GRID_SPACING_M,
    SLOPE_THRESHOLD_DEG,
)

KARTVERKET_URL = 'https://ws.geonorge.no/hoydedata/v1/punkt'
DEFAULT_CACHE_DIR = Path(os.environ.get('TMPDIR', '/tmp')) / 'igs-elevation-cache'
CACHE_DIR = Path(os.environ.get('ELEVATION_CACHE_DIR', str(DEFAULT_CACHE_DIR)))
_thread_local = threading.local()


def env_int(name, default):
    value = os.environ.get(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def env_bool(name, default):
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() not in {'0', 'false', 'no', 'off'}


MAX_WORKERS = env_int('ELEVATION_MAX_WORKERS', 20)
REQUEST_TIMEOUT_S = env_int('ELEVATION_REQUEST_TIMEOUT_S', 15)
MAX_RETRIES = env_int('ELEVATION_MAX_RETRIES', 3)
GRID_SPACING_M = env_int('ELEVATION_GRID_SPACING_M', ELEVATION_GRID_SPACING_M)
BATCH_SIZE = max(env_int('ELEVATION_BATCH_SIZE', ELEVATION_BATCH_SIZE), MAX_WORKERS)
USE_CACHE = env_bool('ELEVATION_USE_CACHE', True)


def empty_gdf():
    return gpd.GeoDataFrame(geometry=[], crs=CRS_UTM)


def get_cache_path():
    cache_key = hashlib.sha1(json.dumps({
        'bbox': BBOX,
        'grid_spacing_m': GRID_SPACING_M,
        'slope_threshold_deg': SLOPE_THRESHOLD_DEG,
        'version': 1,
    }, sort_keys=True).encode('utf-8')).hexdigest()
    return CACHE_DIR / f'{cache_key}.geojson'


def load_cached_steep_areas():
    if not USE_CACHE:
        return None

    cache_path = get_cache_path()
    if not cache_path.exists():
        return None

    payload = json.loads(cache_path.read_text())
    features = payload.get('features', [])
    if not features:
        return empty_gdf()

    return gpd.GeoDataFrame.from_features(features, crs=CRS_UTM)


def save_cached_steep_areas(gdf):
    if not USE_CACHE:
        return

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    get_cache_path().write_text(gdf.to_json(drop_id=True))


def get_session():
    session = getattr(_thread_local, 'session', None)
    if session is None:
        session = requests.Session()
        _thread_local.session = session
    return session


def create_elevation_grid():
    study_area = gpd.GeoDataFrame(
        geometry=[box(BBOX['west'], BBOX['south'], BBOX['east'], BBOX['north'])],
        crs=CRS_WGS84
    ).to_crs(CRS_UTM)

    bounds = study_area.total_bounds
    xs = np.arange(bounds[0], bounds[2], GRID_SPACING_M)
    ys = np.arange(bounds[1], bounds[3], GRID_SPACING_M)
    grid_points = [Point(x, y) for x in xs for y in ys]

    grid = gpd.GeoDataFrame(geometry=grid_points, crs=CRS_UTM)
    grid_wgs = grid.to_crs(CRS_WGS84)

    return grid, grid_wgs, xs, ys


def _fetch_one(args):
    idx, lat, lon = args
    session = get_session()
    for attempt in range(MAX_RETRIES):
        try:
            resp = session.get(KARTVERKET_URL, params={
                'nord': lat,
                'ost': lon,
                'koordsys': 4326,
            }, timeout=REQUEST_TIMEOUT_S)
            if resp.ok:
                data = resp.json()
                return idx, data.get('punkter', [{}])[0].get('z', None)
            if resp.status_code == 429:
                import time
                time.sleep(1 * (attempt + 1))
                continue
            return idx, None
        except Exception:
            if attempt < MAX_RETRIES - 1:
                import time
                time.sleep(0.5)
            continue
    return idx, None


def fetch_elevations(grid_wgs):
    print(f'Fetching elevation for {len(grid_wgs)} points (using {MAX_WORKERS} threads)...')

    coords = [(p.y, p.x) for p in grid_wgs.geometry]
    tasks = [(i, lat, lon) for i, (lat, lon) in enumerate(coords)]
    elevations = [None] * len(coords)
    done = 0

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        for start in range(0, len(tasks), BATCH_SIZE):
            batch = tasks[start:start + BATCH_SIZE]
            futures = {executor.submit(_fetch_one, task): task for task in batch}
            for future in as_completed(futures):
                idx, z = future.result()
                elevations[idx] = z
                done += 1
                if done % 500 == 0:
                    print(f'  Processed {done}/{len(coords)} points')

    print(f'  Processed {len(coords)}/{len(coords)} points')
    return elevations


def compute_slope(elevations, xs, ys):
    nx, ny = len(xs), len(ys)
    z = np.array(elevations[:nx * ny], dtype=float).reshape(nx, ny)

    z_filled = np.where(np.isnan(z), np.nanmean(z), z)

    dy, dx = np.gradient(z_filled, GRID_SPACING_M)
    slope_rad = np.arctan(np.sqrt(dx**2 + dy**2))
    slope_deg = np.degrees(slope_rad)

    return slope_deg


def get_steep_areas(slope_deg, xs, ys):
    steep_points = []
    for i, x in enumerate(xs):
        for j, y in enumerate(ys):
            if i < slope_deg.shape[0] and j < slope_deg.shape[1]:
                if slope_deg[i, j] > SLOPE_THRESHOLD_DEG:
                    steep_points.append(Point(x, y))

    if not steep_points:
        print('  No steep areas found')
        return empty_gdf()

    steep = gpd.GeoDataFrame(geometry=steep_points, crs=CRS_UTM)
    steep_buffered = steep.copy()
    steep_buffered['geometry'] = steep.buffer(GRID_SPACING_M)

    from shapely.ops import unary_union
    merged = unary_union(steep_buffered.geometry)

    if merged.is_empty:
        return empty_gdf()

    if merged.geom_type == 'Polygon':
        geoms = [merged]
    elif merged.geom_type == 'MultiPolygon':
        geoms = list(merged.geoms)
    else:
        geoms = []

    result = gpd.GeoDataFrame(geometry=geoms, crs=CRS_UTM)
    print(f'  {len(result)} steep slope areas (>{SLOPE_THRESHOLD_DEG}°)')
    return result


def fetch_steep_slopes():
    cached = load_cached_steep_areas()
    if cached is not None:
        print(f'Loaded cached slope analysis ({len(cached)} polygons)')
        return cached

    print('Computing slope analysis...')
    grid, grid_wgs, xs, ys = create_elevation_grid()
    elevations = fetch_elevations(grid_wgs)
    slope_deg = compute_slope(elevations, xs, ys)
    steep_areas = get_steep_areas(slope_deg, xs, ys)
    save_cached_steep_areas(steep_areas)
    return steep_areas


if __name__ == '__main__':
    steep = fetch_steep_slopes()
    print(f'Found {len(steep)} steep slope polygons')
