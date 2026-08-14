import PDFDocument from 'pdfkit'
import { formatNumber } from '../formatting.js'
import numberToWords from '../numberToWords.js'

interface RemisionItem {
  nombre_articulo: string
  unidades: number
  precio_unitario: number
  pctje_dscto: number
  unidad_venta?: string
  peso_embarque?: string | number
  tipo_producto?: string
  nombre_linea?: string
  ingrediente_activo?: string
}

interface RemisionData {
  folio: string
  fecha: string
  fecha_vencimiento?: string | Date
  nombre_cliente: string
  nombre_fiscal: string
  calle?: string
  telefono1?: string
  cobrador?: string
  currency_code?: string
  importe_neto: number
  total_impuestos: number
  dscto_importe?: number
  items: RemisionItem[]
  signedBy?: string | null
  signedAt?: Date | null
  signatureImage?: Buffer | null
}

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

export async function generateRemisionPdf(data: RemisionData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'letter', margin: 50 })
    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // --- Header ---
    try {
      doc.image('./src/utils/img/logo.png', 50, 40, { width: 90 })
    } catch {
      // logo not found, skip
    }

    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .fillColor('#111827')
      .text('SEMILLAS AGROZONA CUAUHTEMOC', 155, 42, { width: 300 })

    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#6b7280')
      .text('RFC: SAC100224RM9', 155, 60)
      .text('Campo 101 Km 47+900 Carr a Bachiniva CP31610 (625-584-1196)', 155, 72)
      .text('Km 6+900 Carr a Alvaro Obregon CP3107 (625-587-7419)', 155, 84)

    // Top-right: Remision label + folio
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#1e40af')
      .text('REMISIÓN', 460, 42, { width: 90, align: 'center' })
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#111827')
      .text(data.folio, 460, 57, { width: 90, align: 'center' })
      .fontSize(9)
      .fillColor('#6b7280')
      .text(formatDate(data.fecha), 460, 72, { width: 90, align: 'center' })
      .text(`Vence: ${formatDate(data.fecha_vencimiento || data.fecha)}`, 420, 86, {
        width: 130,
        align: 'right',
      })

    // Divider
    doc.moveTo(50, 105).lineTo(562, 105).lineWidth(1).strokeColor('#d1d5db').stroke()

    // --- Customer info ---
    let y = 115

    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#475569')
      .text('CLIENTE', 50, y)
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#111827')
      .text(data.nombre_fiscal || data.nombre_cliente, 50, y + 12, {
        width: 260,
      })

    if (data.calle) {
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#6b7280')
        .text(data.calle, 50, y + 26, { width: 260 })
    }
    if (data.telefono1) {
      doc.text(`Tel: ${data.telefono1}`, 50, y + 50)
    }

    if (data.cobrador) {
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#475569')
        .text('REPRESENTANTE', 330, y)
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#111827')
        .text(data.cobrador, 330, y + 12)
    }

    // Divider
    y = 180
    doc.moveTo(50, y).lineTo(562, y).lineWidth(0.5).strokeColor('#e2e8f0').stroke()

    // --- Table header ---
    y += 8
    const col = {
      desc: 50,
      unit: 280,
      qty: 330,
      price: 385,
      disc: 435,
      total: 480,
    }

    doc.fillColor('#f1f5f9').rect(50, y, 512, 16).fill()

    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#334155')
      .text('ARTÍCULO', col.desc, y + 4, { width: 225 })
      .text('U.M.', col.unit, y + 4, { width: 45, align: 'center' })
      .text('CANT.', col.qty, y + 4, { width: 50, align: 'right' })
      .text('PRECIO', col.price, y + 4, { width: 45, align: 'right' })
      .text('%DSCTO', col.disc, y + 4, { width: 40, align: 'right' })
      .text('TOTAL', col.total, y + 4, { width: 82, align: 'right' })

    y += 18

    // --- Table rows ---
    let subtotal = 0
    let totalDiscount = 0

    for (const item of data.items) {
      const lineTotal = item.unidades * item.precio_unitario
      const discAmt = (lineTotal * item.pctje_dscto) / 100
      subtotal += lineTotal
      totalDiscount += discAmt

      doc.fontSize(9)
      const nameLines = doc.heightOfString(item.nombre_articulo, {
        width: 225,
      })
      const rowHeight = Math.max(nameLines + 6, 16)

      if (y + rowHeight > 700) {
        doc.addPage()
        y = 50
        // re-draw table header on new page
        doc.fillColor('#f1f5f9').rect(50, y, 512, 16).fill()
        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor('#334155')
          .text('ARTÍCULO', col.desc, y + 4, { width: 225 })
          .text('U.M.', col.unit, y + 4, { width: 45, align: 'center' })
          .text('CANT.', col.qty, y + 4, { width: 50, align: 'right' })
          .text('PRECIO', col.price, y + 4, { width: 45, align: 'right' })
          .text('%DSCTO', col.disc, y + 4, { width: 40, align: 'right' })
          .text('TOTAL', col.total, y + 4, { width: 82, align: 'right' })
        y += 18
      }

      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#111827')
        .text(item.nombre_articulo, col.desc, y, { width: 225 })
        .text(item.unidad_venta || '', col.unit, y, {
          width: 45,
          align: 'center',
        })
        .text(formatNumber(item.unidades), col.qty, y, {
          width: 50,
          align: 'right',
        })
        .text(formatNumber(item.precio_unitario), col.price, y, {
          width: 45,
          align: 'right',
        })
        .text(`${item.pctje_dscto}%`, col.disc, y, {
          width: 40,
          align: 'right',
        })
        .text(formatNumber(lineTotal), col.total, y, {
          width: 82,
          align: 'right',
        })

      y += rowHeight

      doc.moveTo(50, y).lineTo(562, y).lineWidth(0.3).strokeColor('#e2e8f0').stroke()

      y += 2
    }

    // --- Totals ---
    y += 10

    const neto = subtotal - totalDiscount

    if (y + 80 > 700) {
      doc.addPage()
      y = 50
    }

    doc.moveTo(50, y).lineTo(562, y).lineWidth(1).strokeColor('#d1d5db').stroke()

    y += 8

    const totalsX = 380
    const valueX = 480

    if (totalDiscount > 0) {
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#475569')
        .text('Importe:', totalsX, y, { width: 95, align: 'right' })
        .font('Helvetica')
        .fillColor('#111827')
        .text(formatNumber(subtotal), valueX, y, { width: 82, align: 'right' })
      y += 14
      doc
        .font('Helvetica-Bold')
        .fillColor('#475569')
        .text('Descuento:', totalsX, y, { width: 95, align: 'right' })
        .font('Helvetica')
        .fillColor('#b91c1c')
        .text(`-${formatNumber(totalDiscount)}`, valueX, y, {
          width: 82,
          align: 'right',
        })
      y += 14
    }

    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#475569')
      .text('Subtotal:', totalsX, y, { width: 95, align: 'right' })
      .font('Helvetica')
      .fillColor('#111827')
      .text(formatNumber(neto), valueX, y, { width: 82, align: 'right' })
    y += 14

    doc
      .font('Helvetica-Bold')
      .fillColor('#475569')
      .text('Impuestos:', totalsX, y, { width: 95, align: 'right' })
      .font('Helvetica')
      .fillColor('#111827')
      .text(formatNumber(data.total_impuestos), valueX, y, {
        width: 82,
        align: 'right',
      })
    y += 14

    doc.moveTo(totalsX, y).lineTo(562, y).lineWidth(0.5).strokeColor('#94a3b8').stroke()
    y += 6

    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#0f172a')
      .text('TOTAL:', totalsX, y, { width: 95, align: 'right' })
      .text(`${formatNumber(data.importe_neto + data.total_impuestos)} ${data.currency_code || ''}`, valueX, y, {
        width: 82,
        align: 'right',
      })

    // --- Pagaré ---
    y += 35
    if (y + 70 > 700) {
      doc.addPage()
      y = 50
    }

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#111827')
      .text(`Por este pagare me (nos) comprometo (emos) a pagar incondicionalmente a la orden de: `, 50, y + 10, {
        width: 500,
        align: 'left',
        continued: true,
      })
      .font('Helvetica-Bold')
      .text(`SEMILLAS AGROZONA CUAUHTEMOC S.A. DE C.V.`, { continued: true })
      .font('Helvetica')
      .text(` la cantidad de: `, { continued: true })
      .font('Helvetica-Bold')
      .text(numberToWords(data.importe_neto + data.total_impuestos, data.currency_code || 'MXN'), {
        continued: true,
      })
      .font('Helvetica')
      .text(
        ` importe de mercancias recibidas a mi (nuestra) entera satisfaccion, de no cubrirse a su vencimiento (${formatDate(data.fecha_vencimiento || data.fecha)}) causara un interes moratorio a la razon de un 5% mensual.`,
        { continued: false },
      )

    // --- Signature section ---
    if (data.signedBy) {
      y += 40

      if (y + 80 > 700) {
        doc.addPage()
        y = 50
      }

      doc.moveTo(50, y).lineTo(562, y).lineWidth(0.5).strokeColor('#9ca3af').stroke()

      y += 8

      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#475569')
        .text('FIRMA DE RECIBIDO:', 50, y - 60)
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#111827')
        .text(data.signedBy, 138, y - 63)

      if (data.signedAt) {
        const formattedDate = new Intl.DateTimeFormat('es-MX', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }).format(data.signedAt)

        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor('#475569')
          .text('FECHA DE FIRMA:', 50, y - 50)
          .font('Helvetica')
          .fontSize(10)
          .fillColor('#111827')
          .text(formattedDate, 125, y - 51)
      }

      if (data.signatureImage) {
        try {
          doc.image(data.signatureImage, 50, y - 145 + 30, { fit: [200, 50] })
        } catch {
          // signature image failed, skip
        }
      }
    }

    doc.end()
  })
}
