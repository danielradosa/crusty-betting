import { apiRequest } from './apiClient'

export type PlayerSuggestion = {
  id: number | null
  name: string
  birthdate: string
  sport: string
  country?: string | null
  source?: 'db' | 'wikidata'
}

export function searchPlayers(q: string, sport: string) {
  const url = `/api/v1/players/suggest?q=${encodeURIComponent(q)}&sport=${encodeURIComponent(sport || '')}`
  return apiRequest<PlayerSuggestion[]>(url)
}
