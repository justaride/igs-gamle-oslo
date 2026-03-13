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

router.post('/refresh-review-queue', async (_req, res) => {
  try {
    await contextLayerService.refreshReviewQueueFromLayers()
    res.json({ ok: true, message: 'Review queue cache refreshed from current context layers' })
  } catch (error) {
    console.error('Failed to refresh review queue cache:', error)
    res.status(500).json({ error: 'Failed to refresh review queue cache' })
  }
})

router.put('/:key', async (req, res) => {
  const { label, category, description, geojson } = req.body
  if (!label || !category || !geojson) {
    return res.status(400).json({ error: 'Missing required fields: label, category, geojson' })
  }

  try {
    await contextLayerService.upsertContextLayer(req.params.key, { label, category, description, geojson })
    res.json({ ok: true, key: req.params.key })
  } catch (error) {
    console.error('Failed to upsert context layer:', error)
    res.status(500).json({ error: 'Failed to upsert context layer' })
  }
})

router.get('/:key', async (req, res) => {
  const layer = await contextLayerService.getContextLayerByKey(req.params.key)
  if (!layer) return res.status(404).json({ error: 'Context layer not found' })
  res.json(layer)
})

export default router
