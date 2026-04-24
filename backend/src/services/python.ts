const GATEWAY = process.env.GATEWAY_URL || "http://localhost:8000"

export async function post(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${GATEWAY}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gateway ${path} HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  const json = await res.json() as { success: boolean; data: unknown; error: string | null }
  if (!json.success) throw new Error(json.error || "Gateway error")
  return json.data
}

export async function crawlWebsite(url: string, extractEmails = false) {
  return post("/fetch", { url, extract_emails: extractEmails })
}

export async function fetchBatch(urls: string[], concurrency = 10) {
  return post("/fetch-batch", { urls, concurrency })
}

export async function extractEntities(text: string, language = "auto") {
  return post("/entities", { text, language })
}

export async function detectLanguage(text: string) {
  return post("/detect-lang", { text })
}

export async function extractEmails(text: string) {
  return post("/extract-emails", { text })
}

export async function llmComplete(system: string, user: string) {
  return post("/complete", { text: `${system}\n\n${user}` })
}

export async function searchNews(query: string, language = "auto", maxItems = 15) {
  return post("/search-news", { query, language, max_items: maxItems })
}

export async function searchWeb(query: string, maxResults = 10) {
  return post("/search-web", { query, max_results: maxResults, region: "id-id" })
}

export async function profileCompany(companyName: string, text: string, language = "auto") {
  return post("/profile", { company_name: companyName, text, language })
}

export async function synthesizeProfiles(profiles: object[]) {
  return post("/synthesize", { profiles })
}

export async function generateProposal(profile: object, synthesis: object, author: string) {
  return post("/propose", { profile, synthesis, author })
}

export async function generateBriefingReport(companyName: string, domain?: string, context?: string) {
  return post("/briefing", { company_name: companyName, domain, context })
}

export async function domainIntelligence(domain: string) {
  return post("/domain-intel", { domain })
}

export async function renderPdf(type: "outbound" | "internal", data: object, theme = "light") {
  const t = (type === "outbound" || type === "internal") ? type : "internal"
  return post(`/render-${t}`, { data, theme })
}

export async function saveToKnowledgeBase(type: string, data: object, tags: string[] = []) {
  return post("/save-run", { run_data: { type, data, tags } })
}
