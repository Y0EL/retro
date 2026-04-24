import { Hono } from "hono"

const GATEWAY = process.env.GATEWAY_URL || "http://localhost:8000"

export const kbRouter = new Hono()

kbRouter.get("/", async (c) => {
  const type = c.req.query("type")
  try {
    const url = `${GATEWAY}/kb${type ? `?type=${type}` : ""}`
    const r = await fetch(url)
    const data = await r.json() as { success?: boolean; data?: unknown }
    return c.json({ entries: Array.isArray(data) ? data : (data?.data || []) })
  } catch {
    return c.json({ entries: [] })
  }
})

kbRouter.get("/:id", async (c) => {
  const { id } = c.req.param()
  try {
    const r = await fetch(`${GATEWAY}/kb/${id}`)
    if (!r.ok) return c.json({ error: "Not found" }, 404)
    const data = await r.json()
    return c.json(data)
  } catch {
    return c.json({ error: "Gateway error" }, 502)
  }
})
