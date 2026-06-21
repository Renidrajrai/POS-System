import { Router } from 'express'
import db from '../db/knex.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()
router.use(authenticate)

// ---- Sales Reports ----

router.get('/reports/sales/daily', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0]
    const orders = await db('Orders')
      .where(db.raw("DATE(\"CreatedAt\")"), date)
      .where('Status', '!=', 'Cancelled')
    const hourly = {}
    for (const o of orders) {
      const hour = new Date(o.CreatedAt).getHours()
      if (!hourly[hour]) hourly[hour] = { hour, orderCount: 0, revenue: 0 }
      hourly[hour].orderCount++
      hourly[hour].revenue += Number(o.Amount) || 0
    }
    res.json(Object.values(hourly).sort((a, b) => a.hour - b.hour))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/reports/sales/period', async (req, res) => {
  try {
    const { start, end } = req.query
    const orders = await db('Orders')
      .where(db.raw("DATE(\"CreatedAt\")"), '>=', start)
      .where(db.raw("DATE(\"CreatedAt\")"), '<=', end)
      .where('Status', '!=', 'Cancelled')
    const totalRevenue = orders.reduce((s, o) => s + (Number(o.Amount) || 0), 0)
    const totalOrders = orders.length
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0
    const byPaymentMethod = {}
    const byOrderType = {}
    for (const o of orders) {
      const pm = o.PaymentMethod || 'Unknown'
      if (!byPaymentMethod[pm]) byPaymentMethod[pm] = { method: pm, count: 0, total: 0 }
      byPaymentMethod[pm].count++
      byPaymentMethod[pm].total += Number(o.Amount) || 0
      const ot = o.OrderType || 'Unknown'
      if (!byOrderType[ot]) byOrderType[ot] = { type: ot, count: 0, total: 0 }
      byOrderType[ot].count++
      byOrderType[ot].total += Number(o.Amount) || 0
    }
    res.json({
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalOrders,
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      byPaymentMethod: Object.values(byPaymentMethod),
      byOrderType: Object.values(byOrderType),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/reports/sales/top-items', async (req, res) => {
  try {
    const { start, end } = req.query
    let q = db('OrderItems')
      .join('Orders', 'OrderItems.OrderId', 'Orders.Id')
      .select('OrderItems.Name')
      .select(db.raw('SUM("OrderItems"."Quantity") as "quantitySold"'))
      .select(db.raw('SUM("OrderItems"."Quantity" * "OrderItems"."UnitPrice") as "revenue"'))
      .where('Orders.Status', '!=', 'Cancelled')
      .groupBy('OrderItems.Name')
      .orderBy('quantitySold', 'desc')
      .limit(20)
    if (start) q = q.where(db.raw("DATE(\"Orders\".\"CreatedAt\")"), '>=', start)
    if (end) q = q.where(db.raw("DATE(\"Orders\".\"CreatedAt\")"), '<=', end)
    const rows = await q
    res.json(rows.map(r => ({
      name: r.Name,
      quantitySold: Number(r.quantitySold),
      revenue: Math.round(Number(r.revenue) * 100) / 100,
    })))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/reports/food-cost', async (req, res) => {
  try {
    const rows = await db('MenuItems')
      .leftJoin('RecipeIngredients', 'MenuItems.Id', 'RecipeIngredients.MenuItemId')
      .select('MenuItems.Id as menuItemId')
      .select('MenuItems.Name as itemName')
      .select('MenuItems.Category as category')
      .select('MenuItems.Price as sellPrice')
      .select(db.raw('COALESCE(SUM("RecipeIngredients"."Quantity" * "RecipeIngredients"."CostPerUnit"), 0) as "totalCost"'))
      .select(db.raw('COUNT("RecipeIngredients"."Id") as "ingredientCount"'))
      .groupBy('MenuItems.Id')
      .orderBy('MenuItems.Name')
    res.json(rows.map(r => {
      const sellPrice = Number(r.sellPrice) || 0
      const totalCost = Math.round(Number(r.totalCost) * 100) / 100
      const profitMargin = sellPrice > 0 ? ((sellPrice - totalCost) / sellPrice * 100) : 0
      return {
        menuItemId: r.menuItemId,
        itemName: r.itemName,
        category: r.category,
        sellPrice,
        totalCost,
        profitMargin: Math.round(profitMargin * 100) / 100,
        ingredientCount: Number(r.ingredientCount),
      }
    }))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/reports/p-l', async (req, res) => {
  try {
    const { start, end } = req.query
    let q = db('Orders').where('Status', '!=', 'Cancelled')
    if (start) q = q.where(db.raw("DATE(\"CreatedAt\")"), '>=', start)
    if (end) q = q.where(db.raw("DATE(\"CreatedAt\")"), '<=', end)
    const orders = await q
    const totalRevenue = orders.reduce((s, o) => s + (Number(o.Amount) || 0), 0)
    const totalOrders = orders.length
    const totalDiscounts = orders.reduce((s, o) => s + (Number(o.DiscountAmount) || 0), 0)
    const estimatedFoodCost = Math.round(totalRevenue * 0.3 * 100) / 100
    const estimatedGrossProfit = Math.round((totalRevenue - estimatedFoodCost) * 100) / 100
    const grossProfitMargin = totalRevenue > 0 ? Math.round(((totalRevenue - estimatedFoodCost) / totalRevenue) * 10000) / 100 : 0
    res.json({
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalOrders,
      totalDiscounts: Math.round(totalDiscounts * 100) / 100,
      estimatedFoodCost,
      estimatedGrossProfit,
      grossProfitMargin,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/reports/order-status-summary', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0]
    const rows = await db('Orders')
      .where(db.raw("DATE(\"CreatedAt\")"), date)
      .select('Status')
      .select(db.raw('COUNT(*) as "count"'))
      .groupBy('Status')
    res.json(rows.map(r => ({ status: r.Status, count: Number(r.count) })))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
