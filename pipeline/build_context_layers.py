import geopandas as gpd
import pandas as pd
from shapely.validation import make_valid

from config import (
    BUFFER_RAIL_M,
    BUFFER_ROAD_M,
    BUFFER_WATER_M,
    CRS_UTM,
    MIN_AREA_EDGELAND_M2,
    MIN_AREA_LOT_M2,
    OPPORTUNITY_PROXIMITY_M,
)
from detect_igs import safe_union_chunked, subtract_gdf, to_polygons_gdf


def empty_gdf():
    return gpd.GeoDataFrame({'geometry': []}, geometry='geometry', crs=CRS_UTM)


def compact_gdf(gdf, columns):
    if gdf is None or len(gdf) == 0:
        return empty_gdf()

    keep = [col for col in columns if col in gdf.columns]
    result = gdf[keep + ['geometry']].copy()
    result = result[result.geometry.notna()]
    result = result[~result.geometry.is_empty]
    if len(result) == 0:
        return empty_gdf()
    return gpd.GeoDataFrame(result, geometry='geometry', crs=gdf.crs or CRS_UTM)


def get_major_highways(highways):
    if highways is None or len(highways) == 0:
        return empty_gdf()
    if 'highway' not in highways.columns:
        return highways.copy()
    return highways[highways['highway'].isin([
        'motorway', 'trunk', 'primary', 'secondary',
        'motorway_link', 'trunk_link'
    ])].copy()


def build_residual_infrastructure_buffers(data):
    major = get_major_highways(data.get('highways'))
    railways = data.get('railways')
    parts = []

    if railways is not None and len(railways) > 0:
        rail_buf = railways.copy()
        rail_buf['geometry'] = rail_buf.geometry.buffer(BUFFER_RAIL_M)
        rail_buf = rail_buf[rail_buf.geometry.type.isin(['Polygon', 'MultiPolygon'])]
        rail_buf['source_type'] = 'Train'
        parts.append(compact_gdf(rail_buf, ['source_type', 'railway', 'name']))

    if major is not None and len(major) > 0:
        road_buf = major.copy()
        road_buf['geometry'] = road_buf.geometry.buffer(BUFFER_ROAD_M)
        road_buf = road_buf[road_buf.geometry.type.isin(['Polygon', 'MultiPolygon'])]
        road_buf['source_type'] = 'Road'
        parts.append(compact_gdf(road_buf, ['source_type', 'highway', 'name']))

    if not parts:
        return empty_gdf()

    combined = gpd.GeoDataFrame(
        pd.concat(parts, ignore_index=True),
        geometry='geometry',
        crs=CRS_UTM
    )
    combined['geometry'] = combined.geometry.apply(make_valid)
    return combined[~combined.geometry.is_empty]


def build_road_surface_mask(data):
    highways = data.get('highways')
    if highways is None or len(highways) == 0:
        return empty_gdf()

    road_surface = highways.copy()
    road_surface['geometry'] = road_surface.geometry.buffer(5)
    road_surface = road_surface[road_surface.geometry.type.isin(['Polygon', 'MultiPolygon'])]
    road_surface['source_type'] = 'Road surface'
    return compact_gdf(road_surface, ['source_type', 'highway', 'name'])


def build_edgeland_water_buffer(data):
    waterways = data.get('waterways')
    if waterways is None or len(waterways) == 0:
        return empty_gdf()

    water_buf = waterways.copy()
    water_buf['geometry'] = water_buf.geometry.buffer(BUFFER_WATER_M)
    water_buf = water_buf[water_buf.geometry.type.isin(['Polygon', 'MultiPolygon'])]
    water_buf['edge_type'] = 'Hydro'
    return compact_gdf(water_buf, ['edge_type', 'waterway', 'natural', 'name'])


