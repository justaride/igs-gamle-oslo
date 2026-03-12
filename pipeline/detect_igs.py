import geopandas as gpd
import pandas as pd
import numpy as np
from shapely.geometry import MultiPolygon, box
from shapely.ops import unary_union
from shapely.validation import make_valid
from config import (
    BBOX, CRS_UTM, CRS_WGS84,
    BUFFER_RAIL_M, BUFFER_ROAD_M, BUFFER_WATER_M,
    MIN_AREA_RESIDUAL_M2, MIN_AREA_LOT_M2, MIN_AREA_EDGELAND_M2,
    OPPORTUNITY_PROXIMITY_M
)

def safe_union_chunked(gdf, chunk_size=500):
    if gdf is None or len(gdf) == 0:
        return None
    geoms = [make_valid(g) for g in gdf.geometry if g is not None and not g.is_empty]
    if not geoms:
        return None
    if len(geoms) <= chunk_size:
        return unary_union(geoms)
    chunks = [geoms[i:i+chunk_size] for i in range(0, len(geoms), chunk_size)]
    partial = [unary_union(c) for c in chunks]
    return unary_union(partial)

def subtract_gdf(base_gdf, subtract_gdf_arg, buffer_m=0):
    if subtract_gdf_arg is None or len(subtract_gdf_arg) == 0:
        return base_gdf
    if len(base_gdf) == 0:
        return base_gdf
    sub = subtract_gdf_arg.copy()
    if buffer_m > 0:
        sub = sub.copy()
        sub['geometry'] = sub.geometry.buffer(buffer_m)
    try:
        result = gpd.overlay(base_gdf, sub[['geometry']], how='difference')
        return result
    except Exception:
        sub_union = safe_union_chunked(sub)
        if sub_union is None:
            return base_gdf
        base_gdf = base_gdf.copy()
        base_gdf['geometry'] = base_gdf.geometry.apply(
            lambda g: make_valid(g.difference(sub_union)).buffer(0) if g is not None else g
        )
        return base_gdf[~base_gdf.geometry.is_empty]

def clip_to_study_area(gdf):
    if len(gdf) == 0:
        return gdf
    study = gpd.GeoDataFrame(
        geometry=[box(BBOX['west'], BBOX['south'], BBOX['east'], BBOX['north'])],
        crs=CRS_WGS84
    ).to_crs(CRS_UTM)
    return gpd.clip(gdf, study)

def to_polygons_gdf(gdf, min_area=0):
    if len(gdf) == 0:
        return gdf
    exploded = gdf.explode(index_parts=False)
    exploded = exploded[exploded.geometry.type.isin(['Polygon', 'MultiPolygon'])]
    if min_area > 0:
        exploded = exploded[exploded.geometry.area >= min_area]
    return exploded.reset_index(drop=True)

