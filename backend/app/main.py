import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import auth, health, interviews, coach
from app.core.config import settings
from app.core.database import engine, Base, wait_for_db
from app.core.migration import run_auto_migrations
from app.services.ai import get_ai_status

logger = logging.getLogger("uvicorn.error")

# Import all models so Base.metadata includes them before create_all
import app.models  # noqa: F401 — registers User and InterviewSession

# Wait for database availability (vital when starting in containerized environments)
wait_for_db()

# Automatically create database tables if they do not exist
Base.metadata.create_all(bind=engine)
# Idempotently add any missing columns (e.g. job_description, interview_language, resume_skills)
run_auto_migrations(engine)

# Log AI provider startup status
ai_stat = get_ai_status()
logger.info(
    "LLM Provider initialized: %s | model: %s | api_key_configured: %s | is_real_llm: %s",
    ai_stat["provider"],
    ai_stat["model"],
    ai_stat["api_key_configured"],
    ai_stat["is_real_llm"],
)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS Configuration - Environment-driven configurable allowed origins
cors_origins = settings.CORS_ORIGINS if settings.CORS_ORIGINS else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root level health endpoint (e.g. GET /health)
@app.get("/health", status_code=200, tags=["Health"])
def health_check():
    return {
        "status": "ok",
        "message": "Backend service is healthy",
        "project": settings.PROJECT_NAME,
        "ai": get_ai_status(),
    }

# API v1 endpoints
app.include_router(health.router, prefix=settings.API_V1_STR, tags=["Health"])
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"])
app.include_router(
    interviews.router,
    prefix=f"{settings.API_V1_STR}/interviews",
    tags=["Interviews"],
)
app.include_router(
    coach.router,
    prefix=f"{settings.API_V1_STR}/coach",
    tags=["Coach"],
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
