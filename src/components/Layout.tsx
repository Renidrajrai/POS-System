import type { Page } from '../App'

const pageTitles: Record<Page, string> = {
  dashboard: 'Dashboard',
  staff: 'Staff Management',
  menu: 'Menu Management',
  orders: 'Order Terminal',
  schedule: 'Shift Schedule Planner',
  attendance: 'Attendance Tracker',
  recipes: 'Recipe Management',
  procurement: 'Procurement',
  reports: 'Reports & Analytics',
}

interface LayoutProps {
  page: Page
}

export function Layout({ page }: LayoutProps) {
  const title = pageTitles[page]

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="topbar-page-title">{title}</h1>
      </div>
      <div className="topbar-right">
        <button className="btn btn-ghost btn-icon" title="Notifications">
          <span className="material-symbols-outlined">notifications</span>
        </button>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: 'var(--primary)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.875rem',
          fontWeight: 700,
          cursor: 'pointer'
        }}>
          A
        </div>
      </div>
    </header>
  )
}
