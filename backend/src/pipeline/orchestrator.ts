import { store } from "../store.js"
import { enqueueAgentJob } from "../queue/producer.js"

const GATEWAY = process.env.GATEWAY_URL || "http://localhost:8000"

async function getRecentCompanyProfiles(): Promise<Array<{ company_name: string; domain?: string }>> {
  try {
    const res = await fetch(`${GATEWAY}/query-runs`)
    if (!res.ok) return []
    const data = await res.json() as { data?: { runs?: Array<{ run_data?: string }> } }
    const runs = data?.data?.runs || []
    const profiles: Array<{ company_name: string; domain?: string }> = []
    for (const run of runs.slice(0, 20)) {
      try {
        const rd = typeof run.run_data === "string" ? JSON.parse(run.run_data) : run.run_data
        if (rd?.type === "company_profile" && rd?.data?.company_name) {
          profiles.push({ company_name: rd.data.company_name, domain: rd.data.domain })
        }
      } catch { /* skip */ }
    }
    return profiles
  } catch {
    return []
  }
}

function extractCompaniesFromEvents(jobId: string): Array<{ name: string; domain?: string }> {
  const job = store.getJob(jobId)
  if (!job) return []

  const companies: Array<{ name: string; domain?: string }> = []
  const seen = new Set<string>()

  for (const event of job.events) {
    if (event.type === "tool_call" && event.tool === "save_to_knowledge_base") {
      const input = event.input as Record<string, unknown> | undefined
      if (input?.type === "company_profile") {
        const d = input.data as Record<string, unknown> | undefined
        const name = d?.company_name as string | undefined
        if (name && !seen.has(name)) { seen.add(name); companies.push({ name, domain: d?.domain as string | undefined }) }
      }
    }
    if (event.type === "tool_call" && event.tool === "profile_company") {
      const input = event.input as Record<string, unknown> | undefined
      const name = input?.company_name as string | undefined
      if (name && !seen.has(name)) { seen.add(name); companies.push({ name }) }
    }
  }
  return companies
}

export function startOrchestrator(): void {
  store.on("jobComplete", async (jobId: string) => {
    const job = store.getJob(jobId)
    if (!job || job.status !== "done") return

    // Skip auto-chained jobs to avoid infinite loops
    if ((job as unknown as { payload?: { context?: Record<string, unknown> } }).payload?.context?.auto_chained_from) return

    if (job.agentType === "discovery") {
      // First try event-based extraction
      let companies = extractCompaniesFromEvents(jobId)

      // Fallback: query the DB for recently saved profiles
      if (companies.length === 0) {
        const dbProfiles = await getRecentCompanyProfiles()
        companies = dbProfiles.map(p => ({ name: p.company_name, domain: p.domain }))
      }

      if (companies.length === 0) {
        console.log(`[orchestrator] Discovery ${jobId.slice(0, 8)} done but no companies found to chain`)
        return
      }

      console.log(`[orchestrator] Discovery ${jobId.slice(0, 8)} — auto-queueing briefing for ${companies.length} companies`)
      for (const company of companies.slice(0, 3)) {
        enqueueAgentJob({
          intent: `Buat briefing pra-pertemuan untuk ${company.name}`,
          agentType: "briefing",
          context: { company_name: company.name, domain: company.domain, auto_chained_from: jobId },
        })
      }
    }

    if (job.agentType === "briefing") {
      const ctx = (job as unknown as { payload?: { context?: Record<string, unknown> } }).payload?.context
      const companyName = ctx?.company_name as string | undefined
      if (!companyName) return

      console.log(`[orchestrator] Briefing for ${companyName} done — auto-queueing proposal`)
      enqueueAgentJob({
        intent: `Buat proposal kemitraan B2B untuk ${companyName}`,
        agentType: "proposal",
        context: { company_name: companyName, domain: ctx?.domain, auto_chained_from: jobId },
      })
    }
  })

  console.log("[orchestrator] Pipeline auto-chain aktif: discovery → briefing → proposal")
}
