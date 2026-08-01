import pg from 'pg'

const { Pool } = pg

export const databaseConfigured = Boolean(process.env.DATABASE_URL)
export const pool = databaseConfigured
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    })
  : null

export async function query(text, params = []) {
  if (!pool) throw new Error('DATABASE_URL is not configured')
  return pool.query(text, params)
}
