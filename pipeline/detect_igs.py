import geopandas as gpd
import pandas as pd
from shapely.geometry import MultiPolygon, box
from shapely.ops import unary_union
from shapely.validation import make_valid
from config import (
    BBOX, CRS_UTM, CRS_WGS84,
    BUFFER_RAIL_M, BUFFER_ROAD_M, BUFFER_WATER_M,
    MIN_AREA_RESIDUAL_M2, MIN_AREA_LOT_M2, MIN_AREA_EDGELAND_M2,
    OPPORTUNITY_PROXIMITY_M
)

def safe_union(gdf):
    if gdf is None or len(gdf) == 0:
        return None
    geoms = [make_valid(g) for g in gdf.geometry if g is not None and not g.is_empty]
    if not geoms:
        return None
    return unary_union(geoms)

def clip_to_study_area(gdf):
    study = gpd.GeoDataFrame(
        geometry=[box(BBOX['west'], BBOX['south'], BBOX['east'], BBOX['north'])],
        crs=CRS_WGS84
    ).to_crs(CRS_UTM)
    return gpd.clip(gdf, study)

def to_polygons(geometry):
    if geometry is None or geometry.is_empty:
        return []
    geometry = make_valid(geometry)
    if geometry.geom_type == 'Polygon':
        return [geometry]
    elif geometry.geom_type == 'MultiPolygon':
        return list(geometry.geoms)
    elif geometry.geom_type == 'GeometryCollection':
        return [g for g in geometry.geoms if g.geom_type in ('Polygon', 'MultiPolygon')]
    return []

def detect_residual(data):
    print('Detecting Residual IGS...')
    results = []

    rail_union = safe_union(data['railways'])
    major_roads = data['highways']
    if 'highway' in major_roads.columns:
        major = major_roads[major_roads['highway'].isin([
            'motorway', 'trunk', 'primary', 'secondary',
            'motorway_link', 'trunk_link'
        ])]
    else:
        major = major_roads

    road_union = safe_union(major)
    buildings_union = safe_union(data['buildings'])
    parks_union = safe_union(data['parks'])

    infra_buffer = None
    subtypes = {}

    if rail_union is not None:
        rail_buf = rail_union.buffer(BUFFER_RAIL_M)
        if infra_buffer is None:
            infra_buffer = rail_buf
        else:
            infra_buffer = infra_buffer.union(rail_buf)
        for p in to_polygons(rail_buf):
            subtypes[id(p)] = 'Train'

    if road_union is not None:
        road_buf = road_union.buffer(BUFFER_ROAD_M)
        if infra_buffer is None:
            infra_buffer = road_buf
        else:
            infra_buffer = infra_buffer.union(road_buf)
        for p in to_polygons(road_buf):
            subtypes[id(p)] = 'Road'

    if infra_buffer is None:
        print('  No infrastructure found')
        return gpd.GeoDataFrame(columns=['geometry', 'igs_type', 'subtype'], crs=CRS_UTM)

    residual = infra_buffer
    if buildings_union is not None:
        residual = residual.difference(buildings_union.buffer(2))
    if parks_union is not None:
        residual = residual.difference(parks_union)

    all_roads = safe_union(data['highways'])
    if all_roads is not None:
        road_surface = all_roads.buffer(5)
        residual = residual.difference(road_surface)

    residual = make_valid(residual).buffer(0)

    for poly in to_polygons(residual):
        if poly.area >= MIN_AREA_RESIDUAL_M2:
            centroid = poly.centroid
            subtype = 'Road'
            if rail_union is not None and rail_union.buffer(BUFFER_RAIL_M).contains(centroid):
                subtype = 'Train'
            if road_union is not None and road_union.buffer(BUFFER_ROAD_M).contains(centroid):
                if subtype == 'Train':
                    subtype = 'Road/Train'
                else:
                    subtype = 'Road'
            results.append({
                'geometry': poly,
                'igs_type': 'Residual',
                'subtype': subtype,
            })

    print(f'  Found {len(results)} Residual IGS candidates')
    return gpd.GeoDataFrame(results, crs=CRS_UTM) if results else gpd.GeoDataFrame(
        columns=['geometry', 'igs_type', 'subtype'], crs=CRS_UTM
    )

def detect_lot(data):
    print('Detecting Lot IGS...')
    results = []

    landuse = data['landuse']
    if 'landuse' in landuse.columns:
        vacant = landuse[landuse['landuse'].isin([
            'brownfield', 'construction', 'vacant', 'greenfield'
        ])]
    else:
        vacant = gpd.GeoDataFrame(geometry=[], crs=CRS_UTM)

    for _, row in vacant.iterrows():
        geom = make_valid(row.geometry)
        for poly in to_polygons(geom):
            if poly.area >= MIN_AREA_LOT_M2:
                results.append({
                    'geometry': poly,
                    'igs_type': 'Lot',
                    'subtype': row.get('landuse', 'vacant'),
                })

    buildings_union = safe_union(data['buildings'])
    if buildings_union is not None and len(data['buildings']) > 100:
        buildings = data['buildings']
        hull = buildings.unary_union.convex_hull
        filled = hull
        gaps = filled.difference(buildings_union)
        gaps = make_valid(gaps).buffer(0)

        parks_union = safe_union(data['parks'])
        if parks_union is not None:
            gaps = gaps.difference(parks_union)

        for poly in to_polygons(gaps):
            if MIN_AREA_LOT_M2 <= poly.area <= 5000:
                already = any(poly.intersection(r['geometry']).area / poly.area > 0.5 for r in results)
                if not already:
                    results.append({
                        'geometry': poly,
                        'igs_type': 'Lot',
                        'subtype': 'building_gap',
                    })

    print(f'  Found {len(results)} Lot IGS candidates')
    return gpd.GeoDataFrame(results, crs=CRS_UTM) if results else gpd.GeoDataFrame(
        columns=['geometry', 'igs_type', 'subtype'], crs=CRS_UTM
    )

