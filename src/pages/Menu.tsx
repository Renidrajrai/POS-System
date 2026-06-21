import { useEffect, useState, useRef } from 'react'
import { menuApi, type MenuItem, type MenuCategory, type MenuModifier } from '../api/menu'
import { getAuthToken } from '../api/client'

interface ItemForm {
  Name: string
  Description: string
  Category: string
  Price: string
  ImagePath: string
}

const emptyForm: ItemForm = { Name: '', Description: '', Category: '', Price: '', ImagePath: '' }

export function Menu() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [activeCategory, setActiveCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<ItemForm>(emptyForm)
  const [uploading, setUploading] = useState(false)
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [modifiers, setModifiers] = useState<MenuModifier[]>([])
  const [addingModifier, setAddingModifier] = useState(false)
  const [newModifierName, setNewModifierName] = useState('')
  const [newModifierType, setNewModifierType] = useState<'select' | 'multi'>('select')
  const [newModifierRequired, setNewModifierRequired] = useState(false)
  const [addingOptionFor, setAddingOptionFor] = useState<number | null>(null)
  const [newOptionName, setNewOptionName] = useState('')
  const [newOptionPrice, setNewOptionPrice] = useState('')

  useEffect(() => {
    menuApi.list()
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false))
    menuApi.categories.list()
      .then(setCategories)
      .catch(console.error)
  }, [])

  useEffect(() => {
    const click = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.menu-three-dots')) setMenuOpenId(null)
    }
    document.addEventListener('mousedown', click)
    return () => document.removeEventListener('mousedown', click)
  }, [])

  useEffect(() => {
    if (editingId) {
      menuApi.modifiers.list(editingId).then(setModifiers).catch(console.error)
    }
  }, [editingId])

  const catNames = [...new Set([...categories.map(c => c.Name), ...items.map(m => m.Category)])]

  const filtered = items.filter(m => {
    const matchCategory = activeCategory === 'all' || m.Category === activeCategory
    const matchSearch = m.Name.toLowerCase().includes(search.toLowerCase()) || m.Description.toLowerCase().includes(search.toLowerCase())
    return matchCategory && matchSearch
  })

  const addCategory = async () => {
    if (!newCategoryName.trim()) return
    try {
      const created = await menuApi.categories.create({ Name: newCategoryName.trim() })
      setCategories(prev => [...prev, created])
      setNewCategoryName('')
      setShowAddCategory(false)
    } catch (err) {
      console.error('Add category error:', err)
    }
  }

  const deleteItem = async (id: number) => {
    try {
      await menuApi.delete(id)
      setItems(prev => prev.filter(i => i.Id !== id))
      setConfirmDelete(null)
    } catch (err) {
      console.error('Delete error:', err)
    }
  }

  const resetFormState = () => {
    setForm(emptyForm)
    setModifiers([])
    setAddingModifier(false)
    setAddingOptionFor(null)
    setNewModifierName('')
    setNewModifierType('select')
    setNewModifierRequired(false)
    setNewOptionName('')
    setNewOptionPrice('')
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingId(null)
    resetFormState()
  }

  const openAdd = () => {
    setEditingId(null)
    setForm(emptyForm)
    setModifiers([])
    setShowModal(true)
  }

  const openEdit = (item: MenuItem) => {
    setEditingId(item.Id)
    setForm({
      Name: item.Name,
      Description: item.Description,
      Category: item.Category,
      Price: String(item.Price),
      ImagePath: item.ImagePath || '',
    })
    setShowModal(true)
  }

  const uploadFile = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/uploads', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getAuthToken()}` },
        body: fd,
      })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()
      setForm(p => ({ ...p, ImagePath: data.path }))
    } catch (err) {
      console.error('Upload error:', err)
    } finally {
      setUploading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
  }

  const save = async () => {
    if (!form.Name || !form.Price) return
    const payload = {
      Name: form.Name,
      Description: form.Description,
      Category: form.Category,
      Price: parseFloat(form.Price),
      ImagePath: form.ImagePath,
    }
    try {
      if (editingId) {
        const updated = await menuApi.update(editingId, payload)
        setItems(prev => prev.map(i => i.Id === editingId ? updated : i))
      } else {
        const created = await menuApi.create(payload)
        setItems(prev => [...prev, created])
      }
      closeModal()
    } catch (err) {
      console.error('Save error:', err)
    }
  }

  const toggleAvailability = async (item: MenuItem) => {
    try {
      await menuApi.toggle(item.Id)
      setItems(prev => prev.map(i => i.Id === item.Id ? { ...i, IsAvailable: !i.IsAvailable } : i))
    } catch (err) {
      console.error('Toggle error:', err)
    }
  }

  const addModifierHandler = async () => {
    if (!newModifierName.trim() || !editingId) return
    try {
      const created = await menuApi.modifiers.create(editingId, {
        Name: newModifierName.trim(),
        Type: newModifierType,
        IsRequired: newModifierRequired,
      })
      setModifiers(prev => [...prev, created])
      setNewModifierName('')
      setNewModifierType('select')
      setNewModifierRequired(false)
      setAddingModifier(false)
    } catch (err) {
      console.error('Add modifier error:', err)
    }
  }

  const addOptionHandler = async (modifierId: number) => {
    if (!newOptionName.trim()) return
    try {
      const created = await menuApi.modifiers.options.create(modifierId, {
        Name: newOptionName.trim(),
        PriceAdjustment: parseFloat(newOptionPrice) || 0,
      })
      setModifiers(prev => prev.map(m => {
        if (m.Id === modifierId) {
          return { ...m, options: [...(m.options || []), created] }
        }
        return m
      }))
      setNewOptionName('')
      setNewOptionPrice('')
      setAddingOptionFor(null)
    } catch (err) {
      console.error('Add option error:', err)
    }
  }

  const deleteOptionHandler = async (optionId: number, modifierId: number) => {
    try {
      await menuApi.modifiers.options.delete(optionId)
      setModifiers(prev => prev.map(m => {
        if (m.Id === modifierId) {
          return { ...m, options: m.options?.filter(o => o.Id !== optionId) }
        }
        return m
      }))
    } catch (err) {
      console.error('Delete option error:', err)
    }
  }

  const deleteModifierHandler = async (modifierId: number) => {
    try {
      await menuApi.modifiers.delete(modifierId)
      setModifiers(prev => prev.filter(m => m.Id !== modifierId))
    } catch (err) {
      console.error('Delete modifier error:', err)
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Loading menu...</div>
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            className={`btn ${activeCategory === 'all' ? 'btn-primary' : 'btn-ghost'} btn-sm`}
            onClick={() => setActiveCategory('all')}
          >All Items</button>
          {catNames.map(cat => (
            <button
              key={cat}
              className={`btn ${activeCategory === cat ? 'btn-primary' : 'btn-ghost'} btn-sm`}
              onClick={() => setActiveCategory(cat)}
            >{cat}</button>
          ))}
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent)' }} onClick={() => setShowAddCategory(true)} title="Add Category">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span> Category
          </button>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="topbar-search" style={{ width: 240 }}>
            <span className="material-symbols-outlined">search</span>
            <input type="text" placeholder="Search menu..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>
            <span className="material-symbols-outlined">add</span> Add Item
          </button>
        </div>
      </div>

      <div className="data-table">
        <div className="data-table-header">
          <h3>Menu Items <span style={{ fontWeight: 400, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>({filtered.length} items)</span></h3>
        </div>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Category</th>
              <th>Price</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => (
              <tr key={item.Id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {item.ImagePath ? (
                      <img
                        src={`/${item.ImagePath}`}
                        alt={item.Name}
                        style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{
                        width: 40, height: 40, borderRadius: 'var(--radius-sm)',
                        background: '#f3f4f6', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', color: '#9ca3af',
                      }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                          {item.Category === 'Coffee' || item.Category === 'Beverages' ? 'coffee' : 'lunch_dining'}
                        </span>
                      </div>
                    )}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{item.Name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.Description}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span style={{
                    padding: '2px 10px', borderRadius: 9999, fontSize: '0.75rem',
                    fontWeight: 600, background: '#f3f4f6', color: '#6b7280',
                  }}>{item.Category}</span>
                </td>
                <td style={{ fontWeight: 700 }}>Rs. {Number(item.Price).toFixed(2)}</td>
                <td>
                  <span
                    className={item.IsAvailable ? 'badge badge-success' : 'badge badge-neutral'}
                    style={{ cursor: 'pointer' }}
                    onClick={() => toggleAvailability(item)}
                  >
                    {item.IsAvailable ? 'Available' : 'Unavailable'}
                  </span>
                </td>
                <td>
                  <div className="menu-three-dots" style={{ position: 'relative', display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-icon" onClick={() => setMenuOpenId(menuOpenId === item.Id ? null : item.Id)}>
                      <span className="material-symbols-outlined">more_vert</span>
                    </button>
                    {menuOpenId === item.Id && (
                      <div style={{
                        position: 'absolute', right: 0, top: '100%', zIndex: 50,
                        background: 'var(--surface-card)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-md)',
                        minWidth: 180, padding: 4,
                      }}>
                        <button style={{
                          display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px',
                          border: 'none', background: 'none', cursor: 'pointer', borderRadius: 4,
                          fontSize: '0.8125rem', fontFamily: 'Inter, sans-serif', fontWeight: 500,
                        }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}
                          onClick={() => { openEdit(item); setMenuOpenId(null) }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span> Edit
                        </button>
                        <button style={{
                          display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px',
                          border: 'none', background: 'none', cursor: 'pointer', borderRadius: 4,
                          fontSize: '0.8125rem', fontFamily: 'Inter, sans-serif', fontWeight: 500,
                        }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}
                          onClick={() => { toggleAvailability(item); setMenuOpenId(null) }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{item.IsAvailable ? 'visibility_off' : 'visibility'}</span>
                          {item.IsAvailable ? 'Mark Unavailable' : 'Mark Available'}
                        </button>
                        <button style={{
                          display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px',
                          border: 'none', background: 'none', cursor: 'pointer', borderRadius: 4,
                          fontSize: '0.8125rem', fontFamily: 'Inter, sans-serif', fontWeight: 500,
                          color: 'var(--danger)',
                        }}
                          onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}
                          onClick={() => { setConfirmDelete(item.Id); setMenuOpenId(null) }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>No menu items found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showAddCategory && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1100,
        }} onClick={() => setShowAddCategory(false)}>
          <div style={{
            background: 'var(--surface-card)', borderRadius: 'var(--radius)',
            padding: 24, width: 360, maxWidth: '90vw',
            boxShadow: 'var(--shadow-lg)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Add Category</h3>
            <input
              className="form-input"
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              placeholder="Category name"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') addCategory() }}
              style={{ marginBottom: 16 }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddCategory(false)}>Cancel</button>
              <button className="btn btn-accent btn-sm" onClick={addCategory} disabled={!newCategoryName.trim()}>Add</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1100,
        }} onClick={() => setConfirmDelete(null)}>
          <div style={{
            background: 'var(--surface-card)', borderRadius: 'var(--radius)',
            padding: 24, width: 360, maxWidth: '90vw',
            boxShadow: 'var(--shadow-lg)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 8 }}>Delete Item</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
              Are you sure you want to delete this item? This cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn btn-sm" style={{ background: '#ef4444', color: 'white' }} onClick={() => deleteItem(confirmDelete)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }} onClick={closeModal}>
          <div style={{
            background: 'var(--surface-card)', borderRadius: 'var(--radius)',
            padding: 32, width: editingId ? 640 : 480, maxWidth: '90vw', maxHeight: '90vh',
            overflowY: 'auto', boxShadow: 'var(--shadow-lg)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 24 }}>
              {editingId ? 'Edit Item' : 'Add Item'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Name</label>
                <input className="form-input" value={form.Name} onChange={e => setForm(p => ({ ...p, Name: e.target.value }))} placeholder="Item name" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Description</label>
                <textarea className="form-input" style={{ resize: 'vertical', minHeight: 60 }} value={form.Description} onChange={e => setForm(p => ({ ...p, Description: e.target.value }))} placeholder="Brief description" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Category</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select className="form-input form-select" value={form.Category} onChange={e => setForm(p => ({ ...p, Category: e.target.value }))} style={{ flex: 1 }}>
                    <option value="">Select category</option>
                    {catNames.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }} onClick={() => setShowAddCategory(true)} title="Add Category">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                  </button>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Price (Rs)</label>
                <input className="form-input" type="number" step="0.01" min="0" value={form.Price} onChange={e => setForm(p => ({ ...p, Price: e.target.value }))} placeholder="0.00" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Image</label>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    <span className="material-symbols-outlined">upload</span>
                    {uploading ? 'Uploading...' : 'Upload Image'}
                  </button>
                  {form.ImagePath && (
                    <img src={`/${form.ImagePath}`} alt="preview" style={{ width: 48, height: 48, borderRadius: 'var(--radius-sm)', objectFit: 'cover' }} />
                  )}
                </div>
              </div>

              <div style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                background: '#faf9f7',
                padding: 16,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 700 }}>Modifiers</h4>
                  {editingId && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setAddingModifier(true)}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span> Add Modifier
                    </button>
                  )}
                </div>

                {editingId ? (
                  <>
                    {modifiers.map(mod => (
                      <div key={mod.Id} style={{
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        background: 'white',
                        padding: 12,
                        marginBottom: 8,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{mod.Name}</span>
                            <span className={`badge ${mod.Type === 'select' ? 'badge-primary' : 'badge-info'}`} style={{ fontSize: '0.625rem', padding: '1px 6px' }}>
                              {mod.Type === 'select' ? 'Select' : 'Multi'}
                            </span>
                            <span className={`badge ${mod.IsRequired ? 'badge-warning' : 'badge-neutral'}`} style={{ fontSize: '0.625rem', padding: '1px 6px' }}>
                              {mod.IsRequired ? 'Required' : 'Optional'}
                            </span>
                          </div>
                          <button
                            className="btn btn-ghost btn-icon"
                            style={{ width: 24, height: 24, padding: 0, color: '#999' }}
                            onClick={() => deleteModifierHandler(mod.Id)}
                            title="Delete modifier"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                          </button>
                        </div>

                        {mod.options && mod.options.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                            {mod.options.map(opt => (
                              <div key={opt.Id} style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem',
                                background: '#f3f4f6', fontWeight: 500,
                              }}>
                                <span>{opt.Name}</span>
                                <span style={{ color: 'var(--primary)', fontWeight: 700 }}>+{opt.PriceAdjustment > 0 ? 'Rs. ' + opt.PriceAdjustment.toFixed(2) : 'Free'}</span>
                                <button
                                  className="btn btn-ghost btn-icon"
                                  style={{ width: 16, height: 16, padding: 0, color: '#999', cursor: 'pointer' }}
                                  onClick={() => deleteOptionHandler(opt.Id, mod.Id)}
                                  title="Delete option"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {addingOptionFor === mod.Id && (
                          <div style={{ display: 'flex', gap: 6, marginTop: 8, marginBottom: 6 }}>
                            <input
                              className="form-input"
                              placeholder="Option name"
                              value={newOptionName}
                              onChange={e => setNewOptionName(e.target.value)}
                              style={{ flex: 1, fontSize: '0.75rem', padding: '4px 8px' }}
                              onKeyDown={e => { if (e.key === 'Enter') addOptionHandler(mod.Id) }}
                            />
                            <input
                              className="form-input"
                              type="number"
                              step="0.01"
                              placeholder="Price"
                              value={newOptionPrice}
                              onChange={e => setNewOptionPrice(e.target.value)}
                              style={{ width: 80, fontSize: '0.75rem', padding: '4px 8px' }}
                              onKeyDown={e => { if (e.key === 'Enter') addOptionHandler(mod.Id) }}
                            />
                            <button className="btn btn-accent btn-sm" style={{ padding: '4px 8px' }} onClick={() => addOptionHandler(mod.Id)} disabled={!newOptionName.trim()}>
                              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span>
                            </button>
                            <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }} onClick={() => { setAddingOptionFor(null); setNewOptionName(''); setNewOptionPrice('') }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                            </button>
                          </div>
                        )}

                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                          onClick={() => { setAddingOptionFor(mod.Id); setNewOptionName(''); setNewOptionPrice('') }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span> Option
                        </button>
                      </div>
                    ))}

                    {addingModifier && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, padding: 12, border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)' }}>
                        <input
                          className="form-input"
                          placeholder="Modifier name"
                          value={newModifierName}
                          onChange={e => setNewModifierName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') addModifierHandler() }}
                        />
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <select className="form-input form-select" value={newModifierType} onChange={e => setNewModifierType(e.target.value as 'select' | 'multi')} style={{ flex: 1 }}>
                            <option value="select">Select (single choice)</option>
                            <option value="multi">Multi (multiple choice)</option>
                          </select>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                            <input type="checkbox" checked={newModifierRequired} onChange={e => setNewModifierRequired(e.target.checked)} />
                            Required
                          </label>
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => { setAddingModifier(false); setNewModifierName(''); setNewModifierType('select'); setNewModifierRequired(false) }}>Cancel</button>
                          <button className="btn btn-accent btn-sm" onClick={addModifierHandler} disabled={!newModifierName.trim()}>Add</button>
                        </div>
                      </div>
                    )}

                    {modifiers.length === 0 && !addingModifier && (
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', padding: 8, textAlign: 'center' }}>
                        No modifiers yet. Add one to allow customization.
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', padding: 8, textAlign: 'center' }}>
                    Save the item first to add modifiers.
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost" onClick={closeModal}>Cancel</button>
              <button className="btn btn-accent" onClick={save}>
                {editingId ? 'Update' : 'Add'} Item
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
