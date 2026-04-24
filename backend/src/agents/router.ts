import OpenAI from "openai"
import { RETRO_TOOLS } from "./schemas.js"
import * as py from "../services/python.js"
import { AgentResult, ProgressEvent } from "../types.js"

const primaryClient = new OpenAI({
  baseURL: process.env.OLLAMA_URL || "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || (process.env.OLLAMA_URL?.includes("openrouter") ? "" : "ollama"),
  defaultHeaders: process.env.OPENROUTER_API_KEY ? {
    "HTTP-Referer": "https://retro.gsp.local",
    "X-Title": "RETRO Intel System",
  } : {},
})
const PRIMARY_MODEL = process.env.OLLAMA_MODEL || "meta-llama/llama-3.3-70b-instruct:free"

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
    const compressReq = await chatWithRetry({
      model: PRIMARY_MODEL,
      max_tokens: 1024,
      messages: [
        { role: "system", content: "Ringkas conversation berikut dalam 3 kalimat. Pertahankan: nama perusahaan, URL, profil, dan tool results penting. Jangan hilangkan fakta kritis." },
        { role: "user", content: JSON.stringify(toCompress) },
      ],
    })
    const raw = compressReq.choices[0]?.message
    const summary = (raw?.content || raw?.reasoning_content || "") as string
    onProgress({ type: "tool_result", tool: "_compact", output: { summary_length: summary.length }, success: true, timestamp: ts() })
    return [systemMsg, { role: "user", content: `[Ringkasan konteks sebelumnya: ${summary}]` }, ...recent]
  } catch {
    consecutiveFailures.count++
    return messages
  }
}

const GSP_CAPABILITIES = `PT GSP (PT Gemilang Satria Perkasa) menawarkan: solusi AI & Otomasi, Cyber Security, Surveillance & Intelligence, Digital Forensics, dan konsultasi teknologi B2B.`

