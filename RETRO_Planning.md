# RETRO: Autonomous Business Intelligence & Product Synthesis
## Master Planning Document
> Versi: 1.1 | Tanggal: 23 April 2026 | Status: Draft Perencanaan

---

## 1. Apa Itu RETRO?

RETRO adalah sistem **agen AI otomatis** yang bekerja layaknya tim riset dan bisnis development yang tidak pernah tidur. Setiap hari, sistem ini:

1. **Memantau dunia** yaitu berita global, tren industri, pameran dan expo yang akan datang
2. **Menemukan perusahaan** dengan mengunjungi website dan membaca katalog serta PDF mereka
3. **Memahami konteks** lalu merangkum "perusahaan ini bergerak di bidang apa, bisa apa, jual apa"
4. **Menemukan peluang** dengan mencocokkan Perusahaan A + Perusahaan B = Produk/Layanan Baru C
5. **Membuat proposal** yaitu menghasilkan draft proposal profesional untuk direview tim
6. **Mengirim setelah diapprove** berupa pengiriman email ke target perusahaan dan notifikasi WhatsApp/Telegram

> RETRO tidak hanya mencari peluang komersial. Peluang yang dicari bisa berupa proyek pemerintah, social enterprise, R&D bersama, atau inovasi dengan barrier to entry tinggi namun execution yang feasible.

---

## 2. Arsitektur Pipeline (5 Phase)

```
PHASE 1: THE DISCOVERY ENGINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Scheduler] --> [News & Trend Collector] --> [Expo/Event Finder]
                                                    |
                                        [Domain & URL Extractor]
                                                    |
                                            [Web Crawler]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PHASE 2: SECURE DATA PIPELINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[PDF Downloader] --> [VirusTotal Scan WAJIB] --> [OCR & Text Extractor]
                                                          |
                                             [Semua jadi TEKS bersih]
                                             [Disimpan ke Storage]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PHASE 3: THE KNOWLEDGE BRAIN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Context Agent] --> membaca teks --> menghasilkan "Company Profile Card"
       |
       GREEN FLAG
       |
[Qdrant Vector DB] <-- menyimpan profil + embedding untuk pencarian
       |
[Historical Search] <-- cari perusahaan serupa 1-2 tahun ke belakang
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PHASE 4: THE ALCHEMIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Synthesis Agent] --> membaca kumpulan Profile Cards
       |
"Perusahaan A + Perusahaan C + Perusahaan Z = Produk/Layanan Baru"
       |
[Idea Brief] --> dokumen internal untuk tim
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PHASE 5: THE DIPLOMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Proposal Writer Agent] --> 3 proposal PDF (masing-masing sesuai konteks perusahaannya)
       |
[Dashboard Human-in-the-Loop]
  ├── APPROVE   --> Kirim email + notif WA/Telegram
  ├── REGENERATE --> AI buat ulang
  └── REJECT    --> Simpan alasan --> AI belajar untuk crawl berikutnya
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 3. Desain Kritis: Mengapa LLM Tidak Dipanggil di Setiap Langkah?

**Masalah jika LLM digunakan di setiap step:**
- Biaya tidak terkontrol karena setiap dokumen yang masuk langsung menghabiskan token
- Rentan prompt injection karena PDF dari perusahaan bisa berisi teks berbahaya yang "memancing" AI keluar dari tugasnya
- Lambat dan tidak scalable: 50 perusahaan sehari dikali LLM call tiap step sama dengan bottleneck

**Solusi RETRO: Lapisan Non-LLM + LLM Strategis**

```
NON-LLM (Otomatis, Murah, Cepat):          LLM (Dipanggil Strategis):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━          ━━━━━━━━━━━━━━━━━━━━━━━━━━
Scheduler / Cron                            Context Agent
News Collector (semua sumber)               Synthesis Agent
Web Crawler                                 Proposal Writer Agent
PDF Downloader
VirusTotal Scanner
OCR (Optical Character Recognition)
Deduplication (penghapus duplikat)
Text Storage
Email Dispatcher
Notifikasi WA/Telegram
```

**LLM hanya "membaca ringkasan", bukan raw data mentah.**
Satu vendor dengan 1.000 halaman katalog diproses OCR terlebih dahulu lalu dijadikan teks, baru diberikan ke LLM dalam bentuk terstruktur yang sudah dipotong-potong (chunking). LLM tidak pernah membaca 1.000 halaman sekaligus.

---

## 4. Sistem Deduplication (Anti-Duplikat)

Aturan keras: **tidak ada data yang sama masuk dua kali ke manapun.**

```
URL/Domain baru terdeteksi
         |
