import 'express-async-errors'
import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import 'dotenv/config'

import { ensureTables } from './db/setup.js'
import authRoutes from './routes/auth.js'
import staffRoutes from './routes/staff.js'
import menuRoutes from './routes/menu.js'
import customerRoutes from './routes/customers.js'
import orderRoutes from './routes/orders.js'
import uploadRoutes from './routes/uploads.js'
import recipeRoutes from './routes/recipes.js'
import procurementRoutes from './routes/procurement.js'
import reportRoutes from './routes/reports.js'
import onlineOrderRoutes from './routes/online-orders.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/staff', staffRoutes)
app.use('/api/menu', menuRoutes)
app.use('/api/customers', customerRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/uploads', uploadRoutes)
app.use('/api', recipeRoutes)
app.use('/api', procurementRoutes)
app.use('/api', reportRoutes)
app.use('/api', onlineOrderRoutes)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')))

// Serve React build in production
const distPath = path.join(__dirname, '..', 'dist')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
  console.log('Serving React build from dist/')
}

app.use((err, req, res, next) => {
  console.error(`[${req.method} ${req.path}] Server error:`, err)
  const status = err.status || err.statusCode || 500
  const message = err.expose ? err.message : 'Internal server error'
  res.status(status).json({ error: message })
})

ensureTables().catch(err => console.error('Table setup error:', err))

app.listen(PORT, () => {
  console.log(`Meowspot running on http://localhost:${PORT}`)
  if (!fs.existsSync(distPath)) {
    console.log('React build not found — run "npm run build" to serve frontend too')
  }
})
