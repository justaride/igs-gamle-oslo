import { query } from '../db.js'
import { refreshReviewQueueCache } from './siteService.js'

const REVIEW_QUEUE_LAYER_KEYS = [
  'steep_slopes',
  'edgeland_geo_edges',
  'residual_infra_buffers',
]

type ContextLayerRow = {
  layer_key: string
  label: string
  category: 'reference' | 'qa'
  description: string | null
  feature_count: number
  geojson: unknown
}

export async function getContextLayers(keys?: string[]) {
  const hasKeys = Boolean(keys && keys.length > 0)
  const result = await query(
    `
      SELECT
        layer_key,
        label,
        category,
        description,
        feature_count,
        geojson
      FROM context_layers
      ${hasKeys ? 'WHERE layer_key = ANY($1::text[])' : ''}
      ORDER BY category, label
    `,
    hasKeys ? [keys] : undefined
  )

  return result.rows.map((row: ContextLayerRow) => ({
    key: row.layer_key,
    label: row.label,
    category: row.category,
    description: row.description,
    featureCount: row.feature_count,
    geojson: row.geojson,
  }))
}

async function refreshQueueIfNeeded(updatedKeys: string[]) {
  const affectsQueue = updatedKeys.some((k) => REVIEW_QUEUE_LAYER_KEYS.includes(k))
  if (affectsQueue) {
    await refreshReviewQueueCache()
  }
}

export async function upsertContextLayer(
  layerKey: string,
  data: { label: string; category: string; description?: string | null; geojson: unknown }
) {
  const featureCount =
    (data.geojson as { features?: unknown[] })?.features?.length ?? 0

  await query(
    `
      INSERT INTO context_layers (layer_key, label, category, description, geojson, feature_count, updated_at)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, NOW())
      ON CONFLICT (layer_key) DO UPDATE SET
        label = EXCLUDED.label,
        category = EXCLUDED.category,
        description = EXCLUDED.description,
        geojson = EXCLUDED.geojson,
        feature_count = EXCLUDED.feature_count,
        updated_at = NOW()
    `,
    [layerKey, data.label, data.category, data.description ?? null, JSON.stringify(data.geojson), featureCount]
  )

  await refreshQueueIfNeeded([layerKey])
}

export async function refreshReviewQueueFromLayers(): Promise<void> {
  await refreshReviewQueueCache()
}

export async function getContextLayerByKey(key: string) {
  const result = await query(
    `
      SELECT
        layer_key,
        label,
        category,
        description,
        feature_count,
        geojson
      FROM context_layers
      WHERE layer_key = $1
    `,
    [key]
  )

  const row = result.rows[0] as ContextLayerRow | undefined
  if (!row) return null

  return {
    key: row.layer_key,
    label: row.label,
    category: row.category,
    description: row.description,
    featureCount: row.feature_count,
    geojson: row.geojson,
  }
}
