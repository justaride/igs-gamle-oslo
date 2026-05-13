import type { NextFunction, Request, RequestHandler, Response } from 'express'

export class HttpError extends Error {
  statusCode: number
  details?: unknown

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message)
    this.name = 'HttpError'
    this.statusCode = statusCode
    this.details = details
  }
}

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>

export function asyncHandler(handler: AsyncRequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next)
  }
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`))
}

function logServerError(label: string, req: Request, err: unknown) {
  const stack = err instanceof Error ? err.stack : undefined
  const message = err instanceof Error ? err.message : String(err)

  const record = {
    level: 'error',
    timestamp: new Date().toISOString(),
    label,
    method: req.method,
    path: req.originalUrl,
    message,
    stack,
  }

  console.error(JSON.stringify(record))
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (res.headersSent) {
    next(err)
    return
  }

  if (err instanceof HttpError) {
    if (err.statusCode >= 500) {
      logServerError('http_error_5xx', req, err)
    }
    res.status(err.statusCode).json({ error: err.message })
    return
  }

  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Invalid JSON request body' })
    return
  }

  logServerError('unhandled_error', req, err)
  res.status(500).json({ error: 'Internal server error' })
}
