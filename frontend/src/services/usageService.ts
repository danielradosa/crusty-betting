import { apiRequest } from './apiClient'

export type UsageStats = {
  today: number
  this_month: number
  total: number
  tier?: 'free' | 'starter' | 'pro' | string
  limit: number
  reset_time: string
}

export function getUsageStats(accessToken: string) {
  return apiRequest<UsageStats>('/api/v1/usage-stats', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}
