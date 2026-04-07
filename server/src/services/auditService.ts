import { query } from '../db.js'

export async function recordChanges(
  siteId: number,
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>,
  changedBy = 'editor'
) {
  const inserts: Promise<unknown>[] = []

  for (const [field, newVal] of Object.entries(newValues)) {
    const oldVal = oldValues[field]
    const oldStr = oldVal == null ? null : String(oldVal)
    const newStr = newVal == null ? null : String(newVal)

    if (oldStr !== newStr) {
      inserts.push(
        query(
          `INSERT INTO site_changes (site_id, field_name, old_value, new_value, changed_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [siteId, field, oldStr, newStr, changedBy]
        )
      )
    }
  }

  await Promise.all(inserts)
}

export async function getChangeHistory(siteId: number, limit = 50) {
  const result = await query(
    `SELECT
       id,
       field_name AS "fieldName",
       old_value AS "oldValue",
       new_value AS "newValue",
       changed_by AS "changedBy",
       changed_at AS "changedAt"
     FROM site_changes
     WHERE site_id = $1
     ORDER BY changed_at DESC
     LIMIT $2`,
    [siteId, limit]
  )
  return result.rows
}
