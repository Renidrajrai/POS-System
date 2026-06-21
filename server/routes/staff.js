import { Router } from 'express'
import db from '../db/knex.js'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'

const router = Router()
router.use(authenticate)

const TABLE = 'Staff'
const SCHEDULES = 'StaffSchedules'
const LEAVES = 'StaffLeaves'
const TRAINING = 'StaffTrainings'
const ROUTINES = 'Routines'
const ROUTINE_TASKS = 'RoutineTasks'
const ATTENDANCE = 'StaffAttendance'

async function now() {
  return new Date()
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ---- CRUD ----

router.get('/', async (req, res) => {
  const { query, role, status } = req.query
  let q = db(TABLE).orderBy('FirstName')

  if (query) {
    const lower = `%${query.toLowerCase()}%`
    q = q.where(function () {
      this.whereRaw('LOWER("FirstName") LIKE ?', [lower])
        .orWhereRaw('LOWER("LastName") LIKE ?', [lower])
        .orWhere('Phone', 'like', lower)
        .orWhereRaw('LOWER("Email") LIKE ?', [lower])
    })
  }
  if (role) q = q.where('Role', role)
  if (status) q = q.where('Status', status)

  const staff = await q
  res.json(staff)
})

router.get('/stats', async (req, res) => {
  const total = +(await db(TABLE).count('Id as c').first()).c || 0

  const today = todayStr()

  const onLeave = +(await db(LEAVES)
    .where('Status', 'Approved')
    .where('StartDate', '<=', today)
    .where('EndDate', '>=', today)
    .countDistinct('StaffId as c')
    .first()).c || 0

  const onShift = +(await db(TABLE).where('Status', 'Active').count('Id as c').first()).c || 0

  const schedules = await db(SCHEDULES).where('Date', today)

  const nowTime = new Date().toTimeString().slice(0, 5)
  const lateCount = schedules.filter(s => s.StartTime && s.StartTime < nowTime).length

  res.json({ total, onLeave, onShift, lateCount })
})

router.get('/available', async (req, res) => {
  const { date, role } = req.query
  const d = date || new Date().toISOString().slice(0, 10)

  const busyIds = await db(LEAVES)
    .where('Status', 'Approved')
    .where('StartDate', '<=', d)
    .where('EndDate', '>=', d)
    .distinct('StaffId')
    .pluck('StaffId')

  let q = db(TABLE).where('Status', 'Active')
  if (busyIds.length > 0) q = q.whereNotIn('Id', busyIds)
  if (role) q = q.where('Role', role)
  q = q.orderBy('FirstName')

  res.json(await q)
})

router.get('/:id', async (req, res) => {
  const staff = await db(TABLE).where('Id', req.params.id).first()
  if (!staff) return res.status(404).json({ error: 'Staff not found' })
  res.json(staff)
})

router.post('/', validate({
  FirstName: [{ required: true, type: 'string' }],
  LastName: [{ required: true, type: 'string' }],
  Email: [{ required: true, type: 'string' }],
  Role: [{ required: true, type: 'string' }],
}), async (req, res) => {
  const staff = {
    ...req.body,
    CreatedAt: await now(),
    UpdatedAt: await now(),
    HireDate: req.body.HireDate ? new Date(req.body.HireDate) : new Date(),
  }
  const [{ Id: id }] = await db(TABLE).insert(staff).returning('Id')
  const created = await db(TABLE).where('Id', id).first()
  res.status(201).json(created)
})

router.put('/:id', async (req, res) => {
  const data = { ...req.body, UpdatedAt: await now() }
  if (data.HireDate) data.HireDate = new Date(data.HireDate)
  await db(TABLE).where('Id', req.params.id).update(data)
  const updated = await db(TABLE).where('Id', req.params.id).first()
  res.json(updated)
})

router.delete('/:id', async (req, res) => {
  await db(TABLE).where('Id', req.params.id).del()
  res.json({ success: true })
})

// ---- Schedules ----

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d + n)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

router.get('/:id/schedules', async (req, res) => {
  const ws = req.query.weekStart || todayStr()
  const start = ws
  const end = addDays(ws, 7)

  const schedules = await db(SCHEDULES)
    .where('StaffId', req.params.id)
    .where('Date', '>=', start)
    .where('Date', '<', end)
    .orderBy('Date')

  res.json(schedules)
})

