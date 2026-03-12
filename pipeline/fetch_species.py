from pygbif import occurrences
import geopandas as gpd
from shapely.geometry import Point
from config import BBOX

RED_LIST_CATEGORIES = {'CR', 'EN', 'VU', 'NT'}

def fetch_species_for_polygon(polygon_wgs84):
    wkt = polygon_wgs84.wkt
    results = []

    try:
        resp = occurrences.search(
            geometry=wkt,
            limit=300,
            hasCoordinate=True,
            country='NO',
        )

        species_map = {}
        for occ in resp.get('results', []):
            key = occ.get('species') or occ.get('scientificName')
            if not key:
                continue

            if key not in species_map:
                species_map[key] = {
                    'scientific_name': occ.get('scientificName', key),
                    'vernacular_name': occ.get('vernacularName'),
                    'red_list_category': occ.get('iucnRedListCategory'),
                    'is_alien': occ.get('establishmentMeans') == 'INTRODUCED',
                    'count': 0,
                    'lat': occ.get('decimalLatitude'),
                    'lon': occ.get('decimalLongitude'),
                }
            species_map[key]['count'] += 1

        for sp in species_map.values():
            results.append(sp)

    except Exception as e:
        print(f'  GBIF error: {e}')

    return results

def fetch_species_for_sites(sites_gdf):
    all_species = []
    sites_wgs = sites_gdf.to_crs('EPSG:4326')

    for idx, row in sites_wgs.iterrows():
        site_id = row.get('site_id', idx)
        print(f'  Fetching species for site {site_id}...')
        species = fetch_species_for_polygon(row.geometry)
        for sp in species:
            sp['site_id'] = site_id
        all_species.extend(species)
        print(f'    Found {len(species)} species')

    return all_species

if __name__ == '__main__':
    from shapely.geometry import box
    test_poly = box(BBOX['west'], BBOX['south'], BBOX['east'], BBOX['north'])
    species = fetch_species_for_polygon(test_poly)
    print(f'Found {len(species)} species in study area')
    red_listed = [s for s in species if s['red_list_category'] in RED_LIST_CATEGORIES]
    print(f'Red-listed: {len(red_listed)}')
