#!/usr/bin/env node
/**
 * Pure-function smoke test for validation.ts — runs all the same edge cases as
 * scripts/validate-edge-cases.mjs but without needing a running server.
 * Verifies the parser layer would have rejected each bad payload with 400.
 */

import {
  parseGeometryPatchBody,
  parseIdParam,
  parseReviewQueueLimit,
  parseSiteCreateBody,
  parseSiteStatusBody,
} from '../dist/validation.js'

const results = []
function check(name, fn) {
  try { fn(); results.push({ name, status: 'PASS' }) }
  catch (e) { results.push({ name, status: 'FAIL', detail: e.message }) }
}

function expect400(fn) {
  try { fn() }
  catch (e) {
    if (e?.statusCode === 400) return
    throw new Error(`expected HttpError(400), got: ${e?.statusCode ?? '?'} ${e?.message ?? e}`)
  }
  throw new Error('expected throw, got normal return')
}

function expectOk(fn) {
  try { fn() }
  catch (e) { throw new Error(`expected no throw, got: ${e?.message ?? e}`) }
}

const VALID_POLYGON = {
  type: 'Polygon',
  coordinates: [[[10, 60], [10.1, 60], [10.1, 60.1], [10, 60.1], [10, 60]]],
}

// --- parseIdParam ---
check('parseIdParam: positive int OK', () => expectOk(() => parseIdParam('42')))
check('parseIdParam: zero rejected', () => expect400(() => parseIdParam('0')))
check('parseIdParam: negative rejected', () => expect400(() => parseIdParam('-1')))
check('parseIdParam: float rejected', () => expect400(() => parseIdParam('1.5')))
check('parseIdParam: text rejected', () => expect400(() => parseIdParam('abc')))
check('parseIdParam: non-string rejected', () => expect400(() => parseIdParam(null)))

// --- parseReviewQueueLimit ---
check('parseReviewQueueLimit: undefined OK', () => expectOk(() => parseReviewQueueLimit(undefined)))
check('parseReviewQueueLimit: "100" OK', () => expectOk(() => parseReviewQueueLimit('100')))
check('parseReviewQueueLimit: 0 rejected', () => expect400(() => parseReviewQueueLimit('0')))
check('parseReviewQueueLimit: 501 rejected', () => expect400(() => parseReviewQueueLimit('501')))
check('parseReviewQueueLimit: NaN rejected', () => expect400(() => parseReviewQueueLimit('abc')))

// --- parseSiteStatusBody ---
check('parseSiteStatusBody: valid status OK', () => expectOk(() => parseSiteStatusBody({ status: 'validated' })))
check('parseSiteStatusBody: invalid status rejected', () => expect400(() => parseSiteStatusBody({ status: 'maybe' })))
check('parseSiteStatusBody: missing status rejected', () => expect400(() => parseSiteStatusBody({})))
check('parseSiteStatusBody: non-object rejected', () => expect400(() => parseSiteStatusBody(null)))
check('parseSiteStatusBody: array rejected', () => expect400(() => parseSiteStatusBody([])))

// --- parseGeometryPatchBody ---
check('parseGeometryPatchBody: valid polygon OK', () =>
  expectOk(() => parseGeometryPatchBody({ geometry: VALID_POLYGON })))

check('parseGeometryPatchBody: missing geometry rejected', () =>
  expect400(() => parseGeometryPatchBody({})))

check('parseGeometryPatchBody: wrong type rejected', () =>
  expect400(() => parseGeometryPatchBody({
    geometry: { type: 'Point', coordinates: [10, 60] },
  })))

check('parseGeometryPatchBody: unclosed ring rejected', () =>
  expect400(() => parseGeometryPatchBody({
    geometry: { type: 'Polygon', coordinates: [[[10, 60], [10.1, 60], [10.1, 60.1], [10, 60.1]]] },
  })))

check('parseGeometryPatchBody: <4 positions rejected', () =>
  expect400(() => parseGeometryPatchBody({
    geometry: { type: 'Polygon', coordinates: [[[10, 60], [10.1, 60], [10, 60]]] },
  })))

check('parseGeometryPatchBody: lng > 180 rejected', () =>
  expect400(() => parseGeometryPatchBody({
    geometry: { type: 'Polygon', coordinates: [[[300, 60], [10, 60], [10, 61], [10, 60.1], [300, 60]]] },
  })))

check('parseGeometryPatchBody: lat NaN rejected', () =>
  expect400(() => parseGeometryPatchBody({
    geometry: { type: 'Polygon', coordinates: [[[10, null], [10.1, 60], [10.1, 60.1], [10, 60.1], [10, null]]] },
  })))

check('parseGeometryPatchBody: empty coords rejected', () =>
  expect400(() => parseGeometryPatchBody({
    geometry: { type: 'Polygon', coordinates: [] },
  })))

check('parseGeometryPatchBody: valid MultiPolygon OK', () =>
  expectOk(() => parseGeometryPatchBody({
    geometry: { type: 'MultiPolygon', coordinates: [VALID_POLYGON.coordinates] },
  })))

check('parseGeometryPatchBody: empty MultiPolygon rejected', () =>
  expect400(() => parseGeometryPatchBody({
    geometry: { type: 'MultiPolygon', coordinates: [] },
  })))

// --- parseSiteCreateBody ---
check('parseSiteCreateBody: valid OK', () =>
  expectOk(() => parseSiteCreateBody({
    geometry: VALID_POLYGON,
    igs_type: 'Residual',
  })))

check('parseSiteCreateBody: bad igs_type rejected', () =>
  expect400(() => parseSiteCreateBody({
    geometry: VALID_POLYGON,
    igs_type: 'BogusType',
  })))

check('parseSiteCreateBody: missing geometry rejected', () =>
  expect400(() => parseSiteCreateBody({ igs_type: 'Residual' })))

check('parseSiteCreateBody: bad ownership rejected', () =>
  expect400(() => parseSiteCreateBody({
    geometry: VALID_POLYGON,
    igs_type: 'Residual',
    ownership: 'invalid',
  })))

let pass = 0, fail = 0
for (const r of results) {
  console.log(`${r.status}  ${r.name}${r.detail ? ` — ${r.detail}` : ''}`)
  if (r.status === 'PASS') pass++; else fail++
}
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