def detect_residual(data):
    print('Detecting Residual IGS...')

    railways = data['railways']
    highways = data['highways']

    if 'highway' in highways.columns:
        major = highways[highways['highway'].isin([
            'motorway', 'trunk', 'primary', 'secondary',
            'motorway_link', 'trunk_link'
        ])].copy()
    else:
        major = highways.copy()

    infra_parts = []
    subtypes_map = []

    if len(railways) > 0:
        rail_buf = railways.copy()
        rail_buf['geometry'] = rail_buf.geometry.buffer(BUFFER_RAIL_M)
        rail_buf = rail_buf[rail_buf.geometry.type.isin(['Polygon', 'MultiPolygon'])]
        rail_buf['_subtype'] = 'Train'
        infra_parts.append(rail_buf[['geometry', '_subtype']])

    if len(major) > 0:
        road_buf = major.copy()
        road_buf['geometry'] = road_buf.geometry.buffer(BUFFER_ROAD_M)
        road_buf = road_buf[road_buf.geometry.type.isin(['Polygon', 'MultiPolygon'])]
        road_buf['_subtype'] = 'Road'
        infra_parts.append(road_buf[['geometry', '_subtype']])

    if not infra_parts:
        print('  No infrastructure found')
        return gpd.GeoDataFrame(columns=['geometry', 'igs_type', 'subtype'], crs=CRS_UTM)

    infra = gpd.GeoDataFrame(pd.concat(infra_parts, ignore_index=True), crs=CRS_UTM)
    print(f'  Infrastructure buffer polygons: {len(infra)}')

    residual = subtract_gdf(infra, data['buildings'], buffer_m=2)
    print(f'  After removing buildings: {len(residual)}')

    residual = subtract_gdf(residual, data['parks'])
    print(f'  After removing parks: {len(residual)}')

    if len(highways) > 0:
        road_surface = highways.copy()
        road_surface['geometry'] = road_surface.geometry.buffer(5)
        road_surface = road_surface[road_surface.geometry.type.isin(['Polygon', 'MultiPolygon'])]
        residual = subtract_gdf(residual, road_surface)
        print(f'  After removing road surfaces: {len(residual)}')

    residual = to_polygons_gdf(residual, MIN_AREA_RESIDUAL_M2)
    residual['igs_type'] = 'Residual'
    if '_subtype' in residual.columns:
        residual = residual.rename(columns={'_subtype': 'subtype'})
    else:
        residual['subtype'] = 'Road'

    residual = residual[['geometry', 'igs_type', 'subtype']]
    print(f'  Found {len(residual)} Residual IGS candidates')
    return residual

def detect_lot(data):
    print('Detecting Lot IGS...')
    results = []

    landuse = data['landuse']
    if 'landuse' in landuse.columns:
        vacant = landuse[landuse['landuse'].isin([
            'brownfield', 'construction', 'vacant', 'greenfield'
        ])].copy()
        for _, row in vacant.iterrows():
            geom = make_valid(row.geometry)
            if geom.geom_type in ('Polygon', 'MultiPolygon') and geom.area >= MIN_AREA_LOT_M2:
                results.append({
                    'geometry': geom,
                    'igs_type': 'Lot',
                    'subtype': row.get('landuse', 'vacant'),
                })

    print(f'  Found {len(results)} Lot IGS candidates')
    return gpd.GeoDataFrame(results, crs=CRS_UTM) if results else gpd.GeoDataFrame(
        columns=['geometry', 'igs_type', 'subtype'], crs=CRS_UTM
    )

def detect_edgelands(data, steep_slopes=None):
    print('Detecting Edgelands...')
    results = []

    waterways = data['waterways']
    buildings = data['buildings']

    if len(waterways) > 0:
        water_buf = waterways.copy()
        water_buf['geometry'] = water_buf.geometry.buffer(BUFFER_WATER_M)
        water_buf = water_buf[water_buf.geometry.type.isin(['Polygon', 'MultiPolygon'])]
        water_buf = gpd.GeoDataFrame(water_buf[['geometry']], crs=CRS_UTM)

        hydro = subtract_gdf(water_buf, buildings, buffer_m=2)
        hydro = to_polygons_gdf(hydro, MIN_AREA_EDGELAND_M2)

        for _, row in hydro.iterrows():
            results.append({
                'geometry': row.geometry,
                'igs_type': 'Edgeland',
                'subtype': 'Hydro',
            })
        print(f'  Hydro edges: {len(hydro)}')

    natural = data.get('natural')
    if natural is not None and len(natural) > 0 and 'natural' in natural.columns:
        woods = natural[natural['natural'].isin(['wood', 'scrub', 'heath'])]
        landuse = data.get('landuse')
        if len(woods) > 0 and landuse is not None and 'landuse' in landuse.columns:
            residential = landuse[landuse['landuse'] == 'residential']
            if len(residential) > 0:
                woods_buf = woods.copy()
                woods_buf['geometry'] = woods_buf.geometry.buffer(30)
                woods_buf = woods_buf[woods_buf.geometry.type.isin(['Polygon', 'MultiPolygon'])]

                res_buf = residential.copy()
                res_buf['geometry'] = res_buf.geometry.buffer(30)
                res_buf = res_buf[res_buf.geometry.type.isin(['Polygon', 'MultiPolygon'])]

                try:
                    bio_edge = gpd.overlay(
                        gpd.GeoDataFrame(woods_buf[['geometry']], crs=CRS_UTM),
                        gpd.GeoDataFrame(res_buf[['geometry']], crs=CRS_UTM),
                        how='intersection'
                    )
                    bio_edge = subtract_gdf(bio_edge, buildings, buffer_m=2)
                    bio_edge = to_polygons_gdf(bio_edge, MIN_AREA_EDGELAND_M2)

                    for _, row in bio_edge.iterrows():
                        results.append({
                            'geometry': row.geometry,
                            'igs_type': 'Edgeland',
                            'subtype': 'Bio',
                        })
                    print(f'  Bio edges: {len(bio_edge)}')
                except Exception as e:
                    print(f'  Bio edge detection failed: {e}')

    if steep_slopes is not None and len(steep_slopes) > 0:
        geo_edge = subtract_gdf(
            gpd.GeoDataFrame(steep_slopes[['geometry']], crs=CRS_UTM),
            buildings, buffer_m=2
        )
        geo_edge = to_polygons_gdf(geo_edge, MIN_AREA_EDGELAND_M2)
        for _, row in geo_edge.iterrows():
            results.append({
                'geometry': row.geometry,
                'igs_type': 'Edgeland',
                'subtype': 'Geo',
            })
        print(f'  Geo edges: {len(geo_edge)}')

    print(f'  Found {len(results)} Edgeland candidates total')
    return gpd.GeoDataFrame(results, crs=CRS_UTM) if results else gpd.GeoDataFrame(
        columns=['geometry', 'igs_type', 'subtype'], crs=CRS_UTM
    )

