import { Router } from 'express'
import db from '../db/knex.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()
router.use(authenticate)

router.get('/search', async (req, res) => {
  const { q } = req.query
  if (!q) return res.json([])

  const query = `%${q.toLowerCase()}%`
  const customers = await db('Customers')
    .where(function () {
      this.whereRaw('LOWER("Name") LIKE ?', [query])
        .orWhere('Phone', 'like', query)
        .orWhereRaw('LOWER("Email") LIKE ?', [query])
    })
    .orderBy('Name')

  res.json(customers)
})

router.get('/:id', async (req, res) => {
  const customer = await db('Customers').where('Id', req.params.id).first()
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  res.json(customer)
})

router.post('/', async (req, res) => {
  const customer = { ...req.body, CreatedAt: new Date() }
  const [{ Id: id }] = await db('Customers').insert(customer).returning('Id')
  const created = await db('Customers').where('Id', id).first()
  res.status(201).json(created)
})

router.put('/:id', async (req, res) => {
  await db('Customers').where('Id', req.params.id).update(req.body)
  const updated = await db('Customers').where('Id', req.params.id).first()
  res.json(updated)
})

export default router
