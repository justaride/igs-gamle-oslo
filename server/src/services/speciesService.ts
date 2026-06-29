import { query } from '../db.js'

export async function getSpeciesBySite(siteId: number) {
  const result = await query(`
    SELECT
      id, scientific_name, vernacular_name,
      red_list_category, is_alien, observation_count,
      source, created_by, created_at,
      ST_AsGeoJSON(geom)::json AS geom
    FROM species_observations
    WHERE site_id = $1
    ORDER BY
      CASE red_list_category
        WHEN 'CR' THEN 1 WHEN 'EN' THEN 2
        WHEN 'VU' THEN 3 WHEN 'NT' THEN 4
        ELSE 5
      END,
      observation_count DESC
  `, [siteId])
  return result.rows
}

export async function createObservation(data: {
  siteId: number
  scientificName: string
  vernacularName?: string | null
  observationCount: number
  latitude: number
  longitude: number
  source?: 'imported' | 'manual'
  createdBy?: string | null
}) {
  const result = await query(
    `INSERT INTO species_observations (
      site_id, scientific_name, vernacular_name,
      observation_count, geom, source, created_by
    ) VALUES (
      $1, $2, $3, $4,
      ST_SetSRID(ST_MakePoint($5, $6), 4326),
      $7, $8
    ) RETURNING id, source, created_by AS "createdBy", created_at AS "createdAt"`,
    [
      data.siteId,
      data.scientificName,
      data.vernacularName ?? null,
      data.observationCount,
      data.longitude,
      data.latitude,
      data.source ?? 'imported',
      data.createdBy ?? null,
    ]
  )
  return result.rows[0]
}

export async function getAllSpeciesAsGeoJSON() {
  const result = await query(`
    SELECT json_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(json_agg(
        json_build_object(
          'type', 'Feature',
          'geometry', ST_AsGeoJSON(so.geom)::json,
          'properties', json_build_object(
            'id', so.id,
            'site_id', so.site_id,
            'scientific_name', so.scientific_name,
            'vernacular_name', so.vernacular_name,
            'red_list_category', so.red_list_category,
            'is_alien', so.is_alien,
            'observation_count', so.observation_count,
            'source', so.source,
            'created_by', so.created_by,
            'created_at', so.created_at
          )
        )
      ), '[]'::json)
    ) AS geojson
    FROM species_observations so
  `)
  return result.rows[0].geojson
}
