import { useEffect, useState } from 'react'
import {
  reportApi, type DailySalesRow, type PeriodSales, type TopItem,
  type FoodCostItem, type PLSummary, type OrderStatusSummary,
} from '../api/reports'

function formatDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function getMonthStart() {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

function getMonthEnd() {
  const d = new Date()
  d.setMonth(d.getMonth() + 1, 0)
  d.setHours(23, 59, 59, 999)
  return d
}

function getProfitColor(margin: number) {
  if (margin > 60) return '#10b981'
  if (margin > 40) return '#f59e0b'
  return '#ef4444'
}

export function Reports() {
  const [startDate, setStartDate] = useState(formatDate(getMonthStart()))
  const [endDate, setEndDate] = useState(formatDate(getMonthEnd()))

  const [loading, setLoading] = useState(false)
  const [plSummary, setPLSummary] = useState<PLSummary | null>(null)
  const [periodSales, setPeriodSales] = useState<PeriodSales | null>(null)
  const [dailySales, setDailySales] = useState<DailySalesRow[]>([])
  const [topItems, setTopItems] = useState<TopItem[]>([])
  const [foodCost, setFoodCost] = useState<FoodCostItem[]>([])
  const [orderStatus, setOrderStatus] = useState<OrderStatusSummary[]>([])

  const generate = async () => {
    setLoading(true)
    const safe = async <T,>(p: Promise<T>, fn: (v: T) => void) => { try { fn(await p) } catch (e) { console.error(e) } }
    await Promise.all([
      safe(reportApi.plSummary(startDate, endDate), setPLSummary),
      safe(reportApi.periodSales(startDate, endDate), setPeriodSales),
      safe(reportApi.dailySales(formatDate(new Date())), v => setDailySales(v || [])),
      safe(reportApi.topItems(startDate, endDate), v => setTopItems(v || [])),
      safe(reportApi.foodCost(), v => setFoodCost(v || [])),
      safe(reportApi.orderStatusSummary(), v => setOrderStatus(v || [])),
    ])
    setLoading(false)
  }

  useEffect(() => {
    generate()
  }, [])

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>Start Date</label>
            <input className="form-input" type="date" style={{ width: 160, padding: '8px 12px', fontSize: '0.8125rem' }} value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>End Date</label>
            <input className="form-input" type="date" style={{ width: 160, padding: '8px 12px', fontSize: '0.8125rem' }} value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <button className="btn btn-accent btn-sm" style={{ marginTop: 20 }} onClick={generate} disabled={loading}>
            <span className="material-symbols-outlined">refresh</span> Generate
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Loading reports...</div>
      ) : (
        <>
          <div className="grid-4" style={{ marginBottom: 24 }}>
            <div className="stat-card">
              <div className="stat-card-header">
                <span className="stat-card-label">Total Revenue</span>
              </div>
              <div className="stat-card-value">Rs. {(plSummary?.totalRevenue ?? 0).toFixed(2)}</div>
              <div className="stat-card-change" style={{ color: 'var(--accent)' }}>{periodSales?.totalOrders ?? 0} orders</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-header">
                <span className="stat-card-label">Total Orders</span>
              </div>
              <div className="stat-card-value">{plSummary?.totalOrders ?? 0}</div>
              <div className="stat-card-change" style={{ color: 'var(--text-secondary)' }}>Selected period</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-header">
                <span className="stat-card-label">Avg Order Value</span>
              </div>
              <div className="stat-card-value">Rs. {(periodSales?.avgOrderValue ?? 0).toFixed(2)}</div>
              <div className="stat-card-change" style={{ color: 'var(--text-secondary)' }}>Per order</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-header">
                <span className="stat-card-label">Gross Profit Margin</span>
              </div>
              <div className="stat-card-value" style={{ color: getProfitColor(plSummary?.grossProfitMargin ?? 0) }}>
                {(plSummary?.grossProfitMargin ?? 0).toFixed(1)}%
              </div>
              <div className="stat-card-change" style={{ color: getProfitColor(plSummary?.grossProfitMargin ?? 0) }}>
                {(plSummary?.grossProfitMargin ?? 0) > 60 ? 'Healthy' : (plSummary?.grossProfitMargin ?? 0) > 40 ? 'Moderate' : 'Low'}
              </div>
            </div>
          </div>

          <div className="grid-2" style={{ marginBottom: 24 }}>
            <div className="data-table">
              <div className="data-table-header">
                <h3>Sales by Payment Method</h3>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Count</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(periodSales?.byPaymentMethod ?? []).map(pm => (
                    <tr key={pm.method}>
                      <td style={{ fontWeight: 600 }}>{pm.method}</td>
                      <td>{pm.count}</td>
                      <td style={{ fontWeight: 700 }}>Rs. {pm.total.toFixed(2)}</td>
                    </tr>
                  ))}
                  {(periodSales?.byPaymentMethod ?? []).length === 0 && (
                    <tr><td colSpan={3} style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>No data</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="data-table">
              <div className="data-table-header">
                <h3>Sales by Order Type</h3>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Count</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(periodSales?.byOrderType ?? []).map(ot => (
                    <tr key={ot.type}>
                      <td style={{ fontWeight: 600 }}>{ot.type}</td>
                      <td>{ot.count}</td>
                      <td style={{ fontWeight: 700 }}>Rs. {ot.total.toFixed(2)}</td>
                    </tr>
                  ))}
                  {(periodSales?.byOrderType ?? []).length === 0 && (
                    <tr><td colSpan={3} style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>No data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="stat-card" style={{ marginBottom: 24 }}>
            <div className="stat-card-header">
              <h3>Today's Summary</h3>
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ background: '#faf9f7', borderRadius: 'var(--radius-sm)', padding: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>Total Orders</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>
                    {dailySales.reduce((s, r) => s + r.orderCount, 0)}
                  </div>
                </div>
                <div style={{ background: '#faf9f7', borderRadius: 'var(--radius-sm)', padding: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>Revenue</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent)' }}>
                    Rs. {dailySales.reduce((s, r) => s + r.revenue, 0).toFixed(2)}
                  </div>
                </div>
                <div style={{ background: '#faf9f7', borderRadius: 'var(--radius-sm)', padding: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>Avg Order</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>
                    Rs. {(dailySales.reduce((s, r) => s + r.revenue, 0) / Math.max(dailySales.reduce((s, r) => s + r.orderCount, 0), 1)).toFixed(2)}
                  </div>
                </div>
                <div style={{ background: '#faf9f7', borderRadius: 'var(--radius-sm)', padding: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>Peak Hour</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b' }}>
                    {dailySales.length > 0
                      ? `${dailySales.reduce((a, b) => a.orderCount > b.orderCount ? a : b).hour}:00`
                      : '-'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid-2" style={{ marginBottom: 24 }}>
            <div className="data-table">
              <div className="data-table-header">
                <h3>Top Items</h3>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>Quantity Sold</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topItems.slice(0, 10).map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{item.name}</td>
                      <td>{item.quantitySold}</td>
                      <td style={{ fontWeight: 700 }}>Rs. {item.revenue.toFixed(2)}</td>
                    </tr>
                  ))}
                  {topItems.length === 0 && (
                    <tr><td colSpan={3} style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>No data</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="data-table">
              <div className="data-table-header">
                <h3>Order Completion</h3>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Count</th>
                    <th>% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orderStatus.length > 0 ? (() => {
                    const total = orderStatus.reduce((s, o) => s + o.count, 0)
                    return orderStatus.map(os => (
                      <tr key={os.status}>
                        <td>
                          <span className={
                            os.status === 'Completed' ? 'badge badge-success'
                            : os.status === 'Cancelled' ? 'badge badge-danger'
                            : os.status === 'Open' ? 'badge badge-warning'
                            : 'badge badge-neutral'
                          }>{os.status}</span>
                        </td>
                        <td style={{ fontWeight: 700 }}>{os.count}</td>
                        <td style={{ fontWeight: 700 }}>{total > 0 ? ((os.count / total) * 100).toFixed(0) : 0}%</td>
                      </tr>
                    ))
                  })() : (
                    <tr><td colSpan={3} style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>No data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="data-table" style={{ marginBottom: 24 }}>
            <div className="data-table-header">
              <h3>Food Cost Analysis</h3>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Category</th>
                  <th>Sell Price</th>
                  <th>Total Cost</th>
                  <th>Profit Margin</th>
                  <th>Ingredient Count</th>
                </tr>
              </thead>
              <tbody>
                {foodCost.map(item => (
                  <tr key={item.menuItemId}>
                    <td style={{ fontWeight: 600 }}>{item.itemName}</td>
                    <td>{item.category}</td>
                    <td>Rs. {item.sellPrice.toFixed(2)}</td>
                    <td>Rs. {item.totalCost.toFixed(2)}</td>
                    <td>
                      <span style={{ color: getProfitColor(item.profitMargin), fontWeight: 700 }}>
                        {item.profitMargin.toFixed(1)}%
                      </span>
                    </td>
                    <td>{item.ingredientCount}</td>
                  </tr>
                ))}
                {foodCost.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>No data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}
