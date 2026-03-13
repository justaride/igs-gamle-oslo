#!/usr/bin/env python3
"""
IGS Gamle Oslo — context layer refresh
Fetches reference data, optionally terrain QA, and seeds only context_layers.
"""
import argparse
import sys
from pathlib import Path

sys.stdout.reconfigure(line_buffering=True)


def write_layer_exports(context_layers, output_dir: str):
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    for layer_key, spec in context_layers.items():
        gdf = spec.get('gdf')
        if gdf is None or len(gdf) == 0:
            continue

        target = output_path / f'{layer_key}.geojson'
        gdf.to_crs('EPSG:4326').to_file(target, driver='GeoJSON')


def print_layer_summary(context_layers):
    print('Layer summary:')
    for layer_key, spec in context_layers.items():
        print(f'  {layer_key}: {len(spec.get("gdf", []))} features')
    print()


def main():
    parser = argparse.ArgumentParser(description='Refresh context layers without rewriting sites')
    parser.add_argument('--skip-elevation', action='store_true',
                        help='Skip terrain QA layers')
    parser.add_argument('--dry-run', action='store_true',
                        help='Build layers but do not seed database')
    parser.add_argument('--output-dir', type=str, default=None,
                        help='Optional directory for GeoJSON layer exports')
    args = parser.parse_args()

    print('=== IGS Context Layer Refresh ===\n')

    print('Step 1: Fetching OSM data...')
    from fetch_osm import fetch_all
    data = fetch_all()
    print()

    steep_slopes = None
    if not args.skip_elevation:
        print('Step 2: Fetching elevation data...')
        from fetch_elevation import fetch_steep_slopes
        try:
            steep_slopes = fetch_steep_slopes()
        except Exception as exc:
            print(f'  Elevation fetch failed: {exc}')
            print('  Continuing without terrain QA layers...')
        print()
    else:
        print('Step 2: Skipping elevation (--skip-elevation)\n')

    print('Step 3: Building context layers...')
    from build_context_layers import build_context_layers
    context_layers = build_context_layers(data, steep_slopes)
    print(f'Built {len(context_layers)} context layers\n')
    print_layer_summary(context_layers)

    if args.output_dir:
        print('Step 4: Exporting GeoJSON layers...')
        write_layer_exports(context_layers, args.output_dir)
        print(f'Saved context layers to {args.output_dir}\n')

    if args.dry_run:
        print('Dry run — skipping database seed')
        return

    print('Step 5: Seeding context_layers...')
    from seed_db import seed_context_layers
    seed_context_layers(context_layers)
    print('\n=== Context layer refresh complete ===')


if __name__ == '__main__':
    main()
