import pandas as pd
import psycopg2
from config import require_env

DATABASE_URL = require_env('DATABASE_URL')
EXCEL_PATH = require_env('KIM_EXCEL_PATH')

OWNERSHIP_MAP = {
    'Public': 'PUB',
    'Private': 'PRI',
    'Unknown': 'UNK',
}

ACCESS_MAP = {
    'Open': 'O',
    'Partial': 'P',
    'Closed': 'C',
}

MAINTENANCE_MAP = {
    'FM': 'FM',
    'IM': 'IM',
    'NM': 'NM',
    'NO': 'NM',
}

FREQ_MAP = {
    'Weekly': 'W',
    'Monthly': 'M',
    'Seasonal': 'S',
    'Unknown': 'U',
}

KIM_SITES = [
    {
        'col': 'SITE 1',
        'name': 'St Halvards gate along street',
        'ref_lon': 10.7748,
        'ref_lat': 59.9060,
        'igs_type': 'Residual',
        'subtype': 'Road',
    },
    {
        'col': 'SITE 2',
        'name': 'Brakkebygrenda',
        'ref_lon': 10.7735,
        'ref_lat': 59.9065,
        'igs_type': 'Lot',
        'subtype': None,
    },
    {
        'col': 'SITE 3',
        'name': 'Behind NS office along train tracks',
        'ref_lon': 10.7748,
        'ref_lat': 59.9055,
        'igs_type': 'Residual',
        'subtype': 'Train',
    },
    {
        'col': 'SITE 5',
        'name': "Beside Bitten's house",
        'ref_lon': 10.7760,
        'ref_lat': 59.9058,
        'igs_type': 'Residual',
        'subtype': 'Road',
    },
    {
        'col': 'SITE 6',
        'name': 'Aronia berries',
        'ref_lon': 10.7770,
        'ref_lat': 59.9060,
        'igs_type': 'Residual',
        'subtype': 'Road',
    },
]


def yn_to_bool(val):
    if pd.isna(val):
        return None
    s = str(val).strip().lower()
    return s == 'yes'


def parse_excel():
    df = pd.read_excel(EXCEL_PATH, sheet_name='Gamlebyen')
    sites = []

    for spec in KIM_SITES:
        col = spec['col']
        if col not in df.columns:
            print(f'  Column {col} not found, skipping')
            continue

        vals = df[col].tolist()

        name_raw = vals[0]
        ownership_raw = vals[8]
        access_raw = vals[9]
        access_desc = vals[10]
        natural_barrier = vals[11]
        maint_raw = vals[12]
        maint_freq_raw = vals[13]
        prox_housing = vals[16]
        hidden_gem = vals[17]
        dangerous = vals[18]
        noisy = vals[19]
        too_small = vals[20]
        notes = vals[21]

        ownership = OWNERSHIP_MAP.get(str(ownership_raw).strip(), 'UNK') if not pd.isna(ownership_raw) else 'UNK'
        access_control = ACCESS_MAP.get(str(access_raw).strip(), 'O') if not pd.isna(access_raw) else 'O'
        maintenance = MAINTENANCE_MAP.get(str(maint_raw).strip(), None) if not pd.isna(maint_raw) else None
        maint_freq = FREQ_MAP.get(str(maint_freq_raw).strip(), None) if not pd.isna(maint_freq_raw) else None

        access_desc_str = str(access_desc).strip() if not pd.isna(access_desc) else None
        natural_barrier_str = str(natural_barrier).strip() if not pd.isna(natural_barrier) else None
        notes_str = str(notes).strip() if not pd.isna(notes) else None

        site = {
            **spec,
            'parsed_name': str(name_raw).strip() if not pd.isna(name_raw) else spec['name'],
            'ownership': ownership,
            'access_control': access_control,
            'access_description': access_desc_str,
            'natural_barrier': natural_barrier_str,
            'maintenance': maintenance,
            'maintenance_frequency': maint_freq,
            'prox_housing': yn_to_bool(prox_housing),
            'hidden_gem': yn_to_bool(hidden_gem),
            'dangerous': yn_to_bool(dangerous),
            'noisy': yn_to_bool(noisy),
            'too_small': yn_to_bool(too_small),
            'notes': notes_str,
        }
        sites.append(site)

    return sites


