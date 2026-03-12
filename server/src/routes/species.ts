import { Router } from 'express'
import * as speciesService from '../services/speciesService.js'

const router = Router()

router.get('/', async (_req, res) => {
  const geojson = await speciesService.getAllSpeciesAsGeoJSON()
  res.json(geojson)
})

router.get('/site/:siteId', async (req, res) => {
  const species = await speciesService.getSpeciesBySite(Number(req.params.siteId))
  res.json(species)
})

export default router
