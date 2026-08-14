import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { errorHandler } from './middlewares/errorHandler.js'
import apiRoutes from './routes/apiRoutes.js'
import { startCronSyncNotificaciones } from './services/cronNotificaciones.js'

const app = express()

app.use(express.json())

startCronSyncNotificaciones().catch((error) => {
  console.error('Error starting cron sync for notifications:', error)
  process.exit(1) // Exit the process if cron fails to start
})

// Routes
app.use('/api', apiRoutes)

// Serve React build for all non-API routes
const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const clientBuildPath = path.resolve(currentDirectory, '..', '..', 'public')
app.use(express.static(clientBuildPath))
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'))
})

// Global error handler (should be after routes)
app.use(errorHandler)

export default app
