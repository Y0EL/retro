import OpenAI from "openai"
import { RETRO_TOOLS } from "./schemas.js"
import * as py from "../services/python.js"
import { AgentResult, ProgressEvent } from "../types.js"

const primaryClient = new OpenAI({
  baseURL: process.env.OLLAMA_URL || "http://localhost:11434/v1",
  apiKey: "ollama",
})
const PRIMARY_MODEL = process.env.OLLAMA_MODEL || "qwen3.5:latest"

// Dangerous input patterns — defense-in-depth, checked at framework level not prompt level
const BLOCKED_PATTERNS = [
  /rm\s+-rf/i,
  /DROP\s+TABLE/i,
  /eval\s*\(/i,
  /exec\s*\(/i,
  /\blocalhost\b/,
  /127\.0\.0\.1/,
  /0\.0\.0\.0/,
  /\bfile:\/\//i,
]

function validateToolInput(name: string, input: Record<string, unknown>): void {
  const s = JSON.stringify(input)
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(s)) {
      throw new Error(`Blocked dangerous input in tool ${name}: matched pattern ${pattern}`)
    }
  }
}

function now() {
  const d = new Date()
  return {
    year: d.getFullYear(),
    tanggal: d.toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
  }
}

// Estimate token count (rough: 4 chars ≈ 1 token)
function estimateTokens(messages: unknown[]): number {
  return Math.ceil(JSON.stringify(messages).length / 4)
}

type Message = OpenAI.Chat.ChatCompletionMessageParam

// Compress old messages when approaching Ollama context window (8192 tokens)
async function maybeCompressHistory(
  messages: Message[],
  onProgress: (e: ProgressEvent) => void,
  consecutiveFailures: { count: number }
): Promise<Message[]> {
  const MAX_TOKENS = 8192
  const THRESHOLD = 0.80

  if (consecutiveFailures.count >= 3) return messages
  if (estimateTokens(messages) < MAX_TOKENS * THRESHOLD) return messages

  const systemMsg = messages[0]
  const recent = messages.slice(-6)
  const toCompress = messages.slice(1, -6)
  if (toCompress.length === 0) return messages

  try {
    onProgress({ type: "tool_call", tool: "_compact", input: { tokens: estimateTokens(messages) }, timestamp: ts() })
    const compressReq = await (primaryClient.chat.completions.create as any)({
      model: PRIMARY_MODEL,
      think: false,
      max_tokens: 512,
      messages: [
        { role: "system", content: "Ringkas conversation berikut dalam 3 kalimat. Pertahankan: nama perusahaan, URL, profil, dan tool results penting. Jangan hilangkan fakta kritis." },
        { role: "user", content: JSON.stringify(toCompress) },
      ],
    })
    const summary = compressReq.choices[0]?.message?.content || ""
    onProgress({ type: "tool_result", tool: "_compact", output: { summary_length: summary.length }, success: true, timestamp: ts() })
    return [systemMsg, { role: "user", content: `[Ringkasan konteks sebelumnya: ${summary}]` }, ...recent]
  } catch {
    consecutiveFailures.count++
    return messages
  }
}

