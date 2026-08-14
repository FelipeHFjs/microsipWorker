import moment from 'moment-timezone'

export const formaDePago = [
  {
    c_FormaPago: 1,
    descripcion: 'Efectivo',
  },
  {
    c_FormaPago: 2,
    descripcion: 'Cheque nominativo',
  },
  {
    c_FormaPago: 3,
    descripcion: 'Transferencia electrónica de fondos',
  },
  {
    c_FormaPago: 4,
    descripcion: 'Tarjeta de crédito',
  },
  {
    c_FormaPago: 5,
    descripcion: 'Monedero electrónico',
  },
  {
    c_FormaPago: 6,
    descripcion: 'Dinero electrónico',
  },
  {
    c_FormaPago: 8,
    descripcion: 'Vales de despensa',
  },
  {
    c_FormaPago: 12,
    descripcion: 'Dación en pago',
  },
  {
    c_FormaPago: 13,
    descripcion: 'Pago por subrogación',
  },
  {
    c_FormaPago: 14,
    descripcion: 'Pago por consignación',
  },
  {
    c_FormaPago: 15,
    descripcion: 'Condonación',
  },
  {
    c_FormaPago: 17,
    descripcion: 'Compensación',
  },
  {
    c_FormaPago: 23,
    descripcion: 'Novación',
  },
  {
    c_FormaPago: 24,
    descripcion: 'Confusión',
  },
  {
    c_FormaPago: 25,
    descripcion: 'Remisión de deuda',
  },
  {
    c_FormaPago: 26,
    descripcion: 'Prescripción o caducidad',
  },
  {
    c_FormaPago: 27,
    descripcion: 'A satisfacción del acreedor',
  },
  {
    c_FormaPago: 28,
    descripcion: 'Tarjeta de débito',
  },
  {
    c_FormaPago: 29,
    descripcion: 'Tarjeta de servicios',
  },
  {
    c_FormaPago: 30,
    descripcion: 'Aplicación de anticipos',
  },
  {
    c_FormaPago: 31,
    descripcion: 'Intermediario pagos',
  },
  {
    c_FormaPago: 99,
    descripcion: 'Por definir',
  },
]

export const impuestos = [
  {
    c_Impuesto: 1,
    descripcion: 'ISR',
  },
  {
    c_Impuesto: 2,
    descripcion: 'IVA',
  },
  {
    c_Impuesto: 3,
    descripcion: 'IEPS',
  },
]

export const metodoDePago = [
  {
    c_MetodoPago: 'PUE',
    descripcion: 'Pago en una sola exhibición',
  },
  {
    c_MetodoPago: 'PPD',
    descripcion: 'Pago en parcialidades o diferido',
  },
]

