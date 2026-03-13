import { Router } from 'express'
import * as contextLayerService from '../services/contextLayerService.js'

const router = Router()

router.get('/', async (req, res) => {
  const keysParam = typeof req.query.keys === 'string' ? req.query.keys : ''
  const keys = keysParam
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  const layers = await contextLayerService.getContextLayers(keys.length > 0 ? keys : undefined)
  res.json({ layers })
})

router.get('/:key', async (req, res) => {
  const layer = await contextLayerService.getContextLayerByKey(req.params.key)
  if (!layer) return res.status(404).json({ error: 'Context layer not found' })
  res.json(layer)
})

export default router