[CEK HASH di Redis] <-- lookup kurang dari 1 milidetik
         |
  Sudah ada? --> BUANG. Selesai.
         |
  Baru? --> Lanjut crawl --> simpan hash
         |
[CEK HASH KONTEN setelah crawl]
         |
  Konten identik? --> BUANG. Selesai.
         |
  Unik? --> Masuk storage --> masuk ke Context Agent
```

> Efek: LLM tidak pernah memproses data duplikat. Biaya dan waktu tidak terbuang.

---

## 5. Tool Stack Final (Dipilih dari 180+ Tool di Excel)

> Filosofi: satu tool terbaik per layer, bukan semua tool dipasang.

| Layer | Tool Dipilih | Alasan Dipilih |
|---|---|---|
| Scheduler | Prefect | Ada UI monitoring, retry otomatis, configurable interval (detik/menit/jam/hari) |
| News dan Trend | GDELT + GNews + trendspyg + Reddit + RSS + EventRegistry + Wikidata | Masing-masing tangkap dimensi intel berbeda (lihat Section 6) |
| Web Crawler | Crawl4AI | Output langsung Markdown bersih, LLM-native, anti-bot bawaan |
| JS Sites | Playwright | Untuk website yang butuh browser untuk render kontennya |
| PDF ke Teks | pymupdf4llm | PDF digital ke Markdown langsung siap LLM, paling cepat |
| OCR untuk Scan | Surya OCR | Untuk PDF scan/gambar, akurasi tertinggi, jalan lokal |
| Virus Scan | VirusTotal API | 70+ antivirus engine, WAJIB sebelum buka file apapun |
| Vector DB | Qdrant | Untuk pencarian semantik "perusahaan mirip ini siapa?" |
| Relational DB | PostgreSQL + SQLModel | Menyimpan metadata terstruktur semua perusahaan |
| Cache/Dedup | Redis | Gate deduplication, job queue, state pipeline |
| LLM Router | LiteLLM | Satu interface untuk semua provider (Claude/OpenAI/Ollama) |
| Agent Framework | LangGraph | DAG state machine dengan pipeline deterministik dan checkpointing |
| Email Finder | Hunter.io | Temukan email dari domain perusahaan target |
| PDF Generator | WeasyPrint + Jinja2 | HTML template ke PDF profesional (LLM hanya kirim teks, template yang format) |
| Email Sender | Resend | 3.000 email/bulan gratis, tracking bawaan |
| Notifikasi | Apprise | Satu library untuk Telegram + WhatsApp sekaligus |

---

## 6. Mengapa Semua Sumber Berita Digunakan?

Setiap sumber menangkap **dimensi intel yang berbeda**. Jika salah satu tidak ada, ada "blind spot":

| Sumber | Yang Ditangkap |
|---|---|
| GDELT | Event global real-time: "ada konferensi industri X di negara Y minggu ini" |
| GNews / NewsAPI | Headline bisnis: "vendor Z baru luncurkan produk baru" |
| Google Trends (trendspyg) | "Keyword expo manufaktur lagi naik atau turun bulan ini?" |
| Reddit PRAW | Sinyal komunitas: "orang di industri ini lagi ngomongin apa?" |
| RSS Feed industri | Announcement resmi dari asosiasi dan organizer expo |
| EventRegistry | Clustering artikel: "10 artikel ini semua ngomongin event yang sama" |
| Wikidata SPARQL | "Expo ini pernah ada sebelumnya? Siapa pesertanya tahun lalu?" |
| World Bank API | Konteks ekonomi negara target untuk validasi relevansi market |

**Kombinasi semua sumber membuat LLM bisa menjawab:**
> "Indo Manufacturing Expo bulan depan. Tiga vendor yang kami crawl kemarin mirip dengan perusahaan di database 2023, tapi kombinasi produk A dan B belum pernah ada yang coba. Barrier to entry tinggi karena butuh sertifikasi khusus, tapi tim yang tepat bisa eksekusi dalam 6 bulan."

---

## 7. Penjelasan Token untuk Direktur

### Apa itu Token?

Token adalah **satuan terkecil yang dibaca AI**. Anggap saja seperti "pulsa" yang digunakan AI setiap kali membaca atau menulis sesuatu.

| Perbandingan Nyata | Jumlah Token |
|---|---|
| 1 kata Bahasa Inggris | sekitar 1 token |
| 1 kata Bahasa Indonesia | sekitar 1,5 sampai 2 token |
| 1 halaman A4 (proposal standar) | sekitar 500 sampai 700 token |
| 50 halaman proposal | sekitar 30.000 token |
| 100 halaman proposal | sekitar 60.000 token |
| 3 proposal masing-masing 50 halaman | sekitar 90.000 token |

---

### Realita Penggunaan Claude Sonnet 4.6 di Browser (claude.ai Max $100/bulan)

**Pola penggunaan saat ini:**

Mulai kerja jam 08.00 pagi. Limit habis, refresh, habis lagi, refresh, dan jam 18.00 sudah refresh untuk ketiga kalinya. Artinya dalam satu hari kerja, limit terkuras sebanyak 3 kali. Setiap Rabu, limit mingguan sudah mendekati habis padahal minggu baru mulai hari Senin.

Ini bukan karena timnya boros. Ini karena **browser Claude menyembunyikan pemborosan token yang masif**.

**Mengapa limit cepat habis di browser:**

Setiap kali kita mengirim pesan baru di Claude, sistem secara otomatis mengirim ulang SELURUH riwayat percakapan sebelumnya sebagai "konteks". Ini yang disebut "history tax" atau pajak riwayat.

```
Contoh percakapan 10 pesan di Claude Browser:

