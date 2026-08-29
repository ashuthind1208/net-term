import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import { query } from './db.js'

const scrypt = promisify(scryptCallback)

export async function roleForNewUser(email) {
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean)
  if (adminEmails.includes(email.toLowerCase())) return 'admin'
  const result = await query('SELECT COUNT(*)::int AS count FROM users')
  return result.rows[0].count === 0 ? 'admin' : 'member'
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = await scrypt(password, salt, 64)
  return `scrypt$${salt}$${derivedKey.toString('hex')}`
}

export async function verifyPassword(password, storedHash) {
  const [scheme, salt, hash] = (storedHash || '').split('$')
  if (scheme !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'hex')
  const actual = await scrypt(password, salt, expected.length)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export function resolveGoogleCallbackUrl(callbackUrl = process.env.GOOGLE_CALLBACK_URL, clientUrls = process.env.CLIENT_URL) {
  const explicitUrl = String(callbackUrl || '').trim()
  const firstClientUrl = String(clientUrls || 'http://localhost:5175').split(',')[0].trim()
  try {
    const resolvedUrl = explicitUrl ? new URL(explicitUrl) : new URL('/auth/google/callback', firstClientUrl)
    if (!['http:', 'https:'].includes(resolvedUrl.protocol) || resolvedUrl.username || resolvedUrl.password) return undefined
    return resolvedUrl.href
  } catch {
    return undefined
  }
}

export const googleCallbackUrl = resolveGoogleCallbackUrl()
export const googleAuthConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && googleCallbackUrl,
)

if (googleAuthConfigured) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: googleCallbackUrl,
  }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value
      const avatarUrl = profile.photos?.[0]?.value
      const role = await roleForNewUser(email)
      const result = await query(
        `INSERT INTO users (google_id, email, display_name, avatar_url, role)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO UPDATE
         SET google_id = EXCLUDED.google_id, display_name = EXCLUDED.display_name,
             avatar_url = EXCLUDED.avatar_url, updated_at = NOW()
         RETURNING *`,
        [profile.id, email, profile.displayName, avatarUrl, role],
      )
      done(null, result.rows[0])
    } catch (error) {
      done(error)
    }
  }))
}

passport.serializeUser((user, done) => done(null, user.id))
passport.deserializeUser(async (id, done) => {
  try {
    const result = await query('SELECT * FROM users WHERE id = $1', [id])
    done(null, result.rows[0] || false)
  } catch (error) {
    done(error)
  }
})

export function requireUser(req, res, next) {
  if (req.user) return next()
  if (process.env.NODE_ENV !== 'production' && process.env.DEV_AUTH_BYPASS === 'true') {
    req.user = {
      id: process.env.DEV_USER_ID || '00000000-0000-0000-0000-000000000001',
      email: process.env.DEV_USER_EMAIL,
      display_name: process.env.DEV_USER_NAME || 'Development User',
      role: process.env.DEV_USER_ROLE || 'admin',
    }
    return next()
  }
  return res.status(401).json({ error: 'Authentication required' })
}

export default passport
