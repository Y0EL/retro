import Database from "better-sqlite3"
import { createHash } from "crypto"
import path from "path"

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "retro.db")

const db = new Database(DB_PATH)

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL")
db.pragma("foreign_keys = ON")

// ── Schema ────────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    jobId       TEXT PRIMARY KEY,
    status      TEXT NOT NULL DEFAULT 'queued',
    agentType   TEXT,
    intent      TEXT,
    createdAt   TEXT,
    startedAt   TEXT,
    completedAt TEXT,
    result      TEXT,
    events      TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS kb_entries (
    id        TEXT PRIMARY KEY,
    type      TEXT NOT NULL,
    name      TEXT,
    domain    TEXT,
    tags      TEXT DEFAULT '[]',
    createdAt TEXT NOT NULL,
    jobId     TEXT,
    data      TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token     TEXT PRIMARY KEY,
    username  TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    lastSeen  TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_kb_type    ON kb_entries(type);
  CREATE INDEX IF NOT EXISTS idx_kb_name    ON kb_entries(name);
  CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
`)

// ── Prepared Statements ───────────────────────────────────────────────────────
const stmts = {
  upsertJob: db.prepare(`
    INSERT INTO jobs (jobId, status, agentType, intent, createdAt, startedAt, completedAt, result, events)
    VALUES (@jobId, @status, @agentType, @intent, @createdAt, @startedAt, @completedAt, @result, @events)
    ON CONFLICT(jobId) DO UPDATE SET
      status = excluded.status,
      startedAt = excluded.startedAt,
      completedAt = excluded.completedAt,
      result = excluded.result,
      events = excluded.events
  `),

  getJob: db.prepare(`SELECT * FROM jobs WHERE jobId = ?`),

  listJobs: db.prepare(`SELECT * FROM jobs ORDER BY createdAt DESC LIMIT 50`),

  upsertKB: db.prepare(`
    INSERT INTO kb_entries (id, type, name, domain, tags, createdAt, jobId, data)
    VALUES (@id, @type, @name, @domain, @tags, @createdAt, @jobId, @data)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      domain = excluded.domain,
      tags = excluded.tags,
      data = excluded.data
  `),

  listKB: db.prepare(`SELECT * FROM kb_entries ORDER BY createdAt DESC LIMIT 200`),
  listKBByType: db.prepare(`SELECT * FROM kb_entries WHERE type = ? ORDER BY createdAt DESC LIMIT 200`),
  getKBById: db.prepare(`SELECT * FROM kb_entries WHERE id = ?`),
  getKBByName: db.prepare(`SELECT * FROM kb_entries WHERE LOWER(name) LIKE LOWER(?) ORDER BY createdAt DESC LIMIT 1`),
  countKB: db.prepare(`SELECT COUNT(*) as n FROM kb_entries`),
  countKBByType: db.prepare(`SELECT type, COUNT(*) as n FROM kb_entries GROUP BY type`),

  upsertSession: db.prepare(`
    INSERT INTO sessions (token, username, createdAt, lastSeen)
    VALUES (@token, @username, @createdAt, @lastSeen)
    ON CONFLICT(token) DO UPDATE SET lastSeen = excluded.lastSeen
  `),

  getSession: db.prepare(`SELECT * FROM sessions WHERE token = ?`),
  deleteSession: db.prepare(`DELETE FROM sessions WHERE token = ?`),
  countJobsByStatus: db.prepare(`SELECT status, COUNT(*) as n FROM jobs GROUP BY status`),
}

// ── Job persistence ───────────────────────────────────────────────────────────
export interface DBJob {
  jobId: string
  status: string
  agentType?: string
  intent?: string
  createdAt?: string
  startedAt?: string
  completedAt?: string
  result?: string      // JSON
  events?: string      // JSON array
}

export function upsertJob(job: DBJob) {
  stmts.upsertJob.run({
    ...job,
    result: job.result ?? null,
    events: job.events ?? "[]",
  })
}

export function getJobFromDB(jobId: string): DBJob | undefined {
  return stmts.getJob.get(jobId) as DBJob | undefined
}

export function listJobsFromDB(): DBJob[] {
  return stmts.listJobs.all() as DBJob[]
}

// ── KB entries ────────────────────────────────────────────────────────────────
export interface DBKBEntry {
  id: string
  type: string
  name?: string
  domain?: string
  tags?: string    // JSON
  createdAt: string
  jobId?: string
  data: string     // JSON
}

function kbId(type: string, name: string): string {
  return createHash("sha256").update(`${type}:${name.toLowerCase()}`).digest("hex").slice(0, 16)
}

export function saveKBEntry(entry: {
  type: string
  name?: string
  domain?: string
  tags?: string[]
  jobId?: string
  data: Record<string, unknown>
}): string {
  const id = kbId(entry.type, entry.name || entry.domain || JSON.stringify(entry.data).slice(0, 40))
  stmts.upsertKB.run({
    id,
    type: entry.type,
    name: entry.name ?? null,
    domain: entry.domain ?? null,
    tags: JSON.stringify(entry.tags ?? []),
    createdAt: new Date().toISOString(),
    jobId: entry.jobId ?? null,
    data: JSON.stringify(entry.data),
  })
  return id
}

export function listKBEntries(type?: string): Array<{
  id: string; type: string; tags: string[]; createdAt: string; data: Record<string, unknown>; name?: string; domain?: string; jobId?: string
}> {
  const rows = (type ? stmts.listKBByType.all(type) : stmts.listKB.all()) as DBKBEntry[]
  return rows.map(r => ({
    id: r.id,
    type: r.type,
    name: r.name,
    domain: r.domain,
    jobId: r.jobId,
    tags: JSON.parse(r.tags ?? "[]"),
    createdAt: r.createdAt,
    data: JSON.parse(r.data),
  }))
}

export function getKBEntry(id: string) {
  const row = stmts.getKBById.get(id) as DBKBEntry | undefined
  if (!row) return undefined
  return { id: row.id, type: row.type, name: row.name, domain: row.domain, jobId: row.jobId, tags: JSON.parse(row.tags ?? "[]"), createdAt: row.createdAt, data: JSON.parse(row.data) }
}

export function getKBEntryByName(name: string) {
  const row = stmts.getKBByName.get(`%${name}%`) as DBKBEntry | undefined
  if (!row) return undefined
  return { id: row.id, type: row.type, name: row.name, domain: row.domain, jobId: row.jobId, tags: JSON.parse(row.tags ?? "[]"), createdAt: row.createdAt, data: JSON.parse(row.data) }
}

export function getKBStats(): { total: number; byType: Record<string, number> } {
  const total = (stmts.countKB.get() as { n: number }).n
  const rows  = stmts.countKBByType.all() as { type: string; n: number }[]
  const byType = Object.fromEntries(rows.map(r => [r.type, r.n]))
  return { total, byType }
}

// ── Session / Auth ────────────────────────────────────────────────────────────
export function createSession(username: string): string {
  const token = createHash("sha256")
    .update(`retro:${username}:${Date.now()}:${Math.random()}`)
    .digest("hex")
  const now = new Date().toISOString()
  stmts.upsertSession.run({ token, username, createdAt: now, lastSeen: now })
  return token
}

export function validateSession(token: string): { username: string } | null {
  const row = stmts.getSession.get(token) as { token: string; username: string } | undefined
  if (!row) return null
  stmts.upsertSession.run({ token, username: row.username, createdAt: new Date().toISOString(), lastSeen: new Date().toISOString() })
  return { username: row.username }
}

export function deleteSession(token: string) {
  stmts.deleteSession.run(token)
}

export function getJobStats(): { total: number; running: number; done: number; failed: number } {
  const rows = stmts.countJobsByStatus.all() as { status: string; n: number }[]
  const map  = Object.fromEntries(rows.map(r => [r.status, r.n]))
  return {
    total:   rows.reduce((s, r) => s + r.n, 0),
    running: (map["running"] ?? 0) + (map["queued"] ?? 0),
    done:    map["done"]   ?? 0,
    failed:  map["failed"] ?? 0,
  }
}

export { db }