def detect_opportunity(data):
    print('Detecting Opportunity spaces...')
    results = []

    landuse = data['landuse']
    if 'landuse' not in landuse.columns:
        print('  No landuse data')
        return gpd.GeoDataFrame(columns=['geometry', 'igs_type', 'subtype'], crs=CRS_UTM)

    commercial = landuse[landuse['landuse'].isin(['industrial', 'commercial', 'retail'])]
    residential = landuse[landuse['landuse'] == 'residential']

    if len(commercial) == 0:
        print('  No commercial/industrial landuse')
        return gpd.GeoDataFrame(columns=['geometry', 'igs_type', 'subtype'], crs=CRS_UTM)

    if len(residential) > 0:
        res_union = safe_union_chunked(residential)
    else:
        res_union = safe_union_chunked(data['buildings'])

    for _, row in commercial.iterrows():
        geom = make_valid(row.geometry)
        if geom.geom_type not in ('Polygon', 'MultiPolygon'):
            continue
        centroid = geom.centroid
        if res_union is not None and centroid.distance(res_union) < OPPORTUNITY_PROXIMITY_M:
            if geom.area >= MIN_AREA_LOT_M2:
                results.append({
                    'geometry': geom,
                    'igs_type': 'Opportunity',
                    'subtype': row.get('landuse', 'commercial'),
                })

    print(f'  Found {len(results)} Opportunity space candidates')
    return gpd.GeoDataFrame(results, crs=CRS_UTM) if results else gpd.GeoDataFrame(
        columns=['geometry', 'igs_type', 'subtype'], crs=CRS_UTM
    )

def detect_all(data, steep_slopes=None):
    residual = detect_residual(data)
    lot = detect_lot(data)
    edgelands = detect_edgelands(data, steep_slopes)
    opportunity = detect_opportunity(data)

    all_igs = pd.concat([residual, lot, edgelands, opportunity], ignore_index=True)

    if len(all_igs) == 0:
        print('\nNo IGS candidates detected')
        return all_igs

    all_igs['geometry'] = all_igs.geometry.apply(lambda g: make_valid(g).buffer(0))
    all_igs = all_igs[~all_igs.geometry.is_empty]
    all_igs = clip_to_study_area(all_igs)

    print(f'\nTotal IGS candidates: {len(all_igs)}')
    if len(all_igs) > 0:
        print(all_igs['igs_type'].value_counts().to_string())

    return all_igs
