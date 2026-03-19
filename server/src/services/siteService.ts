import pool, { query } from '../db.js'

const REVIEW_QUEUE_LAYER_KEYS = [
  'steep_slopes',
  'edgeland_geo_edges',
  'residual_infra_buffers',
] as const

const EFFECTIVE_GEOM_SQL = 'COALESCE(s.manual_geometry, s.geom)'
const EFFECTIVE_IGS_TYPE_SQL = 'COALESCE(s.manual_igs_type, s.igs_type)'
const EFFECTIVE_SUBTYPE_SQL = 'COALESCE(s.manual_subtype, s.subtype)'
const EFFECTIVE_STATUS_SQL = 'COALESCE(s.manual_status, s.status)'
const EFFECTIVE_NAME_SQL = 'COALESCE(s.manual_name, s.name)'
const EFFECTIVE_NOTES_SQL = 'COALESCE(s.editor_notes, s.notes)'
const ACTIVE_SITE_SQL = `
  (
    s.source_present = TRUE
    OR s.manual_override = TRUE
    OR COALESCE(s.manual_status, s.status) <> 'candidate'
  )
`
const EFFECTIVE_AREA_SQL = `
  CASE
    WHEN s.manual_geometry IS NOT NULL
      THEN ST_Area(ST_Transform(s.manual_geometry, 25833))
    ELSE s.area_m2
  END
`

const GEOJSON_SELECT = `
  json_build_object(
    'type', 'Feature',
    'id', s.id,
    'geometry', ST_AsGeoJSON(${EFFECTIVE_GEOM_SQL})::json,
    'properties', json_build_object(
      'id', s.id,
      'site_number', s.site_number,
      'igs_type', ${EFFECTIVE_IGS_TYPE_SQL},
      'subtype', ${EFFECTIVE_SUBTYPE_SQL},
      'status', ${EFFECTIVE_STATUS_SQL},
      'name', ${EFFECTIVE_NAME_SQL},
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
      'notes', ${EFFECTIVE_NOTES_SQL},
      'area_m2', ${EFFECTIVE_AREA_SQL},
      'good_opportunity', s.good_opportunity,
      'manual_override', s.manual_override,
      'auto_igs_type', s.igs_type,
      'auto_subtype', s.subtype,
      'auto_status', s.status,
      'auto_name', s.name,
      'manual_igs_type', s.manual_igs_type,
      'manual_subtype', s.manual_subtype,
      'manual_status', s.manual_status,
      'manual_name', s.manual_name,
      'buried_river', s.buried_river,
      'community_activity_potential', s.community_activity_potential,
      'biodiversity_potential', s.biodiversity_potential,
      'editor_notes', s.editor_notes,
      'reviewed_by', s.reviewed_by,
      'reviewed_at', s.reviewed_at,
      'source_present', s.source_present
    )
  )
`

