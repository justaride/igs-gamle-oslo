import { query } from '../db.js'

export async function getSpeciesBySite(siteId: number) {
  const result = await query(`
    SELECT
      id, scientific_name, vernacular_name,
      red_list_category, is_alien, observation_count,
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
            'observation_count', so.observation_count
          )
        )
      ), '[]'::json)
    ) AS geojson
    FROM species_observations so
  `)
  return result.rows[0].geojson
}
