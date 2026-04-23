from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from typing import Optional
from functools import lru_cache


class RetroSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ===== LLM =====
    groq_api_key: str = Field(default="", description="Groq API key")
    groq_model: str = Field(default="llama-3.3-70b-versatile")
    groq_fast_model: str = Field(default="llama-3.1-8b-instant")

    # ===== Proposal =====
    proposal_author: str = Field(default="Yoel")
    proposal_theme: str = Field(default="light")  # "light" | "dark"

    # ===== Pipeline =====
    input_file: str = Field(default="sample_companies.csv")
    output_dir: str = Field(default="./output")
    db_path: str = Field(default="./retro.db")

    # ===== Email Discovery (optional) =====
    hunter_api_key: Optional[str] = None
    apollo_api_key: Optional[str] = None

    # ===== Email Sending (optional) =====
    resend_api_key: Optional[str] = None
    sender_email: str = Field(default="retro@yourdomain.com")
    sender_name: str = Field(default="RETRO Business Intelligence")

    # ===== Notification (optional) =====
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None

    # ===== OSINT (optional) =====
    shodan_api_key: Optional[str] = None
    crunchbase_api_key: Optional[str] = None

    @property
    def is_groq_configured(self) -> bool:
        return bool(self.groq_api_key and self.groq_api_key != "gsk_xxx")

    @property
    def pdf_theme_class(self) -> str:
        return "dark" if self.proposal_theme == "dark" else "light"


@lru_cache()
def get_settings() -> RetroSettings:
    return RetroSettings()
