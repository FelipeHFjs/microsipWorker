import express from 'express'
import webhookRoutes from './webhookRoutes.js'

const router = express.Router()

router.get('/', (_req, res) => {
  res.json({ message: 'API is working!' })
})

router.use('/webhook', webhookRoutes)

export default router
