import { ApiKey } from '../types'
import { apiRequest } from './apiClient'

function authHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` }
}

export function listApiKeys(accessToken: string) {
  return apiRequest<ApiKey[]>('/api-keys', {
    headers: authHeaders(accessToken),
  })
}

export function createApiKey(accessToken: string, name: string) {
  return apiRequest<ApiKey>('/api-keys', {
    method: 'POST',
    headers: { ...authHeaders(accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
}

export function deleteApiKey(accessToken: string, id: string) {
  return apiRequest<{ message: string }>(`/api-keys/${id}`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  })
}
