import { useEffect, useState, useRef } from 'react'
import { staffApi, type StaffMember, type StaffLeave } from '../api/staff'
import { getAuthToken } from '../api/client'

const roleColors: Record<string, { bg: string; color: string }> = {
  'Senior Barista': { bg: '#eef2ff', color: '#4f46e5' },
  'Barista': { bg: '#ecfdf5', color: '#059669' },
  'Cashier': { bg: '#fef3c7', color: '#d97706' },
  'Line Cook': { bg: '#fce7f3', color: '#db2777' },
  'Kitchen Manager': { bg: '#e0e7ff', color: '#4338ca' },
  'Dishwasher': { bg: '#f3f4f6', color: '#6b7280' },
  'Waitress': { bg: '#fce4ec', color: '#c62828' },
  'Waiter': { bg: '#fce4ec', color: '#c62828' },
  'Chef': { bg: '#e0e7ff', color: '#4338ca' },
}

const statusConfig: Record<string, { label: string; className: string }> = {
  Active: { label: 'On Duty', className: 'badge badge-success' },
  Offline: { label: 'Offline', className: 'badge badge-neutral' },
  Break: { label: 'On Break', className: 'badge badge-warning' },
  Inactive: { label: 'Inactive', className: 'badge badge-neutral' },
}

function getInitials(first: string, last: string) {
  return `${first[0] || ''}${last[0] || ''}`.toUpperCase()
}

function getAvatarColor(name: string) {
  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']
  const index = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length
  return colors[index]
}

interface StaffForm {
  FirstName: string
  LastName: string
  Email: string
  Phone: string
  Role: string
  Shift: string
  Status: string
  Salary: string
  HireDate: string
  EmergencyContact: string
  EmergencyPhone: string
  Notes: string
  PhotoUrl: string
}

const emptyForm: StaffForm = {
  FirstName: '', LastName: '', Email: '', Phone: '', Role: 'Barista',
  Shift: 'Morning', Status: 'Active', Salary: '', HireDate: '',
  EmergencyContact: '', EmergencyPhone: '', Notes: '', PhotoUrl: '',
}