export const usoCfdi = [
  {
    c_UsoCFDI: 'G01',
    descripcion: 'Adquisición de mercancías.',
  },
  {
    c_UsoCFDI: 'G02',
    descripcion: 'Devoluciones, descuentos o bonificaciones.',
  },
  {
    c_UsoCFDI: 'G03',
    descripcion: 'Gastos en general.',
  },
  {
    c_UsoCFDI: 'I01',
    descripcion: 'Construcciones.',
  },
  {
    c_UsoCFDI: 'I02',
    descripcion: 'Mobiliario y equipo de oficina por inversiones.',
  },
  {
    c_UsoCFDI: 'I03',
    descripcion: 'Equipo de transporte.',
  },
  {
    c_UsoCFDI: 'I04',
    descripcion: 'Equipo de computo y accesorios.',
  },
  {
    c_UsoCFDI: 'I05',
    descripcion: 'Dados, troqueles, moldes, matrices y herramental.',
  },
  {
    c_UsoCFDI: 'I06',
    descripcion: 'Comunicaciones telefónicas.',
  },
  {
    c_UsoCFDI: 'I07',
    descripcion: 'Comunicaciones satelitales.',
  },
  {
    c_UsoCFDI: 'I08',
    descripcion: 'Otra maquinaria y equipo.',
  },
  {
    c_UsoCFDI: 'D01',
    descripcion: 'Honorarios médicos, dentales y gastos hospitalarios.',
  },
  {
    c_UsoCFDI: 'D02',
    descripcion: 'Gastos médicos por incapacidad o discapacidad.',
  },
  {
    c_UsoCFDI: 'D03',
    descripcion: 'Gastos funerales.',
  },
  {
    c_UsoCFDI: 'D04',
    descripcion: 'Donativos.',
  },
  {
    c_UsoCFDI: 'D05',
    descripcion: 'Intereses reales efectivamente pagados por créditos hipotecarios (casa habitación).',
  },
  {
    c_UsoCFDI: 'D06',
    descripcion: 'Aportaciones voluntarias al SAR.',
  },
  {
    c_UsoCFDI: 'D07',
    descripcion: 'Primas por seguros de gastos médicos.',
  },
  {
    c_UsoCFDI: 'D08',
    descripcion: 'Gastos de transportación escolar obligatoria.',
  },
  {
    c_UsoCFDI: 'D09',
    descripcion: 'Depósitos en cuentas para el ahorro, primas que tengan como base planes de pensiones.',
  },
  {
    c_UsoCFDI: 'D10',
    descripcion: 'Pagos por servicios educativos (colegiaturas).',
  },
  {
    c_UsoCFDI: 'S01',
    descripcion: 'Sin efectos fiscales.  ',
  },
  {
    c_UsoCFDI: 'CP01',
    descripcion: 'Pagos',
  },
  {
    c_UsoCFDI: 'CN01',
    descripcion: 'Nómina',
  },
]

const holidays = [
  '2026-01-01', // Año Nuevo
  '2026-02-02', // Día de la Constitución (se recorre)
  '2026-03-16', // Natalicio de Benito Juárez (se recorre)
  '2026-04-03', // Viernes Santo (no oficial pero común)
  '2026-04-05', // Pascua (no oficial)
  '2026-04-06', // Lunes de Pascua (no oficial)
  '2026-04-07', // Martes de Pascua (no oficial)
  '2026-05-01', // Día del Trabajo
  '2026-05-14', // Ascensión de Cristo (no oficial)
  '2026-05-24', // Pentecostés (no oficial)
  '2026-05-25', // Lunes de Pentecostés (no oficial)
  '2026-05-26', // Martes de Pentecostés (no oficial)
  '2026-09-16', // Día de la Independencia
  '2026-11-16', // Revolución Mexicana (se recorre)
  '2026-12-25', // Navidad
  '2026-12-26', // Navidad (2do día)
  '2026-12-27', // Navidad (3er día)
  '2027-01-01', // Año Nuevo
  '2027-02-01', // Día de la Constitución (se recorre)
  '2027-03-15', // Natalicio de Benito Juárez (se recorre)
  '2027-03-26', // Viernes Santo (no oficial pero común)
  '2027-03-28', // Pascua (no oficial)
  '2027-03-29', // Lunes de Pascua (no oficial)
  '2027-03-30', // Martes de Pascua (no oficial)
  '2027-05-01', // Día del Trabajo
  '2027-05-06', // Ascensión de Cristo (no oficial)
  '2027-05-16', // Pentecostés (no oficial)
  '2027-05-17', // Lunes de Pentecostés (no oficial)
  '2027-05-18', // Martes de Pentecostés (no oficial)
  '2027-09-16', // Día de la Independencia
  '2027-11-15', // Revolución Mexicana (se recorre)
  '2027-12-25', // Navidad
  '2027-12-26', // Navidad (2do día)
  '2027-12-27', // Navidad (3er día)
]

export function isHoliday(date?: string) {
  const day = date ?? moment().tz('America/Chihuahua').format('YYYY-MM-DD')
  return holidays.includes(day)
}
