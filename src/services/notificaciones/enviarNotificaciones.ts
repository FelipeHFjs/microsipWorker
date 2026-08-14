import moment from 'moment'

import {
  queryNotificacionesPendientes,
  queryTemplateName,
  queryActualizarEstatus,
} from '../../models/notificacionesPendientes.js'
import { sendWhatsAppTemplate } from '../../config/wabaConfig.js'
import { insertWhatsAppMessage } from '../../models/whatsApp.js'

interface PendingDocument {
  doctoVeId: number
  clienteId: number
  nombreCliente: string
  nombreDocto: string
  sistemaOrigen: string
  telefono1: string
  folio: string
  fecha: Date
  tipoDocto: string
  cfdiCertificado: string
  estatus: string
  fechaVencimiento?: Date
  importeTotal: number
  moneda: string
}

const MAX_CUSTOMER_NAME_LENGTH = 51

export async function enviarNotificacionesDoctos(): Promise<void> {
  console.log(`${new Date().toISOString()} - Starting enviarNotificacionesDoctos`)
  try {
    const docs = await queryNotificacionesPendientes()

    if (docs.length === 0) {
      return
    }

    for (const doc of docs) {
      await processSingleDocument(doc)
    }
  } catch (error) {
    console.error('Error in enviarNotificacionesDoctos:', error)
    throw error
  }
}

async function processSingleDocument(doc: PendingDocument): Promise<void> {
  const logPrefix = `[${doc.folio}] ${doc.nombreCliente}:`

  try {
    if (await shouldSkipDocument(doc, logPrefix)) {
      return
    }

    const phoneNumber = cleanPhonenumber(doc.telefono1)

    await sendNotificationMessage(doc, phoneNumber)

    console.log(`${logPrefix} Message sent successfully to ${phoneNumber}`)
  } catch (error) {
    console.error(`${logPrefix} Error processing document:`, error)

    // Mark with error status to prevent retrying immediately
    await queryActualizarEstatus(doc.doctoVeId, 'error')
  }
}

async function shouldSkipDocument(doc: PendingDocument, logPrefix: string): Promise<boolean> {
  if (doc.estatus === 'C') {
    await queryActualizarEstatus(doc.doctoVeId, 'cancelado')
    return true
  }

  if (['F', 'D'].includes(doc.tipoDocto) && doc.cfdiCertificado !== 'S') {
    return true
  }

  if (!doc.telefono1) {
    await queryActualizarEstatus(doc.doctoVeId, 'sin número')
    console.log(`${logPrefix} No phone number`)
    return true
  }

  return false
}

async function sendNotificationMessage(doc: PendingDocument, phoneNumber: string): Promise<void> {
  const { components, templateName } = await getTemplateConfig(doc)

  const response = await sendWhatsAppTemplate({
    to: phoneNumber,
    templateName,
    components,
  })
  await saveMessageRecord(doc, phoneNumber, response)
  await queryActualizarEstatus(doc.doctoVeId, 'enviado', phoneNumber, response?.messages?.[0]?.id)
}

async function getTemplateConfig(doc: PendingDocument): Promise<{ components: any[]; templateName: string }> {
  const templateName = await queryTemplateName(doc.sistemaOrigen, doc.tipoDocto)

  switch (templateName) {
    case 'fh_docto':
      return { components: buildMessageComponents(doc), templateName: 'fh_docto' }
    default:
      throw new Error(`Unsupported template name: ${templateName}`)
  }
}

function buildMessageComponents(doc: PendingDocument) {
  // Truncate customer name to prevent WhatsApp API errors
  const truncatedCustomerName = truncateCustomerName(doc.nombreCliente)

  return [
    {
      type: 'header',
      parameters: [
        {
          type: 'text',
          text: truncatedCustomerName,
        },
      ],
    },
    {
      type: 'body',
      parameters: [
        {
          type: 'text',
          text: 'Factura', //doc.nombre_docto,
        },
        {
          type: 'text',
          text: doc.folio,
        },
        {
          type: 'text',
          text: moment(doc.fecha).format('YYYY-MM-DD'),
        },
        {
          type: 'text',
          text: doc.fechaVencimiento ? moment(doc.fechaVencimiento).format('YYYY-MM-DD') : 'N/A',
        },
        {
          type: 'text',
          text: formatNumber(doc.importeTotal),
        },
        {
          type: 'text',
          text: doc.moneda,
        },
      ],
    },
  ]
}

