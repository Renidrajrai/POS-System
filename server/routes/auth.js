import { Router } from 'express'
import { generateToken } from '../middleware/auth.js'

const router = Router()

const ADMIN_EMAIL = 'admin@gmail.com'
const ADMIN_PASSWORD = 'admin9818'

router.post('/login', (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' })
  }

  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const token = generateToken(email)
  res.json({ token, email, role: 'Admin' })
})

export default router