Pesan 1:  kirim  500 token input,  dapat 800 token output   = 1.300 total
Pesan 2:  kirim 1.300 + 500 token, dapat 800 token output   = 2.600 total
Pesan 3:  kirim 2.600 + 500 token, dapat 800 token output   = 3.900 total
Pesan 4:  kirim 3.900 + 500 token, dapat 800 token output   = 5.200 total
...
Pesan 10: kirim 11.700 + 500 token, dapat 800 token output  = 13.000 total

TOTAL TOKEN DIKONSUMSI:              50.000 token
TOTAL KONTEN BARU YANG BERGUNA:       8.000 token (16%)
TOTAL YANG DIBUANG SEBAGAI RIWAYAT:  42.000 token (84%)
```

Semakin panjang percakapan, semakin parah pemborosannya.

**Breakdown token satu sesi buat 3 proposal di Claude Browser:**

```
TOTAL DIKONSUMSI DALAM SATU SESI (Claude Sonnet 4.6 Browser):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Konten proposal yang berguna            90.000 token   (50%)
Riwayat percakapan yang dikirim ulang   54.000 token   (30%)
Formatting markdown dan tampilan chat    9.000 token    (5%)
Overhead sistem UI browser              13.500 token    (7,5%)
Token "berpikir" internal model          9.000 token    (5%)
Revisi dan tanya jawab manual            4.500 token    (2,5%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL DIKONSUMSI:                      180.000 token  (100%)
YANG BENAR-BENAR BERGUNA:              90.000 token   (50%)
YANG TERBUANG SIA-SIA:                 90.000 token   (50%)
```

**Dengan kata lain: setengah dari langganan $100/bulan lo terbakar tanpa menghasilkan apapun.**

---

### Token Terbuang Itu Setara dengan Apa?

90.000 token yang terbuang setiap kali membuat 3 proposal itu setara dengan:

| Kalau Dipakai untuk RETRO via API | Hasil yang Bisa Didapat |
|---|---|
| Profiling perusahaan baru | 45 Company Profile Card (rata-rata 2.000 token per profil) |
| Proposal tambahan | 3 proposal 50 halaman lagi, GRATIS, dari token yang sebelumnya dibuang |
| Analisis berita harian | 90 artikel bisnis dianalisis dan diklasifikasikan |
| Historical similarity search | 180 query ke knowledge base Qdrant dengan konteks penuh |

---

### Perbandingan Visual: Browser vs API

```
CLAUDE BROWSER ($100/bulan):
████████████████████ 50% PROPOSAL BERGUNA
████████████████████ 50% DIBUANG (riwayat, UI, formatting)

RETRO VIA API:
██████████████████████████████████████ 94% PROPOSAL BERGUNA
██ 6% overhead (system prompt + profile card)
```

---

## 8. Mitos: "API Lebih Mahal dari Langganan"

Ini adalah **kesalahpahaman yang paling umum** dan paling merugikan.

### Fakta Langganan $100/bulan

```
$100/bulan dibagi 30 hari            = $3,33 per hari
$3,33 per hari dibagi 3 sesi limit   = $1,11 per sesi
1 sesi habis dalam 2 sampai 3 jam kerja nyata

Hari kerja efektif per minggu        = Senin sampai Rabu saja
Hari kerja efektif per bulan         = sekitar 12 sampai 15 hari (dari 22 hari kerja)
Hari "menganggur nunggu limit"       = 7 sampai 10 hari per bulan
```

**Biaya nyata per proposal yang dihasilkan:**

Dengan asumsi bisa bikin 3 proposal per hari kerja efektif dan 15 hari efektif per bulan:
- Total proposal per bulan: 45 proposal
- Biaya per proposal: $100 dibagi 45 = **$2,22 per proposal = Rp 35.500 per proposal**

Tapi ada yang lebih menyakitkan: **7 sampai 10 hari per bulan, tim tidak bisa bekerja maksimal karena menunggu limit refresh.**

---

### Fakta Biaya API (Pay as You Go)

Kurs referensi: USD 1 = Rp 16.000

**Untuk 3 Proposal masing-masing 50 halaman:**

```
Input per proposal:
  System prompt          500 token
  Company Profile Card   1.500 token
  Instruksi template     500 token
  Total input/proposal   2.500 token
  Total input x3         7.500 token

Output per proposal:
  50 halaman x 600 token = 30.000 token
  Total output x3        = 90.000 token
```

| Provider | Model | Biaya Input | Biaya Output | TOTAL (USD) | TOTAL (IDR) |
|---|---|---|---|---|---|
| Claude API | Sonnet 4.6 | $0,023 | $1,35 | **$1,37** | **Rp 21.920** |
| Claude API | Haiku 4.5 | $0,006 | $0,36 | **$0,37** | **Rp 5.920** |
| Claude API | Opus 4.7 | $0,11 | $6,75 | **$6,86** | **Rp 109.760** |
| OpenAI API | GPT-4o | $0,019 | $0,90 | **$0,92** | **Rp 14.720** |
| OpenAI API | GPT-4o-mini | $0,001 | $0,054 | **$0,055** | **Rp 880** |
| Groq | Llama 3.1 70B | GRATIS | GRATIS | **$0** | **Rp 0** |
| Ollama Lokal | Llama 3.1 70B | GRATIS | GRATIS | **$0** | **Rp 0** |
| **Claude Browser** | **Sonnet 4.6** | *(flat $100/bln)* | *(flat $100/bln)* | **~$2,22/proposal** | **~Rp 35.500/proposal** |

**Claude Sonnet 4.6 API 63% lebih murah per proposal dibandingkan menggunakan subscription browser.**

---

### Perbandingan untuk 3 Proposal masing-masing 100 Halaman

| Provider | Model | TOTAL (USD) | TOTAL (IDR) |
|---|---|---|---|
| Claude API | Sonnet 4.6 | **$2,71** | **Rp 43.360** |
| Claude API | Haiku 4.5 | **$0,73** | **Rp 11.680** |
| OpenAI API | GPT-4o | **$1,82** | **Rp 29.120** |
| Claude Browser | Sonnet 4.6 | **~$4,44/proposal** | **~Rp 71.040/proposal** |

---

### Perbandingan Skenario Satu Bulan Penuh (22 hari kerja)

Asumsi: 3 proposal per hari kerja = 66 proposal per bulan

| Metode | Biaya per Bulan (USD) | Biaya per Bulan (IDR) | Proposal per Bulan | Biaya per Proposal |
|---|---|---|---|---|
| Claude Browser (kondisi sekarang) | $100 flat | Rp 1.600.000 | Max 45 (limit weekday) | Rp 35.556 |
| Claude API Sonnet 4.6 | $90,42 | Rp 1.446.720 | 66 (tanpa batas) | Rp 21.920 |
| Claude API Haiku 4.5 | $24,42 | Rp 390.720 | 66 (tanpa batas) | Rp 5.920 |
| OpenAI GPT-4o | $60,72 | Rp 971.520 | 66 (tanpa batas) | Rp 14.720 |
| Groq + Ollama Lokal | $0 | Rp 0 | Tidak terbatas | Rp 0 |

**Kesimpulan: dengan budget yang SAMA ($100/bulan), Claude API menghasilkan 47% lebih banyak proposal dan tim tidak pernah menunggu limit.**

---

### Kelebihan API vs Browser Secara Lengkap

| Aspek | Claude Browser (sekarang) | RETRO via API |
|---|---|---|
| Otomasi | Tidak bisa, harus manual klik | Jalan sendiri 24 jam 7 hari |
| Paralel | Satu percakapan saja | Bisa proses 50 perusahaan sekaligus |
| Token terbuang | 50% terbuang sia-sia | Kurang dari 6% terbuang |
| Rate limit | Limit 5 jam, habis 3 kali per hari | Pay per use, tidak ada batas sesi |
| Hari kerja efektif | 12-15 hari per bulan saja | 22 hari per bulan, penuh |
| Prompt injection protection | Tidak ada perlindungan khusus | Sandbox system prompt ketat |
| Konsistensi output | Format bebas, bisa tidak konsisten | JSON schema ketat, validasi otomatis |
| Audit trail | Tidak ada log terstruktur | Setiap call tercatat di database |
| Skalabilitas | 3 proposal per hari maksimal | 300 proposal per hari jika diperlukan |
| Biaya per proposal | Rp 35.500 | Rp 21.920 (Sonnet) atau Rp 5.920 (Haiku) |

---

## 9. Rekomendasi Stack LLM Final

```
RETRO LLM ROUTING (via LiteLLM):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Context Agent (volume tinggi, tugas ekstraksi):
  Model utama   : Groq Llama 3.1 70B (GRATIS, cepat)
  Fallback       : GPT-4o-mini (Rp 880 per 3 proposal)

Synthesis Agent (sekali per batch, perlu reasoning kuat):
  Model utama   : Claude Sonnet 4.6 atau GPT-4o
  Biaya estimasi : Rp 8.000 per batch

Proposal Writer Agent (kualitas bahasa tertinggi):
  Model utama   : Claude Sonnet 4.6 atau GPT-4o
  Biaya estimasi : Rp 21.920 per 3 proposal (50 halaman)

Fallback Universal (offline, API down, atau budget habis):
  Model          : Ollama Llama 3.1 70B (lokal, GRATIS)
  Syarat hardware: GPU minimal 24GB VRAM (contoh: RTX 3090 atau RTX 4090)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ESTIMASI BIAYA OPERASIONAL HARIAN (50 perusahaan per hari):

Context Agent untuk 50 perusahaan    : GRATIS (Groq)
Synthesis Agent (1 batch per hari)   : Rp 8.000
Proposal Writer (3 proposal per hari): Rp 21.920
                                       ----------
TOTAL ESTIMASI HARIAN                : Rp 29.920
TOTAL ESTIMASI BULANAN (22 hari)     : Rp 658.240

Dibandingkan kondisi sekarang        : Rp 1.600.000/bulan
PENGHEMATAN BULANAN                  : Rp 941.760 (58% lebih hemat)
```

**Dan tim bisa bekerja penuh 22 hari per bulan, bukan 12-15 hari.**

---

## 10. Mengapa Satu Provider Disarankan, Tapi Kami Pakai Multi-Provider

**Argumen satu provider:**
- Credential management lebih sederhana
- Perilaku output lebih konsisten dan mudah di-debug
- Tidak perlu handle perbedaan format response antar API

**Argumen multi-provider yang kami pilih:**
- Routing berdasarkan tugas: model murah untuk tugas sederhana, model premium untuk tugas kritis
- Resilience: jika OpenAI down, fallback ke Groq atau Ollama
- Cost optimization: gunakan Groq gratis untuk Context Agent, Claude atau GPT-4o hanya untuk Synthesis dan Proposal

**Solusi: LiteLLM sebagai Router Tunggal**

```python
# Satu interface, bisa ganti provider kapan saja tanpa ubah kode
response = litellm.completion(
    model="gpt-4o",     # ganti ke "claude-sonnet-4-6" atau "ollama/llama3" kapan saja
    messages=[{"role": "user", "content": prompt}]
)
```

Jika suatu hari ada provider yang lebih bagus atau lebih murah, cukup ubah satu baris. Tidak ada yang perlu diubah di logika pipeline.

---

## 11. Roadmap Pengembangan

### Phase 0: Fondasi (Minggu 1 sampai 2)
- [ ] Setup project repository dan struktur folder
- [ ] Setup PostgreSQL + Redis + Qdrant (Docker Compose)
- [ ] Setup LiteLLM dengan routing GPT-4o + Groq + Ollama
- [ ] Test koneksi semua provider

### Phase 1: Vertical Slice (Minggu 3 sampai 4)
> Satu perusahaan, end-to-end, dari crawl sampai Profile Card keluar.
- [ ] Crawl 1 domain perusahaan, simpan teks
- [ ] Context Agent menghasilkan 1 Company Profile Card
- [ ] Simpan ke Qdrant
- [ ] Validasi output: apakah profil akurat?

### Phase 2: Discovery Engine (Minggu 5 sampai 6)
- [ ] Integrasi semua news sources (GDELT, GNews, RSS, dll.)
- [ ] Expo/Event keyword finder
- [ ] Domain extractor dari halaman expo
- [ ] Deduplication gate (Redis hash)
- [ ] Scheduler (Prefect) dengan configurable interval

### Phase 3: PDF Pipeline (Minggu 7 sampai 8)
- [ ] PDF downloader + VirusTotal gate
- [ ] OCR pipeline (pymupdf4llm + Surya)
- [ ] Chunking strategy untuk dokumen 1000+ halaman
- [ ] Anti-prompt-injection sandbox di Context Agent

### Phase 4: Knowledge Brain (Minggu 9 sampai 10)
- [ ] Historical retrieval dari Qdrant
- [ ] Uniqueness analysis
- [ ] Synthesis Agent untuk matchmaking perusahaan

### Phase 5: Diplomat (Minggu 11 sampai 12)
- [ ] Proposal Writer Agent
- [ ] PDF Generator (WeasyPrint + Jinja2 template)
- [ ] Dashboard Human-in-the-Loop (web UI)
- [ ] Email discovery (Hunter.io) + Email sender (Resend)
- [ ] Notifikasi (Apprise ke Telegram + WhatsApp)

### Phase 6: Production Hardening
- [ ] Monitoring dan observability (Langfuse)
- [ ] Error handling dan retry logic
- [ ] Rate limit management per API provider
- [ ] Load testing pipeline
- [ ] Dokumentasi operasional

---

## 12. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| PDF berisi prompt injection | AI "keracunan" dan keluar dari tugas | System prompt sandbox + structured output validation |
| Token "mabok" dokumen terlalu panjang | Output tidak relevan | Chunking + token budget limit per Context Agent call |
| API provider down | Pipeline berhenti | LiteLLM fallback routing otomatis ke Ollama lokal |
| Domain di-blacklist karena crawling agresif | Tidak bisa akses website | Crawl4AI rate limiting + rotate user-agent + proxy rotation |
| Duplikat data masuk DB | Pemborosan storage dan biaya LLM | Redis hash gate sebelum setiap tahap penyimpanan |
| Proposal tidak diapprove terus | Feedback loop tidak berfungsi | Simpan alasan reject sebagai training context untuk Synthesis Agent |
| GPU belum tersedia untuk Ollama | Tidak ada fallback lokal | Gunakan Groq (gratis) sebagai fallback sementara |

---

*Dokumen ini akan diupdate seiring perkembangan proyek.*
*Kurs referensi yang digunakan: USD 1 = Rp 16.000 (April 2026)*
