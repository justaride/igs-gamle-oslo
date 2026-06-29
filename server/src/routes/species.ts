import { Router } from 'express'
import { extractEditorName, requireEditorToken } from '../auth.js'
import { asyncHandler } from '../http.js'
import * as speciesService from '../services/speciesService.js'
import { parseIdParam, parseSpeciesCreateBody } from '../validation.js'

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
  const payload = parseSpeciesCreateBody(req.body)

  const result = await speciesService.createObservation({
    ...payload,
    source: 'manual',
    createdBy: extractEditorName(req),
  })

  res.status(201).json(result)
}))

export default router