def find_best_match(cur, site, exclude_site_numbers=None):
    exclude = exclude_site_numbers or []
    subtype_clause = "AND subtype = %s" if site['subtype'] else ""
    exclude_clause = ""
    exclude_params = []
    if exclude:
        placeholders = ','.join(['%s'] * len(exclude))
        exclude_clause = f"AND site_number NOT IN ({placeholders})"
        exclude_params = exclude

    query = f"""
        SELECT site_number, igs_type, subtype, area_m2,
            ST_Distance(
                geom::geography,
                ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography
            ) as dist_m,
            ST_X(ST_Centroid(geom)), ST_Y(ST_Centroid(geom))
        FROM sites
        WHERE igs_type = %s {subtype_clause} {exclude_clause}
            AND ST_DWithin(
                geom::geography,
                ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
                500
            )
        ORDER BY dist_m
        LIMIT 1
    """

    params = [site['ref_lon'], site['ref_lat'], site['igs_type']]
    if site['subtype']:
        params.append(site['subtype'])
    params.extend(exclude_params)
    params.extend([site['ref_lon'], site['ref_lat']])

    cur.execute(query, params)
    return cur.fetchone()


def update_site(cur, site_number, site_data):
    cur.execute("""
        UPDATE sites SET
            name = %s,
            ownership = %s,
            access_control = %s,
            access_description = %s,
            natural_barrier = %s,
            maintenance = %s,
            maintenance_frequency = %s,
            prox_housing = %s,
            hidden_gem = %s,
            dangerous = %s,
            noisy = %s,
            too_small = %s,
            notes = %s,
            status = 'validated',
            manual_override = TRUE,
            reviewed_at = now(),
            updated_at = now()
        WHERE site_number = %s
    """, (
        site_data['parsed_name'],
        site_data['ownership'],
        site_data['access_control'],
        site_data['access_description'],
        site_data['natural_barrier'],
        site_data['maintenance'],
        site_data['maintenance_frequency'],
        site_data['prox_housing'],
        site_data['hidden_gem'],
        site_data['dangerous'],
        site_data['noisy'],
        site_data['too_small'],
        site_data['notes'],
        site_number,
    ))


def main():
    print('Parsing Excel...')
    sites = parse_excel()
    print(f'  Found {len(sites)} assessed sites\n')

    conn = psycopg2.connect(DATABASE_URL)
    try:
        cur = conn.cursor()

        claimed = []
        matches = []
        for site in sites:
            match = find_best_match(cur, site, exclude_site_numbers=claimed)
            if match:
                site_number, igs_type, subtype, area, dist, lon, lat = match
                print(f'{site["col"]}: "{site["parsed_name"]}"')
                print(f'  Matched -> {site_number} ({igs_type}/{subtype}, {area:.0f}m2, {dist:.0f}m away)')
                print(f'  Ownership={site["ownership"]} Access={site["access_control"]} Maint={site["maintenance"]}')

                update_site(cur, site_number, site)
                claimed.append(site_number)
                matches.append((site['col'], site['parsed_name'], site_number, dist))
            else:
                print(f'{site["col"]}: "{site["parsed_name"]}" - NO MATCH FOUND')

        conn.commit()
        print(f'\n{"="*60}')
        print(f'Updated {len(matches)} sites to validated status')
        print(f'{"="*60}')

        cur.execute("""
            SELECT site_number, name, status, ownership, access_control, maintenance, area_m2
            FROM sites WHERE status = 'validated'
            ORDER BY site_number
        """)
        rows = cur.fetchall()
        print(f'\nValidated sites in DB ({len(rows)}):')
        for r in rows:
            area = f'{r[6]:.0f}m2' if r[6] else 'N/A'
            print(f'  {r[0]}: name="{r[1]}" own={r[3]} access={r[4]} maint={r[5]} area={area}')

        cur.close()
    finally:
        conn.close()


if __name__ == '__main__':
    main()
