import crypto from 'node:crypto'
import type { RequestHandler } from 'express'
import type { CorsOptions } from 'cors'
import { HttpError } from './http.js'

function parseAllowedOrigins() {
  return (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

function timingSafeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

export function buildCorsOptions(): CorsOptions | null {
  const allowedOrigins = parseAllowedOrigins()

  if (allowedOrigins.length === 0) {
    return null
  }

  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
        return
      }

      callback(new HttpError(403, 'Origin is not allowed by CORS policy'))
    },
  }
}

export const requireEditorToken: RequestHandler = (req, _res, next) => {
  const expectedToken = process.env.EDITOR_API_TOKEN?.trim()

  if (!expectedToken) {
    next()
    return
  }

  const providedToken = req.header('x-editor-token')?.trim()
  if (!providedToken) {
    next(new HttpError(401, 'Missing editor token'))
    return
  }

  if (!timingSafeEqual(expectedToken, providedToken)) {
    next(new HttpError(403, 'Invalid editor token'))
    return
  }

  next()
}
