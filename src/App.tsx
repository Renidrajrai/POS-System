import { AuthProvider, useAuth } from './context/AuthContext'
import { Sidebar } from './components/Sidebar'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Staff } from './pages/Staff'
import { Menu } from './pages/Menu'
import { OrderTerminal } from './pages/OrderTerminal'
import { Schedule } from './pages/Schedule'
import { Attendance } from './pages/Attendance'
import { Recipes } from './pages/Recipes'
import { Procurement } from './pages/Procurement'
import { Reports } from './pages/Reports'
import { useState } from 'react'

export type Page = 'dashboard' | 'staff' | 'menu' | 'orders' | 'schedule' | 'attendance' | 'recipes' | 'procurement' | 'reports'

function AppContent() {
  const { isAuth, loading } = useAuth()
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)' }}>
        <div style={{ textAlign: 'center' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--accent)' }}>pets</span>
          <div style={{ marginTop: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>Loading...</div>
        </div>
      </div>
    )
  }

  if (!isAuth) return <Login />

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard onNavigate={setCurrentPage} />
      case 'staff': return <Staff />
      case 'menu': return <Menu />
      case 'orders': return <OrderTerminal />
      case 'schedule': return <Schedule />
      case 'attendance': return <Attendance />
      case 'recipes': return <Recipes />
      case 'procurement': return <Procurement />
      case 'reports': return <Reports />
    }
  }

  return (
    <div className="app-layout">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <div className="main-area">
        <Layout page={currentPage} />
        <div className="page-content">
          {renderPage()}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
