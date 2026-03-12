import { query } from '../db.js'

const GEOJSON_SELECT = `
  json_build_object(
    'type', 'Feature',
    'id', s.id,
    'geometry', ST_AsGeoJSON(s.geom)::json,
    'properties', json_build_object(
      'id', s.id,
      'site_number', s.site_number,
      'igs_type', s.igs_type,
      'subtype', s.subtype,
      'status', s.status,
      'name', s.name,
      'ownership', s.ownership,
      'access_control', s.access_control,
      'access_description', s.access_description,
      'natural_barrier', s.natural_barrier,
      'maintenance', s.maintenance,
      'maintenance_frequency', s.maintenance_frequency,
      'prox_housing', s.prox_housing,
      'hidden_gem', s.hidden_gem,
      'dangerous', s.dangerous,
      'noisy', s.noisy,
      'too_small', s.too_small,
      'notes', s.notes,
      'area_m2', s.area_m2,
      'good_opportunity', s.good_opportunity
    )
  )
`

export async function getAllSites() {
  const result = await query(`
    SELECT json_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(json_agg(${GEOJSON_SELECT}), '[]'::json)
    ) AS geojson
    FROM sites s
  `)
  return result.rows[0].geojson
}

export async function getSiteById(id: number) {
  const result = await query(`
    SELECT ${GEOJSON_SELECT} AS feature
    FROM sites s WHERE s.id = $1
  `, [id])
  return result.rows[0]?.feature ?? null
}

export async function updateSite(id: number, fields: Record<string, unknown>) {
  const allowed = [
    'name', 'ownership', 'access_control', 'access_description',
    'natural_barrier', 'maintenance', 'maintenance_frequency',
    'prox_housing', 'hidden_gem', 'dangerous', 'noisy', 'too_small',
    'notes', 'igs_type', 'subtype',
  ]
  const updates: string[] = []
  const values: unknown[] = []
  let idx = 1

  for (const key of allowed) {
    if (key in fields) {
      updates.push(`${key} = $${idx}`)
      values.push(fields[key])
      idx++
    }
  }

  if (updates.length === 0) return null

  updates.push(`updated_at = NOW()`)
  values.push(id)

  const result = await query(
    `UPDATE sites SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id`,
    values
  )
  return result.rows[0]
}

export async function updateSiteGeometry(id: number, geojson: object) {
  const result = await query(
    `UPDATE sites SET geom = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)),
     area_m2 = ST_Area(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326), 25833)),
     updated_at = NOW()
     WHERE id = $2 RETURNING id`,
    [JSON.stringify(geojson), id]
  )
  return result.rows[0]
}

export async function updateSiteStatus(id: number, status: string) {
  const result = await query(
    `UPDATE sites SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id`,
    [status, id]
  )
  return result.rows[0]
}
