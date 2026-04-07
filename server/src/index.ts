import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { buildCorsOptions } from './auth.js'
import { errorHandler, notFoundHandler } from './http.js'
import { runMigrations } from './migrations.js'
import sitesRouter from './routes/sites.js'
import speciesRouter from './routes/species.js'
import parksRouter from './routes/parks.js'
import contextLayersRouter from './routes/contextLayers.js'
import exportRouter from './routes/exportRoute.js'

const app = express()
const PORT = process.env.PORT || 3001
const corsOptions = buildCorsOptions()

app.disable('x-powered-by')
app.use(helmet())
if (corsOptions) {
  app.use(cors(corsOptions))
}
app.use(express.json({ limit: '10mb' }))

app.use('/api/sites', sitesRouter)
app.use('/api/species', speciesRouter)
app.use('/api/parks', parksRouter)
app.use('/api/context-layers', contextLayersRouter)
app.use('/api/export', exportRouter)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use(notFoundHandler)
app.use(errorHandler)

async function start() {
  await runMigrations()

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
}

start().catch((error) => {
  console.error('Failed to start server', error)
  process.exit(1)
})
