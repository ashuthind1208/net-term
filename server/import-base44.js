import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { pool } from './db.js'

const exportPath = process.argv[2]

if (!exportPath || !pool) {
  console.error('Usage: npm run db:import-base44 -- <authenticated-export-file>')
  process.exit(1)
}

const rawExport = await readFile(exportPath, 'utf8')
const marker = 'Result: '
const markerIndex = rawExport.indexOf(marker)
if (markerIndex < 0) throw new Error('The export file does not contain a Result payload')
const data = JSON.parse(rawExport.slice(markerIndex + marker.length).trim())
const client = await pool.connect()

try {
  await client.query('BEGIN')
  for (const [entityType, records] of Object.entries(data)) {
    for (const record of records) {
      if (!record.id) continue
      await client.query(
        `INSERT INTO source_records (entity_type, source_id, payload, source_created_at, source_updated_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (entity_type, source_id) DO UPDATE
         SET payload = EXCLUDED.payload,
             source_created_at = EXCLUDED.source_created_at,
             source_updated_at = EXCLUDED.source_updated_at,
             imported_at = NOW()`,
        [entityType, String(record.id), record, record.created_date || null, record.updated_date || null],
      )
    }
  }
  await client.query('COMMIT')
  const counts = await client.query('SELECT entity_type, COUNT(*)::int AS count FROM source_records GROUP BY entity_type ORDER BY entity_type')
  for (const row of counts.rows) console.log(`${row.entity_type}: ${row.count}`)
} catch (error) {
  await client.query('ROLLBACK')
  throw error
} finally {
  client.release()
  await pool.end()
}