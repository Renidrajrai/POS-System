import { api } from './client'

export interface StaffMember {
  Id: number
  FirstName: string
  LastName: string
  Email: string
  Phone: string
  Role: string
  Shift: string
  Status: string
  PhotoUrl?: string
  Salary: number
  HireDate: string
  EmergencyContact: string
  EmergencyPhone: string
  Notes: string
  CreatedAt: string
  UpdatedAt: string
}

export interface StaffStats {
  total: number
  onLeave: number
  onShift: number
  lateCount: number
}

export interface StaffSchedule {
  Id: number
  StaffId: number
  Date: string
  DayOfWeek: string
  StartTime: string
  EndTime: string
  ShiftType: string
  Notes: string
  FirstName?: string
  LastName?: string
  Role?: string
}

export interface StaffLeave {
  Id: number
  StaffId: number
  ReplacementStaffId?: number
  StartDate: string
  EndDate: string
  LeaveType: string
  Reason: string
  Status: string
  CreatedAt: string
  StaffFirstName?: string
  StaffLastName?: string
  StaffRole?: string
  RFirstName?: string
  RLastName?: string
}

export interface StaffAttendance {
  Id: number
  StaffId: number
  Date: string
  ScheduledShift: string
  Status: string
  ClockIn: string
  ClockOut: string
  OvertimeMinutes: number
  LeaveType: string
  LeaveReason: string
  ReplacementStaffId?: number
  Notes: string
  RFirstName?: string
  RLastName?: string
}

export interface AttendanceSummary {
  StaffId: number
  FirstName: string
  LastName: string
  Role: string
  TotalShifts: number
  Attended: number
  Absent: number
  Sick: number
  Emergency: number
  CallInSick: number
  CallInEmergency: number
  CallInOther: number
  PlannedLeave: number
  Unaccounted: number
  TotalOvertimeMinutes: number
}

export interface StaffTraining {
  Id: number
  StaffId: number
  CourseName: string
  Status: string
  StartDate: string
  CompletionDate?: string
  Notes: string
}

export interface Routine {
  Id: number
  Name: string
  Description: string
  ShiftType: string
  Frequency: string
  IsActive: boolean
  CreatedAt: string
}

export interface RoutineTask {
  Id: number
  RoutineId: number
  TaskName: string
  AssignedRole: string
  TimeSlot: string
  EstimatedMinutes: number
  DisplayOrder: number
  IsCompleted: boolean
  Notes: string
}

export const staffApi = {
  list: (params?: { query?: string; role?: string; status?: string }) => {
    const qs = new URLSearchParams()
    if (params?.query) qs.set('query', params.query)
    if (params?.role) qs.set('role', params.role)
    if (params?.status) qs.set('status', params.status)
    const q = qs.toString()
    return api.get<StaffMember[]>(`/staff${q ? `?${q}` : ''}`)
  },

  stats: () => api.get<StaffStats>('/staff/stats'),

  get: (id: number) => api.get<StaffMember>(`/staff/${id}`),

  create: (data: Partial<StaffMember>) => api.post<StaffMember>('/staff', data),

  update: (id: number, data: Partial<StaffMember>) =>
    api.put<StaffMember>(`/staff/${id}`, data),

  delete: (id: number) => api.delete(`/staff/${id}`),

  schedules: {
    list: (staffId: number, weekStart?: string) => {
      const qs = weekStart ? `?weekStart=${weekStart}` : ''
      return api.get<StaffSchedule[]>(`/staff/${staffId}/schedules${qs}`)
    },
    week: (weekStart?: string) => {
      const qs = weekStart ? `?weekStart=${weekStart}` : ''
      return api.get<StaffSchedule[]>(`/staff/schedules/week${qs}`)
    },
    save: (data: Partial<StaffSchedule>) => api.post<StaffSchedule>('/staff/schedules', data),
    delete: (id: number) => api.delete(`/staff/schedules/${id}`),
  },

  leaves: {
    list: (staffId: number) => api.get<StaffLeave[]>(`/staff/${staffId}/leaves`),
    all: (start?: string, end?: string) => {
      const qs = new URLSearchParams()
      if (start) qs.set('start', start)
      if (end) qs.set('end', end)
      const q = qs.toString()
      return api.get<StaffLeave[]>(`/staff/leaves/all${q ? `?${q}` : ''}`)
    },
    create: (data: Partial<StaffLeave>) => api.post<StaffLeave>('/staff/leaves', data),
    approve: (id: number, replacementStaffId?: number) =>
      api.put(`/staff/leaves/${id}/approve`, { replacementStaffId }),
  },

  attendance: {
    week: (weekStart?: string) => {
      const qs = weekStart ? `?weekStart=${weekStart}` : ''
      return api.get<StaffAttendance[]>(`/staff/schedules/week-attendance${qs}`)
    },
    summary: (month?: number, year?: number) => {
      const qs = new URLSearchParams()
      if (month) qs.set('month', String(month))
      if (year) qs.set('year', String(year))
      const q = qs.toString()
      return api.get<AttendanceSummary[]>(`/staff/attendance/summary${q ? `?${q}` : ''}`)
    },
    detail: (staffId: number, month?: number, year?: number) => {
      const qs = new URLSearchParams()
      if (month) qs.set('month', String(month))
      if (year) qs.set('year', String(year))
      const q = qs.toString()
      return api.get<StaffAttendance[]>(`/staff/attendance/detail/${staffId}${q ? `?${q}` : ''}`)
    },
    save: (data: Partial<StaffAttendance>) => api.post<StaffAttendance>('/staff/attendance', data),
    update: (id: number, data: Partial<StaffAttendance>) =>
      api.put<StaffAttendance>(`/staff/attendance/${id}`, data),
    delete: (id: number) => api.delete(`/staff/attendance/${id}`),
  },

  training: {
    list: (staffId: number) => api.get<StaffTraining[]>(`/staff/${staffId}/training`),
    create: (data: Partial<StaffTraining>) => api.post<StaffTraining>('/staff/training', data),
    complete: (id: number) => api.put(`/staff/training/${id}/complete`),
  },

  routines: {
    list: () => api.get<Routine[]>('/staff/routines'),
    create: (data: Partial<Routine>) => api.post<Routine>('/staff/routines', data),
    tasks: (routineId: number) => api.get<RoutineTask[]>(`/staff/routines/${routineId}/tasks`),
    addTask: (routineId: number, data: Partial<RoutineTask>) =>
      api.post<RoutineTask>(`/staff/routines/${routineId}/tasks`, data),
    toggleTask: (taskId: number) => api.put(`/staff/routines/tasks/${taskId}/toggle`),
  },

  available: (date?: string, role?: string) => {
    const qs = new URLSearchParams()
    if (date) qs.set('date', date)
    if (role) qs.set('role', role)
    const q = qs.toString()
    return api.get<StaffMember[]>(`/staff/available${q ? `?${q}` : ''}`)
  },
}
