import pool, { query } from '../db.js'
import { buildSiteSql } from './siteSql.js'

const REVIEW_QUEUE_LAYER_KEYS = [
  'steep_slopes',
  'edgeland_geo_edges',
  'residual_infra_buffers',
] as const
const REVIEW_QUEUE_CACHE_KEY = 'default'

type SqlExecutor = {
  query: (text: string, params?: unknown[]) => Promise<unknown>
}

type ReviewQueueMeta = {
  isStale: boolean
  staleReason: string | null
  staleSince: string | null
  lastRefreshStartedAt: string | null
  lastRefreshedAt: string | null
  lastErrorAt: string | null
}

const siteSql = buildSiteSql('s')
const {
  activeSite: ACTIVE_SITE_SQL,
  effectiveAccessControl: EFFECTIVE_ACCESS_CONTROL_SQL,
  effectiveAccessDescription: EFFECTIVE_ACCESS_DESCRIPTION_SQL,
  effectiveArea: EFFECTIVE_AREA_SQL,
  effectiveBiodiversityPotential: EFFECTIVE_BIODIVERSITY_POTENTIAL_SQL,
  effectiveBuriedRiver: EFFECTIVE_BURIED_RIVER_SQL,
  effectiveCommunityActivityPotential: EFFECTIVE_COMMUNITY_ACTIVITY_POTENTIAL_SQL,
  effectiveDangerous: EFFECTIVE_DANGEROUS_SQL,
  effectiveGeom: EFFECTIVE_GEOM_SQL,
  effectiveGoodOpportunity: EFFECTIVE_GOOD_OPPORTUNITY_SQL,
  effectiveHiddenGem: EFFECTIVE_HIDDEN_GEM_SQL,
  effectiveIgsType: EFFECTIVE_IGS_TYPE_SQL,
  effectiveMaintenance: EFFECTIVE_MAINTENANCE_SQL,
  effectiveMaintenanceFrequency: EFFECTIVE_MAINTENANCE_FREQUENCY_SQL,
  effectiveName: EFFECTIVE_NAME_SQL,
  effectiveNaturalBarrier: EFFECTIVE_NATURAL_BARRIER_SQL,
  effectiveNoisy: EFFECTIVE_NOISY_SQL,
  effectiveNotes: EFFECTIVE_NOTES_SQL,
  effectiveOwnership: EFFECTIVE_OWNERSHIP_SQL,
  effectiveProxHousing: EFFECTIVE_PROX_HOUSING_SQL,
  effectiveStatus: EFFECTIVE_STATUS_SQL,
  effectiveSubtype: EFFECTIVE_SUBTYPE_SQL,
  effectiveTooSmall: EFFECTIVE_TOO_SMALL_SQL,
} = siteSql

