import { Hono } from "hono"
import { listKBEntries, getKBEntry, getKBEntryByName } from "../db.js"

export const kbRouter = new Hono()

// GET /api/kb?type=company_profile|proposal|research|correspondence
kbRouter.get("/", (c) => {
  const type = c.req.query("type") || undefined
  const entries = listKBEntries(type)
  return c.json({ entries })
})

// GET /api/kb/:id  — falls back to name search if ID not found
// Handles graph node IDs like "company-pt-sentosa-makanan-indonesia"
kbRouter.get("/:id", (c) => {
  const { id } = c.req.param()
  let entry = getKBEntry(id)
  if (!entry) {
    // Normalize graph node ID → human name: strip prefix, replace dashes with spaces
    const name = decodeURIComponent(id)
      .replace(/^(company|domain|email)-/, "")
      .replace(/-/g, " ")
    entry = getKBEntryByName(name)
  }
  if (!entry) return c.json({ error: "Entry not found" }, 404)
  return c.json(entry)
})
