import numpy as np
import requests
import geopandas as gpd
from shapely.geometry import Point, box
from config import (
    BBOX, CRS_UTM, CRS_WGS84,
    ELEVATION_GRID_SPACING_M, ELEVATION_BATCH_SIZE,
    SLOPE_THRESHOLD_DEG
)

KARTVERKET_URL = 'https://ws.geonorge.no/hoydedata/v1/punkt'

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

def fetch_elevations(grid_wgs):
    print(f'Fetching elevation for {len(grid_wgs)} points...')
    elevations = []

    coords = [(p.y, p.x) for p in grid_wgs.geometry]

    for i in range(0, len(coords), ELEVATION_BATCH_SIZE):
        batch = coords[i:i + ELEVATION_BATCH_SIZE]
        batch_elevations = []
        for lat, lon in batch:
            try:
                resp = requests.get(KARTVERKET_URL, params={
                    'nord': lat,
                    'ost': lon,
                    'koordsys': 4326,
                    'geession': 'SRID=4326',
                }, timeout=10)
                if resp.ok:
                    data = resp.json()
                    batch_elevations.append(data.get('punkter', [{}])[0].get('z', None))
                else:
                    batch_elevations.append(None)
            except Exception:
                batch_elevations.append(None)
        elevations.extend(batch_elevations)

        if (i // ELEVATION_BATCH_SIZE) % 10 == 0:
            print(f'  Processed {min(i + ELEVATION_BATCH_SIZE, len(coords))}/{len(coords)} points')

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
