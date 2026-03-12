import osmnx as ox
import geopandas as gpd
from shapely.geometry import box
from config import BBOX, CRS_UTM

def get_study_area():
    return box(BBOX['west'], BBOX['south'], BBOX['east'], BBOX['north'])

def fetch_buildings():
    print('Fetching buildings...')
    try:
        gdf = ox.features_from_bbox(
            bbox=(BBOX['west'], BBOX['south'], BBOX['east'], BBOX['north']),
            tags={'building': True}
        )
        gdf = gdf[gdf.geometry.type.isin(['Polygon', 'MultiPolygon'])].copy()
        print(f'  {len(gdf)} buildings')
        return gdf.to_crs(CRS_UTM)
    except Exception as e:
        print(f'  Error: {e}')
        return gpd.GeoDataFrame(geometry=[], crs=CRS_UTM)

def fetch_railways():
    print('Fetching railways...')
    try:
        gdf = ox.features_from_bbox(
            bbox=(BBOX['west'], BBOX['south'], BBOX['east'], BBOX['north']),
            tags={'railway': True}
        )
        print(f'  {len(gdf)} railway features')
        return gdf.to_crs(CRS_UTM)
    except Exception as e:
        print(f'  Error: {e}')
        return gpd.GeoDataFrame(geometry=[], crs=CRS_UTM)

def fetch_highways():
    print('Fetching highways...')
    try:
        gdf = ox.features_from_bbox(
            bbox=(BBOX['west'], BBOX['south'], BBOX['east'], BBOX['north']),
            tags={'highway': True}
        )
        print(f'  {len(gdf)} highway features')
        return gdf.to_crs(CRS_UTM)
    except Exception as e:
        print(f'  Error: {e}')
        return gpd.GeoDataFrame(geometry=[], crs=CRS_UTM)

def fetch_parks():
    print('Fetching parks...')
    try:
        gdf = ox.features_from_bbox(
            bbox=(BBOX['west'], BBOX['south'], BBOX['east'], BBOX['north']),
            tags={'leisure': 'park'}
        )
        gdf = gdf[gdf.geometry.type.isin(['Polygon', 'MultiPolygon'])].copy()
        print(f'  {len(gdf)} parks')
        return gdf.to_crs(CRS_UTM)
    except Exception as e:
        print(f'  Error: {e}')
        return gpd.GeoDataFrame(geometry=[], crs=CRS_UTM)

def fetch_waterways():
    print('Fetching waterways...')
    try:
        water_line = ox.features_from_bbox(
            bbox=(BBOX['west'], BBOX['south'], BBOX['east'], BBOX['north']),
            tags={'waterway': True}
        )
        water_poly = ox.features_from_bbox(
            bbox=(BBOX['west'], BBOX['south'], BBOX['east'], BBOX['north']),
            tags={'natural': 'water'}
        )
        gdf = gpd.GeoDataFrame(
            pd.concat([water_line, water_poly], ignore_index=True),
            crs=water_line.crs if len(water_line) > 0 else 'EPSG:4326'
        )
        print(f'  {len(gdf)} water features')
        return gdf.to_crs(CRS_UTM)
    except Exception as e:
        print(f'  Error: {e}')
        return gpd.GeoDataFrame(geometry=[], crs=CRS_UTM)

def fetch_landuse():
    print('Fetching landuse...')
    try:
        gdf = ox.features_from_bbox(
            bbox=(BBOX['west'], BBOX['south'], BBOX['east'], BBOX['north']),
            tags={'landuse': True}
        )
        gdf = gdf[gdf.geometry.type.isin(['Polygon', 'MultiPolygon'])].copy()
        print(f'  {len(gdf)} landuse polygons')
        return gdf.to_crs(CRS_UTM)
    except Exception as e:
        print(f'  Error: {e}')
        return gpd.GeoDataFrame(geometry=[], crs=CRS_UTM)

def fetch_natural():
    print('Fetching natural features...')
    try:
        gdf = ox.features_from_bbox(
            bbox=(BBOX['west'], BBOX['south'], BBOX['east'], BBOX['north']),
            tags={'natural': True}
        )
        print(f'  {len(gdf)} natural features')
        return gdf.to_crs(CRS_UTM)
    except Exception as e:
        print(f'  Error: {e}')
        return gpd.GeoDataFrame(geometry=[], crs=CRS_UTM)

def fetch_tram():
    print('Fetching tram lines...')
    try:
        gdf = ox.features_from_bbox(
            bbox=(BBOX['west'], BBOX['south'], BBOX['east'], BBOX['north']),
            tags={'railway': 'tram'}
        )
        print(f'  {len(gdf)} tram features')
        return gdf.to_crs(CRS_UTM)
    except Exception as e:
        print(f'  Error: {e}')
        return gpd.GeoDataFrame(geometry=[], crs=CRS_UTM)

import pandas as pd

def fetch_all():
    return {
        'buildings': fetch_buildings(),
        'railways': fetch_railways(),
        'highways': fetch_highways(),
        'parks': fetch_parks(),
        'waterways': fetch_waterways(),
        'landuse': fetch_landuse(),
        'natural': fetch_natural(),
        'tram': fetch_tram(),
    }

if __name__ == '__main__':
    data = fetch_all()
    for name, gdf in data.items():
        print(f'{name}: {len(gdf)} features')
