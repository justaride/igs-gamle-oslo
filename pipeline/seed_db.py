import geopandas as gpd
from shapely.geometry import MultiPolygon, mapping
from sqlalchemy import create_engine, text
from config import DATABASE_URL, CRS_WGS84, CRS_UTM
import json

def ensure_multi(geom):
    if geom.geom_type == 'Polygon':
        return MultiPolygon([geom])
    return geom

def seed_sites(igs_gdf):
    engine = create_engine(DATABASE_URL)

    igs_wgs = igs_gdf.to_crs(CRS_WGS84)
    igs_wgs['area_m2'] = igs_gdf.to_crs(CRS_UTM).geometry.area

    igs_wgs = igs_wgs.sort_values(
        by=['geometry'],
        key=lambda col: col.apply(lambda g: (g.centroid.x, -g.centroid.y))
    ).reset_index(drop=True)

    with engine.begin() as conn:
        conn.execute(text('DELETE FROM species_observations'))
        conn.execute(text('DELETE FROM sites'))

        for i, row in igs_wgs.iterrows():
            site_number = f'IGS-{i + 1:03d}'
            geom = ensure_multi(row.geometry)
            geojson = json.dumps(mapping(geom))

            conn.execute(text('''
                INSERT INTO sites (site_number, geom, igs_type, subtype, area_m2)
                VALUES (
                    :site_number,
                    ST_SetSRID(ST_GeomFromGeoJSON(:geojson), 4326),
                    :igs_type,
                    :subtype,
                    :area_m2
                )
            '''), {
                'site_number': site_number,
                'geojson': geojson,
                'igs_type': row['igs_type'],
                'subtype': row.get('subtype'),
                'area_m2': row['area_m2'],
            })

        print(f'Seeded {len(igs_wgs)} sites')

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
