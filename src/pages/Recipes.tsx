import { useEffect, useState } from 'react'
import { menuApi, type MenuItem } from '../api/menu'
import { recipeApi, type RecipeIngredient } from '../api/recipes'

const UNITS = ['g', 'kg', 'ml', 'L', 'pcs']

interface IngredientForm {
  IngredientName: string
  Quantity: string
  Unit: string
  CostPerUnit: string
}

const emptyIngredient: IngredientForm = {
  IngredientName: '', Quantity: '', Unit: 'g', CostPerUnit: '',
}

function getProfitColor(margin: number) {
  if (margin > 60) return '#10b981'
  if (margin > 40) return '#f59e0b'
  return '#ef4444'
}

export function Recipes() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([])
  const [foodCost, setFoodCost] = useState<{ totalCost: number; sellPrice: number; profitMargin: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [ingredientsLoading, setIngredientsLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingIngredient, setEditingIngredient] = useState<number | null>(null)
  const [form, setForm] = useState<IngredientForm>(emptyIngredient)

  useEffect(() => {
    menuApi.list()
      .then(setMenuItems)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setIngredients([])
      setFoodCost(null)
      return
    }
    setIngredientsLoading(true)
    Promise.all([
      recipeApi.list(selectedId),
      recipeApi.foodCost(selectedId),
    ])
      .then(([ings, cost]) => {
        setIngredients(ings || [])
        setFoodCost(cost || null)
      })
      .catch(console.error)
      .finally(() => setIngredientsLoading(false))
  }, [selectedId])

  const filteredItems = menuItems.filter(m =>
    m.Name.toLowerCase().includes(search.toLowerCase())
  )

  const openAddForm = () => {
    setEditingIngredient(null)
    setForm(emptyIngredient)
    setShowForm(true)
  }

  const openEditForm = (ing: RecipeIngredient) => {
    setEditingIngredient(ing.Id)
    setForm({
      IngredientName: ing.IngredientName,
      Quantity: String(ing.Quantity),
      Unit: ing.Unit,
      CostPerUnit: String(ing.CostPerUnit),
    })
    setShowForm(true)
  }

  const saveIngredient = async () => {
    if (!form.IngredientName || !form.Quantity || !form.CostPerUnit || !selectedId) return
    const payload = {
      IngredientName: form.IngredientName,
      Quantity: parseFloat(form.Quantity),
      Unit: form.Unit,
      CostPerUnit: parseFloat(form.CostPerUnit),
    }
    try {
      if (editingIngredient) {
        const updated = await recipeApi.update(editingIngredient, payload)
        setIngredients(prev => prev.map(i => i.Id === editingIngredient ? updated : i))
      } else {
        const created = await recipeApi.create(selectedId, payload)
        setIngredients(prev => [...prev, created])
      }
      const cost = await recipeApi.foodCost(selectedId)
      if (cost) setFoodCost(cost)
      setShowForm(false)
      setForm(emptyIngredient)
    } catch (err) {
      console.error('Save ingredient error:', err)
    }
  }

  const deleteIngredient = async (id: number) => {
    try {
      await recipeApi.delete(id)
      setIngredients(prev => prev.filter(i => i.Id !== id))
      if (selectedId) {
        const cost = await recipeApi.foodCost(selectedId)
        if (cost) setFoodCost(cost)
      }
    } catch (err) {
      console.error('Delete ingredient error:', err)
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Loading recipes...</div>
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 24, height: 'calc(100vh - 160px)' }}>
        <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="topbar-search">
            <span className="material-symbols-outlined">search</span>
            <input type="text" placeholder="Search menu items..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="stat-card" style={{ flex: 1, overflow: 'auto', padding: 0 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: '0.875rem' }}>
              Menu Items
            </div>
            {filteredItems.map(item => (
              <div
                key={item.Id}
                style={{
                  padding: '12px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', borderBottom: '1px solid var(--border-light)',
                  background: selectedId === item.Id ? '#fffbeb' : 'transparent',
                  borderLeft: selectedId === item.Id ? '3px solid var(--accent)' : '3px solid transparent',
                  transition: 'all 0.1s',
                }}
                onClick={() => setSelectedId(item.Id)}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{item.Name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.Category}</div>
                </div>
                <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Rs. {Number(item.Price).toFixed(2)}</span>
              </div>
            ))}
            {filteredItems.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No items found</div>
            )}
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto' }}>
          {!selectedId ? (
            <div className="stat-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 48, marginBottom: 12 }}>restaurant_menu</span>
                <div style={{ fontSize: '1.125rem', fontWeight: 600 }}>Select a menu item</div>
                <div style={{ fontSize: '0.875rem', marginTop: 4 }}>Choose an item from the left panel to manage its recipe</div>
              </div>
            </div>
          ) : ingredientsLoading ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Loading ingredients...</div>
          ) : (
            <>
              {foodCost && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  <div className="stat-card">
                    <div className="stat-card-header">
                      <span className="stat-card-label">Total Ingredient Cost</span>
                    </div>
                    <div className="stat-card-value" style={{ color: 'var(--text)' }}>Rs. {foodCost.totalCost.toFixed(2)}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-card-header">
                      <span className="stat-card-label">Selling Price</span>
                    </div>
                    <div className="stat-card-value" style={{ color: 'var(--text)' }}>Rs. {foodCost.sellPrice.toFixed(2)}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-card-header">
                      <span className="stat-card-label">Profit Margin</span>
                    </div>
                    <div className="stat-card-value" style={{ color: getProfitColor(foodCost.profitMargin) }}>
                      {foodCost.profitMargin.toFixed(1)}%
                    </div>
                    <div
                      className="stat-card-change"
                      style={{ color: getProfitColor(foodCost.profitMargin) }}
                    >
                      {foodCost.profitMargin > 60 ? 'High margin' : foodCost.profitMargin > 40 ? 'Medium margin' : 'Low margin'}
                    </div>
                  </div>
                </div>
              )}

              <div className="data-table" style={{ flex: 1 }}>
                <div className="data-table-header">
                  <h3>Ingredients</h3>
                  <button className="btn btn-primary btn-sm" onClick={openAddForm}>
                    <span className="material-symbols-outlined">add</span> Add Ingredient
                  </button>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Ingredient</th>
                      <th>Quantity</th>
                      <th>Unit</th>
                      <th>Cost Per Unit</th>
                      <th>Total Cost</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {ingredients.map(ing => (
                      <tr key={ing.Id}>
                        <td style={{ fontWeight: 600 }}>{ing.IngredientName}</td>
                        <td>{ing.Quantity}</td>
                        <td>{ing.Unit}</td>
                        <td>Rs. {Number(ing.CostPerUnit).toFixed(2)}</td>
                        <td style={{ fontWeight: 700 }}>Rs. {(ing.Quantity * ing.CostPerUnit).toFixed(2)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }} onClick={() => openEditForm(ing)}>
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                            </button>
                            <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', color: 'var(--danger)' }} onClick={() => deleteIngredient(ing.Id)}>
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {ingredients.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 40 }}>
                          No ingredients added yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setShowForm(false)}>
          <div style={{
            background: 'var(--surface-card)', borderRadius: 'var(--radius)',
            padding: 32, width: 480, maxWidth: '90vw', boxShadow: 'var(--shadow-lg)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 24 }}>
              {editingIngredient ? 'Edit Ingredient' : 'Add Ingredient'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Ingredient Name</label>
                <input className="form-input" value={form.IngredientName} onChange={e => setForm(p => ({ ...p, IngredientName: e.target.value }))} placeholder="e.g. All-purpose flour" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Quantity</label>
                  <input className="form-input" type="number" step="0.01" min="0" value={form.Quantity} onChange={e => setForm(p => ({ ...p, Quantity: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Unit</label>
                  <select className="form-input form-select" value={form.Unit} onChange={e => setForm(p => ({ ...p, Unit: e.target.value }))}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Cost Per Unit</label>
                  <input className="form-input" type="number" step="0.01" min="0" value={form.CostPerUnit} onChange={e => setForm(p => ({ ...p, CostPerUnit: e.target.value }))} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-accent" onClick={saveIngredient}>
                {editingIngredient ? 'Update' : 'Add'} Ingredient
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
