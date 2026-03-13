import { query } from '../db.js'

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
