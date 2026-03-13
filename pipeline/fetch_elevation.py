import numpy as np
import requests
import geopandas as gpd
from concurrent.futures import ThreadPoolExecutor, as_completed
from shapely.geometry import Point, box
from config import (
    BBOX, CRS_UTM, CRS_WGS84,
    ELEVATION_GRID_SPACING_M, ELEVATION_BATCH_SIZE,
    SLOPE_THRESHOLD_DEG
)

KARTVERKET_URL = 'https://ws.geonorge.no/hoydedata/v1/punkt'
MAX_WORKERS = 20

def create_elevation_grid():
    study_area = gpd.GeoDataFrame(
        geometry=[box(BBOX['west'], BBOX['south'], BBOX['east'], BBOX['north'])],
        crs=CRS_WGS84
    ).to_crs(CRS_UTM)

    bounds = study_area.total_bounds
    xs = np.arange(bounds[0], bounds[2], ELEVATION_GRID_SPACING_M)
    ys = np.arange(bounds[1], bounds[3], ELEVATION_GRID_SPACING_M)
    grid_points = [Point(x, y) for x in xs for y in ys]

    grid = gpd.GeoDataFrame(geometry=grid_points, crs=CRS_UTM)
    grid_wgs = grid.to_crs(CRS_WGS84)

    return grid, grid_wgs, xs, ys

def _fetch_one(args):
    idx, lat, lon = args
    session = requests.Session()
    for attempt in range(3):
        try:
            resp = session.get(KARTVERKET_URL, params={
                'nord': lat,
                'ost': lon,
                'koordsys': 4326,
            }, timeout=15)
            if resp.ok:
                data = resp.json()
                return idx, data.get('punkter', [{}])[0].get('z', None)
            if resp.status_code == 429:
                import time
                time.sleep(1 * (attempt + 1))
                continue
            return idx, None
        except Exception:
            if attempt < 2:
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
        futures = {executor.submit(_fetch_one, t): t for t in tasks}
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

    dy, dx = np.gradient(z_filled, ELEVATION_GRID_SPACING_M)
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
        return gpd.GeoDataFrame(geometry=[], crs=CRS_UTM)

    steep = gpd.GeoDataFrame(geometry=steep_points, crs=CRS_UTM)
    steep_buffered = steep.copy()
    steep_buffered['geometry'] = steep.buffer(ELEVATION_GRID_SPACING_M)

    from shapely.ops import unary_union
    merged = unary_union(steep_buffered.geometry)

    if merged.is_empty:
        return gpd.GeoDataFrame(geometry=[], crs=CRS_UTM)

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
    print('Computing slope analysis...')
    grid, grid_wgs, xs, ys = create_elevation_grid()
    elevations = fetch_elevations(grid_wgs)
    slope_deg = compute_slope(elevations, xs, ys)
    return get_steep_areas(slope_deg, xs, ys)

if __name__ == '__main__':
    steep = fetch_steep_slopes()
    print(f'Found {len(steep)} steep slope polygons')