const REVIEW_QUEUE_COMPUTE_SQL = `
  WITH layer_matrix AS (
    SELECT
      ST_UnaryUnion(
        ST_Collect(ST_SetSRID(ST_GeomFromGeoJSON((feature->'geometry')::text), 4326))
          FILTER (WHERE cl.layer_key = 'steep_slopes')
      ) AS steep_geom,
      ST_UnaryUnion(
        ST_Collect(ST_SetSRID(ST_GeomFromGeoJSON((feature->'geometry')::text), 4326))
          FILTER (WHERE cl.layer_key = 'edgeland_geo_edges')
      ) AS geo_geom,
      ST_UnaryUnion(
        ST_Collect(ST_SetSRID(ST_GeomFromGeoJSON((feature->'geometry')::text), 4326))
          FILTER (WHERE cl.layer_key = 'residual_infra_buffers')
      ) AS residual_geom
    FROM context_layers cl
    LEFT JOIN LATERAL jsonb_array_elements(COALESCE(cl.geojson->'features', '[]'::jsonb)) AS f(feature) ON true
    WHERE cl.layer_key = ANY($1::text[])
  ),
  site_signals AS (
    SELECT
      s.id AS site_id,
      s.site_number,
      COALESCE(s.manual_igs_type, s.igs_type) AS igs_type,
      COALESCE(s.manual_subtype, s.subtype) AS subtype,
      COALESCE(s.manual_status, s.status) AS status,
      CASE
        WHEN s.manual_geometry IS NOT NULL
          THEN ST_Area(ST_Transform(s.manual_geometry, 25833))
        ELSE s.area_m2
      END AS area_m2,
      s.good_opportunity,
      s.hidden_gem,
      s.dangerous,
      s.noisy,
      s.too_small,
      CASE
        WHEN lm.steep_geom IS NOT NULL AND ST_Intersects(COALESCE(s.manual_geometry, s.geom), lm.steep_geom)
          THEN ST_Area(ST_Transform(ST_Intersection(COALESCE(s.manual_geometry, s.geom), lm.steep_geom), 25833))
        ELSE 0
      END AS steep_overlap_m2,
      CASE
        WHEN lm.geo_geom IS NOT NULL AND ST_Intersects(COALESCE(s.manual_geometry, s.geom), lm.geo_geom)
          THEN ST_Area(ST_Transform(ST_Intersection(COALESCE(s.manual_geometry, s.geom), lm.geo_geom), 25833))
        ELSE 0
      END AS geo_overlap_m2,
      CASE
        WHEN lm.residual_geom IS NOT NULL AND ST_Intersects(COALESCE(s.manual_geometry, s.geom), lm.residual_geom)
          THEN ST_Area(ST_Transform(ST_Intersection(COALESCE(s.manual_geometry, s.geom), lm.residual_geom), 25833))
        ELSE 0
      END AS residual_overlap_m2,
      0::float8 AS road_overlap_m2
    FROM sites s
    CROSS JOIN layer_matrix lm
    WHERE (${ACTIVE_SITE_SQL})
      AND ($2::int[] IS NULL OR s.id = ANY($2::int[]))
  ),
  ranked AS (
    SELECT
      ss.*,
      (
        CASE WHEN ss.steep_overlap_m2 > 0 THEN 3 ELSE 0 END +
        CASE WHEN ss.geo_overlap_m2 > 0 THEN 3 ELSE 0 END +
        CASE WHEN ss.residual_overlap_m2 > 0 THEN 2 ELSE 0 END +
        CASE WHEN ss.dangerous THEN 2 ELSE 0 END +
        CASE WHEN ss.noisy THEN 1 ELSE 0 END +
        CASE WHEN ss.too_small THEN 1 ELSE 0 END
      ) AS score,
      (
        CASE WHEN ss.steep_overlap_m2 > 0 THEN 1 ELSE 0 END +
        CASE WHEN ss.geo_overlap_m2 > 0 THEN 1 ELSE 0 END +
        CASE WHEN ss.residual_overlap_m2 > 0 THEN 1 ELSE 0 END +
        CASE WHEN ss.dangerous THEN 1 ELSE 0 END +
        CASE WHEN ss.noisy THEN 1 ELSE 0 END +
        CASE WHEN ss.too_small THEN 1 ELSE 0 END
      ) AS signal_count,
      GREATEST(
        COALESCE(ss.steep_overlap_m2 / NULLIF(ss.area_m2, 0), 0),
        COALESCE(ss.geo_overlap_m2 / NULLIF(ss.area_m2, 0), 0),
        COALESCE(ss.residual_overlap_m2 / NULLIF(ss.area_m2, 0), 0)
      ) AS max_overlap_ratio
    FROM site_signals ss
  )
  SELECT
    site_id AS "siteId",
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
      CASE WHEN dangerous THEN 'Farlig' END,
      CASE WHEN noisy THEN 'Støy' END,
      CASE WHEN too_small THEN 'For lite' END
    ], NULL) AS reasons
  FROM ranked
  WHERE score > 0
  ORDER BY score DESC, signal_count DESC, max_overlap_ratio DESC, area_m2 DESC NULLS LAST, site_number ASC
`

async function computeReviewQueueRows(siteIds?: number[]) {
  const result = await query(REVIEW_QUEUE_COMPUTE_SQL, [
    [...REVIEW_QUEUE_LAYER_KEYS],
    siteIds && siteIds.length > 0 ? siteIds : null,
  ])

  return result.rows
}

