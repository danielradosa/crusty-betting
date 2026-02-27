import { AuthResponse, User } from '../types'
import { apiRequest } from './apiClient'

export async function login(email: string, password: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
}

export async function signup(email: string, password: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
}

export async function me(accessToken: string): Promise<User> {
  return apiRequest<User>('/auth/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}