def build_edgeland_bio_edges(data):
    natural = data.get('natural')
    landuse = data.get('landuse')
    buildings = data.get('buildings')

    if natural is None or len(natural) == 0 or 'natural' not in natural.columns:
        return empty_gdf()
    if landuse is None or len(landuse) == 0 or 'landuse' not in landuse.columns:
        return empty_gdf()

    woods = natural[natural['natural'].isin(['wood', 'scrub', 'heath'])].copy()
    residential = landuse[landuse['landuse'] == 'residential'].copy()
    if len(woods) == 0 or len(residential) == 0:
        return empty_gdf()

    woods['geometry'] = woods.geometry.buffer(30)
    woods = woods[woods.geometry.type.isin(['Polygon', 'MultiPolygon'])]

    residential['geometry'] = residential.geometry.buffer(30)
    residential = residential[residential.geometry.type.isin(['Polygon', 'MultiPolygon'])]

    try:
        bio_edge = gpd.overlay(
            gpd.GeoDataFrame(woods[['geometry']], crs=CRS_UTM),
            gpd.GeoDataFrame(residential[['geometry']], crs=CRS_UTM),
            how='intersection'
        )
    except Exception:
        return empty_gdf()

    bio_edge = subtract_gdf(bio_edge, buildings, buffer_m=2)
    bio_edge = to_polygons_gdf(bio_edge, MIN_AREA_EDGELAND_M2)
    if len(bio_edge) == 0:
        return empty_gdf()

    bio_edge['edge_type'] = 'Bio'
    return compact_gdf(bio_edge, ['edge_type'])


def build_edgeland_geo_edges(data, steep_slopes):
    buildings = data.get('buildings')
    if steep_slopes is None or len(steep_slopes) == 0:
        return empty_gdf()

    geo_edge = subtract_gdf(
        gpd.GeoDataFrame(steep_slopes[['geometry']], crs=CRS_UTM),
        buildings,
        buffer_m=2
    )
    geo_edge = to_polygons_gdf(geo_edge, MIN_AREA_EDGELAND_M2)
    if len(geo_edge) == 0:
        return empty_gdf()

    geo_edge['edge_type'] = 'Geo'
    return compact_gdf(geo_edge, ['edge_type'])


def build_lot_candidates(data):
    landuse = data.get('landuse')
    if landuse is None or len(landuse) == 0 or 'landuse' not in landuse.columns:
        return empty_gdf()

    vacant = landuse[landuse['landuse'].isin([
        'brownfield', 'construction', 'vacant', 'greenfield'
    ])].copy()
    if len(vacant) == 0:
        return empty_gdf()

    vacant['geometry'] = vacant.geometry.apply(make_valid)
    vacant = vacant[vacant.geometry.type.isin(['Polygon', 'MultiPolygon'])]
    vacant = vacant[vacant.geometry.area >= MIN_AREA_LOT_M2]
    vacant['candidate_type'] = 'Lot'
    return compact_gdf(vacant, ['candidate_type', 'landuse', 'name'])


def build_opportunity_candidates(data):
    landuse = data.get('landuse')
    buildings = data.get('buildings')
    if landuse is None or len(landuse) == 0 or 'landuse' not in landuse.columns:
        return empty_gdf()

    commercial = landuse[landuse['landuse'].isin(['industrial', 'commercial', 'retail'])].copy()
    if len(commercial) == 0:
        return empty_gdf()

    residential = landuse[landuse['landuse'] == 'residential']
    res_union = safe_union_chunked(residential) if len(residential) > 0 else safe_union_chunked(buildings)

    results = []
    for _, row in commercial.iterrows():
        geom = make_valid(row.geometry)
        if geom.geom_type not in ('Polygon', 'MultiPolygon'):
            continue
        if geom.area < MIN_AREA_LOT_M2:
            continue
        centroid = geom.centroid
        if res_union is not None and centroid.distance(res_union) < OPPORTUNITY_PROXIMITY_M:
            results.append({
                'geometry': geom,
                'candidate_type': 'Opportunity',
                'landuse': row.get('landuse'),
                'name': row.get('name'),
            })

    if not results:
        return empty_gdf()

    return gpd.GeoDataFrame(results, geometry='geometry', crs=CRS_UTM)


