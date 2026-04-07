import { Router } from 'express'
import { requireEditorToken } from '../auth.js'
import { asyncHandler, HttpError } from '../http.js'
import * as siteService from '../services/siteService.js'
import {
  parseGeometryPatchBody,
  parseIdParam,
  parseReviewQueueLimit,
  parseSiteStatusBody,
  parseSiteUpdateBody,
} from '../validation.js'

const router = Router()

router.get('/', asyncHandler(async (_req, res) => {
  const geojson = await siteService.getAllSites()
  res.json(geojson)
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

router.post('/:id/reset-overrides', requireEditorToken, asyncHandler(async (req, res) => {
  const id = parseIdParam(req.params.id)
  const result = await siteService.resetSiteOverrides(id)
  if (!result) {
    throw new HttpError(404, 'Site not found')
  }
  res.json(result)
}))

export default router
