import axios from 'axios'
import dotenv from 'dotenv'
import FormData from 'form-data'

dotenv.config()

interface WhatsAppInvoiceNotification {
  to: string
  templateName: string
  components: any
  languageCode?: string
}

export async function sendWhatsAppTemplate({
  to,
  templateName,
  components,
  languageCode = 'es_MX',
}: WhatsAppInvoiceNotification): Promise<any> {
  const data = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: `52${to}`,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: languageCode,
      },
      components: components,
    },
  }

  const url = `https://graph.facebook.com/${process.env.WABA_VERSION}/${process.env.WABA_PHONE_NUMBER_ID}/messages`

  try {
    const response = await axios.post(url, data, {
      headers: {
        Authorization: `Bearer ${process.env.WABA_BEARER_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })
    return response.data
  } catch (err: any) {
    const status = err?.response?.status
    const body = JSON.stringify(err?.response?.data)
    throw new Error(`Request failed with status code ${status} | URL: ${url} | Body: ${body}`)
  }
}

export async function uploadMediaToWABA(pdfBuffer: Buffer, _filename: string) {
  const form = new FormData()
  form.append('file', pdfBuffer, {
    filename: 'EstadoDeCuenta.pdf',
    contentType: 'application/pdf',
  })
  form.append('type', 'application/pdf')
  form.append('messaging_product', 'whatsapp')

  const upload = await axios.post(
    `https://graph.facebook.com/${process.env.WABA_VERSION}/${process.env.WABA_PHONE_NUMBER_ID}/media`,
    form,
    {
      headers: {
        Authorization: `Bearer ${process.env.WABA_BEARER_TOKEN}`,
        ...form.getHeaders(),
      },
    },
  )

  return upload.data
}

export async function checkWhatsAppContact(phoneNumbers: string[]) {
  const contacts = phoneNumbers.map((number) => `52${number}`)

  const response = await axios.post(
    `https://graph.facebook.com/${process.env.WABA_VERSION}/${process.env.WABA_PHONE_NUMBER_ID}/contacts`,
    {
      messaging_product: 'whatsapp',
      contacts: contacts,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.WABA_BEARER_TOKEN}`,
        'Content-Type': 'application/json',
      },
    },
  )

  return response.data.contacts // Returns array with wa_id for valid WhatsApp numbers
}

export async function sendMediaMessageToWABA(to: string, mediaId: string, filename: string, name: string) {
  const message = {
    messaging_product: 'whatsapp',
    to: `52${to}`,
    type: 'template',
    template: {
      name: 'balance_pdf',
      language: {
        code: 'es_MX',
      },
      components: [
        {
          type: 'header',
          parameters: [
            {
              type: 'document',
              document: {
                id: mediaId,
                filename: filename,
              },
            },
          ],
        },
        {
          type: 'body',
          parameters: [{ type: 'text', text: name }],
        },
      ],
    },
  }

  const response = await axios.post(
    `https://graph.facebook.com/${process.env.WABA_VERSION}/${process.env.WABA_PHONE_NUMBER_ID}/messages`,
    message,
    {
      headers: {
        Authorization: `Bearer ${process.env.WABA_BEARER_TOKEN}`,
      },
    },
  )

  return response.data
}

export async function sendDocumentMessageToWABA(to: string, mediaId: string, filename: string, caption?: string) {
  const message = {
    messaging_product: 'whatsapp',
    to,
    type: 'document',
    document: {
      id: mediaId,
      filename,
      ...(caption ? { caption } : {}),
    },
  }

  const response = await axios.post(
    `https://graph.facebook.com/${process.env.WABA_VERSION}/${process.env.WABA_PHONE_NUMBER_ID}/messages`,
    message,
    {
      headers: {
        Authorization: `Bearer ${process.env.WABA_BEARER_TOKEN}`,
      },
    },
  )

  return response.data
}

export async function downloadWhatsAppMedia(mediaId: string): Promise<{
  buffer: Buffer
  mimeType: string
  filename: string
}> {
  try {
    // Step 1: Get media URL
    const mediaResponse = await axios.get(`https://graph.facebook.com/${process.env.WABA_VERSION}/${mediaId}`, {
      headers: {
        Authorization: `Bearer ${process.env.WABA_BEARER_TOKEN}`,
      },
    })

    const { url, mime_type, file_size } = mediaResponse.data

    // Step 2: Download the actual media file
    const fileResponse = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${process.env.WABA_BEARER_TOKEN}`,
      },
      responseType: 'arraybuffer',
    })

    // Generate filename based on media type
    const extension = mime_type.split('/')[1] || 'bin'
    const filename = `media_${mediaId}.${extension}`

    return {
      buffer: Buffer.from(fileResponse.data),
      mimeType: mime_type,
      filename: filename,
    }
  } catch (error) {
    console.error('Error downloading WhatsApp media:', error)
    throw error
  }
}

/**
 * Send a plain-text reply to an existing conversation.
 * Only valid within the 24-hour customer service window.
 */
export async function sendTextReplyToWABA(to: string, text: string): Promise<{ messages: { id: string }[] }> {
  const response = await axios.post(
    `https://graph.facebook.com/${process.env.WABA_VERSION}/${process.env.WABA_PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: text, preview_url: false },
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.WABA_BEARER_TOKEN}`,
        'Content-Type': 'application/json',
      },
    },
  )
  return response.data
}
