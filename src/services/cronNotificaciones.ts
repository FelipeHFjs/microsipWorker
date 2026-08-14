import { enviarNotificacionesDoctos } from './notificaciones/enviarNotificaciones.js'
import cron, { type ScheduledTask } from 'node-cron'
import pool from '../config/dbConfig.js'

const timeZone = 'America/Chihuahua'

const funcionesCron: Record<string, () => Promise<void>> = {
  enviarNotificacionesDoctos,
}

const activeTasks = new Map<string, ScheduledTask>()
let reloadTask: ScheduledTask | null = null

type ConfiguracionCron = {
  nombre: string
  grupo: string
  expresion_cron: string
  habilitado: boolean
  prioridad: 'front' | 'back'
  descripcion: string
}

async function cronSyncNotificaciones() {
  const query = `SELECT nombre, grupo, expresion_cron, habilitado, prioridad, descripcion FROM configuraciones_cron WHERE grupo = 'notificaciones' AND habilitado = true`

  let client = await pool.connect()

  try {
    const data = await client.query(query)
    const cronTasks = data.rows as ConfiguracionCron[]
    const nombresConfigurados = new Set(cronTasks.map((fila) => fila.nombre))

    for (const [nombre, task] of activeTasks.entries()) {
      if (!nombresConfigurados.has(nombre)) {
        task.stop()
        activeTasks.delete(nombre)
      }
    }

    for (const row of cronTasks) {
      console.log(
        `${new Date().toISOString()} - Configurando tarea cron: ${row.nombre} con expresión: ${row.expresion_cron}, ${row.descripcion}`,
      )
      const funcion = funcionesCron[row.nombre]

      if (!funcion) {
        continue
      }

      if (activeTasks.has(row.nombre)) {
        activeTasks.get(row.nombre)?.stop()
        activeTasks.delete(row.nombre)
      }
      const tarea = cron.schedule(row.expresion_cron, () => funcion(), { timezone: timeZone })

      activeTasks.set(row.nombre, tarea)
    }
  } catch (error) {
    console.error('notificaciones', error instanceof Error ? error.message : String(error))
    console.error('Error al actualizar tareas cron:', error)
  } finally {
    if (client) {
      client.release()
    }
  }
}

export async function startCronSyncNotificaciones() {
  await cronSyncNotificaciones()

  // Reload configuration every day at 7:00 AM
  if (!reloadTask) {
    reloadTask = cron.schedule(
      '0 7 * * 1-6',
      async () => {
        await cronSyncNotificaciones()
      },
      { timezone: timeZone },
    )
  }
}

export function stopCronSyncNotificaciones() {
  for (const task of activeTasks.values()) {
    task.stop()
  }

  activeTasks.clear()

  if (reloadTask) {
    reloadTask.stop()
    reloadTask = null
  }
}

export async function reloadCronSyncNotificaciones() {
  stopCronSyncNotificaciones()
  await startCronSyncNotificaciones()
}

export function getCronNotificacionesStatus() {
  return {
    running: activeTasks.size > 0,
    tasks: Array.from(activeTasks.keys()),
  }
}

startCronSyncNotificaciones()
