import { Router } from 'express'
import db from '../db/knex.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()
router.use(authenticate)

router.get('/', async (req, res) => {
  const { status, orderType } = req.query
  let q = db('Orders').orderBy('CreatedAt', 'desc')
  if (status) q = q.where('Status', status)
  if (orderType) q = q.where('OrderType', orderType)
  res.json(await q)
})

router.get('/:id', async (req, res) => {
  const order = await db('Orders').where('Id', req.params.id).first()
  if (!order) return res.status(404).json({ error: 'Order not found' })

  const items = await db('OrderItems').where('OrderId', order.Id)
  res.json({ ...order, items })
})

router.post('/', async (req, res) => {
  try {
    const { items, ...orderData } = req.body
    const order = {
      ...orderData,
      OrderNumber: `#${Date.now().toString(36).toUpperCase()}`,
      CreatedAt: new Date(),
    }

    const [{ Id: orderId }] = await db('Orders').insert(order).returning('Id')

    if (items?.length) {
      const orderItems = items.map(item => ({ ...item, OrderId: orderId }))
      await db('OrderItems').insert(orderItems)
    }

    const created = await db('Orders').where('Id', orderId).first()
    const createdItems = await db('OrderItems').where('OrderId', orderId)
    res.status(201).json({ ...created, items: createdItems })
  } catch (err) {
    console.error('[POST /orders] Error:', err)
    res.status(500).json({ error: err.message || 'Failed to create order' })
  }
})

router.put('/:id', async (req, res) => {
  await db('Orders').where('Id', req.params.id).update(req.body)
  const updated = await db('Orders').where('Id', req.params.id).first()
  res.json(updated)
})

router.delete('/:id', async (req, res) => {
  await db('OrderItems').where('OrderId', req.params.id).del()
  await db('Orders').where('Id', req.params.id).del()
  res.json({ success: true })
})

// ---- Inventory ----

router.get('/inventory/all', async (req, res) => {
  res.json(await db('InventoryItems').orderBy('Name'))
})

router.post('/inventory', async (req, res) => {
  const [{ Id: id }] = await db('InventoryItems').insert(req.body).returning('Id')
  const created = await db('InventoryItems').where('Id', id).first()
  res.status(201).json(created)
})

router.put('/inventory/:id', async (req, res) => {
  await db('InventoryItems').where('Id', req.params.id).update(req.body)
  const updated = await db('InventoryItems').where('Id', req.params.id).first()
  res.json(updated)
})

// ---- Refunds & Voids ----

router.post('/:id/refund', async (req, res) => {
  const order = await db('Orders').where('Id', req.params.id).first()
  if (!order) return res.status(404).json({ error: 'Order not found' })

  const refund = { ...req.body, OrderId: +req.params.id, CreatedAt: new Date() }
  const [{ Id: id }] = await db('OrderRefunds').insert(refund).returning('Id')
  const created = await db('OrderRefunds').where('Id', id).first()
  res.status(201).json(created)
})

router.get('/:id/refunds', async (req, res) => {
  const refunds = await db('OrderRefunds').where('OrderId', req.params.id).orderBy('CreatedAt', 'desc')
  res.json(refunds)
})

router.put('/:id/void', async (req, res) => {
  const { reason } = req.body
  await db('Orders').where('Id', req.params.id).update({ Status: 'Cancelled' })

  const refund = {
    OrderId: +req.params.id,
    Amount: 0,
    Reason: reason || 'Voided',
    Status: 'Voided',
    CreatedAt: new Date(),
  }
  await db('OrderRefunds').insert(refund)

  res.json({ success: true })
})

export default router
