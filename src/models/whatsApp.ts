import { insertQuery } from '../utils/queryDb.js'

interface WhatsAppMessage {
  whatsappMessageId: string
  contactWaId: string
  contactName: string
  messageType: string
  messageText: string
  direction: 'outgoing' | 'incoming'
  messageData?: any
  doctoId?: number
  clienteId?: number
}

export async function insertWhatsAppMessage({
  whatsappMessageId,
  contactWaId,
  contactName,
  messageType,
  messageText,
  direction,
  messageData,
  doctoId,
  clienteId,
}: WhatsAppMessage): Promise<void> {
  const query = `
    INSERT INTO whatsapp_messages (
      whatsapp_message_id, 
      contact_wa_id, 
      contact_name, 
      message_type, 
      message_text, 
      message_data,
      direction,
      docto_id,
      cliente_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `
  const values = [
    whatsappMessageId,
    contactWaId,
    contactName,
    messageType,
    messageText,
    messageData ? JSON.stringify(messageData) : null,
    direction,
    doctoId,
    clienteId,
  ]

  await insertQuery(query, values)
}

export async function updateWhatsAppMessageStatus(
  whatsappMessageId: string,
  status: string,
  timestamp: number,
): Promise<string | null> {
  const allowed = ['sent', 'delivered', 'read', 'failed'] as const
  if (!(allowed as readonly string[]).includes(status)) return null

  const query = `
    UPDATE whatsapp_messages 
    SET ${status} = $1 
    WHERE whatsapp_message_id = $2
    RETURNING contact_wa_id
  `

  const result = await insertQuery<{ contactWaId: string }>(query, [timestamp, whatsappMessageId])
  return result?.contactWaId ?? null
}
