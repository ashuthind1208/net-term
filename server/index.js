import 'dotenv/config'
import { fileURLToPath } from 'node:url'
import cors from 'cors'
import express from 'express'
import session from 'express-session'
import connectPgSimple from 'connect-pg-simple'
import passport, { googleAuthConfigured, hashPassword, roleForNewUser, verifyPassword } from './auth.js'
import { databaseConfigured, pool, query } from './db.js'
import apiRoutes from './routes.js'
import { smtpConfigured } from './email.js'

const app = express()
const port = Number(process.env.PORT || 3001)
const clientUrls = String(process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((value) => value.trim()).filter(Boolean)
const clientUrl = clientUrls[0]
const allowedOrigins = new Set([
  ...clientUrls,
  ...String(process.env.CORS_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean),
])
if (process.env.NODE_ENV !== 'production') {
  const configuredUrl = new URL(clientUrl)
  allowedOrigins.add(`http://127.0.0.1:${configuredUrl.port}`)
  allowedOrigins.add(`http://localhost:${configuredUrl.port}`)
}
const PgSession = connectPgSimple(session)

export function isOriginAllowed(origin) {
  if (!origin || allowedOrigins.has(origin)) return true
  if (process.env.NODE_ENV === 'production') return false
  try {
    const url = new URL(origin)
    return url.protocol === 'https:' && /^[a-z0-9-]+\.use\.devtunnels\.ms$/i.test(url.hostname)
  } catch {
    return false
  }
}

app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : 0)
app.use(cors({
  origin(origin, callback) {
    callback(null, isOriginAllowed(origin))
  },
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(session({
  store: databaseConfigured ? new PgSession({ pool, createTableIfMissing: true }) : undefined,
  secret: process.env.SESSION_SECRET || 'development-only-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}))
app.use(passport.initialize())
app.use(passport.session())

app.get('/api/health', (_req, res) => res.json({
  status: 'ok',
  databaseConfigured,
  googleAuthConfigured,
  smtpConfigured,
}))

app.get('/auth/google', (req, res, next) => {
  if (!googleAuthConfigured) return res.status(503).json({ error: 'Google authentication is not configured' })
  return passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next)
})
app.get('/auth/google/callback', (req, res) => {
  if (!googleAuthConfigured) return res.redirect(`${clientUrl}/?auth=unavailable`)
  return passport.authenticate('google', { failureRedirect: `${clientUrl}/?auth=failed` })(req, res, () => res.redirect(clientUrl))
})
app.post('/auth/register', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase()
    const password = String(req.body.password || '')
    const displayName = String(req.body.displayName || '').trim()
    if (!email || !displayName || password.length < 8) return res.status(400).json({ error: 'Name, valid email, and an 8-character password are required' })
    const role = await roleForNewUser(email)
    const passwordHash = await hashPassword(password)
    const result = await query(
      'INSERT INTO users (email, display_name, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, email, display_name, avatar_url, role',
      [email, displayName, passwordHash, role],
    )
    req.login(result.rows[0], (error) => error ? next(error) : res.status(201).json({ user: result.rows[0] }))
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'An account with this email already exists' })
    next(error)
  }
})
app.post('/auth/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase()
    const password = String(req.body.password || '')
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })
    const result = await query('SELECT * FROM users WHERE email = $1', [email])
    const user = result.rows[0]
    if (!user || !await verifyPassword(password, user.password_hash)) return res.status(401).json({ error: 'Invalid email or password' })
    req.login(user, (error) => error ? next(error) : res.json({ user: { id: user.id, email: user.email, display_name: user.display_name, avatar_url: user.avatar_url, role: user.role } }))
  } catch (error) { next(error) }
})
app.post('/auth/logout', (req, res, next) => req.logout((error) => error ? next(error) : req.session.destroy(() => res.status(204).end())))

app.use('/api/v1', apiRoutes)
app.use((error, _req, res, _next) => {
  void _next
  console.error(error)
  res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message })
})

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(port, () => console.log(`Net Term Solutions API listening on http://localhost:${port}`))
}

export default app
