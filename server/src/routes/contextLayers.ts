import { Router } from 'express'
import { requireEditorToken } from '../auth.js'
import { asyncHandler, HttpError } from '../http.js'
import * as contextLayerService from '../services/contextLayerService.js'
import { parseContextLayerUpsertBody } from '../validation.js'

const router = Router()

router.get('/', asyncHandler(async (req, res) => {
  const keysParam = typeof req.query.keys === 'string' ? req.query.keys : ''
  const keys = keysParam
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  const layers = await contextLayerService.getContextLayers(keys.length > 0 ? keys : undefined)
  res.json({ layers })
}))

router.post('/refresh-review-queue', requireEditorToken, asyncHandler(async (_req, res) => {
  await contextLayerService.refreshReviewQueueFromLayers()
  res.json({ ok: true, message: 'Review queue cache refreshed from current context layers' })
}))

router.put('/:key', requireEditorToken, asyncHandler(async (req, res) => {
  const layerKey = typeof req.params.key === 'string' ? req.params.key.trim() : ''
  if (!layerKey) {
    throw new HttpError(400, 'Layer key is required')
  }

  const payload = parseContextLayerUpsertBody(req.body)
  await contextLayerService.upsertContextLayer(layerKey, payload)
  res.json({ ok: true, key: layerKey })
}))

router.get('/:key', asyncHandler(async (req, res) => {
  const layerKey = typeof req.params.key === 'string' ? req.params.key.trim() : ''
  if (!layerKey) {
    throw new HttpError(400, 'Layer key is required')
  }

  const layer = await contextLayerService.getContextLayerByKey(layerKey)
  if (!layer) {
    throw new HttpError(404, 'Context layer not found')
  }
  res.json(layer)
}))

export default router
