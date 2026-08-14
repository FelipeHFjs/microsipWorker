import PDFDocument from 'pdfkit'
import * as QRCode from 'qrcode'
import { formatNumber } from '../formatting.js'
import numberToWords from '../numberToWords.js'
import { xmlToJson } from '../xmlToJson.js'

type CatalogEntry = {
  descripcion: string
}

type DoctoVe = {
  calle?: string | null
  telefono1: string
  cobrador: string
  fecha?: string | Date
  fecha_vencimiento?: string | Date
  dscto_importe: number
  importe_neto: number
  total_impuestos: number
}

type DoctoVeDetItem = {
  unidades: number
  precio_unitario: number
  pctje_dscto: number
  pctje_impuesto: number
  clave_sat: string
  unidad_venta: string
  nombre_articulo: string
  peso_embarque: string | number
  tipo_producto: string
  nombre_linea: string
  ingrediente_activo: string
}

type InvoiceData = {
  doctoVe: DoctoVe
  doctoVeDet: DoctoVeDetItem[]
  xmlData: string
  signedBy?: string | null
  signedAt?: Date | null
  signatureImage?: Buffer | null
}

import { formaDePago, metodoDePago, usoCfdi, impuestos } from '../catalog.js'

function formatDate(value?: string | Date | null) {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

function formatSingleLine(value?: string | null) {
  return String(value ?? '')
    .replace(/\r\n/g, ' ')
    .trim()
}

export async function generateInvoicePdf(data: InvoiceData): Promise<string> {
  return new Promise(async (resolve, reject) => {
    const { doctoVe, doctoVeDet, xmlData, signedBy, signedAt, signatureImage } = data

    const jsonXml = await xmlToJson(xmlData)
    const {
      'cfdi:Comprobante': {
        '@_Version': version,
        '@_Serie': serie,
        '@_Folio': folio,
        '@_Fecha': fecha,
        '@_Sello': sello,
        '@_FormaPago': formaPago,
        '@_NoCertificado': noCertificado,
        '@_Certificado': certificado,
        '@_CondicionesDePago': condicionesDePago,
        '@_SubTotal': subTotal,
        '@_Moneda': moneda,
        '@_Total': total,
        '@_TipoDeComprobante': tipoDeComprobante,
        '@_Exportacion': exportacion,
        '@_MetodoPago': metodoPago,
        '@_LugarExpedicion': lugarExpedicion,
        'cfdi:Emisor': { '@_Rfc': emisorRfc, '@_Nombre': emisorNombre, '@_RegimenFiscal': emisorRegimenFiscal },
        'cfdi:Receptor': {
          '@_Rfc': receptorRfc,
          '@_Nombre': receptorNombre,
          '@_DomicilioFiscalReceptor': receptorDomicilioFiscal,
          '@_RegimenFiscalReceptor': receptorRegimenFiscal,
          '@_UsoCFDI': usoCFDI,
        },
        'cfdi:Impuestos': {
          '@_TotalImpuestosTrasladados': totalImpuestosTrasladados,
          'cfdi:Traslados': traslados,
        } = {},
        'cfdi:Complemento': {
          'tfd:TimbreFiscalDigital': {
            '@_Version': versionTimbre,
            '@_UUID': uuid,
            '@_SelloSAT': selloSat,
            '@_NoCertificadoSAT': noCertificadoSat,
            '@_SelloCFD': selloCfd,
            '@_FechaTimbrado': fechaTimbrado,
            '@_HoraTimbrado': horaTimbrado,
            '@_CertificadoSAT': certificadoSat,
            '@_Timbre': timbre,
          },
        },
      },
    } = jsonXml

    const doc = new PDFDocument({ size: 'letter' })
    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))

    doc.on('end', () => {
      const resultBuffer = Buffer.concat(chunks)
      const base64PDF = resultBuffer.toString('base64')
      resolve(base64PDF)
    })

    doc.on('error', (err) => reject(err))

    const issuer = () => {
      doc
        .font('Helvetica')
        .fontSize(12)
        .text(`SEMILLAS AGROZONA CUAUHTEMOC`, 160, 35)
        .text(`Factura`, 480, 35, {
          align: 'center',
          width: 62,
        })
        .text(`${serie}${folio}`, 480, 50, {
          align: 'center',
          width: 62,
        })
        .text(`${fecha}`, 480, 65, {
          align: 'center',
          width: 62,
        })
        .text(`RFC: SAC100224RM9`, 160, 48)
        .image('./src/utils/img/logo.png', 50, 45, { width: 100 })
        .fontSize(10)
        .text(`Campo 101 Km 47+900 Carr a Bachiniva CP31610 (625-584-1196)`, 160, 60)
        .text(`Km 6+900 Carr a Alvaro Obregon CP3107 (625-587-7419)`, 160, 72)
        .text(`Lote 48 El Trebol Ojinaga CP32886 (626-499-1718)`, 160, 84)
    }

    const rectangle = (
      left: number,
      top: number,
      width: number,
      height: number,
      fillColor: string,
      textColor: string,
      text: string,
    ): void => {
      doc.font('Helvetica-Bold').fontSize(10)

      doc.fillColor(fillColor).strokeColor('white').lineWidth(0.5).rect(left, top, width, height).fillAndStroke()

      doc.fillColor(textColor).text(text, left, top + 2, { width: width, align: 'center' })

      doc.font('Helvetica')
    }

    const receiver = () => {
      rectangle(45, 115, 310, 12, 'white', 'black', 'Cliente')

      doc
        .fontSize(9)
        .fillColor('black')
        .fontSize(10)
        .text(`Nombre: ${receptorNombre}`, 48, 130)
        .text(`RFC: ${receptorRfc}`, 48, 142)
        .text(`Calle: ${formatSingleLine(doctoVe.calle)}`, 48, 156)
        .text(`CP:${receptorDomicilioFiscal} Teléfono: ${doctoVe.telefono1}`, 48, 168)
    }

    const background = () => {
      doc.image('./src/utils/logo.png', 55, 250, {
        align: 'center',
        width: 475,
      })

      doc.fillColor('white').opacity(0.75).rect(55, 250, 475, 300).fill()

      doc.opacity(1)
    }

    const saleDetails = () => {
      const dueDate = formatDate(doctoVe.fecha_vencimiento || doctoVe.fecha || fecha)

      doc
        .fontSize(10)
        .fillColor('black')
        .text(`Orden de Compra: `, 375, 130)
        .text(`Condiciones: ${condicionesDePago}`, 375, 142)
        .text(`Representante: ${doctoVe.cobrador}`, 375, 156)
        .text(`Vencimiento: ${dueDate}`, 375, 168)
        .text(`Via de Embarque: `, 375, 180)
    }

    const itemHeader = () => {
      rectangle(45, 195, 50, 12, 'white', 'black', 'Clave Sat')
      rectangle(95, 195, 200, 12, 'white', 'black', 'Description')
      rectangle(295, 195, 35, 12, 'white', 'black', 'U.med')
      rectangle(330, 195, 50, 12, 'white', 'black', 'Units')
      rectangle(380, 195, 40, 12, 'white', 'black', 'Precio')
      rectangle(420, 195, 40, 12, 'white', 'black', 'Iva IEPS')
      rectangle(460, 195, 40, 12, 'white', 'black', 'Descto')
      rectangle(500, 195, 50, 12, 'white', 'black', 'Importe')

      doc.moveTo(50, 208).lineTo(550, 208).lineWidth(1.5).strokeColor('gray').stroke()
    }

    issuer()
    receiver()
    background()
    saleDetails()
    itemHeader()

    function addNewPage() {
      doc.addPage()
      issuer()
      receiver()
      background()
      saleDetails()
    }

    let currentY = 212

    let subtotal = 0
    let discounts = 0

    doctoVeDet.forEach((item: DoctoVeDetItem) => {
      if (currentY >= 710) {
        addNewPage()
        itemHeader()
        currentY = 212
      }

      subtotal += item.unidades * item.precio_unitario
      discounts += ((item.unidades * item.pctje_dscto) / 100) * item.precio_unitario

      doc
        .fontSize(9)
        .fillColor('black')
        .text(item.clave_sat, 50, currentY)
        .text(item.unidad_venta, 295, currentY)
        .text(String(item.unidades), 330, currentY, {
          width: 35,
          align: 'right',
        })
        .text(formatNumber(item.precio_unitario), 365, currentY, {
          width: 55,
          align: 'right',
        })
        .text(String(item.pctje_impuesto), 420, currentY, {
          width: 40,
          align: 'right',
        })
        .text(item.pctje_dscto + '%', 465, currentY, {
          width: 20,
          align: 'right',
        })
        .text(formatNumber(item.unidades * item.precio_unitario), 485, currentY, {
          width: 65,
          align: 'right',
        })

      const textHeight = doc
        .fontSize(9)
        .text(item.nombre_articulo, 100, currentY, {
          width: 190,
          align: 'left',
        })
        .heightOfString(item.nombre_articulo, { width: 190 })

      doc
        .fontSize(8)
        .fillColor('gray')
        .text(
          `${item.peso_embarque}KGM / ${item.tipo_producto} / ${item.nombre_linea} / ${item.ingrediente_activo}`,
          50,
          currentY + textHeight + 2,
        )

      doc
        .moveTo(50, currentY + textHeight + 12)
        .lineTo(550, currentY + textHeight + 12)
        .lineWidth(1.5)
        .strokeColor('darkgray')
        .stroke()

      currentY += textHeight + 15
    })

    currentY += 10
    if (currentY >= 700) {
      addNewPage()
      currentY = 212
    }
    doc
      .fontSize(7)
      .fillColor('black')
      .font('Helvetica-Bold')
      .text('Cadena original del complemento de certificación digital del SAT:', 50, currentY)
      .fontSize(6)
      .font('Helvetica')
      .text(`||1.1|${uuid}|${fecha}|SCD110105654|${sello}||`, 50, currentY + 10, {
        width: doc.page.width - 100,
        continued: false,
      })

    currentY += 45
    if (currentY >= 700) {
      addNewPage()
      currentY = 212
    }
    doc
      .fontSize(7)
      .font('Helvetica-Bold')
      .text('Sello digital del CFDI:', 50, currentY)
      .fontSize(6)
      .font('Helvetica')
      .text(selloCfd, 50, currentY + 10, {
        width: doc.page.width - 100,
        continued: false,
      })

    currentY += 45
    if (currentY >= 700) {
      addNewPage()
      currentY = 212
    }
    doc
      .fontSize(7)
      .font('Helvetica-Bold')
      .text('Sello digital del SAT:', 50, currentY)
      .fontSize(6)
      .font('Helvetica')
      .text(selloSat, 50, currentY + 10, {
        width: doc.page.width - 100,
        continued: false,
      })

    currentY += 35
    if (currentY >= 680) {
      addNewPage()
      currentY = 212
    }

    doc
      .fontSize(7)
      .font('Helvetica-Bold')
      .image('./src/utils/img/BBVA.png', 105, currentY, { height: 16 })
      .text('Cuenta MXN 0186663664', 78, currentY + 20, {
        width: 105,
        align: 'center',
      })
      .text('Clabe: 012158001866636641', 78, currentY + 30, {
        width: 105,
        align: 'center',
      })
      .image('./src/utils/img/Santander.png', 200, currentY, { height: 16 })
      .text('Cuenta MXN 65503823339', 195, currentY + 20, {
        width: 105,
        align: 'center',
      })
      .text('Clabe: 014158655038233394', 195, currentY + 30, {
        width: 105,
        align: 'center',
      })
      .image('./src/utils/img/Ucacsa.png', 340, currentY, { height: 20 })
      .text('Cuenta MXN 0186663664', 320, currentY + 20, {
        width: 105,
        align: 'center',
      })
      .text('Clabe: 646158274700015958', 320, currentY + 30, {
        width: 105,
        align: 'center',
      })
      .image('./src/utils/img/BBVA.png', 460, currentY, { height: 16 })
      .text('Cuenta ', 445, currentY + 20, {
        continued: true,
      })
      .fillColor('blue')
      .text('USD', {
        continued: true,
      })
      .fillColor('black')
      .text(' 0173413861')
      .text('Clabe: 012150001734138619', 440, currentY + 30, {
        width: 105,
      })

    currentY += 45
    if (currentY >= 590) {
      addNewPage()
      currentY = 212
    }
    doc
      .fontSize(8)
      .font('Helvetica')
      .text(
        `Fecha de vencimiento: ${formatDate(doctoVe.fecha_vencimiento || doctoVe.fecha || fecha)}`,
        150,
        currentY + 48,
      )
      .fontSize(8)
      .font('Helvetica')
      .text(`Por este pagare me (nos) comprometo (emos) a pagar incondicionalmente a la orden de: `, 150, currentY, {
        width: 300,
        align: 'left',
        continued: true,
      })
      .font('Helvetica-Bold')
      .text(`SEMILLAS AGROZONA CUAUHTEMOC S.A. DE C.V.`, { continued: true })
      .font('Helvetica')
      .text(' la cantidad de: ', { continued: true })
      .font('Helvetica-Bold')
      .text(numberToWords(total, moneda), {
        continued: true,
      })
      .font('Helvetica')
      .text(
        ` importe de mercancias recibidas a mi (nuestra) entera satisfaccion, de no cubrirse a su vencimiento (${formatDate(doctoVe.fecha_vencimiento || doctoVe.fecha || fecha)}) causara un interes moratorio a la razon de un 5% mensual.`,
        { continued: false },
      )

    const formaDePagoDescripcion = formaDePago.find((item) => item.c_FormaPago === parseInt(formaPago))
    const metodoDePagoDescripcion = metodoDePago.find((item) => item.c_MetodoPago === metodoPago)
    const usoCfdiDescripcion = usoCfdi.find((item) => item.c_UsoCFDI === usoCFDI)

    doc
      .text(`Metodo de Pago: ${metodoPago} ${metodoDePagoDescripcion?.descripcion ?? ''}`, 150, currentY + 68)
      .text(`Forma de Pago: ${formaPago} ${formaDePagoDescripcion?.descripcion ?? ''}`, 150, currentY + 76)
      .text(`Uso de CFDI: ${usoCFDI} ${usoCfdiDescripcion?.descripcion ?? ''}`, 150, currentY + 84)

    let trasladosArray: unknown = traslados ? (traslados as { 'cfdi:Traslado': unknown })['cfdi:Traslado'] : []

    if (!Array.isArray(trasladosArray)) {
      trasladosArray = [trasladosArray]
    }

    let totalsY = currentY

    doc
      .fontSize(8)
      .font('Helvetica-Bold')
      .text('Subtotal:', 450, totalsY)
      .text(formatNumber(subtotal), 480, totalsY, { align: 'right' })
    totalsY += 10
    if (discounts) {
      doc.text('Descuento:', 450, totalsY).text(formatNumber(discounts), 480, totalsY, { align: 'right' })
      totalsY += 10
    }
    if (doctoVe.dscto_importe) {
      doc.text('Des. Extra:', 450, totalsY).text(formatNumber(doctoVe.dscto_importe), 480, totalsY, {
        align: 'right',
      })
      totalsY += 10
    }
    doc.text('Importe:', 450, totalsY).text(formatNumber(doctoVe.importe_neto), 480, totalsY, {
      align: 'right',
    })
    totalsY += 10
    doc.text('Impuestos:', 450, totalsY).text(formatNumber(doctoVe.total_impuestos), 480, totalsY, {
      align: 'right',
    })
    totalsY += 10
    doc.text('Total:', 450, totalsY).text(formatNumber(total), 480, totalsY, {
      align: 'right',
    })

    QRCode.toDataURL(
      `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?&id=${uuid}&re=${emisorRfc}&rr=${receptorRfc}&tt=${total}&fe=${sello.slice(
        -8,
      )}`,
      {
        errorCorrectionLevel: 'H',
        margin: 0,
      },
    )
      .then((url: string) => {
        const base64Data = url.replace(/^data:image\/png;base64,/, '')

        doc.image(Buffer.from(base64Data, 'base64'), 50, currentY, {
          fit: [95, 95],
          align: 'center',
          valign: 'center',
        })

        if (signedBy) {
          const sigY = Math.min(currentY + 105, doc.page.height - 100)
          doc
            .moveTo(50, sigY)
            .lineTo(doc.page.width - 50, sigY)
            .lineWidth(0.5)
            .strokeColor('#9ca3af')
            .stroke()

          doc
            .fillColor('#475569')
            .font('Helvetica-Bold')
            .fontSize(8)
            .text('FIRMADO POR:', 320, sigY + 6)
            .font('Helvetica')
            .fontSize(10)
            .fillColor('#111827')
            .text(signedBy, 320, sigY + 18)

          if (signedAt) {
            const formattedDate = new Intl.DateTimeFormat('es-MX', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }).format(signedAt)
            doc
              .fillColor('#475569')
              .font('Helvetica-Bold')
              .fontSize(8)
              .text('FECHA DE FIRMA:', 420, sigY + 6)
              .font('Helvetica')
              .fontSize(10)
              .fillColor('#111827')
              .text(formattedDate, 420, sigY + 18)
          }

          if (signatureImage) {
            try {
              doc.image(signatureImage, 400, sigY - 50, { fit: [200, 50] })
            } catch {
              // signature image failed to render, skip
            }
          }
        }

        doc.end()
      })
      .catch((err: unknown) => {
        console.error('Failed to generate QR code:', err)
        doc.end()
      })
  })
}
