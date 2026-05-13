import crypto from 'node:crypto'
import type { Request, RequestHandler } from 'express'
import type { CorsOptions } from 'cors'
import { HttpError } from './http.js'

const EDITOR_NAME_MAX_LENGTH = 60
const EDITOR_NAME_ALLOWED = /^[\p{L}\p{N} ._'-]+$/u

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

export function buildCorsOptions(): CorsOptions {
  const allowedOrigins = parseAllowedOrigins()

  if (allowedOrigins.length === 0) {
    if (process.env.NODE_ENV === 'production') {
      return {
        origin(_origin, callback) {
          callback(new HttpError(403, 'CORS is not configured for this deployment'))
        },
      }
    }
    return { origin: true }
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

export function assertProductionAuthConfigured() {
  if (process.env.NODE_ENV !== 'production') return

  const token = process.env.EDITOR_API_TOKEN?.trim()
  if (!token) {
    throw new Error(
      'EDITOR_API_TOKEN must be set in production. Refusing to start with an unauthenticated write surface.'
    )
  }

  if (token.length < 16) {
    throw new Error(
      'EDITOR_API_TOKEN is too short (min 16 characters). Generate a strong random token (e.g. openssl rand -hex 32).'
    )
  }
}

export const requireEditorToken: RequestHandler = (req, _res, next) => {
  const expectedToken = process.env.EDITOR_API_TOKEN?.trim()

  if (!expectedToken) {
    if (process.env.NODE_ENV === 'production') {
      next(new HttpError(500, 'Server auth is misconfigured'))
      return
    }
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

export function extractEditorName(req: Request): string {
  const raw = req.header('x-editor-name')
  if (typeof raw !== 'string') return 'editor'

  const trimmed = raw.trim()
  if (!trimmed) return 'editor'

  if (!EDITOR_NAME_ALLOWED.test(trimmed)) return 'editor'

  return trimmed.slice(0, EDITOR_NAME_MAX_LENGTH)
}
