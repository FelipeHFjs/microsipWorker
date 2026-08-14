// // const { storeSentData, queryCustomerData } = require('../models/edcData');
// import queryCustomerDataPdf, { queryPendingNotifications } from '../models/sales/queryCustomerDataPdf'
// import insertEdcNotification from '../models/sales/insertEdcNotification'
// import { sendEmailWithAttachments } from '../config/mailConfig'
// import generateEdcPdf from './generateEdcPdf'
// import { uploandMediaToWABA, sendMediaMessageToWABA } from '../config/whatsAppBusinessApi'
// import { insertMessage } from '../models/messages'
// import { uploadFileToS3 } from '../config/awsConfig'

// export default async function enviarEdcPdf(
//   customerId: number,
//   contact: string,
//   userName: string = 'admin',
//   method: 'whatsapp' | 'email' = 'whatsapp',
// ) {
//   if (!contact) {
//     await insertEdcNotification(userName, customerId, '', 'error', method)
//     return { success: false, message: 'Contacto no proporcionado' }
//   }

//   try {
//     const data = await queryCustomerDataPdf(customerId)
//     if (!data) {
//       return { success: false, message: 'No se encontraron datos del cliente' }
//     }

//     const pdfBuffer = await generateEdcPdf(data)
//     if (!pdfBuffer) {
//       return { success: false, message: 'No se pudo generar el PDF' }
//     }

//     if (method === 'whatsapp') {
//       const cleanNumber = contact.replace(/\D/g, '')

//       // Upload to WABA
//       const mediaUpload = await uploandMediaToWABA(pdfBuffer, `EstadoDeCuenta.pdf`)

//       if (mediaUpload.id) {
//         // Send message with only customer name to WhatsApp
//         const sent = await sendMediaMessageToWABA(
//           cleanNumber,
//           mediaUpload.id,
//           `EstadoDeCuenta.pdf`,
//           data.customerInfo.nombre_fiscal, // Send only name to WhatsApp
//         )

//         const messageId = sent?.messages?.[0]?.id || null

//         // Upload PDF to S3
//         const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
//         const fileName = `whatsapp_${messageId}_${timestamp}.pdf`
//         let s3Key = ''

//         try {
//           s3Key = await uploadFileToS3(pdfBuffer, fileName, 'application/pdf', 'whatsapp/')
//         } catch (error) {
//           console.error('Error uploading PDF to S3:', error)
//         }

//         // Build message_data object similar to incoming messages
//         const timeStamp = Math.floor(Date.now() / 1000).toString()

//         const messageData = {
//           id: messageId,
//           to: `521${cleanNumber}`,
//           type: 'document',
//           document: {
//             id: mediaUpload.id,
//             filename: `EstadoDeCuenta${timeStamp}.pdf`,
//             mime_type: 'application/pdf',
//           },
//           timestamp: timeStamp,
//           uploaded_media: {
//             s3_key: s3Key,
//             media_id: mediaUpload.id,
//             mime_type: 'application/pdf',
//           },
//         }

//         // Full message text for database only
//         const messageText = `Hola ${data.customerInfo.nombre_fiscal} Tu estado de cuenta solicitado esta disponible`

//         // Insert message with full message text in database
//         await insertMessage(
//           messageId,
//           `521${cleanNumber}`,
//           data.customerInfo.nombre_fiscal,
//           'document',
//           messageText, // Store full message in database
//           'outgoing',
//           messageData,
//         )

//         await insertEdcNotification(
//           userName,
//           customerId,
//           cleanNumber,
//           messageId ? 'enviado' : 'error',
//           method,
//           s3Key ? 'Enviado via WABA y guardado en S3' : 'Enviado via WABA',
//           messageId,
//           mediaUpload.id,
//         )

//         return {
//           success: messageId ? true : false,
//           message: messageId
//             ? 'Estado de cuenta enviado por WhatsApp'
//             : 'Error al enviar Estado de cuenta por WhatsApp',
//         }
//       }

//       return { success: false, message: 'Error al subir el archivo a WABA' }
//     } else if (method === 'email') {
//       // Send by Email
//       const email = contact || data.customerInfo.email
//       if (!email) {
//         await insertEdcNotification(userName, customerId, '', 'error', method)
//         return { success: false, message: 'Correo electrónico no disponible' }
//       }

//       const subject = `Estado de Cuenta disponible - ${data.customerInfo.nombre_fiscal}`
//       const text = [
//         `Hola ${data.customerInfo.nombre_fiscal},`,
//         '',
//         'Te compartimos tu estado de cuenta solicitado en el archivo adjunto.',
//         '',
//         'Gracias por tu preferencia.',
//         'Semillas Agrozona Cuauhtemoc',
//       ].join('\n')
//       const html = `
//         <div style="font-family: Arial, sans-serif; font-size: 14px; color: #1f2937; line-height: 1.6;">
//           <p>Hola <strong>${data.customerInfo.nombre_fiscal}</strong>,</p>
//           <p>Te compartimos tu estado de cuenta solicitado en el archivo adjunto.</p>
//           <p style="margin-top: 20px;">Gracias por tu preferencia.<br />Semillas Agrozona Cuauhtemoc</p>
//         </div>
//       `

//       await sendEmailWithAttachments(email, subject, text, html, [
//         {
//           filename: `Estado de Cuenta ${data.customerInfo.nombre_fiscal}.pdf`,
//           content: pdfBuffer,
//           encoding: 'base64',
//         },
//       ])

//       await insertEdcNotification(userName, customerId, email, 'enviado', method)

//       return { success: true, message: 'Estado de Cuenta enviado por correo' }
//     }

//     return { success: false, message: 'Método no soportado' }
//   } catch (error) {
//     console.error(`Error sending EDC via ${method}:`, error)
//     await insertEdcNotification(userName, customerId, contact, 'error', method)
//     return {
//       success: false,
//       message: 'Error al enviar Estado de Cuenta',
//       error,
//     }
//   }
// }

// export async function sendPendingEdcs() {
//   const pendingNotifications = await queryPendingNotifications()

//   for (const notification of pendingNotifications) {
//     const { rfc_id, telefono1, email } = notification
//     await sendEdcHelper(rfc_id, telefono1, 'admin', 'whatsapp')
//     if (email) {
//       await sendEdcHelper(rfc_id, email, 'admin', 'email')
//     }
//   }
// }

// // run only if called directly, not when imported as a module
// if (require.main === module) {
//   sendPendingEdcs()
//     .then(() => {
//       process.exit(0)
//     })
//     .catch((error) => {
//       console.error('Error en el proceso de envío de EDCs pendientes:', error)
//       process.exit(1)
//     })
// }
