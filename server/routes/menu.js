import { Router } from 'express'
import db from '../db/knex.js'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

const router = Router()
router.use(authenticate)

router.get('/', async (req, res) => {
  const { category } = req.query
  let q = db('MenuItems').orderBy(['Category', 'Name'])
  if (category) q = q.where('Category', category)
  res.json(await q)
})

router.get('/:id', async (req, res) => {
  const item = await db('MenuItems').where('Id', req.params.id).first()
  if (!item) return res.status(404).json({ error: 'Menu item not found' })
  res.json(item)
})

router.post('/', validate({
  Name: [{ required: true, type: 'string' }],
  Price: [{ required: true, type: 'number', min: 0 }],
  Category: [{ required: true, type: 'string' }],
}), async (req, res) => {
  const item = {
    ...req.body,
    Sku: req.body.Sku || `SKU-${Date.now().toString(36).toUpperCase()}`,
    IsAvailable: req.body.IsAvailable !== undefined ? req.body.IsAvailable : true,
    CreatedAt: new Date(),
  }
  const [{ Id: id }] = await db('MenuItems').insert(item).returning('Id')
  const created = await db('MenuItems').where('Id', id).first()
  res.status(201).json(created)
})

router.put('/:id', async (req, res) => {
  await db('MenuItems').where('Id', req.params.id).update(req.body)
  const updated = await db('MenuItems').where('Id', req.params.id).first()
  res.json(updated)
})

router.delete('/:id', async (req, res) => {
  await db('MenuItems').where('Id', req.params.id).del()
  res.json({ success: true })
})

router.put('/:id/toggle', async (req, res) => {
  const item = await db('MenuItems').where('Id', req.params.id).first()
  if (item) {
    await db('MenuItems').where('Id', req.params.id).update({ IsAvailable: !item.IsAvailable })
  }
  res.json({ success: true })
})

// ---- Categories ----

router.get('/categories/all', async (req, res) => {
  res.json(await db('Categories').orderBy('DisplayOrder'))
})

router.post('/categories', async (req, res) => {
  const [{ Id: id }] = await db('Categories').insert(req.body).returning('Id')
  const created = await db('Categories').where('Id', id).first()
  res.status(201).json(created)
})

router.delete('/categories/:id', async (req, res) => {
  await db('Categories').where('Id', req.params.id).del()
  res.json({ success: true })
})

// ---- Modifiers ----

router.get('/:menuItemId/modifiers', async (req, res) => {
  const modifiers = await db('MenuModifiers')
    .where('MenuItemId', req.params.menuItemId)
    .orderBy('DisplayOrder')

  const result = await Promise.all(modifiers.map(async mod => {
    const options = await db('MenuModifierOptions')
      .where('ModifierId', mod.Id)
      .orderBy('DisplayOrder')
    return { ...mod, options }
  }))

  res.json(result)
})

router.post('/:menuItemId/modifiers', async (req, res) => {
  const { Name, Type, IsRequired, DisplayOrder } = req.body
  const [{ Id: id }] = await db('MenuModifiers').insert({
    MenuItemId: req.params.menuItemId,
    Name, Type: Type || 'select',
    IsRequired: IsRequired || false,
    DisplayOrder: DisplayOrder || 0,
  }).returning('Id')
  const created = await db('MenuModifiers').where('Id', id).first()
  res.status(201).json(created)
})

router.put('/modifiers/:id', async (req, res) => {
  await db('MenuModifiers').where('Id', req.params.id).update(req.body)
  const updated = await db('MenuModifiers').where('Id', req.params.id).first()
  res.json(updated)
})

router.delete('/modifiers/:id', async (req, res) => {
  await db('MenuModifiers').where('Id', req.params.id).del()
  res.json({ success: true })
})

router.post('/modifiers/:modifierId/options', async (req, res) => {
  const { Name, PriceAdjustment, DisplayOrder } = req.body
  const [{ Id: id }] = await db('MenuModifierOptions').insert({
    ModifierId: req.params.modifierId,
    Name,
    PriceAdjustment: PriceAdjustment || 0,
    DisplayOrder: DisplayOrder || 0,
  }).returning('Id')
  const created = await db('MenuModifierOptions').where('Id', id).first()
  res.status(201).json(created)
})

router.put('/modifier-options/:id', async (req, res) => {
  await db('MenuModifierOptions').where('Id', req.params.id).update(req.body)
  const updated = await db('MenuModifierOptions').where('Id', req.params.id).first()
  res.json(updated)
})

router.delete('/modifier-options/:id', async (req, res) => {
  await db('MenuModifierOptions').where('Id', req.params.id).del()
  res.json({ success: true })
})

export default router