def build_context_layers(data, steep_slopes=None):
    layers = {
        'buildings': {
            'label': 'Bygg',
            'category': 'reference',
            'description': 'Bygningsflater fra OSM brukt som viktig referanse ved geometri-korrigering.',
            'gdf': compact_gdf(data.get('buildings'), ['building', 'name']),
        },
        'highways': {
            'label': 'Vei',
            'category': 'reference',
            'description': 'Vegnett fra OSM brukt til å lese residuale korridorer og støy-/barriereeffekt.',
            'gdf': compact_gdf(data.get('highways'), ['highway', 'name']),
        },
        'railways': {
            'label': 'Jernbane',
            'category': 'reference',
            'description': 'Jernbanelinjer fra OSM som viktig kant- og residualreferanse.',
            'gdf': compact_gdf(data.get('railways'), ['railway', 'name']),
        },
        'waterways': {
            'label': 'Vann',
            'category': 'reference',
            'description': 'Vannløp og vannflater fra OSM som støtter hydro-lesing av edgelands.',
            'gdf': compact_gdf(data.get('waterways'), ['waterway', 'natural', 'name']),
        },
        'landuse': {
            'label': 'Arealbruk',
            'category': 'reference',
            'description': 'Landuse-flater fra OSM brukt som tolkningslag for lot og opportunity.',
            'gdf': compact_gdf(data.get('landuse'), ['landuse', 'name']),
        },
        'natural': {
            'label': 'Natur',
            'category': 'reference',
            'description': 'Naturflater fra OSM brukt som støtte for bio- og kantsonelesing.',
            'gdf': compact_gdf(data.get('natural'), ['natural', 'name']),
        },
        'tram': {
            'label': 'Trikk',
            'category': 'reference',
            'description': 'Trikkelinjer fra OSM som egen lineær referanse i tett byvev.',
            'gdf': compact_gdf(data.get('tram'), ['railway', 'name']),
        },
        'residual_infra_buffers': {
            'label': 'Residual: infrastrukturbuffer',
            'category': 'qa',
            'description': 'Bufferflater rundt større vei- og jernbaneinfrastruktur som brukes i residual-logikken.',
            'gdf': build_residual_infrastructure_buffers(data),
        },
        'residual_road_surface_mask': {
            'label': 'Residual: veibane-mask',
            'category': 'qa',
            'description': 'Maskelag som fjerner selve veibanen fra residualkandidatene.',
            'gdf': build_road_surface_mask(data),
        },
        'edgeland_water_buffer': {
            'label': 'Edgeland: vannbuffer',
            'category': 'qa',
            'description': 'Vannbuffer brukt til å identifisere hydro-relaterte kantsoner.',
            'gdf': build_edgeland_water_buffer(data),
        },
        'edgeland_bio_edges': {
            'label': 'Edgeland: bio-kant',
            'category': 'qa',
            'description': 'Kantflater mellom vegetasjon og boligvev brukt i bio-edgeland-logikken.',
            'gdf': build_edgeland_bio_edges(data),
        },
        'edgeland_geo_edges': {
            'label': 'Edgeland: terrengkandidat',
            'category': 'qa',
            'description': 'Bratte terrengflater brukt som geo-edgeland-kandidater.',
            'gdf': build_edgeland_geo_edges(data, steep_slopes),
        },
        'steep_slopes': {
            'label': 'Bratte arealer',
            'category': 'qa',
            'description': 'Helningsflater fra høydeanalysen før videre filtrering.',
            'gdf': compact_gdf(steep_slopes, []),
        },
        'lot_candidate_source': {
            'label': 'Lot: kildelag',
            'category': 'qa',
            'description': 'Landuse-kandidater som gir opphav til lot-detekteringen.',
            'gdf': build_lot_candidates(data),
        },
        'opportunity_candidate_source': {
            'label': 'Opportunity: kildelag',
            'category': 'qa',
            'description': 'Kildepolygoner som passer opportunity-logikken før manuell vurdering.',
            'gdf': build_opportunity_candidates(data),
        },
    }

    return layers
