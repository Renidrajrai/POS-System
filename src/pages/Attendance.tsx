import { useEffect, useState } from 'react'
import { staffApi, type StaffMember, type StaffSchedule, type StaffLeave, type StaffAttendance, type AttendanceSummary } from '../api/staff'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const attColors: Record<string, string> = {
  Present: '#059669',
  Late: '#d97706',
  Absent: '#ef4444',
  Sick: '#8b5cf6',
  Emergency: '#dc2626',
  Leave: '#6b7280',
  'Call-In-Sick': '#a855f7',
  'Call-In-Emergency': '#e11d48',
  'Call-In-Other': '#f97316',
}

const attBgColors: Record<string, string> = {
  Present: '#ecfdf5',
  Late: '#fef3c7',
  Absent: '#fef2f2',
  Sick: '#f5f3ff',
  Emergency: '#fef2f2',
  Leave: '#f3f4f6',
  'Call-In-Sick': '#faf5ff',
  'Call-In-Emergency': '#ffe4e6',
  'Call-In-Other': '#fff7ed',
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

export function Attendance() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [schedules, setSchedules] = useState<StaffSchedule[]>([])
  const [leaves, setLeaves] = useState<StaffLeave[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<StaffAttendance[]>([])
  const [monthlySummary, setMonthlySummary] = useState<AttendanceSummary[]>([])
  const [summaryMonth, setSummaryMonth] = useState(new Date().getMonth() + 1)
  const [summaryYear, setSummaryYear] = useState(new Date().getFullYear())
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()))
  const [loading, setLoading] = useState(true)
  const [attendingCell, setAttendingCell] = useState<{ staffId: number; day: string } | null>(null)
  const [showAttendModal, setShowAttendModal] = useState(false)
  const [attendForm, setAttendForm] = useState({ Status: 'Present', LeaveType: '', LeaveReason: '', ReplacementStaffId: '', Notes: '' })
  const [replacementOptions, setReplacementOptions] = useState<StaffMember[]>([])
  const [showChart, setShowChart] = useState(false)

  const todayStr = formatLocalDate(new Date())

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const ws = formatLocalDate(weekStart)
        const we = formatLocalDate(addDays(weekStart, 6))
        const [st, sched, lv, att, sum] = await Promise.all([
          staffApi.list(),
          staffApi.schedules.week(ws),
          staffApi.leaves.all(ws, we),
          staffApi.attendance.week(ws),
          staffApi.attendance.summary(summaryMonth, summaryYear),
        ])
        setStaff(st)
        setSchedules(sched)
        setLeaves(lv)
        setAttendanceRecords(att)
        setMonthlySummary(sum)
      } catch (err) {
        console.error('Attendance load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [weekStart])

  useEffect(() => {
    staffApi.attendance.summary(summaryMonth, summaryYear)
      .then(setMonthlySummary)
      .catch(console.error)
  }, [summaryMonth, summaryYear])

  const getSchedule = (staffId: number, day: string) => {
    const d = getDateForDay(weekStart, day)
    const ds = formatLocalDate(d)
    return schedules.find(s => s.StaffId === staffId && s.Date.slice(0, 10) === ds)
  }

  const getAttendance = (staffId: number, day: string) => {
    const d = getDateForDay(weekStart, day)
    const ds = formatLocalDate(d)
    return attendanceRecords.find(a => {
      const aStr = a.Date.slice(0, 10)
      return aStr === ds && a.StaffId === staffId
    })
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

  const isPastOrToday = (day: string) => {
    const d = getDateForDay(weekStart, day)
    const ds = formatLocalDate(d)
    return ds <= todayStr
  }

  const openAttendance = async (staffId: number, day: string) => {
    const d = getDateForDay(weekStart, day)
    const ds = formatLocalDate(d)
    const existing = getAttendance(staffId, day)
    setAttendForm({
      Status: existing?.Status || 'Present',
      LeaveType: existing?.LeaveType || '',
      LeaveReason: existing?.LeaveReason || '',
      ReplacementStaffId: existing?.ReplacementStaffId ? String(existing.ReplacementStaffId) : '',
      Notes: existing?.Notes || '',
    })
    try {
      const avail = await staffApi.available(ds)
      setReplacementOptions(avail)
    } catch { }
    setAttendingCell({ staffId, day })
    setShowAttendModal(true)
  }

  const saveAttendance = async () => {
    if (!attendingCell) return
    const d = getDateForDay(weekStart, attendingCell.day)
    const ds = formatLocalDate(d)
    try {
      const saved = await staffApi.attendance.save({
        StaffId: attendingCell.staffId,
        Date: ds,
        Status: attendForm.Status,
        ScheduledShift: getSchedule(attendingCell.staffId, attendingCell.day)?.ShiftType || '',
        LeaveType: attendForm.LeaveType || undefined,
        LeaveReason: attendForm.LeaveReason || undefined,
        ReplacementStaffId: attendForm.ReplacementStaffId ? parseInt(attendForm.ReplacementStaffId) : undefined,
        Notes: attendForm.Notes || undefined,
      })
      setAttendanceRecords(prev => {
        const idx = prev.findIndex(a => a.Id === saved.Id)
        if (idx >= 0) {
          const updated = [...prev]
          updated[idx] = saved
          return updated
        }
        return [...prev, saved]
      })
      const sum = await staffApi.attendance.summary(summaryMonth, summaryYear)
      setMonthlySummary(sum)
      setShowAttendModal(false)
      setAttendingCell(null)
    } catch (err) {
      console.error('Attendance save error:', err)
    }
  }

  const prevWeek = () => setWeekStart(d => addDays(d, -7))
  const nextWeek = () => setWeekStart(d => addDays(d, 7))

  const weekLabel = `${formatLocalDate(weekStart)} - ${formatLocalDate(addDays(weekStart, 6))}`

  const exportCSV = () => {
    const rows = [['Staff', 'Role', ...DAYS]]
    staff.forEach(member => {
      const row = [`${member.FirstName} ${member.LastName}`, member.Role]
      DAYS.forEach(day => {
        const sched = getSchedule(member.Id, day)
        const att = getAttendance(member.Id, day)
        const val = sched?.ShiftType || (isOnLeave(member.Id, day) ? 'Leave' : 'Off')
        row.push(att ? `${val} (${att.Status})` : val)
      })
      rows.push(row)
    })
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `attendance-${weekLabel.replace(/ /g, '-')}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const exportPDF = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Attendance - ${weekLabel}</title>
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
  <h2>Weekly Attendance</h2>
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
            const att = getAttendance(member.Id, day)
            const leave = isOnLeave(member.Id, day)
            const label = leave ? 'Leave' : sched?.ShiftType || '-'
            const attLabel = att ? ` (${att.Status})` : ''
            return `<td>${label}${attLabel}</td>`
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

  const summaryTotals = monthlySummary.reduce((acc, s) => ({
    TotalShifts: acc.TotalShifts + s.TotalShifts,
    Attended: acc.Attended + s.Attended,
    Absent: acc.Absent + s.Absent,
    Sick: acc.Sick + s.Sick,
    Emergency: acc.Emergency + s.Emergency,
    CallInSick: acc.CallInSick + s.CallInSick,
    CallInEmergency: acc.CallInEmergency + s.CallInEmergency,
    CallInOther: acc.CallInOther + s.CallInOther,
    PlannedLeave: acc.PlannedLeave + s.PlannedLeave,
    Unaccounted: acc.Unaccounted + s.Unaccounted,
    TotalOvertimeMinutes: acc.TotalOvertimeMinutes + s.TotalOvertimeMinutes,
  }), { TotalShifts: 0, Attended: 0, Absent: 0, Sick: 0, Emergency: 0, CallInSick: 0, CallInEmergency: 0, CallInOther: 0, PlannedLeave: 0, Unaccounted: 0, TotalOvertimeMinutes: 0 })

  const chartData = monthlySummary.map(s => ({
    name: s.FirstName,
    Attended: s.Attended,
    'Call-In': s.CallInSick + s.CallInEmergency + s.CallInOther,
    Leave: s.PlannedLeave,
    Absent: s.Absent + s.Sick + s.Emergency,
    Unaccounted: s.Unaccounted,
  }))

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Loading attendance...</div>
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Weekly Attendance</h2>
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

      <div className="data-table attendance-wrapper" style={{ overflowX: 'auto', fontSize: '0.8125rem' }}>
        <table style={{ minWidth: 1200, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ width: 180, position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 2, padding: '12px 16px', textAlign: 'left' }}>Staff</th>
              {DAYS.map(day => {
                const d = getDateForDay(weekStart, day)
                const ds = formatLocalDate(d)
                const isToday = ds === todayStr
                return (
                  <th key={day} style={{
                    width: 130, textAlign: 'center', padding: '12px 8px',
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
              <tr key={member.Id} style={{ height: 60 }}>
                <td style={{
                  fontWeight: 600, position: 'sticky', left: 0,
                  background: 'var(--surface-card)', zIndex: 1,
                  padding: '8px 16px', borderBottom: '1px solid var(--border-light)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
                  const att = getAttendance(member.Id, day)
                  const leave = isOnLeave(member.Id, day)
                  const ds = formatLocalDate(getDateForDay(weekStart, day))
                  const isToday = ds === todayStr
                  const pastOrToday = isPastOrToday(day)

                  if (leave) {
                    return (
                      <td key={day} style={{
                        textAlign: 'center', padding: '6px',
                        background: isToday ? '#fef2f2' : '#fff5f5',
                        borderBottom: '1px solid var(--border-light)',
                        color: '#ef4444', fontSize: '0.625rem', fontWeight: 600,
                        cursor: pastOrToday ? 'pointer' : 'default',
                      }}
                        onClick={() => {
                          if (pastOrToday) openAttendance(member.Id, day)
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 14, display: 'block', lineHeight: 1.2 }}>block</span>
                        Leave
                        {att && (
                          <span style={{ display: 'block', marginTop: 2, fontSize: '0.625rem', color: attColors[att.Status] || '#6b7280' }}>{att.Status}</span>
                        )}
                      </td>
                    )
                  }

                  return (
                    <td
                      key={day}
                      style={{
                        textAlign: 'center', cursor: pastOrToday ? 'pointer' : 'default',
                        padding: '4px 6px',
                        borderBottom: '1px solid var(--border-light)',
                        background: isToday ? '#fffbeb' : 'transparent',
                        transition: 'background 0.1s',
                        position: 'relative',
                      }}
                      className={pastOrToday ? 'attendance-cell' : ''}
                      onClick={() => {
                        if (pastOrToday) openAttendance(member.Id, day)
                      }}
                    >
                      {sched ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <span style={{
                            display: 'inline-block', padding: '5px 14px', borderRadius: 6,
                            background: sched.ShiftType === '9-7' ? '#eef2ff' : sched.ShiftType === '10-8' ? '#ecfdf5' : '#fef3c7',
                            color: sched.ShiftType === '9-7' ? '#4f46e5' : sched.ShiftType === '10-8' ? '#059669' : '#d97706',
                            fontWeight: 700, fontSize: '0.75rem',
                          }}>{sched.ShiftType}</span>
                          {pastOrToday && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 3,
                              fontSize: '0.625rem', fontWeight: 600,
                              color: att ? attColors[att.Status] : '#9ca3af',
                              background: att ? attBgColors[att.Status] : '#f9fafb',
                              padding: '1px 8px', borderRadius: 9999,
                              cursor: 'pointer', lineHeight: '16px',
                            }}>
                              <span style={{
                                width: 6, height: 6, borderRadius: '50%',
                                background: att ? attColors[att.Status] : '#d1d5db',
                                display: 'inline-block',
                              }} />
                              {att ? att.Status : 'Mark'}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <span style={{ color: '#e5e7eb', fontSize: '1rem', fontWeight: 300 }}>&mdash;</span>
                          {pastOrToday && att && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 3,
                              fontSize: '0.625rem', fontWeight: 600,
                              color: attColors[att.Status],
                              background: attBgColors[att.Status],
                              padding: '1px 8px', borderRadius: 9999,
                              lineHeight: '16px',
                            }}>
                              <span style={{
                                width: 6, height: 6, borderRadius: '50%',
                                background: attColors[att.Status],
                                display: 'inline-block',
                              }} />
                              {att.Status}
                            </span>
                          )}
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

      <div style={{ marginTop: 16, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Attendance:</span>
        {['Present', 'Late', 'Call-In-Sick', 'Call-In-Emergency', 'Call-In-Other', 'Absent', 'Leave'].map(s => (
          <div key={s} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: attColors[s] }} />
            <span style={{ fontSize: '0.625rem', color: 'var(--text-secondary)' }}>{s}</span>
          </div>
        ))}
        <div style={{ fontSize: '0.625rem', color: '#9ca3af', marginLeft: 4 }}>
          Click past/today cells to mark attendance
        </div>
      </div>

      {leaves.filter(l => l.Status === 'Approved' && l.LeaveType !== 'Scheduled').length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: 8 }}>Approved Leave This Week</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {leaves.filter(l => l.Status === 'Approved' && l.LeaveType !== 'Scheduled').map(lv => (
              <div key={lv.Id} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
                background: '#fef2f2', borderRadius: 6,
                border: '1px solid #fecaca', fontSize: '0.75rem',
              }}>
                <span className="material-symbols-outlined" style={{ color: '#ef4444', fontSize: 14 }}>event_busy</span>
                <span style={{ fontWeight: 600 }}>{lv.StaffFirstName} {lv.StaffLastName}</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {new Date(lv.StartDate).toLocaleDateString()} - {new Date(lv.EndDate).toLocaleDateString()}
                </span>
                <span style={{ padding: '1px 6px', borderRadius: 9999, fontSize: '0.625rem', fontWeight: 600, background: '#f3f4f6', color: '#6b7280' }}>{lv.LeaveType}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 32, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Attendance Summary — {MONTHS[summaryMonth - 1]} {summaryYear}</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" style={{ padding: '6px 10px', minWidth: 0 }} onClick={() => {
            if (summaryMonth === 1) { setSummaryMonth(12); setSummaryYear(y => y - 1) } else setSummaryMonth(m => m - 1)
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
          </button>
          <span style={{ fontWeight: 600, fontSize: '0.8125rem', minWidth: 140, textAlign: 'center', color: 'var(--text-secondary)' }}>{MONTHS[summaryMonth - 1]} {summaryYear}</span>
          <button className="btn btn-ghost btn-sm" style={{ padding: '6px 10px', minWidth: 0 }} onClick={() => {
            if (summaryMonth === 12) { setSummaryMonth(1); setSummaryYear(y => y + 1) } else setSummaryMonth(m => m + 1)
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
          </button>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem' }} onClick={() => { setShowChart(c => !c) }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{showChart ? 'table' : 'bar_chart'}</span>
            {showChart ? 'Table' : 'Chart'}
          </button>
        </div>
      </div>

      <div className="grid-5" style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 12, marginBottom: 20,
      }}>
        {[
          { label: 'Total Shifts', value: summaryTotals.TotalShifts, color: '#6366f1', bg: '#eef2ff' },
          { label: 'Attended', value: summaryTotals.Attended, color: '#059669', bg: '#ecfdf5' },
          { label: 'Call-Ins', value: summaryTotals.CallInSick + summaryTotals.CallInEmergency + summaryTotals.CallInOther, color: '#a855f7', bg: '#faf5ff' },
          { label: 'Leave', value: summaryTotals.PlannedLeave, color: '#6b7280', bg: '#f3f4f6' },
          { label: 'Unaccounted', value: summaryTotals.Unaccounted, color: '#f59e0b', bg: '#fffbeb' },
          { label: 'Overtime', value: `${(summaryTotals.TotalOvertimeMinutes / 60).toFixed(1)}h`, color: '#db2777', bg: '#fce7f3' },
        ].map(stat => (
          <div key={stat.label} className="stat-card" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>{stat.label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {showChart ? (
        <div className="data-table" style={{ padding: 20, marginBottom: 24 }}>
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: 16 }}>Shifts per Staff</h3>
          <ResponsiveContainer width="100%" height={Math.max(200, monthlySummary.length * 40 + 60)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 80, right: 20, top: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Attended" fill="#059669" stackId="a" />
              <Bar dataKey="Call-In" fill="#a855f7" stackId="a" />
              <Bar dataKey="Leave" fill="#6b7280" stackId="a" />
              <Bar dataKey="Absent" fill="#ef4444" stackId="a" />
              <Bar dataKey="Unaccounted" fill="#f59e0b" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="data-table" style={{ marginBottom: 24 }}>
          <div className="data-table-header">
            <h3>Detail per Staff</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => {
                const rows = [['Staff', 'Role', 'Total Shifts', 'Attended', 'Call-In Sick', 'Call-In Emergency', 'Call-In Other', 'Absent', 'Sick', 'Emergency', 'Planned Leave', 'Unaccounted', 'Overtime (hrs)']]
                monthlySummary.forEach(s => rows.push([
                  `${s.FirstName} ${s.LastName}`, s.Role,
                  String(s.TotalShifts), String(s.Attended),
                  String(s.CallInSick), String(s.CallInEmergency), String(s.CallInOther),
                  String(s.Absent), String(s.Sick), String(s.Emergency),
                  String(s.PlannedLeave), String(s.Unaccounted),
                  (s.TotalOvertimeMinutes / 60).toFixed(1),
                ]))
                const csv = rows.map(r => r.join(',')).join('\n')
                const blob = new Blob([csv], { type: 'text/csv' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url; a.download = `attendance-${MONTHS[summaryMonth - 1]}-${summaryYear}.csv`; a.click()
                URL.revokeObjectURL(url)
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span> CSV
              </button>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Staff</th>
                <th style={{ textAlign: 'left' }}>Role</th>
                <th style={{ textAlign: 'center' }}>Scheduled</th>
                <th style={{ textAlign: 'center', color: '#059669' }}>Attended</th>
                <th style={{ textAlign: 'center', color: '#a855f7' }}>Call-In</th>
                <th style={{ textAlign: 'center', color: '#ef4444' }}>Absent</th>
                <th style={{ textAlign: 'center', color: '#6b7280' }}>Leave</th>
                <th style={{ textAlign: 'center', color: '#f59e0b' }}>Open</th>
                <th style={{ textAlign: 'center' }}>Overtime</th>
              </tr>
            </thead>
            <tbody>
              {staff.map(member => {
                const s = monthlySummary.find(sm => sm.StaffId === member.Id)
                return (
                  <tr key={member.Id}>
                    <td style={{ fontWeight: 600 }}>{member.FirstName} {member.LastName}</td>
                    <td><span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{member.Role}</span></td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{s?.TotalShifts ?? '-'}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#059669' }}>{s?.Attended ?? '-'}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#a855f7' }}>
                      {s ? s.CallInSick + s.CallInEmergency + s.CallInOther || '-' : '-'}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: s?.Absent || s?.Sick || s?.Emergency ? '#ef4444' : 'inherit' }}>
                      {s ? (s.Absent + s.Sick + s.Emergency) || '-' : '-'}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{s?.PlannedLeave ?? '-'}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: s?.Unaccounted ? '#f59e0b' : 'inherit' }}>
                      {s?.Unaccounted ?? '-'}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>
                      {s ? `${(s.TotalOvertimeMinutes / 60).toFixed(1)}h` : '-'}
                    </td>
                  </tr>
                )
              })}
              {staff.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>No staff</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showAttendModal && attendingCell && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => setShowAttendModal(false)}>
          <div style={{
            background: 'var(--surface-card)', borderRadius: 'var(--radius)',
            padding: 28, width: 460, maxWidth: '90vw',
            boxShadow: 'var(--shadow-lg)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 20 }}>
              Attendance — {staff.find(s => s.Id === attendingCell.staffId)?.FirstName} {staff.find(s => s.Id === attendingCell.staffId)?.LastName}
              <span style={{ fontSize: '0.8125rem', fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 8 }}>
                {attendingCell.day}
              </span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Status</label>
                <select className="form-input form-select" value={attendForm.Status} onChange={e => setAttendForm(p => ({ ...p, Status: e.target.value }))}>
                  <option value="Present">Present — Showed up</option>
                  <option value="Late">Late — Arrived late</option>
                  <option value="Call-In-Sick">Call-In — Sick (called in)</option>
                  <option value="Call-In-Emergency">Call-In — Emergency (called in)</option>
                  <option value="Call-In-Other">Call-In — Other reason (called in)</option>
                  <option value="Absent">No-Show — Did not call, did not come</option>
                  <option value="Sick">Sick — Reported sick</option>
                  <option value="Emergency">Emergency — Urgent matter</option>
                  <option value="Leave">Leave — Planned leave</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Leave / Absence Type</label>
                  <select className="form-input form-select" value={attendForm.LeaveType} onChange={e => setAttendForm(p => ({ ...p, LeaveType: e.target.value }))}>
                    <option value="">None</option>
                    <option value="Sick">Sick</option>
                    <option value="Emergency">Emergency</option>
                    <option value="Personal">Personal</option>
                    <option value="Family">Family</option>
                    <option value="Transport">Transport Issue</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Replacement Staff</label>
                  <select className="form-input form-select" value={attendForm.ReplacementStaffId} onChange={e => setAttendForm(p => ({ ...p, ReplacementStaffId: e.target.value }))}>
                    <option value="">No replacement</option>
                    {replacementOptions.filter(r => r.Id !== attendingCell.staffId).map(r => (
                      <option key={r.Id} value={r.Id}>{r.FirstName} {r.LastName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Reason / Notes</label>
                <textarea className="form-input" style={{ minHeight: 60, resize: 'vertical' }} value={attendForm.LeaveReason || attendForm.Notes} onChange={e => {
                  const val = e.target.value
                  setAttendForm(p => ({ ...p, LeaveReason: val, Notes: val }))
                }} placeholder="Describe what happened..." />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowAttendModal(false)}>Cancel</button>
              <button className="btn btn-accent" onClick={saveAttendance}>Save</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .attendance-cell:hover { background: #f3f4f6 !important; }
        .data-table table tr:hover td[style*="sticky"] { background: var(--surface-card); }
      `}</style>
    </>
  )
}
