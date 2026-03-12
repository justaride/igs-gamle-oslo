import { Router } from 'express'
import { query } from '../db.js'

const router = Router()

router.get('/', async (_req, res) => {
  const result = await query(`
    SELECT json_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(json_agg(
        json_build_object(
          'type', 'Feature',
          'geometry', ST_AsGeoJSON(p.geom)::json,
          'properties', json_build_object('id', p.id, 'name', p.name)
        )
      ), '[]'::json)
    ) AS geojson
    FROM parks p
  `)
  res.json(result.rows[0].geojson)
})

export default router