router.get('/schedules/week', async (req, res) => {
  const ws = req.query.weekStart || todayStr()
  const start = ws
  const end = addDays(ws, 7)

  const schedules = await db(SCHEDULES)
    .join(TABLE, `${SCHEDULES}.StaffId`, `${TABLE}.Id`)
    .select(`${SCHEDULES}.*`, `${TABLE}.FirstName`, `${TABLE}.LastName`, `${TABLE}.Role`)
    .where(`${SCHEDULES}.Date`, '>=', start)
    .where(`${SCHEDULES}.Date`, '<', end)
    .orderBy(['StaffId', 'Date'])

  res.json(schedules)
})

router.post('/schedules', async (req, res) => {
  const { StaffId, Date: sDate, StartTime, EndTime, ShiftType, Notes } = req.body

  const existing = await db(SCHEDULES)
    .where({ StaffId, Date: sDate })
    .first()

  if (existing) {
    await db(SCHEDULES).where('Id', existing.Id).update({ StartTime, EndTime, ShiftType, Notes })
    const updated = await db(SCHEDULES).where('Id', existing.Id).first()
    return res.json(updated)
  }

  const [{ Id: id }] = await db(SCHEDULES).insert({
    StaffId,
    Date: sDate,
    DayOfWeek: new Date(sDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' }),
    StartTime,
    EndTime,
    ShiftType,
    Notes,
  }).returning('Id')

  const created = await db(SCHEDULES).where('Id', id).first()
  res.status(201).json(created)
})

router.delete('/schedules/:id', async (req, res) => {
  await db(SCHEDULES).where('Id', req.params.id).del()
  res.json({ success: true })
})

router.get('/schedules/week-attendance', async (req, res) => {
  const ws = req.query.weekStart || todayStr()
  const start = ws
  const end = addDays(ws, 7)

  const attendance = await db(ATTENDANCE)
    .select('*')
    .where('Date', '>=', start)
    .where('Date', '<', end)

  res.json(attendance)
})

// ---- Leaves ----

router.get('/:id/leaves', async (req, res) => {
  const leaves = await db(LEAVES)
    .leftJoin(`${TABLE} as R`, `${LEAVES}.ReplacementStaffId`, 'R.Id')
    .select(`${LEAVES}.*`, 'R.FirstName as RFirstName', 'R.LastName as RLastName')
    .where(`${LEAVES}.StaffId`, req.params.id)
    .orderBy(`${LEAVES}.StartDate`, 'desc')

  res.json(leaves)
})

router.get('/leaves/all', async (req, res) => {
  const { start, end } = req.query
  let q = db(LEAVES)
    .join(`${TABLE} as S`, `${LEAVES}.StaffId`, 'S.Id')
    .leftJoin(`${TABLE} as R`, `${LEAVES}.ReplacementStaffId`, 'R.Id')
    .select(
      `${LEAVES}.*`,
      'S.FirstName as StaffFirstName', 'S.LastName as StaffLastName', 'S.Role as StaffRole',
      'R.FirstName as RFirstName', 'R.LastName as RLastName'
    )

  if (start) q = q.where(`${LEAVES}.StartDate`, '>=', start)
  if (end) q = q.where(`${LEAVES}.EndDate`, '<=', end)
  q = q.orderBy(`${LEAVES}.StartDate`, 'desc')

  res.json(await q)
})

router.post('/leaves', async (req, res) => {
  const leave = {
    ...req.body,
    StartDate: req.body.StartDate,
    EndDate: req.body.EndDate,
    CreatedAt: await now(),
  }
  const [{ Id: id }] = await db(LEAVES).insert(leave).returning('Id')
  const created = await db(LEAVES).where('Id', id).first()
  res.status(201).json(created)
})

router.put('/leaves/:id/approve', async (req, res) => {
  await db(LEAVES).where('Id', req.params.id).update({
    Status: 'Approved',
    ReplacementStaffId: req.body.replacementStaffId || null,
  })
  const updated = await db(LEAVES).where('Id', req.params.id).first()
  res.json(updated)
})

// ---- Training ----

router.get('/:id/training', async (req, res) => {
  const training = await db(TRAINING)
    .where('StaffId', req.params.id)
    .orderBy('StartDate', 'desc')
  res.json(training)
})

router.post('/training', async (req, res) => {
  const training = {
    ...req.body,
    StartDate: new Date(req.body.StartDate),
  }
  const [{ Id: id }] = await db(TRAINING).insert(training).returning('Id')
  const created = await db(TRAINING).where('Id', id).first()
  res.status(201).json(created)
})

router.put('/training/:id/complete', async (req, res) => {
  await db(TRAINING).where('Id', req.params.id).update({
    Status: 'Completed',
    CompletionDate: await now(),
  })
  const updated = await db(TRAINING).where('Id', req.params.id).first()
  res.json(updated)
})

// ---- Routines ----

router.get('/routines', async (req, res) => {
  res.json(await db(ROUTINES).orderBy('Name'))
})

router.post('/routines', async (req, res) => {
  const routine = { ...req.body, CreatedAt: await now() }
  const [{ Id: id }] = await db(ROUTINES).insert(routine).returning('Id')
  const created = await db(ROUTINES).where('Id', id).first()
  res.status(201).json(created)
})

router.get('/routines/:id/tasks', async (req, res) => {
  const tasks = await db(ROUTINE_TASKS)
    .where('RoutineId', req.params.id)
    .orderBy('DisplayOrder')
  res.json(tasks)
})

router.post('/routines/:id/tasks', async (req, res) => {
  const task = { ...req.body, RoutineId: +req.params.id }
  const [{ Id: id }] = await db(ROUTINE_TASKS).insert(task).returning('Id')
  const created = await db(ROUTINE_TASKS).where('Id', id).first()
  res.status(201).json(created)
})

router.put('/routines/tasks/:id/toggle', async (req, res) => {
  const task = await db(ROUTINE_TASKS).where('Id', req.params.id).first()
  if (task) {
    await db(ROUTINE_TASKS).where('Id', req.params.id).update({ IsCompleted: !task.IsCompleted })
  }
  res.json({ success: true })
})

// ---- Attendance ----

router.get('/attendance/summary', async (req, res) => {
  const { month, year } = req.query
  const m = parseInt(month) || (new Date().getMonth() + 1)
  const y = parseInt(year) || new Date().getFullYear()

  const staff = await db(TABLE).orderBy('FirstName')

  const scheduleCounts = await db(SCHEDULES)
    .select('StaffId')
    .count('* as TotalScheduled')
    .whereRaw(`EXTRACT(MONTH FROM "Date") = ?`, [m])
    .whereRaw(`EXTRACT(YEAR FROM "Date") = ?`, [y])
    .groupBy('StaffId')

  const leaveCounts = await db(LEAVES)
    .select('StaffId')
    .count('* as LeaveDays')
    .where('Status', 'Approved')
    .whereRaw(`EXTRACT(MONTH FROM "StartDate") = ?`, [m])
    .whereRaw(`EXTRACT(YEAR FROM "StartDate") = ?`, [y])
    .groupBy('StaffId')

  const attendanceAgg = await db(ATTENDANCE)
    .select(
      'StaffId',
      db.raw('COUNT(*)::int as "TotalAtt"'),
      db.raw('COUNT(*) FILTER (WHERE "Status" = \'Present\')::int as "Present"'),
      db.raw('COUNT(*) FILTER (WHERE "Status" = \'Late\')::int as "Late"'),
      db.raw('COUNT(*) FILTER (WHERE "Status" = \'Absent\')::int as "Absent"'),
      db.raw('COUNT(*) FILTER (WHERE "Status" = \'Sick\')::int as "Sick"'),
      db.raw('COUNT(*) FILTER (WHERE "Status" = \'Emergency\')::int as "Emergency"'),
      db.raw('COUNT(*) FILTER (WHERE "Status" = \'Leave\')::int as "Leave"'),
      db.raw('COUNT(*) FILTER (WHERE "Status" = \'Call-In-Sick\')::int as "CallInSick"'),
      db.raw('COUNT(*) FILTER (WHERE "Status" = \'Call-In-Emergency\')::int as "CallInEmergency"'),
      db.raw('COUNT(*) FILTER (WHERE "Status" = \'Call-In-Other\')::int as "CallInOther"'),
      db.raw('COALESCE(SUM("OvertimeMinutes"), 0)::int as "TotalOvertimeMinutes"')
    )
    .whereRaw(`EXTRACT(MONTH FROM "Date") = ?`, [m])
    .whereRaw(`EXTRACT(YEAR FROM "Date") = ?`, [y])
    .groupBy('StaffId')

  const result = staff.map(s => {
    const scheduled = scheduleCounts.find(sc => Number(sc.StaffId) === s.Id)
    const att = attendanceAgg.find(a => Number(a.StaffId) === s.Id)
    const lv = leaveCounts.find(l => Number(l.StaffId) === s.Id)

    const totalScheduled = Number(scheduled?.TotalScheduled) || 0
    const leaveDays = Number(lv?.LeaveDays) || 0
    const present = Number(att?.Present) || 0
    const late = Number(att?.Late) || 0
    const absent = Number(att?.Absent) || 0
    const sick = Number(att?.Sick) || 0
    const emergency = Number(att?.Emergency) || 0
    const plannedLeave = Number(att?.Leave) || 0
    const callInSick = Number(att?.CallInSick) || 0
    const callInEmergency = Number(att?.CallInEmergency) || 0
    const callInOther = Number(att?.CallInOther) || 0
    const overtime = Number(att?.TotalOvertimeMinutes) || 0

    const totalCallIns = callInSick + callInEmergency + callInOther

    return {
      StaffId: s.Id,
      FirstName: s.FirstName,
      LastName: s.LastName,
      Role: s.Role,
      TotalShifts: totalScheduled + leaveDays,
      Attended: present + late,
      Absent: absent,
      Sick: sick,
      Emergency: emergency,
      CallInSick: callInSick,
      CallInEmergency: callInEmergency,
      CallInOther: callInOther,
      PlannedLeave: plannedLeave + leaveDays,
      Unaccounted: Math.max(0, totalScheduled - present - late - callInSick - callInEmergency - callInOther - plannedLeave),
      TotalOvertimeMinutes: overtime,
    }
  })

  res.json(result)
})

router.get('/attendance/detail/:staffId', async (req, res) => {
  const { month, year } = req.query
  const m = parseInt(month) || (new Date().getMonth() + 1)
  const y = parseInt(year) || new Date().getFullYear()

  const records = await db(ATTENDANCE)
    .leftJoin(`${TABLE} as R`, `${ATTENDANCE}.ReplacementStaffId`, 'R.Id')
    .select(
      `${ATTENDANCE}.*`,
      'R.FirstName as RFirstName', 'R.LastName as RLastName'
    )
    .where(`${ATTENDANCE}.StaffId`, req.params.staffId)
    .where(db.raw(`EXTRACT(MONTH FROM "Date") = ?`, [m]))
    .where(db.raw(`EXTRACT(YEAR FROM "Date") = ?`, [y]))
    .orderBy(`${ATTENDANCE}.Date`)

  res.json(records)
})

router.post('/attendance', async (req, res) => {
  const { StaffId, Date: aDate, Status, ScheduledShift, ClockIn, ClockOut, OvertimeMinutes, LeaveType, LeaveReason, ReplacementStaffId, Notes } = req.body

  const existing = await db(ATTENDANCE)
    .where({ StaffId, Date: aDate })
    .first()

  if (existing) {
    await db(ATTENDANCE).where('Id', existing.Id).update({
      Status, ScheduledShift, ClockIn, ClockOut,
      OvertimeMinutes: OvertimeMinutes || 0,
      LeaveType, LeaveReason,
      ReplacementStaffId: ReplacementStaffId || null,
      Notes,
    })
    const updated = await db(ATTENDANCE).where('Id', existing.Id).first()
    return res.json(updated)
  }

  const [{ Id: id }] = await db(ATTENDANCE).insert({
    StaffId,
    Date: aDate,
    ScheduledShift: ScheduledShift || '',
    Status: Status || 'Present',
    ClockIn,
    ClockOut,
    OvertimeMinutes: OvertimeMinutes || 0,
    LeaveType,
    LeaveReason,
    ReplacementStaffId: ReplacementStaffId || null,
    Notes,
  }).returning('Id')

  const created = await db(ATTENDANCE).where('Id', id).first()
  res.status(201).json(created)
})

router.put('/attendance/:id', async (req, res) => {
  await db(ATTENDANCE).where('Id', req.params.id).update(req.body)
  const updated = await db(ATTENDANCE).where('Id', req.params.id).first()
  res.json(updated)
})

router.delete('/attendance/:id', async (req, res) => {
  await db(ATTENDANCE).where('Id', req.params.id).del()
  res.json({ success: true })
})

export default router
