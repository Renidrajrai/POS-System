import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET || 'mauspot-jwt-secret-2026-minimum-32-chars!!'
const EXPIRES = process.env.JWT_EXPIRES_IN || '7d'

export function generateToken(email, role = 'Admin') {
  return jwt.sign(
    { email, role },
    SECRET,
    { expiresIn: EXPIRES, issuer: 'mauspot', audience: 'mauspot' }
  )
}

export function authenticate(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' })
  }

  try {
    const token = header.slice(7)
    const decoded = jwt.verify(token, SECRET, {
      issuer: 'mauspot',
      audience: 'mauspot',
    })
    req.user = decoded
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}
