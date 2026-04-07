import { Router } from 'express'
import { requireEditorToken } from '../auth.js'
import { asyncHandler, HttpError } from '../http.js'
import * as siteService from '../services/siteService.js'
import { getChangeHistory } from '../services/auditService.js'
import {
  parseGeometryPatchBody,
  parseIdParam,
  parseReviewQueueLimit,
  parseSiteCreateBody,
  parseSiteStatusBody,
  parseSiteUpdateBody,
} from '../validation.js'

const router = Router()

router.get('/', asyncHandler(async (_req, res) => {
  const geojson = await siteService.getAllSites()
  res.json(geojson)
}))

router.post('/', requireEditorToken, asyncHandler(async (req, res) => {
  const fields = parseSiteCreateBody(req.body)
  const feature = await siteService.createSite(fields)
  res.status(201).json(feature)
}))

router.get('/review-queue', asyncHandler(async (req, res) => {
  const limit = parseReviewQueueLimit(req.query.limit)
  const data = await siteService.getReviewQueue(limit)
  res.json(data)
}))

router.get('/:id', asyncHandler(async (req, res) => {
  const id = parseIdParam(req.params.id)
  const feature = await siteService.getSiteById(id)
  if (!feature) {
    throw new HttpError(404, 'Site not found')
  }
  res.json(feature)
}))

router.get('/:id/changes', asyncHandler(async (req, res) => {
  const id = parseIdParam(req.params.id)
  const changes = await getChangeHistory(id)
  res.json({ changes })
}))

router.patch('/:id', requireEditorToken, asyncHandler(async (req, res) => {
  const id = parseIdParam(req.params.id)
  const fields = parseSiteUpdateBody(req.body)
  const result = await siteService.updateSite(id, fields)
  if (!result) {
    throw new HttpError(404, 'Site not found')
  }
  res.json(result)
}))

router.patch('/:id/geometry', requireEditorToken, asyncHandler(async (req, res) => {
  const id = parseIdParam(req.params.id)
  const { geometry } = parseGeometryPatchBody(req.body)
  const result = await siteService.updateSiteGeometry(id, geometry)
  if (!result) {
    throw new HttpError(404, 'Site not found')
  }
  res.json(result)
}))

router.patch('/:id/status', requireEditorToken, asyncHandler(async (req, res) => {
  const id = parseIdParam(req.params.id)
  const status = parseSiteStatusBody(req.body)
  const result = await siteService.updateSiteStatus(id, status)
  if (!result) {
    throw new HttpError(404, 'Site not found')
  }
  res.json(result)
}))

router.post('/bulk-status', requireEditorToken, asyncHandler(async (req, res) => {
  const { siteIds, status } = req.body
  if (!Array.isArray(siteIds) || siteIds.length === 0) {
    throw new HttpError(400, 'siteIds must be a non-empty array')
  }
  const parsedStatus = parseSiteStatusBody({ status })
  const results = []
  for (const id of siteIds) {
    const parsed = parseIdParam(String(id), 'siteId')
    const result = await siteService.updateSiteStatus(parsed, parsedStatus)
    if (result) results.push(result)
  }
  res.json({ updated: results.length })
}))

router.post('/:id/reset-overrides', requireEditorToken, asyncHandler(async (req, res) => {
  const id = parseIdParam(req.params.id)
  const result = await siteService.resetSiteOverrides(id)
  if (!result) {
    throw new HttpError(404, 'Site not found')
  }
  res.json(result)
}))

export default router
