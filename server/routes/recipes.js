import { Router } from 'express'
import db from '../db/knex.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()
router.use(authenticate)

router.get('/menu/:menuItemId/recipes', async (req, res) => {
  try {
    const { menuItemId } = req.params
    const items = await db('RecipeIngredients')
      .where('MenuItemId', menuItemId)
      .orderBy('DisplayOrder')
    res.json(items)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/menu/:menuItemId/recipes', async (req, res) => {
  try {
    const { menuItemId } = req.params
    const ingredient = { ...req.body, MenuItemId: menuItemId }
    const [{ Id: id }] = await db('RecipeIngredients').insert(ingredient).returning('Id')
    const created = await db('RecipeIngredients').where('Id', id).first()
    res.status(201).json(created)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/menu/ingredients/:id', async (req, res) => {
  try {
    await db('RecipeIngredients').where('Id', req.params.id).update(req.body)
    const updated = await db('RecipeIngredients').where('Id', req.params.id).first()
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/menu/ingredients/:id', async (req, res) => {
  try {
    await db('RecipeIngredients').where('Id', req.params.id).del()
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/menu/:menuItemId/food-cost', async (req, res) => {
  try {
    const { menuItemId } = req.params
    const ingredients = await db('RecipeIngredients').where('MenuItemId', menuItemId)
    const totalCost = ingredients.reduce((sum, i) => sum + Number(i.Quantity || 0) * Number(i.CostPerUnit || 0), 0)
    const menuItem = await db('MenuItems').where('Id', menuItemId).first()
    if (!menuItem) return res.status(404).json({ error: 'Menu item not found' })
    const sellPrice = Number(menuItem.Price) || 0
    const profitMargin = sellPrice > 0 ? ((sellPrice - totalCost) / sellPrice * 100).toFixed(2) : 0
    res.json({ totalCost: Math.round(totalCost * 100) / 100, sellPrice, profitMargin: Number(profitMargin) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
