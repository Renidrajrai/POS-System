import { useEffect, useState } from 'react'
import type { Page } from '../App'
import { staffApi, type StaffMember, type StaffStats } from '../api/staff'
import { orderApi, type Order } from '../api/orders'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

interface DashboardProps {
  onNavigate: (page: Page) => void
}

const STATUS_COLORS: Record<string, string> = {
  Open: '#6b7280',
  Preparing: '#f59e0b',
  Completed: '#10b981',
  Cancelled: '#ef4444',
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getWeekDays() {
  const days: Date[] = []
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day
  const sunday = new Date(now.setDate(diff))
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday)
    d.setDate(d.getDate() + i)
    days.push(d)
  }
  return days
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const [stats, setStats] = useState<StaffStats | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [s, o, st] = await Promise.all([
          staffApi.stats(),
          orderApi.list(),
          staffApi.list(),
        ])
        setStats(s)
        setOrders(o || [])
        setStaff(st)
      } catch (err) {
        console.error('Dashboard load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Loading dashboard...</div>
  }

  const statCards = [
    { label: 'Total Staff', value: String(stats?.total ?? 0), icon: 'groups', color: '#6366f1', bg: '#eef2ff', change: `${staff.filter(s => s.Status === 'Active').length} active` },
    { label: 'Active Orders', value: String(orders.filter(o => o.Status !== 'Completed').length), icon: 'receipt_long', color: '#f59e0b', bg: '#fffbeb', change: `${orders.filter(o => o.Status === 'Open' || o.Status === 'Preparing').length} ongoing` },
    { label: 'On Shift', value: String(stats?.onShift ?? 0), icon: 'badge', color: '#10b981', bg: '#ecfdf5', change: `${stats?.lateCount ?? 0} late today` },
    { label: 'On Leave', value: String(stats?.onLeave ?? 0), icon: 'event_busy', color: '#ef4444', bg: '#fef2f2', change: 'today' },
  ]

  const schedule = staff.slice(0, 4).map(s => ({
    id: s.Id,
    name: `${s.FirstName} ${s.LastName}`,
    role: s.Role,
    time: s.Shift,
    status: s.Status === 'Active' ? 'on-time' as const : 'late' as const,
  }))

  const recentOrders = orders.slice(0, 5).map(o => ({
    id: o.OrderNumber,
    customer: o.CustomerName || 'Walk-in',
    items: `Order #${o.Id}`,
    total: `Rs. ${Number(o.Amount).toFixed(2)}`,
    payment: o.PaymentMethod || 'Cash',
    status: (o.Status.toLowerCase() === 'completed' ? 'completed' : o.Status.toLowerCase() === 'preparing' ? 'preparing' : 'pending') as 'completed' | 'preparing' | 'pending',
    time: new Date(o.CreatedAt).toLocaleTimeString(),
  }))

  const orderStatusConfig = {
    completed: { label: 'Completed', className: 'badge badge-success' },
    preparing: { label: 'Preparing', className: 'badge badge-warning' },
    pending: { label: 'Open', className: 'badge badge-neutral' },
  }

  // Chart data
  const statusData = Object.entries(
    orders.reduce<Record<string, number>>((acc, o) => {
      acc[o.Status] = (acc[o.Status] || 0) + 1
      return acc
    }, {})
  ).map(([name, value]) => ({ name, value, color: STATUS_COLORS[name] || '#6b7280' }))

  const weekDays = getWeekDays()
  const dailyRevenue = weekDays.map(day => {
    const dayStr = day.toISOString().slice(0, 10)
    const dayOrders = orders.filter(o => o.CreatedAt?.startsWith(dayStr))
    return {
      day: DAYS[day.getDay()],
      revenue: dayOrders.reduce((sum, o) => sum + Number(o.Amount), 0),
      orders: dayOrders.length,
    }
  })

  const weeklyRevenue = dailyRevenue.reduce((sum, d) => sum + d.revenue, 0)

  return (
    <>
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {statCards.map(s => (
          <div className="stat-card" key={s.label}>
            <div className="stat-card-header">
              <span className="stat-card-label">{s.label}</span>
              <div className="stat-card-icon" style={{ background: s.bg, color: s.color }}>
                <span className="material-symbols-outlined">{s.icon}</span>
              </div>
            </div>
            <div className="stat-card-value">{s.value}</div>
            <div className="stat-card-change" style={{ color: s.color }}>{s.change}</div>
          </div>
        ))}
      </div>

      <div className="grid-3" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Weekly Revenue</h3>
            <span style={{ fontWeight: 800, color: 'var(--accent)', fontSize: '1.125rem' }}>Rs. {weeklyRevenue.toFixed(2)}</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="revenue" fill="#d4a843" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Order Status</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {statusData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend
                verticalAlign="bottom"
                height={30}
                formatter={(value) => <span style={{ fontSize: '0.8125rem', color: 'var(--text)' }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Staff On Duty</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('staff')}>View All</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {schedule.map(s => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{s.name}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{s.role} &middot; {s.time}</div>
                </div>
                <span className={s.status === 'late' ? 'badge badge-danger' : 'badge badge-success'}>
                  {s.status === 'late' ? 'Late' : 'On Time'}
                </span>
              </div>
            ))}
            {schedule.length === 0 && (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textAlign: 'center', padding: 16 }}>No staff data</div>
            )}
          </div>
        </div>
      </div>

      <div className="stat-card" style={{ marginBottom: 24 }}>
        <div className="stat-card-header">
          <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Revenue Trend</h3>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>This Week</span>
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={dailyRevenue}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Line type="monotone" dataKey="revenue" stroke="#d4a843" strokeWidth={3} dot={{ fill: '#d4a843', r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="data-table">
        <div className="data-table-header">
          <h3>Recent Orders</h3>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('orders')}>View All</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Total</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {recentOrders.map(order => (
              <tr key={order.id}>
                <td style={{ fontWeight: 600 }}>{order.id}</td>
                <td>{order.customer}</td>
                <td>{order.items}</td>
                <td style={{ fontWeight: 600 }}>{order.total}</td>
                <td>{order.payment}</td>
                <td><span className={orderStatusConfig[order.status].className}>{orderStatusConfig[order.status].label}</span></td>
                <td style={{ color: 'var(--text-secondary)' }}>{order.time}</td>
              </tr>
            ))}
            {recentOrders.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No orders yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
