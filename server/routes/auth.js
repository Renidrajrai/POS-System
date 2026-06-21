import { Router } from 'express'
import { generateToken } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

const router = Router()

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@gmail.com'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin9818'

router.post('/login', validate({
  email: [{ required: true, type: 'string' }],
  password: [{ required: true, type: 'string' }],
}), (req, res) => {
  const { email, password } = req.body

  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const token = generateToken(email)
  res.json({ token, email, role: 'Admin' })
})

export default router