function buildSystemPrompt(agentType: string): string {
  const { year, tanggal } = now()

  const base = `Kamu adalah RETRO, agen intelijen B2B otonom milik PT GSP (PT Gemilang Satria Perkasa).
Tanggal hari ini: ${tanggal}. Tahun sekarang: ${year}. SELALU gunakan tahun ${year} saat mencari berita/event.
PT GSP bergerak di: Pertahanan & Keamanan, AI & Otomasi, Cyber Security, Intersepsi Komunikasi, Electronic Warfare, Surveillance & Intelligence, Digital Forensics.

PERAN: PT GSP adalah OPERATOR yang menjalankan RETRO. PT GSP adalah KITA — bukan target riset.
JANGAN PERNAH mencari "PT GSP", "PT Gemilang Satria Perkasa", atau perusahaan operator itu sendiri.
TUGAS: cari dan profil perusahaan LAIN — calon mitra, kompetitor, atau target sesuai instruksi user.

ATURAN: Bahasa Indonesia. TANPA emoji. Format laporan profesional.`

  if (agentType === "discovery") {
    return `${base}

KAMU ADALAH DISCOVERY AGENT. Cari perusahaan LAIN — bukan PT GSP. Ikuti 7 langkah ini SECARA BERURUTAN, WAJIB semua dijalankan:

LANGKAH 1 — search_news
Cari berita terkini (2-3 query berbeda, sertakan tahun ${year}).

LANGKAH 2 — search_web
Untuk setiap perusahaan yang muncul di berita, cari website resminya dulu dengan search_web.
Contoh query: "PT Nama Perusahaan official website". Ambil URL dari hasil search_web.

LANGKAH 3 — crawl_website
Crawl URL yang DITEMUKAN dari hasil search_web. JANGAN mengarang URL.

LANGKAH 4 — profile_company
Untuk setiap website yang berhasil di-crawl, buat profil terstruktur dari teks hasil crawl.

LANGKAH 5 — discover_emails
Temukan email kontak untuk setiap perusahaan yang sudah diprofil.

LANGKAH 6 — save_to_knowledge_base
Simpan setiap profil perusahaan TERVERIFIKASI ke KB (type: "company_profile").
Isi field "data" dengan hasil profile_company. WAJIB dijalankan untuk setiap perusahaan.

LANGKAH 7 — render_pdf
Generate laporan PDF ringkasan temuan. Gunakan type: "internal" (WAJIB diisi).
Isi field "data" dengan ringkasan semua profil perusahaan yang ditemukan.

PENTING: Jangan berhenti di langkah 1 atau 2. Selesaikan SEMUA 7 langkah.
JANGAN mengarang nama perusahaan — hanya profil company yang website-nya BENAR-BENAR di-crawl.`
  }

  if (agentType === "proposal") {
    return `${base}

KAMU ADALAH PROPOSAL AGENT. Ikuti langkah ini SECARA BERURUTAN:

LANGKAH 1 — crawl_website
Crawl website perusahaan target untuk mendapatkan info terbaru.

LANGKAH 2 — profile_company
Buat profil terstruktur dari hasil crawl.

LANGKAH 3 — generate_proposal
Generate proposal kemitraan B2B profesional menggunakan profil.
Field "author" isi dengan "PT GSP".

LANGKAH 4 — render_pdf
Render proposal ke PDF (type: "outbound").

LANGKAH 5 — save_to_knowledge_base
Simpan proposal ke KB (type: "proposal").

PENTING: Output akhir HARUS menyertakan link download PDF.`
  }

  if (agentType === "admin") {
    return `${base}

KAMU ADALAH ADMIN AGENT. Bantu tim PT GSP dengan:
- Query dan rangkum data dari knowledge base
- Buat laporan status pipeline
- Identifikasi perusahaan yang belum di-follow up
- Generate ringkasan aktivitas

Gunakan save_to_knowledge_base untuk menyimpan laporan admin (type: "research").
Gunakan render_pdf untuk laporan yang perlu dicetak.`
  }

  // default / briefing
  return base
}

function ts(): string {
  return new Date().toISOString()
}

