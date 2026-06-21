import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { setError('Email and password required'); return }
    setBusy(true)
    setError('')
    try {
      await login(email, password)
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--surface)',
    }}>
      <div style={{
        background: 'var(--surface-card)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-lg)',
        padding: 48,
        width: 400,
        border: '1px solid var(--border)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64,
            height: 64,
            background: 'var(--accent)',
            borderRadius: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--primary)' }}>
              pets
            </span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 4 }}>Meowspot</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Sign in to Management Suite</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{
              background: 'var(--danger-light)',
              color: 'var(--danger)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              marginBottom: 16,
            }}>{error}</div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 6, display: 'block' }}>Email</label>
            <input
              className="form-input"
              type="email"
              placeholder="admin@gmail.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoFocus
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 6, display: 'block' }}>Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn btn-accent"
            style={{ width: '100%', padding: 14, justifyContent: 'center', fontSize: '1rem' }}
            disabled={busy}
          >
            {busy ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
