import { WebSocketServer, WebSocket } from "ws"
import { store } from "../store.js"
import { ProgressEvent } from "../types.js"

export function setupWebSocket(server: import("http").Server): void {
  const wss = new WebSocketServer({ server, path: "/ws" })

  wss.on("connection", (ws: WebSocket) => {
    let subscribedJobId: string | null = null

    const listener = (event: ProgressEvent) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(event))
      }
    }

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString())

        if (msg.type === "subscribe" && msg.jobId) {
          if (subscribedJobId) {
            store.off(`events:${subscribedJobId}`, listener)
          }
          subscribedJobId = msg.jobId

          // Send existing events immediately
          const job = store.getJob(msg.jobId)
          if (job) {
            for (const e of job.events) {
              ws.send(JSON.stringify(e))
            }
          }

          // Subscribe to future events
          store.on(`events:${subscribedJobId}`, listener)
        }

        if (msg.type === "unsubscribe" && subscribedJobId) {
          store.off(`events:${subscribedJobId}`, listener)
          subscribedJobId = null
        }
      } catch {
        ws.send(JSON.stringify({ error: "Invalid message format" }))
      }
    })

    ws.on("close", () => {
      if (subscribedJobId) {
        store.off(`events:${subscribedJobId}`, listener)
      }
    })
  })
}
