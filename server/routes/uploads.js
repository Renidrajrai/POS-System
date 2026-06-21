import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { authenticate } from '../middleware/auth.js'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    cb(null, `${unique}${path.extname(file.originalname)}`)
  },
})

const upload = multer({ storage })

const router = Router()
router.use(authenticate)

router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  res.json({ path: `uploads/${req.file.filename}` })
})

router.delete('/:filename', (req, res) => {
  const filePath = path.join(__dirname, '../../uploads', req.params.filename)
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
  res.json({ success: true })
})

export default router
