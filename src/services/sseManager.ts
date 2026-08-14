import { EventEmitter } from 'events'
import type { Response } from 'express'

export interface SseNewMessage {
  type: 'new_message'
  contactWaId: string
}

export interface SseStatusUpdate {
  type: 'status_update'
  contactWaId: string
  whatsapp_message_id: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: number
}

export type SseEvent = SseNewMessage | SseStatusUpdate

const emitter = new EventEmitter()
emitter.setMaxListeners(500)

/**
 * Subscribe an SSE Response to events for a specific contact.
 * Returns an unsubscribe function — call it on request close.
 */
export function subscribeToContact(contactWaId: string, res: Response): () => void {
  const eventName = `contact:${contactWaId}`
  const handler = (event: SseEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`)
  }
  emitter.on(eventName, handler)
  return () => emitter.off(eventName, handler)
}

/** Push an event to all clients watching a specific contact. */
export function emitToContact(contactWaId: string, event: SseEvent): void {
  emitter.emit(`contact:${contactWaId}`, event)
}
