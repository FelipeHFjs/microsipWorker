import type { Request, Response } from 'express'
import { selectQuery } from '../utils/queryDb.js'
import { insertWhatsAppMessage, updateWhatsAppMessageStatus } from '../models/whatsApp.js'
import { uploadFileToS3, uploadWhatsAppMedia } from '../config/s3Config.js'
import {
  downloadWhatsAppMedia,
  sendDocumentMessageToWABA,
  sendTextReplyToWABA,
  uploadMediaToWABA,
} from '../config/wabaConfig.js'
// import queryCustomerDataPdf from '../models/sales/queryCustomerDataPdf'
// import { queryInvoiceInfo, queryRemisionInfo } from '../models/queryPdfData'
// import generateEdcPdf from '../utils/generateEdcPdf'
// import { generateInvoicePdf } from '../utils/invoicePdf'
// import { generateRemisionPdf } from '../utils/generateRemisionPdf'
import { emitToContact } from '../services/sseManager.js'

type ButtonAction = 'factura' | 'remision' | 'edc'
const PDF_GENERATION_ERROR_MESSAGE = 'Ocurrio un error al generar PDF intente mas tarde'
const OFFICE_FALLBACK_MESSAGE = `Hola soy el asistente virtual de Carbansa (Industrias Banman),
por el momento no tengo capacidad para responder mensajes,
Favor de contactar una de las siguientes sucursales
1. Km 24: 6251024369
2. Campo 101: 6251520094`

