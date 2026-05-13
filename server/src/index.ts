import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { assertProductionAuthConfigured, buildCorsOptions } from './auth.js'
import { query } from './db.js'
import { errorHandler, notFoundHandler } from './http.js'
import { runMigrations } from './migrations.js'
import sitesRouter from './routes/sites.js'
import speciesRouter from './routes/species.js'
import parksRouter from './routes/parks.js'
import contextLayersRouter from './routes/contextLayers.js'
import exportRouter from './routes/exportRoute.js'
import authRouter from './routes/auth.js'

const app = express()
const PORT = process.env.PORT || 3001
const corsOptions = buildCorsOptions()

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later' },
})

app.disable('x-powered-by')
app.use(helmet())
app.use(cors(corsOptions))
app.use(express.json({ limit: '10mb' }))
app.use('/api/', apiLimiter)
app.use('/api/auth', authLimiter)

app.use('/api/sites', sitesRouter)
app.use('/api/species', speciesRouter)
app.use('/api/parks', parksRouter)
app.use('/api/context-layers', contextLayersRouter)
app.use('/api/export', exportRouter)
app.use('/api/auth', authRouter)

app.get('/api/health', async (_req, res) => {
  try {
    await query('SELECT 1')
    res.json({ status: 'ok', db: 'ok' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    res.status(503).json({ status: 'degraded', db: 'unreachable', error: message })
  }
})

app.use(notFoundHandler)
app.use(errorHandler)

async function start() {
  assertProductionAuthConfigured()
  await runMigrations()

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} (env=${process.env.NODE_ENV ?? 'development'})`)
  })
}

start().catch((error) => {
  console.error('Failed to start server', error)
  process.exit(1)
})

const shutdown = (signal: string) => {
  console.log(`Received ${signal}, shutting down gracefully`)
  process.exit(0)
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