const GEOJSON_PROPERTIES_SQL = `
  (
    jsonb_build_object(
      'id', s.id,
      'site_number', s.site_number,
      'igs_type', ${EFFECTIVE_IGS_TYPE_SQL},
      'subtype', ${EFFECTIVE_SUBTYPE_SQL},
      'status', ${EFFECTIVE_STATUS_SQL},
      'name', ${EFFECTIVE_NAME_SQL},
      'ownership', ${EFFECTIVE_OWNERSHIP_SQL},
      'access_control', ${EFFECTIVE_ACCESS_CONTROL_SQL},
      'access_description', ${EFFECTIVE_ACCESS_DESCRIPTION_SQL},
      'natural_barrier', ${EFFECTIVE_NATURAL_BARRIER_SQL},
      'maintenance', ${EFFECTIVE_MAINTENANCE_SQL},
      'maintenance_frequency', ${EFFECTIVE_MAINTENANCE_FREQUENCY_SQL},
      'prox_housing', ${EFFECTIVE_PROX_HOUSING_SQL},
      'hidden_gem', ${EFFECTIVE_HIDDEN_GEM_SQL},
      'dangerous', ${EFFECTIVE_DANGEROUS_SQL},
      'noisy', ${EFFECTIVE_NOISY_SQL},
      'too_small', ${EFFECTIVE_TOO_SMALL_SQL},
      'notes', ${EFFECTIVE_NOTES_SQL},
      'area_m2', ${EFFECTIVE_AREA_SQL},
      'good_opportunity', ${EFFECTIVE_GOOD_OPPORTUNITY_SQL},
      'manual_override', s.manual_override
    ) ||
    jsonb_build_object(
      'auto_igs_type', s.igs_type,
      'auto_subtype', s.subtype,
      'auto_status', s.status,
      'auto_name', s.name,
      'auto_ownership', s.ownership,
      'auto_access_control', s.access_control,
      'auto_access_description', s.access_description,
      'auto_natural_barrier', s.natural_barrier,
      'auto_maintenance', s.maintenance,
      'auto_maintenance_frequency', s.maintenance_frequency,
      'auto_prox_housing', s.prox_housing,
      'auto_hidden_gem', s.hidden_gem,
      'auto_dangerous', s.dangerous,
      'auto_noisy', s.noisy,
      'auto_too_small', s.too_small,
      'auto_notes', s.notes,
      'manual_igs_type', s.manual_igs_type,
      'manual_subtype', s.manual_subtype,
      'manual_status', s.manual_status,
      'manual_name', s.manual_name,
      'manual_ownership', s.manual_ownership
    ) ||
    jsonb_build_object(
      'manual_access_control', s.manual_access_control,
      'manual_access_description', s.manual_access_description,
      'manual_natural_barrier', s.manual_natural_barrier,
      'manual_maintenance', s.manual_maintenance,
      'manual_maintenance_frequency', s.manual_maintenance_frequency,
      'manual_prox_housing', s.manual_prox_housing,
      'manual_hidden_gem', s.manual_hidden_gem,
      'manual_dangerous', s.manual_dangerous,
      'manual_noisy', s.manual_noisy,
      'manual_too_small', s.manual_too_small,
      'manual_notes', s.manual_notes,
      'buried_river', ${EFFECTIVE_BURIED_RIVER_SQL},
      'community_activity_potential', ${EFFECTIVE_COMMUNITY_ACTIVITY_POTENTIAL_SQL},
      'biodiversity_potential', ${EFFECTIVE_BIODIVERSITY_POTENTIAL_SQL},
      'auto_buried_river', s.buried_river,
      'auto_community_activity_potential', s.community_activity_potential,
      'auto_biodiversity_potential', s.biodiversity_potential,
      'manual_buried_river', s.manual_buried_river,
      'manual_community_activity_potential', s.manual_community_activity_potential,
      'manual_biodiversity_potential', s.manual_biodiversity_potential,
      'editor_notes', s.editor_notes,
      'reviewed_by', s.reviewed_by,
      'reviewed_at', s.reviewed_at,
      'source_present', s.source_present
    )
  )
`

