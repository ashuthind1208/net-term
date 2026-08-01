import test from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import app from './index.js'

test('GET /api/health reports service configuration', async () => {
  const response = await request(app).get('/api/health').expect(200)

  assert.equal(response.body.status, 'ok')
  assert.equal(typeof response.body.databaseConfigured, 'boolean')
  assert.equal(typeof response.body.googleAuthConfigured, 'boolean')
})

test('protected collections reject unauthenticated requests', async () => {
  const response = await request(app).get('/api/v1/projects').expect(401)

  assert.equal(response.body.error, 'Authentication required')
})

test('development tunnel origins receive credentialed CORS headers', async () => {
  const origin = 'https://1zhn91j9-5175.use.devtunnels.ms'
  const response = await request(app).get('/api/v1/me').set('Origin', origin).expect(401)

  assert.equal(response.headers['access-control-allow-origin'], origin)
  assert.equal(response.headers['access-control-allow-credentials'], 'true')
})

test('lookalike tunnel origins remain blocked', async () => {
  const response = await request(app)
    .get('/api/v1/me')
    .set('Origin', 'https://1zhn91j9-5175.use.devtunnels.ms.example.com')
    .expect(401)

  assert.equal(response.headers['access-control-allow-origin'], undefined)
})