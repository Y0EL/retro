import "dotenv/config"
import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { agentsRouter } from "./routes/agents.js"
import { kbRouter } from "./routes/kb.js"
import { authRouter } from "./routes/auth.js"
import { setupWebSocket } from "./routes/ws.js"
import { startWorker } from "./queue/worker.js"
import { startOrchestrator } from "./pipeline/orchestrator.js"

const app = new Hono()

app.use("*", cors({ origin: "*" }))
// Skip logging for noisy polling endpoints
app.use("*", (c, next) => {
  const url = c.req.url
  if (url.includes("/api/agents/jobs") || url.includes("/health")) return next()
  return logger()(c, next)
})

app.get("/health", (c) => c.json({ status: "ok", service: "retro-backend" }))
app.route("/api/agents", agentsRouter)
app.route("/api/kb", kbRouter)
app.route("/api/auth", authRouter)

// Proxy download PDF dari gateway — supaya frontend cukup tahu URL backend saja
app.get("/api/files/:filename", async (c) => {
  const filename = c.req.param("filename")
  const gateway = process.env.GATEWAY_URL || "http://localhost:8000"
  const upstream = await fetch(`${gateway}/files/${encodeURIComponent(filename)}`)
  if (!upstream.ok) return c.json({ error: "File not found" }, 404)
  const buffer = await upstream.arrayBuffer()
  c.header("Content-Type", "application/pdf")
  c.header("Content-Disposition", `attachment; filename="${filename}"`)
  return c.body(buffer)
})

const PORT = parseInt(process.env.BACKEND_PORT || "3001")

const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`RETRO backend running on http://localhost:${info.port}`)
  console.log(`WebSocket available at ws://localhost:${info.port}/ws`)
})

setupWebSocket(server as import("http").Server)
startWorker()
startOrchestrator()
