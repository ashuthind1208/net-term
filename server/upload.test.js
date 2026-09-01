import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test, { after } from 'node:test'
import request from 'supertest'

const uploadsDirectory = await mkdtemp(join(tmpdir(), 'net-term-uploads-'))
process.env.UPLOADS_DIR = uploadsDirectory
process.env.DEV_AUTH_BYPASS = 'true'

const { default: app } = await import('./index.js')

after(() => rm(uploadsDirectory, { recursive: true, force: true }))

test('uploaded files persist in the configured directory and remain retrievable', async () => {
  const upload = await request(app)
    .post('/api/v1/integrations/upload')
    .attach('file', Buffer.from('persistent upload'), {
      filename: 'receipt.txt',
      contentType: 'text/plain',
    })
    .expect(201)

  assert.match(upload.body.data.file_url, /^\/api\/v1\/uploads\/[a-f0-9-]+\.txt$/)
  assert.equal(upload.body.data.filename, 'receipt.txt')

  const download = await request(app)
    .get(upload.body.data.file_url)
    .expect(200)

  assert.equal(download.text, 'persistent upload')
})