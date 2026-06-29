#!/usr/bin/env node
/**
 * Edge-case payload tester for the IGS write endpoints.
 *
 * Usage:
 *   API_BASE=http://localhost:3001 EDITOR_API_TOKEN=... node scripts/validate-edge-cases.mjs
 *
 * What it does:
 *   - POSTs deliberately invalid payloads against POST /api/sites and PATCH /api/sites/:id/geometry.
 *   - Expects each to return 400, never 500 and never silent acceptance.
 *   - Reports a per-case PASS/FAIL summary and exits non-zero if anything regressed.
 *
 * The goal is to catch regressions in server/src/validation.ts — make sure malformed
 * geometry, control characters in strings, out-of-range lat/lng etc. never reach PostGIS.
 */

const API_BASE = process.env.API_BASE ?? 'http://localhost:3001'
const TOKEN = process.env.EDITOR_API_TOKEN ?? ''

if (!TOKEN) {
  console.error('EDITOR_API_TOKEN env var required')
  process.exit(2)
}

const headers = {
  'Content-Type': 'application/json',
  'x-editor-token': TOKEN,
}

const cases = [
  {
    name: 'create: missing geometry',
    method: 'POST',
    path: '/api/sites',
    body: { igs_type: 'Residual' },
    expect: 400,
  },
  {
    name: 'create: non-object geometry',
    method: 'POST',
    path: '/api/sites',
    body: { geometry: 'not-an-object', igs_type: 'Residual' },
    expect: 400,
  },
  {
    name: 'create: wrong geometry type',
    method: 'POST',
    path: '/api/sites',
    body: {
      geometry: { type: 'Point', coordinates: [10, 60] },
      igs_type: 'Residual',
    },
    expect: 400,
  },
  {
    name: 'create: unclosed polygon ring',
    method: 'POST',
    path: '/api/sites',
    body: {
      geometry: {
        type: 'Polygon',
        coordinates: [[[10, 60], [10.1, 60], [10.1, 60.1], [10, 60.1]]],
      },
      igs_type: 'Residual',
    },
    expect: 400,
  },
  {
    name: 'create: too few positions (<4)',
    method: 'POST',
    path: '/api/sites',
    body: {
      geometry: {
        type: 'Polygon',
        coordinates: [[[10, 60], [10.1, 60], [10, 60]]],
      },
      igs_type: 'Residual',
    },
    expect: 400,
  },
  {
    name: 'create: longitude out of range',
    method: 'POST',
    path: '/api/sites',
    body: {
      geometry: {
        type: 'Polygon',
        coordinates: [[[300, 60], [10.1, 60], [10.1, 60.1], [10, 60.1], [300, 60]]],
      },
      igs_type: 'Residual',
    },
    expect: 400,
  },
  {
    name: 'create: latitude NaN',
    method: 'POST',
    path: '/api/sites',
    body: {
      geometry: {
        type: 'Polygon',
        coordinates: [[[10, null], [10.1, 60], [10.1, 60.1], [10, 60.1], [10, null]]],
      },
      igs_type: 'Residual',
    },
    expect: 400,
  },
  {
    name: 'create: empty coordinates array',
    method: 'POST',
    path: '/api/sites',
    body: {
      geometry: { type: 'Polygon', coordinates: [] },
      igs_type: 'Residual',
    },
    expect: 400,
  },
  {
    name: 'create: invalid igs_type',
    method: 'POST',
    path: '/api/sites',
    body: {
      geometry: {
        type: 'Polygon',
        coordinates: [[[10, 60], [10.1, 60], [10.1, 60.1], [10, 60.1], [10, 60]]],
      },
      igs_type: 'BogusType',
    },
    expect: 400,
  },
  {
    name: 'patch geometry: id=0 (non-positive)',
    method: 'PATCH',
    path: '/api/sites/0/geometry',
    body: {
      geometry: {
        type: 'Polygon',
        coordinates: [[[10, 60], [10.1, 60], [10.1, 60.1], [10, 60.1], [10, 60]]],
      },
    },
    expect: 400,
  },
  {
    name: 'patch geometry: id=abc (non-integer)',
    method: 'PATCH',
    path: '/api/sites/abc/geometry',
    body: {
      geometry: {
        type: 'Polygon',
        coordinates: [[[10, 60], [10.1, 60], [10.1, 60.1], [10, 60.1], [10, 60]]],
      },
    },
    expect: 400,
  },
  {
    name: 'review queue: limit out of bounds',
    method: 'GET',
    path: '/api/sites/review-queue?limit=99999',
    body: null,
    expect: 400,
  },
  {
    name: 'bulk-status: empty array',
    method: 'POST',
    path: '/api/sites/bulk-status',
    body: { siteIds: [], status: 'validated' },
    expect: 400,
  },
  {
    name: 'bulk-status: too many ids (>100)',
    method: 'POST',
    path: '/api/sites/bulk-status',
    body: { siteIds: Array.from({ length: 101 }, (_, i) => i + 1), status: 'validated' },
    expect: 400,
  },
  {
    name: 'status: invalid status string',
    method: 'PATCH',
    path: '/api/sites/1/status',
    body: { status: 'maybe' },
    expect: 400,
  },
  {
    name: 'species: missing scientific name',
    method: 'POST',
    path: '/api/species',
    body: { site_id: 1, scientific_name: '', observation_count: 1, latitude: 59.91, longitude: 10.78 },
    expect: 400,
  },
  {
    name: 'species: invalid latitude',
    method: 'POST',
    path: '/api/species',
    body: { site_id: 1, scientific_name: 'Taraxacum officinale', observation_count: 1, latitude: 120, longitude: 10.78 },
    expect: 400,
  },
  {
    name: 'species: invalid longitude',
    method: 'POST',
    path: '/api/species',
    body: { site_id: 1, scientific_name: 'Taraxacum officinale', observation_count: 1, latitude: 59.91, longitude: 220 },
    expect: 400,
  },
]

async function runCase(c) {
  const init = {
    method: c.method,
    headers,
  }
  if (c.body !== null) {
    init.body = JSON.stringify(c.body)
  }

  let status
  let errorMessage
  try {
    const res = await fetch(`${API_BASE}${c.path}`, init)
    status = res.status
    const json = await res.json().catch(() => ({}))
    errorMessage = json.error
  } catch (error) {
    return { ...c, ok: false, actual: 'network_error', detail: String(error) }
  }

  const ok = status === c.expect
  return { ...c, ok, actual: status, detail: errorMessage }
}

async function main() {
  console.log(`Validation edge-case suite against ${API_BASE}`)
  console.log(`${cases.length} cases\n`)

  let passed = 0
  for (const c of cases) {
    const result = await runCase(c)
    const tag = result.ok ? 'PASS' : 'FAIL'
    console.log(`${tag}  [${result.actual}] ${result.name}${result.detail ? ` — ${result.detail}` : ''}`)
    if (result.ok) passed += 1
  }

  console.log(`\n${passed} / ${cases.length} passed`)
  process.exit(passed === cases.length ? 0 : 1)
}

main().catch((error) => {
  console.error('Suite crashed:', error)
  process.exit(2)
})
