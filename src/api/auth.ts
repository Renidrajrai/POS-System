import { api, setAuthToken } from './client'

export interface LoginResponse {
  token: string
  email: string
  role: string
}

export async function login(email: string, password: string) {
  const res = await api.post<LoginResponse>('/auth/login', { email, password })
  setAuthToken(res.token)
  return res
}

export function logout() {
  setAuthToken(null)
}