export async function refreshReviewQueueCache(siteIds?: number[]) {
  const rows = await computeReviewQueueRows(siteIds)
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    if (siteIds && siteIds.length > 0) {
      await client.query('DELETE FROM review_queue_cache WHERE site_id = ANY($1::int[])', [siteIds])
    } else {
      await client.query('TRUNCATE review_queue_cache')
    }

    for (const row of rows) {
      await client.query(
        `
          INSERT INTO review_queue_cache (
            site_id,
            site_number,
            igs_type,
            subtype,
            status,
            area_m2,
            good_opportunity,
            hidden_gem,
            dangerous,
            noisy,
            too_small,
            score,
            signal_count,
            max_overlap_ratio,
            overlap_summary,
            reasons,
            updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16::text[], NOW()
          )
        `,
        [
          row.siteId,
          row.siteNumber,
          row.igsType,
          row.subtype,
          row.status,
          row.areaM2,
          row.goodOpportunity,
          row.hiddenGem,
          row.dangerous,
          row.noisy,
          row.tooSmall,
          row.score,
          row.signalCount,
          row.maxOverlapRatio,
          JSON.stringify(row.overlaps),
          row.reasons,
        ]
      )
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function refreshReviewQueueCacheForSite(id: number) {
  try {
    await refreshReviewQueueCache([id])
  } catch (error) {
    console.error('Failed to refresh review queue cache for site', id, error)
  }
}

export async function getAllSites() {
  const result = await query(`
    SELECT json_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(json_agg(${GEOJSON_SELECT} ORDER BY s.site_number), '[]'::json)
    ) AS geojson
    FROM sites s
    WHERE ${ACTIVE_SITE_SQL}
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
  const columnMap: Record<string, string> = {
    name: 'manual_name',
    ownership: 'ownership',
    access_control: 'access_control',
    access_description: 'access_description',
    natural_barrier: 'natural_barrier',
    maintenance: 'maintenance',
    maintenance_frequency: 'maintenance_frequency',
    prox_housing: 'prox_housing',
    hidden_gem: 'hidden_gem',
    dangerous: 'dangerous',
    noisy: 'noisy',
    too_small: 'too_small',
    notes: 'editor_notes',
    igs_type: 'manual_igs_type',
    subtype: 'manual_subtype',
    buried_river: 'buried_river',
    community_activity_potential: 'community_activity_potential',
    biodiversity_potential: 'biodiversity_potential',
    editor_notes: 'editor_notes',
    reviewed_by: 'reviewed_by',
    reviewed_at: 'reviewed_at',
  }
  const updates: string[] = []
  const values: unknown[] = []
  let idx = 1

  for (const [key, column] of Object.entries(columnMap)) {
    if (key in fields) {
      updates.push(`${column} = $${idx}`)
      values.push(fields[key])
      idx++
    }
  }

  if (updates.length === 0) return null

  updates.push('manual_override = TRUE')

  updates.push(`updated_at = NOW()`)
  values.push(id)

  const result = await query(
    `UPDATE sites SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id`,
    values
  )

  if (result.rows[0]) {
    await refreshReviewQueueCacheForSite(id)
  }

  return result.rows[0]
}

export async function updateSiteGeometry(id: number, geojson: object) {
  const result = await query(
    `UPDATE sites SET manual_geometry = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)),
     manual_override = TRUE,
     updated_at = NOW()
     WHERE id = $2 RETURNING id`,
    [JSON.stringify(geojson), id]
  )

  if (result.rows[0]) {
    await refreshReviewQueueCacheForSite(id)
  }

  return result.rows[0]
}

export async function updateSiteStatus(id: number, status: string) {
  const result = await query(
    `UPDATE sites
     SET manual_status = $1,
         manual_override = TRUE,
         reviewed_at = CASE
           WHEN $1 = 'candidate' THEN reviewed_at
           ELSE NOW()
         END,
         updated_at = NOW()
     WHERE id = $2 RETURNING id`,
    [status, id]
  )

  if (result.rows[0]) {
    await refreshReviewQueueCacheForSite(id)
  }

  return result.rows[0]
}

export async function resetSiteOverrides(id: number) {
  const result = await query(
    `UPDATE sites
     SET manual_geometry = NULL,
         manual_igs_type = NULL,
         manual_subtype = NULL,
         manual_name = NULL,
         manual_status = NULL,
         manual_override = FALSE,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [id]
  )

  if (result.rows[0]) {
    await refreshReviewQueueCacheForSite(id)
  }

  return result.rows[0]
}

export async function getReviewQueue(limit = 200) {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(500, Math.floor(limit))) : 200

  const result = await query(
    `
      SELECT
        site_id AS id,
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
        max_overlap_ratio AS "maxOverlapRatio",
        overlap_summary AS overlaps,
        reasons
      FROM review_queue_cache
      ORDER BY score DESC, signal_count DESC, max_overlap_ratio DESC, area_m2 DESC NULLS LAST, site_number ASC
      LIMIT $1
    `,
    [safeLimit]
  )

  return result.rows
}
