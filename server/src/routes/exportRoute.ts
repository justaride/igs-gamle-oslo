import { Router } from 'express'
import { asyncHandler } from '../http.js'
import { generateExcel } from '../services/excelService.js'
import { query } from '../db.js'
import { buildSiteSql } from '../services/siteSql.js'

const router = Router()
const siteSql = buildSiteSql('s')

function parseStatusFilter(raw: unknown): string[] | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined
  const valid = ['candidate', 'validated', 'rejected']
  const statuses = raw.split(',').map((s) => s.trim()).filter((s) => valid.includes(s))
  return statuses.length > 0 ? statuses : undefined
}

router.get('/excel', asyncHandler(async (req, res) => {
  const statusFilter = parseStatusFilter(req.query.status)
  const wb = await generateExcel(statusFilter)
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', 'attachment; filename=IGS_Assessment_GamleOslo.xlsx')
  await wb.xlsx.write(res)
  res.end()
}))

router.get('/geojson', asyncHandler(async (req, res) => {
  const statusFilter = parseStatusFilter(req.query.status)
  const params: unknown[] = []
  let statusClause = ''
  if (statusFilter) {
    params.push(statusFilter)
    statusClause = `AND (${siteSql.effectiveStatus}) = ANY($1::text[])`
  }

  const result = await query(`
    SELECT json_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(json_agg(
        json_build_object(
          'type', 'Feature',
          'geometry', ST_AsGeoJSON(COALESCE(s.manual_geometry, s.geom))::json,
          'properties', jsonb_build_object(
            'id', s.id,
            'site_number', s.site_number,
            'igs_type', ${siteSql.effectiveIgsType},
            'subtype', ${siteSql.effectiveSubtype},
            'status', ${siteSql.effectiveStatus},
            'name', ${siteSql.effectiveName},
            'area_m2', ${siteSql.effectiveArea},
            'ownership', ${siteSql.effectiveOwnership},
            'access_control', ${siteSql.effectiveAccessControl}
          )
        ) ORDER BY s.site_number
      ), '[]'::json)
    ) AS geojson
    FROM sites s
    WHERE ${siteSql.activeSite}
    ${statusClause}
  `, params)

  res.setHeader('Content-Type', 'application/geo+json')
  res.setHeader('Content-Disposition', 'attachment; filename=IGS_GamleOslo.geojson')
  res.json(result.rows[0].geojson)
}))

export default router
