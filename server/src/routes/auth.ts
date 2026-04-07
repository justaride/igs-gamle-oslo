import { Router } from 'express'
import { requireEditorToken } from '../auth.js'
import { asyncHandler } from '../http.js'

const router = Router()

router.get('/verify', requireEditorToken, asyncHandler(async (_req, res) => {
  res.json({ valid: true })
}))

export default router
