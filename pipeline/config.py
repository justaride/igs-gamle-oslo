import os


def require_env(name):
    value = os.environ.get(name)
    if value:
        return value
    raise RuntimeError(f'Missing required environment variable: {name}')


BBOX = {
    'north': 59.925,
    'south': 59.895,
    'east': 10.82,
    'west': 10.74,
}

CRS_UTM = 'EPSG:25833'
CRS_WGS84 = 'EPSG:4326'

BUFFER_RAIL_M = 50
BUFFER_ROAD_M = 50
BUFFER_WATER_M = 30
MIN_AREA_RESIDUAL_M2 = 1000
MIN_AREA_LOT_M2 = 100
MIN_AREA_EDGELAND_M2 = 150
SLOPE_THRESHOLD_DEG = 15
OPPORTUNITY_PROXIMITY_M = 200
ELEVATION_GRID_SPACING_M = 20
ELEVATION_BATCH_SIZE = 50
