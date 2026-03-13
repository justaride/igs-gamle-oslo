import { query } from '../db.js'

const REVIEW_QUEUE_LAYER_KEYS = [
  'steep_slopes',
  'edgeland_geo_edges',
  'residual_infra_buffers',
  'residual_road_surface_mask',
] as const

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

export async function getReviewQueue(limit = 200) {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(500, Math.floor(limit))) : 200

  const result = await query(
    `
      WITH layer_matrix AS (
        SELECT
          ST_UnaryUnion(ST_Collect(ST_SetSRID(ST_GeomFromGeoJSON((feature->'geometry')::text), 4326)))
            FILTER (WHERE cl.layer_key = 'steep_slopes') AS steep_geom,
          ST_UnaryUnion(ST_Collect(ST_SetSRID(ST_GeomFromGeoJSON((feature->'geometry')::text), 4326)))
            FILTER (WHERE cl.layer_key = 'edgeland_geo_edges') AS geo_geom,
          ST_UnaryUnion(ST_Collect(ST_SetSRID(ST_GeomFromGeoJSON((feature->'geometry')::text), 4326)))
            FILTER (WHERE cl.layer_key = 'residual_infra_buffers') AS residual_geom,
          ST_UnaryUnion(ST_Collect(ST_SetSRID(ST_GeomFromGeoJSON((feature->'geometry')::text), 4326)))
            FILTER (WHERE cl.layer_key = 'residual_road_surface_mask') AS road_geom
        FROM context_layers cl
        LEFT JOIN LATERAL jsonb_array_elements(COALESCE(cl.geojson->'features', '[]'::jsonb)) AS f(feature) ON true
        WHERE cl.layer_key = ANY($1::text[])
      ),
      site_signals AS (
        SELECT
          s.id,
          s.site_number,
          s.igs_type,
          s.subtype,
          s.status,
          s.area_m2,
          s.good_opportunity,
          s.hidden_gem,
          s.dangerous,
          s.noisy,
          s.too_small,
          CASE
            WHEN lm.steep_geom IS NOT NULL AND ST_Intersects(s.geom, lm.steep_geom)
              THEN ST_Area(ST_Transform(ST_Intersection(s.geom, lm.steep_geom), 25833))
            ELSE 0
          END AS steep_overlap_m2,
          CASE
            WHEN lm.geo_geom IS NOT NULL AND ST_Intersects(s.geom, lm.geo_geom)
              THEN ST_Area(ST_Transform(ST_Intersection(s.geom, lm.geo_geom), 25833))
            ELSE 0
          END AS geo_overlap_m2,
          CASE
            WHEN lm.residual_geom IS NOT NULL AND ST_Intersects(s.geom, lm.residual_geom)
              THEN ST_Area(ST_Transform(ST_Intersection(s.geom, lm.residual_geom), 25833))
            ELSE 0
          END AS residual_overlap_m2,
          CASE
            WHEN lm.road_geom IS NOT NULL AND ST_Intersects(s.geom, lm.road_geom)
              THEN ST_Area(ST_Transform(ST_Intersection(s.geom, lm.road_geom), 25833))
            ELSE 0
          END AS road_overlap_m2
        FROM sites s
        CROSS JOIN layer_matrix lm
      ),
      ranked AS (
        SELECT
          ss.*,
          (
            CASE WHEN ss.steep_overlap_m2 > 0 THEN 3 ELSE 0 END +
            CASE WHEN ss.geo_overlap_m2 > 0 THEN 3 ELSE 0 END +
            CASE WHEN ss.residual_overlap_m2 > 0 THEN 2 ELSE 0 END +
            CASE WHEN ss.road_overlap_m2 > 0 THEN 1 ELSE 0 END +
            CASE WHEN ss.dangerous THEN 2 ELSE 0 END +
            CASE WHEN ss.noisy THEN 1 ELSE 0 END +
            CASE WHEN ss.too_small THEN 1 ELSE 0 END
          ) AS score,
          (
            CASE WHEN ss.steep_overlap_m2 > 0 THEN 1 ELSE 0 END +
            CASE WHEN ss.geo_overlap_m2 > 0 THEN 1 ELSE 0 END +
            CASE WHEN ss.residual_overlap_m2 > 0 THEN 1 ELSE 0 END +
            CASE WHEN ss.road_overlap_m2 > 0 THEN 1 ELSE 0 END +
            CASE WHEN ss.dangerous THEN 1 ELSE 0 END +
            CASE WHEN ss.noisy THEN 1 ELSE 0 END +
            CASE WHEN ss.too_small THEN 1 ELSE 0 END
          ) AS signal_count,
          GREATEST(
            COALESCE(ss.steep_overlap_m2 / NULLIF(ss.area_m2, 0), 0),
            COALESCE(ss.geo_overlap_m2 / NULLIF(ss.area_m2, 0), 0),
            COALESCE(ss.residual_overlap_m2 / NULLIF(ss.area_m2, 0), 0),
            COALESCE(ss.road_overlap_m2 / NULLIF(ss.area_m2, 0), 0)
          ) AS max_overlap_ratio
        FROM site_signals ss
      )
      SELECT
        id,
        site_number AS "siteNumber",
        igs_type AS "igsType",
        subtype,
        status,
        area_m2 AS "areaM2",
        good_opportunity AS "goodOpportunity",
        hidden_gem AS "hiddenGem",
        dangerous,
        noisy,
        too_small AS "tooSmall",
        score,
        signal_count AS "signalCount",
        ROUND(max_overlap_ratio::numeric, 4)::float8 AS "maxOverlapRatio",
        json_build_object(
          'steepSlopesM2', ROUND(steep_overlap_m2::numeric, 1)::float8,
          'geoEdgesM2', ROUND(geo_overlap_m2::numeric, 1)::float8,
          'residualBuffersM2', ROUND(residual_overlap_m2::numeric, 1)::float8,
          'roadMaskM2', ROUND(road_overlap_m2::numeric, 1)::float8
        ) AS overlaps,
        ARRAY_REMOVE(ARRAY[
          CASE WHEN steep_overlap_m2 > 0 THEN 'Bratt terreng' END,
          CASE WHEN geo_overlap_m2 > 0 THEN 'Geo-edgeland' END,
          CASE WHEN residual_overlap_m2 > 0 THEN 'Residual infrastruktur' END,
          CASE WHEN road_overlap_m2 > 0 THEN 'Veibane' END,
          CASE WHEN dangerous THEN 'Farlig' END,
          CASE WHEN noisy THEN 'Støy' END,
          CASE WHEN too_small THEN 'For lite' END
        ], NULL) AS reasons
      FROM ranked
      WHERE score > 0
      ORDER BY score DESC, signal_count DESC, max_overlap_ratio DESC, area_m2 DESC NULLS LAST, site_number ASC
      LIMIT $2
    `,
    [[...REVIEW_QUEUE_LAYER_KEYS], safeLimit]
  )

  return result.rows
}
