const API_BASE = '/api'

let token: string | null = localStorage.getItem('mauspot_token')

export function setAuthToken(newToken: string | null) {
  token = newToken
  if (newToken) localStorage.setItem('mauspot_token', newToken)
  else localStorage.removeItem('mauspot_token')
}

export function getAuthToken() {
  return token
}

export function isAuthenticated() {
  return !!token
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (res.status === 401) {
    setAuthToken(null)
    window.dispatchEvent(new CustomEvent('auth:unauthorized'))
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Request failed')
  }

  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
