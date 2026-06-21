import { useEffect, useState } from 'react'
import { staffApi, type StaffMember, type StaffSchedule, type StaffLeave } from '../api/staff'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const SHIFTS = ['9-7', '10-8', '11-9']
const SHIFT_INFO: Record<string, string> = {
  '9-7': '9am - 7pm',
  '10-8': '10am - 8pm',
  '11-9': '11am - 9pm',
}

const shiftColors: Record<string, { bg: string; text: string }> = {
  '9-7': { bg: '#eef2ff', text: '#4f46e5' },
  '10-8': { bg: '#ecfdf5', text: '#059669' },
  '11-9': { bg: '#fef3c7', text: '#d97706' },
}

function getWeekStart(d: Date) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function formatLocalDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function addDays(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function getDateForDay(weekStart: Date, dayName: string) {
  const d = new Date(weekStart)
  d.setDate(d.getDate() + DAYS.indexOf(dayName))
  return d
}

export function Schedule() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [schedules, setSchedules] = useState<StaffSchedule[]>([])
  const [leaves, setLeaves] = useState<StaffLeave[]>([])
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()))
  const [loading, setLoading] = useState(true)
  const [editingCell, setEditingCell] = useState<{ staffId: number; day: string } | null>(null)
  const [editShift, setEditShift] = useState('')

  const todayStr = formatLocalDate(new Date())

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const ws = formatLocalDate(weekStart)
        const we = formatLocalDate(addDays(weekStart, 6))
        const [st, sched, lv] = await Promise.all([
          staffApi.list(),
          staffApi.schedules.week(ws),
          staffApi.leaves.all(ws, we),
        ])
        setStaff(st)
        setSchedules(sched)
        setLeaves(lv)
      } catch (err) {
        console.error('Schedule load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [weekStart])

  const getSchedule = (staffId: number, day: string) => {
    const d = getDateForDay(weekStart, day)
    const ds = formatLocalDate(d)
    return schedules.find(s => s.StaffId === staffId && s.Date.slice(0, 10) === ds)
  }

  const isOnLeave = (staffId: number, day: string) => {
    const d = getDateForDay(weekStart, day)
    const ds = formatLocalDate(d)
    const sched = getSchedule(staffId, day)
    if (sched?.ShiftType === 'Leave') return true
    return leaves.some(l =>
      l.StaffId === staffId &&
      ds >= formatLocalDate(new Date(l.StartDate)) &&
      ds <= formatLocalDate(new Date(l.EndDate)) &&
      l.Status === 'Approved'
    )
  }

  const saveSchedule = async (staffId: number, day: string) => {
    const d = getDateForDay(weekStart, day)
    const dateStr = formatLocalDate(d)
    try {
      if (editShift === 'Leave') {
        await staffApi.leaves.create({
          StaffId: staffId,
          StartDate: dateStr,
          EndDate: dateStr,
          LeaveType: 'Scheduled',
          Reason: 'Scheduled day off',
          Status: 'Approved',
        })
        setLeaves(prev => [...prev, {
          Id: Date.now(),
          StaffId: staffId,
          StartDate: new Date(dateStr).toISOString(),
          EndDate: new Date(dateStr).toISOString(),
          LeaveType: 'Scheduled',
          Reason: 'Scheduled day off',
          Status: 'Approved',
          CreatedAt: new Date().toISOString(),
          StaffFirstName: staff.find(s => s.Id === staffId)?.FirstName,
          StaffLastName: staff.find(s => s.Id === staffId)?.LastName,
        } as any])
      } else {
        const saved = await staffApi.schedules.save({
          StaffId: staffId,
          Date: dateStr,
          StartTime: editShift,
          EndTime: '',
          ShiftType: editShift,
          Notes: '',
        })
        setSchedules(prev => {
          const idx = prev.findIndex(s => s.Id === saved.Id)
          if (idx >= 0) {
            const updated = [...prev]
            updated[idx] = saved
            return updated
          }
          return [...prev, saved]
        })
      }
    } catch (err) {
      console.error('Save error:', err)
    }
    setEditingCell(prev => prev?.staffId === staffId && prev?.day === day ? null : prev)
  }

  const removeSchedule = async (staffId: number, day: string) => {
    const sched = getSchedule(staffId, day)
    if (sched) {
      try {
        await staffApi.schedules.delete(sched.Id)
        setSchedules(prev => prev.filter(s => s.Id !== sched.Id))
      } catch (err) {
        console.error('Delete error:', err)
      }
    }
    setEditingCell(prev => prev?.staffId === staffId && prev?.day === day ? null : prev)
  }

  const prevWeek = () => setWeekStart(d => addDays(d, -7))
  const nextWeek = () => setWeekStart(d => addDays(d, 7))
  const jumpToDate = (dateStr: string) => {
    if (!dateStr) return
    setWeekStart(getWeekStart(new Date(dateStr + 'T12:00:00')))
  }

  const weekLabel = `${formatLocalDate(weekStart)} - ${formatLocalDate(addDays(weekStart, 6))}`

  const exportCSV = () => {
    const rows = [['Staff', ...DAYS]]
    staff.forEach(member => {
      const row = [`${member.FirstName} ${member.LastName}`]
      DAYS.forEach(day => {
        const sched = getSchedule(member.Id, day)
        const leave = isOnLeave(member.Id, day)
        row.push(leave ? 'Leave' : sched?.ShiftType || 'Off')
      })
      rows.push(row)
    })
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `schedule-${weekLabel.replace(/ /g, '-')}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const exportPDF = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Schedule - ${weekLabel}</title>
  <style>
    body { font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif; padding: 24px; }
    h2 { font-size: 1.25rem; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #e5e7eb; padding: 8px 12px; text-align: center; }
    th { background: #f8f7f4; font-weight: 600; }
    td:first-child { text-align: left; font-weight: 600; }
    .week-label { color: #6b7280; margin-bottom: 20px; font-size: 0.875rem; }
  </style>
</head>
<body>
  <h2>Weekly Schedule</h2>
  <div class="week-label">${weekLabel}</div>
  <table>
    <thead><tr>
      <th style="text-align:left">Staff</th>
      ${DAYS.map(d => `<th>${d.slice(0, 3)}</th>`).join('')}
    </tr></thead>
    <tbody>
      ${staff.map(member => `
        <tr>
          <td>${member.FirstName} ${member.LastName}</td>
          ${DAYS.map(day => {
            const sched = getSchedule(member.Id, day)
            const leave = isOnLeave(member.Id, day)
            const label = leave ? 'Leave' : sched?.ShiftType || '-'
            return `<td>${label}</td>`
          }).join('')}
        </tr>
      `).join('')}
    </tbody>
  </table>
  <script>window.onload = function() { window.print(); window.close(); }</script>
</body>
</html>`)
    printWindow.document.close()
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Loading schedule...</div>
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Shift Schedule Planner</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" style={{ padding: '6px 10px', minWidth: 0 }} onClick={prevWeek}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
          </button>
          <span style={{ fontWeight: 600, fontSize: '0.8125rem', minWidth: 180, textAlign: 'center', color: 'var(--text-secondary)' }}>{weekLabel}</span>
          <button className="btn btn-ghost btn-sm" style={{ padding: '6px 10px', minWidth: 0 }} onClick={nextWeek}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
          </button>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem' }} onClick={() => setWeekStart(getWeekStart(new Date()))}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>today</span> Today
          </button>
          <input
            type="date"
            className="form-input"
            style={{ width: 140, padding: '6px 10px', fontSize: '0.8125rem' }}
            onChange={e => jumpToDate(e.target.value)}
            title="Jump to week"
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost btn-sm" onClick={exportCSV}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span> CSV
        </button>
        <button className="btn btn-ghost btn-sm" onClick={exportPDF}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>print</span> PDF
        </button>
      </div>

      <div className="data-table" style={{ overflowX: 'auto', fontSize: '0.875rem' }}>
        <table style={{ minWidth: 1000, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ width: 200, position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 2, padding: '14px 16px', textAlign: 'left' }}>Staff</th>
              {DAYS.map(day => {
                const d = getDateForDay(weekStart, day)
                const ds = formatLocalDate(d)
                const isToday = ds === todayStr
                return (
                  <th key={day} style={{
                    width: 130, textAlign: 'center', padding: '14px 8px',
                    background: isToday ? 'var(--accent)' : 'var(--surface)',
                    color: isToday ? 'var(--primary)' : 'var(--text-secondary)',
                  }}>
                    <div style={{ fontWeight: isToday ? 800 : 600, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{day.slice(0, 3)}</div>
                    <div style={{ fontWeight: isToday ? 700 : 400, fontSize: '0.875rem', marginTop: 2 }}>{d.getDate()}</div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {staff.map(member => (
              <tr key={member.Id} style={{ height: 64 }}>
                <td style={{
                  fontWeight: 600, position: 'sticky', left: 0,
                  background: 'var(--surface-card)', zIndex: 1,
                  padding: '8px 16px', borderBottom: '1px solid var(--border-light)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.875rem', lineHeight: 1.3 }}>{member.FirstName} {member.LastName}</span>
                    <span style={{
                      fontSize: '0.625rem', fontWeight: 500, color: '#6b7280',
                      background: '#f3f4f6', padding: '1px 6px', borderRadius: 9999,
                      whiteSpace: 'nowrap',
                    }}>{member.Role}</span>
                  </div>
                </td>
                {DAYS.map(day => {
                  const sched = getSchedule(member.Id, day)
                  const leave = isOnLeave(member.Id, day)
                  const isEditing = editingCell?.staffId === member.Id && editingCell?.day === day
                  const d = getDateForDay(weekStart, day)
                  const ds = formatLocalDate(d)
                  const isToday = ds === todayStr

                  if (isEditing) {
                    return (
                      <td key={day} style={{
                        textAlign: 'center', padding: '4px',
                        borderBottom: '1px solid var(--border-light)',
                        background: isToday ? '#fffbeb' : 'transparent',
                      }}>
                        <select
                          style={{
                            width: '100%', fontSize: '0.8125rem', padding: '8px 6px',
                            border: '2px solid var(--accent)', borderRadius: 6,
                            background: 'white', outline: 'none',
                            fontFamily: 'Inter, sans-serif', fontWeight: 600,
                          }}
                          value={editShift}
                          onChange={e => setEditShift(e.target.value)}
                          autoFocus
                          onBlur={() => {
                            if (editShift === '') removeSchedule(member.Id, day)
                            else saveSchedule(member.Id, day)
                          }}
                        >
                          <option value="">Off</option>
                          {SHIFTS.map(s => (
                            <option key={s} value={s}>{s} — {SHIFT_INFO[s]}</option>
                          ))}
                          <option value="Leave" style={{ color: '#ef4444' }}>Leave</option>
                        </select>
                      </td>
                    )
                  }

                  return (
                    <td
                      key={day}
                      style={{
                        textAlign: 'center', cursor: 'pointer', padding: '4px 6px',
                        borderBottom: '1px solid var(--border-light)',
                        background: isToday ? '#fffbeb' : 'transparent',
                        transition: 'background 0.1s',
                      }}
                      className="schedule-cell"
                      onClick={() => {
                        setEditingCell({ staffId: member.Id, day })
                        setEditShift(sched?.ShiftType || '')
                      }}
                    >
                      {leave ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <span style={{
                            display: 'inline-block', padding: '6px 18px', borderRadius: 6,
                            background: '#fff5f5', color: '#ef4444',
                            fontWeight: 700, fontSize: '0.8125rem',
                          }}>Leave</span>
                        </div>
                      ) : sched ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <span style={{
                            display: 'inline-block', padding: '6px 18px', borderRadius: 6,
                            background: shiftColors[sched.ShiftType]?.bg || '#f3f4f6',
                            color: shiftColors[sched.ShiftType]?.text || '#6b7280',
                            fontWeight: 700, fontSize: '0.8125rem',
                          }}>{sched.ShiftType}</span>
                          {SHIFT_INFO[sched.ShiftType] && (
                            <span style={{ fontSize: '0.625rem', color: '#9ca3af', fontWeight: 500 }}>
                              {SHIFT_INFO[sched.ShiftType]}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <span style={{ color: '#d1d5db', fontSize: '1.25rem', fontWeight: 300, lineHeight: 1 }}>+</span>
                          <span style={{ fontSize: '0.625rem', color: '#d1d5db' }}>Add shift</span>
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
            {staff.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>No staff found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 20, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Shift Types:</span>
        {SHIFTS.map(s => (
          <div key={s} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ width: 14, height: 14, borderRadius: 4, background: shiftColors[s].bg, border: '1px solid ' + shiftColors[s].text }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: shiftColors[s].text }}>{s}</span>
            <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>{SHIFT_INFO[s]}</span>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ width: 14, height: 14, borderRadius: 4, background: '#fff5f5', border: '1px solid #fecaca' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#ef4444' }}>Leave</span>
        </div>
        <div style={{ fontSize: '0.625rem', color: '#9ca3af', marginLeft: 8 }}>
          Click any cell to assign or change a shift
        </div>
      </div>

      <style>{`
        .schedule-cell:hover { background: #f3f4f6 !important; }
        .schedule-cell:hover [class*="material-symbols"] { color: var(--accent) !important; }
        .data-table table tr:hover td[style*="sticky"] { background: var(--surface-card); }
      `}</style>
    </>
  )
}
