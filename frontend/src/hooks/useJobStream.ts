import { useEffect, useRef, useCallback } from "react"

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001"
const WS_URL  = BACKEND.replace(/^http/, "ws")

type EventCallback = (event: Record<string, unknown>) => void

export function useJobStream(jobId: string | null, onEvent: EventCallback) {
  const wsRef = useRef<WebSocket | null>(null)
  const stableOnEvent = useRef(onEvent)
  stableOnEvent.current = onEvent

  const connect = useCallback(() => {
    if (!jobId) return
    const ws = new WebSocket(`${WS_URL}/ws`)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "subscribe", jobId }))
    }

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        stableOnEvent.current(msg)
      } catch { /* ignore */ }
    }

    ws.onerror = () => { /* silent */ }
    ws.onclose = () => { wsRef.current = null }
  }, [jobId])

  useEffect(() => {
    connect()
    return () => {
      const ws = wsRef.current
      if (!ws) return
      if (ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ type: "unsubscribe", jobId })) } catch { /* */ }
      }
      if (ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
        ws.close()
      }
    }
  }, [connect, jobId])
}
