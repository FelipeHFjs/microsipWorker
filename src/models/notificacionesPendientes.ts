import { selectQuery, updateQuery } from '../utils/queryDb.js'

export async function queryNotificacionesPendientes(): Promise<any[]> {
  const query = `
      SELECT 
        CASE
          WHEN LENGTH(c.nombre) > 51
          THEN LEFT(c.nombre, 48) || '...'
          ELSE c.nombre
        END AS nombre_cliente,
        'VE' AS sistema_origen,
        d.nombre AS nombre_docto,
        c.cliente_id,
        dc.telefono1,
        dv.docto_ve_id,
        dv.fecha,
        dv.tipo_docto,
        cpc.fecha_vencimiento,
        dv.folio,
        dv.cfdi_certificado,
        dv.estatus,
        mo.clave_fiscal AS moneda,
        (dv.importe_neto + dv.total_impuestos) importe_total
      FROM doctos_ve dv
        JOIN doctos d ON d.tipo_docto = dv.tipo_docto AND d.sistema_origen = 'VE'
        JOIN doctos_notificaciones dn ON 
          (dn.docto_id = dv.docto_ve_id AND dn.estatus = 'pendiente')
        JOIN monedas mo ON mo.moneda_id = dv.moneda_id
        JOIN clientes c ON c.cliente_id = dv.cliente_id
        JOIN dirs_clientes dc ON dc.cliente_id = c.cliente_id AND dc.es_dir_ppal = 'S'
        JOIN usos_folios_fiscales uff ON uff.docto_id = dv.docto_ve_id
        LEFT JOIN cuentas_por_cobrar cpc ON cpc.docto_id = dv.docto_ve_id
      WHERE
          dv.tipo_docto = 'F' AND dv.cfdi_certificado = 'S'
      UNION ALL
      SELECT 
        CASE
          WHEN LENGTH(c.nombre) > 51
          THEN LEFT(c.nombre, 48) || '...'
          ELSE c.nombre
        END AS nombre_cliente,
        'VE' AS sistema_origen,
        d.nombre AS nombre_docto,
        c.cliente_id,
        dc.telefono1,
        dv.docto_ve_id,
        dv.fecha,
        dv.tipo_docto,
        cpc.fecha_vencimiento,
        dv.folio,
        dv.cfdi_certificado,
        dv.estatus,
        mo.clave_fiscal AS moneda,
        (dv.importe_neto + dv.total_impuestos) importe_total
      FROM doctos_ve dv
        JOIN doctos d ON d.tipo_docto = dv.tipo_docto AND d.sistema_origen = 'VE'
        JOIN doctos_notificaciones dn ON 
          (dn.docto_id = dv.docto_ve_id AND dn.estatus = 'pendiente')
        JOIN monedas mo ON mo.moneda_id = dv.moneda_id
        JOIN clientes c ON c.cliente_id = dv.cliente_id
        JOIN dirs_clientes dc ON dc.cliente_id = c.cliente_id AND dc.es_dir_ppal = 'S'
        LEFT JOIN cuentas_por_cobrar cpc ON cpc.docto_id = dv.docto_ve_id
      WHERE
          dv.tipo_docto = 'R'
      ORDER BY 
        docto_ve_id DESC
      LIMIT 10
    `
  return await selectQuery(query)
}

export async function queryActualizarEstatus(
  id: number,
  status: string,
  contactoWaba?: string,
  wabaId?: string,
): Promise<void> {
  const query = `
    UPDATE doctos_notificaciones 
    SET 
      estatus = $2,
      procesado = CURRENT_TIMESTAMP,
      contacto_waba = $3,
      waba_id = $4
    WHERE docto_id = $1
  `

  await updateQuery(query, [id, status, contactoWaba, wabaId])
}

export async function queryTemplateName(sistemaOrigen: string, tipoDocto: string | number): Promise<string> {
  const query = `
    SELECT waba_template
    FROM enviar_notificaciones_doctos
    WHERE sistema_origen = $1
      AND tipo_docto = $2
  `

  const result = await selectQuery(query, [sistemaOrigen, tipoDocto])

  const row = result[0]

  if (!row) {
    throw new Error(`No template found for sistema_origen: ${sistemaOrigen}, tipo_docto: ${tipoDocto}`)
  }

  console.log(row.wabaTemplate)

  return row.wabaTemplate ? String(row.wabaTemplate) : 'unknown_template'
}
