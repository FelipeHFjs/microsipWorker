import express from 'express'
import { getWebhookStatus, handleWebhookEvent } from '../controllers/webhooks.js'

const router = express.Router()

router.get('/', getWebhookStatus)
router.post('/', handleWebhookEvent)

export default router
