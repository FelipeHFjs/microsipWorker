import PDFDocument from 'pdfkit'
import path from 'path'
import moment from 'moment'
import momentTimezone from 'moment-timezone'
import { formatNumber } from '../formatting.js'
import { Buffer } from 'buffer'

export default async function generateEdcPdf(customerData: any) {
  return new Promise(async (resolve, _reject) => {
    const { customerInfo, customerDebt } = customerData
    const interestRate = 0.015 / 30

    let totalDueMXN = 0,
      totalInterestMXN = 0,
      totalDiscountMXN = 0,
      totalMXN = 0,
      grandTotalMXN = 0
    let totalDueUSD = 0,
      totalInterestUSD = 0,
      totalDiscountUSD = 0,
      totalUSD = 0,
      grandTotalUSD = 0

    const doc = new PDFDocument({ size: 'letter' })
    const chunks: Buffer[] = []

    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => {
      const resultBuffer = Buffer.concat(chunks)
      const base64PDF = resultBuffer.toString('base64')
      resolve(base64PDF)
    })

    const addHeader = () => {
      doc
        .image(path.resolve(__dirname, '../../public/img/logo.jpeg'), 50, 60, {
          width: 100,
        })
        .fontSize(16)
        .text('INDUSTRIAS BANMAN', 180, 50)
        .fontSize(10)
        .text('RFC: IBA990512725 CP: 31610', 180, 70)
        .text('Matriz Campo 101 (625)-583-8055', 180, 85)
        .text('Sucursal Km24.5  (625)-102-4369', 180, 100)
        .text('BBVA MXN: 0103796884', 380, 60)
        .text('012028001037968841', 380, 75)
        .text('Santander MXN: 65510224005', 380, 90)
        .text('014094655102240050', 380, 105)
        .fontSize(12)
        .text('ESTADO DE CUENTA', 0, 120, { align: 'center' })
    }

    // Function to add customer details
    const addCustomerDetails = () => {
      doc
        .fontSize(10)
        .text(`Cliente: ${customerInfo.nombre_cliente}`, 50, 150)
        .text(`Correo: ${customerInfo.email}`, 50, 165)
        .text(`Dirección: ${customerInfo.calle.replace(/\r\n/g, ' ')}`, 50, 180, { width: 285 })
        .text(`CP: `, 350, 150)
        .text(`Teléfono: ${customerInfo.telefono1}`, 350, 165)
        .text(`Ciudad: `, 350, 180)
    }

    // Function to add table headers
    const addTableHeader = () => {
      doc
        .fontSize(10)
        .moveTo(50, 220)
        .lineTo(550, 220)
        .stroke()
        .text('Item', 55, 230, { align: 'center', width: 25 })
        .text('Folio', 80, 230, { align: 'center', width: 60 })
        .text('Fecha', 145, 230, { align: 'center', width: 60 })
        .text('Fecha', 205, 230, { align: 'center', width: 60 })
        .text('Días', 255, 230, { align: 'center', width: 50 })
        .text('Moneda', 290, 230, { align: 'center', width: 50 })
        .text('Valor Factura', 325, 230, { align: 'right', width: 75 })
        .text('Saldo Factura', 400, 230, { align: 'right', width: 75 })
        .text('Intereses', 480, 230, { align: 'center', width: 60 })
        .text('Documento', 145, 240)
        .text('Vencimiento', 205, 240)
        .text('Descuento', 480, 240, { align: 'center', width: 60 })
    }

    const footer = () => {
      doc
        .fontSize(10)
        .fillColor('black')
        .text(`Elaborado ${momentTimezone().format('YYYY-MM-DD HH:mm')}`, 55, 700)
    }

    addHeader()
    addCustomerDetails()
    addTableHeader()

    let startY = 255

    customerDebt.forEach((row: any, index: number) => {
      if (startY > 680) {
        footer()
        doc.addPage()
        addHeader()
        addCustomerDetails()
        addTableHeader()
        startY = 255
      }

      const date = moment(new Date())
      const dueDate = moment(row.fecha_vencimiento)
      const days = dueDate.diff(date, 'days')

      let interest = 0
      let discount = 0

      if (days >= 0) {
        if (row.fecha_ppag && moment(row.fecha_ppag).isSameOrAfter(moment())) {
          discount = row.importe * (parseFloat(row.pctje_dscto_ppag) / 100) * -1
        }
      } else if (days < -30) {
        interest = row.importe * interestRate * ((days + 30) * -1)
      }

      const textColor = days < 0 ? 'red' : 'black'

      doc
        .fillColor(textColor)
        .text(`${index + 1}`, 55, startY, { align: 'center', width: 25 })
        .text(row.folio, 80, startY, { align: 'center', width: 60 })
        .text(moment(row.fecha).format('YYYY-MM-DD'), 145, startY, {
          align: 'center',
          width: 60,
        })
        .text(moment(row.fecha_vencimiento).format('YYYY-MM-DD'), 205, startY, {
          align: 'center',
          width: 60,
        })
        .text(`${days}`, 255, startY, { align: 'center', width: 50 })
        .text(row.moneda_id === 1 ? 'MXN' : 'USD', 290, startY, {
          align: 'center',
          width: 50,
        })
        .text(formatNumber(row.valor_factura), 325, startY, {
          align: 'right',
          width: 75,
        })
        .text(formatNumber(row.importe), 400, startY, {
          align: 'right',
          width: 75,
        })
        .text(formatNumber(days >= 0 ? discount : interest), 475, startY, {
          align: 'right',
          width: 60,
        })

      doc.fillColor('black')

      doc
        .strokeColor('#D3D3D3')
        .moveTo(50, startY + 15)
        .lineTo(550, startY + 15)
        .stroke()

      startY += 20

      if (row.moneda_id === 1) {
        if (days < 0) {
          totalDueMXN += parseFloat(row.importe)
          totalInterestMXN += interest
          totalDiscountMXN += discount
        } else {
          totalMXN += parseFloat(row.importe)
          totalDiscountMXN += discount
        }
        grandTotalMXN += parseFloat(row.importe) + interest + discount
      }

      if (row.moneda_id !== 1) {
        if (days < 0) {
          totalDueUSD += parseFloat(row.importe)
          totalInterestUSD += interest
        } else {
          totalUSD += parseFloat(row.importe)
        }
        grandTotalUSD += parseFloat(row.importe) + interest
      }
    })

    if (startY > 580) {
      doc.addPage()
      addHeader()
      addCustomerDetails()
      startY = 255
    }

    startY += 15

    if (grandTotalMXN > 0) {
      const dueTextColorMXN = totalDueMXN > 0 ? 'red' : 'black'

      if (totalDueMXN > 0) {
        doc
          .fontSize(10)
          .fillColor(dueTextColorMXN)
          .text('Valor Vencido MXN', 365, startY)
          .text('Intereses MXN', 365, startY + 15)
          .text('Total Vencido MXN', 365, startY + 30)
          .text(formatNumber(totalDueMXN), 470, startY, { align: 'right' })
          .text(formatNumber(totalInterestMXN), 470, startY + 15, {
            align: 'right',
          })
          .text(formatNumber(totalDueMXN + totalInterestMXN), 470, startY + 30, {
            align: 'right',
          })
        startY += 45
      }
      if (totalMXN > 0) {
        doc
          .fillColor('black')
          .text('Valor por Vencer MXN', 365, startY)
          .text(formatNumber(totalMXN), 470, startY, { align: 'right' })
          .text('Descuento MXN', 365, startY + 15)
          .text(formatNumber(totalDiscountMXN), 470, startY + 15, {
            align: 'right',
          })
        startY += 30
      }

      doc
        .text(totalDiscountMXN < 0 ? 'Pago Puntual MXN' : 'Total a Pagar MXN', 365, startY)
        .text(formatNumber(grandTotalMXN), 470, startY, {
          align: 'right',
        })
    }

    if (grandTotalUSD > 0) {
      const dueTextColorUSD = totalDueUSD > 0 ? 'red' : 'black'

      if (totalDueUSD > 0) {
        doc
          .fontSize(10)
          .fillColor(dueTextColorUSD)
          .text('Valor Vencido USD', 365, startY)
          .text('Intereses USD', 365, startY + 15)
          .text('Total Vencido USD', 365, startY + 30)
          .text(formatNumber(totalDueUSD), 470, startY, { align: 'right' })
          .text(formatNumber(totalInterestUSD), 470, startY + 15, {
            align: 'right',
          })
          .text(formatNumber(totalDueUSD + totalInterestUSD), 470, startY + 30, {
            align: 'right',
          })
        startY += 45
      }
      if (totalUSD > 0) {
        doc
          .fillColor('black')
          .text('Valor por Vencer USD', 365, startY)
          .text(formatNumber(totalUSD), 470, startY, { align: 'right' })
          .text('Descuento USD', 365, startY + 15)
          .text(formatNumber(totalDiscountUSD), 470, startY + 15, {
            align: 'right',
          })
        startY += 30
      }

      doc
        .text(totalDiscountUSD < 0 ? 'Pago Puntual USD' : 'Total a Pagar USD', 365, startY)
        .text(formatNumber(grandTotalUSD), 470, startY, {
          align: 'right',
        })
    }

    footer()
    doc.end()
  })
}
