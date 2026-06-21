import { useEffect, useState } from 'react'
import { procurementApi, type Supplier, type PurchaseOrder, type PurchaseOrderItem } from '../api/procurement'

type Tab = 'suppliers' | 'purchase-orders' | 'goods-receiving'

const TABS: { key: Tab; label: string }[] = [
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'purchase-orders', label: 'Purchase Orders' },
  { key: 'goods-receiving', label: 'Goods Receiving' },
]

interface SupplierForm {
  Name: string
  ContactPerson: string
  Phone: string
  Email: string
  Address: string
  Status: string
}

const emptySupplier: SupplierForm = {
  Name: '', ContactPerson: '', Phone: '', Email: '', Address: '', Status: 'Active',
}

interface POItemForm {
  ItemName: string
  Quantity: string
  Unit: string
  UnitPrice: string
}

interface POForm {
  SupplierId: string
  ExpectedDate: string
  Notes: string
  items: POItemForm[]
}

const emptyPOForm: POForm = {
  SupplierId: '', ExpectedDate: '', Notes: '', items: [],
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'Draft': return 'badge badge-neutral'
    case 'Sent': return 'badge badge-warning'
    case 'Received': return 'badge badge-success'
    case 'Cancelled': return 'badge badge-danger'
    default: return 'badge badge-neutral'
  }
}