function buildSystemPrompt(agentType: string): string {
  const { year, tanggal } = now()

  const base = `Kamu adalah RETRO, agen intelijen B2B milik PT GSP (PT Gemilang Satria Perkasa).
Tanggal hari ini: ${tanggal}. Tahun sekarang: ${year}. SELALU gunakan tahun ${year} saat mencari berita.

IDENTITAS: PT GSP adalah OPERATOR yang menjalankan kamu — BUKAN target riset.
JANGAN PERNAH mencari "PT GSP", "PT Gemilang Satria Perkasa", atau nama operator itu sendiri.
TUGAS: Cari dan profil perusahaan LAIN sesuai instruksi user.

ATURAN PENTING:
- FOKUS pada sektor/topik yang user minta. Jangan tambah sektor lain dari pikiranmu sendiri.
- Jika user minta "agrikultur", cari perusahaan agrikultur. Jika "desain grafis", cari desain grafis.
- JANGAN berasumsi user ingin pertahanan/keamanan kecuali user SECARA EKSPLISIT menyebutnya.
- Bahasa Indonesia. TANPA emoji. Format profesional.`

  if (agentType === "discovery") {
    return `${base}

KAMU ADALAH DISCOVERY AGENT. Jalankan SEMUA langkah berikut SECARA BERURUTAN:

LANGKAH 1 — search_news (2-3 query)
Cari berita terkini perusahaan di sektor yang USER MINTA (bukan sektor PT GSP).
Sertakan tahun ${year} di setiap query.

LANGKAH 2 — search_web
Untuk 2-3 perusahaan paling relevan dari berita, cari website resminya.
Query: "[Nama Perusahaan] official website"

LANGKAH 3 — crawl_website
Crawl URL yang ditemukan dari search_web. JANGAN mengarang URL.

LANGKAH 4 — profile_company
Buat profil terstruktur dari teks crawl untuk setiap perusahaan.

LANGKAH 5 — discover_emails
Temukan email kontak tiap perusahaan.

LANGKAH 6 — save_to_knowledge_base (type: "company_profile")
Simpan setiap profil ke KB. WAJIB untuk setiap perusahaan.

LANGKAH 7 — render_pdf (type: "internal")
Laporan ringkasan semua perusahaan ditemukan.

Selesaikan SEMUA langkah. JANGAN berhenti di langkah 1-2.`
  }

  if (agentType === "full") {
    return `${base}

KAMU ADALAH FULL PIPELINE AGENT — PENJAHIT BISNIS GSP.

KONSEP INTI:
Dari satu tema/ide yang diberikan user, kamu akan:
1. Menemukan beberapa perusahaan relevan di berbagai peran (supplier, distributor, teknologi, investor, dll)
2. Membangun profil lengkap tiap perusahaan
3. Menciptakan KONSEP PRODUK/BISNIS BARU atas nama PT GSP yang menyatukan perusahaan-perusahaan itu
4. Membuat PROPOSAL RESMI GSP untuk konsep tersebut
5. Membuat DRAFT EMAIL INDIVIDUAL dari GSP ke setiap perusahaan sesuai perannya

PT GSP SEBAGAI INITIATOR — bukan target. GSP yang menciptakan produk baru dan mengajak perusahaan-perusahaan itu bergabung.
${GSP_CAPABILITIES}

Jalankan SEMUA langkah SECARA BERURUTAN. JANGAN berhenti sebelum langkah 11:

LANGKAH 1 — search_news + search_web (per sub-sektor)
Cari berita/info perusahaan di SETIAP sub-sektor dari tema yang USER BERIKAN.
Gunakan query spesifik per peran sesuai tema user, sertakan tahun ${year}.
JANGAN gunakan contoh dari prompt ini — ikuti PERSIS apa yang user minta.

LANGKAH 2 — search_web (per perusahaan menjanjikan)
Cari website resmi 3-5 perusahaan paling relevan yang ditemukan.

LANGKAH 3 — crawl_website (tiap perusahaan)
Crawl website masing-masing.

LANGKAH 4 — profile_company (tiap perusahaan)
Profil terstruktur: nama, domain, kapabilitas, PERAN POTENSIAL dalam ekosistem baru.

LANGKAH 5 — discover_emails (tiap perusahaan)
Cari email kontak resmi. Simpan di profil.

LANGKAH 6 — save_to_knowledge_base (tiap profil, type: "company_profile")

LANGKAH 7 — generate_proposal
Buat SATU proposal GSP yang:
- Memperkenalkan NAMA PRODUK/BISNIS BARU yang GSP bangun (kreatif, berdasarkan tema)
- Executive summary: masalah yang diselesaikan, solusi GSP
- Daftar perusahaan mitra dan peran spesifik masing-masing
- Model bisnis / rencana implementasi
- Proyeksi nilai bisnis
Field "author": "PT GSP"

LANGKAH 8 — render_pdf (type: "outbound")
PDF proposal resmi GSP.

LANGKAH 9 — render_pdf (type: "internal")
Laporan internal: semua profil + analisis ekosistem + reasoning pemilihan mitra.

LANGKAH 10 — save_to_knowledge_base (type: "proposal")
Simpan proposal ke KB.

LANGKAH 11 — RINGKASAN AKHIR (FORMAT WAJIB — ikuti PERSIS, jangan ubah nama field):

NAMA_PRODUK: [nama produk baru yang diciptakan GSP]

RINGKASAN: [2-3 kalimat deskripsi produk dan model bisnisnya]

EMAIL_DRAFT_1:
PERUSAHAAN: [nama perusahaan 1]
EMAIL: [alamat email jika ditemukan, atau "belum ditemukan"]
PERAN: [peran spesifik perusahaan ini dalam produk baru]
SUBJEK: [baris subject email yang akan dikirim GSP ke perusahaan ini]
ISI:
[Tulis isi email lengkap 3-4 paragraf dalam bahasa Indonesia. Paragraf 1: perkenalan GSP dan produk baru. Paragraf 2: peran perusahaan ini. Paragraf 3: ajakan kerjasama konkret. Paragraf 4: penutup dan kontak. WAJIB ADA ISI, jangan kosong.]

EMAIL_DRAFT_2:
PERUSAHAAN: [nama perusahaan 2]
EMAIL: [alamat email atau "belum ditemukan"]
PERAN: [peran]
SUBJEK: [subject email]
ISI:
[isi email lengkap 3-4 paragraf]

(Ulangi untuk SETIAP perusahaan — maksimal 3 perusahaan)

PENTING: Setiap EMAIL_DRAFT HARUS memiliki SUBJEK dan ISI yang terisi lengkap.
Selesaikan SEMUA 11 langkah. Jangan skip satupun.`
  }

  if (agentType === "proposal") {
    return `${base}

KAMU ADALAH PROPOSAL AGENT. ${GSP_CAPABILITIES}

LANGKAH 1 — crawl_website
Crawl website perusahaan target.

LANGKAH 2 — profile_company
Profil terstruktur dari hasil crawl.

LANGKAH 3 — generate_proposal
Proposal kemitraan B2B profesional. Author: "PT GSP".

LANGKAH 4 — render_pdf (type: "outbound")
Render ke PDF. Output akhir HARUS menyertakan link PDF.

LANGKAH 5 — save_to_knowledge_base (type: "proposal")
Simpan ke KB.

LANGKAH 6 — Tulis draft email dengan format:
EMAIL_SUBJECT: [subject]
EMAIL_BODY: [isi email profesional 3-4 paragraf]`
  }

  if (agentType === "admin") {
    return `${base}

KAMU ADALAH ADMIN AGENT. Bantu tim PT GSP dengan:
- Query dan rangkum data dari knowledge base
- Buat laporan status pipeline
- Identifikasi perusahaan yang belum di-follow up

Gunakan save_to_knowledge_base (type: "research") dan render_pdf untuk laporan.`
  }

  // default / briefing
  return base
}

