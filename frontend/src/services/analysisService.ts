import { DemoMatchAnalysisResponse, MatchAnalysisRequest, MatchAnalysisResponse } from '../types'
import { apiRequest } from './apiClient'

export function demoAnalyze(payload: MatchAnalysisRequest) {
  return apiRequest<DemoMatchAnalysisResponse>('/api/v1/demo-analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function analyzeMatch(payload: MatchAnalysisRequest, apiKey: string) {
  return apiRequest<MatchAnalysisResponse>('/api/v1/analyze-match', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify(payload),
  })
}