async function executeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  // Security: validate inputs before execution
  validateToolInput(name, input)

  switch (name) {
    case "search_web":
      return py.searchWeb(input.query as string, input.max_results as number || 10)
    case "crawl_website":
      return py.crawlWebsite(input.url as string, input.extract_emails as boolean)
    case "search_news": {
      const year = new Date().getFullYear()
      const q = input.query as string
      const queryWithYear = q.includes(String(year)) ? q : `${q} ${year}`
      return py.searchNews(queryWithYear, (input.language as string) || "auto")
    }
    case "profile_company":
      return py.profileCompany(input.company_name as string, input.text as string, input.language as string)
    case "domain_intelligence":
      return py.domainIntelligence(input.domain as string)
    case "discover_emails":
      return py.extractEmails(`Company: ${input.company_name} Domain: ${input.domain}`)
    case "extract_entities":
      return py.extractEntities(input.text as string, input.language as string)
    case "generate_proposal":
      return py.generateProposal(
        input.company_profile as object,
        { executive_summary: (input.context as string) || "" },
        (input.author as string) || "PT GSP"
      )
    case "render_pdf":
      return py.renderPdf(input.type as "outbound" | "internal", input.data as object, input.theme as string)
    case "save_to_knowledge_base":
      return py.saveToKnowledgeBase(input.type as string, input.data as object, input.tags as string[])
    case "generate_briefing_report":
      return py.generateBriefingReport(input.company_name as string, input.domain as string, input.context as string)
    // ── Extended OSINT Tools ─────────────────────────────────────────────────
    case "ip_intelligence":
      return py.post("/ip-intel", { ip: input.ip })
    case "url_scan":
      return py.post("/url-scan", { url: input.url })
    case "domain_reputation":
      return py.post("/domain-reputation", { domain: input.domain })
    case "sanctions_check":
      return py.post("/sanctions-check", { name: input.name, type: input.type || "company" })
    case "company_lookup":
      return py.post("/company-lookup", { name: input.name, jurisdiction: input.jurisdiction || "id" })
    case "threat_intel":
      return py.post("/threat-intel", { indicator: input.indicator, type: input.type || "domain" })
    case "wayback_snapshot":
      return py.post("/wayback", { url: input.url })
    case "geolocation":
      return py.post("/geolocate", { query: input.query })
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

export async function runAgentRouter(
  intent: string,
  context: Record<string, unknown> = {},
  onProgress: (event: ProgressEvent) => void,
  agentType = "discovery"
): Promise<AgentResult> {
  const messages: Message[] = [
    { role: "system", content: buildSystemPrompt(agentType) },
    { role: "user", content: `Tugas: ${intent}\n\nKonteks: ${JSON.stringify(context)}\n\nIngat: jalankan SEMUA langkah wajib sampai selesai.` }
  ]

  let iterationCount = 0
  const MAX_ITERATIONS = 25
  const compactFailures = { count: 0 }

  while (iterationCount < MAX_ITERATIONS) {
    iterationCount++

    // Auto-compact: compress history if approaching context window limit
    const compressed = await maybeCompressHistory(messages, onProgress, compactFailures)
    if (compressed !== messages) {
      messages.length = 0
      messages.push(...compressed)
    }

    // think: false disables Qwen3 thinking mode — faster, no <think> blocks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (primaryClient.chat.completions.create as any)({
      model: PRIMARY_MODEL,
      max_tokens: 4096,
      tools: RETRO_TOOLS,
      tool_choice: iterationCount < 6 ? "required" : "auto",
      messages,
      think: false,
    })

    const choice = response.choices[0]
    const msg = choice.message

    messages.push({
      role: "assistant",
      content: msg.content || null,
      tool_calls: msg.tool_calls,
    } as Message)

    if (choice.finish_reason === "stop" || !msg.tool_calls?.length) {
      if (iterationCount < 4) {
        messages.push({
          role: "user",
          content: `Kamu baru menyelesaikan langkah awal. Lanjutkan ke langkah berikutnya — crawl website perusahaan yang ditemukan, buat profil, dan simpan ke knowledge base.`
        })
        continue
      }
      const finalText = msg.content || ""
      onProgress({ type: "completed", message: `Selesai dalam ${iterationCount} iterasi`, timestamp: ts() })
      return { success: true, result: finalText, iterations: iterationCount }
    }

    for (const toolCall of msg.tool_calls || []) {
      const name = toolCall.function.name
      let input: Record<string, unknown> = {}
      try {
        input = JSON.parse(toolCall.function.arguments)
      } catch {
        input = {}
      }

      onProgress({ type: "tool_call", tool: name, input, timestamp: ts() })

      let resultContent: string
      try {
        const result = await executeTool(name, input)
        resultContent = JSON.stringify(result)
        onProgress({ type: "tool_result", tool: name, output: result, success: true, timestamp: ts() })
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        resultContent = `Error: ${errorMsg}`
        onProgress({ type: "tool_result", tool: name, success: false, error: errorMsg, timestamp: ts() })
      }

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: resultContent,
      })
    }
  }

  return { success: false, error: "Max iterations reached", iterations: iterationCount }
}
