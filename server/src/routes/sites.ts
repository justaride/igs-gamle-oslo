import { Router } from 'express'
import * as siteService from '../services/siteService.js'

const router = Router()

router.get('/', async (_req, res) => {
  const geojson = await siteService.getAllSites()
  res.json(geojson)
})

router.get('/review-queue', async (req, res) => {
  const rawLimit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined
  const items = await siteService.getReviewQueue(rawLimit)
  res.json({ items })
})

router.get('/:id', async (req, res) => {
  const feature = await siteService.getSiteById(Number(req.params.id))
  if (!feature) return res.status(404).json({ error: 'Site not found' })
  res.json(feature)
})

router.patch('/:id', async (req, res) => {
  const result = await siteService.updateSite(Number(req.params.id), req.body)
  if (!result) return res.status(400).json({ error: 'No valid fields provided' })
  res.json(result)
})

router.patch('/:id/geometry', async (req, res) => {
  const result = await siteService.updateSiteGeometry(Number(req.params.id), req.body.geometry)
  if (!result) return res.status(404).json({ error: 'Site not found' })
  res.json(result)
})

router.patch('/:id/status', async (req, res) => {
  const { status } = req.body
  if (!['candidate', 'validated', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' })
  }
  const result = await siteService.updateSiteStatus(Number(req.params.id), status)
  if (!result) return res.status(404).json({ error: 'Site not found' })
  res.json(result)
})

export default router