function buildFacturaMessageComponent(doc: PendingDocument) {
  // Truncate customer name to prevent WhatsApp API errors
  const truncatedCustomerName = truncateCustomerName(doc.nombreCliente)

  return [
    {
      type: 'header',
      parameters: [
        {
          type: 'text',
          text: truncatedCustomerName,
        },
      ],
    },
    {
      type: 'body',
      parameters: [
        {
          type: 'text',
          text: doc.folio,
        },
        {
          type: 'text',
          text: moment(doc.fecha).format('YYYY-MM-DD'),
        },
        {
          type: 'text',
          text: doc.fechaVencimiento ? moment(doc.fechaVencimiento).format('YYYY-MM-DD') : 'N/A',
        },
        {
          type: 'text',
          text: formatNumber(doc.importeTotal),
        },
        {
          type: 'text',
          text: doc.moneda,
        },
      ],
    },
  ]
}

function buildRemisionMessageComponent(doc: PendingDocument) {
  const truncatedCustomerName = truncateCustomerName(doc.nombreCliente)

  return [
    {
      type: 'header',
      parameters: [
        {
          type: 'text',
          text: truncatedCustomerName,
        },
      ],
    },
    {
      type: 'body',
      parameters: [
        {
          type: 'text',
          text: doc.folio,
        },
        {
          type: 'text',
          text: moment(doc.fecha).format('YYYY-MM-DD'),
        },
        {
          type: 'text',
          text: doc.fechaVencimiento ? moment(doc.fechaVencimiento).format('YYYY-MM-DD') : 'N/A',
        },
        {
          type: 'text',
          text: formatNumber(doc.importeTotal),
        },
        {
          type: 'text',
          text: doc.moneda,
        },
      ],
    },
  ]
}

function truncateCustomerName(customerName: string): string {
  if (customerName.length <= MAX_CUSTOMER_NAME_LENGTH) {
    return customerName
  }

  return customerName.substring(0, MAX_CUSTOMER_NAME_LENGTH - 3) + '...'
}

async function saveMessageRecord(doc: PendingDocument, phoneNumber: string, response: any): Promise<void> {
  await insertWhatsAppMessage({
    whatsappMessageId: response?.messages?.[0]?.id || null,
    contactWaId: `521${phoneNumber}`,
    contactName: doc.nombreCliente,
    messageType: 'template',
    messageText: recreateMessage(doc),
    direction: 'outgoing',
    messageData: { response },
    doctoId: doc.doctoVeId,
    clienteId: doc.clienteId,
  })
}

function recreateMessage(doc: PendingDocument): string {
  const truncatedName = truncateCustomerName(doc.nombreCliente)

  return `Hola ${truncatedName}
Te informamos que tu pedido ya tiene ${doc.nombreDocto} disponible

📄Folio: ${doc.folio}
🗓Fecha: ${moment(doc.fecha).format('DD MMM YYYY')}
🗓Vencimiento: ${doc.fechaVencimiento ? moment(doc.fechaVencimiento).format('DD MMM YYYY') : 'N/A'}
💵Importe: $ ${formatNumber(doc.importeTotal)} ${doc.moneda}

Gracias por tu compra
Semillas Agrozona Cuauhtemoc`
}

function formatNumber(value: number): string {
  if (!isNaN(value) && value !== null) {
    return new Intl.NumberFormat('en', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  } else {
    return '0.00'
  }
}

function cleanPhonenumber(number: string): string {
  const removeCharacters = number.replace(/\D/g, '')
  const tenDigitNumber = removeCharacters.slice(-10)
  return tenDigitNumber
}

// sendDocumentMessage()
