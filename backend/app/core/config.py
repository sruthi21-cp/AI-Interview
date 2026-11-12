import os
from typing import Union, List
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_root_dir = os.path.dirname(_backend_dir)
_backend_env = os.path.join(_backend_dir, ".env")
_root_env = os.path.join(_root_dir, ".env")

def normalize_database_url(url: str) -> str:
    """
    Normalizes a database connection URL for SQLAlchemy.

    Render and other PaaS providers often provide PostgreSQL connection strings
    with the 'postgres://' or 'postgresql://' scheme. In SQLAlchemy 2.0+,
    'postgresql://' without an explicit driver attempts to load the 'psycopg'
    (v3) driver. Since this project uses 'psycopg2-binary', we explicitly normalize
    PostgreSQL URLs to use the 'postgresql+psycopg2://' scheme.

    Preserves credentials, special characters, ports, and query parameters safely.
    Preserves SQLite URLs (e.g. 'sqlite:///./sql_app.db', 'sqlite:///:memory:').
    """
    if not isinstance(url, str):
        return url

    trimmed = url.strip()
    if not trimmed:
        return trimmed

    if trimmed.startswith("postgres://"):
        return f"postgresql+psycopg2://{trimmed[len('postgres://'):]}"
    if trimmed.startswith("postgresql://"):
        return f"postgresql+psycopg2://{trimmed[len('postgresql://'):]}"
    if trimmed.startswith("postgresql+psycopg://"):
        return f"postgresql+psycopg2://{trimmed[len('postgresql+psycopg://'):]}"
    return trimmed


class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Interview Simulator"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "local_development_only_secret_key_1234567890"
    JWT_SECRET: str | None = None
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    DATABASE_URL: str = "sqlite:///./sql_app.db"
    ENVIRONMENT: str = "development"
    AI_PROVIDER: str = "mock"
    AI_API_KEY: str | None = None
    AI_MODEL: str | None = None
    GEMINI_API_KEY: str | None = None
    OPENAI_API_KEY: str | None = None

    # Email / SMTP settings (optional — if not set, reset URL is logged to console)
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM_EMAIL: str = "noreply@aiinterview.app"
    SMTP_USE_TLS: bool = True

    # Password reset
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 30
    FRONTEND_URL: str = "http://localhost:3000"

    # Configurable CORS allowed origins (defaults to common local and LAN dev origins)
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://localhost:80",
        "http://127.0.0.1:80",
        "http://10.10.16.195:3000",
        "http://10.10.16.195:3001",
        "http://10.10.16.195:5173",
        "http://10.10.16.195:80",
        "http://10.10.16.195",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: str) -> str:
        return normalize_database_url(v)

    def model_post_init(self, __context):
        if self.JWT_SECRET and self.SECRET_KEY == "local_development_only_secret_key_1234567890":
            self.SECRET_KEY = self.JWT_SECRET
        if not self.AI_API_KEY:
            if self.GEMINI_API_KEY:
                self.AI_API_KEY = self.GEMINI_API_KEY
            elif self.OPENAI_API_KEY:
                self.AI_API_KEY = self.OPENAI_API_KEY
        if not self.AI_MODEL:
            prov = (self.AI_PROVIDER or "").lower().strip()
            if prov == "gemini":
                self.AI_MODEL = "gemini-3.5-flash"
            elif prov == "openai":
                self.AI_MODEL = "gpt-4o-mini"

    model_config = SettingsConfigDict(
        env_file=(".env", _backend_env, _root_env),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()