export function Procurement() {
  const [activeTab, setActiveTab] = useState<Tab>('suppliers')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)

  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<number | null>(null)
  const [supplierForm, setSupplierForm] = useState<SupplierForm>(emptySupplier)

  const [showPOModal, setShowPOModal] = useState(false)
  const [poForm, setPOForm] = useState<POForm>(emptyPOForm)
  const [editingPO, setEditingPO] = useState<number | null>(null)

  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null)
  const [poItems, setPOItems] = useState<PurchaseOrderItem[]>([])

  const [showReceiveModal, setShowReceiveModal] = useState(false)
  const [receiveOrder, setReceiveOrder] = useState<PurchaseOrder | null>(null)
  const [receiveItems, setReceiveItems] = useState<{ itemId: number; itemName: string; orderedQty: number; receivedQty: string; acceptedQty: string }[]>([])
  const [receiveNotes, setReceiveNotes] = useState('')

  const loadSuppliers = async () => {
    try {
      const data = await procurementApi.suppliers.list()
      setSuppliers(data || [])
    } catch (err) {
      console.error('Load suppliers error:', err)
    }
  }

  const loadPOs = async () => {
    try {
      const data = await procurementApi.purchaseOrders.list()
      setPurchaseOrders(data || [])
    } catch (err) {
      console.error('Load POs error:', err)
    }
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([loadSuppliers(), loadPOs()])
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const openAddSupplier = () => {
    setEditingSupplier(null)
    setSupplierForm(emptySupplier)
    setShowSupplierModal(true)
  }

  const openEditSupplier = (s: Supplier) => {
    setEditingSupplier(s.Id)
    setSupplierForm({
      Name: s.Name,
      ContactPerson: s.ContactPerson,
      Phone: s.Phone,
      Email: s.Email,
      Address: s.Address || '',
      Status: s.Status,
    })
    setShowSupplierModal(true)
  }

  const saveSupplier = async () => {
    if (!supplierForm.Name || !supplierForm.ContactPerson) return
    try {
      if (editingSupplier) {
        const updated = await procurementApi.suppliers.update(editingSupplier, supplierForm)
        setSuppliers(prev => prev.map(s => s.Id === editingSupplier ? updated : s))
      } else {
        const created = await procurementApi.suppliers.create(supplierForm)
        setSuppliers(prev => [...prev, created])
      }
      setShowSupplierModal(false)
      setSupplierForm(emptySupplier)
    } catch (err) {
      console.error('Save supplier error:', err)
    }
  }

  const deleteSupplier = async (id: number) => {
    try {
      await procurementApi.suppliers.delete(id)
      setSuppliers(prev => prev.filter(s => s.Id !== id))
    } catch (err) {
      console.error('Delete supplier error:', err)
    }
  }

  const openAddPO = () => {
    setEditingPO(null)
    setPOForm(emptyPOForm)
    setShowPOModal(true)
  }

  const addPOItem = () => {
    setPOForm(prev => ({
      ...prev,
      items: [...prev.items, { ItemName: '', Quantity: '', Unit: 'kg', UnitPrice: '' }],
    }))
  }

  const removePOItem = (idx: number) => {
    setPOForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))
  }

  const updatePOItem = (idx: number, field: keyof POItemForm, value: string) => {
    setPOForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === idx ? { ...item, [field]: value } : item),
    }))
  }

  const savePO = async () => {
    if (!poForm.SupplierId) return
    const items = poForm.items.filter(i => i.ItemName && i.Quantity).map(i => ({
      ItemName: i.ItemName,
      Quantity: parseFloat(i.Quantity),
      Unit: i.Unit,
      UnitPrice: parseFloat(i.UnitPrice || '0'),
      TotalPrice: parseFloat(i.Quantity) * parseFloat(i.UnitPrice || '0'),
    }))
    const totalAmount = items.reduce((sum, i) => sum + i.TotalPrice, 0)
    const payload: Record<string, unknown> = {
      SupplierId: parseInt(poForm.SupplierId),
      ExpectedDate: poForm.ExpectedDate ? new Date(poForm.ExpectedDate).toISOString() : new Date().toISOString(),
      Notes: poForm.Notes,
      TotalAmount: totalAmount,
      items,
    }
    try {
      if (editingPO) {
        await procurementApi.purchaseOrders.update(editingPO, payload as any)
      } else {
        await procurementApi.purchaseOrders.create(payload as any)
      }
      await loadPOs()
      setShowPOModal(false)
      setPOForm(emptyPOForm)
    } catch (err) {
      console.error('Save PO error:', err)
    }
  }

  const viewPODetails = async (po: PurchaseOrder) => {
    try {
      const full = await procurementApi.purchaseOrders.get(po.Id)
      setSelectedPO(full)
      setPOItems(full.items || [])
    } catch (err) {
      console.error('Load PO details error:', err)
    }
  }

  const updatePOStatus = async (id: number, status: string) => {
    try {
      await procurementApi.purchaseOrders.updateStatus(id, status)
      await loadPOs()
      if (selectedPO?.Id === id) setSelectedPO(null)
    } catch (err) {
      console.error('Update PO status error:', err)
    }
  }

  const openReceive = (po: PurchaseOrder) => {
    setReceiveOrder(po)
    setReceiveItems((po.items || []).map(item => ({
      itemId: item.Id,
      itemName: item.ItemName,
      orderedQty: item.Quantity,
      receivedQty: String(item.Quantity),
      acceptedQty: String(item.Quantity),
    })))
    setReceiveNotes('')
    setShowReceiveModal(true)
  }

  const saveReceive = async () => {
    if (!receiveOrder) return
    try {
      await procurementApi.purchaseOrders.receive(receiveOrder.Id, {
        items: receiveItems.map(i => ({
          purchaseOrderItemId: i.itemId,
          receivedQuantity: parseFloat(i.receivedQty),
          acceptedQuantity: parseFloat(i.acceptedQty),
        })),
        notes: receiveNotes,
      })
      await loadPOs()
      setShowReceiveModal(false)
      setReceiveOrder(null)
    } catch (err) {
      console.error('Save receive error:', err)
    }
  }

  const sentPOs = purchaseOrders.filter(po => po.Status === 'Sent')

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Loading procurement...</div>
  }

  return (
    <>
      <div style={{ marginBottom: 24, borderBottom: '1px solid var(--border)', display: 'flex', gap: 0 }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`btn btn-sm`}
            style={{
              borderRadius: 0, padding: '12px 24px', borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'none', color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab.key ? 700 : 500,
            }}
            onClick={() => { setActiveTab(tab.key); setSelectedPO(null) }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'suppliers' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary btn-sm" onClick={openAddSupplier}>
              <span className="material-symbols-outlined">add</span> Add Supplier
            </button>
          </div>
          <div className="data-table">
            <div className="data-table-header">
              <h3>Suppliers</h3>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact Person</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map(s => (
                  <tr key={s.Id}>
                    <td style={{ fontWeight: 600 }}>{s.Name}</td>
                    <td>{s.ContactPerson}</td>
                    <td>{s.Phone}</td>
                    <td>{s.Email}</td>
                    <td><span className={s.Status === 'Active' ? 'badge badge-success' : 'badge badge-neutral'}>{s.Status}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }} onClick={() => openEditSupplier(s)}>
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', color: 'var(--danger)' }} onClick={() => deleteSupplier(s.Id)}>
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {suppliers.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>No suppliers found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'purchase-orders' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary btn-sm" onClick={openAddPO}>
              <span className="material-symbols-outlined">add</span> New PO
            </button>
          </div>

          {selectedPO ? (
            <div className="stat-card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 4 }}>PO #{selectedPO.OrderNumber}</h3>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    Supplier: {selectedPO.SupplierName || `ID ${selectedPO.SupplierId}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className={getStatusBadge(selectedPO.Status)}>{selectedPO.Status}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelectedPO(null)}>
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {selectedPO.Status === 'Draft' && (
                  <button className="btn btn-accent btn-sm" onClick={() => updatePOStatus(selectedPO.Id, 'Sent')}>
                    <span className="material-symbols-outlined">send</span> Send PO
                  </button>
                )}
                {selectedPO.Status === 'Sent' && (
                  <button className="btn btn-accent btn-sm" onClick={() => openReceive(selectedPO)}>
                    <span className="material-symbols-outlined">assignment_turned_in</span> Receive
                  </button>
                )}
              </div>
              <div className="data-table">
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Quantity</th>
                      <th>Unit</th>
                      <th>Unit Price</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {poItems.map(item => (
                      <tr key={item.Id}>
                        <td style={{ fontWeight: 600 }}>{item.ItemName}</td>
                        <td>{item.Quantity}</td>
                        <td>{item.Unit}</td>
                        <td>Rs. {Number(item.UnitPrice).toFixed(2)}</td>
                        <td style={{ fontWeight: 700 }}>Rs. {Number(item.TotalPrice).toFixed(2)}</td>
                      </tr>
                    ))}
                    {poItems.length === 0 && (
                      <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>No items</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div className="data-table">
            <div className="data-table-header">
              <h3>Purchase Orders</h3>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Supplier</th>
                  <th>Status</th>
                  <th>Order Date</th>
                  <th>Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.map(po => (
                  <tr key={po.Id} style={{ cursor: 'pointer' }} onClick={() => viewPODetails(po)}>
                    <td style={{ fontWeight: 600 }}>{po.OrderNumber}</td>
                    <td>{po.SupplierName || `Supplier #${po.SupplierId}`}</td>
                    <td><span className={getStatusBadge(po.Status)}>{po.Status}</span></td>
                    <td>{po.OrderDate ? new Date(po.OrderDate).toLocaleDateString() : '-'}</td>
                    <td style={{ fontWeight: 700 }}>Rs. {Number(po.TotalAmount).toFixed(2)}</td>
                  </tr>
                ))}
                {purchaseOrders.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>No purchase orders</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'goods-receiving' && (
        <div className="data-table">
          <div className="data-table-header">
            <h3>Pending Receiving</h3>
          </div>
          <table>
            <thead>
              <tr>
                <th>Order #</th>
                <th>Supplier</th>
                <th>Order Date</th>
                <th>Total Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sentPOs.map(po => (
                <tr key={po.Id}>
                  <td style={{ fontWeight: 600 }}>{po.OrderNumber}</td>
                  <td>{po.SupplierName || `Supplier #${po.SupplierId}`}</td>
                  <td>{po.OrderDate ? new Date(po.OrderDate).toLocaleDateString() : '-'}</td>
                  <td style={{ fontWeight: 700 }}>Rs. {Number(po.TotalAmount).toFixed(2)}</td>
                  <td>
                    <button className="btn btn-accent btn-sm" onClick={async () => {
                      await viewPODetails(po)
                      openReceive(po)
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>assignment_turned_in</span> Receive
                    </button>
                  </td>
                </tr>
              ))}
              {sentPOs.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>No pending receipts</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showSupplierModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setShowSupplierModal(false)}>
          <div style={{
            background: 'var(--surface-card)', borderRadius: 'var(--radius)',
            padding: 32, width: 520, maxWidth: '90vw', maxHeight: '90vh',
            overflowY: 'auto', boxShadow: 'var(--shadow-lg)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 24 }}>
              {editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Supplier Name</label>
                <input className="form-input" value={supplierForm.Name} onChange={e => setSupplierForm(p => ({ ...p, Name: e.target.value }))} placeholder="Company name" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Contact Person</label>
                  <input className="form-input" value={supplierForm.ContactPerson} onChange={e => setSupplierForm(p => ({ ...p, ContactPerson: e.target.value }))} placeholder="Full name" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Status</label>
                  <select className="form-input form-select" value={supplierForm.Status} onChange={e => setSupplierForm(p => ({ ...p, Status: e.target.value }))}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Phone</label>
                  <input className="form-input" value={supplierForm.Phone} onChange={e => setSupplierForm(p => ({ ...p, Phone: e.target.value }))} placeholder="+1 555-0000" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Email</label>
                  <input className="form-input" type="email" value={supplierForm.Email} onChange={e => setSupplierForm(p => ({ ...p, Email: e.target.value }))} placeholder="email@example.com" />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Address</label>
                <textarea className="form-input" style={{ resize: 'vertical', minHeight: 50 }} value={supplierForm.Address} onChange={e => setSupplierForm(p => ({ ...p, Address: e.target.value }))} placeholder="Supplier address" />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowSupplierModal(false)}>Cancel</button>
              <button className="btn btn-accent" onClick={saveSupplier}>
                {editingSupplier ? 'Update' : 'Add'} Supplier
              </button>
            </div>
          </div>
        </div>
      )}

      {showPOModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setShowPOModal(false)}>
          <div style={{
            background: 'var(--surface-card)', borderRadius: 'var(--radius)',
            padding: 32, width: 640, maxWidth: '90vw', maxHeight: '90vh',
            overflowY: 'auto', boxShadow: 'var(--shadow-lg)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 24 }}>
              {editingPO ? 'Edit Purchase Order' : 'New Purchase Order'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Supplier</label>
                  <select className="form-input form-select" value={poForm.SupplierId} onChange={e => setPOForm(p => ({ ...p, SupplierId: e.target.value }))}>
                    <option value="">Select supplier</option>
                    {suppliers.map(s => (
                      <option key={s.Id} value={s.Id}>{s.Name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Expected Date</label>
                  <input className="form-input" type="date" value={poForm.ExpectedDate} onChange={e => setPOForm(p => ({ ...p, ExpectedDate: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Notes</label>
                <textarea className="form-input" style={{ resize: 'vertical', minHeight: 40 }} value={poForm.Notes} onChange={e => setPOForm(p => ({ ...p, Notes: e.target.value }))} placeholder="Optional notes" />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>Items</span>
                <button className="btn btn-ghost btn-sm" onClick={addPOItem}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span> Add Item
                </button>
              </div>
              {poForm.items.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {poForm.items.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                      <div style={{ flex: 2 }}>
                        <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>Item</label>
                        <input className="form-input" style={{ padding: '8px 10px', fontSize: '0.8125rem' }} value={item.ItemName} onChange={e => updatePOItem(idx, 'ItemName', e.target.value)} placeholder="Item name" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>Qty</label>
                        <input className="form-input" style={{ padding: '8px 10px', fontSize: '0.8125rem' }} type="number" min="0" step="0.01" value={item.Quantity} onChange={e => updatePOItem(idx, 'Quantity', e.target.value)} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>Unit</label>
                        <select className="form-input form-select" style={{ padding: '8px 10px', fontSize: '0.8125rem' }} value={item.Unit} onChange={e => updatePOItem(idx, 'Unit', e.target.value)}>
                          <option value="kg">kg</option>
                          <option value="g">g</option>
                          <option value="L">L</option>
                          <option value="ml">ml</option>
                          <option value="pcs">pcs</option>
                          <option value="box">box</option>
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>Unit Price</label>
                        <input className="form-input" style={{ padding: '8px 10px', fontSize: '0.8125rem' }} type="number" min="0" step="0.01" value={item.UnitPrice} onChange={e => updatePOItem(idx, 'UnitPrice', e.target.value)} />
                      </div>
                      <div style={{ flex: 1, textAlign: 'center', padding: '8px 0', fontWeight: 700, fontSize: '0.8125rem' }}>
                        Rs. {(parseFloat(item.Quantity || '0') * parseFloat(item.UnitPrice || '0')).toFixed(2)}
                      </div>
                      <button className="btn btn-ghost btn-sm" style={{ padding: '4px 6px', color: 'var(--danger)' }} onClick={() => removePOItem(idx)}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {poForm.items.length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8125rem', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)' }}>
                  No items added. Click "Add Item" to add line items.
                </div>
              )}
              <div style={{ textAlign: 'right', marginTop: 12, fontWeight: 700, fontSize: '0.9375rem' }}>
                Total: Rs. {poForm.items.reduce((sum, i) => sum + (parseFloat(i.Quantity || '0') * parseFloat(i.UnitPrice || '0')), 0).toFixed(2)}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowPOModal(false)}>Cancel</button>
              <button className="btn btn-accent" onClick={savePO}>
                {editingPO ? 'Update' : 'Create'} Purchase Order
              </button>
            </div>
          </div>
        </div>
      )}

      {showReceiveModal && receiveOrder && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setShowReceiveModal(false)}>
          <div style={{
            background: 'var(--surface-card)', borderRadius: 'var(--radius)',
            padding: 32, width: 600, maxWidth: '90vw', maxHeight: '90vh',
            overflowY: 'auto', boxShadow: 'var(--shadow-lg)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 8 }}>Goods Receiving</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
              PO #{receiveOrder.OrderNumber} - {receiveOrder.SupplierName || `Supplier #${receiveOrder.SupplierId}`}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              {receiveItems.map((item, idx) => (
                <div key={item.itemId} style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 8 }}>{item.itemName}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 8 }}>Ordered: {item.orderedQty}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>Received Quantity</label>
                      <input className="form-input" style={{ padding: '8px 10px', fontSize: '0.8125rem' }} type="number" min="0" step="0.01" value={item.receivedQty} onChange={e => {
                        const updated = [...receiveItems]
                        updated[idx] = { ...updated[idx], receivedQty: e.target.value }
                        setReceiveItems(updated)
                      }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>Accepted Quantity</label>
                      <input className="form-input" style={{ padding: '8px 10px', fontSize: '0.8125rem' }} type="number" min="0" step="0.01" value={item.acceptedQty} onChange={e => {
                        const updated = [...receiveItems]
                        updated[idx] = { ...updated[idx], acceptedQty: e.target.value }
                        setReceiveItems(updated)
                      }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Receiving Notes</label>
              <textarea className="form-input" style={{ resize: 'vertical', minHeight: 40 }} value={receiveNotes} onChange={e => setReceiveNotes(e.target.value)} placeholder="Any notes about this receipt" />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowReceiveModal(false)}>Cancel</button>
              <button className="btn btn-accent" onClick={saveReceive}>
                <span className="material-symbols-outlined">assignment_turned_in</span> Save Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
