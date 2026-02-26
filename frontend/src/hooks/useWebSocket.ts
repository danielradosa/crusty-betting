import { useEffect, useRef, useState, useCallback } from "react"
import { useAuthStore } from "./useAuth"
import { RealTimeStats } from "../types"

interface UseWebSocketOptions {
  autoConnect?: boolean
  onMessage?: (arg0: RealTimeStats) => void
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { autoConnect = true, onMessage } = options
  const { accessToken } = useAuthStore()
  const [isConnected, setIsConnected] = useState(false)
  const [stats, setStats] = useState<RealTimeStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const connect = useCallback(() => {
    // don’t even try without a token (backend requires it)
    if (!accessToken) {
      setError("Not authenticated")
      return
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const host = window.location.host
    const wsUrl = `${protocol}//${host}/ws/stats?token=${encodeURIComponent(accessToken)}`

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setIsConnected(true)
      setError(null)
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        if (message.type === "stats" && message.data) {
          setStats(message.data)
          onMessage?.(message.data)
        } else if (message.type === "error") {
          setError(message.message || "Unknown error")
        }
      } catch (err) {
        console.error("WebSocket message error:", err)
      }
    }

    ws.onclose = () => {
      setIsConnected(false)
    }

    ws.onerror = () => {
      setError("WebSocket connection error")
    }
  }, [accessToken, onMessage])

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
      setIsConnected(false)
    }
  }, [])

  const requestStats = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "get_stats" }))
    }
  }, [])

  useEffect(() => {
    if (autoConnect && accessToken) connect()
    return () => disconnect()
  }, [autoConnect, accessToken, connect, disconnect])

  return { isConnected, stats, error, connect, disconnect, requestStats }
}