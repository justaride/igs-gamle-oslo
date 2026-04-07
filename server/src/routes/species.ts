import { Router } from 'express'
import { requireEditorToken } from '../auth.js'
import { asyncHandler, HttpError } from '../http.js'
import * as speciesService from '../services/speciesService.js'
import { parseIdParam } from '../validation.js'

const router = Router()

router.get('/', asyncHandler(async (_req, res) => {
  const geojson = await speciesService.getAllSpeciesAsGeoJSON()
  res.json(geojson)
}))

router.get('/site/:siteId', asyncHandler(async (req, res) => {
  const siteId = parseIdParam(req.params.siteId, 'siteId')
  const species = await speciesService.getSpeciesBySite(siteId)
  res.json(species)
}))

router.post('/', requireEditorToken, asyncHandler(async (req, res) => {
  const { site_id, scientific_name, vernacular_name, observation_count, latitude, longitude } = req.body

  if (!site_id || !scientific_name || latitude == null || longitude == null) {
    throw new HttpError(400, 'site_id, scientific_name, latitude, and longitude are required')
  }

  const result = await speciesService.createObservation({
    siteId: Number(site_id),
    scientificName: String(scientific_name).trim(),
    vernacularName: vernacular_name ? String(vernacular_name).trim() : null,
    observationCount: Number(observation_count) || 1,
    latitude: Number(latitude),
    longitude: Number(longitude),
  })

  res.status(201).json(result)
}))

export default router
