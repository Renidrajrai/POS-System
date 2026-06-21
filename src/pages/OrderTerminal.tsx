import { useEffect, useState, useRef } from 'react'
import { menuApi, type MenuItem, type MenuModifier } from '../api/menu'
import { orderApi, customerApi, type Customer, type Order, type OrderRefund } from '../api/orders'

interface CartItemModifier {
  modifierId: number
  modifierName: string
  optionId: number
  optionName: string
  priceAdjustment: number
}

interface CartItem {
  id: number
  name: string
  price: number
  quantity: number
  modifiers?: CartItemModifier[]
  modifierTotal?: number
}

export function OrderTerminal() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [cart, setCart] = useState<CartItem[]>([])
  const [customerName, setCustomerName] = useState('')
  const [orderType, setOrderType] = useState('Dine-in')
  const [loading, setLoading] = useState(true)
  const [discountPercent, setDiscountPercent] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showSearch, setShowSearch] = useState(false)
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [newCustomer, setNewCustomer] = useState({ Name: '', Phone: '', Email: '' })
  const [tableNumber, setTableNumber] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  const [viewMode, setViewMode] = useState<'new' | 'orders'>('new')
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null)
  const [orderTypeFilter, setOrderTypeFilter] = useState('')
  const [showVoidModal, setShowVoidModal] = useState(false)
  const [voidOrderId, setVoidOrderId] = useState<number | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [showRefundModal, setShowRefundModal] = useState(false)
  const [refundOrderId, setRefundOrderId] = useState<number | null>(null)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [orderRefunds, setOrderRefunds] = useState<OrderRefund[]>([])
  const [showModifierModal, setShowModifierModal] = useState(false)
  const [selectedItemForModifiers, setSelectedItemForModifiers] = useState<MenuItem | null>(null)
  const [itemModifiers, setItemModifiers] = useState<MenuModifier[]>([])
  const [selectedOptions, setSelectedOptions] = useState<Record<number, number[]>>({})

  const notify = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 4000)
  }

  useEffect(() => {
    async function load() {
      try {
        const items = await menuApi.list()
        setMenuItems(items)
      } catch (err) {
        console.error('Order terminal load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (searchQuery.length < 1) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const results = await customerApi.search(searchQuery)
        setSearchResults(results)
      } catch { }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    if (viewMode === 'orders') {
      orderApi.list(undefined, orderTypeFilter || undefined).then(setRecentOrders).catch(console.error)
    }
  }, [viewMode, orderTypeFilter])

  const categories = [...new Set(menuItems.map(m => m.Category))]
  const activeItems = activeCategory === 'all'
    ? menuItems
    : menuItems.filter(m => m.Category === activeCategory)

  const addToCart = (item: MenuItem, selectedModifiers?: CartItemModifier[]) => {
    const modifierTotal = selectedModifiers?.reduce((sum, m) => sum + m.priceAdjustment, 0) || 0
    const newItem: CartItem = {
      id: item.Id,
      name: item.Name,
      price: Number(item.Price),
      quantity: 1,
      ...(selectedModifiers ? { modifiers: selectedModifiers, modifierTotal } : {}),
    }
    setCart(prev => {
      if (selectedModifiers) {
        return [...prev, newItem]
      }
      const existing = prev.find(i => i.id === item.Id && !i.modifiers)
      if (existing) {
        return prev.map(i => i.id === item.Id && !i.modifiers ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, newItem]
    })
  }

  const handleItemClick = async (item: MenuItem) => {
    try {
      const mods = await menuApi.modifiers.list(item.Id)
      if (mods.length > 0) {
        setSelectedItemForModifiers(item)
        setItemModifiers(mods)
        setSelectedOptions({})
        setShowModifierModal(true)
      } else {
        addToCart(item)
      }
    } catch (err) {
      addToCart(item)
    }
  }

  const toggleOption = (modifierId: number, optionId: number, type: 'select' | 'multi') => {
    setSelectedOptions(prev => {
      const current = prev[modifierId] || []
      if (type === 'select') {
        if (current.includes(optionId)) {
          const { [modifierId]: _, ...rest } = prev
          return rest
        }
        return { ...prev, [modifierId]: [optionId] }
      }
      if (current.includes(optionId)) {
        return { ...prev, [modifierId]: current.filter(id => id !== optionId) }
      }
      return { ...prev, [modifierId]: [...current, optionId] }
    })
  }

  const calculateTotalWithModifiers = () => {
    if (!selectedItemForModifiers) return 0
    let total = Number(selectedItemForModifiers.Price)
    for (const [modId, optIds] of Object.entries(selectedOptions)) {
      const mod = itemModifiers.find(m => m.Id === Number(modId))
      if (!mod) continue
      for (const optId of optIds) {
        const opt = mod.options?.find(o => o.Id === optId)
        if (opt) total += opt.PriceAdjustment
      }
    }
    return total
  }

  const allRequiredSelected = itemModifiers
    .filter(m => m.IsRequired)
    .every(m => (selectedOptions[m.Id] || []).length > 0)

  const confirmModifierSelection = () => {
    if (!selectedItemForModifiers) return
    const selectedModifiers: CartItemModifier[] = []
    for (const [modId, optIds] of Object.entries(selectedOptions)) {
      const mod = itemModifiers.find(m => m.Id === Number(modId))
      if (!mod) continue
      for (const optId of optIds) {
        const opt = mod.options?.find(o => o.Id === optId)
        if (opt) {
          selectedModifiers.push({
            modifierId: mod.Id,
            modifierName: mod.Name,
            optionId: opt.Id,
            optionName: opt.Name,
            priceAdjustment: opt.PriceAdjustment,
          })
        }
      }
    }
    addToCart(selectedItemForModifiers, selectedModifiers)
    setShowModifierModal(false)
    setSelectedItemForModifiers(null)
    setItemModifiers([])
    setSelectedOptions({})
  }

  const updateQty = (id: number, delta: number) => {
    setCart(prev => {
      const updated = prev.map(i => i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i)
      return updated.filter(i => i.quantity > 0)
    })
  }

  const selectCustomer = (c: Customer) => {
    setSelectedCustomer(c)
    setCustomerName(c.Name)
    setShowSearch(false)
    setSearchQuery('')
  }

  const clearCustomer = () => {
    setSelectedCustomer(null)
    setCustomerName('')
  }

  const addCustomer = async () => {
    if (!newCustomer.Name) return
    try {
      const created = await customerApi.create({
        Name: newCustomer.Name,
        Phone: newCustomer.Phone,
        Email: newCustomer.Email,
        Points: 0,
      })
      selectCustomer(created)
      setNewCustomer({ Name: '', Phone: '', Email: '' })
      setShowAddCustomer(false)
    } catch (err) {
      console.error('Add customer error:', err)
    }
  }

  const subtotal = cart.reduce((sum, item) => sum + (item.price + (item.modifierTotal || 0)) * item.quantity, 0)
  const discountAmount = subtotal * (discountPercent / 100)
  const total = subtotal - discountAmount

  const placeOrder = async () => {
    try {
      await orderApi.create({
        CustomerName: customerName || 'Walk-in',
        CustomerId: selectedCustomer?.Id,
        TableNumber: tableNumber ? parseInt(tableNumber) : 0,
        Amount: total,
        TaxAmount: 0,
        DiscountPercent: discountPercent,
        DiscountAmount: discountAmount,
        PaymentMethod: paymentMethod,
        IsPaid: paymentMethod === 'Cash',
        Status: 'Open',
        OrderType: orderType,
        ItemCount: cart.reduce((s, i) => s + i.quantity, 0),
        items: cart.map(i => ({ Name: i.name, Notes: i.modifiers ? i.modifiers.map(m => m.optionName).join(', ') : '', Quantity: i.quantity, UnitPrice: i.price + (i.modifierTotal || 0) })) as any,
      })
      if (selectedCustomer) {
        const pointsEarned = Math.floor(subtotal / 100)
        await customerApi.update(selectedCustomer.Id, {
          Points: (selectedCustomer.Points || 0) + pointsEarned,
        })
        setSelectedCustomer(prev => prev ? { ...prev, Points: (prev.Points || 0) + pointsEarned } : null)
      }
      setCart([])
      setCustomerName('')
      setDiscountPercent(0)
      setSelectedCustomer(null)
      setPaymentMethod('Cash')
      setTableNumber('')
      notify('success', 'Order placed successfully!')
    } catch (err: any) {
      console.error('Place order error:', err)
      notify('error', err?.message || 'Failed to place order')
    }
  }

  const toggleExpandOrder = async (orderId: number) => {
    if (expandedOrder === orderId) {
      setExpandedOrder(null)
      return
    }
    setExpandedOrder(orderId)
    try {
      const [order, refunds] = await Promise.all([
        orderApi.get(orderId),
        orderApi.refunds.list(orderId),
      ])
      setRecentOrders(prev => prev.map(o => o.Id === orderId ? order : o))
      setOrderRefunds(refunds)
    } catch (err) {
      console.error('Load order details error:', err)
    }
  }

  const openVoidModal = (orderId: number) => {
    setVoidOrderId(orderId)
    setVoidReason('')
    setShowVoidModal(true)
  }

  const openRefundModal = (order: Order) => {
    setRefundOrderId(order.Id)
    setRefundAmount(String(order.Amount))
    setRefundReason('')
    setShowRefundModal(true)
  }

  const confirmVoid = async () => {
    if (!voidOrderId || !voidReason.trim()) return
    try {
      await orderApi.voidOrder(voidOrderId, voidReason.trim())
      setShowVoidModal(false)
      setVoidOrderId(null)
      setVoidReason('')
      const orders = await orderApi.list()
      setRecentOrders(orders)
      notify('success', 'Order voided successfully')
    } catch (err: any) {
      notify('error', err?.message || 'Failed to void order')
    }
  }

  const confirmRefund = async () => {
    if (!refundOrderId || !refundAmount || !refundReason.trim()) return
    try {
      await orderApi.refunds.create(refundOrderId, {
        Amount: parseFloat(refundAmount),
        Reason: refundReason.trim(),
      })
      setShowRefundModal(false)
      const loadedOrderId = refundOrderId
      setRefundOrderId(null)
      setRefundAmount('')
      setRefundReason('')
      const [orders, refunds] = await Promise.all([
        orderApi.list(),
        orderApi.refunds.list(loadedOrderId),
      ])
      setRecentOrders(orders)
      setOrderRefunds(refunds)
      notify('success', 'Refund processed successfully')
    } catch (err: any) {
      notify('error', err?.message || 'Failed to process refund')
    }
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'Open': return 'badge-warning'
      case 'Preparing': return 'badge-info'
      case 'Paid':
      case 'Completed': return 'badge-success'
      default: return 'badge-neutral'
    }
  }

  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Loading menu...</div>
  }

  return (
    <>
      {notification && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
          padding: '10px 24px', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', fontWeight: 600,
          background: notification.type === 'success' ? '#ecfdf5' : '#fef2f2',
          color: notification.type === 'success' ? '#059669' : '#ef4444',
          border: `1px solid ${notification.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
          boxShadow: 'var(--shadow-lg)',
        }}>
          {notification.message}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className={`btn ${viewMode === 'new' ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setViewMode('new')}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span> New Order
        </button>
        <button className={`btn ${viewMode === 'orders' ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setViewMode('orders')}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>receipt_long</span> Orders
        </button>
      </div>

      {viewMode === 'orders' ? (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {['', 'Dine-in', 'Takeout', 'Delivery'].map(type => (
              <button
                key={type}
                className={`btn btn-sm ${orderTypeFilter === type ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setOrderTypeFilter(type)}
              >
                {type || 'All'}
              </button>
            ))}
          </div>
          {recentOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 40, marginBottom: 8 }}>receipt_long</span>
              <div style={{ fontWeight: 600 }}>No orders yet</div>
            </div>
          ) : (
            recentOrders.map(order => (
              <div key={order.Id} style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 8,
                background: 'var(--surface-card)',
              }}>
                <div
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 16px', cursor: 'pointer',
                  }}
                  onClick={() => toggleExpandOrder(order.Id)}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{order.OrderNumber}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{order.CustomerName}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>Rs. {Number(order.Amount).toFixed(2)}</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
                      <span className={`badge ${statusBadge(order.Status)}`} style={{ fontSize: '0.625rem', padding: '1px 6px' }}>
                        {order.Status}
                      </span>
                      <span style={{ fontSize: '0.625rem', color: 'var(--text-secondary)' }}>{formatTime(order.CreatedAt)}</span>
                    </div>
                  </div>
                </div>
                {expandedOrder === order.Id && (
                  <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: '#faf9f7' }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: 8 }}>Items</div>
                    {order.items && order.items.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                        {order.items.map(item => (
                          <div key={item.Id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                            <div>
                              <span style={{ fontWeight: 600 }}>{item.Quantity}x</span> {item.Name}
                              {item.Notes && <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}> ({item.Notes})</span>}
                            </div>
                            <span style={{ fontWeight: 600 }}>Rs. {(item.Quantity * item.UnitPrice).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 12 }}>No item details available</div>
                    )}

                    {orderRefunds.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: 4, color: 'var(--danger)' }}>Refunds</div>
                        {orderRefunds.map(r => (
                          <div key={r.Id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 2 }}>
                            <span>-Rs. {r.Amount.toFixed(2)} ({r.Reason})</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{formatTime(r.CreatedAt)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      {(order.Status === 'Open' || order.Status === 'Preparing') && (
                        <button
                          className="btn btn-sm"
                          style={{ background: '#ef4444', color: 'white', fontSize: '0.75rem' }}
                          onClick={() => openVoidModal(order.Id)}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>cancel</span> Void Order
                        </button>
                      )}
                      {(order.Status === 'Paid' || order.Status === 'Completed') && (
                        <button
                          className="btn btn-sm"
                          style={{ background: '#f59e0b', color: 'white', fontSize: '0.75rem' }}
                          onClick={() => openRefundModal(order)}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>currency_rupee</span> Refund
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 24, height: 'calc(100vh - var(--header-height) - 56px)' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <button
                className={`btn ${activeCategory === 'all' ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                onClick={() => setActiveCategory('all')}
              >All</button>
              {categories.map(cat => (
                <button
                  key={cat}
                  className={`btn ${activeCategory === cat ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                  onClick={() => setActiveCategory(cat)}
                >{cat}</button>
              ))}
            </div>

            <div style={{
              flex: 1,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 12,
              overflowY: 'auto',
              alignContent: 'start',
            }}>
              {activeItems.filter(m => m.IsAvailable).map(item => (
                <button
                  key={item.Id}
                  onClick={() => handleItemClick(item)}
                  style={{
                    background: 'var(--surface-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: 20,
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.15s',
                    fontFamily: 'Inter, sans-serif',
                  }}
                  className="menu-item-btn"
                >
                  {item.ImagePath ? (
                    <img
                      src={`/${item.ImagePath}`}
                      alt={item.Name}
                      style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 'var(--radius-sm)', marginBottom: 8 }}
                    />
                  ) : (
                    <span className="material-symbols-outlined" style={{
                      fontSize: 36,
                      color: 'var(--accent)',
                      marginBottom: 8,
                      display: 'block',
                    }}>
                      {item.Category === 'Coffee' || item.Category === 'Beverages' ? 'coffee' : item.Category === 'Pastry' || item.Category === 'Desserts' ? 'bakery_dining' : 'lunch_dining'}
                    </span>
                  )}
                  <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: 4 }}>{item.Name}</div>
                  <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1.0625rem' }}>Rs. {Number(item.Price).toFixed(2)}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{
            width: 380,
            background: 'var(--surface-card)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
          }}>
            <div style={{ padding: 20, borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}>New Order</h3>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {['Dine-in', 'Takeout', 'Delivery'].map(type => (
                  <button
                    key={type}
                    className={`btn btn-sm`}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      background: orderType === type ? 'var(--accent)' : 'var(--surface)',
                      color: orderType === type ? 'var(--primary)' : 'var(--text-secondary)',
                      border: orderType === type ? '1px solid var(--accent)' : '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onClick={() => setOrderType(type)}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                      {type === 'Dine-in' ? 'restaurant' : type === 'Takeout' ? 'takeout_dining' : 'local_shipping'}
                    </span>
                    {type}
                  </button>
                ))}
              </div>

              {orderType === 'Dine-in' && (
                <div style={{ marginBottom: 12 }}>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="Table number"
                    value={tableNumber}
                    onChange={e => setTableNumber(e.target.value)}
                    style={{ fontSize: '0.8125rem', padding: '6px 10px' }}
                  />
                </div>
              )}

              <div ref={searchRef} style={{ position: 'relative' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="Search customer..."
                    value={selectedCustomer ? selectedCustomer.Name : searchQuery}
                    onChange={e => {
                      setSearchQuery(e.target.value)
                      setShowSearch(true)
                      if (selectedCustomer) clearCustomer()
                    }}
                    onFocus={() => { if (searchQuery) setShowSearch(true) }}
                    style={{ flex: 1 }}
                  />
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '6px 8px', flexShrink: 0, fontSize: '0.75rem' }}
                    onClick={() => setShowAddCustomer(true)}
                    title="Add new customer"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person_add</span>
                  </button>
                  {selectedCustomer && (
                    <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', flexShrink: 0 }} onClick={clearCustomer}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                    </button>
                  )}
                </div>
                {selectedCustomer && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--accent)' }}>stars</span>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{selectedCustomer.Points || 0} pts</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{selectedCustomer.Phone}</span>
                  </div>
                )}
                {showSearch && searchResults.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0,
                    background: 'var(--surface-card)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-md)',
                    zIndex: 50, marginTop: 4, maxHeight: 200, overflowY: 'auto',
                  }}>
                    {searchResults.map(c => (
                      <div key={c.Id}
                        style={{
                          padding: '10px 14px', cursor: 'pointer', fontSize: '0.8125rem',
                          borderBottom: '1px solid var(--border-light)',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}
                        onClick={() => selectCustomer(c)}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div>
                          <div style={{ fontWeight: 600 }}>{c.Name}</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{c.Phone}</div>
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)' }}>{c.Points || 0} pts</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {showAddCustomer && (
              <div style={{ padding: '12px 20px', background: '#faf9f7', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input className="form-input" placeholder="Name" value={newCustomer.Name} onChange={e => setNewCustomer(p => ({ ...p, Name: e.target.value }))} style={{ fontSize: '0.8125rem', padding: '6px 10px' }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="form-input" placeholder="Phone" value={newCustomer.Phone} onChange={e => setNewCustomer(p => ({ ...p, Phone: e.target.value }))} style={{ fontSize: '0.8125rem', padding: '6px 10px', flex: 1 }} />
                    <input className="form-input" placeholder="Email" value={newCustomer.Email} onChange={e => setNewCustomer(p => ({ ...p, Email: e.target.value }))} style={{ fontSize: '0.8125rem', padding: '6px 10px', flex: 1 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowAddCustomer(false)}>Cancel</button>
                    <button className="btn btn-accent btn-sm" onClick={addCustomer}>Save</button>
                  </div>
                </div>
              </div>
            )}

            <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 40, marginBottom: 8 }}>shopping_cart</span>
                  <div style={{ fontWeight: 600 }}>Cart is empty</div>
                  <div style={{ fontSize: '0.8125rem' }}>Tap items to add them</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {cart.map((item, idx) => (
                    <div key={`${item.id}-${idx}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{item.name}</div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                          Rs. {item.price.toFixed(2)} ea
                          {item.modifiers && item.modifiers.length > 0 && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {item.modifiers.map(m => m.optionName).join(', ')}
                              {item.modifierTotal && item.modifierTotal > 0 && (
                                <span style={{ color: 'var(--primary)', fontWeight: 600 }}> +Rs. {item.modifierTotal.toFixed(2)}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button className="btn btn-ghost btn-sm" style={{ width: 28, height: 28, padding: 0 }} onClick={() => updateQty(item.id, -1)}>
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>remove</span>
                        </button>
                        <span style={{ fontWeight: 700, width: 24, textAlign: 'center' }}>{item.quantity}</span>
                        <button className="btn btn-ghost btn-sm" style={{ width: 28, height: 28, padding: 0 }} onClick={() => updateQty(item.id, 1)}>
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                        </button>
                        <span style={{ fontWeight: 700, width: 64, textAlign: 'right', color: 'var(--primary)' }}>
                          Rs. {((item.price + (item.modifierTotal || 0)) * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', background: '#faf9f7' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
                <span style={{ fontWeight: 600 }}>Rs. {subtotal.toFixed(2)}</span>
              </div>

              {subtotal > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Discount</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={discountPercent || ''}
                        onChange={e => setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                        placeholder="0"
                        style={{
                          width: 60, padding: '4px 8px', border: '1px solid var(--border)',
                          borderRadius: 6, fontSize: '0.8125rem', fontFamily: 'Inter, sans-serif',
                          fontWeight: 600, textAlign: 'center', outline: 'none',
                        }}
                      />
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>%</span>
                    </div>
                  </div>
                  {discountPercent > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--danger)' }}>-{discountPercent}% off</span>
                      <span style={{ fontWeight: 600, color: 'var(--danger)' }}>-Rs. {discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Payment</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['Cash', 'Online', 'Card'].map(m => (
                    <button
                      key={m}
                      style={{
                        flex: 1, padding: '7px 4px', borderRadius: 6,
                        fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', fontWeight: 700,
                        cursor: 'pointer', transition: 'all 0.15s',
                        background: paymentMethod === m ? 'var(--accent)' : 'var(--surface)',
                        color: paymentMethod === m ? 'var(--primary)' : 'var(--text-secondary)',
                        border: paymentMethod === m ? '1px solid var(--accent)' : '1px solid var(--border)',
                      }}
                      onClick={() => setPaymentMethod(m)}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14, display: 'block', marginBottom: 2 }}>
                        {m === 'Cash' ? 'payments' : m === 'Online' ? 'smartphone' : 'credit_card'}
                      </span>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: '1.125rem', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <span style={{ fontWeight: 700 }}>Total</span>
                <span style={{ fontWeight: 800, color: 'var(--primary)' }}>Rs. {total.toFixed(2)}</span>
              </div>

              <button
                className="btn btn-accent"
                style={{ width: '100%', padding: 14, fontSize: '1rem', justifyContent: 'center' }}
                disabled={cart.length === 0}
                onClick={placeOrder}
              >
                <span className="material-symbols-outlined">receipt_long</span>
                Place Order
              </button>
            </div>
          </div>
        </div>
      )}

      {showModifierModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => setShowModifierModal(false)}>
          <div style={{
            background: 'var(--surface-card)', borderRadius: 'var(--radius)',
            padding: 24, width: 420, maxWidth: '90vw', maxHeight: '80vh',
            overflowY: 'auto', boxShadow: 'var(--shadow-lg)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 4 }}>
              {selectedItemForModifiers?.Name}
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
              Customize your item
            </p>

            {itemModifiers.map(mod => (
              <div key={mod.Id} style={{ marginBottom: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12 }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 8 }}>
                  {mod.Name}
                  {mod.IsRequired && <span className="badge badge-warning" style={{ marginLeft: 8, fontSize: '0.625rem', padding: '1px 6px' }}>Required</span>}
                  <span className={`badge ${mod.Type === 'select' ? 'badge-primary' : 'badge-info'}`} style={{ marginLeft: 4, fontSize: '0.625rem', padding: '1px 6px' }}>
                    {mod.Type === 'select' ? 'Select one' : 'Select multiple'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {mod.options && mod.options.length > 0 ? mod.options.map(opt => {
                    const isSelected = (selectedOptions[mod.Id] || []).includes(opt.Id)
                    return (
                      <label
                        key={opt.Id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                          borderRadius: 6, cursor: 'pointer',
                          background: isSelected ? '#f0fdf4' : 'transparent',
                          transition: 'background 0.1s',
                        }}
                      >
                        <input
                          type={mod.Type === 'select' ? 'radio' : 'checkbox'}
                          name={`mod-${mod.Id}`}
                          checked={isSelected}
                          onChange={() => toggleOption(mod.Id, opt.Id, mod.Type)}
                        />
                        <span style={{ flex: 1, fontSize: '0.8125rem' }}>{opt.Name}</span>
                        {opt.PriceAdjustment > 0 ? (
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)' }}>+Rs. {opt.PriceAdjustment.toFixed(2)}</span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Free</span>
                        )}
                      </label>
                    )
                  }) : (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '4px 8px' }}>No options available</div>
                  )}
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                Rs. {calculateTotalWithModifiers().toFixed(2)}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost" onClick={() => setShowModifierModal(false)}>Cancel</button>
                <button
                  className="btn btn-accent"
                  disabled={!allRequiredSelected}
                  onClick={confirmModifierSelection}
                >
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showVoidModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => setShowVoidModal(false)}>
          <div style={{
            background: 'var(--surface-card)', borderRadius: 'var(--radius)',
            padding: 24, width: 400, maxWidth: '90vw',
            boxShadow: 'var(--shadow-lg)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 8 }}>Void Order</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
              Are you sure you want to void this order? This action cannot be undone.
            </p>
            <textarea
              className="form-input"
              placeholder="Reason for voiding..."
              value={voidReason}
              onChange={e => setVoidReason(e.target.value)}
              style={{ minHeight: 80, resize: 'vertical', marginBottom: 16 }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowVoidModal(false)}>Cancel</button>
              <button className="btn btn-sm" style={{ background: '#ef4444', color: 'white' }} onClick={confirmVoid} disabled={!voidReason.trim()}>
                Void Order
              </button>
            </div>
          </div>
        </div>
      )}

      {showRefundModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => setShowRefundModal(false)}>
          <div style={{
            background: 'var(--surface-card)', borderRadius: 'var(--radius)',
            padding: 24, width: 400, maxWidth: '90vw',
            boxShadow: 'var(--shadow-lg)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Process Refund</h3>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Refund Amount</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                min="0"
                value={refundAmount}
                onChange={e => setRefundAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Reason</label>
              <textarea
                className="form-input"
                placeholder="Reason for refund..."
                value={refundReason}
                onChange={e => setRefundReason(e.target.value)}
                style={{ minHeight: 80, resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowRefundModal(false)}>Cancel</button>
              <button className="btn btn-sm" style={{ background: '#f59e0b', color: 'white' }} onClick={confirmRefund} disabled={!refundAmount || !refundReason.trim()}>
                Process Refund
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