const GEOJSON_SELECT = `
  json_build_object(
    'type', 'Feature',
    'id', s.id,
    'geometry', ST_AsGeoJSON(${EFFECTIVE_GEOM_SQL})::json,
    'properties', ${GEOJSON_PROPERTIES_SQL}
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
      ${EFFECTIVE_IGS_TYPE_SQL} AS igs_type,
      ${EFFECTIVE_SUBTYPE_SQL} AS subtype,
      ${EFFECTIVE_STATUS_SQL} AS status,
      ${EFFECTIVE_AREA_SQL} AS area_m2,
      ${EFFECTIVE_GOOD_OPPORTUNITY_SQL} AS good_opportunity,
      ${EFFECTIVE_HIDDEN_GEM_SQL} AS hidden_gem,
      ${EFFECTIVE_DANGEROUS_SQL} AS dangerous,
      ${EFFECTIVE_NOISY_SQL} AS noisy,
      ${EFFECTIVE_TOO_SMALL_SQL} AS too_small,
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

async function markReviewQueueCacheStale(
  reason: string,
  executor: SqlExecutor = { query }
) {
  await executor.query(
    `
      INSERT INTO review_queue_cache_meta (
        cache_key,
        is_stale,
        stale_reason,
        stale_since,
        updated_at
      )
      VALUES ($1, TRUE, $2, NOW(), NOW())
      ON CONFLICT (cache_key) DO UPDATE SET
        is_stale = TRUE,
        stale_reason = EXCLUDED.stale_reason,
        stale_since = CASE
          WHEN review_queue_cache_meta.is_stale THEN review_queue_cache_meta.stale_since
          ELSE NOW()
        END,
        updated_at = NOW()
    `,
    [REVIEW_QUEUE_CACHE_KEY, reason]
  )
}

async function markReviewQueueRefreshStarted(executor: SqlExecutor) {
  await executor.query(
    `
      INSERT INTO review_queue_cache_meta (
        cache_key,
        is_stale,
        stale_reason,
        stale_since,
        last_refresh_started_at,
        updated_at
      )
      VALUES ($1, TRUE, 'refresh_in_progress', NOW(), NOW(), NOW())
      ON CONFLICT (cache_key) DO UPDATE SET
        is_stale = TRUE,
        stale_reason = COALESCE(review_queue_cache_meta.stale_reason, 'refresh_in_progress'),
        stale_since = COALESCE(review_queue_cache_meta.stale_since, NOW()),
        last_refresh_started_at = NOW(),
        updated_at = NOW()
    `,
    [REVIEW_QUEUE_CACHE_KEY]
  )
}

async function markReviewQueueRefreshSucceeded(executor: SqlExecutor) {
  await executor.query(
    `
      INSERT INTO review_queue_cache_meta (
        cache_key,
        is_stale,
        stale_reason,
        stale_since,
        last_refresh_started_at,
        last_refreshed_at,
        last_error,
        last_error_at,
        updated_at
      )
      VALUES ($1, FALSE, NULL, NULL, NOW(), NOW(), NULL, NULL, NOW())
      ON CONFLICT (cache_key) DO UPDATE SET
        is_stale = FALSE,
        stale_reason = NULL,
        stale_since = NULL,
        last_refresh_started_at = COALESCE(review_queue_cache_meta.last_refresh_started_at, NOW()),
        last_refreshed_at = NOW(),
        last_error = NULL,
        last_error_at = NULL,
        updated_at = NOW()
    `,
    [REVIEW_QUEUE_CACHE_KEY]
  )
}

async function markReviewQueueRefreshFailed(error: unknown) {
  const message = getErrorMessage(error)

  try {
    await query(
      `
        INSERT INTO review_queue_cache_meta (
          cache_key,
          is_stale,
          stale_reason,
          stale_since,
          last_error,
          last_error_at,
          updated_at
        )
        VALUES ($1, TRUE, 'refresh_failed', NOW(), $2, NOW(), NOW())
        ON CONFLICT (cache_key) DO UPDATE SET
          is_stale = TRUE,
          stale_reason = COALESCE(review_queue_cache_meta.stale_reason, 'refresh_failed'),
          stale_since = COALESCE(review_queue_cache_meta.stale_since, NOW()),
          last_error = EXCLUDED.last_error,
          last_error_at = NOW(),
          updated_at = NOW()
      `,
      [REVIEW_QUEUE_CACHE_KEY, message]
    )
  } catch (metaError) {
    console.error('Failed to persist review queue cache failure state', metaError)
  }
}

async function getReviewQueueCacheMeta(): Promise<ReviewQueueMeta> {
  try {
    const result = await query(
      `
        SELECT
          is_stale AS "isStale",
          stale_reason AS "staleReason",
          stale_since AS "staleSince",
          last_refresh_started_at AS "lastRefreshStartedAt",
          last_refreshed_at AS "lastRefreshedAt",
          last_error_at AS "lastErrorAt"
        FROM review_queue_cache_meta
        WHERE cache_key = $1
      `,
      [REVIEW_QUEUE_CACHE_KEY]
    )

    return result.rows[0] ?? {
      isStale: true,
      staleReason: 'cache_not_initialized',
      staleSince: null,
      lastRefreshStartedAt: null,
      lastRefreshedAt: null,
      lastErrorAt: null,
    }
  } catch (error) {
    console.error('Failed to load review queue cache metadata', error)
    return {
      isStale: true,
      staleReason: 'cache_status_unavailable',
      staleSince: null,
      lastRefreshStartedAt: null,
      lastRefreshedAt: null,
      lastErrorAt: null,
    }
  }
}

async function computeReviewQueueRows(siteIds?: number[]) {
  const result = await query(REVIEW_QUEUE_COMPUTE_SQL, [
    [...REVIEW_QUEUE_LAYER_KEYS],
    siteIds && siteIds.length > 0 ? siteIds : null,
  ])

  return result.rows
}

export async function refreshReviewQueueCache(siteIds?: number[]) {
  const client = await pool.connect()

  try {
    const rows = await computeReviewQueueRows(siteIds)

    await client.query('BEGIN')
    await markReviewQueueRefreshStarted(client)

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

    await markReviewQueueRefreshSucceeded(client)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    await markReviewQueueRefreshFailed(error)
    throw error
  } finally {
    client.release()
  }
}

async function refreshReviewQueueCacheForSite(id: number, reason = 'site_updated') {
  try {
    await markReviewQueueCacheStale(reason)
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
      AND NOT (
        ${EFFECTIVE_IGS_TYPE_SQL} = 'Edgeland'
        AND ${EFFECTIVE_SUBTYPE_SQL} IN ('Bio', 'Geo')
      )
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
    ownership: 'manual_ownership',
    access_control: 'manual_access_control',
    access_description: 'manual_access_description',
    natural_barrier: 'manual_natural_barrier',
    maintenance: 'manual_maintenance',
    maintenance_frequency: 'manual_maintenance_frequency',
    prox_housing: 'manual_prox_housing',
    hidden_gem: 'manual_hidden_gem',
    dangerous: 'manual_dangerous',
    noisy: 'manual_noisy',
    too_small: 'manual_too_small',
    notes: 'manual_notes',
    igs_type: 'manual_igs_type',
    subtype: 'manual_subtype',
    buried_river: 'manual_buried_river',
    community_activity_potential: 'manual_community_activity_potential',
    biodiversity_potential: 'manual_biodiversity_potential',
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
    await refreshReviewQueueCacheForSite(id, 'site_updated')
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
    await refreshReviewQueueCacheForSite(id, 'site_geometry_updated')
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
    await refreshReviewQueueCacheForSite(id, 'site_status_updated')
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
         manual_ownership = NULL,
         manual_access_control = NULL,
         manual_access_description = NULL,
         manual_natural_barrier = NULL,
         manual_maintenance = NULL,
         manual_maintenance_frequency = NULL,
         manual_prox_housing = NULL,
         manual_hidden_gem = NULL,
         manual_dangerous = NULL,
         manual_noisy = NULL,
         manual_too_small = NULL,
         manual_notes = NULL,
         manual_buried_river = NULL,
         manual_community_activity_potential = NULL,
         manual_biodiversity_potential = NULL,
         editor_notes = NULL,
         reviewed_by = NULL,
         reviewed_at = NULL,
         manual_override = FALSE,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [id]
  )

  if (result.rows[0]) {
    await refreshReviewQueueCacheForSite(id, 'site_overrides_reset')
  }

  return result.rows[0]
}

export async function getReviewQueue(limit = 200) {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(500, Math.floor(limit))) : 200

  const [result, meta] = await Promise.all([
    query(
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
    ),
    getReviewQueueCacheMeta(),
  ])

  return {
    items: result.rows,
    meta,
  }
}

export { markReviewQueueCacheStale }
