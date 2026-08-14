import pool from '../config/dbConfig.js'

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

function convertKeysToCamel(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(convertKeysToCamel)
  if (typeof obj === 'object' && obj.constructor === Object) {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [snakeToCamel(k), convertKeysToCamel(v)]),
    )
  }
  return obj
}

function errorHandler(error: any, query: string, params: any[]) {
  console.error('Database error:', error, 'Query:', query, 'Params:', params)
  throw error
}

export const selectQuery = async <T = Record<string, unknown>>(query: string, params: any[] = []): Promise<T[]> => {
  try {
    const result = await pool.query(query, params)
    return result.rows.map((row) => convertKeysToCamel(row) as T)
  } catch (error) {
    errorHandler(error, query, params)
    return []
  }
}

export const insertQuery = async <T = Record<string, unknown>>(
  query: string,
  params: any[] = [],
): Promise<T | undefined> => {
  try {
    const result = await pool.query(query, params)
    return convertKeysToCamel(result.rows[0]) as T
  } catch (error) {
    errorHandler(error, query, params)
  }
}

export const updateQuery = async (query: string, params: any[] = []): Promise<number> => {
  try {
    const result = await pool.query(query, params)
    return result.rowCount ?? 0
  } catch (error) {
    errorHandler(error, query, params)
    return 0
  }
}

export const deleteQuery = async (query: string, params: any[] = []): Promise<number> => {
  try {
    const result = await pool.query(query, params)
    return result.rowCount ?? 0
  } catch (error) {
    errorHandler(error, query, params)
    return 0
  }
}

export const runInTransaction = async <T>(fn: (client: import('pg').PoolClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
