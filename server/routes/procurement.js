import { Router } from 'express'
import db from '../db/knex.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()
router.use(authenticate)

// ---- Suppliers ----

router.get('/suppliers', async (req, res) => {
  try {
    const suppliers = await db('Suppliers').orderBy('Name')
    res.json(suppliers)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/suppliers', async (req, res) => {
  try {
    const supplier = { ...req.body, CreatedAt: new Date() }
    const [{ Id: id }] = await db('Suppliers').insert(supplier).returning('Id')
    const created = await db('Suppliers').where('Id', id).first()
    res.status(201).json(created)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/suppliers/:id', async (req, res) => {
  try {
    await db('Suppliers').where('Id', req.params.id).update(req.body)
    const updated = await db('Suppliers').where('Id', req.params.id).first()
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/suppliers/:id', async (req, res) => {
  try {
    await db('Suppliers').where('Id', req.params.id).del()
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ---- Purchase Orders ----

router.get('/purchase-orders', async (req, res) => {
  try {
    const orders = await db('PurchaseOrders')
      .leftJoin('Suppliers', 'PurchaseOrders.SupplierId', 'Suppliers.Id')
      .select('PurchaseOrders.*', 'Suppliers.Name as SupplierName')
      .orderBy('PurchaseOrders.CreatedAt', 'desc')
    res.json(orders)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/purchase-orders/:id', async (req, res) => {
  try {
    const order = await db('PurchaseOrders').where('Id', req.params.id).first()
    if (!order) return res.status(404).json({ error: 'Purchase order not found' })
    const items = await db('PurchaseOrderItems').where('PurchaseOrderId', order.Id)
    res.json({ ...order, items })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/purchase-orders', async (req, res) => {
  try {
    const { items, ...poData } = req.body
    const result = await db.transaction(async trx => {
      const po = { ...poData, CreatedAt: new Date() }
      const [{ Id: poId }] = await trx('PurchaseOrders').insert(po).returning('Id')
      if (items?.length) {
        const poItems = items.map(item => ({
          ...item,
          PurchaseOrderId: poId,
          TotalPrice: (Number(item.Quantity) || 0) * (Number(item.UnitPrice) || 0),
        }))
        await trx('PurchaseOrderItems').insert(poItems)
        const totalAmount = poItems.reduce((sum, i) => sum + i.TotalPrice, 0)
        await trx('PurchaseOrders').where('Id', poId).update({ TotalAmount: totalAmount })
      }
      const created = await trx('PurchaseOrders').where('Id', poId).first()
      const createdItems = await trx('PurchaseOrderItems').where('PurchaseOrderId', poId)
      return { ...created, items: createdItems }
    })
    res.status(201).json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/purchase-orders/:id', async (req, res) => {
  try {
    const { items, ...poData } = req.body
    const result = await db.transaction(async trx => {
      await trx('PurchaseOrders').where('Id', req.params.id).update(poData)
      if (items) {
        await trx('PurchaseOrderItems').where('PurchaseOrderId', req.params.id).del()
        const poItems = items.map(item => ({
          ...item,
          PurchaseOrderId: Number(req.params.id),
          TotalPrice: (Number(item.Quantity) || 0) * (Number(item.UnitPrice) || 0),
        }))
        await trx('PurchaseOrderItems').insert(poItems)
        const totalAmount = poItems.reduce((sum, i) => sum + i.TotalPrice, 0)
        await trx('PurchaseOrders').where('Id', req.params.id).update({ TotalAmount: totalAmount })
      }
      const updated = await trx('PurchaseOrders').where('Id', req.params.id).first()
      const updatedItems = await trx('PurchaseOrderItems').where('PurchaseOrderId', req.params.id)
      return { ...updated, items: updatedItems }
    })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/purchase-orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body
    await db('PurchaseOrders').where('Id', req.params.id).update({ Status: status })
    const updated = await db('PurchaseOrders').where('Id', req.params.id).first()
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/purchase-orders/:id', async (req, res) => {
  try {
    await db('PurchaseOrders').where('Id', req.params.id).del()
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ---- Goods Receipt ----

router.post('/purchase-orders/:id/receive', async (req, res) => {
  try {
    const { items, notes } = req.body
    const poId = Number(req.params.id)
    const result = await db.transaction(async trx => {
      const [{ Id: grId }] = await trx('GoodsReceipts').insert({
        PurchaseOrderId: poId,
        ReceiptDate: new Date(),
        Status: 'Completed',
        Notes: notes || null,
        CreatedAt: new Date(),
      }).returning('Id')
      if (items?.length) {
        const grItems = items.map(item => ({
          GoodsReceiptId: grId,
          PurchaseOrderItemId: item.purchaseOrderItemId,
          ReceivedQuantity: item.receivedQuantity,
          AcceptedQuantity: item.acceptedQuantity,
        }))
        await trx('GoodsReceiptItems').insert(grItems)
      }
      await trx('PurchaseOrders').where('Id', poId).update({ Status: 'Received' })
      const receipt = await trx('GoodsReceipts').where('Id', grId).first()
      const receiptItems = await trx('GoodsReceiptItems').where('GoodsReceiptId', grId)
      return { ...receipt, items: receiptItems }
    })
    res.status(201).json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
