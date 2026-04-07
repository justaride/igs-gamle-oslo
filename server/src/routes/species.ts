import { Router } from 'express'
import { asyncHandler } from '../http.js'
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

export default router