def detect_edgelands(data, steep_slopes=None):
    print('Detecting Edgelands...')
    results = []

    buildings_union = safe_union(data['buildings'])
    waterways_union = safe_union(data['waterways'])

    if waterways_union is not None:
        hydro = waterways_union.buffer(BUFFER_WATER_M)
        if buildings_union is not None:
            hydro = hydro.difference(buildings_union.buffer(2))
        hydro = make_valid(hydro).buffer(0)
        for poly in to_polygons(hydro):
            if poly.area >= MIN_AREA_EDGELAND_M2:
                results.append({
                    'geometry': poly,
                    'igs_type': 'Edgeland',
                    'subtype': 'Hydro',
                })

    natural = data.get('natural')
    if natural is not None and len(natural) > 0 and 'natural' in natural.columns:
        woods = natural[natural['natural'].isin(['wood', 'scrub', 'heath'])]
        if len(woods) > 0:
            woods_union = safe_union(woods)
            landuse = data.get('landuse')
            if landuse is not None and 'landuse' in landuse.columns:
                residential = landuse[landuse['landuse'] == 'residential']
                if len(residential) > 0:
                    res_union = safe_union(residential)
                    if woods_union is not None and res_union is not None:
                        edge = woods_union.buffer(30).intersection(res_union.buffer(30))
                        if buildings_union is not None:
                            edge = edge.difference(buildings_union.buffer(2))
                        edge = make_valid(edge).buffer(0)
                        for poly in to_polygons(edge):
                            if poly.area >= MIN_AREA_EDGELAND_M2:
                                results.append({
                                    'geometry': poly,
                                    'igs_type': 'Edgeland',
                                    'subtype': 'Bio',
                                })

    if steep_slopes is not None and len(steep_slopes) > 0:
        for _, row in steep_slopes.iterrows():
            geom = make_valid(row.geometry)
            if buildings_union is not None:
                geom = geom.difference(buildings_union.buffer(2))
            geom = make_valid(geom).buffer(0)
            for poly in to_polygons(geom):
                if poly.area >= MIN_AREA_EDGELAND_M2:
                    results.append({
                        'geometry': poly,
                        'igs_type': 'Edgeland',
                        'subtype': 'Geo',
                    })

    print(f'  Found {len(results)} Edgeland candidates')
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

    commercial = landuse[landuse['landuse'].isin([
        'industrial', 'commercial', 'retail'
    ])]

    residential = landuse[landuse['landuse'] == 'residential']
    res_union = safe_union(residential)

    buildings_union = safe_union(data['buildings'])

    for _, row in commercial.iterrows():
        geom = make_valid(row.geometry)
        centroid = geom.centroid

        near_residential = False
        if res_union is not None:
            near_residential = centroid.distance(res_union) < OPPORTUNITY_PROXIMITY_M
        elif buildings_union is not None:
            near_residential = centroid.distance(buildings_union) < OPPORTUNITY_PROXIMITY_M

        if near_residential:
            for poly in to_polygons(geom):
                if poly.area >= MIN_AREA_LOT_M2:
                    results.append({
                        'geometry': poly,
                        'igs_type': 'Opportunity',
                        'subtype': row.get('landuse', 'commercial'),
                    })

    print(f'  Found {len(results)} Opportunity space candidates')
    return gpd.GeoDataFrame(results, crs=CRS_UTM) if results else gpd.GeoDataFrame(
        columns=['geometry', 'igs_type', 'subtype'], crs=CRS_UTM
    )

def remove_overlaps(all_igs):
    if len(all_igs) == 0:
        return all_igs

    priority = {'Residual': 1, 'Edgeland': 2, 'Lot': 3, 'Opportunity': 4}
    all_igs['priority'] = all_igs['igs_type'].map(priority)
    all_igs = all_igs.sort_values('priority').reset_index(drop=True)

    kept = []
    union_so_far = None

    for _, row in all_igs.iterrows():
        geom = make_valid(row.geometry)
        if union_so_far is not None:
            geom = geom.difference(union_so_far)
            geom = make_valid(geom).buffer(0)

        polys = to_polygons(geom)
        for poly in polys:
            min_area = {
                'Residual': MIN_AREA_RESIDUAL_M2,
                'Lot': MIN_AREA_LOT_M2,
                'Edgeland': MIN_AREA_EDGELAND_M2,
                'Opportunity': MIN_AREA_LOT_M2,
            }.get(row['igs_type'], MIN_AREA_LOT_M2)

            if poly.area >= min_area:
                kept.append({
                    'geometry': poly,
                    'igs_type': row['igs_type'],
                    'subtype': row.get('subtype'),
                })
                if union_so_far is None:
                    union_so_far = poly
                else:
                    union_so_far = union_so_far.union(poly)

    if not kept:
        return gpd.GeoDataFrame(columns=['geometry', 'igs_type', 'subtype'], crs=CRS_UTM)

    return gpd.GeoDataFrame(kept, crs=CRS_UTM)

def detect_all(data, steep_slopes=None):
    residual = detect_residual(data)
    lot = detect_lot(data)
    edgelands = detect_edgelands(data, steep_slopes)
    opportunity = detect_opportunity(data)

    all_igs = pd.concat([residual, lot, edgelands, opportunity], ignore_index=True)
    all_igs = clip_to_study_area(all_igs)
    all_igs = remove_overlaps(all_igs)

    print(f'\nTotal IGS candidates: {len(all_igs)}')
    if len(all_igs) > 0:
        print(all_igs['igs_type'].value_counts().to_string())

    return all_igs
