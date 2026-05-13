#!/usr/bin/env node
/**
 * Light load test for the IGS API.
 *
 * Usage:
 *   node scripts/load-test.mjs                          # defaults: 50 concurrent, 500 total, http://localhost:3001
 *   API_BASE=http://staging.example.com \
 *     CONCURRENCY=20 TOTAL=200 \
 *     node scripts/load-test.mjs
 *
 * What it does:
 *   - Issues TOTAL GET /api/sites requests against API_BASE, CONCURRENCY at a time.
 *   - Reports p50/p95/p99 latency, error counts, and whether the rate limit kicked in.
 *
 * What it tests:
 *   - Steady-state read latency under realistic concurrency.
 *   - Rate-limit behavior (200 req per 15min window).
 *   - No crashes / unhandled exceptions on the server.
 *
 * Not a substitute for a real benchmark — uses Node native fetch, no warmup, single endpoint.
 */

const API_BASE = process.env.API_BASE ?? 'http://localhost:3001'
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 50)
const TOTAL = Number(process.env.TOTAL ?? 500)
const ENDPOINT = process.env.ENDPOINT ?? '/api/sites'

const latencies = []
const statusCounts = new Map()
let rateLimited = 0
let networkErrors = 0

function record(status, ms) {
  statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1)
  if (status === 429) rateLimited += 1
  if (ms != null) latencies.push(ms)
}

async function doRequest() {
  const start = performance.now()
  try {
    const res = await fetch(`${API_BASE}${ENDPOINT}`)
    const ms = performance.now() - start
    await res.text()
    record(res.status, ms)
  } catch (error) {
    networkErrors += 1
    record('network_error', performance.now() - start)
  }
}

async function worker(remainingRef) {
  while (remainingRef.value > 0) {
    remainingRef.value -= 1
    await doRequest()
  }
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx]
}

async function main() {
  console.log(`Load test: ${ENDPOINT} @ ${API_BASE}`)
  console.log(`Total: ${TOTAL} requests, concurrency: ${CONCURRENCY}`)

  const startedAt = performance.now()
  const remaining = { value: TOTAL }
  const workers = Array.from({ length: CONCURRENCY }, () => worker(remaining))
  await Promise.all(workers)
  const elapsedMs = performance.now() - startedAt

  const sorted = [...latencies].sort((a, b) => a - b)
  const summary = {
    elapsed_s: (elapsedMs / 1000).toFixed(2),
    requests_per_second: (TOTAL / (elapsedMs / 1000)).toFixed(1),
    p50_ms: percentile(sorted, 50)?.toFixed(1),
    p95_ms: percentile(sorted, 95)?.toFixed(1),
    p99_ms: percentile(sorted, 99)?.toFixed(1),
    max_ms: sorted[sorted.length - 1]?.toFixed(1),
    status_counts: Object.fromEntries(statusCounts),
    rate_limited: rateLimited,
    network_errors: networkErrors,
  }

  console.log('\nResults:')
  console.log(JSON.stringify(summary, null, 2))

  if (rateLimited > 0) {
    console.log(`\nRate limit triggered ${rateLimited} times. Expected behavior if TOTAL > 200 / 15min.`)
  }
  if (networkErrors > 0) {
    console.log(`\nWarning: ${networkErrors} network errors — server may have stalled.`)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('Load test failed:', error)
  process.exit(1)
})
