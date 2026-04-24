import { runAgentRouter } from "../agents/router.js"
import { runBriefingAgent } from "../agents/briefing.js"
import { JobPayload, ProgressEvent } from "../types.js"
import { store } from "../store.js"
import { saveKBEntry } from "../db.js"

async function processPayload(jobId: string, payload: JobPayload): Promise<void> {
  const { intent, context = {}, agentType } = payload

  store.setStatus(jobId, "running")

  const onProgress = (event: ProgressEvent) => {
    store.appendEvent(jobId, event)
  }

  let result
  try {
    if (agentType === "briefing") {
      result = await runBriefingAgent(
        (context.company_name as string) || intent,
        context.domain as string | undefined,
        context.context as string | undefined,
        onProgress
      )
    } else {
      result = await runAgentRouter(intent, context, onProgress, agentType)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[worker] Job ${jobId.slice(0, 8)} threw:`, msg)
    onProgress({ type: "error", error: msg, timestamp: new Date().toISOString() })
    result = { success: false, error: msg }
  }

  // Collect PDF download_url from all render_pdf tool_result events
  const downloadUrls: string[] = []
  for (const ev of store.getJob(jobId)?.events ?? []) {
    if (ev.type === "tool_result" && ev.success && ev.output) {
      const out = ev.output as Record<string, unknown>
      if (typeof out.download_url === "string") downloadUrls.push(out.download_url)
    }
  }

  const finalText = (result as { result?: string }).result ?? ""

  // Parse NAMA_PRODUK
  const productNameMatch = finalText.match(/NAMA_PRODUK:\s*(.+)/i)
  const productName      = productNameMatch?.[1]?.trim()

  // Parse RINGKASAN
  const summaryMatch = finalText.match(/RINGKASAN:\s*(.+(?:\n(?!EMAIL_DRAFT|NAMA_PRODUK).+)*)/i)
  const summary      = summaryMatch?.[1]?.trim()

  // Parse multiple EMAIL_DRAFT blocks
  interface EmailDraft { company: string; email: string; role: string; subject: string; body: string }
  const emailDrafts: EmailDraft[] = []
  const sections = finalText.split(/EMAIL_DRAFT_\d+:/i).slice(1)
  for (const section of sections) {
    const company = section.match(/PERUSAHAAN:\s*(.+)/i)?.[1]?.trim() ?? ""
    const email   = section.match(/EMAIL:\s*(.+)/i)?.[1]?.trim() ?? ""
    const role    = section.match(/PERAN:\s*(.+)/i)?.[1]?.trim() ?? ""
    const subject = section.match(/SUBJEK:\s*(.+)/i)?.[1]?.trim() ?? ""
    const bodyRaw = section.match(/ISI:\n?([\s\S]+)/i)?.[1]?.trim() ?? ""
    if (company || subject) {
      emailDrafts.push({ company, email, role, subject, body: bodyRaw.slice(0, 2000) })
    }
  }

  // Fallback: legacy single EMAIL_SUBJECT / EMAIL_BODY format
  const legacySubject = finalText.match(/EMAIL_SUBJECT:\s*(.+)/i)?.[1]?.trim()
  const legacyBody    = finalText.match(/EMAIL_BODY:\s*([\s\S]+?)(?:\n{2,}---|$)/i)?.[1]?.trim()

  const richResult = {
    success:            (result as { success: boolean }).success,
    result:             finalText,
    iterations:         (result as { iterations?: number }).iterations,
    download_urls:      downloadUrls,
    product_name:       productName,
    summary,
    email_drafts:       emailDrafts.length > 0 ? emailDrafts : undefined,
    // legacy fallback
    email_subject:      emailDrafts.length === 0 ? legacySubject : undefined,
    email_body_preview: emailDrafts.length === 0 ? legacyBody?.slice(0, 1500) : undefined,
  }

  // ── Auto-save to KB from parsed text (fallback when tools were not called) ──
  // Check if profile_company was ever called in this job
  const events = store.getJob(jobId)?.events ?? []
  const profileCompanyCalled = events.some(ev => ev.type === "tool_result" && ev.tool === "profile_company" && ev.success)

  if (!profileCompanyCalled && emailDrafts.length > 0) {
    for (const draft of emailDrafts) {
      if (!draft.company) continue
      try {
        saveKBEntry({
          type:  "company_profile",
          name:  draft.company,
          tags:  ["auto-extracted", agentType],
          jobId,
          data:  {
            company_name: draft.company,
            email:        draft.email || undefined,
            role:         draft.role,
            source:       "text_extraction",
          },
        })
      } catch { /* ignore */ }
    }
  }

  if (productName && summary) {
    try {
      saveKBEntry({
        type:  "proposal",
        name:  productName,
        tags:  ["proposal", agentType],
        jobId,
        data:  {
          product_name:  productName,
          summary,
          email_drafts:  emailDrafts,
          download_urls: downloadUrls,
          result_snippet: finalText.slice(0, 3000),
        },
      })
    } catch { /* ignore */ }
  }

  store.setResult(jobId, richResult)
  store.setStatus(jobId, richResult.success ? "done" : "failed")
}

export function startWorker(): void {
  async function loop(): Promise<void> {
    while (true) {
      if (store.runningCount < 3 && store["queue"].length > 0) {
        const item = store.dequeue()
        if (item) {
          store.incRunning()
          processPayload(item.jobId, item.payload)
            .finally(() => store.decRunning())
        }
      }
      await new Promise(r => setTimeout(r, 100))
    }
  }
  loop().catch(console.error)
  console.log("[worker] In-memory worker started (concurrency=3)")
}
