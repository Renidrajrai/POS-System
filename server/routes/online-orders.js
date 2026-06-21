import { Router } from 'express'
import db from '../db/knex.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

// ---- Public endpoint (no auth) ----

router.post('/online-orders', async (req, res) => {
  try {
    const { customerName, customerPhone, deliveryAddress, items, orderType, notes } = req.body
    const totalAmount = items.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0)
    const orderData = {
      CustomerName: customerName,
      CustomerPhone: customerPhone,
      DeliveryAddress: deliveryAddress || null,
      Items: JSON.stringify(items || []),
      TotalAmount: totalAmount,
      Status: 'Pending',
      OrderType: orderType || 'Pickup',
      Notes: notes || null,
      CreatedAt: new Date(),
    }
    const [{ Id: id }] = await db('OnlineOrders').insert(orderData).returning('Id')
    const created = await db('OnlineOrders').where('Id', id).first()
    created.Items = typeof created.Items === 'string' ? JSON.parse(created.Items) : created.Items
    res.status(201).json(created)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ---- Authenticated endpoints ----

router.use(authenticate)

router.get('/online-orders', async (req, res) => {
  try {
    const { status } = req.query
    let q = db('OnlineOrders').orderBy('CreatedAt', 'desc')
    if (status) q = q.where('Status', status)
    const orders = await q
    for (const o of orders) {
      if (typeof o.Items === 'string') o.Items = JSON.parse(o.Items)
    }
    res.json(orders)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/online-orders/:id', async (req, res) => {
  try {
    const order = await db('OnlineOrders').where('Id', req.params.id).first()
    if (!order) return res.status(404).json({ error: 'Online order not found' })
    if (typeof order.Items === 'string') order.Items = JSON.parse(order.Items)
    res.json(order)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/online-orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body
    const result = await db.transaction(async trx => {
      await trx('OnlineOrders').where('Id', req.params.id).update({ Status: status })
      const onlineOrder = await trx('OnlineOrders').where('Id', req.params.id).first()
      if (status === 'Accepted' && !onlineOrder.OrderId) {
        const orderPayload = {
          OrderNumber: `#ON${Date.now().toString(36).toUpperCase()}`,
          CustomerName: onlineOrder.CustomerName,
          Amount: onlineOrder.TotalAmount,
          TaxAmount: 0,
          DiscountPercent: 0,
          DiscountAmount: 0,
          PaymentMethod: 'Online',
          IsPaid: false,
          Status: 'Open',
          OrderType: 'Online',
          ItemCount: onlineOrder.Items.length,
          TableNumber: 0,
          CreatedAt: new Date(),
        }
        const [{ Id: orderId }] = await trx('Orders').insert(orderPayload).returning('Id')
        await trx('OnlineOrders').where('Id', req.params.id).update({ OrderId: orderId })
        onlineOrder.OrderId = orderId
      }
      return onlineOrder
    })
    if (typeof result.Items === 'string') result.Items = JSON.parse(result.Items)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/online-orders/:id', async (req, res) => {
  try {
    const { notes, deliveryAddress } = req.body
    const updateData = {}
    if (notes !== undefined) updateData.Notes = notes
    if (deliveryAddress !== undefined) updateData.DeliveryAddress = deliveryAddress
    await db('OnlineOrders').where('Id', req.params.id).update(updateData)
    const updated = await db('OnlineOrders').where('Id', req.params.id).first()
    if (typeof updated.Items === 'string') updated.Items = JSON.parse(updated.Items)
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/online-orders/:id', async (req, res) => {
  try {
    await db('OnlineOrders').where('Id', req.params.id).del()
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
