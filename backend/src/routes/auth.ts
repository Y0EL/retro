import { Hono } from "hono"
import { createSession, validateSession, deleteSession, getJobStats, getKBStats } from "../db.js"

const AUTH_USER = process.env.AUTH_USER || "gsp"
const AUTH_PASS = process.env.AUTH_PASS || "gsp"

const USER_PROFILE = {
  username: AUTH_USER,
  org:      "PT Gemilang Satria Perkasa",
  role:     "Operator Intelijen",
  division: "Defense & Security Intelligence",
}

export const authRouter = new Hono()

// POST /api/auth/login
authRouter.post("/login", async (c) => {
  const body = await c.req.json().catch(() => ({})) as Record<string, string>
  const { username, password } = body

  if (username !== AUTH_USER || password !== AUTH_PASS) {
    return c.json({ error: "Username atau password salah" }, 401)
  }

  const token   = createSession(username)
  const loginAt = new Date().toISOString()

  return c.json({
    token,
    user: { ...USER_PROFILE, loginAt },
  })
})

// GET /api/auth/me — requires Authorization: Bearer <token>
authRouter.get("/me", (c) => {
  const authHeader = c.req.header("Authorization") ?? ""
  const token = authHeader.replace(/^Bearer\s+/i, "").trim()

  if (!token) return c.json({ error: "Tidak terautentikasi" }, 401)

  const session = validateSession(token)
  if (!session) return c.json({ error: "Sesi tidak valid atau sudah kedaluwarsa" }, 401)

  const jobStats = getJobStats()
  const kbStats  = getKBStats()

  return c.json({
    ...USER_PROFILE,
    stats: {
      totalJobs:      jobStats.total,
      runningJobs:    jobStats.running,
      completedJobs:  jobStats.done,
      failedJobs:     jobStats.failed,
      totalEntities:  kbStats.total,
      entitiesByType: kbStats.byType,
    },
  })
})

// POST /api/auth/logout
authRouter.post("/logout", (c) => {
  const authHeader = c.req.header("Authorization") ?? ""
  const token = authHeader.replace(/^Bearer\s+/i, "").trim()
  if (token) deleteSession(token)
  return c.json({ ok: true })
})