function ts(): string {
  return new Date().toISOString()
}

async function chatWithRetry(
  params: Parameters<typeof primaryClient.chat.completions.create>[0],
  maxRetries = 4
): Promise<any> {
  let delay = 8000
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await (primaryClient.chat.completions.create as any)(params)
    } catch (err: any) {
      const status = err?.status ?? err?.error?.code
      const isRateLimit = status === 429 || String(err?.message).includes("429")
      if (isRateLimit && attempt < maxRetries) {
        const retryAfterMs = parseInt(err?.error?.metadata?.headers?.["X-RateLimit-Reset"] ?? "0") - Date.now()
        const wait = retryAfterMs > 0 ? Math.min(retryAfterMs + 500, 65000) : delay
        await new Promise(r => setTimeout(r, wait))
        delay *= 2
        continue
      }
      throw err
    }
  }
  throw new Error("Max retries exceeded")
}

async function executeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  // Security: validate inputs before execution
  validateToolInput(name, input)

  switch (name) {
    case "search_web": {
      const q = (input.query ?? input.q ?? input.keyword ?? "") as string
      if (!q) return { results: [], message: "No query provided" }
      return py.searchWeb(q, input.max_results as number || 10)
    }
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
  agentType = "full"
): Promise<AgentResult> {
  const messages: Message[] = [
    { role: "system", content: buildSystemPrompt(agentType) },
    { role: "user", content: `Tugas: ${intent}\n\nKonteks: ${JSON.stringify(context)}\n\nIngat: jalankan SEMUA langkah wajib sampai selesai.` }
  ]

  let iterationCount = 0
  const MAX_ITERATIONS = agentType === "full" ? 28 : 20
  const compactFailures = { count: 0 }
  const toolCallCounts: Record<string, number> = {}

  while (iterationCount < MAX_ITERATIONS) {
    iterationCount++

    // Auto-compact: compress history if approaching context window limit
    const compressed = await maybeCompressHistory(messages, onProgress, compactFailures)
    if (compressed !== messages) {
      messages.length = 0
      messages.push(...compressed)
    }

    // ── Pipeline phase detection ──────────────────────────────────────────────
    const totalSearches = (toolCallCounts["search_web"] ?? 0) + (toolCallCounts["search_news"] ?? 0)
    const hasCrawled    = (toolCallCounts["crawl_website"] ?? 0) > 0
    const hasProfiled   = (toolCallCounts["profile_company"] ?? 0) > 0
    const hasProposed   = (toolCallCounts["generate_proposal"] ?? 0) > 0
    const hasPdf        = (toolCallCounts["render_pdf"] ?? 0) > 0

    // Determine which tools to expose based on current phase (reduces hallucination)
    let activeTools = RETRO_TOOLS
    let forcedTool: string | null = null

    if (agentType === "full") {
      if (totalSearches >= 6 && !hasProfiled) {
        // Force into profile phase — strip search tools, mandate profile_company
        activeTools = RETRO_TOOLS.filter((t: any) =>
          !["search_web", "search_news"].includes(t.function?.name ?? "")
        )
        if (!hasCrawled) {
          forcedTool = "crawl_website"
        } else {
          forcedTool = "profile_company"
        }
        messages.push({
          role: "user",
          content: `STOP MENCARI. ${totalSearches} pencarian sudah cukup. Sekarang panggil ${forcedTool} untuk perusahaan yang kamu temukan.`
        })
      } else if (hasProfiled && !hasProposed && iterationCount > 12) {
        forcedTool = "generate_proposal"
        messages.push({
          role: "user",
          content: `Profil sudah ada. Sekarang WAJIB panggil generate_proposal sekarang.`
        })
      } else if (hasProposed && !hasPdf) {
        forcedTool = "render_pdf"
        messages.push({
          role: "user",
          content: `Proposal sudah dibuat. Sekarang panggil render_pdf (type: "outbound") lalu render_pdf (type: "internal").`
        })
      }
    }

    // For full pipeline: require tool calls for first 10 iterations
    const forceTool = agentType === "full" ? iterationCount < 10 : iterationCount < 6
    const toolChoice = forcedTool
      ? { type: "function", function: { name: forcedTool } }
      : forceTool ? "required" : "auto"

    const response = await chatWithRetry({
      model: PRIMARY_MODEL,
      max_tokens: 4096,
      tools: activeTools,
      tool_choice: toolChoice,
      messages,
    } as any)

    const choice = response.choices[0]
    const msg = choice.message

    messages.push({
      role: "assistant",
      content: msg.content || null,
      tool_calls: msg.tool_calls,
    } as Message)

    if (choice.finish_reason === "stop" || !msg.tool_calls?.length) {
      const minIter = agentType === "full" ? 8 : 4
      const text = msg.content || ""

      // Detect if agent wrote a plan as text instead of calling tools
      const wroteTextPlan = /LANGKAH\s+[3-9]|LANGKAH\s+1[0-1]/i.test(text) && iterationCount < 15
      const missingTools  = agentType === "full" && !text.includes("NAMA_PRODUK:") && iterationCount < 18

      if (iterationCount < minIter || wroteTextPlan || missingTools) {
        let nudge: string
        if (wroteTextPlan) {
          nudge = `PERINGATAN: Kamu menulis rencana sebagai TEKS, bukan menjalankan tool calls! Kamu HARUS panggil tools secara nyata.

Sekarang panggil tools berikut yang BELUM kamu eksekusi:
- profile_company untuk setiap perusahaan yang kamu temukan (berikan nama + teks apapun yang kamu ketahui)
- discover_emails untuk domain perusahaan
- generate_proposal dengan semua profil perusahaan sebagai partner_profiles
- render_pdf type "outbound"
- render_pdf type "internal"
- save_to_knowledge_base type "proposal"

Setelah semua tools dipanggil, tulis RINGKASAN AKHIR dengan format WAJIB:
NAMA_PRODUK: [nama]
RINGKASAN: [deskripsi]
EMAIL_DRAFT_1:
PERUSAHAAN: [nama]
EMAIL: [email]
PERAN: [peran]
SUBJEK: [subject email]
ISI:
[isi email 3-4 paragraf]
(dst untuk setiap perusahaan, maks 3)`
        } else {
          nudge = agentType === "full"
            ? `Lanjutkan pipeline! Panggil: profile_company → discover_emails → generate_proposal → render_pdf (outbound) → render_pdf (internal) → save_to_knowledge_base. Lalu tulis RINGKASAN AKHIR dengan NAMA_PRODUK, RINGKASAN, dan EMAIL_DRAFT untuk tiap perusahaan — setiap EMAIL_DRAFT WAJIB ada SUBJEK dan ISI yang diisi lengkap.`
            : `Lanjutkan ke langkah berikutnya — crawl website, profile_company, simpan ke knowledge base.`
        }
        messages.push({ role: "user", content: nudge })
        continue
      }

      onProgress({ type: "completed", message: `Selesai dalam ${iterationCount} iterasi`, timestamp: ts() })
      return { success: true, result: text, iterations: iterationCount }
    }

    for (const toolCall of msg.tool_calls || []) {
      const name = toolCall.function.name
      let input: Record<string, unknown> = {}
      try {
        input = JSON.parse(toolCall.function.arguments)
      } catch {
        input = {}
      }

      toolCallCounts[name] = (toolCallCounts[name] ?? 0) + 1
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
