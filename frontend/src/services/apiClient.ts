export class ApiError extends Error {
  status: number
  details?: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

async function parseErrorPayload(res: Response) {
  try {
    const json = await res.json()
    const detail = (json as any)?.detail
    if (typeof detail === 'string') return { message: detail, details: json }
    if (detail?.message) return { message: detail.message as string, details: detail }
    if ((json as any)?.message) return { message: (json as any).message as string, details: json }
    return { message: JSON.stringify(json), details: json }
  } catch {
    const txt = await res.text().catch(() => '')
    return { message: txt || `Request failed (${res.status})`, details: txt }
  }
}

export async function apiRequest<T>(input: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(input, init)
  if (!res.ok) {
    const parsed = await parseErrorPayload(res)
    throw new ApiError(parsed.message || 'Request failed', res.status, parsed.details)
  }
  return res.json() as Promise<T>
}
