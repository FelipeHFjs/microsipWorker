import app from './app.js'
import config from './config/config.js'

async function startServer() {
  try {
    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`)
    })
  } catch (error) {
    console.error('Server startup failed while running migrations:', error)
    process.exit(1)
  }
}

startServer()
