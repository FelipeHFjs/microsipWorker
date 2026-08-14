import { selectQuery } from '../utils/queryDb.js'

// Exists a holiday on the given date?
export async function queryDiaFestivo(fecha: string): Promise<boolean> {
  const query = `SELECT * FROM dias_festivos WHERE fecha = $1`
  const result = await selectQuery(query, [fecha])
  return result.length > 0
}

export async function queryCronNotificaciones() {
  const query = `
    SELECT 
      nombre, 
      grupo, 
      expresion_cron, 
      habilitado, 
      prioridad,
      descripcion
    FROM 
      configuraciones_cron 
    WHERE 
      grupo = 'notificaciones' 
      AND habilitado = true`

  const result = await selectQuery(query, [])
  return result
}