export function Staff() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<StaffForm>(emptyForm)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [leaves, setLeaves] = useState<Record<number, StaffLeave[]>>({})
  const [showLeaveForm, setShowLeaveForm] = useState(false)
  const [leaveForm, setLeaveForm] = useState({ LeaveType: 'Sick', StartDate: '', EndDate: '', Reason: '' })

  useEffect(() => {
    async function load() {
      try {
        const st = await staffApi.list()
        setStaff(st)
      } catch (err) {
        console.error('Staff load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = staff.filter(s => {
    const fullName = `${s.FirstName} ${s.LastName}`.toLowerCase()
    const matchSearch = fullName.includes(search.toLowerCase()) || s.Role.toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'all' || s.Role === roleFilter
    const matchStatus = statusFilter === 'all' || s.Status === statusFilter
    return matchSearch && matchRole && matchStatus
  })

  const roles = [...new Set(staff.map(s => s.Role))]
  const onDuty = staff.filter(s => s.Status === 'Active').length
  const onBreak = staff.filter(s => s.Status === 'Break').length
  const offline = staff.filter(s => s.Status === 'Offline' || s.Status === 'Inactive').length

  const openAdd = () => {
    setEditingId(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  const openEdit = (s: StaffMember) => {
    setEditingId(s.Id)
    setForm({
      FirstName: s.FirstName,
      LastName: s.LastName,
      Email: s.Email,
      Phone: s.Phone,
      Role: s.Role,
      Shift: s.Shift,
      Status: s.Status,
      Salary: String(s.Salary || ''),
      HireDate: s.HireDate ? s.HireDate.slice(0, 10) : '',
      EmergencyContact: s.EmergencyContact || '',
      EmergencyPhone: s.EmergencyPhone || '',
      Notes: s.Notes || '',
      PhotoUrl: s.PhotoUrl || '',
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
      setForm(p => ({ ...p, PhotoUrl: data.path }))
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
    if (!form.FirstName || !form.LastName || !form.Email) return
    const payload = {
      FirstName: form.FirstName,
      LastName: form.LastName,
      Email: form.Email,
      Phone: form.Phone,
      Role: form.Role,
      Shift: form.Shift,
      Status: form.Status,
      Salary: form.Salary ? parseFloat(form.Salary) : 0,
      HireDate: form.HireDate ? new Date(form.HireDate).toISOString() : new Date().toISOString(),
      EmergencyContact: form.EmergencyContact,
      EmergencyPhone: form.EmergencyPhone,
      Notes: form.Notes,
      PhotoUrl: form.PhotoUrl,
    }
    try {
      if (editingId) {
        const updated = await staffApi.update(editingId, payload)
        setStaff(prev => prev.map(s => s.Id === editingId ? updated : s))
      } else {
        const created = await staffApi.create(payload)
        setStaff(prev => [...prev, created])
      }
      setShowModal(false)
      setForm(emptyForm)
    } catch (err) {
      console.error('Save error:', err)
    }
  }

  const deactivate = async (s: StaffMember) => {
    try {
      const updated = await staffApi.update(s.Id, { Status: 'Inactive' })
      setStaff(prev => prev.map(st => st.Id === s.Id ? updated : st))
    } catch (err) {
      console.error('Deactivate error:', err)
    }
  }

  const loadLeaves = async (staffId: number) => {
    if (leaves[staffId]) return
    try {
      const lv = await staffApi.leaves.list(staffId)
      setLeaves(prev => ({ ...prev, [staffId]: lv }))
    } catch (err) {
      console.error('Load leaves error:', err)
    }
  }

  const submitLeave = async (staffId: number) => {
    if (!leaveForm.StartDate || !leaveForm.EndDate) return
    try {
      await staffApi.leaves.create({
        StaffId: staffId,
        StartDate: leaveForm.StartDate,
        EndDate: leaveForm.EndDate,
        LeaveType: leaveForm.LeaveType,
        Reason: leaveForm.Reason,
        Status: 'Pending',
      })
      setLeaves(prev => ({ ...prev, [staffId]: [] }))
      setShowLeaveForm(false)
      setLeaveForm({ LeaveType: 'Sick', StartDate: '', EndDate: '', Reason: '' })
    } catch (err) {
      console.error('Submit leave error:', err)
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Loading staff...</div>
  }

  return (
    <>
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Total Staff</span>
            <div className="stat-card-icon" style={{ background: '#eef2ff', color: '#6366f1' }}>
              <span className="material-symbols-outlined">groups</span>
            </div>
          </div>
          <div className="stat-card-value">{staff.length}</div>
          <div className="stat-card-change" style={{ color: '#6366f1' }}>{staff.length} employees</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">On Duty</span>
            <div className="stat-card-icon" style={{ background: '#ecfdf5', color: '#10b981' }}>
              <span className="material-symbols-outlined">check_circle</span>
            </div>
          </div>
          <div className="stat-card-value">{onDuty}</div>
          <div className="stat-card-change" style={{ color: '#10b981' }}>Currently working</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">On Break</span>
            <div className="stat-card-icon" style={{ background: '#fffbeb', color: '#f59e0b' }}>
              <span className="material-symbols-outlined">free_breakfast</span>
            </div>
          </div>
          <div className="stat-card-value">{onBreak}</div>
          <div className="stat-card-change" style={{ color: '#f59e0b' }}>Away from station</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-label">Offline</span>
            <div className="stat-card-icon" style={{ background: '#f3f4f6', color: '#6b7280' }}>
              <span className="material-symbols-outlined">cancel</span>
            </div>
          </div>
          <div className="stat-card-value">{offline}</div>
          <div className="stat-card-change" style={{ color: '#6b7280' }}>Not scheduled today</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="topbar-search" style={{ width: 240 }}>
            <span className="material-symbols-outlined">search</span>
            <input type="text" placeholder="Search staff..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-input form-select" style={{ width: 160 }} value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="all">All Roles</option>
            {roles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select className="form-input form-select" style={{ width: 140 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="Active">On Duty</option>
            <option value="Break">On Break</option>
            <option value="Offline">Offline</option>
          </select>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <span className="material-symbols-outlined">person_add</span> Add Staff
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
        {filtered.map(staffMember => {
          const roleStyle = roleColors[staffMember.Role] || { bg: '#f3f4f6', color: '#6b7280' }
          const statusStyle = statusConfig[staffMember.Status] || statusConfig.Active
          const avatarColor = getAvatarColor(`${staffMember.FirstName} ${staffMember.LastName}`)

          return (
            <div
              key={staffMember.Id}
              className="stat-card"
              style={{
                cursor: 'pointer',
                transition: 'all 0.15s',
                border: selectedStaff?.Id === staffMember.Id ? '2px solid var(--accent)' : '1px solid var(--border)',
                padding: 0,
                overflow: 'hidden',
              }}
              onClick={() => {
                if (selectedStaff?.Id === staffMember.Id) {
                  setSelectedStaff(null)
                } else {
                  setSelectedStaff(staffMember)
                  loadLeaves(staffMember.Id)
                }
              }}
            >
              <div style={{ padding: 20, display: 'flex', gap: 16, alignItems: 'center' }}>
                {staffMember.PhotoUrl ? (
                  <img
                    src={`/${staffMember.PhotoUrl}`}
                    alt={`${staffMember.FirstName} ${staffMember.LastName}`}
                    style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <div style={{
                    width: 52, height: 52, borderRadius: '50%', background: avatarColor,
                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '1.125rem', flexShrink: 0,
                  }}>
                    {getInitials(staffMember.FirstName, staffMember.LastName)}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{staffMember.FirstName} {staffMember.LastName}</span>
                    <span className={statusStyle.className}>{statusStyle.label}</span>
                  </div>
                  <span style={{
                    display: 'inline-block', padding: '2px 10px', borderRadius: 9999,
                    fontSize: '0.75rem', fontWeight: 600, background: roleStyle.bg, color: roleStyle.color,
                    marginBottom: 4,
                  }}>
                    {staffMember.Role}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>schedule</span>
                    {staffMember.Shift}
                  </div>
                </div>
              </div>

              <div style={{ height: 1, background: 'var(--border-light)' }} />

              <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.125rem', fontWeight: 800 }}>{staffMember.Notes ? '3' : '-'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Orders</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'center' }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} className="material-symbols-outlined" style={{
                        fontSize: 16,
                        color: i < 4 ? '#f59e0b' : '#d1d5db',
                        fontVariationSettings: "'FILL' 1",
                      }}>star</span>
                    ))}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Rating</div>
                </div>
                <button className="btn btn-ghost btn-sm" style={{ width: 28, height: 28, padding: 0 }} onClick={e => { e.stopPropagation(); }}>
                  <span className="material-symbols-outlined">more_vert</span>
                </button>
              </div>

              {selectedStaff?.Id === staffMember.Id && (
                <>
                  <div style={{ height: 1, background: 'var(--border-light)' }} />
                  <div style={{ padding: '16px 20px', background: '#faf9f7' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 2 }}>Email</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{staffMember.Email}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 2 }}>Phone</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{staffMember.Phone}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); openEdit(staffMember) }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span> Edit
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>schedule</span> Schedule
                      </button>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={e => { e.stopPropagation(); deactivate(staffMember) }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>block</span> Deactivate
                      </button>
                    </div>

                    <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Leave Requests</span>
                        <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); setShowLeaveForm(!showLeaveForm) }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span> Request Leave
                        </button>
                      </div>

                      {showLeaveForm && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12, padding: 12, background: 'var(--surface)', borderRadius: 'var(--radius-sm)' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <select className="form-input form-select" style={{ fontSize: '0.8125rem', padding: '6px 10px' }} value={leaveForm.LeaveType} onChange={e => setLeaveForm(p => ({ ...p, LeaveType: e.target.value }))}>
                              {['Sick', 'Vacation', 'Personal', 'Emergency', 'Other'].map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <button className="btn btn-accent btn-sm" onClick={() => submitLeave(staffMember.Id)}>Submit</button>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <input className="form-input" type="date" style={{ fontSize: '0.8125rem', padding: '6px 10px' }} value={leaveForm.StartDate} onChange={e => setLeaveForm(p => ({ ...p, StartDate: e.target.value }))} />
                            <input className="form-input" type="date" style={{ fontSize: '0.8125rem', padding: '6px 10px' }} value={leaveForm.EndDate} onChange={e => setLeaveForm(p => ({ ...p, EndDate: e.target.value }))} />
                          </div>
                          <textarea className="form-input" style={{ fontSize: '0.8125rem', padding: '6px 10px', minHeight: 40, resize: 'vertical' }} placeholder="Reason for leave..." value={leaveForm.Reason} onChange={e => setLeaveForm(p => ({ ...p, Reason: e.target.value }))} />
                        </div>
                      )}

                      {leaves[staffMember.Id] && leaves[staffMember.Id].length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {leaves[staffMember.Id].slice(0, 3).map(lv => (
                            <div key={lv.Id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem', padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
                              <div>
                                <span style={{ fontWeight: 600 }}>{lv.LeaveType}</span>
                                <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>
                                  {new Date(lv.StartDate).toLocaleDateString()} - {new Date(lv.EndDate).toLocaleDateString()}
                                </span>
                              </div>
                              <span className={lv.Status === 'Approved' ? 'badge badge-success' : lv.Status === 'Pending' ? 'badge badge-warning' : 'badge badge-neutral'} style={{ fontSize: '0.6875rem' }}>
                                {lv.Status}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', textAlign: 'center', padding: 8 }}>No leave requests</div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, marginBottom: 12 }}>search_off</span>
          <div style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 4 }}>No staff found</div>
          <div style={{ fontSize: '0.875rem' }}>Try adjusting your search or filters</div>
        </div>
      )}

      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => setShowModal(false)}>
          <div style={{
            background: 'var(--surface-card)', borderRadius: 'var(--radius)',
            padding: 32, width: 560, maxWidth: '90vw', maxHeight: '90vh',
            overflowY: 'auto', boxShadow: 'var(--shadow-lg)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 24 }}>
              {editingId ? 'Edit Staff' : 'Add Staff'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>First Name</label>
                  <input className="form-input" value={form.FirstName} onChange={e => setForm(p => ({ ...p, FirstName: e.target.value }))} placeholder="First name" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Last Name</label>
                  <input className="form-input" value={form.LastName} onChange={e => setForm(p => ({ ...p, LastName: e.target.value }))} placeholder="Last name" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Email</label>
                  <input className="form-input" type="email" value={form.Email} onChange={e => setForm(p => ({ ...p, Email: e.target.value }))} placeholder="email@example.com" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Phone</label>
                  <input className="form-input" value={form.Phone} onChange={e => setForm(p => ({ ...p, Phone: e.target.value }))} placeholder="+1 555-0000" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Role</label>
                  <select className="form-input form-select" value={form.Role} onChange={e => setForm(p => ({ ...p, Role: e.target.value }))}>
                    {['Barista', 'Senior Barista', 'Cashier', 'Waiter', 'Waitress', 'Line Cook', 'Chef', 'Kitchen Manager', 'Dishwasher'].map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Shift</label>
                  <select className="form-input form-select" value={form.Shift} onChange={e => setForm(p => ({ ...p, Shift: e.target.value }))}>
                    {['Morning', 'Afternoon', 'Evening', 'Night'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Status</label>
                  <select className="form-input form-select" value={form.Status} onChange={e => setForm(p => ({ ...p, Status: e.target.value }))}>
                    {['Active', 'Offline', 'Break', 'Inactive'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Salary ($)</label>
                  <input className="form-input" type="number" step="0.01" min="0" value={form.Salary} onChange={e => setForm(p => ({ ...p, Salary: e.target.value }))} placeholder="0.00" />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Hire Date</label>
                <input className="form-input" type="date" value={form.HireDate} onChange={e => setForm(p => ({ ...p, HireDate: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Emergency Contact</label>
                  <input className="form-input" value={form.EmergencyContact} onChange={e => setForm(p => ({ ...p, EmergencyContact: e.target.value }))} placeholder="Contact name" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Emergency Phone</label>
                  <input className="form-input" value={form.EmergencyPhone} onChange={e => setForm(p => ({ ...p, EmergencyPhone: e.target.value }))} placeholder="+1 555-0000" />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Notes</label>
                <textarea className="form-input" style={{ resize: 'vertical', minHeight: 50 }} value={form.Notes} onChange={e => setForm(p => ({ ...p, Notes: e.target.value }))} placeholder="Any notes about this staff member" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Photo</label>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    <span className="material-symbols-outlined">upload</span>
                    {uploading ? 'Uploading...' : 'Upload Photo'}
                  </button>
                  {form.PhotoUrl && (
                    <img src={`/${form.PhotoUrl}`} alt="preview" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-accent" onClick={save}>
                {editingId ? 'Update' : 'Add'} Staff
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
