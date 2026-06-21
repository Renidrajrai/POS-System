import type { Page } from '../App'

const navItems: { page: Page; icon: string; label: string }[] = [
  { page: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
  { page: 'orders', icon: 'receipt_long', label: 'Orders' },
  { page: 'menu', icon: 'restaurant_menu', label: 'Menu' },
  { page: 'recipes', icon: 'menu_book', label: 'Recipes' },
  { page: 'procurement', icon: 'inventory_2', label: 'Procurement' },
  { page: 'staff', icon: 'groups', label: 'Staff' },
  { page: 'schedule', icon: 'calendar_month', label: 'Schedules' },
  { page: 'attendance', icon: 'fact_check', label: 'Attendance' },
  { page: 'reports', icon: 'bar_chart', label: 'Reports' },
]

interface SidebarProps {
  currentPage: Page
  onNavigate: (page: Page) => void
}

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <span className="material-symbols-outlined">pets</span>
        </div>
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-title">Meowspot</span>
          <span className="sidebar-brand-sub">Management Suite</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-nav-label">Main Menu</div>
        {navItems.map(item => (
          <button
            key={item.page}
            className={`sidebar-nav-item ${currentPage === item.page ? 'active' : ''}`}
            onClick={() => onNavigate(item.page)}
          >
            <span className="material-symbols-outlined sidebar-nav-icon">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-nav-item">
          <span className="material-symbols-outlined sidebar-nav-icon">settings</span>
          <span>Settings</span>
        </button>
      </div>

      <style>{`
        .sidebar {
          position: fixed;
          left: 0;
          top: 0;
          bottom: 0;
          width: var(--sidebar-width);
          background: var(--primary);
          display: flex;
          flex-direction: column;
          z-index: 100;
          overflow-y: auto;
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .sidebar-logo {
          width: 42px;
          height: 42px;
          background: var(--accent);
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .sidebar-logo .material-symbols-outlined {
          font-size: 24px;
          color: var(--primary);
        }

        .sidebar-brand-text {
          display: flex;
          flex-direction: column;
        }

        .sidebar-brand-title {
          font-size: 1.125rem;
          font-weight: 800;
          color: white;
          letter-spacing: -0.02em;
        }

        .sidebar-brand-sub {
          font-size: 0.6875rem;
          color: rgba(255, 255, 255, 0.5);
          font-weight: 500;
          letter-spacing: 0.02em;
        }

        .sidebar-nav {
          flex: 1;
          padding: 20px 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .sidebar-nav-label {
          font-size: 0.6875rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.35);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 8px 12px 6px;
        }

        .sidebar-nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 11px 16px;
          border-radius: var(--radius-sm);
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.65);
          font-family: 'Inter', sans-serif;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
          width: 100%;
          text-align: left;
        }

        .sidebar-nav-item:hover {
          background: rgba(255, 255, 255, 0.06);
          color: rgba(255, 255, 255, 0.9);
        }

        .sidebar-nav-item.active {
          background: rgba(212, 168, 67, 0.12);
          color: var(--accent);
          border-left: 3px solid var(--accent);
          padding-left: 13px;
        }

        .sidebar-nav-icon {
          font-size: 20px;
          width: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .sidebar-nav-item.active .sidebar-nav-icon {
          font-variation-settings: 'FILL' 1;
        }

        .sidebar-footer {
          padding: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .sidebar-new-order {
          margin: 16px 16px 12px;
          padding: 13px 16px;
          background: var(--accent);
          border: none;
          border-radius: var(--radius-sm);
          color: var(--primary);
          font-family: 'Inter', sans-serif;
          font-size: 0.875rem;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: background 0.15s;
        }

        .sidebar-new-order:hover {
          background: var(--accent-hover);
        }

        .sidebar-new-order .material-symbols-outlined {
          font-size: 20px;
        }
      `}</style>
    </aside>
  )
}
