from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import auth, health, interviews
from app.core.config import settings
from app.core.database import engine, Base

# Import all models so Base.metadata includes them before create_all
import app.models  # noqa: F401 — registers User and InterviewSession

# Automatically create database tables if they do not exist
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS Configuration - Allow all origins for the MVP development environment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root level health endpoint (e.g. GET /health)
@app.get("/health", status_code=200, tags=["Health"])
def health_check():
    return {
        "status": "ok",
        "message": "Backend service is healthy",
        "project": settings.PROJECT_NAME
    }

# API v1 endpoints
app.include_router(health.router, prefix=settings.API_V1_STR, tags=["Health"])
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"])
app.include_router(
    interviews.router,
    prefix=f"{settings.API_V1_STR}/interviews",
    tags=["Interviews"],
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
