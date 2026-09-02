import test from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { resolveGoogleCallbackUrl } from './auth.js'
import app, { getClientRedirectUrl } from './index.js'

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

test('OAuth preserves the exact allowed tunnel page', () => {
  const returnTo = 'https://1zhn91j9-5175.use.devtunnels.ms/Timesheets?timesheet=time-456'

  assert.equal(getClientRedirectUrl(returnTo), returnTo)
})

test('OAuth callback defaults to the first configured client URL', () => {
  assert.equal(
    resolveGoogleCallbackUrl('', 'https://example-tunnel.use.devtunnels.ms,http://localhost:5175'),
    'https://example-tunnel.use.devtunnels.ms/auth/google/callback',
  )
})

test('OAuth callback accepts an explicit production override', () => {
  assert.equal(
    resolveGoogleCallbackUrl('https://app.example.com/auth/google/callback', 'http://localhost:5175'),
    'https://app.example.com/auth/google/callback',
  )
})

test('OAuth callback normalizes a duplicated leading path slash', () => {
  assert.equal(
    resolveGoogleCallbackUrl('https://app.example.com//auth/google/callback', 'http://localhost:5175'),
    'https://app.example.com/auth/google/callback',
  )
})

test('OAuth rejects open redirects and credential-bearing URLs', () => {
  const fallback = String(process.env.CLIENT_URL).split(',')[0]

  assert.equal(getClientRedirectUrl('https://1zhn91j9-5175.use.devtunnels.ms.example.com/a'), fallback)
  assert.equal(getClientRedirectUrl('https://user:password@1zhn91j9-5175.use.devtunnels.ms/a'), fallback)
})