import { apiRequest } from './apiClient'

export type PlayerSuggestion = {
  id: number
  name: string
  birthdate: string
  sport: string
  country?: string | null
}

export function searchPlayers(q: string, sport: string) {
  const url = `/api/v1/players?q=${encodeURIComponent(q)}&sport=${encodeURIComponent(sport || '')}`
  return apiRequest<PlayerSuggestion[]>(url)
}
