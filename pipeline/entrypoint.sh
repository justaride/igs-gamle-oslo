#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Missing required environment variable: DATABASE_URL" >&2
  exit 1
fi

RUNNING_MARKER=/tmp/pipeline.running
SUCCESS_MARKER=/tmp/pipeline.last-success

cleanup() {
  rm -f "$RUNNING_MARKER"
}

trap cleanup EXIT

PIPELINE_AUTO_RUN="${PIPELINE_AUTO_RUN:-true}"
PIPELINE_KEEP_ALIVE="${PIPELINE_KEEP_ALIVE:-true}"
PIPELINE_ARGS="${PIPELINE_ARGS:---skip-elevation --skip-species}"
ELEVATION_CACHE_DIR="${ELEVATION_CACHE_DIR:-/tmp/igs-elevation-cache}"
SPECIES_CACHE_DIR="${SPECIES_CACHE_DIR:-/tmp/igs-species-cache}"
MPLCONFIGDIR="${MPLCONFIGDIR:-/tmp/matplotlib}"

export ELEVATION_CACHE_DIR
export SPECIES_CACHE_DIR
export MPLCONFIGDIR

mkdir -p "$ELEVATION_CACHE_DIR" "$SPECIES_CACHE_DIR" "$MPLCONFIGDIR"

if [ "$PIPELINE_AUTO_RUN" = "true" ]; then
  rm -f "$SUCCESS_MARKER"
  date -u +"%Y-%m-%dT%H:%M:%SZ" > "$RUNNING_MARKER"
  echo "Running pipeline with args: $PIPELINE_ARGS"
  # shellcheck disable=SC2086
  python run_pipeline.py $PIPELINE_ARGS
  date -u +"%Y-%m-%dT%H:%M:%SZ" > "$SUCCESS_MARKER"
else
  echo "PIPELINE_AUTO_RUN=false; skipping automatic pipeline run"
fi

if [ "$PIPELINE_KEEP_ALIVE" = "true" ]; then
  echo "Pipeline container is now idle"
  exec tail -f /dev/null
fi
