import { runAgentRouter } from "./router.js"
import { AgentResult, ProgressEvent } from "../types.js"

export async function runBriefingAgent(
  companyName: string,
  domain: string | undefined,
  context: string | undefined,
  onProgress: (event: ProgressEvent) => void
): Promise<AgentResult> {
  const intent = `Buat briefing komprehensif pra-pertemuan untuk perusahaan: ${companyName}
${domain ? `Domain: ${domain}` : ""}
${context ? `Konteks pertemuan: ${context}` : "Konteks: pertemuan pertama"}

LANGKAH WAJIB (jalankan semua secara berurutan):
1. crawl_website — crawl homepage, halaman about, products/services, dan team (minimal 3 halaman)
2. search_news — cari berita terkini tentang ${companyName} (2 query berbeda)
3. domain_intelligence — dapatkan WHOIS, tech stack, dan history domain${domain ? ` ${domain}` : ""}
4. profile_company — buat profil terstruktur dari semua data yang dikumpulkan
5. generate_briefing_report — generate briefing report 9 sections menggunakan semua data
6. save_to_knowledge_base — simpan briefing (type: "research")
7. render_pdf — render briefing ke PDF (type: "internal")

Output akhir HARUS menyertakan link download PDF briefing.`

  return runAgentRouter(intent, { company_name: companyName, domain, context }, onProgress, "briefing")
}
