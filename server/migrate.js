import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { pool } from './db.js'

if (!pool) {
  console.error('DATABASE_URL is required to run migrations')
  process.exit(1)
}

const currentDirectory = dirname(fileURLToPath(import.meta.url))
const sql = await readFile(join(currentDirectory, '..', 'db', 'migrations', '001_initial.sql'), 'utf8')

try {
  await pool.query(sql)
  console.log('Database migration completed')
} finally {
  await pool.end()
}
