import pg from 'pg'

const { Pool } = pg

export const databaseConfigured = Boolean(process.env.DATABASE_URL)
const databaseUrl = process.env.DATABASE_URL

export function databaseRequiresSsl(connectionString = databaseUrl) {
  if (!connectionString) return false
  const url = new URL(connectionString)
  return process.env.DATABASE_SSL === 'true'
    || url.hostname.endsWith('.supabase.co')
    || url.hostname.endsWith('.pooler.supabase.com')
    || url.searchParams.get('sslmode') === 'require'
}

export const pool = databaseConfigured
  ? new Pool({
      connectionString: databaseUrl,
      ssl: databaseRequiresSsl() ? { rejectUnauthorized: false } : false,
    })
  : null

export async function query(text, params = []) {
  if (!pool) throw new Error('DATABASE_URL is not configured')
  return pool.query(text, params)
}
