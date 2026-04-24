from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal, List
from datetime import datetime


class CompanyProfileCard(BaseModel):
    company_name: str = Field(description="Nama resmi perusahaan")
    domain: Optional[str] = Field(default=None, description="Domain website tanpa https://")
    industry: str = Field(description="Industri utama perusahaan")
    sub_industry: Optional[str] = Field(default=None)
    products_services: List[str] = Field(
        default_factory=list,
        description="Produk atau layanan utama, maksimal 5",
    )
    target_customers: Optional[str] = Field(
        default=None,
        description="Segmen pelanggan: B2B/B2C/Pemerintah/dll",
    )
    company_size: Literal["micro", "small", "medium", "large", "unknown"] = Field(
        default="unknown",
        description="micro=<10, small=10-50, medium=50-250, large=250+",
    )
    tech_maturity: Literal["traditional", "digital_adopter", "tech_native", "unknown"] = Field(
        default="unknown"
    )
    collaboration_potential: List[str] = Field(
        default_factory=list,
        description="Area kolaborasi potensial dengan RETRO",
    )
    red_flags: List[str] = Field(
        default_factory=list,
        description="Potensi masalah atau concern",
    )
    confidence_score: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Keyakinan terhadap akurasi profil ini",
    )
    language_detected: str = Field(
        default="id",
        description="Bahasa dominan teks: id/en/mixed",
    )

    @field_validator("domain")
    @classmethod
    def clean_domain(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return v
        import re
        v = v.lower().strip()
        v = re.sub(r"^https?://", "", v)
        v = v.split("/")[0]
        return v

    @field_validator("products_services")
    @classmethod
    def limit_products(cls, v: List[str]) -> List[str]:
        return list(dict.fromkeys(v))[:5]


class ProposalSections(BaseModel):
    executive_summary: str = Field(description="Ringkasan eksekutif 1-2 paragraf")
    background_our_company: str = Field(description="Profil singkat perusahaan kita")
    target_company_profile: str = Field(description="Profil target company berdasarkan research")
    collaboration_analysis: str = Field(description="Analisis mendalam peluang kolaborasi")
    proposed_value: str = Field(description="Nilai dan manfaat konkret yang ditawarkan")
    implementation_timeline: str = Field(description="Timeline implementasi 3-6 bulan ke depan")
    next_steps: str = Field(description="Call to action dan langkah konkret selanjutnya")
    appendix_data: str = Field(description="Data teknis, referensi, dan sumber informasi")
    email_subject: str = Field(description="Subject email untuk outbound, max 80 karakter")
    email_body_preview: str = Field(description="Preview body email 2-3 kalimat pembuka")


class CompanyInput(BaseModel):
    company_name: str
    url: str
    industry: str = "unknown"
    notes: str = ""


class CrawlResult(BaseModel):
    company_name: str
    url: str
    html: str = ""
    status_code: int = 0
    tool_used: str = "httpx"
    success: bool = False
    error: Optional[str] = None
    crawled_at: datetime = Field(default_factory=datetime.utcnow)


class ExtractedEntities(BaseModel):
    company_name: str
    organizations: List[str] = Field(default_factory=list)
    persons: List[str] = Field(default_factory=list)
    locations: List[str] = Field(default_factory=list)
    emails_found: List[str] = Field(default_factory=list)
    phones_found: List[str] = Field(default_factory=list)
    clean_text: str = ""
    language: str = "id"
    word_count: int = 0


class SynthesisResult(BaseModel):
    top_matches: List[dict] = Field(default_factory=list)
    primary_target: Optional[str] = None
    batch_notes: str = ""
    collaboration_score: float = 0.0
    executive_summary: str = ""
    market_insight: str = ""


class BriefingReport(BaseModel):
    company_info: dict = Field(default_factory=dict, description="Nama, alamat, tahun berdiri, ukuran, website")
    product_analysis: dict = Field(default_factory=dict, description="Breakdown detail semua produk/solusi")
    track_record: dict = Field(default_factory=dict, description="Performa masa lalu, penghargaan, isu, reputasi")
    competitive_landscape: List[dict] = Field(default_factory=list, description="Perusahaan serupa secara global + perbandingan")
    industry_trends: dict = Field(default_factory=dict, description="Tren terkini di domain spesifik mereka")
    indonesia_market_analysis: dict = Field(default_factory=dict, description="Relevansi spesifik ke pasar Indonesia")
    risk_flags: List[str] = Field(default_factory=list, description="Concerns atau red flags yang ditemukan")
    recommended_questions: List[str] = Field(default_factory=list, description="10 pertanyaan yang harus ditanyakan CEO")
    executive_summary: str = Field(default="", description="Sintesis 2-3 paragraf")


class PipelineRunStats(BaseModel):
    start_time: datetime = Field(default_factory=datetime.utcnow)
    end_time: Optional[datetime] = None
    total_companies: int = 0
    crawl_success: int = 0
    crawl_failed: int = 0
    profiles_created: int = 0
    proposals_generated: int = 0
    tokens_used: int = 0
    duration_seconds: float = 0.0
    output_files: List[str] = Field(default_factory=list)