function normalizeButtonText(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function sanitizeFilenamePart(value: unknown) {
  return String(value || 'documento')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function shouldIgnoreAutoReply(text: string) {
  const trimmed = text.trim()
  const normalized = normalizeButtonText(trimmed)
  return trimmed.length < 10 && normalized.includes('gracias')
}

function shouldSendOfficeFallback(messageType: string, text: string) {
  if (messageType === 'audio') {
    return true
  }

  if (messageType === 'text') {
    return !shouldIgnoreAutoReply(text)
  }

  return false
}

export async function getWebhookStatus(req: Request, res: Response): Promise<void> {
  // Your webhook verification logic
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    res.status(200).send(challenge)
  } else {
    console.error('Webhook verification failed')
    res.sendStatus(403)
  }
}

export async function handleWebhookEvent(req: Request, res: Response): Promise<void> {
  const { entry } = req.body

  if (!entry || entry.length === 0) {
    res.status(400).send('Invalid Request')
    return
  }

  const changes = entry[0].changes
  const value = changes[0].value
  const messages = value.messages
  const contacts = value.contacts

  if (!changes || changes.length === 0) {
    res.status(400).send('Invalid Request')
    return
  }

  // const statuses = value.statuses ? value.statuses[0] : null
  if (value.statuses && value.statuses.length > 0) {
    // loop through all statuses in case there are multiple
    for (const statuses of value.statuses) {
      const messageId = statuses.id
      const status = statuses.status
      const timestamp = statuses.timestamp
      console.log(messageId, status, timestamp)
      const contactWaId = await updateWhatsAppMessageStatus(messageId, status, timestamp)
      if (contactWaId && ['sent', 'delivered', 'read', 'failed'].includes(status)) {
        emitToContact(contactWaId, {
          type: 'status_update',
          contactWaId,
          whatsapp_message_id: messageId,
          status: status as 'sent' | 'delivered' | 'read' | 'failed',
          timestamp: Number(timestamp),
        })
      }
    }
  }

  if (messages && messages.length > 0) {
    for (const message of messages) {
      const messageId = message.id
      const from = message.from
      const type = message.type
      const contact = contacts?.find((c: any) => c.wa_id === from)
      const contactName = contact?.profile?.name || 'Unknown'
      let buttonAction: ButtonAction | null = null
      let text = ''
      let mediaData = null

      // Handle different message types
      switch (type) {
        case 'text':
          text = message.text?.body || ''
          break

        case 'image':
          const imageId = message.image?.id
          if (imageId) {
            try {
              const { buffer, mimeType, filename } = await downloadWhatsAppMedia(imageId)

              const s3Key = await uploadWhatsAppMedia(buffer, filename, mimeType, messageId)

              text = `Image received and stored`
              mediaData = {
                media_id: imageId,
                s3_key: s3Key,
                mime_type: mimeType,
                sha256: message.image?.sha256,
              }
            } catch (error) {
              console.error('Failed to process image:', error)
              text = 'Image received (processing failed)'
            }
          }
          break

        case 'document':
          const docId = message.document?.id
          if (docId) {
            try {
              const { buffer, mimeType, filename } = await downloadWhatsAppMedia(docId)

              const s3Key = await uploadWhatsAppMedia(
                buffer,
                message.document?.filename || filename,
                mimeType,
                messageId,
              )

              text = `Document received: ${message.document?.filename || 'Unknown'}`
              mediaData = {
                media_id: docId,
                s3_key: s3Key,
                filename: message.document?.filename,
                mime_type: mimeType,
              }
            } catch (error) {
              console.error('Failed to process document:', error)
              text = 'Document received (processing failed)'
            }
          }
          break

        case 'audio':
          const audioId = message.audio?.id
          if (audioId) {
            try {
              const { buffer, mimeType, filename } = await downloadWhatsAppMedia(audioId)

              const s3Key = await uploadWhatsAppMedia(buffer, filename, mimeType, messageId)

              text = `Audio received`
              mediaData = {
                media_id: audioId,
                s3_key: s3Key,
                mime_type: mimeType,
              }
            } catch (error) {
              console.error('Failed to process audio:', error)
              text = 'Audio received (processing failed)'
            }
          }
          break

        case 'video':
          const videoId = message.video?.id
          if (videoId) {
            try {
              const { buffer, mimeType, filename } = await downloadWhatsAppMedia(videoId)

              const s3Key = await uploadWhatsAppMedia(buffer, filename, mimeType, messageId)

              text = `Video received`
              mediaData = {
                media_id: videoId,
                s3_key: s3Key,
                mime_type: mimeType,
              }
            } catch (error) {
              console.error('Failed to process video:', error)
              text = 'Video received (processing failed)'
            }
          }
          break

        case 'sticker':
          const stickerId = message.sticker?.id
          if (stickerId) {
            try {
              const { buffer, mimeType, filename } = await downloadWhatsAppMedia(stickerId)

              const s3Key = await uploadWhatsAppMedia(buffer, filename, mimeType, messageId)

              text = `Sticker received`
              mediaData = {
                media_id: stickerId,
                s3_key: s3Key,
                mime_type: mimeType,
                sha256: message.sticker?.sha256,
              }
            } catch (error) {
              console.error('Failed to process sticker:', error)
              text = 'Sticker received (processing failed)'
            }
          }
          break

        case 'button':
          const buttonText = message.button?.text || ''
          const buttonPayload = message.button?.payload || ''
          const contextId = message.context?.id || null
          const contextFrom = message.context?.from || null

          text = `Button clicked: ${buttonText}`
          mediaData = {
            button_text: buttonText,
            button_payload: buttonPayload,
            context_message_id: contextId,
            context_from: contextFrom,
          }

          const normalizedButtonText = normalizeButtonText(buttonText)
          if (normalizedButtonText === 'ver factura') {
            buttonAction = 'factura'
          } else if (normalizedButtonText === 'ver remision') {
            buttonAction = 'remision'
          } else if (normalizedButtonText === 'estado de cuenta') {
            buttonAction = 'edc'
          }
          break

        case 'interactive':
          const interactiveType = message.interactive?.type
          const interactiveTitle =
            message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || ''
          const interactivePayload = message.interactive?.button_reply?.id || message.interactive?.list_reply?.id || ''
          const interactiveContextId = message.context?.id || null
          const interactiveContextFrom = message.context?.from || null

          text = `Interactive reply: ${interactiveTitle || interactiveType || 'unknown'}`
          mediaData = {
            interactive_type: interactiveType,
            button_text: interactiveTitle,
            button_payload: interactivePayload,
            context_message_id: interactiveContextId,
            context_from: interactiveContextFrom,
          }

          const normalizedInteractiveTitle = normalizeButtonText(interactiveTitle)
          if (interactiveType === 'button_reply') {
            if (normalizedInteractiveTitle === 'ver factura') {
              buttonAction = 'factura'
            } else if (normalizedInteractiveTitle === 'ver remision') {
              buttonAction = 'remision'
            } else if (normalizedInteractiveTitle === 'estado de cuenta') {
              buttonAction = 'edc'
            }
          }
          break

        default:
          text = `${type} message received`
          break
      }

      await insertWhatsAppMessage({
        whatsappMessageId: messageId,
        contactWaId: from,
        contactName,
        messageType: type,
        messageText: text,
        direction: 'incoming',
        messageData: {
          ...message,
          uploaded_media: mediaData,
        },
      })

      // Notify any open SSE clients watching this contact
      emitToContact(from, { type: 'new_message', contactWaId: from })

      if (shouldSendOfficeFallback(type, text)) {
        try {
          const sent = await sendTextReplyToWABA(from, OFFICE_FALLBACK_MESSAGE)
          const sentMessageId = sent?.messages?.[0]?.id

          if (sentMessageId) {
            await insertWhatsAppMessage({
              whatsappMessageId: sentMessageId,
              contactWaId: from,
              contactName,
              messageType: 'text',
              messageText: OFFICE_FALLBACK_MESSAGE,
              direction: 'outgoing',
              messageData: {
                id: sentMessageId,
                to: from,
                type: 'text',
                text: { body: OFFICE_FALLBACK_MESSAGE },
                related_context_message_id: messageId,
              },
            })
          }
        } catch (error) {
          console.error('Failed to send office fallback message:', error)
        }
      }

      if (buttonAction) {
        try {
          await handleButtonReply(message, from, contactName, buttonAction)
        } catch (error) {
          console.error(`Failed to handle ${buttonAction} button reply:`, error)
          try {
            const sent = await sendTextReplyToWABA(from, PDF_GENERATION_ERROR_MESSAGE)
            const sentMessageId = sent?.messages?.[0]?.id
            if (sentMessageId) {
              await insertWhatsAppMessage({
                whatsappMessageId: sentMessageId,
                contactWaId: from,
                contactName,
                messageType: 'text',
                messageText: PDF_GENERATION_ERROR_MESSAGE,
                direction: 'outgoing',
                messageData: {
                  id: sentMessageId,
                  to: from,
                  type: 'text',
                  text: { body: PDF_GENERATION_ERROR_MESSAGE },
                  related_context_message_id: messageId,
                },
              })
            }
          } catch (replyError) {
            console.error('Failed to send PDF error fallback message:', replyError)
          }
        }
      }
    }
  }

  res.status(200).send('Webhook processed')
}

async function sendPdfReply(
  from: string,
  contactName: string,
  contextMessageId: string,
  pdfBuffer: Buffer,
  filename: string,
  caption: string,
  messageText: string,
  extras: Record<string, unknown> = {},
) {
  const mediaUpload = await uploadMediaToWABA(pdfBuffer, filename)
  if (!mediaUpload?.id) {
    console.warn(`${caption} failed: media upload to WABA did not return id`)
    return
  }

  const sent = await sendDocumentMessageToWABA(from, mediaUpload.id, filename, caption)

  const sentMessageId = sent?.messages?.[0]?.id
  if (!sentMessageId) {
    console.warn(`${caption} failed: WABA message send returned no message id`)
    return
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const s3Filename = `whatsapp_${sentMessageId}_${timestamp}.pdf`
  let s3Key = ''

  try {
    s3Key = await uploadFileToS3(pdfBuffer, s3Filename, 'application/pdf', 'whatsapp/')
  } catch (error) {
    console.error(`${caption} warning: failed to upload PDF to S3:`, error)
  }

  await insertWhatsAppMessage({
    whatsappMessageId: sentMessageId,
    contactWaId: from,
    contactName,
    messageType: 'document',
    messageText,
    direction: 'outgoing',
    messageData: {
      id: sentMessageId,
      to: from,
      type: 'document',
      document: {
        id: mediaUpload.id,
        filename,
        caption,
      },
      related_context_message_id: contextMessageId,
      ...extras,
      uploaded_media: {
        s3_key: s3Key,
        media_id: mediaUpload.id,
        mime_type: 'application/pdf',
      },
    },
  })
}

async function handleButtonReply(replayMessage: any, from: string, contactName: string, action: ButtonAction) {
  const contextMessageId = replayMessage?.context?.id

  if (!contextMessageId) {
    console.warn(`${action} ignored: missing context message id`)
    return
  }

  const originalMessageRows = await selectQuery(
    `
      SELECT whatsapp_message_id, contact_wa_id, message_text, message_data, docto_id, rfc_id
      FROM whatsapp_messages
      WHERE whatsapp_message_id = $1
      LIMIT 1
    `,
    [contextMessageId],
  )

  const originalMessage = originalMessageRows?.[0]

  if (!originalMessage) {
    console.warn(`${action} ignored: original message not found in DB`)
    return
  }

  // if (action === 'edc') {
  //   const directRfcId = Number(originalMessage?.rfc_id)
  //   const rfcId = Number.isInteger(directRfcId) && directRfcId > 0 ? directRfcId : extractRfcId(originalMessage)

  //   if (!rfcId) {
  //     console.warn('Estado de Cuenta ignored: rfc_id not found')
  //     return
  //   }

  //   const data = await queryCustomerDataPdf(rfcId)
  //   if (!data?.customerInfo || !Array.isArray(data.customerDebt)) {
  //     console.warn(`Estado de Cuenta ignored: customer ${rfcId} not found`)
  //     return
  //   }

  //   const pdfBuffer = await generateEdcPdf(data)
  //   const safeCustomerName = sanitizeFilenamePart(data.customerInfo?.nombre_fiscal || `RFC_${rfcId}`)
  //   const filename = `Estado_de_Cuenta_${safeCustomerName}.pdf`

  //   await sendPdfReply(
  //     from,
  //     contactName,
  //     contextMessageId,
  //     pdfBuffer,
  //     filename,
  //     `Estado de cuenta ${data.customerInfo?.nombre_fiscal || ''}`,
  //     'Estado de cuenta enviado',
  //     { rfc_id: rfcId },
  //   )
  //   return
  // }

  // const directDoctoId = Number(originalMessage?.docto_id)
  // const doctoId =
  //   Number.isInteger(directDoctoId) && directDoctoId > 0 ? directDoctoId : extractInvoiceId(originalMessage)

  // if (!doctoId) {
  //   console.warn(`${action} ignored: docto_id not found`)
  //   return
  // }

  // if (action === 'remision') {
  //   const { header, items } = await queryRemisionInfo(doctoId)
  //   if (!header) {
  //     console.warn(`Ver Remision ignored: remision ${doctoId} not found`)
  //     return
  //   }

  //   const pdfBuffer = await generateRemisionPdf({
  //     folio: header.folio,
  //     fecha: header.fecha,
  //     fecha_vencimiento: header.fecha_vencimiento,
  //     nombre_cliente: header.nombre_cliente,
  //     nombre_fiscal: header.nombre_fiscal,
  //     calle: header.calle,
  //     telefono1: header.telefono1,
  //     cobrador: header.cobrador,
  //     currency_code: header.currency_code,
  //     importe_neto: header.importe_neto,
  //     total_impuestos: header.total_impuestos,
  //     items,
  //   })

  //   const filename = `Remision_${sanitizeFilenamePart(header.folio)}.pdf`
  //   await sendPdfReply(
  //     from,
  //     contactName,
  //     contextMessageId,
  //     pdfBuffer,
  //     filename,
  //     `Remisión ${header.folio}`,
  //     `Remisión enviada: ${header.folio}`,
  //     { docto_ve_id: doctoId },
  //   )
  //   return
  // }

  // const { customerData, documentData, xmlData } = await queryInvoiceInfo(doctoId)
  // if (!customerData || !documentData || !xmlData) {
  //   console.warn(`Ver Factura ignored: invoice ${doctoId} has incomplete data or missing XML`)
  //   return
  // }

  // const pdfBase64 = await generateInvoicePdf({
  //   doctoVe: customerData,
  //   doctoVeDet: documentData,
  //   xmlData,
  // })

  // if (!pdfBase64) {
  //   return
  // }

  // const pdfBuffer = Buffer.from(pdfBase64, 'base64')
  // const filename = `Factura_${sanitizeFilenamePart(customerData.folio)}.pdf`

  //   await sendPdfReply(
  //     from,
  //     contactName,
  //     contextMessageId,
  //     pdfBuffer,
  //     filename,
  //     `Factura ${customerData.folio}`,
  //     `Factura enviada: ${customerData.folio}`,
  //     { docto_ve_id: doctoId },
  //   )
  // }

  function extractInvoiceId(originalMessage: any): number | null {
    let messageData = originalMessage?.message_data

    if (typeof messageData === 'string') {
      try {
        messageData = JSON.parse(messageData)
      } catch {
        messageData = null
      }
    }

    const directCandidates = [
      messageData?.docto_ve_id,
      messageData?.docto_id,
      messageData?.invoice_id,
      messageData?.invoiceId,
      messageData?.document_id,
    ]

    for (const candidate of directCandidates) {
      const parsed = Number(candidate)
      if (Number.isInteger(parsed) && parsed > 0) {
        return parsed
      }
    }

    const payloadCandidates = [messageData?.button?.payload, messageData?.payload]

    for (const payload of payloadCandidates) {
      if (!payload || typeof payload !== 'string') {
        continue
      }

      const numericMatch = payload.match(/\d+/)
      if (numericMatch) {
        const parsed = Number(numericMatch[0])
        if (Number.isInteger(parsed) && parsed > 0) {
          return parsed
        }
      }
    }

    return null
  }

  function extractRfcId(originalMessage: any): number | null {
    let messageData = originalMessage?.message_data

    if (typeof messageData === 'string') {
      try {
        messageData = JSON.parse(messageData)
      } catch {
        messageData = null
      }
    }

    const directCandidates = [
      originalMessage?.rfc_id,
      messageData?.rfc_id,
      messageData?.rfcId,
      messageData?.customer_id,
      messageData?.customerId,
    ]

    for (const candidate of directCandidates) {
      const parsed = Number(candidate)
      if (Number.isInteger(parsed) && parsed > 0) {
        return parsed
      }
    }

    return null
  }
}
